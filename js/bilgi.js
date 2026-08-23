/**
 * Durak bilgisi ve sözlük — bekçinin "bilgili" yarısı.
 *
 * Bekçi uygulamayı öğretiyordu; bu dosya ona GEZİYİ öğretiyor: her durak için
 * ne görülür, ne yenir, ne alınır, başka gezginler ne söylemiş, Türkiye'ye
 * göre fiyat nerede duruyor. Hepsi cihazda, internetsiz.
 *
 * PAKET ROTAYI DEĞİL BÖLGEYİ TAŞIYOR. Kaynak dosya herkese açık bir dalda
 * duruyor ve altı ülkenin tanınmış yerlerini toplu hâlde içeriyor; hangisinin
 * senin durağın olduğu bilgisi PAKETTE YOK. Eşleştirme burada, bu cihazda,
 * koordinat ve ad yakınlığıyla yapılıyor. Dışarıdan bakan biri sıradan bir
 * Balkan rehberi görüyor — rota dışarı çıkmıyor.
 *
 * SÖZLÜK: bekçinin kullandığı her terimin karşılığı pakette duruyor ve
 * cevaplarda kendiliğinden işaretleniyor. Bilmediği bir kelimeyi kullanıp
 * geçmesin diye: dokunduğun terim açıklanıyor.
 */

import * as veri from './veri.js';

const ADRES = 'https://raw.githubusercontent.com/marmarok/gerok/bekci/bilgi.json';

let paket = null;
let terimDuzeni = null;          // sözlük regex'i — bir kez kuruluyor

const kacis = (m) => String(m ?? '').replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// --------------------------------------------------------------- yükleme ---

/** Cihazdaki kopya. İnternet yokken de bilgi duruyor. */
export async function yukle() {
  if (paket) return paket;
  paket = await veri.ayarOku('bekciBilgi', null);
  if (paket?.bicim !== 1) paket = null;
  terimDuzeni = null;
  return paket;
}

/**
 * Yeni paket var mı diye bak. Sürüm aynıysa hiçbir şey yazılmıyor —
 * her açılışta 100 KB'ı yeniden kaydetmek boşuna aşınma olurdu.
 */
export async function tazele({ zorla = false } = {}) {
  await yukle();
  if (!navigator.onLine) return { durum: 'internet-yok', paket };
  try {
    const y = await fetch(`${ADRES}?t=${Date.now()}`, { cache: 'no-store' });
    if (!y.ok) return { durum: 'ulasilamadi', paket };
    const d = await y.json();
    if (d?.bicim !== 1 || !Array.isArray(d.yerler)) return { durum: 'bozuk', paket };
    if (!zorla && paket && paket.surum === d.surum) return { durum: 'ayni', paket };
    const oncekiYer = paket?.yerler?.length || 0;
    paket = d;
    terimDuzeni = null;
    await veri.ayarYaz('bekciBilgi', d);
    await veri.ayarYaz('bekciBilgiZaman', Date.now());
    return { durum: 'yeni', paket, eklenen: d.yerler.length - oncekiYer };
  } catch {
    return { durum: 'ulasilamadi', paket };
  }
}

export function paketVar() { return !!paket; }
export function sayilar() { return paket?.sayilar || null; }
export function yerler() { return paket?.yerler || []; }

// ------------------------------------------------------------ eşleştirme ---

/** Türkçe duyarlı sadeleştirme. `bilgi.py`deki `_sade` ile aynı kural. */
function sade(m) {
  let x = String(m ?? '').replace(/İ/g, 'i').replace(/I/g, 'ı').toLocaleLowerCase('tr');
  // Harfler tek tek karşılanıyor. NFKD ile ayırmak yetmiyordu: ı ve đ
  // ayrışmıyor, silinip boşluk oluyor ve "çarşısı" → "cars s" gibi bir şeye
  // dönüşüyordu. Çizelge `bilgi.py`deki `_sade` ile birebir aynı olmak
  // zorunda; bir kontrol her koşuda ikisini karşılaştırıyor.
  const harf = { 'ı': 'i', 'ğ': 'g', 'ü': 'u', 'ş': 's', 'ö': 'o', 'ç': 'c',
                 'â': 'a', 'î': 'i', 'û': 'u', 'đ': 'd', 'ć': 'c', 'č': 'c',
                 'ž': 'z', 'š': 's', 'ë': 'e', 'á': 'a', 'é': 'e' };
  x = x.replace(/[^a-z0-9 ]/g, (c) => harf[c] ?? ' ');
  return x.replace(/\s+/g, ' ').trim();
}

