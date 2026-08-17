// Gerok — gerok paketi: rota, günler, duraklar, sınır geçişleri.
// Paket uygulamanın içine gömülü DEĞİL; ayrı bir dosya olarak yükleniyor.
// Böylece rota, otel adı, koordinat gibi hiçbir bilgi yayınlanan koda girmiyor.

import { gerokYaz, gerokOku, geroklar, gerokSil, turunKayitlariniSil, izSil,
         ayarYaz, ayarOku, yeniKimlik } from './veri.js';
import { mesafe } from './iz.js';

let aktif = null;

// Kullanıcının kendi eklediği duraklar. Gerok paketinden GELMEZ — bu yüzden
// paket yeniden yüklense de durmaya devam ederler. Başka bir turdaki biri
// paketi olmadan da uygulamayı kullanabilsin diye var.
let ozel = [];

// Elle değiştirilmiş rota sırası: durak kimliği → o gün içindeki sıra.
let siraDuzeni = {};

// Elle değiştirilmiş gün: durak kimliği → gün numarası.
//
// Rehber programı yolda değiştiriyor — Balkanlar'da bazı duraklara bir gün
// erken gidildi. Paketin kendi `gun` alanına dokunmuyoruz; üstüne bu katman
// uygulanıyor. Böylece paket bozulmuyor, değişiklik akşam eşitlemesiyle
// karşı telefona da geçiyor ve gerekirse geri alınabiliyor.
let gunDuzeni = {};

// Paket duraklarının üstüne yazılan düzeltmeler: durak kimliği →
// `{ ad, unutma, gizli }`.
//
// Paket duraklarının adı ve unutma listesi Mac'te hazırlanıyor; yolda yanlış
// çıkabiliyor ("müze" diye yazılan yer aslında kilise) ya da hiç gidilmeyecek
// olduğu anlaşılıyor. Gün ve sıra düzeninde olduğu gibi paketin kendisine
// dokunulmuyor — üstüne bu katman uygulanıyor, geri alınabiliyor ve akşam
// eşitlemesiyle karşı telefona da geçiyor.
let durakDuzeni = {};

// Duraklara elle yazılan notlar: durak kimliği → not dizisi.
//
// Pakette zaten "unutma" listesi var ama o Mac'te hazırlanıyor ve yolda
// değişmiyor. Asıl işe yarayan bilgi orada çıkıyor: "tarçınlı tatlıyı şu
// köşedeki dükkândan al", "müzenin arka kapısı açık". Her not kendi
// kimliğiyle duruyor ki akşam eşitlemesinde iki telefonun notları
// birbirini ezmeden birleşsin.
let durakNotlari = {};

// Durak puanları: durak kimliği → { puan: 1..5, t: yazılma anı }
// Puan tek sayı; çakışmada en son yazılan kazanıyor.
let durakPuanlari = {};

// Duraklara internetten gelen bilgi: durak kimliği → { satir, t }
// "manastır · 08:00-18:00 · ücretli · +389…" gibi tek satır. Kaynağı
// OpenStreetMap (bkz. js/baglanti.js). Elle yazılan notlardan AYRI duruyor:
// biri senin yolda öğrendiğin şey, öteki haritanın söylediği şey.
let durakBilgileri = {};

export function aktifGerok() { return aktif; }

export async function baslat() {
  // Baştan sıfırlanıyor: silinen ya da arşive kaldırılan bir tur bellekte
  // asılı kalmasın. (Silme sınamasında tam bunu yakaladım — kayıtlı kimlik
  // yokken eski tur `aktif` olarak duruyordu.)
  aktif = null;
  const id = await ayarOku('aktifGerokId');
  if (id) aktif = await gerokOku(id);
  if (!aktif) {
    // Arşivlenmemişlerden en yenisi seçiliyor: arşiv, "bu bitti" demek.
    const hepsi = (await geroklar()).filter(g => !g.arsiv);
    if (hepsi.length) {
      aktif = hepsi.sort((a, b) => (b.baslangicAni || 0) - (a.baslangicAni || 0))[0];
      await ayarYaz('aktifGerokId', aktif.id);
    }
  }
  if (aktif?.arsiv) aktif = null;          // arşivdeki tur aktif olamaz
  ozel = await ayarOku('ozelDuraklar', []);
  siraDuzeni = await ayarOku('durakSirasi', {});
  gunDuzeni = await ayarOku('durakGunleri', {});
  durakDuzeni = await ayarOku('durakDuzenleri', {});
  durakNotlari = await ayarOku('durakNotlari', {});
  durakPuanlari = await ayarOku('durakPuanlari', {});
  durakBilgileri = await ayarOku('durakBilgileri', {});
  return aktif;
}

