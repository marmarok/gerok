// Gerok — ikon seti.
//
// NEDEN EMOJİ DEĞİL: uygulama emojiyle başlamıştı (🎙 🌊 📍 🧾 …). Üç sorun
// çıktı ve üçü de emojinin kendisinden geliyor:
//
//   1. RENGİ DEĞİŞMİYOR. Apple emojisi kendi renklerini taşıyor. Gece kipinde
//      parlak mavi bir dalga, gündüz kipinde aynı parlak mavi. Seçili sekme
//      vurgu rengine dönemiyordu.
//   2. AİLE DEĞİLLER. Mikrofon 3B ve parlak, raptiye düz kırmızı, saat başka
//      bir çizim dilinde. Yan yana geldiklerinde on iki ayrı yerden toplanmış
//      gibi duruyorlardı — Lora + soluk toprak paletiyle de çarpışıyorlardı.
//   3. TELEFONDAN TELEFONA DEĞİŞİYOR. Emoji çizimini işletim sistemi yapıyor;
//      iOS sürümü değişince ikon da değişiyor. On yıl sonra arşive bakan biri
//      başka bir şey görecekti.
//
// Bu yüzden hepsi burada, elle çizilmiş SVG olarak duruyor. Hepsi aynı
// kurallara uyuyor:
//   · 24×24 kutu, 1.6 kalınlıkta çizgi, yuvarlak uç ve köşe
//   · içi dolu şekil yok — sadece çizgi
//   · rengi `currentColor`: ikon, üstünde durduğu yazının rengini alıyor.
//     Tema değişince kendiliğinden değişiyor, seçili sekmede vurgu rengine
//     dönüyor. CSS'te tek satır bile ayar gerekmiyor.
//
// Görsel üretme yapay zekasına yaptırılmadı, bilerek: bu ikonlar 22 piksel
// ekranda duruyor, rengi değişmek zorunda ve on ikisinin tek elden çıkmış
// görünmesi gerekiyor. Üretilen bir PNG üçünü de veremezdi.

const CIZIMLER = {
  // --- Alt bar -------------------------------------------------------------
  saat: '<circle cx="12" cy="12" r="8.6"/><path d="M12 7.2V12l3.4 2"/>',

  harita: '<path d="M3 6.4 9 4l6 2.4L21 4v13.6L15 20l-6-2.4L3 20Z"/>'
        + '<path d="M9 4v13.6M15 6.4V20"/>',

  arti: '<path d="M12 6.4v11.2M6.4 12h11.2"/>',

  // Duraklar sekmesi: klasik iğne. "Buradayım" kaydının nişangâhından
  // bilerek farklı — biri planlanmış bir yer, öteki şu anki konum.
  raptiye: '<path d="M12 21.2s6.8-6.2 6.8-10.7a6.8 6.8 0 1 0-13.6 0C5.2 15 12 21.2 12 21.2Z"/>'
         + '<circle cx="12" cy="10.4" r="2.5"/>',

  // Gerok sekmesi: ayar sürgüleri. Dişli çark 22 pikselde çamura dönüyor,
  // sürgüler o boyutta da okunuyor.
  ayarlar: '<path d="M4 7h9M17.5 7H20M4 12h3.5M12 12h8M4 17h8M16.5 17H20"/>'
         + '<circle cx="15" cy="7" r="2.1"/><circle cx="9.5" cy="12" r="2.1"/>'
         + '<circle cx="14.5" cy="17" r="2.1"/>',

  // --- Kayıt türleri -------------------------------------------------------
  mikrofon: '<path d="M12 3.2a2.9 2.9 0 0 1 2.9 2.9v5.6a2.9 2.9 0 0 1-5.8 0V6.1A2.9 2.9 0 0 1 12 3.2Z"/>'
          + '<path d="M5.6 11.2a6.4 6.4 0 0 0 12.8 0"/><path d="M12 17.6v3.2"/>',

  // Ortam sesi: su halkaları değil, iki dalga. "Buranın nasıl duyulduğu" —
  // konuşma değil, yerin kendi sesi.
  dalga: '<path d="M2.8 9.6c1.6-2.6 3.1-2.6 4.6 0s3.1 2.6 4.6 0 3.1-2.6 4.6 0 3.1 2.6 4.6 0"/>'
       + '<path d="M2.8 15.4c1.6-2.6 3.1-2.6 4.6 0s3.1 2.6 4.6 0 3.1-2.6 4.6 0 3.1 2.6 4.6 0"/>',

  kalem: '<path d="M4 20.1l.9-3.9L16.4 4.7a2.05 2.05 0 0 1 2.9 2.9L7.9 19.2Z"/>'
       + '<path d="M14.6 6.5l2.9 2.9"/>',

  // "Buradayım": nişangâh. Şu anki konumu işaretlemek, bir yeri planlamak
  // değil — o yüzden iğne değil.
  nisan: '<circle cx="12" cy="12" r="7.4"/><circle cx="12" cy="12" r="2.4"/>'
       + '<path d="M12 2.6v2.6M12 18.8v2.6M2.6 12h2.6M18.8 12h2.6"/>',

  kisi: '<circle cx="12" cy="8" r="3.6"/>'
      + '<path d="M4.8 20.2a7.2 7.2 0 0 1 14.4 0"/>',

  fis: '<path d="M6.2 3.4h11.6v17.2l-1.9-1.4-1.9 1.4-1.9-1.4-2 1.4-1.9-1.4-2 1.4Z"/>'
     + '<path d="M9.2 8h5.6M9.2 12h5.6"/>',

  gorsel: '<rect x="3.2" y="5" width="17.6" height="14" rx="2.6"/>'
        + '<circle cx="8.6" cy="10" r="1.5"/>'
        + '<path d="M3.8 17.3l4.8-4.3 3.8 3.3 2.9-2.4 4.7 4"/>',

  // İşaretli kayıtlar süzgeci. Beş köşe, tek çizgi — setin kuralına uyuyor.
  yildiz: '<path d="M12 3.6l2.6 5.3 5.8.85-4.2 4.1 1 5.8-5.2-2.73-5.2 2.73 1-5.8-4.2-4.1 5.8-.85Z"/>',

  // --- Harita düğmeleri ----------------------------------------------------
  buyutec: '<circle cx="10.6" cy="10.6" r="6.8"/><path d="M15.6 15.6L21 21"/>',

  // "Tüm rotayı göster": dört köşeye açılan oklar.
  genislet: '<path d="M9.4 3.6H3.6v5.8M14.6 3.6h5.8v5.8M20.4 14.6v5.8h-5.8M3.6 14.6v5.8h5.8"/>',

  // --- Boş ekranlar --------------------------------------------------------
  // Zaman çizgisi boş: aşağı inen çizgi ve üstünde henüz doldurulmamış
  // tek bir halka.
  zamanBos: '<path d="M12 2.5v6.6M12 14.9v6.6"/><circle cx="12" cy="12" r="2.9"/>',

  // Durak yok: üzerinde hiçbir işaret olmayan yol şeridi.
  yolBos: '<path d="M6.4 21.5C6.4 12 17.6 12 17.6 2.5"/>'
        + '<path d="M2.6 21.5C2.6 9.6 13.8 9.6 13.8 2.5" stroke-dasharray="2.6 3.2"/>'
};

