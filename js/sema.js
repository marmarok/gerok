// Gerok — renk şemaları.
//
// Gece/gündüz teması (js/tema.js) zeminin rengini belirliyor: kâğıt mı, gece mi.
// ŞEMA ise vurgunun rengini belirliyor — üzerine basılabilecek her şeyin rengi.
// İkisi birbirinden bağımsız: her şema hem gece hem gündüz karşılığını taşıyor.
//
// Kural: nötrler (zemin, kat, çizgi, yazı) şemayla DEĞİŞMEZ. Kâğıt hep aynı
// kâğıt kalır. Değişen tek şey vurgu ailesi. Böylece şema değiştirmek uygulamayı
// başka bir uygulamaya çevirmiyor, sadece rengini değiştiriyor.
//
// Değerler Claude Design'daki GEROK tasarımının SEMALAR tablosundan birebir.

import { karistir, karsit } from './renk.js';

export const SEMALAR = {
  'kahve': {
    ust: '#241f1a',
    koyu: { vurgu: '#d29346', vurguKoyu: '#a8722f', vurguYazi: '#1a1410', su: '#527e96', birincilZemin: 'linear-gradient(160deg,#2a2119,#1a1714)', birincilCizgi: '#4a3a22', seciliZemin: '#232c1c', seciliCizgi: '#3d4d2f' },
    acik: { vurgu: '#96551b', vurguKoyu: '#7d4614', vurguYazi: '#ffffff', su: '#35617a', birincilZemin: 'linear-gradient(160deg,#fdf1de,#fcfbfa)', birincilCizgi: '#e0c193', seciliZemin: '#e2ecd6', seciliCizgi: '#a8c088' }
  },
  'buz mavisi': {
    ust: '#1c2f36',
    koyu: { vurgu: '#7fc4d9', vurguKoyu: '#4e93aa', vurguYazi: '#0e1a1e', su: '#7fc4d9', birincilZemin: 'linear-gradient(160deg,#17272d,#1a1714)', birincilCizgi: '#2f4a53', seciliZemin: '#17272d', seciliCizgi: '#33565f' },
    acik: { vurgu: '#2f7d90', vurguKoyu: '#1f5f70', vurguYazi: '#ffffff', su: '#2f7d90', birincilZemin: 'linear-gradient(160deg,#e6f3f7,#fcfbfa)', birincilCizgi: '#b8dbe4', seciliZemin: '#dff0f4', seciliCizgi: '#a8cfd9' }
  },
  'açık yeşil': {
    ust: '#1e2f22',
    koyu: { vurgu: '#8fd28f', vurguKoyu: '#5fa563', vurguYazi: '#0f1a11', su: '#527e96', birincilZemin: 'linear-gradient(160deg,#1b2a1d,#1a1714)', birincilCizgi: '#33502f', seciliZemin: '#1b2a1d', seciliCizgi: '#3c5c39' },
    acik: { vurgu: '#3d8a4e', vurguKoyu: '#2e6c3c', vurguYazi: '#ffffff', su: '#35617a', birincilZemin: 'linear-gradient(160deg,#eaf7e8,#fcfbfa)', birincilCizgi: '#bfe0bd', seciliZemin: '#e2f2e0', seciliCizgi: '#a9d3a8' }
  },
  'mürekkep': {
    ust: '#1b2036',
    koyu: { vurgu: '#9aa8ee', vurguKoyu: '#6b79c9', vurguYazi: '#101223', su: '#7fc4d9', birincilZemin: 'linear-gradient(160deg,#1e2233,#1a1714)', birincilCizgi: '#3a4270', seciliZemin: '#1e2233', seciliCizgi: '#434b7d' },
    acik: { vurgu: '#40509b', vurguKoyu: '#2f3d7a', vurguYazi: '#ffffff', su: '#2f6f88', birincilZemin: 'linear-gradient(160deg,#e8ebf9,#fcfbfa)', birincilCizgi: '#c2c9ec', seciliZemin: '#e4e7f7', seciliCizgi: '#b3bce4' }
  },
  'zeytin + tuğla': {
    ust: '#2a2c1c',
    koyu: { vurgu: '#b7c06a', vurguKoyu: '#8e964c', vurguYazi: '#16180d', su: '#c25b49', birincilZemin: 'linear-gradient(160deg,#24261a,#1a1714)', birincilCizgi: '#4b5030', seciliZemin: '#2b1d19', seciliCizgi: '#5a332a' },
    acik: { vurgu: '#6b7233', vurguKoyu: '#545a26', vurguYazi: '#ffffff', su: '#a8412f', birincilZemin: 'linear-gradient(160deg,#f1f2e0,#fcfbfa)', birincilCizgi: '#d3d5a8', seciliZemin: '#f7e3dd', seciliCizgi: '#dda898' }
  },
  'gül kurusu': {
    ust: '#33202a',
    koyu: { vurgu: '#e09aa9', vurguKoyu: '#b96b7c', vurguYazi: '#1c1114', su: '#527e96', birincilZemin: 'linear-gradient(160deg,#2b1e22,#1a1714)', birincilCizgi: '#5c3a44', seciliZemin: '#2b1e22', seciliCizgi: '#653e4a' },
    acik: { vurgu: '#a1495c', vurguKoyu: '#83384a', vurguYazi: '#ffffff', su: '#35617a', birincilZemin: 'linear-gradient(160deg,#fbeaee,#fcfbfa)', birincilCizgi: '#eec6cf', seciliZemin: '#f7e6ea', seciliCizgi: '#e0b6c0' }
  },
  'bakır + buz': {
    ust: '#26201c',
    koyu: { vurgu: '#e0894a', vurguKoyu: '#b26a34', vurguYazi: '#1a1108', su: '#7fc4d9', birincilZemin: 'linear-gradient(160deg,#2b211a,#1a1714)', birincilCizgi: '#55381f', seciliZemin: '#16262c', seciliCizgi: '#2f4a53' },
    acik: { vurgu: '#b4571f', vurguKoyu: '#91431a', vurguYazi: '#ffffff', su: '#2f7d90', birincilZemin: 'linear-gradient(160deg,#fdeee0,#fcfbfa)', birincilCizgi: '#e8c19c', seciliZemin: '#dff0f4', seciliCizgi: '#a8cfd9' }
  },
  'orman + safran': {
    ust: '#182a22',
    koyu: { vurgu: '#6fb894', vurguKoyu: '#4a8f6f', vurguYazi: '#0d1a14', su: '#e0aa4a', birincilZemin: 'linear-gradient(160deg,#1a2721,#1a1714)', birincilCizgi: '#2f5241', seciliZemin: '#16241d', seciliCizgi: '#2c4636' },
    acik: { vurgu: '#2f6b4f', vurguKoyu: '#235340', vurguYazi: '#ffffff', su: '#c98a1e', birincilZemin: 'linear-gradient(160deg,#e8f2ec,#fcfbfa)', birincilCizgi: '#bcdcc9', seciliZemin: '#e2f0e8', seciliCizgi: '#a7ccb8' }
  }
};

