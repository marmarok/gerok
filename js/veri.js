// Gerok — veri katmanı.
// Her şey telefonun içinde durur: IndexedDB'de kayıtlar, OPFS'te ses ve önizleme dosyaları.
// Hiçbir sunucuya bağlanmaz.

const DB_ADI = 'gerok';
const DB_SURUM = 1;

let db = null;

export const TURLER = {
  ses: 'Sesli not',
  ortam: 'Ortam sesi',
  yazi: 'Yazı',
  isaret: 'Buradayım',
  foto: 'Fotoğraf',
  video: 'Video',
  kisi: 'Tanıştığımız kişi',
  fiyat: 'Harcama',
  gunluk: 'Akşam günlüğü',
  siradan: 'Sıradan kare',
  baslangic: 'Başlangıç kaydı',
  bitis: 'Bitiş kaydı',
  mektup: 'Mühürlü mektup',
  sinir: 'Sınır geçişi'
};

export function ac() {
  if (db) return Promise.resolve(db);
  return new Promise((tamam, hata) => {
    const istek = indexedDB.open(DB_ADI, DB_SURUM);

    istek.onupgradeneeded = (e) => {
      const d = e.target.result;

      if (!d.objectStoreNames.contains('kayitlar')) {
        const s = d.createObjectStore('kayitlar', { keyPath: 'id' });
        s.createIndex('t', 't');
        s.createIndex('tur', 'tur');
        s.createIndex('gun', 'gun');
      }
      if (!d.objectStoreNames.contains('iz')) {
        const s = d.createObjectStore('iz', { keyPath: 'id' });
        s.createIndex('t', 't');
      }
      if (!d.objectStoreNames.contains('duraklar')) {
        d.createObjectStore('duraklar', { keyPath: 'id' });
      }
      if (!d.objectStoreNames.contains('ayarlar')) {
        d.createObjectStore('ayarlar', { keyPath: 'anahtar' });
      }
      if (!d.objectStoreNames.contains('gerok')) {
        d.createObjectStore('gerok', { keyPath: 'id' });
      }
    };

    istek.onsuccess = () => { db = istek.result; tamam(db); };
    istek.onerror = () => hata(istek.error);
  });
}

function islem(depolar, mod) {
  return db.transaction(depolar, mod);
}

function sarmala(istek) {
  return new Promise((tamam, hata) => {
    istek.onsuccess = () => tamam(istek.result);
    istek.onerror = () => hata(istek.error);
  });
}

// ---- Kayıtlar -------------------------------------------------------------

export async function kayitEkle(kayit) {
  await ac();
  const t = islem(['kayitlar'], 'readwrite');
  await sarmala(t.objectStore('kayitlar').put(kayit));
  return kayit;
}

export async function kayitSil(id) {
  await ac();
  const t = islem(['kayitlar'], 'readwrite');
  await sarmala(t.objectStore('kayitlar').delete(id));
}

export async function kayitGetir(id) {
  await ac();
  return sarmala(islem(['kayitlar']).objectStore('kayitlar').get(id));
}

// gerokId verilirse yalnızca o tura ait kayıtlar döner. Hiç verilmezse hepsi.
// Bir turu arşivleyip yenisine geçince eski turun kayıtları duruyor ama
// ekranlara karışmıyor — ayıran şey bu süzgeç.
export async function kayitlariGetir(gerokId = undefined) {
  await ac();
  const hepsi = await sarmala(islem(['kayitlar']).objectStore('kayitlar').getAll());
  const duranlar = hepsi.filter(k => !k.silindi);
  const secilen = gerokId === undefined
    ? duranlar
    : duranlar.filter(k => (k.gerokId ?? null) === gerokId);
  return secilen.sort((a, b) => a.t - b.t);
}

// Hiçbir tura bağlanmamış ya da artık var olmayan bir turu gösteren kayıtlar.
// Bunlar hiçbir ekranda görünmez; panelde sayısı yazılıp taşınabiliyorlar —
// veri sessizce kaybolmuş gibi durmasın diye.
export async function oksuzKayitlar(gecerliIdler) {
  const hepsi = await kayitlariGetir();
  return hepsi.filter(k => !gecerliIdler.includes(k.gerokId ?? null));
}

