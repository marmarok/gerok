// Gerok — açık/koyu tema.
//
// Seçim üç şıklı: Otomatik (telefonun kendi ayarı), Açık, Koyu.
// Renkler CSS değişkenlerinde; burada yapılan tek şey <html data-tema="...">
// yazmak. Seçim localStorage'da tutuluyor — gezi verisi değil, cihaz tercihi;
// ayrıca açılışta beklemeden okunabiliyor (index.html'deki küçük betik).

// Sıra ve adlar tasarımdan: önce iki gerçek seçenek, sonra "karar verme"
// seçeneği. "Açık/Koyu" yerine "Gündüz/Gece" — kâğıdın rengini değil, günün
// hangi saatinde bakıldığını anlatıyor.
export const TEMALAR = [
  { id: 'acik', ad: 'Gündüz' },
  { id: 'koyu', ad: 'Gece' },
  { id: 'otomatik', ad: 'Otomatik' }
];

const ANAHTAR = 'gerokTema';
const ZEMIN = { acik: '#f6f3ec', koyu: '#12100e' };

export function temaSecimi() {
  try { return localStorage.getItem(ANAHTAR) || 'otomatik'; }
  catch { return 'otomatik'; }
}

export function cozulmusTema(secim = temaSecimi()) {
  if (secim === 'acik' || secim === 'koyu') return secim;
  return matchMedia('(prefers-color-scheme: light)').matches ? 'acik' : 'koyu';
}

export function temaUygula(secim = temaSecimi()) {
  const t = cozulmusTema(secim);
  document.documentElement.dataset.tema = t;
  const m = document.querySelector('meta[name="theme-color"]');
  if (m) m.content = ZEMIN[t];
  return t;
}

export function temaSec(secim) {
  try { localStorage.setItem(ANAHTAR, secim); } catch { /* yazamazsak da tema uygulanır */ }
  return temaUygula(secim);
}

export function temaBaslat() {
  temaUygula();
  // Otomatik'teyken telefon gece moduna geçince uygulama da geçsin.
  matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', () => { if (temaSecimi() === 'otomatik') temaUygula(); });
}
