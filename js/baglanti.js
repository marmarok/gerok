// Gerok — bağlantı: internetin YAPTIĞI işler.
//
// Uygulamanın kuralı değişmedi: Gerok internetsiz tam çalışır. Hiçbir kayıt,
// hiçbir ses, hiçbir fotoğraf buluta gitmiyor. İnternet burada bir gereklilik
// değil, bir TAMİR KUYRUĞU: çevrimdışıyken eksik kalan birkaç şey var, bağlantı
// bulununca onlar tamamlanıyor.
//
// Dört iş var:
//   kur    — harcamaları o günün gerçek kuruyla tek para birimine çevirir
//   yer    — koordinatı olup adı olmayan kayıtlara yer adı yazar
//   durak  — duraklara OpenStreetMap'ten tür, telefon, site, ücret bilgisi getirir
//   harita — rotanın önündeki harita paketini indirir
//
// Dışarı GİDEN tek şey: harcamaların para birimi kodları (MKD, EUR…), kayıtların
// koordinatları ve durakların koordinatları. Metin, ses, fotoğraf, isim — hiçbiri
// gitmiyor. Ne gittiği kullanıcıya da yazılı olarak söyleniyor.

import * as veri from './veri.js';
import * as gerok from './gerok.js';

// ---- Bağlantı durumu ------------------------------------------------------

// navigator.onLine yalnızca "ağa bağlı mı" der; otelin giriş sayfasına takılmış
// bir wi-fi'de de true döner. Gerçek cevap için küçük bir dosya çekiliyor.
let sonSinama = { an: 0, sonuc: false };

export async function agVarMi(zorla = false) {
  if (!navigator.onLine) { sonSinama = { an: Date.now(), sonuc: false }; return false; }
  // 20 saniye içinde tekrar sorulursa aynı cevabı ver: her panel çizilişinde
  // ağa gitmenin anlamı yok.
  if (!zorla && Date.now() - sonSinama.an < 20000) return sonSinama.sonuc;

  const dur = new AbortController();
  const zamanAsimi = setTimeout(() => dur.abort(), 6000);
  try {
    // Kendi sunucumuzdan küçük bir dosya: dışarıya bir şey söylememiş oluyoruz.
    await fetch(`./manifest.webmanifest?a=${Date.now()}`, { cache: 'no-store', signal: dur.signal });
    sonSinama = { an: Date.now(), sonuc: true };
  } catch {
    sonSinama = { an: Date.now(), sonuc: false };
  } finally {
    clearTimeout(zamanAsimi);
  }
  return sonSinama.sonuc;
}

// ---- Veri kipi ------------------------------------------------------------
//
// iPhone'da bir web uygulaması wi-fi ile mobil veriyi AYIRT EDEMİYOR — Safari
// böyle bir bilgi vermiyor. O yüzden tahmin etmiyoruz, soruyoruz: kullanıcı
// "wi-fi'deyim" ya da "mobil verideyim" diyor, uygulama onu hatırlıyor.
//
// Fark şurada: mobil veride yalnızca küçük işler (kur, yer, durak — toplamı
// birkaç yüz kilobayt) yapılıyor; yüzlerce megabaytlık harita paketi wi-fi
// bekliyor. Sürpriz fatura, gezinin en gereksiz sürprizi olurdu.

// Üç kip: wi-fi'de her şey, mobil veride kullanıcının verdiği izne göre.
// "mobilTam" ayrı bir kip çünkü izin BU BAĞLANTI BOYUNCA geçerli — kalıcı
// bir ayar değil, o anki karar.
export const KIPLER = {
  wifi: { ad: 'wi-fi', buyukIsler: true },
  mobil: { ad: 'mobil veri', buyukIsler: false },
  mobilTam: { ad: 'mobil veri', buyukIsler: true }
};

export async function veriKipi() { return veri.ayarOku('veriKipi', 'wifi'); }
export async function veriKipiYaz(kip) { await veri.ayarYaz('veriKipi', kip); }

