// Sefer — offline harita.
//
// Harita verisi tek bir .pmtiles dosyası: 6 ülke, sokak seviyesi, ~357 MB.
// Ev wifi'sinde bir kez indirilip telefonun dosya sistemine (OPFS) yazılıyor.
// Sonrasında hiçbir ağ isteği yok — uçak modunda da aynı çalışıyor.

// maplibregl ve pmtiles index.html'den yükleniyor (global). ES modülü olarak değil,
// çünkü MapLibre v6 özel protokolleri artık çağırmıyor — pmtiles'ın çalıştığı
// sürüm v5, o da tek dosyalık klasik bir betik olarak geliyor.
/* global maplibregl, pmtiles */
import { aktifSefer, duraklar } from './sefer.js';
import * as depo from './depo.js';

// Harita paketi GitHub Release eki olarak duruyor: depoda 100 MB dosya sınırı var,
// Release'de 2 GB. Kişisel veri içermiyor (kamuya açık Protomaps verisi).
// Harita, uygulamayla AYNI adreste, parçalar halinde duruyor.
//
// Neden Release değil: GitHub'ın release dosya sunucusu CORS başlığı vermiyor,
// tarayıcı indirmeyi engelliyor (denendi, "Failed to fetch"). Aynı kökenden
// sunulunca böyle bir sorun kalmıyor.
// Neden parçalı: git'in dosya başına 100 MB sınırı var, harita 357 MB.
export const HARITA_KLASORU = 'harita';

const PMTILES_IMZASI = 'PMTiles';

let harita = null;
let kuruluyor = null;
let pmt = null;

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

  const liste = await fetch(`${HARITA_KLASORU}/parcalar.json`);
  if (!liste.ok) throw new Error(`Parça listesi alınamadı (${liste.status})`);
  const bilgi = await liste.json();

  // Yarım kalmış bir indirmenin kalıntısı karışmasın.
  await ayarYaz('haritaParcalari', null);
  for (const p of bilgi.parcalar) await depo.sil('harita', p.ad);

  let inen = 0;
  for (const parca of bilgi.parcalar) {
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

const BOS_STIL = {
  version: 8,
  sources: {},
  layers: [{ id: 'zemin', type: 'background', paint: { 'background-color': '#1c1917' } }]
};

// Protomaps verisinden sade, karanlık bir stil. Yazı tipi gömülü olmadığı için
// etiketler ikonlarla değil, harita üstündeki katmanlarla taşınıyor.
function stilUret() {
  return {
    version: 8,
    sources: {
      temel: { type: 'vector', url: 'pmtiles://harita' }
    },
    layers: [
      { id: 'zemin', type: 'background', paint: { 'background-color': '#14120f' } },
      { id: 'toprak', type: 'fill', source: 'temel', 'source-layer': 'earth',
        paint: { 'fill-color': '#1e1b17' } },
      { id: 'arazi', type: 'fill', source: 'temel', 'source-layer': 'landuse',
        paint: { 'fill-color': '#232019', 'fill-opacity': 0.6 } },
      { id: 'yesil', type: 'fill', source: 'temel', 'source-layer': 'landcover',
        paint: { 'fill-color': '#1f2a1c', 'fill-opacity': 0.55 } },
      { id: 'su', type: 'fill', source: 'temel', 'source-layer': 'water',
        paint: { 'fill-color': '#16283a' } },
      { id: 'yapilar', type: 'fill', source: 'temel', 'source-layer': 'buildings',
        minzoom: 13, paint: { 'fill-color': '#2a2622', 'fill-opacity': 0.75 } },
      { id: 'yollar-kucuk', type: 'line', source: 'temel', 'source-layer': 'roads',
        filter: ['!=', ['get', 'kind'], 'highway'], minzoom: 11,
        paint: { 'line-color': '#332e28', 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.5, 16, 3] } },
      { id: 'yollar-ana', type: 'line', source: 'temel', 'source-layer': 'roads',
        filter: ['==', ['get', 'kind'], 'highway'],
        paint: { 'line-color': '#4a4038', 'line-width': ['interpolate', ['linear'], ['zoom'], 6, 0.6, 16, 5] } },
      { id: 'sinirlar', type: 'line', source: 'temel', 'source-layer': 'boundaries',
        paint: { 'line-color': '#5a4a3a', 'line-width': 1, 'line-dasharray': [3, 2] } }
    ]
  };
}

