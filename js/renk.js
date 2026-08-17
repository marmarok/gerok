// Gerok — renk hesapları.
//
// Kâğıdın rengi ve vurgu rengi artık sabit listeden değil, renk seçicisinden
// geliyor: sınırsız. Ama seçilen tek bir renkten bütün bir palet üretmek
// gerekiyor — kat, çizgi, yazı, soluk yazı. Bu dosya o hesapları yapıyor.
//
// Hepsi sRGB üzerinde düz karışım. Doğru olan OKLCH'te karıştırmak ama
// burada karıştırılan şey zaten aynı ailenin tonları; gözle bakıldığında
// fark yok, karşılığında hesap okunur kalıyor.

export function hexRgb(h) {
  const s = h.replace('#', '');
  const t = s.length === 3 ? s.split('').map(c => c + c).join('') : s;
  return [0, 2, 4].map(i => parseInt(t.slice(i, i + 2), 16));
}

export function rgbHex([r, g, b]) {
  return '#' + [r, g, b].map(n =>
    Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')).join('');
}

/** İki rengi karıştırır. `oran` 0 → a, 1 → b. */
export function karistir(a, b, oran) {
  const [r1, g1, b1] = hexRgb(a), [r2, g2, b2] = hexRgb(b);
  return rgbHex([r1 + (r2 - r1) * oran, g1 + (g2 - g1) * oran, b1 + (b2 - b1) * oran]);
}

/** Algılanan parlaklık, 0–1. Yeşile insan gözü daha duyarlı; ağırlıklar ondan. */
export function parlaklik(h) {
  const [r, g, b] = hexRgb(h).map(n => n / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Bu renk açık mı?
 *
 * Eşik 0.45, ortadaki 0.5 değil: 0.5'in hemen altındaki griler "koyu tema"
 * sayılıp üstlerine beyaz yazı gelince okunmuyordu. Kararsız bölgede açık
 * temaya kaymak daha güvenli — koyu yazı her zeminde okunuyor.
 */
export function acikMi(h) { return parlaklik(h) > 0.45; }

/** Bu rengin üstüne yazılacak yazının rengi. */
export function karsit(h) { return acikMi(h) ? '#161310' : '#ffffff'; }
