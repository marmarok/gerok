// Gerok — dosya deposu.
//
// Ses kayıtları, fotoğraf önizlemeleri ve 357 MB'lık harita burada durur.
//
// NEDEN İKİ YOL VAR: OPFS'in `createWritable` yöntemini Safari'nin desteklediği
// kesin değil — bir kaynağa göre desteklenmiyor, başka bir kaynağa göre 2025'te
// geldi. Telefonda sınayamadığımız için tek yola bel bağlamıyoruz: OPFS varsa
// o kullanılır, yoksa IndexedDB'ye düşülür. İkisi de aynı arayüzü verir.

let secilenYol = null;      // 'opfs' | 'idb'
let idbDb = null;

// ---- Yol seçimi -----------------------------------------------------------

async function opfsYazabiliyorMu() {
  try {
    if (!navigator.storage?.getDirectory) return false;
    const kok = await navigator.storage.getDirectory();
    const deneme = await kok.getDirectoryHandle('.deneme', { create: true });
    const dosya = await deneme.getFileHandle('yaz.tmp', { create: true });
    if (typeof dosya.createWritable !== 'function') return false;

    const yazici = await dosya.createWritable();
    await yazici.write(new Blob(['gerok']));
    await yazici.close();

    const geri = await (await deneme.getFileHandle('yaz.tmp')).getFile();
    const dogru = geri.size === 5;

    await deneme.removeEntry('yaz.tmp');
    await kok.removeEntry('.deneme', { recursive: true });
    return dogru;
  } catch {
    return false;
  }
}

export async function yolSec() {
  if (secilenYol) return secilenYol;
  secilenYol = await opfsYazabiliyorMu() ? 'opfs' : 'idb';
  return secilenYol;
}

export function kullanilanYol() { return secilenYol; }

// ---- IndexedDB yolu -------------------------------------------------------

function idbAc() {
  if (idbDb) return Promise.resolve(idbDb);
  return new Promise((tamam, hata) => {
    const istek = indexedDB.open('gerok-dosyalar', 1);
    istek.onupgradeneeded = (e) => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains('dosyalar')) {
        d.createObjectStore('dosyalar', { keyPath: 'yol' });
      }
    };
    istek.onsuccess = () => { idbDb = istek.result; tamam(idbDb); };
    istek.onerror = () => hata(istek.error);
  });
}

function idbIstek(istek) {
  return new Promise((tamam, hata) => {
    istek.onsuccess = () => tamam(istek.result);
    istek.onerror = () => hata(istek.error);
  });
}

// ---- OPFS yolu ------------------------------------------------------------

async function opfsKlasor(ad) {
  const kok = await navigator.storage.getDirectory();
  return kok.getDirectoryHandle(ad, { create: true });
}

// ---- Ortak arayüz ---------------------------------------------------------

/**
 * Dosya yazar. `parcalar` tek bir Blob ya da Blob dizisi olabilir;
 * dizi verilirse parçalar sırayla eklenir (harita böyle iniyor).
 */
export async function yaz(klasor, ad, parcalar) {
  await yolSec();
  const dizi = Array.isArray(parcalar) ? parcalar : [parcalar];

  if (secilenYol === 'opfs') {
    const k = await opfsKlasor(klasor);
    const tutamac = await k.getFileHandle(ad, { create: true });
    const yazici = await tutamac.createWritable();
    try {
      for (const p of dizi) await yazici.write(p);
      await yazici.close();
    } catch (hata) {
      try { await yazici.close(); } catch { /* zaten kapalı */ }
      try { await k.removeEntry(ad); } catch { /* yoktu */ }
      throw hata;
    }
    return (await (await k.getFileHandle(ad)).getFile()).size;
  }

  // IndexedDB: parçaları tek Blob'a bağla. Blob'lar disk destekli olduğu için
  // bu birleştirme belleğe 357 MB yüklemez, yalnızca referans tutar.
  const blob = new Blob(dizi);
  const d = await idbAc();
  const t = d.transaction(['dosyalar'], 'readwrite');
  await idbIstek(t.objectStore('dosyalar').put({ yol: `${klasor}/${ad}`, blob, boyut: blob.size }));
  return blob.size;
}

/**
 * Var olan dosyanın SONUNA ekler; dosya yoksa oluşturur.
 *
 * Ses kaydı sürerken her üç saniyede bir parça geliyor. `yaz` ile her seferinde
 * biriken sesin tamamını baştan yazmak, on dakikalık bir ortam sesinde aynı
 * on megabaytı iki yüz kez diske basmak demek olurdu. Ekleme, yalnızca yeni
 * gelen parçayı yazıyor.
 */
export async function ekle(klasor, ad, parca) {
  await yolSec();

  if (secilenYol === 'opfs') {
    const k = await opfsKlasor(klasor);
    const tutamac = await k.getFileHandle(ad, { create: true });
    const eski = (await tutamac.getFile()).size;
    const yazici = await tutamac.createWritable({ keepExistingData: true });
    await yazici.seek(eski);
    await yazici.write(parca);
    await yazici.close();
    return eski + parca.size;
  }

  // IndexedDB yolunda ekleme yok: eskisini okuyup yenisiyle birleştiriyoruz.
  // Blob birleştirme referans tutar, belleğe kopya çıkarmaz.
  const eski = await oku(klasor, ad);
  return yaz(klasor, ad, eski ? [eski, parca] : [parca]);
}

/** Dosyayı Blob olarak döner (yoksa null). Blob.slice ile parça parça okunabilir. */
export async function oku(klasor, ad) {
  await yolSec();

  if (secilenYol === 'opfs') {
    try {
      const k = await opfsKlasor(klasor);
      return await (await k.getFileHandle(ad)).getFile();
    } catch {
      return null;
    }
  }

  const d = await idbAc();
  const kayit = await idbIstek(d.transaction(['dosyalar']).objectStore('dosyalar').get(`${klasor}/${ad}`));
  return kayit?.blob || null;
}

export async function boyut(klasor, ad) {
  const b = await oku(klasor, ad);
  return b ? b.size : 0;
}

export async function sil(klasor, ad) {
  await yolSec();

  if (secilenYol === 'opfs') {
    try {
      const k = await opfsKlasor(klasor);
      await k.removeEntry(ad);
    } catch { /* yoksa sorun değil */ }
    return;
  }

  const d = await idbAc();
  const t = d.transaction(['dosyalar'], 'readwrite');
  await idbIstek(t.objectStore('dosyalar').delete(`${klasor}/${ad}`));
}

/**
 * Dosyayı çalınabilir/gösterilebilir bir adrese çevirir.
 *
 * `tur` VERİLMEZSE OPFS'ten gelen dosyanın MIME türü boştur — OPFS içerik türü
 * saklamıyor. Safari türü olmayan bir blob adresinden sesi çözemiyor: oynat
 * düğmesi çalışıyor gibi görünüyor ama ses çıkmıyor, saniye ilerlemiyor.
 * (Fotoğraflarda sorun çıkmıyordu, tarayıcı görüntüyü baytlarından tanıyor.)
 * Bu yüzden ses kaydının kendi `bicim` alanı buraya geçiriliyor.
 */
export async function url(klasor, ad, tur = null) {
  const b = await oku(klasor, ad);
  if (!b) return null;
  const dogru = tur && b.type !== tur ? new Blob([b], { type: tur }) : b;
  return URL.createObjectURL(dogru);
}
