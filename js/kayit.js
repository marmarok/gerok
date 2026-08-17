// Gerok — kayıt türleri.
// Sesli not, ortam sesi, yazı, işaret, kişi, fiyat, fotoğraf.

import { kayitEkle, medyaYaz, medyaEkle, medyaSil, yeniKimlik, izGetir, izdenKonum,
         ayarYaz, ayarOku } from './veri.js';
import { suAnkiKonum, mesafe } from './iz.js';
import { gunNo, aktifGerok, yonelmeEki, duraklar } from './gerok.js';

let sahip = { id: null, ad: null };
export function sahipAyarla(s) { sahip = s; }
export function sahipAl() { return sahip; }

// Ortak alanları dolduran tek kapı — her kayıt aynı biçimde çıksın diye.
async function kayitKur(tur, ekler = {}) {
  const t = ekler.t || Date.now();
  let lat = ekler.lat ?? null, lon = ekler.lon ?? null;
  let konumKaynagi = ekler.konumKaynagi ?? null;

  if (lat == null) {
    const k = await suAnkiKonum(8000);
    if (k) { lat = k.lat; lon = k.lon; konumKaynagi = 'gps'; }
  }

  // GPS yoksa (ya da fotoğrafta silinmişse) izden saate göre bul.
  // Yalnızca bu turun izinden: başka bir gezinin noktasına eşleşmesin.
  if (lat == null) {
    const iz = await izGetir(aktifGerok()?.id ?? null);
    const bulunan = izdenKonum(iz, t);
    if (bulunan) { lat = bulunan.lat; lon = bulunan.lon; konumKaynagi = 'iz'; }
  }

  const k = {
    id: yeniKimlik(tur),
    gerokId: aktifGerok()?.id || null,
    tur, t,
    olusturma: Date.now(),
    gun: gunNo(t),
    lat, lon, konumKaynagi,
    sahip: sahip.id,
    sahipAd: sahip.ad,
    silindi: false,
    ...ekler
  };

  if (!k.yerAdi) {
    const y = yakinDurakAdi(k.lat, k.lon);
    if (y) { k.yerAdi = y; k.yerKaynagi = 'durak'; }
  }
  return k;
}

/**
 * Kaydın yerine en yakın durağın adı.
 *
 * NEDEN İNTERNETTEN DEĞİL: yer adını çevrimiçi servisten almak çalışıyor
 * ama yolda internet yok — ses kaydı "konum: 41.09, 20.79" diye kalıyor ve
 * o hâliyle akşam bakınca hangi yer olduğu anlaşılmıyor. Oysa durakların
 * adları ve koordinatları zaten telefonda: 600 metre yarıçapta bir durak
 * varsa kaydın nerede alındığı o an belli oluyor.
 *
 * 600 metre: bir durağın çevresinde yürüme mesafesi. Daha genişi yanlış
 * ad yazmaya başlıyor — yan şehrin adını yazmaktansa hiç yazmamak iyi.
 *
 * `yerKaynagi: 'durak'` işareti kalıyor: internet gelince gerçek adres
 * bunun üstüne yazılıyor (bkz. baglanti.js).
 */
function yakinDurakAdi(lat, lon) {
  if (lat == null || lon == null) return '';
  let enYakin = null, enKisa = Infinity;
  for (const d of duraklar()) {
    if (d.lat == null || d.lon == null) continue;
    const m = mesafe(lat, lon, d.lat, d.lon);
    if (m < enKisa) { enKisa = m; enYakin = d; }
  }
  return enKisa <= 600 ? enYakin.ad : '';
}

// ---- Ses ------------------------------------------------------------------

let kaydedici = null;
let parcalar = [];
let baslangicAni = 0;

// Duraklatma muhasebesi.
//
// Rehber anlatırken araya girip sonra kaldığı yerden devam etmek gerekiyor
// (gezide oldu). MediaRecorder'ın kendi `pause()`/`resume()`'u sesi TEK
// dosyada birleştiriyor — durdurup yeni kayıt açmaya gerek yok, ara da
// dosyaya girmiyor. Bizim tutmamız gereken tek şey ne kadar durakladığımız:
// yoksa süre sayacı ve ortam sesinin geri sayımı ara boyunca da işler.
let duraklamaAni = 0;      // 0 = duraklamış değiliz
let duraklananMs = 0;      // toplam duraklı geçen süre