// ---- Turlar ---------------------------------------------------------------
//
// Bir tur biterse arşivlenir: kayıtları, izi ve durakları yerinde durur ama
// ekranlara karışmaz. Yeni tur boş bir defterle başlar. Her kayıt hangi tura
// ait olduğunu kendi içinde taşıyor (`gerokId`), ayıran şey o.

export async function turlar() {
  const hepsi = await geroklar();
  return hepsi.sort((a, b) => {
    if (!!a.arsiv !== !!b.arsiv) return a.arsiv ? 1 : -1;   // arşiv en sona
    return (b.baslangicAni || 0) - (a.baslangicAni || 0);
  });
}

export async function turSec(id) {
  const g = await gerokOku(id);
  if (!g) return false;
  if (g.arsiv) { g.arsiv = false; await gerokYaz(g); }
  aktif = g;
  await ayarYaz('aktifGerokId', id);
  return true;
}

export async function turArsivle(id, arsiv = true) {
  const g = await gerokOku(id);
  if (!g) return false;
  g.arsiv = arsiv;
  g.arsivlenme = arsiv ? Date.now() : null;
  await gerokYaz(g);

  if (arsiv && aktif?.id === id) {
    aktif = null;
    await ayarYaz('aktifGerokId', null);
    await baslat();                         // arşivlenmemiş bir tur varsa ona geç
  }
  return true;
}

// Günler tarihten üretiliyor: paketi olmayan biri de gününe göre gruplanmış
// bir zaman çizgisi görsün. Gün, turun başladığı SAATTE dönüyor — takvim
// gecesinde değil. Gece yarısından sonra yapılan kayıt hâlâ o güne yazılıyor.
function gunlerUret(baslangicAni, gunSayisi) {
  const bir = 24 * 3600_000;
  return Array.from({ length: gunSayisi }, (_, i) => ({
    no: i + 1,
    baslik: '',
    tarih: new Date(baslangicAni + i * bir).toISOString(),
    pencere: [
      new Date(baslangicAni + i * bir).toISOString(),
      new Date(baslangicAni + (i + 1) * bir - 1).toISOString()
    ]
  }));
}

export async function turBaslat({ ad, baslangic = Date.now(), gunSayisi = 7 }) {
  const bas = new Date(baslangic).getTime();
  const gun = Math.max(1, Math.min(120, Math.round(gunSayisi)));

  const tur = {
    id: yeniKimlik('g'),
    ad: String(ad || '').trim() || 'Yeni tur',
    baslangic: new Date(bas).toISOString(),
    bitis: new Date(bas + gun * 24 * 3600_000 - 1).toISOString(),
    baslangicAni: bas,
    gunler: gunlerUret(bas, gun),
    duraklar: [],
    sinirGecisleri: [],
    kendiKurulmus: true,                    // paketten değil, elle açıldı
    yuklenme: Date.now()
  };

  await gerokYaz(tur);
  await ayarYaz('aktifGerokId', tur.id);
  aktif = tur;
  return tur;
}

// Turu ve ona ait HER ŞEYİ siler. Geri dönüşü yok — arayüz önce yedek
// almayı öneriyor.
export async function turSil(id) {
  const silinenKayit = await turunKayitlariniSil(id);
  const silinenIz = await izSil(id);
  ozel = ozel.filter(d => (d.gerokId ?? null) !== id);
  await ayarYaz('ozelDuraklar', ozel);
  await gerokSil(id);
  if (aktif?.id === id) { aktif = null; await ayarYaz('aktifGerokId', null); await baslat(); }
  return { silinenKayit, silinenIz };
}

