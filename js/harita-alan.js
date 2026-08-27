// Gerok — haritanın YALNIZCA gereken parçasını indirmek.
//
// NEDEN VAR: bütün bir bölgeyi indirmek 375 MB tutuyordu. Üç güne Ohrid'e
// giden birinin altı ülkenin tamamını indirmesi gerekiyordu. Çoğu kişi
// indirmiyor, indirenin de telefonu doluyor.
//
// NASIL ÇALIŞIYOR: .pmtiles biçimi bayt aralığı okumaya göre tasarlanmış —
// dosyanın herhangi bir yerinden birkaç kilobayt istenebiliyor. Kaynak,
// Protomaps'in OpenStreetMap'ten üretilmiş 134 GB'lık GEZEGEN dosyası
// (data.source.coop). O sunucu hem `Range` isteğini hem de CORS'u açık
// tutuyor (206 + `access-control-allow-origin: *`, ölçüldü), yani tarayıcı
// dosyanın içinden istediği karoyu doğrudan çekebiliyor.
//
// BUNUN ANLAMI: önceden harita önce benim tarafımdan "bölge" olarak
// kesilip yayınlanmak zorundaydı; yayınlanmamış bir yere giden kişi
// "bu bölgeyi iste" diyip beklemek zorunda kalıyordu. Artık öyle bir kapı
// yok — dünyanın her yeri, kimseyi beklemeden, basınca iniyor.
//
// İKİ KAZANÇ:
//   1. İnternet varken harita hiç indirilmeden her yerde çalışıyor.
//   2. Çevrimdışı için yalnızca seçilen alan iniyor.

/* global pmtiles */
import * as depo from './depo.js';
import * as veri from './veri.js';

const BOLGE_LISTESI = './bolgeler.json';
const KARO_KLASOR = 'karo';
const EN_FAZLA_KARO = 20000;      // Bunun üstü hem çok yavaş hem çok istek.
const ORNEK_KARO = 20;            // Boyut tahmini için okunacak karo sayısı.
const ES_ZAMANLI = 16;            // Aynı anda kaç karo isteği açık olacak.
const ZAMAN_ASIMI = 20000;        // Tek bir aralık isteği bu kadar bekletebilir.

/**
 * Listeyi ES_ZAMANLI işçiyle geçer.
 *
 * Karoları teker teker istemek işe yaramıyordu: her isteğin kendi gidiş
 * dönüşü var ve o süre boyunca hiçbir şey olmuyor. Ölçtük — sırayla 6 istek
 * 7,4 saniye, aynı anda 24 istek 1,2 saniye. Yani bekleme ağın hızından
 * değil, sıra beklemekten geliyordu. Sekiz işçi tarayıcının aynı sunucuya
 * açtığı bağlantı sayısına yakın; daha fazlası hız katmıyor, sunucuyu
 * gereksiz zorluyor.
 */
async function hepsineUygula(liste, isci) {
  let sonraki = 0;
  const calisanlar = Array.from(
    { length: Math.min(ES_ZAMANLI, liste.length) },
    async () => {
      while (true) {
        const i = sonraki++;
        if (i >= liste.length) return;
        await isci(liste[i], i);
      }
    });
  await Promise.all(calisanlar);
}

// ---- Uzaktaki dosyayı tek bir dosya gibi göstermek -------------------------

/**
 * Uzaktaki dosyayı bayt aralığıyla okuyan kaynak.
 *
 * Gezegen dosyası tek parça, ama sınıf çok parçayı da okuyabiliyor: kaynak
 * bir gün GitHub gibi dosya başına sınırı olan bir yere taşınırsa parçalara
 * bölmek gerekir. İstenen aralık iki parçaya taşarsa ikisinden de istenip
 * birleşiyor.
 */
export class UzakKaynak {
  constructor(kok, parcalar) {
    this.kok = kok;
    this.parcalar = parcalar;
    let t = 0;
    this.baslangiclar = parcalar.map(p => { const b = t; t += p.boyut; return b; });
    this.toplam = t;
  }

  getKey() { return this.kok; }

