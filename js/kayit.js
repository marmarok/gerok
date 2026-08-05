// Sefer — kayıt türleri.
// Sesli not, ortam sesi, yazı, işaret, kişi, fiyat, fotoğraf.

import { kayitEkle, medyaYaz, yeniKimlik, izGetir, izdenKonum } from './veri.js';
import { suAnkiKonum } from './iz.js';
import { gunNo, aktifSefer, yonelmeEki } from './sefer.js';

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
  if (lat == null) {
    const iz = await izGetir();
    const bulunan = izdenKonum(iz, t);
    if (bulunan) { lat = bulunan.lat; lon = bulunan.lon; konumKaynagi = 'iz'; }
  }

  return {
    id: yeniKimlik(tur),
    seferId: aktifSefer()?.id || null,
    tur, t,
    olusturma: Date.now(),
    gun: gunNo(t),
    lat, lon, konumKaynagi,
    sahip: sahip.id,
    sahipAd: sahip.ad,
    silindi: false,
    ...ekler
  };
}

// ---- Ses ------------------------------------------------------------------

let kaydedici = null;
let parcalar = [];
let baslangicAni = 0;

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

export async function sesBasla() {
  if (kaydedici) return false;
  const akis = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true }
  });

  const bicim = enIyiSesBicimi();
  kaydedici = new MediaRecorder(akis, bicim ? { mimeType: bicim } : undefined);
  parcalar = [];
  baslangicAni = Date.now();

  kaydedici.ondataavailable = (e) => { if (e.data.size) parcalar.push(e.data); };
  kaydedici.start();
  return true;
}

export function sesSuresi() {
  return kaydedici ? (Date.now() - baslangicAni) / 1000 : 0;
}

export function sesKaydediyorMu() { return kaydedici !== null; }

// tur: 'ses' | 'ortam' | 'gunluk' | 'baslangic' | 'bitis' | 'mektup'
export async function sesBitir(tur = 'ses', ekler = {}) {
  if (!kaydedici) return null;

  const bicim = kaydedici.mimeType || 'audio/mp4';
  const sure = (Date.now() - baslangicAni) / 1000;

  const blob = await new Promise((tamam) => {
    kaydedici.onstop = () => tamam(new Blob(parcalar, { type: bicim }));
    kaydedici.stop();
  });

  kaydedici.stream.getTracks().forEach(iz => iz.stop());
  kaydedici = null;
  parcalar = [];

  // Yarım saniyenin altı kazayla basılmış demektir, kaydetme.
  if (sure < 0.5) return null;

  const medyaId = yeniKimlik('m');
  await medyaYaz(medyaId, blob);

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
}

// ---- Yazı, işaret, kişi, fiyat -------------------------------------------

export async function yaziEkle(metin) {
  if (!metin?.trim()) return null;
  const k = await kayitKur('yazi', { metin: metin.trim() });
  await kayitEkle(k);
  return k;
}

export async function isaretEkle(metin = '') {
  const k = await kayitKur('isaret', { metin: metin.trim() });
  await kayitEkle(k);
  return k;
}

export async function kisiEkle(ad, not = '') {
  if (!ad?.trim()) return null;
  const k = await kayitKur('kisi', { metin: ad.trim(), not: not.trim() });
  await kayitEkle(k);
  return k;
}

export async function fiyatEkle(ne, tutar, paraBirimi) {
  if (!ne?.trim()) return null;
  const k = await kayitKur('fiyat', {
    metin: ne.trim(),
    tutar: tutar || '',
    paraBirimi: (paraBirimi || '').trim()
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

async function onizlemeUret(dosya) {
  if (dosya.type.startsWith('video/')) return videoKaresi(dosya);

  const gorsel = await createImageBitmap(dosya).catch(() => null);
  if (!gorsel) return null;

  const oran = Math.min(1, ONIZLEME_EN / Math.max(gorsel.width, gorsel.height));
  const en = Math.round(gorsel.width * oran);
  const boy = Math.round(gorsel.height * oran);

  const tuval = new OffscreenCanvas(en, boy);
  tuval.getContext('2d').drawImage(gorsel, 0, 0, en, boy);
  gorsel.close();

  return {
    blob: await tuval.convertToBlob({ type: 'image/jpeg', quality: ONIZLEME_KALITE }),
    en, boy
  };
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
export async function fotoAl(dosyalar, ilerleme = null, ekTur = null) {
  const iz = await izGetir();
  const eklenenler = [];
  const liste = Array.from(dosyalar);

  for (let i = 0; i < liste.length; i++) {
    const dosya = liste[i];
    ilerleme?.(i, liste.length);

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
  }

  ilerleme?.(liste.length, liste.length);
  return eklenenler;
}