// Haftanın gününe göre dönen sıra: pazartesi → pazar.
const DONGU = ['buz mavisi', 'açık yeşil', 'mürekkep', 'zeytin + tuğla',
  'gül kurusu', 'bakır + buz', 'orman + safran'];

// Seçenek listesi artık tek: haftanın günü.
//
// Sekiz adlı şema ve "gezinin günü" 17 Ağustos'ta kaldırıldı. Sekiz sabit
// isim, sınırsız renk seçebilen bir renk seçicisinin yanında anlamsız
// kalıyordu; "gezinin günü" ile "haftanın günü" ise aynı yedi rengi başka
// sırayla dönderiyordu ve aradaki farkı kimse fark etmiyordu.
//
// Geriye üç şey kaldı: haftanın yedi günü (sabit, değiştirilemez),
// kâğıdın rengi (js/tema.js) ve vurgu rengi (aşağıda) — son ikisi sınırsız.
export const SEMA_SECENEKLERI = [{ id: 'gun', ad: 'Haftanın günü' }];

const ANAHTAR = 'gerokSema';
const VURGU_ANAHTAR = 'gerokVurgu';

/** Elle seçilmiş vurgu rengi (hex) — boşsa haftanın günü geçerli. */
export function ozelVurgu() {
  try { return localStorage.getItem(VURGU_ANAHTAR) || ''; }
  catch { return ''; }
}

export function ozelVurguSec(hex, geziGunu = 0) {
  try { localStorage.setItem(VURGU_ANAHTAR, hex); } catch { /* yine de uygulanır */ }
  return semaUygula(semaSecimi(), geziGunu);
}