export async function kayitlariTuraTasi(kayitlar, gerokId) {
  for (const k of kayitlar) await kayitEkle({ ...k, gerokId });
  return kayitlar.length;
}

// Silinmişler dahil. Eşitleme buna bakıyor: silinen bir kayıt karşı taraftan
// gelen paketle geri dirilmesin diye kimliğinin burada durması gerekiyor.
export async function tumKayitlar() {
  await ac();
  return sarmala(islem(['kayitlar']).objectStore('kayitlar').getAll());
}

// Bizde hiç olmayan ama karşı tarafta silinmiş bir kaydın kimliğini işaretler:
// o kayıt başka bir paketten gelirse bir daha diriltilmesin.
export async function mezarTasiYaz(id, silinme = Date.now()) {
  await kayitEkle({ id, silindi: true, silinme, t: 0, tur: 'silindi' });
}

// Kaydı siler: ses/önizleme dosyası gider, geriye yalnızca "bu silindi" notu
// kalır. Not kalmasa aynı kayıt akşam eşitlemesinde arkadaşından geri gelirdi.
export async function kayitYokEt(id) {
  const k = await kayitGetir(id);
  if (!k) return null;
  if (k.medyaId) await medyaSil(k.medyaId).catch(() => {});
  await kayitEkle({
    id: k.id, tur: k.tur, t: k.t, gun: k.gun,
    gerokId: k.gerokId, sahip: k.sahip,
    silindi: true, silinme: Date.now()
  });
  return k;
}

// ---- İz (GPS nokta dizisi) ------------------------------------------------

export async function izEkle(nokta) {
  await ac();
  const t = islem(['iz'], 'readwrite');
  await sarmala(t.objectStore('iz').put(nokta));
}

export async function izEkleToplu(noktalar) {
  await ac();
  const t = islem(['iz'], 'readwrite');
  const s = t.objectStore('iz');
  for (const n of noktalar) s.put(n);
  return new Promise((tamam, hata) => {
    t.oncomplete = tamam;
    t.onerror = () => hata(t.error);
  });
}

export async function izGetir(gerokId = undefined) {
  await ac();
  const hepsi = await sarmala(islem(['iz']).objectStore('iz').getAll());
  const secilen = gerokId === undefined
    ? hepsi
    : hepsi.filter(n => (n.gerokId ?? null) === gerokId);
  return secilen.sort((a, b) => a.t - b.t);
}

// Bir turun bütün izini siler — tur silinirken kullanılıyor.
export async function izSil(gerokId) {
  await ac();
  const hepsi = await sarmala(islem(['iz']).objectStore('iz').getAll());
  const gidecekler = hepsi.filter(n => (n.gerokId ?? null) === gerokId);
  const t = islem(['iz'], 'readwrite');
  const s = t.objectStore('iz');
  for (const n of gidecekler) s.delete(n.id);
  await new Promise((tamam, hata) => { t.oncomplete = tamam; t.onerror = () => hata(t.error); });
  return gidecekler.length;
}

// Verilen ana en yakın iz noktasını bulur.
// Fotoğrafın GPS'i silinmiş olsa bile saatinden yerini çıkarmamızı sağlayan şey bu.
export function izdenKonum(iz, zaman, enFazlaFarkMs = 15 * 60 * 1000) {
  if (!iz.length) return null;

  let alt = 0, ust = iz.length - 1;
  while (alt < ust) {
    const orta = (alt + ust) >> 1;
    if (iz[orta].t < zaman) alt = orta + 1; else ust = orta;
  }

  const adaylar = [iz[alt - 1], iz[alt]].filter(Boolean);
  let enIyi = null, enIyiFark = Infinity;
  for (const a of adaylar) {
    const fark = Math.abs(a.t - zaman);
    if (fark < enIyiFark) { enIyi = a; enIyiFark = fark; }
  }
  if (!enIyi || enIyiFark > enFazlaFarkMs) return null;

  // İki nokta arasındaysa aradaki yeri oransal olarak hesapla.
  const onceki = iz[alt - 1], sonraki = iz[alt];
  if (onceki && sonraki && zaman >= onceki.t && zaman <= sonraki.t && sonraki.t > onceki.t) {
    const oran = (zaman - onceki.t) / (sonraki.t - onceki.t);
    return {
      lat: onceki.lat + (sonraki.lat - onceki.lat) * oran,
      lon: onceki.lon + (sonraki.lon - onceki.lon) * oran,
      fark: enIyiFark
    };
  }
  return { lat: enIyi.lat, lon: enIyi.lon, fark: enIyiFark };
}