  /**
   * Dosyanın bir aralığını getirir.
   *
   * ZAMAN AŞIMI: zamansız hâlinde takılan TEK bir istek bütün indirmeyi
   * sonsuza kadar donduruyordu — ilerleme duruyor, hata çıkmıyor, iptal de
   * edilemiyor. Yolda, otel wifi'sinde olacak şey tam olarak bu. Saat
   * gövde okunana kadar işliyor: yalnızca başlıkları saymak yetmez,
   * bağlantı veri ortasında da ölebiliyor.
   *
   * cache: 'no-store' BURADA HAYATİ. Bütün karolar aynı URL'den, yalnızca
   * bayt aralığı değişerek isteniyor. Chrome aynı URL'ye giden eş zamanlı
   * istekleri kendi HTTP önbelleği üzerinden SIRAYA sokuyor (önbellek
   * kilidi), yani on altı işçi açsak da teker teker iniyordu. Ölçtük:
   * önbellek açıkken saniyede 1,7 istek, no-store ile 18,7 — on bir kat.
   * Kaybımız yok: dizinleri pmtiles zaten bellekte tutuyor, inen karolar
   * da IndexedDB'ye yazılıyor.
   */
  async araligiIste(ad, a, b, deneme = 0) {
    const kesici = new AbortController();
    const saat = setTimeout(() => kesici.abort(), ZAMAN_ASIMI);
    try {
      const yanit = await fetch(`${this.kok}/${ad}`, {
        headers: { Range: `bytes=${a}-${b}` },
        cache: 'no-store',
        signal: kesici.signal,
      });
      if (!yanit.ok) throw new Error(`aralık alınamadı (${yanit.status})`);
      return new Uint8Array(await yanit.arrayBuffer());
    } catch (hata) {
      // Bir kez daha deneniyor. Takılan istek çoğu zaman ikincide düzeliyor;
      // internet gerçekten yoksa ikinci deneme de hızlıca düşüyor.
      if (deneme === 0 && navigator.onLine) return this.araligiIste(ad, a, b, 1);
      throw hata;
    } finally {
      clearTimeout(saat);
    }
  }

  async getBytes(konum, uzunluk) {
    const son = Math.min(konum + uzunluk, this.toplam);
    const dilimler = [];
    for (let i = 0; i < this.parcalar.length; i++) {
      const bas = this.baslangiclar[i];
      const bit = bas + this.parcalar[i].boyut;
      if (bit <= konum || bas >= son) continue;          // bu parça aralık dışı
      const a = Math.max(konum, bas) - bas;
      const b = Math.min(son, bit) - bas - 1;
      dilimler.push(await this.araligiIste(this.parcalar[i].ad, a, b));
    }
    if (dilimler.length === 1) return { data: dilimler[0].buffer };
    const toplamBoyut = dilimler.reduce((t, d) => t + d.length, 0);
    const birlesik = new Uint8Array(toplamBoyut);
    let y = 0;
    for (const d of dilimler) { birlesik.set(d, y); y += d.length; }
    return { data: birlesik.buffer };
  }
}

const acikBolgeler = new Map();       // kisa -> PMTiles

/**
 * Yayınlanan bölgelerin listesi.
 *
 * Uygulamayla birlikte geliyor, yani çevrimdışı da okunabiliyor: "burası
 * haritada var mı" sorusuna internet olmadan da cevap verilebilmeli.
 */
let listeSozu = null;                 // oturum boyunca tek okuma

export async function bolgeler() {
  // Bir kez okunup saklanıyor. Saklanmadığı sürüm şunu yapıyordu: her karo
  // için karoKaynagi -> bolgeBul -> bolgeler() zinciri işliyor ve her karoda
  // bolgeler.json AĞDAN yeniden isteniyordu. 3000 karoluk bir alanda bu,
  // indirmenin yanına 3000 gereksiz istek koyuyordu.
  if (listeSozu) return listeSozu;
  listeSozu = (async () => {
    const kayitli = await veri.ayarOku('haritaBolgeleri', null);
    try {
      const y = await fetch(BOLGE_LISTESI, { cache: 'no-cache' });
      if (y.ok) {
        const d = await y.json();
        await veri.ayarYaz('haritaBolgeleri', d.bolgeler);
        return d.bolgeler;
      }
    } catch { /* çevrimdışı: kayıtlıyla devam */ }
    return kayitli || [];
  })();
  return listeSozu;
}

/** Sınama içindir: listeyi yeniden okutur. */
export function listeyiUnut() { listeSozu = null; acikBolgeler.clear(); }

const noktaIcinde = (b, lat, lon) =>
  lon >= b.kutu.bati && lon <= b.kutu.dogu && lat >= b.kutu.guney && lat <= b.kutu.kuzey;

/** Bu noktayı hangi bölge kapsıyor? Kapsamıyorsa null. */
export async function bolgeBul(lat, lon) {
  const hepsi = await bolgeler();
  return hepsi.find(b => noktaIcinde(b, lat, lon)) || null;
}

/**
 * Bir bölgenin uzaktaki dosyasını açar. Ağ yoksa null.
 * Açılan bölgeler saklanıyor: her karo için başlık yeniden okunmasın.
 */
export async function uzakHarita(bolge = null) {
  const b = bolge || (await bolgeler())[0];
  if (!b) return null;
  if (acikBolgeler.has(b.kisa)) return acikBolgeler.get(b.kisa);
  if (!navigator.onLine) return null;
  try {
    const pmt = new pmtiles.PMTiles(new UzakKaynak(b.kok, b.parcalar));
    acikBolgeler.set(b.kisa, pmt);
    return pmt;
  } catch { return null; }
}