function enIyiSesBicimi() {
  const adaylar = [
    'audio/mp4',              // iOS Safari bunu veriyor
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus'
  ];
  for (const a of adaylar) {
    if (MediaRecorder.isTypeSupported?.(a)) return a;
  }
  return '';
}

// Kayıt sırasında ekran kapanınca ses KAYBOLUYORDU (Balkanlar, gerçek kullanım).
//
// Sebep: `kaydedici.start()` zaman dilimsiz çağrılıyordu. O hâlde MediaRecorder
// bütün sesi kendi iç tamponunda tutuyor ve ancak `stop()` denince tek parça
// hâlinde veriyor. iOS ekran kapanınca sayfayı donduruyor, gerekirse arka
// plandaki sekmeyi tamamen boşaltıyor — tampon o an gidiyor. Ekran açılınca
// sayaç kaldığı yerden devam ettiği için kayıt sürüyormuş gibi görünüyor, ama
// "Durdur ve kaydet" denince elde hiçbir şey olmuyor ve kayıt zaman çizgisine
// düşmüyor.
//
// Çözüm üç katmanlı:
//   1. `start(3000)` — ses her 3 saniyede bir parça olarak dışarı alınıyor,
//      böylece en fazla son 3 saniye riskte kalıyor.
//   2. Ekran kapanmak üzereyken `requestData()` ile o ana kadarki ses zorla
//      alınıyor — o 3 saniyelik pencere de kapanıyor.
//   3. `stop()` sonrası bekleyişte zaman aşımı var (aşağıda): iOS `onstop`
//      olayını hiç göndermezse elde ne varsa onunla kaydediliyor.
const PARCA_MS = 3000;

// Yarım kalan kayıt: parçalar bellekte değil, DİSKTE de birikiyor.
//
// Yukarıdaki üç katman uygulamanın YAŞADIĞI durumları kurtarıyor. Kurtarmadığı
// bir durum kalıyordu: iOS uygulamayı arka planda tamamen öldürürse (yer
// darsa, telefon yeniden başlarsa, kart yukarı kaydırılırsa) bellekteki
// parçalar da onunla gidiyordu — kayıt hiç var olmamış gibi oluyordu.
//
// Artık her parça geldiğinde diske de ekleniyor ve yanına küçük bir günlük
// yazılıyor. Uygulama bir daha açıldığında o günlük duruyorsa, ses de duruyor
// demektir: "Yarım bir kayıt bulundu" penceresi çıkıyor.
const YARIM_MEDYA = 'yarim-kayit';
const YARIM_GUNLUK = 'yarimKayit';
let yarimYaziyor = null;      // aynı anda iki yazma olmasın diye sıra

function yarimaEkle(parca) {
  // Yazmalar sırayla: OPFS'e aynı anda iki ekleme, dosyayı bozar.
  yarimYaziyor = (yarimYaziyor || Promise.resolve())
    .then(() => medyaEkle(YARIM_MEDYA, parca))
    .catch(() => { /* disk doluysa bellekteki parçalar yine duruyor */ });
  return yarimYaziyor;
}

async function yarimiTemizle() {
  try { await yarimYaziyor; } catch { /* zaten hata verdi */ }
  yarimYaziyor = null;
  await ayarYaz(YARIM_GUNLUK, null).catch(() => {});
  await medyaSil(YARIM_MEDYA).catch(() => {});
}

/** Açılışta bakılıyor: yarım kalmış bir kayıt var mı? */
export async function yarimKayitVarMi() {
  const g = await ayarOku(YARIM_GUNLUK, null);
  if (!g?.baslangic) return null;
  return g;
}

/** Yarım kaydı kalıcı bir kayda dönüştürür ve günlüğü temizler. */
export async function yarimKaydiSakla() {
  const g = await yarimKayitVarMi();
  if (!g) return null;

  const { medyaOku } = await import('./veri.js');
  const blob = await medyaOku(YARIM_MEDYA);
  if (!blob?.size) { await yarimiTemizle(); return null; }

  const medyaId = yeniKimlik('m');
  await medyaYaz(medyaId, blob);
  // Kaydın saati yarım kaydın BAŞLADIĞI an: defterdeki yeri orası olmalı,
  // kurtarıldığı an değil.
  const k = await kayitKur(g.tur || 'ses', {
    t: g.baslangic,
    medyaId,
    bicim: g.bicim || 'audio/mp4',
    sure: Math.max(0, (g.sonParca - g.baslangic) / 1000),
    yarim: true
  });
  await kayitEkle(k);
  await yarimiTemizle();
  return k;
}

