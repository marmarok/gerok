// Gerok — offline harita.
//
// Harita verisi bir .pmtiles arşivi: 6 ülke, sokak seviyesi, ~357 MB.
// Ev wifi'sinde bir kez indirilip cihaza kaydediliyor (depo.js hangi yolu
// kullanacağına karar veriyor). Sonrasında hiçbir ağ isteği yok — uçak
// modunda da aynı çalışıyor.

// maplibregl ve pmtiles index.html'den yükleniyor (global). ES modülü olarak değil,
// çünkü MapLibre v6 özel protokolleri artık çağırmıyor — pmtiles'ın çalıştığı
// sürüm v5, o da tek dosyalık klasik bir betik olarak geliyor.
/* global maplibregl, pmtiles */
import { aktifGerok, duraklar } from './gerok.js';
import * as depo from './depo.js';
import { stilUret, BOS_STIL, KIPLER } from './harita-stil.js';

export { KIPLER };

// Harita parçalarının adresi.
//
// Neden burada, uygulamanın yanında değil: 357 MB'lık klasör yayının içinde
// olunca GitHub Pages dağıtımı 10 dakikalık sınırı aşıp sürekli başarısız oldu
// (beş üst üste "Timeout reached"). Harita depoda duruyor ama yayına girmiyor;
// dosyalar raw.githubusercontent üzerinden, DEĞİŞMEZ bir etiketten çekiliyor.
// raw CORS başlığı veriyor (denendi: access-control-allow-origin: *) —
// Release dosya sunucusu vermiyordu, o yüzden o yol kapalıydı.
// Neden parçalı: git'in dosya başına 100 MB sınırı var.
//
// Harita yenilenirse: dosyaları depoya koy, `harita-v2` etiketi at, buradaki
// adresi güncelle. Eski etiket eski sürümü sunmaya devam eder.
const HARITA_UZAK = 'https://raw.githubusercontent.com/marmarok/gerok/harita-v1/harita';
const HARITA_YEREL = 'harita';

export let HARITA_KLASORU = HARITA_UZAK;

// Parça listesi hangi adresten geliyorsa parçalar da oradan inecek.
// Yerel kopya varsa (kendi sunucusunda barındıran biri) o tercih edilir.
async function haritaAdresiSec() {
  for (const kok of [HARITA_YEREL, HARITA_UZAK]) {
    try {
      const y = await fetch(`${kok}/parcalar.json`, { method: 'GET' });
      if (y.ok) {
        HARITA_KLASORU = kok;
        return { kok, bilgi: await y.json() };
      }
    } catch { /* sonrakini dene */ }
  }
  throw new Error('Parça listesi hiçbir adresten alınamadı');
}

const PMTILES_IMZASI = 'PMTiles';

let harita = null;
let kuruluyor = null;
let pmt = null;
let aktifKip = 'gunduz';
// Kip değişince stil sıfırlanıyor, kendi katmanlarımız (iz, anılar, duraklar)
// siliniyor. Yeniden çizebilmek için en son ne gösterdiğimizi tutuyoruz.
let sonVeri = { kayitlar: [], iz: [] };

// ---- Kayıtlı dosyayı pmtiles'a okutan kaynak ------------------------------
// pmtiles yalnızca "şu konumdan şu kadar bayt ver" diyor; Blob.slice bunu
// hem OPFS hem IndexedDB tarafında aynı şekilde karşılıyor.

class BlobKaynak {
  constructor(blob, anahtar) { this.blob = blob; this.anahtar = anahtar; }
  getKey() { return this.anahtar; }
  async getBytes(konum, uzunluk) {
    return { data: await this.blob.slice(konum, konum + uzunluk).arrayBuffer() };
  }
}

// Parça listesi indirmede kaydediliyor; sonraki açılışlarda ağa gerek kalmasın diye.
async function parcaListesi() {
  const { ayarOku } = await import('./veri.js');
  return ayarOku('haritaParcalari', null);
}

// Kayıtlı parçaları tek bir Blob gibi gösterir. Blob birleştirmesi ucuz:
// veriyi belleğe kopyalamaz, parçalara referans tutar.
async function haritaBlobu() {
  const bilgi = await parcaListesi();
  if (!bilgi?.parcalar?.length) return null;

  const parcalar = [];
  for (const p of bilgi.parcalar) {
    const b = await depo.oku('harita', p.ad);
    if (!b || b.size !== p.boyut) return null;
    parcalar.push(b);
  }
  return new Blob(parcalar);
}

