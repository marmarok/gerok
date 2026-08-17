// Gerok — kâğıdın rengi.
//
// Eskiden üç şık vardı: Otomatik / Gündüz / Gece. 17 Ağustos'ta kaldırıldı.
// Artık kâğıdın rengi doğrudan seçiliyor — sınırsız. Seçilen renk açık mı
// koyu mu, ona bakılıp tema kendiliğinden belirleniyor: koyu bir kâğıt seçmek
// zaten "gece kipi" demek, ayrıca bir düğme gerekmiyor.
//
// Hiç renk seçilmemişse telefonun kendi ayarı geçerli (eski "Otomatik").
//
// Nötrler (kat, çizgi, yazı, soluk yazı) kâğıttan türetiliyor: hepsi aynı
// rengin tonları olduğu için hangi kâğıt seçilirse seçilsin arayüz dağılmıyor.

import { karistir, acikMi } from './renk.js';

const ANAHTAR = 'gerokTema';
const KAGIT_ANAHTAR = 'gerokKagit';
const ZEMIN = { acik: '#f6f3ec', koyu: '#12100e' };

export function temaSecimi() {
  try { return localStorage.getItem(ANAHTAR) || 'otomatik'; }
  catch { return 'otomatik'; }
}

export function kagitSecimi() {
  try { return localStorage.getItem(KAGIT_ANAHTAR) || ''; }
  catch { return ''; }
}

export function cozulmusTema(secim = temaSecimi()) {
  const kagit = kagitSecimi();
  if (kagit) return acikMi(kagit) ? 'acik' : 'koyu';
  if (secim === 'acik' || secim === 'koyu') return secim;
  return matchMedia('(prefers-color-scheme: light)').matches ? 'acik' : 'koyu';
}

/** Renk seçicisi açıldığında içinde ne yazacağı. */
export function varsayilanKagit() { return kagitSecimi() || ZEMIN[cozulmusTema()]; }

const NOTR = ['--zemin', '--kat', '--kat2', '--cizgi', '--yazi', '--soluk', '--cok-soluk'];

function kagidiUygula(kagit, acik) {
  const kok = document.documentElement.style;
  if (!kagit) { NOTR.forEach(p => kok.removeProperty(p)); return; }
  // Açık kâğıtta katlar koyulaşarak, koyu kâğıtta açılarak ayrışıyor.
  const yon = acik ? '#000000' : '#ffffff';
  kok.setProperty('--zemin', kagit);
  kok.setProperty('--kat', karistir(kagit, yon, 0.045));
  kok.setProperty('--kat2', karistir(kagit, yon, 0.095));
  kok.setProperty('--cizgi', karistir(kagit, yon, 0.17));
  kok.setProperty('--yazi', karistir(kagit, yon, 0.86));
  kok.setProperty('--soluk', karistir(kagit, yon, 0.60));
  kok.setProperty('--cok-soluk', karistir(kagit, yon, 0.42));
}

export function temaUygula(secim = temaSecimi()) {
  const t = cozulmusTema(secim);
  const kagit = kagitSecimi();
  document.documentElement.dataset.tema = t;
  kagidiUygula(kagit, t === 'acik');
  const m = document.querySelector('meta[name="theme-color"]');
  if (m) m.content = kagit || ZEMIN[t];
  return t;
}

export function kagitSec(hex) {
  try { localStorage.setItem(KAGIT_ANAHTAR, hex); } catch { /* yine de uygulanır */ }
  return temaUygula();
}

export function kagitSil() {
  try { localStorage.removeItem(KAGIT_ANAHTAR); } catch { /* yoksay */ }
  return temaUygula();
}

export function temaSec(secim) {
  try { localStorage.setItem(ANAHTAR, secim); } catch { /* yazamazsak da tema uygulanır */ }
  return temaUygula(secim);
}

export function temaBaslat() {
  temaUygula();
  // Kâğıt seçilmemişse telefon gece kipine geçince uygulama da geçsin.
  matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', () => { if (!kagitSecimi()) temaUygula(); });
}