export async function yarimKaydiSil() { await yarimiTemizle(); }

/** Yarım kaydı dinlemek için adres — saklamadan önce ne olduğunu duymak için. */
export async function yarimKayitAdresi() {
  const g = await yarimKayitVarMi();
  if (!g) return null;
  const { medyaUrl } = await import('./veri.js');
  return medyaUrl(YARIM_MEDYA, g.bicim || null);
}

export async function sesBasla() {
  if (kaydedici) return false;
  const akis = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true }
  });

  const bicim = enIyiSesBicimi();
  kaydedici = new MediaRecorder(akis, bicim ? { mimeType: bicim } : undefined);
  parcalar = [];
  baslangicAni = Date.now();

  // Önceki bir yarım kayıt varsa temizle: iki kayıt aynı dosyaya eklenirse
  // ortaya iki sesin birbirine karıştığı bozuk bir dosya çıkar.
  await yarimiTemizle();

  kaydedici.ondataavailable = (e) => {
    if (!e.data.size) return;
    parcalar.push(e.data);
    yarimaEkle(e.data);
    // Günlük her parçada tazeleniyor: son parçanın saati, kaydın ne kadar
    // sürdüğünü söyleyen tek şey.
    ayarYaz(YARIM_GUNLUK, {
      baslangic: baslangicAni, sonParca: Date.now(),
      tur: kaydediciTuru, bicim: kaydedici?.mimeType || bicim || 'audio/mp4'
    }).catch(() => {});
  };
  kaydedici.start(PARCA_MS);
  duraklamaAni = 0;
  duraklananMs = 0;
  gorunurlukDinle();
  return true;
}

// Kaydın türü parça yazılırken de lazım (yarım kayıt günlüğüne giriyor), ama
// `sesBitir` çağrılana kadar bilinmiyordu. Kayıt başlarken haber veriliyor.
let kaydediciTuru = 'ses';
export function sesTuruAyarla(tur) { kaydediciTuru = tur || 'ses'; }

// ---- Duraklat / devam et ---------------------------------------------------

// Tarayıcı duraklatmayı destekliyor mu? Safari destekliyor ama emin olmadan
// düğmeyi göstermek, basınca hiçbir şey olmayan bir düğme demek olurdu.
export function sesDuraklatilabilirMi() {
  return typeof MediaRecorder !== 'undefined'
    && typeof MediaRecorder.prototype.pause === 'function'
    && typeof MediaRecorder.prototype.resume === 'function';
}

export function sesDuraklandiMi() { return duraklamaAni > 0; }

export function sesDuraklat() {
  if (!kaydedici || kaydedici.state !== 'recording') return false;
  try {
    // Duraklatmadan önce elde olanı al: iOS bu sırada sayfayı dondurursa
    // (ki duraklatıp cebe koymak tam o durum) son parça kaybolmasın.
    kaydedici.requestData();
    kaydedici.pause();
  } catch { return false; }
  duraklamaAni = Date.now();
  return true;
}

export function sesDevam() {
  if (!kaydedici || kaydedici.state !== 'paused') return false;
  try { kaydedici.resume(); } catch { return false; }
  if (duraklamaAni) duraklananMs += Date.now() - duraklamaAni;
  duraklamaAni = 0;
  return true;
}

// Ekran kapanmadan hemen önce elde olanı kurtarır.
let gorunurlukKurulu = false;
function gorunurlukDinle() {
  if (gorunurlukKurulu) return;
  gorunurlukKurulu = true;
  const kurtar = () => {
    if (!kaydedici || kaydedici.state !== 'recording') return;
    // requestData, o ana kadarki sesi ondataavailable ile hemen verir.
    try { kaydedici.requestData(); } catch { /* desteklenmiyorsa parça yine gelir */ }
  };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') kurtar();
  });
  // iOS sayfayı boşaltmadan önce bunu gönderiyor — son şans.
  window.addEventListener('pagehide', kurtar);
}

