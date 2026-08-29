// Gerok — dil katmanı.
//
// İki dil var: Türkçe (kaynak) ve Kurmancî. Kaynak metin kodun içinde
// okunur halde duruyor; sözlüğün ANAHTARI da o metnin kendisi. Böylece
// yüzlerce anahtar adı uydurmak gerekmiyor ve bir çeviri eksik kalırsa
// uygulama boş yazı değil, Türkçesini gösteriyor — hiçbir durumda
// ekranda boşluk çıkmıyor.
//
// Kullanımı etiketli şablon:
//
//   ç`Yedek al`                      → "Paşxistin"
//   ç`${n} şey bekliyor.`            → anahtar: "{0} şey bekliyor."
//
// Değişkenler {0}, {1} olarak anahtarın içine giriyor. Bu önemli:
// Kurmancîde sözcük sırası Türkçeden farklı, çeviri {0}'ı istediği yere
// koyabiliyor.
//
// Dil değişince sayfa yeniden yükleniyor. Ekranların bir kısmı açılışta bir
// kez çiziliyor; tek tek yeniden çizdirmek yerine yeniden yüklemek hem kesin
// hem de çevrimdışı uygulamada göz açıp kapayana kadar sürüyor.

import { KU } from './diller/ku.js';

const ANAHTAR = 'gerokDil';

const SOZLUKLER = { ku: KU };

// localStorage, IndexedDB değil: çeviri işlevi eşzamanlı olmak zorunda,
// ilk boya öncesinde de gerekiyor (bkz. tema.js aynı sebeple böyle).
function okunanDil() {
  try { return localStorage.getItem(ANAHTAR) || 'tr'; }
  catch { return 'tr'; }
}

let aktif = okunanDil();
let sozluk = SOZLUKLER[aktif] || null;

/** 'tr' | 'ku' */
export function aktifDil() { return aktif; }

export const DILLER = [
  { kod: 'tr', ad: 'Türkçe', kendi: 'Türkçe' },
  { kod: 'ku', ad: 'Kürtçe (Kurdî)', kendi: 'Kurdî' }
];

export function dilSec(kod) {
  if (!DILLER.some(d => d.kod === kod)) return false;
  if (kod === aktif) return false;
  try { localStorage.setItem(ANAHTAR, kod); } catch { /* yazamazsak da uygulanır */ }
  aktif = kod;
  sozluk = SOZLUKLER[kod] || null;
  document.documentElement.lang = kod;
  return true;
}

// -------------------------------------------------------------- çeviri ---

function anahtarla(parcalar) {
  let a = parcalar[0];
  for (let i = 1; i < parcalar.length; i++) a += '{' + (i - 1) + '}' + parcalar[i];
  return a;
}

function yerlestir(kalip, degerler) {
  if (!degerler.length) return kalip;
  return kalip.replace(/\{(\d+)\}/g, (tam, i) => {
    const d = degerler[+i];
    return d === undefined || d === null ? '' : String(d);
  });
}

// Çevrilmemiş anahtarlar: sözlüğü tamamlarken hangi metnin eksik kaldığını
// bulmanın yolu. Uygulamanın çalışmasını etkilemiyor, sadece biriktiriyor.
const eksikler = new Set();
export function eksikCeviriler() { return Array.from(eksikler).sort(); }

/**
 * Etiketli şablon olarak da, düz metinle de çağrılabiliyor:
 *   ç`Yedek al`   ve   ç('Yedek al')
 * İkincisi, metnin bir değişkende geldiği yerler için (tür adları gibi).
 */
export function ç(parcalar, ...degerler) {
  const kalip = typeof parcalar === 'string' ? parcalar : anahtarla(parcalar);
  if (!sozluk) return yerlestir(kalip, degerler);
  const karsilik = sozluk[kalip];
  if (karsilik === undefined) {
    eksikler.add(kalip);
    return yerlestir(kalip, degerler);
  }
  return yerlestir(karsilik, degerler);
}

// ---------------------------------------------------------------- tarih ---

// Kurmancî ay ve gün adları burada duruyor, tarayıcının kendi listesinde
// değil. Sebebi ölçüldü: masaüstü tarayıcının ICU'sunda 'ku' var ama
// iPhone'daki Safari'de olduğunun güvencesi yok; olmayınca sessizce
// İngilizceye düşüyordu. Ayrıca ay adlarında birden fazla gelenek var
// (Çile/Sibat… ile Rêbendan/Reşemî…) — buradaki takım Türkiye'de yazılan
// Kurmancîde yerleşmiş olan.
//
// İki biçim var çünkü Kurmancîde tarih ezafe alıyor: "29ê tebaxa 2026an".
// Kuralı çalıştırmak yerine iki biçimi de yazmak daha az hata veriyor.
const KU_AYLAR = [
  { ad: 'Çile',      ezafe: 'Çileya'      },
  { ad: 'Sibat',     ezafe: 'Sibata'      },
  { ad: 'Adar',      ezafe: 'Adara'       },
  { ad: 'Nîsan',     ezafe: 'Nîsana'      },
  { ad: 'Gulan',     ezafe: 'Gulana'      },
  { ad: 'Hezîran',   ezafe: 'Hezîrana'    },
  { ad: 'Tîrmeh',    ezafe: 'Tîrmeha'     },
  { ad: 'Tebax',     ezafe: 'Tebaxa'      },
  { ad: 'Îlon',      ezafe: 'Îlona'       },
  { ad: 'Cotmeh',    ezafe: 'Cotmeha'     },
  { ad: 'Mijdar',    ezafe: 'Mijdara'     },
  { ad: 'Berfanbar', ezafe: 'Berfanbara'  }
];