// Harita tamsa toplam boyutu, değilse 0 döner.
export async function haritaVarMi() {
  const bilgi = await parcaListesi();
  if (!bilgi?.parcalar?.length) return 0;

  let toplam = 0;
  for (const p of bilgi.parcalar) {
    const b = await depo.boyut('harita', p.ad);
    if (b !== p.boyut) return 0;      // eksik parça = harita yok
    toplam += b;
  }
  return toplam;
}

export async function haritaIndir(ilerleme) {
  const { ayarYaz } = await import('./veri.js');

  const { bilgi } = await haritaAdresiSec();

  // İndirme yarıda kesilirse tamamlanmış parçalar duruyor — onlar yeniden inmez.
  // 357 MB'ın tek seferde inmesini şart koşmuyoruz: telefon uykuya dalsa,
  // uygulama arka plana atılsa ya da wifi bir an kopsa kaldığı yerden devam eder.
  await ayarYaz('haritaParcalari', null);

  const eksikler = [];
  let inen = 0;
  for (const p of bilgi.parcalar) {
    if (await depo.boyut('harita', p.ad) === p.boyut) {
      inen += p.boyut;                 // bu parça zaten tam
    } else {
      await depo.sil('harita', p.ad);  // yarım kalmışsa at, baştan insin
      eksikler.push(p);
    }
  }
  ilerleme?.(inen, bilgi.toplamBoyut);

  for (const parca of eksikler) {
    const yanit = await fetch(`${HARITA_KLASORU}/${parca.ad}`);
    if (!yanit.ok) throw new Error(`${parca.ad} inmedi (${yanit.status})`);

    // Gövdeyi akış halinde okuyoruz: response.blob() büyük dosyalarda
    // başarısız olabiliyor, ayrıca tek seferde 357 MB'ı belleğe almak
    // telefonda zaten istenmeyen bir şey. Aynı anda en fazla bir parça tutuluyor.
    const okuyucu = yanit.body.getReader();
    const dilimler = [];
    for (;;) {
      const { done, value } = await okuyucu.read();
      if (done) break;
      dilimler.push(value);
      ilerleme?.(inen + dilimler.reduce((t, d) => t + d.length, 0), bilgi.toplamBoyut);
    }

    const blob = new Blob(dilimler);
    if (blob.size !== parca.boyut) {
      throw new Error(`${parca.ad} eksik indi: ${blob.size} / ${parca.boyut}`);
    }
    await depo.yaz('harita', parca.ad, blob);
    inen += blob.size;
    ilerleme?.(inen, bilgi.toplamBoyut);
  }

  await ayarYaz('haritaParcalari', bilgi);

  // Doğrulama: parçalar tam mı ve birleşince gerçekten pmtiles mi?
  const birlesik = await haritaBlobu();
  const imza = birlesik
    ? new TextDecoder().decode(await birlesik.slice(0, 7).arrayBuffer())
    : '';

  if (!birlesik || birlesik.size !== bilgi.toplamBoyut || imza !== PMTILES_IMZASI) {
    await ayarYaz('haritaParcalari', null);
    for (const p of bilgi.parcalar) await depo.sil('harita', p.ad);
    throw new Error(
      !birlesik || birlesik.size !== bilgi.toplamBoyut
        ? `Eksik yazıldı: ${birlesik?.size || 0} / ${bilgi.toplamBoyut} bayt`
        : 'İnen dosya harita değil — indirme bozulmuş'
    );
  }

  return birlesik.size;
}

// ---- Harita kurulumu ------------------------------------------------------

// pmtiles:// isteklerini cihazdaki dosyadan karşılar. Ağ hiç devreye girmiyor.
function protokolKur() {
  maplibregl.addProtocol('pmtiles', async (istek) => {
    const e = istek.url.match(/pmtiles:\/\/[^/]+\/(\d+)\/(\d+)\/(\d+)/);
    if (!e) {
      const ust = await pmt.getHeader();
      return { data: {
        tiles: ['pmtiles://harita/{z}/{x}/{y}'],
        minzoom: ust.minZoom, maxzoom: ust.maxZoom,
        bounds: [ust.minLon, ust.minLat, ust.maxLon, ust.maxLat]
      } };
    }
    const karo = await pmt.getZxy(+e[1], +e[2], +e[3]);
    return { data: karo ? new Uint8Array(karo.data) : new Uint8Array() };
  });
}