export async function haritaKur() {
  if (harita) return harita;
  if (kuruluyor) return kuruluyor;

  kuruluyor = (async () => {
    const kap = document.getElementById('harita');
    const uyari = document.getElementById('haritaUyari');
    const boyut = await haritaVarMi();

    harita = new maplibregl.Map({
      container: kap,
      style: BOS_STIL,
      center: [20.5, 42.6],
      zoom: 6,
      attributionControl: false,
      maxPitch: 0
    });

    await new Promise(t => harita.on('load', t));

    if (boyut) {
      try {
        const dosya = await haritaBlobu();
        if (!dosya) throw new Error('harita parçaları okunamadı');
        pmt = new pmtiles.PMTiles(new BlobKaynak(dosya, 'sefer-harita'));

        // pmtiles:// isteklerini dosyadan karşıla. Ağ hiç devreye girmiyor.
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

        harita.setStyle(stilUret());
        await new Promise(t => harita.once('styledata', t));
        uyari?.classList.add('gizli');
      } catch (hata) {
        console.warn('harita dosyası açılamadı', hata);
        uyari.textContent = 'Harita dosyası okunamadı. Sefer sekmesinden yeniden indir.';
        uyari.classList.remove('gizli');
      }
    } else {
      uyari.innerHTML = 'Offline harita henüz indirilmedi.<br>' +
        '<b>Sefer</b> sekmesinden, <b>ev wifi\'sindeyken</b> indir — yolda internet olmayacak.';
      uyari.classList.remove('gizli');
    }

    rotayiCiz();
    return harita;
  })();

  return kuruluyor;
}

export function haritaBoyutTazele() {
  setTimeout(() => harita?.resize(), 60);
}

// ---- Katmanlar ------------------------------------------------------------

const GUN_RENKLERI = ['#e0a458', '#d9634f', '#7ba05b', '#5b9dd9', '#b48ec4', '#d4a24c', '#6ec0b0', '#c47e5a'];

function kaynakYaz(ad, veri, katmanlar) {
  if (!harita) return;
  if (harita.getSource(ad)) {
    harita.getSource(ad).setData(veri);
  } else {
    harita.addSource(ad, { type: 'geojson', data: veri });
    for (const k of katmanlar) harita.addLayer(k);
  }
}

// Planlanan duraklar — harita açılır açılmaz görünsün, iz olmasa bile.
function rotayiCiz() {
  const liste = duraklar();
  if (!liste.length || !harita) return;

  kaynakYaz('duraklar', {
    type: 'FeatureCollection',
    features: liste.map(d => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [d.lon, d.lat] },
      properties: { ad: d.ad, gun: d.gun }
    }))
  }, [
    { id: 'durak-halka', type: 'circle', source: 'duraklar',
      paint: {
        'circle-radius': 7, 'circle-color': 'transparent',
        'circle-stroke-width': 2, 'circle-stroke-color': '#e0a458', 'circle-stroke-opacity': 0.85
      } }
  ]);
}

export function haritaGuncelle(kayitlar, izNoktalari) {
  if (!harita || !harita.isStyleLoaded()) return;

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
}

function gunTahmin(t, kayitlar) {
  const y = kayitlar.find(k => Math.abs(k.t - t) < 3600_000);
  return y?.gun ?? 0;
}

export function konumaGit(nokta) {
  if (!harita || !nokta) return;
  harita.easeTo({ center: [nokta.lon, nokta.lat], zoom: 14, duration: 700 });
}

export function hepsiniGoster() {
  if (!harita) return;
  const liste = duraklar();
  if (!liste.length) return;
  const enler = liste.map(d => d.lon), boylar = liste.map(d => d.lat);
  harita.fitBounds(
    [[Math.min(...enler), Math.min(...boylar)], [Math.max(...enler), Math.max(...boylar)]],
    { padding: 50, duration: 700 }
  );
}

export { harita };