// Kaydedilen sesin süresi — duraklı geçen zaman sayılmıyor. Sayaçta 3 dakika
// yazıp dosya 40 saniye çıksaydı, hangi kaydın nerede olduğu anlaşılmazdı.
export function sesSuresi() {
  if (!kaydedici) return 0;
  const suanDurakli = duraklamaAni ? Date.now() - duraklamaAni : 0;
  return (Date.now() - baslangicAni - duraklananMs - suanDurakli) / 1000;
}

export function sesKaydediyorMu() { return kaydedici !== null; }

// tur: 'ses' | 'ortam' | 'gunluk' | 'baslangic' | 'bitis' | 'mektup'
export async function sesBitir(tur = 'ses', ekler = {}) {
  if (!kaydedici) return null;

  const bicim = kaydedici.mimeType || 'audio/mp4';
  const sure = sesSuresi();     // duraklı geçen süre düşülmüş hâli

  // `onstop` beklenirken zaman aşımı: iOS sayfayı arada dondurduysa bu olay
  // hiç gelmeyebiliyor ve eskiden burada sonsuza kadar bekleniyordu — kayıt
  // ne kaydediliyor ne de hata veriyordu, sessizce kayboluyordu.
  // Artık 4 saniye sonra elde ne varsa onunla devam ediliyor: eksik bir kayıt,
  // hiç olmayan kayıttan iyidir.
  const kayd = kaydedici;
  const blob = await new Promise((tamam) => {
    let bitti = false;
    const ver = () => {
      if (bitti) return;
      bitti = true;
      tamam(new Blob(parcalar, { type: bicim }));
    };
    kayd.onstop = ver;
    setTimeout(ver, 4000);
    try { kayd.stop(); } catch { ver(); }   // zaten durmuşsa hemen ver
  });

  kaydedici.stream.getTracks().forEach(iz => iz.stop());
  kaydedici = null;
  parcalar = [];
  duraklamaAni = 0;
  duraklananMs = 0;

  // Kayıt düzgün bittiğine göre yarım kayıt günlüğü de kalkmalı: kalırsa
  // uygulama bir daha açıldığında aynı ses ikinci kez sorulur.
  await yarimiTemizle();

  // Yarım saniyenin altı kazayla basılmış demektir, kaydetme.
  if (sure < 0.5) return null;

  // Süre uzun görünüyor ama elde ses yoksa, iOS kaydı arka planda öldürmüş
  // demektir. Sessizce "kaydedildi" demek en kötüsü olurdu — kullanıcı
  // kaydettiğini sanıp devam eder ve konuşulanlar kaybolur.
  if (!blob.size) {
    const h = new Error('Ekran kapalıyken kayıt kesilmiş, ses elde edilemedi');
    h.sesKesildi = true;
    throw h;
  }

  // Dosyaya yazma da zaman aşımına bağlı.
  //
  // NEDEN: burada takılırsa `sesBitir` hiç dönmüyor — kullanıcı "Durdur ve
  // kaydet"e basıyor, katman kapanıyor, ama kayıt zaman çizgisine hiç
  // düşmüyor ve hiçbir hata da çıkmıyor. Sınamada tam bu görüldü: akış
  // yazma adımında sessizce asılı kaldı. Telefonda yer bittiğinde ya da
  // depolama katmanı takıldığında aynısı olur. Artık 15 saniye sonra
  // vazgeçip AÇIKÇA söylüyoruz; sessiz kayıp en kötü sonuç.
  const medyaId = yeniKimlik('m');
  try {
    await Promise.race([
      medyaYaz(medyaId, blob),
      new Promise((_, hata) =>
        setTimeout(() => hata(new Error('depolama yanıt vermedi')), 15000))
    ]);
  } catch (h) {
    const y = new Error(`Ses dosyaya yazılamadı (${h.message})`);
    y.yazilamadi = true;
    throw y;
  }

  const kayit = await kayitKur(tur, {
    t: baslangicAni,
    medyaId,
    sure: Math.round(sure * 10) / 10,
    bicim,
    boyut: blob.size,
    ...ekler
  });
  await kayitEkle(kayit);
  return kayit;
}