export async function haritaKur() {
  if (harita) return harita;
  if (kuruluyor) return kuruluyor;

  kuruluyor = (async () => {
    const { ayarOku } = await import('./veri.js');
    const kap = document.getElementById('harita');
    const uyari = document.getElementById('haritaUyari');
    const boyut = await haritaVarMi();

    aktifKip = await ayarOku('haritaKipi', 'gunduz');
    let stil = BOS_STIL;

    if (boyut) {
      try {
        const dosya = await haritaBlobu();
        if (!dosya) throw new Error('harita parçaları okunamadı');
        pmt = new pmtiles.PMTiles(new BlobKaynak(dosya, 'gerok-harita'));
        protokolKur();
        stil = stilUret(aktifKip);
        uyari?.classList.add('gizli');
      } catch (hata) {
        console.warn('harita dosyası açılamadı', hata);
        uyari.textContent = 'Harita dosyası okunamadı. Gerok sekmesinden yeniden indir.';
        uyari.classList.remove('gizli');
      }
    } else {
      uyari.innerHTML = 'Offline harita henüz indirilmedi.<br>' +
        '<b>Gerok</b> sekmesinden, <b>ev wifi\'sindeyken</b> indir — yolda internet olmayacak.';
      uyari.classList.remove('gizli');
    }

    // Harita doğrudan son stille kuruluyor. Önce boş stille açıp sonra
    // setStyle demek MapLibre'de kaynak eklenmeden karo isteği doğuruyor
    // ("no tile manager with ID") ve harita bomboş kalıyor.
    harita = new maplibregl.Map({
      container: kap,
      style: stil,
      center: [20.5, 42.6],
      zoom: 6,
      attributionControl: false,
      maxPitch: 0
    });

    await new Promise(t => harita.on('load', t));

    // Kap ölçüsü sonradan oturursa (sekme açılışı, ekran döndürme, klavye)
    // tuval eski boyutta kalıp haritanın bir kısmı boş görünüyor.
    new ResizeObserver(() => harita.resize()).observe(kap);

    durakDokunmasiniKur(kap);

    kaynakYazisiTazele();
    rotayiCiz();
    return harita;
  })();

  return kuruluyor;
}

export function aktifKipAl() { return aktifKip; }

// Gündüz / Gece / Uydu. Uydu internet ister; diğer ikisi cihazdaki dosyadan.
export async function kipDegistir(kip) {
  if (!harita || kip === aktifKip) return;
  const { ayarYaz } = await import('./veri.js');
  aktifKip = kip;
  await ayarYaz('haritaKipi', kip);

  harita.setStyle(pmt ? stilUret(kip) : BOS_STIL);
  await new Promise(t => harita.once('styledata', t));

  // Stil sıfırlandı: rota, iz ve anı katmanları yeniden kuruluyor.
  rotayiCiz();
  haritaGuncelle(sonVeri.kayitlar, sonVeri.iz);
  kaynakYazisiTazele();
}

// Harita verisinin kaynağı yazılmak zorunda (OpenStreetMap ve Esri koşulu).
function kaynakYazisiTazele() {
  const e = document.getElementById('haritaKaynak');
  if (!e) return;
  e.textContent = aktifKip === 'uydu'
    ? '© Esri, Maxar · © OpenStreetMap'
    : '© OpenStreetMap · çevrimdışı pmtiles';
}

// Haritanın o an baktığı yer — "Google Haritalar'da aç" bunu kullanıyor.
export function haritaMerkezi() {
  if (!harita) return null;
  const m = harita.getCenter();
  return { lat: m.lat, lon: m.lng, zoom: Math.round(harita.getZoom()) };
}

export function haritaBoyutTazele() {
  setTimeout(() => harita?.resize(), 60);
}

// ---- Katmanlar ------------------------------------------------------------

