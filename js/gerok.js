// Gerok — gerok paketi: rota, günler, duraklar, sınır geçişleri.
// Paket uygulamanın içine gömülü DEĞİL; ayrı bir dosya olarak yükleniyor.
// Böylece rota, otel adı, koordinat gibi hiçbir bilgi yayınlanan koda girmiyor.

import { gerokYaz, gerokOku, geroklar, ayarYaz, ayarOku, yeniKimlik } from './veri.js';
import { mesafe } from './iz.js';

let aktif = null;

// Kullanıcının kendi eklediği duraklar. Gerok paketinden GELMEZ — bu yüzden
// paket yeniden yüklense de durmaya devam ederler. Başka bir turdaki biri
// paketi olmadan da uygulamayı kullanabilsin diye var.
let ozel = [];

// Elle değiştirilmiş rota sırası: durak kimliği → o gün içindeki sıra.
let siraDuzeni = {};

export function aktifGerok() { return aktif; }

export async function baslat() {
  const id = await ayarOku('aktifGerokId');
  if (id) aktif = await gerokOku(id);
  if (!aktif) {
    const hepsi = await geroklar();
    if (hepsi.length) {
      aktif = hepsi[0];
      await ayarYaz('aktifGerokId', aktif.id);
    }
  }
  ozel = await ayarOku('ozelDuraklar', []);
  siraDuzeni = await ayarOku('durakSirasi', {});
  return aktif;
}

export async function paketYukle(metin) {
  let paket;
  try {
    paket = typeof metin === 'string' ? JSON.parse(metin) : metin;
  } catch {
    throw new Error('Dosya okunamadı — geçerli bir Gerok paketi değil.');
  }
  if (!paket.gerok?.id || !Array.isArray(paket.gunler)) {
    throw new Error('Bu dosya bir Gerok paketine benzemiyor.');
  }

  const kayit = {
    id: paket.gerok.id,
    ...paket.gerok,
    gunler: paket.gunler,
    duraklar: paket.duraklar || [],
    sinirGecisleri: paket.sinirGecisleri || [],
    yuklenme: Date.now()
  };

  await gerokYaz(kayit);
  await ayarYaz('aktifGerokId', kayit.id);
  aktif = kayit;
  return kayit;
}

// ---- Gün mantığı ----------------------------------------------------------
// Gezi günleri gece yarısında değil, programın kendi pencerelerinde değişiyor.
// 2. gün saat 00:55'te uçaktan inerek başlıyor — takvim günü mantığı bunu bölerdi.

export function gunBul(zaman, gerok = aktif) {
  if (!gerok?.gunler) return null;
  for (const g of gerok.gunler) {
    const [bas, bit] = g.pencere.map(s => new Date(s).getTime());
    if (zaman >= bas && zaman <= bit) return g;
  }
  return null;
}

export function gunNo(zaman, gerok = aktif) {
  return gunBul(zaman, gerok)?.no ?? null;
}

export function bugununGunu(gerok = aktif) {
  return gunBul(Date.now(), gerok);
}

export function gerokBasladiMi(gerok = aktif) {
  if (!gerok) return false;
  return Date.now() >= new Date(gerok.baslangic).getTime();
}

export function gerokBittiMi(gerok = aktif) {
  if (!gerok) return false;
  return Date.now() > new Date(gerok.bitis).getTime();
}

// ---- Duraklar -------------------------------------------------------------
//
// İki kaynaktan geliyorlar: gerok paketi ("paket") ve kullanıcının haritaya
// kendi koydukları ("kendi"). Harita rotayı bu sıraya göre çiziyor, o yüzden
// listenin sırası burada bir kez belirleniyor ve her yerde aynı kalıyor.
//
// Sıra: önce gün, sonra `sira`. Paket durağının sırası paketteki yeri;
// kendi eklediklerimiz 1000'den başlıyor, yani ait olduğu günün sonuna
// ekleniyorlar. Elle taşındıklarında `siraDuzeni` devreye giriyor.

const GUN_SONSUZ = 999;                 // günü olmayan duraklar en sona

function sirala(a, b) {
  const ag = a.gun ?? GUN_SONSUZ, bg = b.gun ?? GUN_SONSUZ;
  if (ag !== bg) return ag - bg;
  const as = a.sira ?? 0, bs = b.sira ?? 0;
  if (as !== bs) return as - bs;
  return (a.eklenme || 0) - (b.eklenme || 0);
}