// Turlar ayrılmadan önce yazılmış kayıtlar hangi tura ait olduğunu bilmiyor.
// Açılışta bir kez o günün aktif turuna yazılıyorlar (bkz. app.js göçü).
export async function ozelDuraklaraTurYaz(gerokId) {
  let degisen = 0;
  for (const d of ozel) if (d.gerokId == null) { d.gerokId = gerokId; degisen++; }
  if (degisen) await ayarYaz('ozelDuraklar', ozel);
  return degisen;
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
    baslangicAni: new Date(paket.gerok.baslangic || Date.now()).getTime(),
    arsiv: false,
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
  if (!Array.isArray(gerok?.gunler)) return null;
  for (const g of gerok.gunler) {
    const [bas, bit] = gunPenceresi(g);
    if (bas != null && zaman >= bas && zaman <= bit) return g;
  }
  return null;
}

/**
 * Bir günün başlangıç–bitiş anı.
 *
 * Eskiden doğrudan `g.pencere.map(...)` yazıyordu. Bir günde bu alan eksik
 * olursa (elle düzenlenmiş ya da eski bir paket) açılışta `tazele()` çöküyor
 * ve uygulama BOŞ EKRAN veriyordu — hata mesajı bile yok. Yolda olabilecek
 * en kötü çökme bu: kayıtlar duruyor ama kullanıcı hiçbir şey göremiyor.
 *
 * Artık pencere yoksa günün `tarih` alanından o günün tamamı üretiliyor;
 * o da yoksa gün sessizce atlanıyor. Uygulama eksik bir paketle de açılıyor.
 */