// Gün renkleri. Eskiden her biri ayrı ayrı seçilmişti; kırmızı ile mavi yan
// yana gelince biri ötekinin önüne fırlıyordu. Bu sekizi aynı doygunluk ve
// aynı açıklıkta — sekiz günün rotası üst üste bindiğinde harita karışmıyor.
// css/stil.css'teki --g1…--g8 ile aynı değerler; ikisi birlikte değişmeli
// (harita katmanı CSS değişkeni okuyamıyor, değerler burada yazılı olmalı).
const GUN_RENKLERI = ['#d29346', '#a38e55', '#6a8552', '#4a7a78',
                      '#527e96', '#6b5c75', '#9c5a60', '#c25b49'];

function kaynakYaz(ad, veri, katmanlar) {
  if (!harita) return;
  if (harita.getSource(ad)) {
    harita.getSource(ad).setData(veri);
  } else {
    harita.addSource(ad, { type: 'geojson', data: veri });
    for (const k of katmanlar) harita.addLayer(k);
  }
}

// Planlanan rota — harita açılır açılmaz görünsün, iz olmasa bile.
//
// İki çizgi var ve karıştırılmamalı:
//   · ROTA (kesikli, duraktan durağa) — gitmeyi PLANLADIĞIN yol.
//   · İZ (düz çizgi) — gerçekten GİTTİĞİN yol.
// Rota düz hatlarla çiziliyor, yolları takip etmiyor: yol tarifi için
// internete ya da bir rota motoruna gerek var, ikisi de yolda yok.
//
// Duraklar rota sırasına göre numaralanıyor; sıralamayı gerok.js belirliyor.
function rotayiCiz() {
  const liste = duraklar();
  // Liste boşalsa da çiziliyor: son durağını silen biri onu haritada
  // görmeye devam ederdi.
  if (!harita || !harita.style) return;

  const koyu = aktifKip !== 'gunduz';
  const yaziRengi = koyu ? '#f4efe8' : '#231d17';
  const haleRengi = koyu ? '#12100e' : '#ffffff';

  // Rota gün gün renkleniyor ama tek parça: her gün bir öncekinin son
  // durağından devam ediyor, böylece bütün gezi kesintisiz bir çizgi.
  const gunler = new Map();
  for (const d of liste) {
    const g = d.gun ?? 999;
    if (!gunler.has(g)) gunler.set(g, []);
    gunler.get(g).push(d);
  }

  const cizgiler = [];
  let oncekiUc = null;
  Array.from(gunler.keys()).sort((a, b) => a - b).forEach((g, i) => {
    const koord = gunler.get(g).map(d => [d.lon, d.lat]);
    if (oncekiUc) koord.unshift(oncekiUc);
    oncekiUc = koord[koord.length - 1];
    if (koord.length < 2) return;
    cizgiler.push({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: koord },
      properties: { renk: GUN_RENKLERI[i % GUN_RENKLERI.length] }
    });
  });

  kaynakYaz('rota', { type: 'FeatureCollection', features: cizgiler }, [
    { id: 'rota-golge', type: 'line', source: 'rota',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': koyu ? '#000000' : '#3a2c1c', 'line-width': 7, 'line-opacity': 0.22, 'line-blur': 1.5 } },
    { id: 'rota-cizgi', type: 'line', source: 'rota',
      layout: { 'line-cap': 'butt', 'line-join': 'round' },
      paint: {
        'line-color': ['get', 'renk'], 'line-width': 3.2, 'line-opacity': 0.95,
        'line-dasharray': [2.2, 1.3]
      } }
  ]);

  // Durak iğneleri: numara üstünde, ad altında.
  const gunSirasi = Array.from(gunler.keys()).sort((a, b) => a - b);
  kaynakYaz('duraklar', {
    type: 'FeatureCollection',
    features: liste.map((d, i) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [d.lon, d.lat] },
      properties: {
        id: d.id, ad: d.ad, no: String(i + 1),
        renk: GUN_RENKLERI[Math.max(0, gunSirasi.indexOf(d.gun ?? 999)) % GUN_RENKLERI.length]
      }
    }))
  }, [
    { id: 'durak-halka', type: 'circle', source: 'duraklar',
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 8, 11, 12],
        'circle-color': ['get', 'renk'],
        'circle-stroke-width': 2, 'circle-stroke-color': haleRengi
      } },
    { id: 'durak-no', type: 'symbol', source: 'duraklar',
      layout: {
        'text-field': ['get', 'no'], 'text-font': ['noto-medium'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 5, 9, 11, 12],
        'text-allow-overlap': true, 'text-ignore-placement': true
      },
      paint: { 'text-color': '#1a1410' } },
    { id: 'durak-ad', type: 'symbol', source: 'duraklar',
      minzoom: 7,
      layout: {
        'text-field': ['get', 'ad'], 'text-font': ['noto-medium'], 'text-size': 12.5,
        'text-offset': [0, 1.2], 'text-anchor': 'top', 'text-max-width': 10,
        'text-padding': 6, 'text-optional': true
      },
      paint: { 'text-color': yaziRengi, 'text-halo-color': haleRengi, 'text-halo-width': 2 } }
  ]);
}