export function sesIptal() {
  if (!kaydedici) return;
  try {
    kaydedici.stream.getTracks().forEach(iz => iz.stop());
    kaydedici.stop();
  } catch { /* zaten durmuş olabilir */ }
  kaydedici = null;
  parcalar = [];
  duraklamaAni = 0;
  duraklananMs = 0;
  // "Vazgeç" gerçekten vazgeçmek demek: diskteki yarım dosya da gitsin,
  // yoksa bir dahaki açılışta "yarım bir kayıt bulundu" diye sorulur.
  yarimiTemizle();
}

// ---- Yazı, işaret, kişi, fiyat -------------------------------------------

// `yer`: kullanıcının elle yazdığı yer adı. Uydu tutmadığında (kapalı alan,
// tünel, uçak) kaydın nerede olduğunu söyleyen tek şey bu satır oluyor.
export async function yaziEkle(metin, yer = '') {
  if (!metin?.trim()) return null;
  const k = await kayitKur('yazi', { metin: metin.trim() });
  if (yer.trim()) k.yerAdi = yer.trim();
  await kayitEkle(k);
  return k;
}

export async function isaretEkle(metin = '') {
  const k = await kayitKur('isaret', { metin: metin.trim() });
  await kayitEkle(k);
  return k;
}

/**
 * Tanıştığımız kişi. Fotoğraf isteğe bağlı.
 *
 * Ad ve tek satır not, on yıl sonra "kimdi bu" sorusunun yarısını cevaplıyor;
 * yüz öteki yarısı. Fotoğraf buraya da KOPYALANMIYOR — küçültülmüş bir
 * önizlemesi alınıyor (fotoAl ile aynı yol), aslı telefonun galerisinde
 * kalıyor.
 */
export async function kisiEkle(ad, not = '', dosya = null) {
  if (!ad?.trim()) return null;

  let medyaId = null, en = null, boy = null;
  if (dosya) {
    const onizleme = await onizlemeUret(dosya).catch(() => null);
    if (onizleme?.blob) {
      medyaId = yeniKimlik('m');
      await medyaYaz(medyaId, onizleme.blob);
      en = onizleme.en; boy = onizleme.boy;
    }
  }

  const k = await kayitKur('kisi', {
    metin: ad.trim(), not: not.trim(), medyaId, en, boy,
    dosyaAdi: dosya?.name || null
  });
  await kayitEkle(k);
  return k;
}

// Harcama. `tur` eskiden beri 'fiyat' — eski kayıtlar bozulmasın diye
// değiştirilmedi, yalnızca ekranda görünen adı "Harcama" oldu.
export const HARCAMA_KATEGORILERI = [
  'yemek', 'ulaşım', 'konaklama', 'giriş/müze', 'alışveriş', 'diğer'
];

export async function fiyatEkle(ne, tutar, paraBirimi, kategori = '') {
  if (!ne?.trim()) return null;
  const k = await kayitKur('fiyat', {
    metin: ne.trim(),
    tutar: tutar || '',
    paraBirimi: (paraBirimi || '').trim(),
    kategori: (kategori || '').trim()
  });
  await kayitEkle(k);
  return k;
}

export async function sinirEkle(ulkeKodu, ulkeAdi, zaman, lat, lon) {
  const k = await kayitKur('sinir', {
    t: zaman, lat, lon, konumKaynagi: 'gps',
    metin: `${yonelmeEki(ulkeAdi)} girdik`,
    ulke: ulkeKodu
  });
  await kayitEkle(k);
  return k;
}

// ---- Fotoğraf / video -----------------------------------------------------
//
// Orijinal dosya uygulamaya KOPYALANMIYOR. Telefonun galerisinde, tam kalitede,
// iCloud yedeğiyle duruyor. Burada tuttuğumuz: küçük bir önizleme, çekilme saati
// ve konum. Dönüşte orijinaller doğrudan telefondan harici diske alınacak.

const ONIZLEME_EN = 1280;
const ONIZLEME_KALITE = 0.72;