function uzaklik(aLat, aLon, bLat, bLon) {
  const x = (aLat - bLat) * 111320;
  const y = (aLon - bLon) * 111320 * Math.cos(aLat * Math.PI / 180);
  return Math.hypot(x, y);
}

/**
 * Bir durağa en uygun kart.
 *
 * Kural Mac tarafındaki `bilgi.py` ile AYNI olmak zorunda: ikisi ayrılırsa
 * Mac "bu durak kapsandı" derken telefon "bilgi yok" gösterir ve eksik
 * kartlar hiç fark edilmez.
 */
export function kartBul(durak) {
  if (!paket || !durak) return null;
  const ad = sade(durak.ad);
  let enIyi = null, enIyiPuan = 0;
  for (const y of paket.yerler) {
    const adlar = [sade(y.ad), ...(y.eslesme || []).map(sade)];
    let puan = 0;
    for (const a of adlar) {
      if (!a) continue;
      // Uzun eşleşme daha belirgin: "İskender Bey Meydanı, Tiran" hem "tiran"
      // hem "iskender bey" kartına uyuyor; meydanın kartı kazanmalı.
      if (a === ad) puan = Math.max(puan, 100 + a.length);
      else if (a.includes(ad) || ad.includes(a)) puan = Math.max(puan, 70 + a.length / 2);
    }
    if (durak.lat != null && durak.lon != null) {
      const u = uzaklik(durak.lat, durak.lon, y.lat, y.lon);
      if (u <= (y.yaricap || 5000)) puan = Math.max(puan, 60 - u / 1000);
    }
    // Eşitlikte dar yarıçap kazanıyor — dar olan daha belirgin yerdir.
    if (puan > enIyiPuan
        || (puan === enIyiPuan && enIyi && (y.yaricap || 5000) < (enIyi.yaricap || 5000))) {
      enIyi = y; enIyiPuan = puan;
    }
  }
  return enIyiPuan >= 40 ? enIyi : null;
}

export function kartAl(id) { return paket?.yerler.find(y => y.id === id) || null; }
export function ulkeAl(kod) { return paket?.ulkeler.find(u => u.kod === kod) || null; }

