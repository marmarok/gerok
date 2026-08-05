// Gerok — iz kaydı.
//
// Uygulama açıkken 30 saniyede bir konum noktası biriktirir. Bu iz iki işe yarıyor:
//   1. Haritada gezinin rotasını çizmek,
//   2. Sonradan eklenen fotoğrafları SAATİNE göre yerleştirmek.
//
// İkincisi kritik: iOS, tarayıcıdan çekilen fotoğrafın GPS bilgisini siliyor
// (WebKit hata kaydı 257534). Fotoğrafçıların GPS'siz makinelerde yaptığı gibi,
// fotoğrafın çekilme saatini ize eşleştirerek yerini buluyoruz.

import { izEkle, yeniKimlik } from './veri.js';

const NORMAL_ARALIK = 30_000;      // 30 saniye
const TASARRUF_ARALIK = 120_000;   // pil %20'nin altındayken 2 dakika
const EN_AZ_MESAFE = 25;           // metre — bundan az hareket varsa nokta yazma

let izleyici = null;
let sonNokta = null;
let sonYazma = 0;
let tasarrufModu = false;
let dinleyiciler = [];
let cihazKimligi = null;

export function cihazAyarla(kimlik) { cihazKimligi = kimlik; }

export function dinle(fn) {
  dinleyiciler.push(fn);
  return () => { dinleyiciler = dinleyiciler.filter(d => d !== fn); };
}

function haberVer(olay) {
  for (const d of dinleyiciler) {
    try { d(olay); } catch (e) { console.warn('iz dinleyicisi hata verdi', e); }
  }
}

// İki koordinat arasındaki mesafe, metre (haversine).
export function mesafe(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const r = Math.PI / 180;
  const dLat = (lat2 - lat1) * r;
  const dLon = (lon2 - lon1) * r;
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

async function pilDurumunuIzle() {
  if (!navigator.getBattery) return;
  try {
    const pil = await navigator.getBattery();
    const guncelle = () => {
      const yeni = pil.level <= 0.20 && !pil.charging;
      if (yeni !== tasarrufModu) {
        tasarrufModu = yeni;
        haberVer({ tur: 'tasarruf', acik: tasarrufModu });
      }
    };
    guncelle();
    pil.addEventListener('levelchange', guncelle);
    pil.addEventListener('chargingchange', guncelle);
  } catch { /* pil bilgisi yoksa normal aralıkla devam */ }
}

function noktaGeldi(konum) {
  const simdi = Date.now();
  const aralik = tasarrufModu ? TASARRUF_ARALIK : NORMAL_ARALIK;
  const { latitude: lat, longitude: lon, accuracy: dogruluk } = konum.coords;

  haberVer({ tur: 'konum', lat, lon, dogruluk, t: simdi });

  // Çok sapmış okumaları alma — şehir içinde 100 m üstü doğruluk çöp sayılır.
  if (dogruluk > 100) return;

  if (sonNokta) {
    const gecenSure = simdi - sonYazma;
    const gidilenYol = mesafe(sonNokta.lat, sonNokta.lon, lat, lon);
    if (gecenSure < aralik && gidilenYol < EN_AZ_MESAFE) return;
    if (gidilenYol < EN_AZ_MESAFE && gecenSure < aralik * 4) return;
  }

  const nokta = {
    id: `${cihazKimligi || 'bilinmeyen'}_${simdi}`,
    t: simdi,
    lat, lon,
    dogruluk: Math.round(dogruluk),
    sahip: cihazKimligi
  };

  sonNokta = nokta;
  sonYazma = simdi;
  izEkle(nokta).catch(e => console.warn('iz noktası yazılamadı', e));
  haberVer({ tur: 'nokta', nokta });
}

function hataGeldi(hata) {
  const mesajlar = {
    1: 'Konum izni verilmemiş. Ayarlar → Safari → Konum bölümünden izin ver.',
    2: 'Konum alınamıyor. Açık havada birkaç saniye bekle.',
    3: 'Konum zaman aşımına uğradı.'
  };
  haberVer({ tur: 'hata', kod: hata.code, mesaj: mesajlar[hata.code] || hata.message });
}

export function calisiyorMu() { return izleyici !== null; }
export function tasarruftaMi() { return tasarrufModu; }

export async function basla() {
  if (izleyici !== null) return true;
  if (!navigator.geolocation) {
    haberVer({ tur: 'hata', mesaj: 'Bu cihazda konum desteği yok.' });
    return false;
  }

  pilDurumunuIzle();

  izleyici = navigator.geolocation.watchPosition(noktaGeldi, hataGeldi, {
    enableHighAccuracy: true,
    maximumAge: 10_000,
    timeout: 30_000
  });

  haberVer({ tur: 'durum', calisiyor: true });
  return true;
}

export function dur() {
  if (izleyici !== null) {
    navigator.geolocation.clearWatch(izleyici);
    izleyici = null;
    haberVer({ tur: 'durum', calisiyor: false });
  }
}

// Tek seferlik konum — kayıt eklerken "şu an neredeyim" için.
export function suAnkiKonum(zamanAsimi = 10_000) {
  return new Promise((tamam) => {
    if (!navigator.geolocation) return tamam(null);
    navigator.geolocation.getCurrentPosition(
      (k) => tamam({
        lat: k.coords.latitude,
        lon: k.coords.longitude,
        dogruluk: k.coords.accuracy
      }),
      () => tamam(sonNokta ? { lat: sonNokta.lat, lon: sonNokta.lon, dogruluk: sonNokta.dogruluk } : null),
      { enableHighAccuracy: true, timeout: zamanAsimi, maximumAge: 60_000 }
    );
  });
}

export function sonBilinenKonum() { return sonNokta; }

// İzin toplam uzunluğu (km) — Gün Sonu özetinde ve Gerok Kapağı'nda kullanılıyor.
export function izUzunlugu(noktalar) {
  let toplam = 0;
  for (let i = 1; i < noktalar.length; i++) {
    const a = noktalar[i - 1], b = noktalar[i];
    const d = mesafe(a.lat, a.lon, b.lat, b.lon);
    // Bir sonraki nokta ile arada 1 saatten fazla varsa yol değil, kopukluktur.
    if (b.t - a.t < 3600_000) toplam += d;
  }
  return toplam / 1000;
}

export { yeniKimlik };