export function gunPenceresi(g) {
  if (Array.isArray(g?.pencere) && g.pencere.length === 2) {
    const bas = new Date(g.pencere[0]).getTime();
    const bit = new Date(g.pencere[1]).getTime();
    if (Number.isFinite(bas) && Number.isFinite(bit)) return [bas, bit];
  }
  if (g?.tarih) {
    const gun = new Date(`${g.tarih}T00:00:00`).getTime();
    if (Number.isFinite(gun)) return [gun, gun + 24 * 60 * 60 * 1000 - 1];
  }
  return [null, null];
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
  const turId = gerok?.id ?? null;
  const paket = (gerok?.duraklar || []).map((d, i) => ({ ...d, kaynak: 'paket', sira: i }));
  const kendi = ozel
    .filter(d => !d.silindi && (d.gerokId ?? null) === turId)
    .map(d => ({ ...d, kaynak: 'kendi' }));
  // Silinmiş paket durakları listeye hiç girmiyor.
  const hepsi = [...paket, ...kendi].filter(d => !durakDuzeni[d.id]?.gizli);
  // Gün değişikliği paketin kendisine yazılmıyor, üstüne katman olarak
  // uygulanıyor — sıra düzeninde olduğu gibi.
  for (const d of hepsi) {
    const dz = durakDuzeni[d.id];
    if (dz?.ad) { d.ad = dz.ad; d.duzeltildi = true; }
    if (dz?.unutma) { d.unutma = dz.unutma; d.duzeltildi = true; }
    if (gunDuzeni[d.id] != null) { d.gun = gunDuzeni[d.id]; d.gunTasindi = true; }
    if (siraDuzeni[d.id] != null) d.sira = siraDuzeni[d.id];
    d.notlar = (durakNotlari[d.id] || []).filter(n => !n.silindi)
      .sort((a, b) => (a.t || 0) - (b.t || 0));
    d.puan = durakPuanlari[d.id]?.puan ?? null;
    d.osmBilgi = durakBilgileri[d.id]?.satir || null;
  }
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
    gerokId: aktif?.id ?? null,
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

// Her durak silinebiliyor — paket durağı da. Kendi eklediklerimiz `ozel`
// listesinde işaretleniyor, paket durakları için üstüne "gizli" katmanı
// yazılıyor. Paketin kendisi bozulmuyor: paket yeniden yüklenirse durak
// yerinde duruyor, yalnızca bu telefondaki katman onu saklıyor.
export async function durakYokEt(id) {
  const d = ozel.find(x => x.id === id);
  if (d) {
    d.silindi = true;
    d.guncelleme = Date.now();
    await ayarYaz('ozelDuraklar', ozel);
    return true;
  }
  durakDuzeni[id] = { ...(durakDuzeni[id] || {}), gizli: true, guncelleme: Date.now() };
  await ayarYaz('durakDuzenleri', { ...durakDuzeni });
  return true;
}

export async function durakDuzenle(id, { ad, gun, unutma }) {
  const d = ozel.find(x => x.id === id);
  if (d) {
    if (ad != null) d.ad = String(ad).trim() || d.ad;
    if (gun !== undefined) d.gun = gun;
    if (unutma) d.unutma = unutma.filter(Boolean);
    d.guncelleme = Date.now();
    await ayarYaz('ozelDuraklar', ozel);
    return true;
  }

  // Paket durağı: gün zaten kendi katmanında (gunDuzeni), ad ve unutma
  // listesi buraya yazılıyor.
  if (!duraklar().some(x => x.id === id)) return false;
  const dz = { ...(durakDuzeni[id] || {}) };
  if (ad != null && String(ad).trim()) dz.ad = String(ad).trim();
  if (unutma) dz.unutma = unutma.filter(Boolean);
  dz.guncelleme = Date.now();
  durakDuzeni[id] = dz;
  await ayarYaz('durakDuzenleri', { ...durakDuzeni });
  if (gun !== undefined) await durakGunuDegistir(id, gun);
  return true;
}

/**
 * Rota sırasını bir basamak yukarı (-1) ya da aşağı (+1) taşır.
 *
 * Gün sınırı ARTIK ENGEL DEĞİL (17 Ağustos). Günün ilk durağında yukarı
 * basılınca durak bir önceki günün SONUNA, son durağında aşağı basılınca bir
 * sonraki günün BAŞINA geçiyor — listede tek adım ilerlemiş gibi. Eskiden ok
 * orada ölüyordu ve durağı başka güne taşımak için ayrı bir düğme gerekiyordu.
 *
 * Dönüş: `false` (taşınamadı) ya da `{ yeniGun }` — gün değiştiyse yeni gün
 * numarası, değişmediyse null. Çağıran gün değişimini kullanıcıya söylüyor:
 * sessizce olsa programın bozulduğu fark edilmezdi.
 *
 * Günsüz duraklar bu zincirin dışında: onların "bir önceki günü" yok, kendi
 * içlerinde sıralanıyorlar.
 */
export async function durakTasi(id, yon) {
  const hepsi = duraklar();
  const kendisi = hepsi.find(d => d.id === id);
  if (!kendisi) return false;

  const gun = kendisi.gun ?? GUN_SONSUZ;
  const ayniGun = hepsi.filter(d => (d.gun ?? GUN_SONSUZ) === gun);
  const yerel = ayniGun.findIndex(d => d.id === id);
  const hedef = yerel + yon;

  if (hedef >= 0 && hedef < ayniGun.length) {
    const [tasinan] = ayniGun.splice(yerel, 1);
    ayniGun.splice(hedef, 0, tasinan);
    ayniGun.forEach((d, n) => { siraDuzeni[d.id] = n; });
    await ayarYaz('durakSirasi', { ...siraDuzeni });
    return { yeniGun: null };
  }

  // Günün ucuna gelindi: komşu güne geç.
  if (gun === GUN_SONSUZ) return false;
  const gunler = [...new Set(hepsi.map(d => d.gun).filter(g => g != null))]
    .sort((a, b) => a - b);
  const komsu = gunler[gunler.indexOf(gun) + yon];
  if (komsu == null) return false;

  await durakGunuDegistir(id, komsu);

  // durakGunuDegistir yeni günün SONUNA koyuyor; yukarı taşındığında istenen
  // bu. Aşağı taşındığındaysa başa geçmeli, yoksa günü atlamış gibi olur.
  if (yon > 0) {
    const yeniGunun = duraklar().filter(d => d.gun === komsu && d.id !== id);
    siraDuzeni[id] = 0;
    yeniGunun.forEach((d, n) => { siraDuzeni[d.id] = n + 1; });
    await ayarYaz('durakSirasi', { ...siraDuzeni });
  }
  return { yeniGun: komsu };
}

// ---- Durakların eşitlenmesi ----------------------------------------------
// Kendi eklediğimiz duraklar akşam paketiyle karşı tarafa da geçiyor.

/**
 * Durağı başka bir güne taşır. Paket durakları için de çalışır.
 * `gun = null` verilirse paketteki asıl gününe döner.
 */
export async function durakGunuDegistir(id, gun) {
  const d = duraklar().find(x => x.id === id);
  if (!d) return false;

  if (gun == null) delete gunDuzeni[id];
  else gunDuzeni[id] = gun;

  // Yeni günün sonuna koy: hangi sırada gezileceğini kullanıcı yukarı/aşağı
  // ile ayarlar, ama araya rastgele girmesin.
  if (gun != null) {
    const oGun = duraklar().filter(x => (x.gun ?? 999) === gun && x.id !== id);
    siraDuzeni[id] = oGun.length ? Math.max(...oGun.map(x => x.sira ?? 0)) + 1 : 0;
    await ayarYaz('durakSirasi', { ...siraDuzeni });
  }

  await ayarYaz('durakGunleri', { ...gunDuzeni });
  return true;
}

export function ozelDurakListesi() { return ozel; }
export function siraDuzeniAl() { return siraDuzeni; }
export function gunDuzeniAl() { return gunDuzeni; }
export function durakDuzeniAl() { return durakDuzeni; }

/**
 * Silinmiş duraklar — hem paketten gizlenenler hem kendi sildiklerimiz.
 *
 * Silme geri alınabilir olmalı: 26 duraklık listede yanlış karta basmak kolay
 * ve gezi programı yeniden yazılamaz. Duraklar listesinin altında "geri
 * getir" satırı bunu gösteriyor.
 */
export function silinmisDuraklar(gerok = aktif) {
  const turId = gerok?.id ?? null;
  const paket = (gerok?.duraklar || []).filter(d => durakDuzeni[d.id]?.gizli);
  const kendi = ozel.filter(d => d.silindi && (d.gerokId ?? null) === turId);
  return [...paket, ...kendi];
}

export async function durakGeriGetir(id) {
  const d = ozel.find(x => x.id === id);
  if (d?.silindi) {
    delete d.silindi;
    d.guncelleme = Date.now();
    await ayarYaz('ozelDuraklar', ozel);
    return true;
  }
  if (!durakDuzeni[id]?.gizli) return false;
  delete durakDuzeni[id].gizli;
  durakDuzeni[id].guncelleme = Date.now();
  await ayarYaz('durakDuzenleri', { ...durakDuzeni });
  return true;
}
export function durakNotlariAl() { return durakNotlari; }
export function durakPuanlariAl() { return durakPuanlari; }
export function durakBilgileriAl() { return durakBilgileri; }

/**
 * Duraga internetten gelen bilgiyi yazar.
 *
 * Bos satir da yaziliyor ('-'): bilgi bulunamayan bir durak her baglantida
 * yeniden sorulup kuyrugu tikamasin. Kullaniciya gosterilirken bos sayiliyor.
 */
export async function durakBilgiYaz(id, satir) {
  durakBilgileri = { ...durakBilgileri, [id]: { satir: String(satir || ''), t: Date.now() } };
  await ayarYaz('durakBilgileri', durakBilgileri);
}

/** Iki telefon birlestiginde: en son yazilan kazaniyor. */
export async function durakBilgileriBirlestir(gelen = null) {
  if (!gelen || typeof gelen !== 'object') return;
  for (const [id, b] of Object.entries(gelen)) {
    if (!b?.satir) continue;
    const eldeki = durakBilgileri[id];
    if (!eldeki || (b.t || 0) > (eldeki.t || 0)) durakBilgileri[id] = b;
  }
  durakBilgileri = { ...durakBilgileri };
  await ayarYaz('durakBilgileri', durakBilgileri);
}

// ---- Durak notları ---------------------------------------------------------

export async function durakNotEkle(id, metin, sahipAd = '') {
  const m = String(metin || '').trim();
  if (!id || !m) return null;
  const not = {
    id: yeniKimlik('n'),
    metin: m,
    t: Date.now(),
    sahipAd: sahipAd || '',
    silindi: false
  };
  durakNotlari = { ...durakNotlari, [id]: [...(durakNotlari[id] || []), not] };
  await ayarYaz('durakNotlari', durakNotlari);
  return not;
}

// Silme, satırı listeden çıkarmak yerine işaretleme. Yoksa akşam
// eşitlemesinde karşı telefon o notu "yeni" sanıp geri getirirdi.
export async function durakNotSil(durakId, notId) {
  const liste = durakNotlari[durakId];
  if (!liste) return false;
  const n = liste.find(x => x.id === notId);
  if (!n) return false;
  n.silindi = true;
  n.guncelleme = Date.now();
  await ayarYaz('durakNotlari', durakNotlari);
  return true;
}

export async function durakNotlariBirlestir(gelen = null) {
  if (!gelen || typeof gelen !== 'object') return 0;
  let yeni = 0;
  for (const [durakId, liste] of Object.entries(gelen)) {
    if (!Array.isArray(liste)) continue;
    const eldeki = new Map((durakNotlari[durakId] || []).map(n => [n.id, n]));
    for (const g of liste) {
      if (!g?.id) continue;
      const b = eldeki.get(g.id);
      if (!b) { eldeki.set(g.id, { ...g }); if (!g.silindi) yeni++; }
      // Silme her zaman kazanıyor: karşı taraf sildiyse geri gelmesin.
      else if (g.silindi && !b.silindi) eldeki.set(g.id, { ...g });
    }
    durakNotlari[durakId] = Array.from(eldeki.values());
  }
  await ayarYaz('durakNotlari', durakNotlari);
  return yeni;
}

// ---- Durak puanı -----------------------------------------------------------

export async function durakPuanla(id, puan) {
  if (!id) return false;
  // Aynı yıldıza tekrar basmak puanı kaldırıyor — yanlış basınca geri dönüş
  // olsun; puan silmek için ayrı bir düğme koymak kalabalık yapardı.
  if (puan == null || durakPuanlari[id]?.puan === puan) {
    durakPuanlari = { ...durakPuanlari };
    delete durakPuanlari[id];
  } else {
    durakPuanlari = { ...durakPuanlari, [id]: { puan, t: Date.now() } };
  }
  await ayarYaz('durakPuanlari', durakPuanlari);
  return true;
}

export async function durakPuanlariBirlestir(gelen = null) {
  if (!gelen || typeof gelen !== 'object') return 0;
  let yeni = 0;
  for (const [id, g] of Object.entries(gelen)) {
    if (!g || typeof g.puan !== 'number') continue;
    const b = durakPuanlari[id];
    // En son yazılan kazanıyor. İkiniz aynı yere ayrı puan verdiyseniz
    // son dokunuş geçerli — bu bir oylama değil, ortak defter.
    if (!b) { durakPuanlari[id] = { ...g }; yeni++; }
    else if ((g.t || 0) > (b.t || 0)) durakPuanlari[id] = { ...g };
  }
  await ayarYaz('durakPuanlari', durakPuanlari);
  return yeni;
}

// Akşam eşitlemesinde gelen gün değişikliklerini alır. Kendi değişikliğimiz
// önde: yolda ikimiz de aynı durağa dokunduysak kendi telefonundaki karar
// sessizce ezilmesin.
export async function gunDuzeniBirlestir(gelen = null) {
  if (!gelen || typeof gelen !== 'object') return 0;
  const oncesi = Object.keys(gunDuzeni).length;
  gunDuzeni = { ...gelen, ...gunDuzeni };
  const yeni = Object.keys(gunDuzeni).length - oncesi;
  if (yeni) await ayarYaz('durakGunleri', { ...gunDuzeni });
  return yeni;
}

// Durak düzeltmeleri (ad, unutma listesi, silme) — aynı kural: bendeki karar
// önde. Karşı taraf bir durağı silmişse ve ben silmemişsem silinmiş sayılıyor;
// tersi de doğru. Silme geri alınabilir bir katman, kayıp değil.
export async function durakDuzeniBirlestir(gelen = null) {
  if (!gelen || typeof gelen !== 'object') return 0;
  const oncesi = Object.keys(durakDuzeni).length;
  durakDuzeni = { ...gelen, ...durakDuzeni };
  const yeni = Object.keys(durakDuzeni).length - oncesi;
  if (yeni) await ayarYaz('durakDuzenleri', { ...durakDuzeni });
  return yeni;
}

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
