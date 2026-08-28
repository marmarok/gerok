// Gerok — PDF'ten metin çıkarmak.
//
// NEDEN VAR: tur programları PDF geliyor. Sihirbazın düz metin yolu zaten
// çalışıyordu ama kişinin PDF'i açıp metni elle KOPYALAMASI gerekiyordu —
// telefonda bu, çoğu insanın yapmayacağı bir iş. PDF doğrudan verilebilsin.
//
// NEDEN pdf.js: PDF'in içindeki yazı düz durmuyor; sıkıştırılmış akışlarda,
// kendi yazı tipi kodlamasıyla duruyor. Elle yazılan basit bir çözücü
// İngilizce bir belgede işe yarıyor ama Türkçe'de ç/ğ/ı/ş/ü/ö karakterlerini
// bozuyor — tur programının yarısı okunamaz hale gelirdi. pdf.js bu işi
// doğru yapıyor ve Mozilla bakıyor.
//
// TARANMIŞ PDF ÇALIŞMAZ: sayfa bir fotoğraftan ibaretse içinde yazı yoktur.
// O durumda boş metin dönüyor ve çağıran taraf kişiye bunu söylüyor —
// sessizce boş bir program üretmek en kötüsü olurdu.

let pdfjs = null;

async function kutuphane() {
  if (pdfjs) return pdfjs;
  pdfjs = await import('../vendor/pdf.mjs');
  // İşçi ayrı bir dosyada: 1,3 MB'lık çözümleme kodu ana iş parçacığını
  // kilitlemesin. Yolu elle veriyoruz çünkü kütüphane kendi yerini
  // bulmaya çalışırken yayın adresinde şaşırıyor.
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdf.worker.mjs', import.meta.url).href;
  return pdfjs;
}

/** Bu dosya PDF mi? Uzantıya değil, dosyanın kendi imzasına bakıyor. */
export async function pdfMi(dosya) {
  if (/\.pdf$/i.test(dosya.name || '') || dosya.type === 'application/pdf') return true;
  const bas = new Uint8Array(await dosya.slice(0, 5).arrayBuffer());
  return String.fromCharCode(...bas) === '%PDF-';
}

/**
 * PDF'in bütün sayfalarındaki metni satır satır döndürür.
 *
 * Satırları y konumuna göre topluyoruz: pdf.js metni parça parça veriyor
 * ve aynı satırdaki parçalar ayrı ayrı geliyor. Birleştirmezsek "09:00"
 * ile "Kahvaltı" ayrı satırlara düşüyor ve program okunmaz oluyor.
 */
export async function pdfMetni(dosya, ilerleme = null) {
  const lib = await kutuphane();
  const veri = new Uint8Array(await dosya.arrayBuffer());
  const belge = await lib.getDocument({ data: veri, isEvalSupported: false }).promise;

  const satirlar = [];
  for (let s = 1; s <= belge.numPages; s++) {
    ilerleme?.(s, belge.numPages);
    const sayfa = await belge.getPage(s);
    const icerik = await sayfa.getTextContent();

    // y → o satırdaki parçalar. Yuvarlama şart: aynı satırdaki parçaların
    // y'si ondalık basamakta oynuyor.
    const gruplar = new Map();
    for (const p of icerik.items) {
      if (!p.str) continue;
      const y = Math.round(p.transform[5]);
      if (!gruplar.has(y)) gruplar.set(y, []);
      gruplar.get(y).push({ x: p.transform[4], s: p.str });
    }
    // Sayfada yukarıdan aşağıya, satır içinde soldan sağa.
    [...gruplar.entries()]
      .sort((a, b) => b[0] - a[0])
      .forEach(([, parcalar]) => {
        const m = parcalar.sort((a, b) => a.x - b.x).map(p => p.s).join('')
          .replace(/\s+/g, ' ').trim();
        if (m) satirlar.push(m);
      });
  }
  await belge.destroy();
  return satirlar;
}