export function duraklar(gerok = aktif) {
  const paket = (gerok?.duraklar || []).map((d, i) => ({ ...d, kaynak: 'paket', sira: i }));
  const kendi = ozel.filter(d => !d.silindi).map(d => ({ ...d, kaynak: 'kendi' }));
  const hepsi = [...paket, ...kendi];
  for (const d of hepsi) if (siraDuzeni[d.id] != null) d.sira = siraDuzeni[d.id];
  return hepsi.sort(sirala);
}

export function gununDuraklari(gun, gerok = aktif) {
  return duraklar(gerok).filter(d => d.gun === gun);
}

export function durakBul(id, gerok = aktif) {
  return duraklar(gerok).find(d => d.id === id) || null;
}

// Haritada seçilen noktaya durak koyar.
export async function durakEkle({ ad, lat, lon, gun = null, unutma = [] }) {
  const durak = {
    id: yeniKimlik('d'),
    ad: String(ad || '').trim() || 'Adsız durak',
    lat, lon,
    gun: gun ?? bugununGunu()?.no ?? null,
    unutma: unutma.filter(Boolean),
    sira: 1000 + ozel.length,
    eklenme: Date.now(),
    guncelleme: Date.now()
  };
  ozel = [...ozel, durak];
  await ayarYaz('ozelDuraklar', ozel);
  return durak;
}

// Yalnızca kendi eklediklerimiz silinebiliyor: paket durağı gezinin programı,
// silmek yerine "kaçırdık" işaretlenir.
export async function durakYokEt(id) {
  const d = ozel.find(x => x.id === id);
  if (!d) return false;
  d.silindi = true;
  d.guncelleme = Date.now();
  await ayarYaz('ozelDuraklar', ozel);
  return true;
}

export async function durakDuzenle(id, { ad, gun, unutma }) {
  const d = ozel.find(x => x.id === id);
  if (!d) return false;
  if (ad != null) d.ad = String(ad).trim() || d.ad;
  if (gun !== undefined) d.gun = gun;
  if (unutma) d.unutma = unutma.filter(Boolean);
  d.guncelleme = Date.now();
  await ayarYaz('ozelDuraklar', ozel);
  return true;
}

// Rota sırasını bir basamak yukarı (-1) ya da aşağı (+1) taşır.
// Gün sınırı aşılmıyor: rota günlere göre kurulu.
export async function durakTasi(id, yon) {
  const hepsi = duraklar();
  const kendisi = hepsi.find(d => d.id === id);
  if (!kendisi) return false;

  const gun = kendisi.gun ?? GUN_SONSUZ;
  const ayniGun = hepsi.filter(d => (d.gun ?? GUN_SONSUZ) === gun);
  const yerel = ayniGun.findIndex(d => d.id === id);
  const hedef = yerel + yon;
  if (hedef < 0 || hedef >= ayniGun.length) return false;

  const [tasinan] = ayniGun.splice(yerel, 1);
  ayniGun.splice(hedef, 0, tasinan);
  ayniGun.forEach((d, n) => { siraDuzeni[d.id] = n; });

  await ayarYaz('durakSirasi', { ...siraDuzeni });
  return true;
}

// ---- Durakların eşitlenmesi ----------------------------------------------
// Kendi eklediğimiz duraklar akşam paketiyle karşı tarafa da geçiyor.

export function ozelDurakListesi() { return ozel; }
export function siraDuzeniAl() { return siraDuzeni; }

export async function ozelDuraklariBirlestir(gelenler = [], gelenSira = null) {
  const eldeki = new Map(ozel.map(d => [d.id, d]));
  let yeni = 0;

  for (const gelen of gelenler) {
    if (!gelen?.id) continue;
    // Kopyası alınıyor: gelen paketin nesnesini doğrudan tutarsak sonraki
    // düzenlemelerimiz o paketi de değiştirir.
    const g = { ...gelen };
    const b = eldeki.get(g.id);
    if (!b) { eldeki.set(g.id, g); if (!g.silindi) yeni++; }
    else if ((g.guncelleme || 0) > (b.guncelleme || 0)) eldeki.set(g.id, g);
  }

  ozel = Array.from(eldeki.values());
  await ayarYaz('ozelDuraklar', ozel);

  // Sırada bizim düzenimiz kazanıyor — karşı taraf yalnızca bizde hiç
  // olmayan durakların sırasını getirebilir.
  if (gelenSira) {
    siraDuzeni = { ...gelenSira, ...siraDuzeni };
    await ayarYaz('durakSirasi', siraDuzeni);
  }
  return yeni;
}