// Haritadaki bir durağa dokunulunca çağrılacak işlev (app.js kaydediyor).
let durakTiklandi = null;
export function durakTiklamasi(fn) { durakTiklandi = fn; }

// Durak iğnesine dokunma.
//
// MapLibre'nin `map.on('click')` olayına bağlanmıyoruz ve kabın DOM
// `click`ini de tek başına yeterli saymıyoruz: iPhone'da (simülatörde
// denendi, hiç ateşlenmedi) harita üzerindeki parmak dokunuşu DOM tıklaması
// üretmiyor — MapLibre dokunma olaylarını kendine alıp varsayılanı
// engelliyor, iOS de o durumda tıklama sentezlemiyor. Bu yüzden dokunma
// doğrudan dinleniyor; `click` yalnızca fare için duruyor.
function durakDokunmasiniKur(kap) {
  let basim = null;
  let sonDokunma = 0;

  const sorgula = (ekranX, ekranY) => {
    if (!durakTiklandi || !harita?.getLayer('durak-halka')) return;
    const alan = harita.getCanvas().getBoundingClientRect();
    const x = ekranX - alan.left, y = ekranY - alan.top;
    if (x < 0 || y < 0 || x > alan.width || y > alan.height) return;

    // Dokunma hedefi iğneden çok geniş: iğne 11 piksel, parmak ucu 40'a
    // yakın. Araç sallanırken küçük bir daireyi tutturmak imkânsıza yakın.
    const bulunan = harita.queryRenderedFeatures(
      [[x - 24, y - 24], [x + 24, y + 24]], { layers: ['durak-halka'] });
    if (bulunan.length) durakTiklandi(bulunan[0].properties.id);
  };

  kap.addEventListener('touchstart', (o) => {
    basim = o.touches.length === 1
      ? { x: o.touches[0].clientX, y: o.touches[0].clientY, an: Date.now() }
      : null;
  }, { passive: true });

  kap.addEventListener('touchend', (o) => {
    const b = basim; basim = null;
    if (!b || o.changedTouches.length !== 1) return;
    const p = o.changedTouches[0];
    // Kaydırma ve yakınlaştırma dokunuş sayılmıyor; basılı tutma da değil.
    if (Math.hypot(p.clientX - b.x, p.clientY - b.y) > 14) return;
    if (Date.now() - b.an > 700) return;
    sonDokunma = Date.now();
    sorgula(p.clientX, p.clientY);
  }, { passive: true });

  // Fare için. Dokunuştan hemen sonra gelen sentetik tıklama iki kez
  // çalışmasın diye kısa bir pencere bırakılıyor.
  kap.addEventListener('click', (o) => {
    if (Date.now() - sonDokunma < 700) return;
    sorgula(o.clientX, o.clientY);
  });
}