// ---- Küçük yardımcılar ----------------------------------------------------

async function jsonAl(url, { yontem = 'GET', govde = null, sure = 15000, basliklar = {} } = {}) {
  const dur = new AbortController();
  const zamanAsimi = setTimeout(() => dur.abort(), sure);
  try {
    const y = await fetch(url, {
      method: yontem, body: govde, headers: basliklar,
      signal: dur.signal, cache: 'no-store'
    });
    if (!y.ok) throw new Error(`sunucu ${y.status}`);
    return await y.json();
  } finally {
    clearTimeout(zamanAsimi);
  }
}

function bekle(ms) { return new Promise(r => setTimeout(r, ms)); }

// =========================================================== 1) KUR =========
//
// Harcamalar altı ülkede altı para biriminde tutuluyor ve kur çevirmesi
// yapılmıyordu: "489 EUR + 12 400 MKD + 3 200 ALL" gibi bir toplam, gezinin
// gerçekte kaça mal olduğunu söylemiyor.
//
// Doğru çeviri BUGÜNÜN kuruyla değil, HARCAMANIN YAPILDIĞI GÜNÜN kuruyla olur —
// bir haftada kur birkaç yüzde oynayabiliyor. Bu yüzden her harcamanın kendi
// tarihindeki kur ayrı ayrı çekiliyor ve kaydın içine yazılıyor. Bir kez
// yazıldıktan sonra bir daha internet gerekmiyor.
//
// Kaynak: @fawazahmed0/currency-api — anahtarsız, ücretsiz, tarihli ve
// Balkan para birimlerini (MKD, ALL, RSD, BAM) kapsıyor.

const KUR_TABAN = 'eur';          // hedef para birimi
const KUR_ADRES = (tarih) =>
  `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${tarih}/v1/currencies/${KUR_TABAN}.json`;
const KUR_YEDEK = (tarih) =>
  `https://${tarih}.currency-api.pages.dev/v1/currencies/${KUR_TABAN}.json`;