// Küçültülmüş kareyi blob'a çevirir. OffscreenCanvas her yerde yok (ve olduğu
// yerde de convertToBlob eksik olabiliyor); desteklenmiyorsa sıradan <canvas>
// kullanılıyor. Burada patlamak tüm fotoğraf aktarımını kilitliyordu.
async function tuvaleCiz(gorsel, en, boy) {
  if (typeof OffscreenCanvas === 'function') {
    try {
      const t = new OffscreenCanvas(en, boy);
      t.getContext('2d').drawImage(gorsel, 0, 0, en, boy);
      if (typeof t.convertToBlob === 'function') {
        return await t.convertToBlob({ type: 'image/jpeg', quality: ONIZLEME_KALITE });
      }
    } catch { /* aşağıdaki sıradan tuvale düşülüyor */ }
  }

  const t = document.createElement('canvas');
  t.width = en; t.height = boy;
  t.getContext('2d').drawImage(gorsel, 0, 0, en, boy);
  return new Promise(tamam => t.toBlob(tamam, 'image/jpeg', ONIZLEME_KALITE));
}

async function onizlemeUret(dosya) {
  if (dosya.type.startsWith('video/')) return videoKaresi(dosya);

  const gorsel = await createImageBitmap(dosya).catch(() => null);
  if (!gorsel) return null;

  const oran = Math.min(1, ONIZLEME_EN / Math.max(gorsel.width, gorsel.height));
  const en = Math.round(gorsel.width * oran);
  const boy = Math.round(gorsel.height * oran);

  try {
    const blob = await tuvaleCiz(gorsel, en, boy);
    return blob ? { blob, en, boy } : null;
  } finally {
    gorsel.close();
  }
}

function videoKaresi(dosya) {
  return new Promise((tamam) => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.muted = true;
    v.playsInline = true;
    const url = URL.createObjectURL(dosya);

    const temizle = () => { URL.revokeObjectURL(url); };
    const vazgec = () => { temizle(); tamam(null); };

    v.onloadeddata = () => {
      v.currentTime = Math.min(1, (v.duration || 2) / 3);
    };
    v.onseeked = async () => {
      const oran = Math.min(1, ONIZLEME_EN / Math.max(v.videoWidth, v.videoHeight));
      const en = Math.round(v.videoWidth * oran);
      const boy = Math.round(v.videoHeight * oran);
      const tuval = document.createElement('canvas');
      tuval.width = en; tuval.height = boy;
      tuval.getContext('2d').drawImage(v, 0, 0, en, boy);
      tuval.toBlob((b) => {
        temizle();
        tamam(b ? { blob: b, en, boy, sure: v.duration } : null);
      }, 'image/jpeg', ONIZLEME_KALITE);
    };
    v.onerror = vazgec;
    setTimeout(vazgec, 15000);   // takılırsa tüm içe aktarmayı kilitlemesin
    v.src = url;
  });
}

// JPEG'in EXIF bloğundan çekim tarihi ve GPS okur.
// iOS çoğu zaman bunları siliyor; silmediğinde bedava doğruluk kazanıyoruz.
async function exifOku(dosya) {
  if (!dosya.type.includes('jpeg')) return {};
  const tampon = await dosya.slice(0, 128 * 1024).arrayBuffer();
  const veri = new DataView(tampon);
  if (veri.byteLength < 4 || veri.getUint16(0) !== 0xFFD8) return {};

  let yer = 2;
  while (yer < veri.byteLength - 4) {
    if (veri.getUint8(yer) !== 0xFF) break;
    const isaret = veri.getUint8(yer + 1);
    const boy = veri.getUint16(yer + 2);
    if (isaret === 0xE1) {
      const basi = yer + 4;
      if (veri.getUint32(basi) === 0x45786966) return tiffCoz(veri, basi + 6);
      break;
    }
    if (isaret === 0xDA) break;
    yer += 2 + boy;
  }
  return {};
}