/**
 * Bir ikonun SVG'sini döndürür.
 *
 * `boy`: kenar uzunluğu (piksel). Kutu hep 24×24; büyütmek çizgiyi de
 * büyütüyor, o yüzden büyük boylarda kalınlık orantılı inceltiliyor —
 * yoksa boş ekranlardaki 44 piksellik ikon kalem yerine fırçayla çizilmiş
 * gibi duruyordu.
 */
/**
 * Emoji karşılıkları.
 *
 * Yukarıdaki üç itiraz hâlâ doğru — ama 17 Ağustos'ta defterin sahibi
 * "emojiye dön" dedi ve şartname (SPEC §2.4) da sekmelerde emoji istiyor. SVG çizimler
 * silinmedi: `EMOJI` değişkenini false yapmak eski sete geri döndürüyor.
 */
const EMOJILER = {
  saat: '📖', harita: '🗺️', arti: '＋', raptiye: '📍', ayarlar: '☰',
  mikrofon: '🎙️', dalga: '🎧', kalem: '✏️', nisan: '🎯', kisi: '🤝',
  fis: '🧾', gorsel: '🖼️', buyutec: '🔍', genislet: '⤢', yildiz: '⭐',
  zamanBos: '📖', yolBos: '🗺️'
};
const EMOJI = true;

export function ikon(ad, boy = 24) {
  if (EMOJI) {
    const e = EMOJILER[ad];
    if (!e) return '';
    // Kutu SVG ile aynı boyda kalsın: emoji satır yüksekliğiyle taşıyordu.
    return `<span class="ikon emoji" aria-hidden="true"
      style="font-size:${(boy * 0.84).toFixed(1)}px;width:${boy}px;height:${boy}px">${e}</span>`;
  }
  const d = CIZIMLER[ad];
  if (!d) return '';
  const kalinlik = boy > 30 ? (1.6 * 24 / boy) * 1.35 : 1.6;
  return `<svg class="ikon" width="${boy}" height="${boy}" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" stroke-width="${kalinlik.toFixed(2)}"
    stroke-linecap="round" stroke-linejoin="round"
    aria-hidden="true" focusable="false">${d}</svg>`;
}

/**
 * Sayfadaki `data-ikon` taşıyan her kutuyu doldurur.
 *
 * index.html'de ikonlar `<span data-ikon="mikrofon"></span>` diye duruyor;
 * SVG'yi HTML'e elle yazmak index.html'i okunmaz hâle getirirdi ve aynı
 * çizim birden çok yerde tekrar ederdi.
 */
export function ikonlariYerlestir(kok = document) {
  kok.querySelectorAll('[data-ikon]').forEach(e => {
    if (e.dataset.ikonKuruldu) return;      // iki kez çizme
    const boy = Number(e.dataset.ikonBoy) || 24;
    const svg = ikon(e.dataset.ikon, boy);
    if (!svg) return;
    e.innerHTML = svg;
    e.dataset.ikonKuruldu = '1';
  });
}