// ---- Karo hesabı ----------------------------------------------------------

const xBul = (lon, z) => Math.floor((lon + 180) / 360 * 2 ** z);
const yBul = (lat, z) => {
  const r = lat * Math.PI / 180;
  return Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * 2 ** z);
};

/**
 * Bir kutuyu kaplayan karoların listesi.
 *
 * Alt yakınlıklar da dahil: yalnızca en yakın seviye inseydi uzaklaşınca
 * harita boşalırdı. Alt seviyeler zaten az sayıda karo.
 */
export function karolar(kutu, enFazlaZ, enAzZ = 0) {
  const liste = [];
  for (let z = enAzZ; z <= enFazlaZ; z++) {
    const x1 = xBul(kutu.bati, z), x2 = xBul(kutu.dogu, z);
    const y1 = yBul(kutu.kuzey, z), y2 = yBul(kutu.guney, z);
    for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++)
      for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++)
        liste.push({ z, x, y });
  }
  return liste;
}

const karoAdi = (z, x, y) => `${z}-${x}-${y}`;

/** Bir karonun ortası — hangi bölgeye ait olduğunu bulmak için. */
export function karoMerkezi(z, x, y) {
  const n = 2 ** z;
  const lon = (x + 0.5) / n * 360 - 180;
  const m = Math.PI - 2 * Math.PI * (y + 0.5) / n;
  const lat = 180 / Math.PI * Math.atan(0.5 * (Math.exp(m) - Math.exp(-m)));
  return [lat, lon];
}

/**
 * Bu karo hangi kaynaktan okunacak?
 *
 * Şu an tek kaynak var ve dünyayı kapsıyor, yani her karo eşleşiyor.
 * Arama yine de duruyor: ileride ikinci bir kaynak eklenirse (asıl kaynak
 * kapanırsa ya da bir bölge için daha ayrıntılı dosya konursa) doğru
 * yere yönlendirmesi gereken yer burası. Eşleşme çıkmazsa ilk kaynağa
 * düşüyor — boş ekran göstermektense bir şey göstermek doğru.
 */
export async function karoKaynagi(z, x, y) {
  const [lat, lon] = karoMerkezi(z, x, y);
  const b = await bolgeBul(lat, lon);
  return uzakHarita(b);
}

// ---- Tahmin ---------------------------------------------------------------

/**
 * "Ne kadar yer kaplayacak?" sorusunun cevabı.
 *
 * Kesin sayı vermek için bütün karoları okumak gerekirdi — o zaten indirmenin
 * kendisi olurdu. Onun yerine dağınık birkaç karo okunup ortalaması alınıyor.
 * Sonuç ekranda "≈" ile yazılıyor; kesinmiş gibi gösterilmiyor.
 */
export async function alanTahmini(kutu, enFazlaZ) {
  const hepsi = karolar(kutu, enFazlaZ);
  if (hepsi.length > EN_FAZLA_KARO)
    return { karo: hepsi.length, cokBuyuk: true, sinir: EN_FAZLA_KARO };

  if (!navigator.onLine) return { karo: hepsi.length, agYok: true };

  // Örnekler BÜTÜN listeye yayılıyor. Önce yalnızca en yakın seviyeden ve
  // baştan sırayla alıyordu; liste x'e göre sıralı olduğu için örnekler
  // kutunun batı kenarına yığılıyor, alt yakınlıkların büyük karoları ise
  // hiç sayılmıyordu. Ölçtük: 5,3 MB'lık bir alana 1,9 MB dedi.
  // Kesirli adımla ilerlemek hem kutunun her yerine hem her yakınlığa değiyor.
  const havuz = hepsi;
  const adim = havuz.length / Math.min(ORNEK_KARO, havuz.length);
  const ornekler = [];
  for (let i = 0; i < ORNEK_KARO; i++) {
    const sira = Math.floor(i * adim);
    if (sira >= havuz.length) break;
    ornekler.push(havuz[sira]);
  }
  let toplam = 0, okunan = 0, dolu = 0;
  await hepsineUygula(ornekler, async (k) => {
    try {
      const kaynak = await karoKaynagi(k.z, k.x, k.y);
      if (!kaynak) return;
      const karo = await kaynak.getZxy(k.z, k.x, k.y);
      okunan++;
      if (karo) { toplam += karo.data.byteLength; dolu++; }
    } catch { /* tek karo okunamadıysa örneklem yeter */ }
  });
  if (!okunan) return { karo: hepsi.length, agYok: true };

  // Boş karolar da sayılıyor: deniz ya da kapsam dışı alan yer kaplamıyor
  // ve bunu tahmine katmamak boyutu olduğundan büyük gösterirdi.
  const ortalama = toplam / okunan;
  return {
    karo: hepsi.length,
    doluOran: dolu / okunan,
    bayt: Math.round(ortalama * hepsi.length),
  };
}

