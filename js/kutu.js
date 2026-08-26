// Gerok kara kutusu — telefonda tutulan küçük arıza ve kullanım defteri.
//
// NEDEN VAR: bugüne kadar uygulama hiçbir hatayı hiçbir yere yazmıyordu.
// Bir arkadaşın telefonunda bir şey kırıldığında o bilgi hiçbir yerde
// durmuyordu; kendisi bile göremiyordu. "Bir şey oldu ama ne olduğunu
// bilmiyorum" cümlesinin cevabı yok demekti. Artık var.
//
// NE YAZILIR: hatanın kendisi, hangi dosyada olduğu, sürüm, telefon türü,
// ve sayaçlar (kaç açılış, kaç ses kaydı, kaç yedek...).
//
// NE YAZILMAZ: kaydın İÇERİĞİ. Not metni, sesin yazısı, fotoğraf, konum,
// isim, gezi adı, durak adı — hiçbiri buraya girmez. Bu defterin çıktısı
// bir gün başkasına gidecek; giden şeyin içinde kimsenin defteri olmayacak.
//
// İKİ AYRI ÇIKIŞ, İKİ AYRI KURAL:
//   · Sayaçlar otomatik gidebilir — içlerinde metin yok, yalnızca sayı.
//   · Hata satırları YALNIZCA kişi görüp onaylayınca gider. Bir hata
//     mesajının içine kullanıcının yazdığı bir şey sızmış olabilir; o riski
//     otomatik bir kanala koymuyoruz.

import * as veri from './veri.js';

// Otomatik istatistik kanalı. Buraya YALNIZCA `sayacOzeti()` gidiyor —
// sayılar. Hata metinleri buraya asla girmez; onlar kişi görüp onaylayınca,
// ayrı bir yoldan gider. Sebep: bir hata mesajı o an elindeki veriyi
// alıntılayabiliyor ve bu kanalda kimse ona bakmıyor.
const ISTATISTIK_ADRESI = 'https://docs.google.com/forms/d/e/'
  + '1FAIpQLSfh_T2NbVR6u-ABRZ8-E2ypr4ISujwSZt7siIyA19AYFxTmzA/formResponse';
const ISTATISTIK_ALANI = 'entry.2041046097';
const ISTATISTIK_ARALIK = 7 * 86400000;      // Haftada bir; günlük gürültü olur.

const ANAHTAR = 'karaKutu';
const EN_FAZLA_HATA = 40;        // Defter şişmesin; en eskiler düşer.
const MESAJ_SINIRI = 300;        // Uzun yığın izleri kırpılır.
const YAZMA_GECIKMESI = 4000;    // Her sayaçta diske yazmak pahalı.

let kutu = null;                 // Bellekteki hali; disk buna yetişir.
let surum = '';
let yazmaZamani = null;
let yazilacak = false;

function bos() {
  return { bicim: 1, ilkAcilis: Date.now(), sayaclar: {}, hatalar: [] };
}

/** Telefonun türü — model değil, sınıf. Kimseyi tanıtmaz. */
function telefonTuru() {
  const u = navigator.userAgent || '';
  const platform = /iPhone|iPad|iPod/.test(u) ? 'iOS'
    : /Android/.test(u) ? 'Android'
    : /Macintosh/.test(u) ? 'Mac'
    : /Windows/.test(u) ? 'Windows' : 'bilinmiyor';
  // iOS sürümü sorunları ayırmakta gerçekten işe yarıyor: bir hata çoğu
  // zaman tek bir iOS sürümünde çıkıyor.
  const s = /OS (\d+)[_.](\d+)/.exec(u);
  return s ? `${platform} ${s[1]}.${s[2]}` : platform;
}

/** Dosya yolundan yalnızca dosya adını al: tam yol kullanıcının adresini taşır. */
function yerKisalt(kaynak, satir) {
  if (!kaynak) return '';
  const ad = String(kaynak).split('/').pop().split('?')[0];
  return satir ? `${ad}:${satir}` : ad;
}

async function diskeYaz() {
  yazilacak = false;
  if (kutu) await veri.ayarYaz(ANAHTAR, kutu);
}

function yazmayiPlanla() {
  yazilacak = true;
  clearTimeout(yazmaZamani);
  yazmaZamani = setTimeout(diskeYaz, YAZMA_GECIKMESI);
}

/**
 * Kara kutuyu aç ve yakalayıcıları tak.
 *
 * `window.onerror` ve `unhandledrejection` olmadan bir hata konsola düşüp
 * kayboluyordu. Uygulama kapalıyken konsola kimse bakmaz.
 */
export async function baslat(surumAdi) {
  surum = surumAdi || '';
  kutu = await veri.ayarOku(ANAHTAR, null) || bos();
  say('acilis');

  addEventListener('error', (o) => {
    // Resim/ses yüklenememesi de buraya düşüyor; onun `message`ı olmuyor.
    if (o.message) hata('kod', o.message, yerKisalt(o.filename, o.lineno));
    else if (o.target?.src) hata('dosya', 'yüklenemedi', yerKisalt(o.target.src));
  }, true);

  addEventListener('unhandledrejection', (o) => {
    const s = o.reason;
    hata('soz', s?.message || String(s || ''), yerKisalt(s?.stack?.split('\n')[1]));
  });

  // Sekme arkaya alınırken bekleyen yazma kaybolmasın.
  addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && yazilacak) diskeYaz();
  });
}

/** Bir sayacı artır. Yalnızca sayı; hangi kayıt olduğu yazılmaz. */
export function say(ad, kac = 1) {
  if (!kutu) return;
  kutu.sayaclar[ad] = (kutu.sayaclar[ad] || 0) + kac;
  yazmayiPlanla();
}