export function haritaGuncelle(kayitlar, izNoktalari) {
  sonVeri = { kayitlar, iz: izNoktalari };
  // isStyleLoaded() karolar inerken false dönüyor; katman eklemek için stilin
  // yüklenmiş olması yetiyor. Sıkı davranınca kip değişince iğneler kayboluyordu.
  if (!harita || !harita.style) return;

  // İz: gün gün ayrı çizgiler, her gün kendi renginde.
  const gunler = new Map();
  for (const n of izNoktalari) {
    const g = n.gun ?? gunTahmin(n.t, kayitlar);
    if (!gunler.has(g)) gunler.set(g, []);
    const dizi = gunler.get(g);
    const son = dizi[dizi.length - 1];
    // Bir saatten uzun boşluk = kopukluk; çizgiyi oradan kes.
    if (son && n.t - son.t > 3600_000) gunler.set(`${g}_${n.t}`, [n]);
    else dizi.push(n);
  }

  const cizgiler = [];
  let i = 0;
  for (const [, noktalar] of gunler) {
    if (noktalar.length < 2) continue;
    cizgiler.push({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: noktalar.map(n => [n.lon, n.lat]) },
      properties: { renk: GUN_RENKLERI[i % GUN_RENKLERI.length] }
    });
    i++;
  }

  kaynakYaz('iz', { type: 'FeatureCollection', features: cizgiler }, [
    { id: 'iz-cizgi', type: 'line', source: 'iz',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': ['get', 'renk'], 'line-width': 3.5, 'line-opacity': 0.9 } }
  ]);

  // Anılar
  const anilar = kayitlar.filter(k => k.lat != null && k.lon != null && k.tur !== 'sinir');
  kaynakYaz('anilar', {
    type: 'FeatureCollection',
    features: anilar.map(k => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [k.lon, k.lat] },
      properties: { tur: k.tur, id: k.id }
    }))
  }, [
    { id: 'ani-nokta', type: 'circle', source: 'anilar',
      paint: {
        'circle-radius': 5,
        'circle-color': [
          'match', ['get', 'tur'],
          'ortam', '#5b9dd9',
          'ses', '#e0a458', 'gunluk', '#e0a458',
          'foto', '#f0ebe5', 'video', '#f0ebe5', 'siradan', '#f0ebe5',
          '#a09488'
        ],
        'circle-stroke-width': 1.5, 'circle-stroke-color': '#12100e'
      } }
  ]);

  // Sınır geçişleri ayrı işaretleniyor — gezinin iskeleti bunlar.
  const sinirlar = kayitlar.filter(k => k.tur === 'sinir' && k.lat != null);
  kaynakYaz('sinirlar-gecis', {
    type: 'FeatureCollection',
    features: sinirlar.map(k => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [k.lon, k.lat] },
      properties: {}
    }))
  }, [
    { id: 'sinir-nokta', type: 'circle', source: 'sinirlar-gecis',
      paint: {
        'circle-radius': 8, 'circle-color': '#7ba05b',
        'circle-stroke-width': 2, 'circle-stroke-color': '#12100e'
      } }
  ]);

  rotayiCiz();

  // Durak iğneleri her şeyin üstünde kalsın — dokunulacak olan onlar.
  for (const k of ['durak-halka', 'durak-no', 'durak-ad']) {
    if (harita.getLayer(k)) harita.moveLayer(k);
  }
}

function gunTahmin(t, kayitlar) {
  const y = kayitlar.find(k => Math.abs(k.t - t) < 3600_000);
  return y?.gun ?? 0;
}

export function konumaGit(nokta, zoom = 14) {
  if (!harita || !nokta) return;
  harita.easeTo({ center: [nokta.lon, nokta.lat], zoom, duration: 700 });
}

export function hepsiniGoster() {
  if (!harita) return;

  // Duraklar VE gerçekten gidilen iz birlikte sığsın: rotadan sapıldıysa
  // "tümünü göster" sapmayı da göstermeli.
  const noktalar = duraklar().map(d => [d.lon, d.lat]);
  for (const n of (sonVeri.iz || [])) {
    if (typeof n.lon === 'number' && typeof n.lat === 'number') noktalar.push([n.lon, n.lat]);
  }
  if (!noktalar.length) return;

  const enler = noktalar.map(n => n[0]), boylar = noktalar.map(n => n[1]);

  // Haritanın üstünde kip düğmeleri ve (harita inmediyse) uyarı kutusu duruyor;
  // sağda yuvarlak düğmeler var. Eşit boşluk verilirse ilk duraklar bu
  // kutuların ARKASINDA kalıyordu — gerçek rotayla denendi, 1–4 görünmüyordu.
  const uyari = document.getElementById('haritaUyari');
  const uyariAcik = uyari && !uyari.classList.contains('gizli');
  const kap = harita.getCanvas();
  const dar = kap.clientWidth < 420;

  harita.fitBounds(
    [[Math.min(...enler), Math.min(...boylar)], [Math.max(...enler), Math.max(...boylar)]],
    {
      padding: {
        top: uyariAcik ? 190 : 74,
        bottom: 60,                    // iğne adları iğnenin altına yazılıyor
        left: 40,
        right: dar ? 40 : 92           // sağdaki yuvarlak düğme sütunu
      },
      duration: 700
    }
  );
}

export { harita };