function tarihAnahtari(t) {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Çekilen kurlar ayarlarda saklanıyor: aynı günün kuru iki kez indirilmesin.
async function kurTablosu(tarih, onbellek) {
  if (onbellek[tarih]) return onbellek[tarih];
  let j = null;
  try { j = await jsonAl(KUR_ADRES(tarih)); }
  catch { j = await jsonAl(KUR_YEDEK(tarih)); }
  const tablo = j?.[KUR_TABAN];
  if (!tablo) throw new Error('kur tablosu boş geldi');
  onbellek[tarih] = tablo;
  return tablo;
}

/** Kuru yazılmamış harcamalar. */
export async function kurBekleyenler() {
  const turId = gerok.aktifGerok()?.id ?? null;
  const kayitlar = await veri.kayitlariGetir(turId);
  return kayitlar.filter(k =>
    k.tur === 'fiyat' && k.tutar && k.paraBirimi && k.euro == null);
}

export async function kurlariDuzelt(ilerleme = null) {
  const bekleyen = await kurBekleyenler();
  if (!bekleyen.length) return { yapilan: 0, mesaj: 'Bütün harcamaların kuru zaten yazılı.' };

  const onbellek = await veri.ayarOku('kurOnbellek', {});
  const { tutarSayi } = await import('./app.js');
  let yapilan = 0, atlanan = 0;

  // Tarihe göre öbekle: aynı günün kuru bir kez indirilsin.
  const gunler = new Map();
  for (const k of bekleyen) {
    const g = tarihAnahtari(k.t);
    if (!gunler.has(g)) gunler.set(g, []);
    gunler.get(g).push(k);
  }

  let i = 0;
  for (const [tarih, liste] of gunler) {
    ilerleme?.(++i, gunler.size);
    let tablo;
    try { tablo = await kurTablosu(tarih, onbellek); }
    catch { atlanan += liste.length; continue; }

    for (const k of liste) {
      const kod = String(k.paraBirimi).trim().toLowerCase();
      const oran = tablo[kod];
      // Tanınmayan bir para birimi ("TL" yerine "lira" yazılmışsa) sessizce
      // atlanıyor — uydurma bir kurla toplam vermek en kötüsü olurdu.
      if (!oran) { atlanan++; continue; }
      const miktar = tutarSayi(k.tutar);
      if (!miktar) { atlanan++; continue; }
      await veri.kayitEkle({ ...k, euro: miktar / oran, kurTarihi: tarih, kurOrani: oran });
      yapilan++;
    }
  }

  await veri.ayarYaz('kurOnbellek', onbellek);
  const mesaj = yapilan
    ? `${yapilan} harcamanın kuru düzeldi` +
      (atlanan ? ` · ${atlanan} tanesi çevrilemedi` : '')
    : 'Hiçbiri çevrilemedi — para birimi kodlarına bak (MKD, EUR, ALL gibi olmalı)';
  return { yapilan, atlanan, mesaj };
}

// ========================================================== 2) YER ==========
//
// Koordinatı olan ama adı olmayan kayıtlar. On yıl sonra haritadaki iğneye
// bakıp "burası neresiydi" diye sorulacak; cevabı olsun.
//
// Kaynak: Nominatim (OpenStreetMap). Saniyede bir istek kuralı var, ona
// uyuluyor. Giden tek şey koordinat.

const YER_ADRES = (lat, lon) =>
  `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}` +
  `&zoom=16&accept-language=tr`;

export async function yerBekleyenler() {
  const turId = gerok.aktifGerok()?.id ?? null;
  const kayitlar = await veri.kayitlariGetir(turId);
  return kayitlar.filter(k => k.lat != null && k.lon != null && !k.yerAdi);
}

// Nominatim'in uzun adresinden okunur bir satır çıkarıyor:
// "Крст Џамија, Ohri, Општина Охрид, 6000, Kuzey Makedonya" → "Ohri, Kuzey Makedonya"
function yerAdiSadelestir(j) {
  const a = j?.address || {};
  const yerlesim = a.city || a.town || a.village || a.suburb || a.municipality || a.county;
  const bina = j?.name || a.tourism || a.amenity || a.road;
  const ulke = a.country;
  return [bina, yerlesim, ulke].filter(Boolean).filter((v, i, d) => d.indexOf(v) === i).join(', ');
}

export async function yerAdlariniGetir(ilerleme = null) {
  const bekleyen = await yerBekleyenler();
  if (!bekleyen.length) return { yapilan: 0, mesaj: 'Konumu olan bütün kayıtların yer adı zaten yazılı.' };

  // Aynı noktaya birden çok kayıt düşmüş olabilir — 100 metrelik kutuya
  // yuvarlayıp bir kez soruyoruz. 40 kayıt için 40 istek yerine 6 istek.
  const kutu = (k) => `${k.lat.toFixed(3)},${k.lon.toFixed(3)}`;
  const obekler = new Map();
  for (const k of bekleyen) {
    const a = kutu(k);
    if (!obekler.has(a)) obekler.set(a, []);
    obekler.get(a).push(k);
  }

  let yapilan = 0, atlanan = 0, i = 0, sonAd = '';
  for (const [, liste] of obekler) {
    ilerleme?.(++i, obekler.size);
    const ilk = liste[0];
    let ad = '';
    try {
      const j = await jsonAl(YER_ADRES(ilk.lat, ilk.lon));
      ad = yerAdiSadelestir(j);
    } catch { atlanan += liste.length; }
    // Nominatim'in kuralı: saniyede en fazla bir istek.
    await bekle(1100);
    if (!ad) { continue; }
    for (const k of liste) {
      await veri.kayitEkle({ ...k, yerAdi: ad });
      yapilan++; sonAd = ad;
    }
  }

  // Tek kayıt çözüldüyse adın kendisini söylüyor: "Struga, kanal ağzı".
  // Kullanıcının görmek istediği sayı değil, yerin adı.
  const mesaj = yapilan === 1 && sonAd
    ? sonAd
    : yapilan
      ? `${yapilan} kayda yer adı yazıldı${atlanan ? ` · ${atlanan} tanesi çözülemedi` : ''}`
      : 'Hiçbir yer adı çözülemedi — bağlantı zayıf olabilir, sonra tekrar dene';
  return { yapilan, atlanan, mesaj };
}

// ======================================================== 3) DURAK ==========
//
// Duraklara OpenStreetMap'ten bilgi getiriyor: ne tür bir yer, açılış saati,
// ücretli mi, telefon, site. Bölgeye göre bu bilgilerin ne kadarının OSM'de
// olduğu değişiyor — bulunanı yazıyoruz, bulunmayanı uydurmuyoruz.
//
// Kaynak: Overpass API. Ana sunucu sık sık meşgul döndüğü için birden fazla
// ayna sırayla deneniyor.

const OVERPASS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter'
];