/**
 * Bir hatayı deftere yaz.
 *
 * Aynı hata art arda yüzlerce kez çıkabiliyor (bir döngünün içinde).
 * Aynısı tekrar gelirse yeni satır açmak yerine sayısını artırıyoruz;
 * yoksa defter tek bir hatayla dolup gerçek olanı dışarı itiyor.
 */
export function hata(tur, mesaj, yer = '') {
  if (!kutu) return;
  const metin = String(mesaj || '').slice(0, MESAJ_SINIRI);
  const son = kutu.hatalar[kutu.hatalar.length - 1];
  if (son && son.mesaj === metin && son.yer === yer) {
    son.kac = (son.kac || 1) + 1;
    son.t = Date.now();
  } else {
    kutu.hatalar.push({ t: Date.now(), tur, mesaj: metin, yer, surum, kac: 1 });
    if (kutu.hatalar.length > EN_FAZLA_HATA)
      kutu.hatalar.splice(0, kutu.hatalar.length - EN_FAZLA_HATA);
  }
  kutu.sayaclar.hata = (kutu.sayaclar.hata || 0) + 1;
  yazmayiPlanla();
}

/** Bildirilmemiş hata var mı? Uygulama açılışta buna bakıp soruyor. */
export function bildirilmeyenHatalar() {
  if (!kutu) return [];
  const sinir = kutu.sonBildirim || 0;
  return kutu.hatalar.filter(h => h.t > sinir);
}

/** Bildirim yapıldı; bundan öncekiler bir daha sorulmasın. */
export async function bildirildiIsaretle() {
  if (!kutu) return;
  kutu.sonBildirim = Date.now();
  await diskeYaz();
}

/**
 * Otomatik gidebilecek özet: YALNIZCA sayı.
 *
 * Hata metinleri bilerek yok. Bir hata mesajının içine kullanıcının yazdığı
 * bir şey sızmış olabilir ve bu kanalda kimse ona bakmıyor.
 */
export function sayacOzeti() {
  if (!kutu) return null;
  return {
    bicim: 1,
    surum,
    telefon: telefonTuru(),
    gun: Math.round((Date.now() - kutu.ilkAcilis) / 86400000),
    sayaclar: { ...kutu.sayaclar },
  };
}

/**
 * Sorularak gidecek tam rapor: sayaçlar + hata satırları.
 * Bu hep önce ekranda gösterilir, kişi okur, sonra gönderir.
 */
export function tamRapor() {
  const o = sayacOzeti();
  if (!o) return null;
  return {
    ...o,
    hatalar: (kutu.hatalar || []).map(h => ({
      ne: h.mesaj, yer: h.yer, kac: h.kac,
      ne_zaman: new Date(h.t).toISOString().slice(0, 16).replace('T', ' '),
      surum: h.surum,
    })),
  };
}

/** Kişi isterse defteri boşaltabilsin. Kendi telefonu, kendi kaydı. */
export async function temizle() {
  kutu = bos();
  await diskeYaz();
}


/**
 * Telefonu ayırt eden kısa, geri döndürülemez bir işaret.
 *
 * Neden gerekli: 8 telefondan gelen sayıları ayıramazsan "bir kişide çok
 * çıkıyor" ile "herkeste bir kez çıkıyor" birbirine karışır.
 *
 * Neden cihaz kimliğinin kendisi DEĞİL: o kimlik kayıtların içinde de
 * yazıyor (`sahip.id`). Olduğu gibi gönderilirse, gelen sayılarla birinin
 * defteri eşleştirilebilir olurdu. Özeti gönderiliyor; geri çevrilemiyor.
 */
async function telefonIsareti() {
  const ham = await veri.ayarOku('cihazKimligi', '') || '';
  if (!ham || !crypto?.subtle) return 'bilinmiyor';
  const oz = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('gerok:' + ham));
  return [...new Uint8Array(oz)].slice(0, 4)
    .map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function istatistikAcikMi() {
  return await veri.ayarOku('istatistikGonder', true) !== false;
}

export async function istatistikAyarla(acik) {
  await veri.ayarYaz('istatistikGonder', !!acik);
}

export async function sonIstatistikZamani() {
  return await veri.ayarOku('sonIstatistik', null);
}

/**
 * Haftalık sayı gönderimi.
 *
 * `mode: 'no-cors'` zorunlu: Google Formlar cevabında CORS başlığı yok.
 * Bunun bedeli, GİTTİĞİNİ DOĞRULAYAMAMAK — istek başarısız olsa da aynı
 * görünüyor. O yüzden aşağıda yazılan şey "gönderildi" değil, "denendi".
 * Bu ayrımı gizlemiyoruz; panelde de böyle yazıyor.
 */
export async function istatistikGonder({ zorla = false } = {}) {
  if (!kutu) return 'kutu yok';
  if (!await istatistikAcikMi()) return 'kapalı';
  if (!navigator.onLine) return 'çevrimdışı';

  const son = await veri.ayarOku('sonIstatistik', 0);
  if (!zorla && son && Date.now() - son < ISTATISTIK_ARALIK) return 'erken';

  const paket = { ...sayacOzeti(), telefon_isareti: await telefonIsareti() };
  try {
    await fetch(ISTATISTIK_ADRESI, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ [ISTATISTIK_ALANI]: JSON.stringify(paket) }),
    });
    await veri.ayarYaz('sonIstatistik', Date.now());
    return 'denendi';
  } catch (h) {
    // Ağ hatası raporlanmıyor: istatistik gönderememek kullanıcının sorunu
    // değil ve kara kutuyu kendi gürültüsüyle doldurmasın.
    return 'ağ yok';
  }
}
