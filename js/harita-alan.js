// Gerok — haritanın YALNIZCA gereken parçasını indirmek.
//
// NEDEN VAR: harita 375 MB ve tek parça. Üç güne Ohrid'e giden birinin
// altı ülkenin tamamını indirmesi gerekiyordu. Çoğu kişi indirmiyor,
// indirenin de telefonu doluyor.
//
// NASIL ÇALIŞIYOR: .pmtiles biçimi bayt aralığı okumaya göre tasarlanmış —
// dosyanın herhangi bir yerinden birkaç kilobayt istenebiliyor. GitHub'ın
// ham dosya sunucusu bunu destekliyor (206 + `access-control-allow-origin: *`,
// ölçüldü) ve basit `bytes=a-b` başlığı CORS ön-uçuşu gerektirmiyor.
//
// Yani uygulama 375 MB'lık dosyanın içinden yalnızca istenen alanın
// karolarını çekip cihaza yazabiliyor.
//
// İKİ KAZANÇ:
//   1. İnternet varken harita hiç indirilmeden çalışıyor.
//   2. Çevrimdışı için yalnızca seçilen alan iniyor.

/* global pmtiles */
import * as depo from './depo.js';
import * as veri from './veri.js';

const BOLGE_LISTESI = './bolgeler.json';
const KARO_KLASOR = 'karo';
const EN_FAZLA_KARO = 20000;      // Bunun üstü hem çok yavaş hem çok istek.
const ORNEK_KARO = 20;            // Boyut tahmini için okunacak karo sayısı.

// ---- Uzaktaki dosyayı tek bir dosya gibi göstermek -------------------------

/**
 * Beş ayrı parçayı tek bir mantıksal dosya gibi okutan kaynak.
 *
 * Parçalar var çünkü git dosya başına 100 MB sınırı koyuyor. İstenen bayt
 * aralığı iki parçaya taşabiliyor; o durumda ikisinden de istenip birleşiyor.
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

  async getBytes(konum, uzunluk) {
    const son = Math.min(konum + uzunluk, this.toplam);
    const dilimler = [];
    for (let i = 0; i < this.parcalar.length; i++) {
      const bas = this.baslangiclar[i];
      const bit = bas + this.parcalar[i].boyut;
      if (bit <= konum || bas >= son) continue;          // bu parça aralık dışı
      const a = Math.max(konum, bas) - bas;
      const b = Math.min(son, bit) - bas - 1;
      const yanit = await fetch(`${this.kok}/${this.parcalar[i].ad}`,
        { headers: { Range: `bytes=${a}-${b}` } });
      if (!yanit.ok) throw new Error(`aralık alınamadı (${yanit.status})`);
      dilimler.push(new Uint8Array(await yanit.arrayBuffer()));
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
export async function bolgeler() {
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
}

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
 * Bu karo hangi bölgeden okunacak?
 *
 * Alt yakınlıklarda (z0-5) bir karo bütün Avrupa'yı kaplıyor ve hiçbir
 * bölge kutusunun içine tam düşmüyor. O yüzden merkez eşleşmezse ilk
 * bölgeye düşüyoruz: uzaklaşınca boş ekran görmektense bir bölgenin
 * genel görünümünü göstermek doğru.
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
  let toplam = 0, okunan = 0, dolu = 0;
  for (let i = 0; i < ORNEK_KARO; i++) {
    const sira = Math.floor(i * adim);
    if (sira >= havuz.length) break;
    const k = havuz[sira];
    try {
      const kaynak = await karoKaynagi(k.z, k.x, k.y);
      if (!kaynak) continue;
      const karo = await kaynak.getZxy(k.z, k.x, k.y);
      okunan++;
      if (karo) { toplam += karo.data.byteLength; dolu++; }
    } catch { /* tek karo okunamadıysa örneklem yeter */ }
  }
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
  let yazilan = 0, bayt = 0, atlanan = 0;

  for (let i = 0; i < hepsi.length; i++) {
    const k = hepsi[i];
    const ad = karoAdi(k.z, k.x, k.y);
    if (mevcut.has(ad)) { atlanan++; ilerleme?.(i + 1, hepsi.length, bayt); continue; }
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
    ilerleme?.(i + 1, hepsi.length, bayt);
  }

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
  for (const ad of await depo.listele(KARO_KLASOR)) await depo.sil(KARO_KLASOR, ad);
  await veri.ayarYaz('haritaAlanlari', []);
}

// ---- Kapsam dışı istekleri ------------------------------------------------

/**
 * Seçilen kutunun tamamı yayınlanan bölgelerden biri tarafından kapsanıyor mu?
 *
 * Dört köşe de bakılıyor. Tek bir birleşik dikdörtgen kullanmıyoruz:
 * Balkanlar ile İstanbul'u tek kutuya sokmak, aradaki Ege'yi de
 * "kapsanıyor" saymak olurdu ve kişi boş harita indirirdi.
 */
export async function kapsamIcinde(kutu) {
  const hepsi = await bolgeler();
  if (!hepsi.length) return true;      // liste yoksa engelleme
  const koseler = [
    [kutu.guney, kutu.bati], [kutu.guney, kutu.dogu],
    [kutu.kuzey, kutu.bati], [kutu.kuzey, kutu.dogu],
  ];
  return koseler.every(([lat, lon]) => hepsi.some(b => noktaIcinde(b, lat, lon)));
}

/** Bölge adları — "hangi yerler var" diye soran ekran için. */
export async function bolgeAdlari() {
  return (await bolgeler()).map(b => b.ad);
}