/** Serbest metinden yer bulma — "mostarda ne yenir" gibi cümleler için. */
export function yerAra(metin) {
  if (!paket) return [];
  const m = sade(metin);
  if (!m) return [];
  const bulunan = [];
  for (const y of paket.yerler) {
    const adlar = [sade(y.ad), ...(y.eslesme || []).map(sade)];
    let puan = 0;
    for (const a of adlar) {
      if (a.length < 3) continue;
      if (m === a) puan = Math.max(puan, 100 + a.length);
      // Kelime başından eşleşme: "mostarda" içindeki "mostar" tutsun.
      else if (new RegExp(`(^|\\s)${a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(m)) {
        puan = Math.max(puan, 60 + a.length);
      }
    }
    if (puan) bulunan.push({ yer: y, puan });
  }
  return bulunan.sort((a, b) => b.puan - a.puan).slice(0, 4);
}

/** Cümlenin hangi bölümü sorduğu: yemek mi, alışveriş mi, tarih mi. */
const BOLUM_ANAHTAR = {
  ye: ['ne yenir', 'yemek', 'ye', 'yenir', 'aç', 'lokanta', 'restoran', 'kahvaltı',
       'iç', 'içecek', 'kahve', 'tatlı', 'mutfak', 'yiyecek'],
  al: ['ne alınır', 'alışveriş', 'al', 'alınır', 'hediye', 'hediyelik', 'satın',
       'suvenir', 'çarşı', 'pazar', 'fiyat', 'ucuz', 'pahalı'],
  gez: ['gez', 'görülecek', 'gezilecek', 'ne var', 'görmeli', 'yer', 'müze', 'gezi'],
  gezgin: ['gezgin', 'yorum', 'tavsiye', 'öneri', 'ipucu', 'deneyim', 'tecrübe',
           'diğerleri', 'başkaları', 'ne diyor'],
  dikkat: ['dikkat', 'uyarı', 'tuzak', 'kandır', 'tehlike', 'sorun', 'riski'],
  tarih: ['tarih', 'geçmiş', 'hikâye', 'hikaye', 'ne zaman', 'kim yaptı', 'kuruldu'],
  turkiye: ['türkiye', 'kıyas', 'karşılaştır', 'tl', 'lira', 'bize göre'],
};

export function bolumBul(metin) {
  const m = sade(metin);
  let enIyi = null, enIyiPuan = 0;
  for (const [bolum, kelimeler] of Object.entries(BOLUM_ANAHTAR)) {
    for (const k of kelimeler) {
      const s = sade(k);
      if (!m.includes(s)) continue;
      const puan = s.includes(' ') ? 5 + s.length : (m.split(' ').includes(s) ? 3 : 1);
      if (puan > enIyiPuan) { enIyi = bolum; enIyiPuan = puan; }
    }
  }
  return enIyiPuan >= 3 ? enIyi : null;
}

// ---------------------------------------------------------------- sözlük ---

export function terimAl(ad) {
  if (!paket?.sozluk) return null;
  const s = paket.sozluk;
  if (s[ad]) return { ad, ...s[ad] };
  const dogru = Object.keys(s).find(k => sade(k) === sade(ad));
  return dogru ? { ad: dogru, ...s[dogru] } : null;
}

export function terimler() { return paket?.sozluk ? Object.keys(paket.sozluk) : []; }

/**
 * Sözlük düzeni. Uzun terim önce sıralanıyor ki "ortam sesi" gibi çok
 * kelimeli olanlar tek kelimeliye yenilmesin.
 *
 * KISA TERİM KURALI: dört harften kısa terimler (iz, han) yalnızca tam kelime
 * olarak eşleşiyor. Yoksa "iz" her "izin", "izle", "biz" içinde yakalanır ve
 * cevap işaretlerle dolar.
 */
function duzenKur() {
  if (terimDuzeni || !paket?.sozluk) return terimDuzeni;
  const kacir = (m) => m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const adlar = Object.keys(paket.sozluk).sort((a, b) => b.length - a.length);
  const parca = adlar.map(a => {
    const g = kacir(a);
    return a.length < 4 ? `${g}(?![a-zçğıöşü])` : `${g}[a-zçğıöşü']{0,6}(?![a-zçğıöşü])`;
  });
  terimDuzeni = new RegExp(`(?<![a-zçğıöşüA-ZÇĞİÖŞÜ])(${parca.join('|')})`, 'gi');
  return terimDuzeni;
}

/**
 * Cevabın içindeki bilinen terimleri dokunulabilir hâle getiriyor.
 *
 * Yalnızca METİN parçalarına bakıyor: etiketlerin içine girip `<b class=…>`
 * gibi bir yeri bozmuyor. Her terim bir cevapta EN FAZLA BİR KEZ
 * işaretleniyor — yoksa paragraf altı çizili kelime yığınına dönüyor.
 */
export function terimleriIsaretle(html) {
  const d = duzenKur();
  if (!d) return html;
  const gorulen = new Set();
  return String(html).split(/(<[^>]*>)/).map(parca => {
    if (parca.startsWith('<')) return parca;
    return parca.replace(d, (tam) => {
      const t = terimAl(tam) || terimAl(tam.replace(/[a-zçğıöşü']{1,6}$/i, ''));
      if (!t || gorulen.has(t.ad)) return tam;
      gorulen.add(t.ad);
      return `<button class="bk-terim" data-terim="${kacis(t.ad)}">${kacis(tam)}</button>`;
    });
  }).join('');
}

/** Bir metinde geçen terimlerin listesi — "detaylandır" bunu kullanıyor. */
export function gecenTerimler(html) {
  const d = duzenKur();
  if (!d) return [];
  const duz = String(html).replace(/<[^>]*>/g, ' ');
  const bulunan = [];
  for (const tam of duz.match(d) || []) {
    const t = terimAl(tam) || terimAl(tam.replace(/[a-zçğıöşü']{1,6}$/i, ''));
    if (t && !bulunan.some(x => x.ad === t.ad)) bulunan.push(t);
  }
  return bulunan;
}

// ----------------------------------------------------------------- çizim ---

const satirlar = (liste, ciz) =>
  (liste || []).map(x => `<div class="bk-madde">${ciz(x)}</div>`).join('');

export const BOLUM_ADI = {
  gez: 'Ne görülür', ye: 'Ne yenir', al: 'Ne alınır',
  gezgin: 'Gezginler ne diyor', dikkat: 'Dikkat', tarih: 'Tarihi',
  turkiye: 'Türkiye’ye göre',
};

/** Tek bölümün gövdesi. Boşsa null döner — boş başlık yazmıyoruz. */
export function bolumHtml(yer, bolum) {
  if (!yer) return null;
  const v = yer[bolum];
  if (!v || (Array.isArray(v) && !v.length)) return null;

  if (bolum === 'gez') {
    return satirlar(v, g => `<b>${kacis(g.ad)}</b>`
      + (g.sure ? ` <span class="bk-soluk">· ${kacis(g.sure)}</span>` : '')
      + (g.fiyat ? ` <span class="bk-soluk">· ${kacis(g.fiyat)}</span>` : '')
      + (g.not ? `<br><span class="bk-soluk">${kacis(g.not)}</span>` : ''));
  }
  if (bolum === 'ye') {
    return satirlar(v, x => `<b>${kacis(x.ad)}</b>`
      + (x.fiyat ? ` <span class="bk-fiyat">${kacis(x.fiyat)}</span>` : '')
      + (x.ne ? `<br>${kacis(x.ne)}` : '')
      + (x.not ? `<br><span class="bk-soluk">${kacis(x.not)}</span>` : ''));
  }
  if (bolum === 'al') {
    return satirlar(v, x => `<b>${kacis(x.ad)}</b>`
      + (x.fiyat ? ` <span class="bk-fiyat">${kacis(x.fiyat)}</span>` : '')
      + (x.ne ? `<br>${kacis(x.ne)}` : '')
      + (x.dikkat ? `<br><span class="bk-dikkat">${kacis(x.dikkat)}</span>` : ''));
  }
  if (Array.isArray(v)) return satirlar(v, x => kacis(x));
  return kacis(v);
}

/** Kartın giriş yüzü: bir cümle özet ve neden önemli olduğu. */
export function ozetHtml(yer) {
  return `<b>${kacis(yer.ad)}</b><br><span class="bk-soluk">${kacis(yer.ozet)}</span>`
       + `<br><br>${kacis(yer.neden)}`;
}

/** Ülke kartı — para, dil, birkaç kelime, fiyat çizelgesi. */
export function ulkeHtml(u) {
  if (!u) return null;
  return `<b>${kacis(u.ad)}</b><br><span class="bk-soluk">${kacis(u.baskent)}</span><br><br>`
    + `<b>Para</b><br>${kacis(u.para.ad)} (${kacis(u.para.kod)}) · ${kacis(u.para.kur)}<br>`
    + `<span class="bk-soluk">${kacis(u.para.nakit)}</span><br><br>`
    + `<b>Dil</b><br>${kacis(u.dil)}<br><br>`
    + `<b>Birkaç kelime</b><br>`
    + (u.sozler || []).map(([tr, ye]) => `${kacis(tr)} — <b>${kacis(ye)}</b>`).join('<br>')
    + `<br><br><b>Ne kaça</b><br>`
    + (u.fiyat || []).map(([n, f]) => `${kacis(n)} <span class="bk-fiyat">${kacis(f)}</span>`).join('<br>')
    + `<br><br><b>Türkiye’ye göre</b><br>${kacis(u.turkiye)}`
    + ((u.dikkat || []).length ? `<br><br><b>Dikkat</b><br>${satirlar(u.dikkat, x => kacis(x))}` : '')
    + (u.tuvalet ? `<br><b>Tuvalet</b> ${kacis(u.tuvalet)}` : '')
    + (u.internet ? `<br><b>İnternet</b> ${kacis(u.internet)}` : '');
}

/** Kartta gerçekten dolu olan bölümler — boş düğme göstermemek için. */
export function doluBolumler(yer) {
  return Object.keys(BOLUM_ADI).filter(b => bolumHtml(yer, b));
}
