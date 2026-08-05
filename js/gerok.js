// Gerok — gerok paketi: rota, günler, duraklar, sınır geçişleri.
// Paket uygulamanın içine gömülü DEĞİL; ayrı bir dosya olarak yükleniyor.
// Böylece rota, otel adı, koordinat gibi hiçbir bilgi yayınlanan koda girmiyor.

import { gerokYaz, gerokOku, geroklar, ayarYaz, ayarOku } from './veri.js';
import { mesafe } from './iz.js';

let aktif = null;

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

export function duraklar(gerok = aktif) { return gerok?.duraklar || []; }

export function gununDuraklari(gun, gerok = aktif) {
  return duraklar(gerok).filter(d => d.gun === gun);
}

export function durakBul(id, gerok = aktif) {
  return duraklar(gerok).find(d => d.id === id) || null;
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