function tiffCoz(veri, tiff) {
  try {
    const kucukUclu = veri.getUint16(tiff) === 0x4949;
    const u16 = (o) => veri.getUint16(o, kucukUclu);
    const u32 = (o) => veri.getUint32(o, kucukUclu);

    const ifd0 = tiff + u32(tiff + 4);
    const sonuc = {};
    let exifIfd = 0, gpsIfd = 0;

    const alanlar = (basi, isle) => {
      const sayi = u16(basi);
      for (let i = 0; i < sayi; i++) isle(basi + 2 + i * 12);
    };

    alanlar(ifd0, (o) => {
      const etiket = u16(o);
      if (etiket === 0x8769) exifIfd = tiff + u32(o + 8);
      if (etiket === 0x8825) gpsIfd = tiff + u32(o + 8);
    });

    const metinOku = (o) => {
      const uzunluk = u32(o + 4);
      const yer = uzunluk > 4 ? tiff + u32(o + 8) : o + 8;
      let s = '';
      for (let i = 0; i < uzunluk - 1; i++) s += String.fromCharCode(veri.getUint8(yer + i));
      return s;
    };

    if (exifIfd) {
      alanlar(exifIfd, (o) => {
        const etiket = u16(o);
        if (etiket === 0x9003 || etiket === 0x9004) {   // DateTimeOriginal / DateTimeDigitized
          const s = metinOku(o);
          const e = s.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
          if (e && !sonuc.t) {
            sonuc.t = new Date(+e[1], +e[2] - 1, +e[3], +e[4], +e[5], +e[6]).getTime();
          }
        }
      });
    }

    if (gpsIfd) {
      const oranli = (o) => {
        const yer = tiff + u32(o + 8);
        let d = 0;
        for (let i = 0; i < 3; i++) {
          const pay = u32(yer + i * 8), payda = u32(yer + i * 8 + 4);
          d += (payda ? pay / payda : 0) / Math.pow(60, i);
        }
        return d;
      };
      let lat = null, lon = null, kuzey = 'N', dogu = 'E';
      alanlar(gpsIfd, (o) => {
        const etiket = u16(o);
        if (etiket === 1) kuzey = String.fromCharCode(veri.getUint8(o + 8));
        if (etiket === 2) lat = oranli(o);
        if (etiket === 3) dogu = String.fromCharCode(veri.getUint8(o + 8));
        if (etiket === 4) lon = oranli(o);
      });
      if (lat != null && lon != null) {
        sonuc.lat = kuzey === 'S' ? -lat : lat;
        sonuc.lon = dogu === 'W' ? -lon : lon;
      }
    }
    return sonuc;
  } catch {
    return {};
  }
}

// Seçilen fotoğraf/videoları içe alır. ilerleme(yapilan, toplam) ile haber verir.
let basarisiz = [];

export async function fotoAl(dosyalar, ilerleme = null, ekTur = null) {
  const iz = await izGetir(aktifGerok()?.id ?? null);
  const eklenenler = [];
  const liste = Array.from(dosyalar);
  basarisiz = [];

  for (let i = 0; i < liste.length; i++) {
    const dosya = liste[i];
    ilerleme?.(i, liste.length);
    try {
    const exif = await exifOku(dosya);
    // Sıralama: EXIF çekim saati > dosyanın kendi tarihi.
    const t = exif.t || dosya.lastModified || Date.now();

    let lat = exif.lat ?? null, lon = exif.lon ?? null;
    let konumKaynagi = lat != null ? 'exif' : null;

    if (lat == null) {
      const bulunan = izdenKonum(iz, t);
      if (bulunan) { lat = bulunan.lat; lon = bulunan.lon; konumKaynagi = 'iz'; }
    }

    const onizleme = await onizlemeUret(dosya);
    let medyaId = null;
    if (onizleme?.blob) {
      medyaId = yeniKimlik('m');
      await medyaYaz(medyaId, onizleme.blob);
    }

    const kayit = await kayitKur(ekTur || (dosya.type.startsWith('video/') ? 'video' : 'foto'), {
      t, lat, lon, konumKaynagi,
      medyaId,
      dosyaAdi: dosya.name,
      dosyaBoyut: dosya.size,
      dosyaTur: dosya.type,
      en: onizleme?.en,
      boy: onizleme?.boy,
      videoSure: onizleme?.sure
    });
    await kayitEkle(kayit);
    eklenenler.push(kayit);
    } catch (hata) {
      // Tek bir bozuk dosya bütün aktarımı öldürmesin — atla, geri kalanı al.
      console.warn('fotoğraf alınamadı:', dosya.name, hata);
      basarisiz.push(dosya.name || 'adsız dosya');
    }
  }

  ilerleme?.(liste.length, liste.length);
  return eklenenler;
}

// Son aktarımda atlanan dosyalar — arayüz bunu kullanıcıya söylüyor.
export function sonBasarisizlar() { return basarisiz.slice(); }