// ---- Duraklar (gittik / kaçırdık durumu) ----------------------------------

// Bir durağın üstüne yazılan her şey TEK nesnede duruyor: gittik/kaçırdık
// işareti ve unutma listesinin işaretlenmiş maddeleri. Ayrı kayıtlara
// bölünseydi eşitlemede biri ötekini silerdi — iki telefon birleşirken
// karşılaştırılan şey kaydın tamamı, en yenisi kazanıyor.
async function durakYamala(id, yama) {
  await ac();
  const eski = await sarmala(islem(['duraklar']).objectStore('duraklar').get(id));
  const t = islem(['duraklar'], 'readwrite');
  await sarmala(t.objectStore('duraklar')
    .put({ ...(eski || {}), ...yama, id, guncelleme: Date.now() }));
}

export const durakDurumuYaz = (id, durum) => durakYamala(id, { durum });
export const durakTikleriYaz = (id, tikler) => durakYamala(id, { tikler });

export async function durakDurumlari() {
  await ac();
  const hepsi = await sarmala(islem(['duraklar']).objectStore('duraklar').getAll());
  return Object.fromEntries(hepsi.map(d => [d.id, d]));
}

// ---- Ayarlar --------------------------------------------------------------

export async function ayarYaz(anahtar, deger) {
  await ac();
  const t = islem(['ayarlar'], 'readwrite');
  await sarmala(t.objectStore('ayarlar').put({ anahtar, deger }));
}

export async function ayarOku(anahtar, varsayilan = null) {
  await ac();
  const k = await sarmala(islem(['ayarlar']).objectStore('ayarlar').get(anahtar));
  return k ? k.deger : varsayilan;
}

// ---- Gerok paketi ---------------------------------------------------------

export async function gerokYaz(gerok) {
  await ac();
  const t = islem(['gerok'], 'readwrite');
  await sarmala(t.objectStore('gerok').put(gerok));
}

export async function gerokOku(id) {
  await ac();
  return sarmala(islem(['gerok']).objectStore('gerok').get(id));
}

export async function geroklar() {
  await ac();
  return sarmala(islem(['gerok']).objectStore('gerok').getAll());
}

export async function gerokSil(id) {
  await ac();
  const t = islem(['gerok'], 'readwrite');
  await sarmala(t.objectStore('gerok').delete(id));
}

// Bir turun bütün kayıtlarını, ses/görsel dosyalarıyla birlikte yok eder.
// Mezar taşı BIRAKMIYOR: tur tamamen gidiyor, eşitlemede geri gelecek bir
// karşılığı da kalmıyor.
export async function turunKayitlariniSil(gerokId) {
  await ac();
  const hepsi = await sarmala(islem(['kayitlar']).objectStore('kayitlar').getAll());
  const gidecekler = hepsi.filter(k => (k.gerokId ?? null) === gerokId);
  for (const k of gidecekler) {
    if (k.medyaId) await medyaSil(k.medyaId).catch(() => {});
    await kayitSil(k.id);
  }
  return gidecekler.length;
}

/**
 * Verilen kimlik kümesinin DIŞINDA kalan kayıtları ve iz noktalarını siler.
 *
 * TEK KULLANIM YERİ: "yedekten geri yükle → değiştir".
 *
 * NEDEN "HEPSİNİ SİL" DEĞİL: ilk yazdığım hâli önce her şeyi siliyor, sonra
 * yedeği yüklüyordu. Tarayıcıda sınarken yedek dosyası doğrulamadan geçmedi
 * ve sıra silmeden sonra koptu: her şey gitti, yerine hiçbir şey gelmedi.
 * Gezi verisinin yedeği yok — bu, olabilecek en kötü sonuç.
 *
 * Doğru sıra: ÖNCE yedek birleştirilir (birleştirme hiçbir şeyi silmez),
 * ancak o başarılı olduktan SONRA fazlası temizlenir. Böylece hiçbir anda
 * veri boş kalmıyor; birleştirme hata verirse tek bir kayıt bile silinmiyor.
 *
 * Geziler ve duraklar bilerek dokunulmuyor: onlar programdan geliyor,
 * kullanıcının yazdığı şey değil ve silinmeleri kimseye bir şey kazandırmaz.
 */