// Verilen konuma yakın duraklar, yakından uzağa.
export function yakinDuraklar(lat, lon, enFazlaMetre = 30000, gerok = aktif) {
  return duraklar(gerok)
    .map(d => ({ durak: d, uzaklik: mesafe(lat, lon, d.lat, d.lon) }))
    .filter(x => x.uzaklik <= enFazlaMetre)
    .sort((a, b) => a.uzaklik - b.uzaklik);
}

// ---- Ülke tespiti ---------------------------------------------------------
// Sınır geçişlerini kendiliğinden işaretlemek için hangi ülkede olduğumuzu
// bilmemiz gerekiyor. Tam sınır poligonu yerine, gezilen altı ülkenin kaba
// sınır kutuları + duraklara yakınlık yeterli: rota zaten bu ülkelerden geçiyor
// ve geçişler birbirinden yüzlerce km uzakta.

const ULKE_KUTULARI = [
  { kod: 'RS', ad: 'Sırbistan',       bayrak: '🇷🇸', kutu: [18.8, 42.2, 23.0, 46.2] },
  { kod: 'BA', ad: 'Bosna-Hersek',    bayrak: '🇧🇦', kutu: [15.7, 42.5, 19.7, 45.3] },
  { kod: 'ME', ad: 'Karadağ',         bayrak: '🇲🇪', kutu: [18.4, 41.8, 20.4, 43.6] },
  { kod: 'AL', ad: 'Arnavutluk',      bayrak: '🇦🇱', kutu: [19.2, 39.6, 21.1, 42.7] },
  { kod: 'XK', ad: 'Kosova',          bayrak: '🇽🇰', kutu: [20.0, 41.8, 21.8, 43.3] },
  { kod: 'MK', ad: 'K. Makedonya',    bayrak: '🇲🇰', kutu: [20.4, 40.8, 23.1, 42.4] },
  { kod: 'HR', ad: 'Hırvatistan',     bayrak: '🇭🇷', kutu: [13.4, 42.3, 19.5, 46.6] },
  { kod: 'TR', ad: 'Türkiye',         bayrak: '🇹🇷', kutu: [25.6, 35.8, 44.9, 42.2] }
];

// Kutular kenarlarda üst üste biniyor; en yakın durağın ülkesi tie-break yapıyor.
export function ulkeBul(lat, lon, gerok = aktif) {
  const adaylar = ULKE_KUTULARI.filter(u =>
    lon >= u.kutu[0] && lat >= u.kutu[1] && lon <= u.kutu[2] && lat <= u.kutu[3]
  );
  if (adaylar.length === 0) return null;
  if (adaylar.length === 1) return adaylar[0];

  const yakin = yakinDuraklar(lat, lon, 60000, gerok);
  for (const { durak } of yakin) {
    const eslesen = adaylar.find(u => u.kod === durak.ulke);
    if (eslesen) return eslesen;
  }
  // Belirsizse en küçük kutuyu seç — küçük ülke, daha kesin bilgi.
  return adaylar.sort((a, b) =>
    (a.kutu[2] - a.kutu[0]) * (a.kutu[3] - a.kutu[1]) -
    (b.kutu[2] - b.kutu[0]) * (b.kutu[3] - b.kutu[1])
  )[0];
}

export function ulkeAdi(kod) {
  const u = ULKE_KUTULARI.find(x => x.kod === kod);
  return u ? `${u.bayrak} ${u.ad}` : kod;
}

// Türkçe yönelme eki: "Bosna-Hersek'e", "Kosova'ya", "Sırbistan'a".
// Zaman çizgisinde on yıl duracak bir cümle — eki doğru koyalım.
export function yonelmeEki(ad) {
  const kalin = 'aıouâûAIOUÂÛ';
  const ince = 'eiöüîEİÖÜÎ';
  const unluler = kalin + ince;

  let sonUnlu = '';
  for (const harf of ad) if (unluler.includes(harf)) sonUnlu = harf;

  const ek = kalin.includes(sonUnlu) ? 'a' : 'e';
  const sonHarf = ad[ad.length - 1];
  const kaynastirma = unluler.includes(sonHarf) ? 'y' : '';

  return `${ad}'${kaynastirma}${ek}`;
}

// ---- Biçimlendirme --------------------------------------------------------

export function saat(zaman) {
  return new Date(zaman).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

export function tarihUzun(zaman) {
  return new Date(zaman).toLocaleDateString('tr-TR', {
    day: 'numeric', month: 'long', weekday: 'long'
  });
}

export function gunBasligi(g) {
  return g ? `Gün ${g.no} · ${g.baslik}` : 'Gerok dışı';
}