// ---- İndirme --------------------------------------------------------------

/**
 * Seçilen alanı cihaza indirir.
 *
 * Zaten inmiş karolar atlanıyor: alan büyütülünce baştan indirilmiyor,
 * yalnızca eksik kalanlar iniyor.
 */
export async function alanIndir(kutu, enFazlaZ, ilerleme) {
  if (!navigator.onLine)
    throw new Error('İnternet yok — harita alanı internetliyken indirilir.');

  const hepsi = karolar(kutu, enFazlaZ);
  if (hepsi.length > EN_FAZLA_KARO)
    throw new Error(`Alan çok büyük (${hepsi.length} karo). Daha küçük bir alan seç.`);

  const mevcut = new Set(await depo.listele(KARO_KLASOR));
  let yazilan = 0, bayt = 0, atlanan = 0, biten = 0;

  await hepsineUygula(hepsi, async (k) => {
    const ad = karoAdi(k.z, k.x, k.y);
    if (mevcut.has(ad)) {
      atlanan++;
    } else {
      try {
        const kaynak = await karoKaynagi(k.z, k.x, k.y);
        const karo = kaynak ? await kaynak.getZxy(k.z, k.x, k.y) : null;
        // Boş karo da yazılıyor: yoksa her açılışta yeniden sorulur ve
        // çevrimdışıyken "eksik" sanılır. Sıfır baytlık dosya yer kaplamıyor.
        const veriKarosu = karo ? new Uint8Array(karo.data) : new Uint8Array();
        await depo.yaz(KARO_KLASOR, ad, new Blob([veriKarosu]));
        yazilan++; bayt += veriKarosu.length;
      } catch {
        // Tek bir karo inmezse indirme durmuyor: 3000 karonun 2'si eksik
        // olsa harita hâlâ kullanılır, durdurmak ise her şeyi çöpe atardı.
      }
    }
    ilerleme?.(++biten, hepsi.length, bayt);
  });

  const alanlar = await veri.ayarOku('haritaAlanlari', []);
  alanlar.push({ kutu, enFazlaZ, karo: hepsi.length, bayt, an: Date.now() });
  await veri.ayarYaz('haritaAlanlari', alanlar);

  return { yazilan, atlanan, bayt, karo: hepsi.length };
}

export async function inenAlanlar() {
  return veri.ayarOku('haritaAlanlari', []);
}

/** Cihazdaki karo sayısı ve toplam boyutu. */
export async function yerelKaroDurumu() {
  const adlar = await depo.listele(KARO_KLASOR);
  const alanlar = await veri.ayarOku('haritaAlanlari', []);
  return { karo: adlar.length, bayt: alanlar.reduce((t, a) => t + (a.bayt || 0), 0) };
}

export async function yerelKaro(z, x, y) {
  const b = await depo.oku(KARO_KLASOR, karoAdi(z, x, y));
  return b ? new Uint8Array(await b.arrayBuffer()) : null;
}

export async function alanlariSil() {
  let bayt = 0;
  for (const ad of await depo.listele(KARO_KLASOR)) {
    bayt += await depo.boyut(KARO_KLASOR, ad);
    await depo.sil(KARO_KLASOR, ad);
  }
  await veri.ayarYaz('haritaAlanlari', []);
  return bayt;
}

/**
 * TEK bir alanı siler.
 *
 * Dikkat edilen şey: iki alan üst üste binmiş olabilir (Üsküp indirilir,
 * sonra çevresi de indirilir). Ortak karoları körü körüne silmek, duran
 * alanı da delik deşik ederdi. O yüzden önce KALAN alanların karoları
 * çıkarılıyor, yalnızca hiçbirine ait olmayanlar siliniyor.
 */
export async function alanSil(sira) {
  const alanlar = await veri.ayarOku('haritaAlanlari', []);
  if (sira < 0 || sira >= alanlar.length) return 0;

  const kalanlar = alanlar.filter((_, i) => i !== sira);
  const korunacak = new Set();
  for (const a of kalanlar)
    for (const k of karolar(a.kutu, a.enFazlaZ)) korunacak.add(karoAdi(k.z, k.x, k.y));

  let bayt = 0;
  for (const k of karolar(alanlar[sira].kutu, alanlar[sira].enFazlaZ)) {
    const ad = karoAdi(k.z, k.x, k.y);
    if (korunacak.has(ad)) continue;
    bayt += await depo.boyut(KARO_KLASOR, ad);
    await depo.sil(KARO_KLASOR, ad);
  }
  await veri.ayarYaz('haritaAlanlari', kalanlar);
  return bayt;
}
