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
    // Deneme dosyasının adı HER SEFERİNDE BAŞKA. Sabit bir ad ("yaz.tmp")
    // kullanılıyordu ve aynı anda çalışan iki deneme birbirinin dosyasını
    // siliyordu (bkz. yolSec'teki not).
    const ad = `yaz-${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`;
    const dosya = await deneme.getFileHandle(ad, { create: true });
    if (typeof dosya.createWritable !== 'function') return false;

    const yazici = await dosya.createWritable();
    await yazici.write(new Blob(['gerok']));
    await yazici.close();

    const geri = await (await deneme.getFileHandle(ad)).getFile();
    const dogru = geri.size === 5;

    // Yalnızca kendi dosyamızı siliyoruz; klasörü silmek başkasınınkini de
    // götürüyordu.
    await deneme.removeEntry(ad).catch(() => {});
    return dogru;
  } catch {
    return false;
  }
}

/**
 * Hangi depo yolunu kullanacağımızı bir kez belirler: OPFS ya da IndexedDB.
 *
 * BURADA CİDDİ BİR HATA VARDI (17 Ağustos'ta bulundu ve düzeltildi).
 *
 * Eskiden yalnızca SONUÇ saklanıyordu, çalışan deneme değil. Uygulama açılınca
 * ekrandaki her fotoğraf aynı anda `oku()` çağırıyor; hepsi `secilenYol`u boş
 * görüp denemeyi AYNI ANDA başlatıyordu. Deneme de sabit adlı bir dosyayı
 * yazıp okuyup siliyordu — biri ötekinin dosyasını silince o deneme hata
 * verip "OPFS çalışmıyor" diyor ve yolu IndexedDB'ye çeviriyordu.
 *
 * Sonuç: dosyalar OPFS'te dururken uygulama IndexedDB'ye bakıyordu. Ekranda
 * "Ses dosyası bulunamadı" çıkıyor, fotoğraflar çizgili boş kutu olarak
 * kalıyordu. Veri kaybolmuyordu — yanlış çekmeceye bakılıyordu. Sınamada
 * yirmi açılışın onunda oluyordu.
 *
 * İki şey değişti: deneme dosyasının adı artık benzersiz, ve burada sonuç
 * değil ÇALIŞAN SÖZ saklanıyor — deneme ömür boyu bir kez çalışıyor.
 */
let yolSozu = null;

export async function yolSec() {
  if (secilenYol) return secilenYol;
  if (!yolSozu) {
    yolSozu = (async () => {
      secilenYol = await opfsYazabiliyorMu() ? 'opfs' : 'idb';
      return secilenYol;
    })();
  }
  return yolSozu;
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

async function opfstenOku(klasor, ad) {
  try {
    const k = await opfsKlasor(klasor);
    return await (await k.getFileHandle(ad)).getFile();
  } catch {
    return null;
  }
}

async function idbdenOku(klasor, ad) {
  try {
    const d = await idbAc();
    const kayit = await idbIstek(
      d.transaction(['dosyalar']).objectStore('dosyalar').get(`${klasor}/${ad}`));
    return kayit?.blob || null;
  } catch {
    return null;
  }
}

/**
 * Dosyayı Blob olarak döner (yoksa null). Blob.slice ile parça parça okunabilir.
 *
 * ÖTEKİ YOLA DA BAKILIYOR. Yol seçimindeki yarış hatası düzeltilene kadar
 * (bkz. yolSec) uygulama bazı açılışlarda yanlış depoya düşüyordu; o
 * açılışlarda YAZILAN ses ve fotoğraflar öteki depoda kaldı. Seçilen yolda
 * bulunamayan dosya ikinci depoda aranıyor — böylece o kayıtlar kaybolmuş
 * gibi görünmüyor. Yeni yazılanlar zaten tek yola gidiyor; bu arama yalnızca
 * eski kayıtlar için ve yalnızca dosya bulunamadığında çalışıyor.
 */
export async function oku(klasor, ad) {
  await yolSec();

  const once = secilenYol === 'opfs'
    ? await opfsftenOkuGuvenli(klasor, ad)
    : await idbdenOku(klasor, ad);
  if (once) return once;

  const sonra = secilenYol === 'opfs'
    ? await idbdenOku(klasor, ad)
    : await opfsftenOkuGuvenli(klasor, ad);
  return sonra || null;
}

// OPFS hiç desteklenmiyorsa (eski Safari) burada patlamasın.
async function opfsftenOkuGuvenli(klasor, ad) {
  if (!navigator.storage?.getDirectory) return null;
  return opfstenOku(klasor, ad);
}

/**
 * Bir klasördeki dosya adları — İKİ DEPODAN DA.
 *
 * Bekçinin "sahipsiz dosya birikmiş mi" sınaması için yazıldı. İki yola da
 * bakması şart: 17 Ağustos'taki yarış hatası yüzünden bazı eski kayıtlar
 * OPFS'te, bazıları IndexedDB'de kaldı. Tek yola bakan bir sayım, öteki
 * depodaki dosyaları "sahipsiz" ilan edip silinmelerini önerirdi.
 */
export async function listele(klasor) {
  const adlar = new Set();

  if (navigator.storage?.getDirectory) {
    try {
      const k = await opfsKlasor(klasor);
      for await (const ad of k.keys()) adlar.add(ad);
    } catch { /* OPFS yoksa sorun değil */ }
  }

  try {
    const d = await idbAc();
    const t = d.transaction(['dosyalar'], 'readonly');
    const anahtarlar = await idbIstek(t.objectStore('dosyalar').getAllKeys());
    for (const a of anahtarlar) {
      if (typeof a === 'string' && a.startsWith(`${klasor}/`)) adlar.add(a.slice(klasor.length + 1));
    }
  } catch { /* açılamadıysa boş dön */ }

  return [...adlar];
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
