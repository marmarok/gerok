// Sefer — veri katmanı.
// Her şey telefonun içinde durur: IndexedDB'de kayıtlar, OPFS'te ses ve önizleme dosyaları.
// Hiçbir sunucuya bağlanmaz.

const DB_ADI = 'sefer';
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
  fiyat: 'Fiyat',
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
      if (!d.objectStoreNames.contains('sefer')) {
        d.createObjectStore('sefer', { keyPath: 'id' });
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

export async function kayitlariGetir() {
  await ac();
  const hepsi = await sarmala(islem(['kayitlar']).objectStore('kayitlar').getAll());
  return hepsi.filter(k => !k.silindi).sort((a, b) => a.t - b.t);
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

export async function izGetir() {
  await ac();
  const hepsi = await sarmala(islem(['iz']).objectStore('iz').getAll());
  return hepsi.sort((a, b) => a.t - b.t);
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

export async function durakDurumuYaz(id, durum) {
  await ac();
  const t = islem(['duraklar'], 'readwrite');
  await sarmala(t.objectStore('duraklar').put({ id, durum, guncelleme: Date.now() }));
}

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

// ---- Sefer paketi ---------------------------------------------------------

export async function seferYaz(sefer) {
  await ac();
  const t = islem(['sefer'], 'readwrite');
  await sarmala(t.objectStore('sefer').put(sefer));
}

export async function seferOku(id) {
  await ac();
  return sarmala(islem(['sefer']).objectStore('sefer').get(id));
}

export async function seferler() {
  await ac();
  return sarmala(islem(['sefer']).objectStore('sefer').getAll());
}

// ---- Medya deposu (OPFS) --------------------------------------------------
// Ses ve fotoğraf önizlemeleri IndexedDB yerine dosya sisteminde durur:
// büyük ikili veride hem daha hızlı hem tarayıcı temizliğine karşı daha dayanıklı.

async function medyaKlasoru() {
  const kok = await navigator.storage.getDirectory();
  return kok.getDirectoryHandle('medya', { create: true });
}

export async function medyaYaz(id, blob) {
  const klasor = await medyaKlasoru();
  const dosya = await klasor.getFileHandle(id, { create: true });
  const yazici = await dosya.createWritable();
  await yazici.write(blob);
  await yazici.close();
  return id;
}

export async function medyaOku(id) {
  try {
    const klasor = await medyaKlasoru();
    const dosya = await klasor.getFileHandle(id);
    return await dosya.getFile();
  } catch {
    return null;
  }
}

export async function medyaSil(id) {
  try {
    const klasor = await medyaKlasoru();
    await klasor.removeEntry(id);
  } catch { /* yoksa sorun değil */ }
}

export async function medyaUrl(id) {
  const dosya = await medyaOku(id);
  return dosya ? URL.createObjectURL(dosya) : null;
}

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