export async function disindakileriSil(kalacakKayitlar, kalacakIz) {
  await ac();
  const kayitlar = await sarmala(islem(['kayitlar']).objectStore('kayitlar').getAll());
  let silinen = 0;
  for (const k of kayitlar) {
    if (kalacakKayitlar.has(k.id)) continue;
    if (k.medyaId) await medyaSil(k.medyaId).catch(() => {});
    await kayitSil(k.id);
    silinen++;
  }
  if (kalacakIz) {
    const iz = await sarmala(islem(['iz']).objectStore('iz').getAll());
    const d = islem(['iz'], 'readwrite').objectStore('iz');
    for (const n of iz) if (!kalacakIz.has(n.id)) d.delete(n.id);
  }
  return silinen;
}

// ---- Medya deposu ---------------------------------------------------------
// Ses kayıtları ve fotoğraf önizlemeleri. Hangi depolama yolunun kullanıldığına
// depo.js karar veriyor (OPFS ya da IndexedDB) — bkz. oradaki açıklama.

import * as depo from './depo.js';

export const medyaYaz = (id, blob) => depo.yaz('medya', id, blob);
export const medyaOku = (id) => depo.oku('medya', id);
export const medyaSil = (id) => depo.sil('medya', id);
export const medyaEkle = (id, blob) => depo.ekle('medya', id, blob);
// tur: kaydın `bicim` alanı (ör. 'audio/mp4'). Bkz. depo.url — türsüz blob
// adresinden Safari ses çalmıyor.
export const medyaUrl = (id, tur = null) => depo.url('medya', id, tur);

// ---- Depolama sağlığı -----------------------------------------------------

// Ana ekrana eklenmiş bir web uygulamasında iOS kalıcı depolama verir; istemezsek
// yer daraldığında verimizi silebilir. Kurulumda bir kez istiyoruz.
export async function kaliciDepolamaIste() {
  if (!navigator.storage?.persist) return { destek: false };
  const zatenVar = await navigator.storage.persisted();
  if (zatenVar) return { destek: true, kalici: true };
  const verildi = await navigator.storage.persist();
  return { destek: true, kalici: verildi };
}

/**
 * Depo durumu.
 *
 * DİKKAT — `kota` TELEFONUN BOŞ ALANI DEĞİL. `navigator.storage.estimate()`
 * tarayıcının BU SİTEYE ayırdığı payı söylüyor; iOS bunu diskin doluluğundan
 * ayrı bir formülle hesaplıyor. 512 GB'lık, 7 GB boşu kalmış bir telefonda
 * buradan 37 GB dönebiliyor — ikisi ayrı şeyler ve bir web uygulamasının
 * gerçek disk boşluğunu öğrenmesinin yolu yok.
 *
 * Bu yüzden ekranda "Boş yer" değil "Gerok'a kalan yer" yazıyor: 17 Ağustos'ta
 * telefon 504/512 GB doluyken burası 37.8 GB gösteriyordu ve yanlış anlaşıldı.
 */
export async function depolamaDurumu() {
  if (!navigator.storage?.estimate) return null;
  const t = await navigator.storage.estimate();
  return {
    kullanilan: t.usage || 0,
    kota: t.quota || 0,
    kalici: navigator.storage.persisted ? await navigator.storage.persisted() : false
  };
}

// ---- Yardımcılar ----------------------------------------------------------

export function yeniKimlik(onEk = 'k') {
  const rastgele = crypto.getRandomValues(new Uint8Array(8));
  const onalti = Array.from(rastgele, b => b.toString(16).padStart(2, '0')).join('');
  return `${onEk}_${Date.now().toString(36)}_${onalti}`;
}