// getDay(): 0 pazar.
const KU_GUNLER = ['Yekşem', 'Duşem', 'Sêşem', 'Çarşem', 'Pêncşem', 'În', 'Şemî'];
const KU_GUN_KISA = ['Yş', 'Dş', 'Sş', 'Çş', 'Pş', 'În', 'Şm'];

const KU_AY_KISA = ['Çil', 'Sib', 'Ada', 'Nîs', 'Gul', 'Hez', 'Tîr', 'Teb', 'Îlo', 'Cot', 'Mij', 'Ber'];

/** Sayı ve saat biçimi için yerel ad. Kurmancîde de Türkiye biçimi (1.234,5). */
export function yerel() { return 'tr-TR'; }

/**
 * Tarih yazımı. Türkçede tarayıcıya bırakılıyor, Kurmancîde kendi
 * listemizden kuruluyor.
 * kip: 'uzun' → 29 Ağustos 2026 / 29ê tebaxa 2026an
 *      'gun'  → 29 Ağustos Cumartesi / Şemî, 29ê tebaxa
 *      'kisa' → 29 Ağu / 29 Teb
 */
export function tarihYaz(zaman, kip = 'uzun') {
  const t = new Date(zaman);
  if (aktif !== 'ku') {
    if (kip === 'gun') return t.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' });
    if (kip === 'kisa') return t.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
    return t.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  const g = t.getDate(), a = t.getMonth(), y = t.getFullYear();
  if (kip === 'kisa') return `${g} ${KU_AY_KISA[a]}`;
  if (kip === 'gun') return `${KU_GUNLER[t.getDay()]}, ${g}ê ${KU_AYLAR[a].ezafe.toLowerCase()}`;
  return `${g}ê ${KU_AYLAR[a].ezafe.toLowerCase()} ${y}an`;
}

/** Yalnız gün adı. */
export function gunAdi(zaman, kisa = false) {
  const t = new Date(zaman);
  if (aktif !== 'ku') {
    return t.toLocaleDateString('tr-TR', { weekday: kisa ? 'short' : 'long' });
  }
  return (kisa ? KU_GUN_KISA : KU_GUNLER)[t.getDay()];
}

/** Yalnız ay adı. */
export function ayAdi(ay, kisa = false) {
  if (aktif !== 'ku') {
    return new Date(2000, ay, 1).toLocaleDateString('tr-TR', { month: kisa ? 'short' : 'long' });
  }
  return kisa ? KU_AY_KISA[ay] : KU_AYLAR[ay].ad;
}

// ------------------------------------------------------- açılış metinleri ---

// index.html'in içindeki sabit yazılar koda hiç dokunulmadan çevriliyor:
// açılışta bir kez geziliyor, metin sözlükte varsa değiştiriliyor. HTML
// dosyasını kirletmemenin ve oradaki 60 küsur yazıyı tek tek elle
// işaretlememenin yolu bu. Sadece bir kez, uygulama kendi ekranlarını
// çizmeden önce çalışıyor.
const OZNITELIKLER = ['placeholder', 'title', 'aria-label'];

export function sayfayiCevir(kok = document.body) {
  if (!sozluk) return 0;
  let sayi = 0;

  const gezgin = document.createTreeWalker(kok, NodeFilter.SHOW_TEXT);
  const dokunulacak = [];
  for (let d = gezgin.nextNode(); d; d = gezgin.nextNode()) {
    const ham = d.nodeValue;
    if (!ham || !ham.trim()) continue;
    if (sozluk[ham.trim()] !== undefined) dokunulacak.push(d);
  }
  dokunulacak.forEach(d => {
    const bosluk = d.nodeValue.match(/^(\s*)([\s\S]*?)(\s*)$/);
    d.nodeValue = bosluk[1] + sozluk[bosluk[2]] + bosluk[3];
    sayi++;
  });

  kok.querySelectorAll('*').forEach(e => {
    OZNITELIKLER.forEach(o => {
      const v = e.getAttribute(o);
      if (v && sozluk[v] !== undefined) { e.setAttribute(o, sozluk[v]); sayi++; }
    });
  });

  return sayi;
}

export function dilBaslat() {
  document.documentElement.lang = aktif;
  if (aktif !== 'tr') sayfayiCevir();
}