export function durakBekleyenler() {
  return gerok.duraklar().filter(d => d.lat != null && d.lon != null && !d.osmBilgi);
}

// Overpass'ın ana sunucusu sık sık "meşgul" dönüyor (denerken üç istekten
// biri böyle çıktı). Üç ayna sırayla deneniyor; her birine 12 saniye. Daha
// uzun beklemek, kuyruğu bir durakta dakikalarca asılı bırakıyordu.
async function overpassSor(sorgu) {
  let sonHata = null;
  for (const sunucu of OVERPASS) {
    try {
      return await jsonAl(sunucu, {
        yontem: 'POST', sure: 12000,
        govde: 'data=' + encodeURIComponent(sorgu),
        basliklar: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
    } catch (h) { sonHata = h; }
  }
  throw sonHata || new Error('Overpass sunucularının hiçbiri cevap vermedi');
}

// OSM etiketlerinden tek satır insan cümlesi.
const TUR_ADI = {
  monastery: 'manastır', place_of_worship: 'ibadet yeri', museum: 'müze',
  gallery: 'galeri', attraction: 'gezilecek yer', viewpoint: 'seyir noktası',
  castle: 'kale', fort: 'hisar', city_gate: 'şehir kapısı', ruins: 'kalıntı',
  archaeological_site: 'antik yer', memorial: 'anıt', monument: 'anıt',
  church: 'kilise', mosque: 'cami', chapel: 'şapel', tomb: 'türbe',
  theatre: 'tiyatro', restaurant: 'lokanta', cafe: 'kahve', hotel: 'otel',
  information: 'danışma', artwork: 'eser', ferry_terminal: 'iskele',
  camp_site: 'kamp alanı', spring: 'kaynak', waterfall: 'şelale'
};

// Yalnızca TÜR bilmek işe yaramıyor: bir durağın altında "anıt" yazması
// kimseye bir şey söylemiyor — zaten oraya anıt görmeye gidiliyor. Satırın
// yazılması için işe yarar en az bir şey olmalı: saat, ücret, telefon ya da
// site. Yoksa "bilgi yok" demek daha dürüst.
function isYararBilgi(t) {
  return !!(t.opening_hours || t.fee || t.charge ||
            t.phone || t['contact:phone'] ||
            t.website || t['contact:website']);
}

function osmSatiri(etiket) {
  if (!isYararBilgi(etiket)) return '';
  const parca = [];
  const tur = etiket.tourism || etiket.historic || etiket.amenity || etiket.natural;
  if (tur && tur !== 'yes') parca.push(TUR_ADI[tur] || tur.replace(/_/g, ' '));
  if (etiket.opening_hours) parca.push(etiket.opening_hours);
  if (etiket.fee === 'yes') parca.push(etiket.charge ? `ücretli · ${etiket.charge}` : 'ücretli');
  else if (etiket.fee === 'no') parca.push('ücretsiz');
  else if (etiket.charge) parca.push(etiket.charge);
  if (etiket.phone || etiket['contact:phone']) parca.push(etiket.phone || etiket['contact:phone']);
  if (etiket.website || etiket['contact:website']) parca.push(etiket.website || etiket['contact:website']);
  return parca.join(' · ');
}

// Kiril → Latin. Balkanlar'da OSM adlarının çoğu Kiril; durak adları Latin
// yazılıyor. Karşılaştırma yapılabilmesi için ikisi aynı alfabeye çekiliyor.
const KIRIL = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', ѓ: 'g', ђ: 'd', е: 'e', ж: 'z',
  з: 'z', ѕ: 'dz', и: 'i', ј: 'j', к: 'k', л: 'l', љ: 'lj', м: 'm', н: 'n',
  њ: 'nj', о: 'o', п: 'p', р: 'r', с: 's', т: 't', ќ: 'k', ћ: 'c', у: 'u',
  ф: 'f', х: 'h', ц: 'c', ч: 'c', џ: 'dz', ш: 's', й: 'i', ы: 'i', э: 'e',
  ю: 'yu', я: 'ya', щ: 'st', ъ: 'a', ь: ''
};

// Adın "kim olduğunu" söylemeyen genel kelimeler. Durak adında "Manastırı"
// yazması, OSM'de de yazacağı anlamına gelmiyor — karşılaştırmadan çıkıyorlar.
const GENEL_KELIMELER = new Set([
  'manastir', 'manastiri', 'kilise', 'kilisesi', 'cami', 'camii', 'kale',
  'kalesi', 'muze', 'muzesi', 'tiyatro', 'tiyatrosu', 'antik', 'antique',
  'anitl', 'anit', 'aniti', 'koprusu', 'kopru', 'carsi', 'carsisi',
  'monastery', 'church', 'castle', 'museum', 'theatre', 'theater', 'ancient',
  'gallery', 'sveti', 'sv', 'st', 'saint', 'holy', 'the', 'of', 'na', 'i'
]);

function adSadele(s) {
  return String(s || '')
    .toLocaleLowerCase('tr')
    .replace(/[Ѐ-ӿ]/g, c => KIRIL[c] ?? c)     // Kiril → Latin
    .normalize('NFD').replace(/[̀-ͯ]/g, '')     // aksanları at
    .replace(/[ıİ]/g, 'i').replace(/[şŞ]/g, 's').replace(/[ğĞ]/g, 'g')
    .replace(/[çÇ]/g, 'c').replace(/[üÜ]/g, 'u').replace(/[öÖ]/g, 'o')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

function ayirtEdiciKelimeler(ad) {
  return adSadele(ad).split(' ')
    .filter(k => k.length >= 3 && !GENEL_KELIMELER.has(k));
}

/**
 * Durağın adıyla GERÇEKTEN eşleşen OSM nesnesini seçer.
 *
 * Burada bir kez yanlış yaptım ve sonucu görünce anladım neden önemli:
 * "Sveti Naum Manastırı"na 350 metre ötedeki OTELİN bilgisi, "Ohrid Antik
 * Tiyatro"ya da yandaki ikon galerisinin açılış saati bağlanmıştı. Yani
 * uygulama, gidilecek yerin yanlış saatini yazıyordu. Kapalı bir kapıya
 * gitmek, hiç bilgi olmamasından kötü.
 *
 * Kural bu yüzden sert: AD TUTMUYORSA hiçbir şey yazılmaz. Ad tutan birden
 * fazla aday varsa gezilecek yer olanlar (manastır, müze, kalıntı) tercih
 * ediliyor; otel, lokanta, iskele gibi "yanındaki hizmetler" eleniyor.
 */
const GEZILECEK = new Set(['monastery', 'museum', 'gallery', 'attraction', 'viewpoint',
  'artwork', 'castle', 'fort', 'ruins', 'archaeological_site', 'memorial',
  'monument', 'church', 'chapel', 'tomb', 'place_of_worship', 'theatre', 'city_gate']);
const HIZMET = new Set(['hotel', 'hostel', 'guest_house', 'restaurant', 'cafe', 'bar',
  'fast_food', 'ferry_terminal', 'camp_site', 'parking', 'toilets', 'shop']);

function enUygunu(elemanlar, durakAdi) {
  const hedefKelimeler = ayirtEdiciKelimeler(durakAdi);
  if (!hedefKelimeler.length) return null;

  const adlariniAl = (t) => [t.name, t['name:en'], t['name:tr'], t['name:mk'],
    t.int_name, t.alt_name, t.official_name].filter(Boolean);

  // ŞEHİR ADI AYIRT EDİCİ DEĞİLDİR — ama tamamen atılamaz da.
  //
  // "Ohrid Antik Tiyatro" ararken çevredeki her şeyin adında "Ohrid" geçiyor:
  // müze müdürlüğü, kilise, iskele… Denerken tiyatroya "Ohri Kültür
  // Anıtlarını Koruma Enstitüsü"nün sitesi bağlandı, tek sebebi buydu.
  //
  // İlk denemede yaygın kelimeleri hepten attım; bu kez DOĞRU eşleşmeler de
  // gitti ("Sveta Sofija" ile "Црква Света Софија" arasındaki bağ koptu,
  // çünkü Ohri'de "sveta" ile başlayan beş kilise var). Doğrusu atmak değil
  // TARTMAK: bir kelime ne kadar çok yerde geçiyorsa o kadar az şey söyler.
  // Civarda tek bir yerde geçen kelime 1 puan, beş yerde geçen 0,2 puan.
  const siklik = new Map();
  for (const e of elemanlar) {
    const gorulen = new Set();
    for (const a of adlariniAl(e.tags || {})) {
      for (const k of ayirtEdiciKelimeler(a)) gorulen.add(k);
    }
    for (const k of gorulen) siklik.set(k, (siklik.get(k) || 0) + 1);
  }
  const agirlik = (k) => 1 / Math.max(1, siklik.get(k) || 1);

  // Eşleşme sayılması için gereken en az puan. 0,5 demek: en az bir kelime
  // civarda en çok İKİ yerde geçiyor olmalı. Yalnızca şehir adının tutması
  // (altı yerde geçer → 0,17) yetmiyor.
  const ESIK = 0.5;

  const adaylar = [];
  for (const e of elemanlar) {
    const t = e.tags || {};
    if (!osmSatiri(t)) continue;

    // Durağın adıyla ortak olan kelimelerin toplam ağırlığı.
    let ortak = 0;
    for (const a of adlariniAl(t)) {
      const k = ayirtEdiciKelimeler(a);
      let toplam = 0;
      for (const h of hedefKelimeler) {
        const tutan = k.some(x => h === x ||
          (h.length >= 5 && x.length >= 5 && (h.startsWith(x) || x.startsWith(h))));
        if (tutan) toplam += agirlik(h);
      }
      ortak = Math.max(ortak, toplam);
    }
    // AD TUTMUYORSA aday değil. Yakınlık tek başına yeterli sayılmıyor.
    if (ortak < ESIK) continue;

    const tur = t.tourism || t.historic || t.amenity || '';
    let p = ortak * 60;
    if (GEZILECEK.has(tur)) p += 30;
    if (HIZMET.has(tur)) p -= 45;
    if (t.opening_hours) p += 8;
    if (t.fee) p += 5;
    if (t.website || t.phone) p += 3;
    adaylar.push({ e, p, ortak });
  }

  if (!adaylar.length) return null;
  adaylar.sort((a, b) => b.p - a.p);

  // Kalan en iyi aday bir "hizmet"se (otel, lokanta, pansiyon) iki durum var:
  //
  //  · Durak bir manastırsa ve yanındaki lokanta tuttuysa — bu yanlış.
  //    Ohri'de tam bunu gördüm: OSM'de anıtların saati yok, lokantalarınki var,
  //    ve isim benzerliği yüzünden lokantanın saati manastıra yazılıyordu.
  //
  //  · Ama durağın KENDİSİ bir lokanta ya da otel olabilir — insan haritadan
  //    böyle bir yeri de durak yapıyor. O zaman bilgi tam da istenen şey.
  //
  // Ayıran şey adın ne kadar sağlam tuttuğu: civarda tek bir yerde geçen bir
  // kelimeyle eşleşiyorsa (ağırlık 1) o yerin kendisidir; zayıf bir benzerlikse
  // yanındaki bir şeydir.
  const enIyi = adaylar[0];
  const tur = enIyi.e.tags.tourism || enIyi.e.tags.historic || enIyi.e.tags.amenity || '';
  if (HIZMET.has(tur) && !GEZILECEK.has(tur) && enIyi.ortak < 1) return null;
  return enIyi.e;
}

// İki nokta arası kaba mesafe (metre). Toplu sorgunun sonuçlarını duraklara
// dağıtmak için yeter; hassas hesap gerekmiyor.
function metre(lat1, lon1, lat2, lon2) {
  const R = 6371000, d = Math.PI / 180;
  const x = (lon2 - lon1) * d * Math.cos((lat1 + lat2) * d / 2);
  const y = (lat2 - lat1) * d;
  return Math.sqrt(x * x + y * y) * R;
}

const YARICAP = 350;              // durak çevresinde kaç metre bakılıyor
const OBEK = 12;                  // tek sorguda kaç durak

export async function durakBilgileriniGetir(ilerleme = null) {
  const bekleyen = durakBekleyenler();
  if (!bekleyen.length) return { yapilan: 0, mesaj: 'Bütün durakların bilgisi zaten getirilmiş.' };

  // Her durak için ayrı istek atmak çok yavaştı: dört durak bir dakikayı
  // geçiyordu, otuz duraklık bir gezide on dakika sürerdi. Overpass birden
  // çok "around" cümlesini tek sorguda kabul ediyor; gelen nesneler sonra
  // en yakın durağa dağıtılıyor. Otuz durak, üç istek.
  const obekler = [];
  for (let i = 0; i < bekleyen.length; i += OBEK) obekler.push(bekleyen.slice(i, i + OBEK));

  let yapilan = 0, bossuz = 0;
  for (let o = 0; o < obekler.length; o++) {
    const obek = obekler[o];
    ilerleme?.(o + 1, obekler.length);

    let elemanlar = [];
    try {
      const sorgu = `[out:json][timeout:60];(` +
        obek.map(d => `nwr(around:${YARICAP},${d.lat},${d.lon})["name"];`).join('') +
        `);out tags center;`;
      const j = await overpassSor(sorgu);
      elemanlar = j.elements || [];
    } catch { continue; }        // bu öbek atlandı, kuyrukta kalsın

    for (const d of obek) {
      // Nesneyi durağa bağlayan şey yakınlık: yarıçapın dışındakiler bu
      // durağın adayı değil.
      const yakin = elemanlar.filter(e => {
        const lat = e.lat ?? e.center?.lat, lon = e.lon ?? e.center?.lon;
        return lat != null && metre(d.lat, d.lon, lat, lon) <= YARICAP;
      });
      const e = enUygunu(yakin, d.ad);
      // Bulunan nesnenin ADI da yazılıyor — ve bu bir süs değil.
      //
      // Denerken üç kez üst üste yanlış eşleşme çıktı: "Sveti Naum
      // Manastırı"na 300 m ötedeki OTELİN, sonra aynı adı taşıyan FERİBOT
      // HATTININ bilgisi bağlandı; "Ohrid Antik Tiyatro"ya yandaki ikon
      // galerisinin açılış saati. Eşleştirmeyi sıkılaştırdım ama bu tür
      // yanılmayı tamamen bitirmenin yolu yok: aynı bölgede aynı adı taşıyan
      // beş şey olabiliyor.
      //
      // O yüzden kaynağı SAKLAMIYORUZ, gösteriyoruz. "Свети Наум (iskele) ·
      // ücretli" satırını gören kişi bunun manastır olmadığını hemen anlıyor.
      // Gizlenmiş bir yanlış, görünen bir yanlıştan çok daha tehlikeli.
      const osmAd = e ? (e.tags['name:tr'] || e.tags['name:en'] || e.tags.name || '') : '';
      const govde = e ? osmSatiri(e.tags) : '';
      const satir = govde ? (osmAd ? `${osmAd} · ${govde}` : govde) : '';
      // Bilgi bulunamasa da işaretliyoruz: aynı durak her seferinde
      // yeniden sorulup kuyruğu tıkamasın.
      await gerok.durakBilgiYaz(d.id, satir || '—');
      if (satir) yapilan++; else bossuz++;
    }
    // Overpass'ı yormamak için öbekler arasında kısa bir es.
    if (o < obekler.length - 1) await bekle(1200);
  }

  const mesaj = yapilan
    ? `${yapilan} durak güncellendi${bossuz ? ` · ${bossuz} durak için kayıt yok` : ''}`
    : 'Bu duraklar için OpenStreetMap\'te açılış/ücret bilgisi yok. Uydurmuyoruz.';
  return { yapilan, bossuz, mesaj };
}

// ======================================================= 4) HARİTA =========
//
// Harita paketi zaten Gerok → bu telefon'dan indiriliyor; buradaki iş onu
// kuyruğun bir parçası yapıyor: bir eksik varsa bağlantı panelinde görünsün.

export async function haritaBekliyorMu() {
  const { haritaVarMi } = await import('./harita.js');
  return !(await haritaVarMi());
}

// ======================================================== KUYRUK ============

export const ISLER = [
  {
    k: 'kur',
    ad: 'Kurları düzelt',
    notYaz: (n) => `${n} harcama · her biri kendi günündeki kurla`,
    buyuk: false,
    bekleyen: async () => (await kurBekleyenler()).length,
    calistir: kurlariDuzelt
  },
  {
    k: 'yer',
    ad: 'Konumsuz kayıtlara yer adı ver',
    notYaz: (n) => `${n} kayıt · koordinat var, ad yok`,
    buyuk: false,
    bekleyen: async () => (await yerBekleyenler()).length,
    calistir: yerAdlariniGetir
  },
  {
    k: 'durak',
    ad: 'Duraklara açılış ve ücret bilgisi',
    notYaz: (n) => `${n} durak · saat, ücret, kapalı gün`,
    buyuk: false,
    bekleyen: async () => durakBekleyenler().length,
    calistir: durakBilgileriniGetir
  },
  {
    k: 'harita',
    ad: 'Rotanın önündeki haritayı indir',
    notYaz: () => 'Rotanın kalanı · wi-fi bekler',
    // Mobil veride reddedilirken boyutu söyleyebilmek için: "Bu iş" demek
    // yerine kaç megabayt olduğunu söylüyor.
    boyutYazi: 'Harita paketi',
    buyuk: true,
    bekleyen: async () => (await haritaBekliyorMu()) ? 1 : 0,
    calistir: null            // arayüz kendi indirme akışını açıyor
  }
];

/** Kuyruğun o anki hâli: her iş için kaç şey bekliyor. */
export async function kuyrukDurumu() {
  const kip = await veriKipi();
  const buyukIsler = KIPLER[kip]?.buyukIsler !== false;

  const satirlar = [];
  for (const i of ISLER) {
    let sayi = 0;
    try { sayi = await i.bekleyen(); } catch { sayi = 0; }
    satirlar.push({
      ...i, sayi,
      // Not metni sayıyı içeriyor; sayı değişince not da değişiyor.
      not: i.notYaz ? i.notYaz(sayi) : i.not,
      // Mobil veride büyük iş yapılmıyor: sürpriz fatura gezinin en
      // gereksiz sürprizi olurdu.
      engelli: i.buyuk && !buyukIsler
    });
  }
  return { kip, satirlar, bekleyenToplam: satirlar.reduce((t, s) => t + s.sayi, 0) };
}