export function ozelVurguSil(geziGunu = 0) {
  try { localStorage.removeItem(VURGU_ANAHTAR); } catch { /* yoksay */ }
  return semaUygula(semaSecimi(), geziGunu);
}

/**
 * Tek bir renkten bütün vurgu ailesini üretir.
 *
 * Sabit şemalarda bu sekiz değer elle ayarlanmıştı; sınırsız renkte elle
 * ayarlama yok. En kritiği `vurguYazi` — vurgunun üstünde duran yazının
 * rengi. Parlak sarı bir vurgunun üstüne beyaz yazılınca düğme okunmuyor,
 * o yüzden rengin parlaklığına bakılıp siyah ya da beyaz seçiliyor.
 */
function ozelSema(hex, tema) {
  const ust = karistir(hex, tema === 'koyu' ? '#0d0b09' : '#141210', 0.80);
  return {
    ust,
    vurgu: hex,
    vurguKoyu: karistir(hex, '#000000', 0.24),
    vurguYazi: karsit(hex),
    su: hex,
    birincilZemin: `linear-gradient(160deg,color-mix(in srgb,${hex} 13%,var(--zemin)),var(--zemin))`,
    birincilCizgi: `color-mix(in srgb,${hex} 42%,var(--zemin))`,
    seciliZemin: `color-mix(in srgb,${hex} 12%,var(--zemin))`,
    seciliCizgi: `color-mix(in srgb,${hex} 38%,var(--zemin))`
  };
}

export function semaSecimi() {
  try { return localStorage.getItem(ANAHTAR) || 'gun'; }
  catch { return 'gun'; }
}

// Seçim adı → gerçekte kullanılacak şema adı.
// "gun" haftanın gününe, "gezi" gezinin kaçıncı gününde olduğumuza bakıyor.
export function cozulmusSema(secim = semaSecimi(), geziGunu = 0) {
  if (SEMALAR[secim]) return secim;
  if (secim === 'gezi') return DONGU[Math.abs(geziGunu) % DONGU.length];
  // Pazartesi 0 olsun: getDay() pazarı 0 sayıyor.
  return DONGU[(new Date().getDay() + 6) % 7];
}

// Şemayı belgeye yazıyor. Tema (koyu/acik) <html data-tema> içinden okunuyor —
// tema değiştiğinde bu yeniden çağrılmalı, yoksa vurgu eski temanın kalır.
export function semaUygula(secim = semaSecimi(), geziGunu = 0) {
  const tema = document.documentElement.dataset.tema === 'acik' ? 'acik' : 'koyu';
  const ozel = ozelVurgu();
  const ad = ozel ? ozel : cozulmusSema(secim, geziGunu);
  const sema = ozel ? ozelSema(ozel, tema) : (SEMALAR[ad] || SEMALAR['kahve']);
  const v = ozel ? sema : (sema[tema] || sema.acik);

  const kok = document.documentElement.style;
  kok.setProperty('--vurgu', v.vurgu);
  kok.setProperty('--vurgu-koyu', v.vurguKoyu);
  kok.setProperty('--vurgu-yazi', v.vurguYazi);
  kok.setProperty('--su', v.su);
  kok.setProperty('--birincil-zemin', v.birincilZemin);
  kok.setProperty('--birincil-cizgi', v.birincilCizgi);
  kok.setProperty('--secili-zemin', v.seciliZemin);
  kok.setProperty('--secili-cizgi', v.seciliCizgi);
  kok.setProperty('--ust-zemin', sema.ust);

  // Şeridin altındaki eriyiş. `transparent`e geçmek yetmiyor: Safari araya
  // saydam SİYAH koyuyor ve açık temada gri bir is çıkıyor. O yüzden aynı
  // rengin saydamı hesaplanıyor.
  const r = parseInt(sema.ust.slice(1, 3), 16);
  const g = parseInt(sema.ust.slice(3, 5), 16);
  const b = parseInt(sema.ust.slice(5, 7), 16);
  kok.setProperty('--ust-gradyan',
    `linear-gradient(180deg,${sema.ust} 0%,${sema.ust} 72%,` +
    `rgba(${r},${g},${b},.55) 88%,rgba(${r},${g},${b},0) 100%)`);

  return ad;
}

export function semaSec(secim, geziGunu = 0) {
  try { localStorage.setItem(ANAHTAR, secim); } catch { /* yazamazsak da uygulanır */ }
  return semaUygula(secim, geziGunu);
}
