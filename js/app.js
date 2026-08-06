// Gerok — uygulama omurgası: açılış, ekran yönlendirme, arayüz.

import * as veri from './veri.js';
import * as iz from './iz.js';
import * as gerok from './gerok.js';
import * as kayit from './kayit.js';
import { haritaKur, haritaGuncelle, haritaBoyutTazele, konumaGit, hepsiniGoster,
         kipDegistir, aktifKipAl, haritaMerkezi, durakTiklamasi } from './harita.js';
import { gunSonuAc, baslangicKaydiAc, bitisKaydiAc, mektupAc } from './gunsonu.js';
import { paketGonder, paketAl, yedekAl } from './esitleme.js';
import { TEMALAR, temaSecimi, temaSec, temaBaslat } from './tema.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

let durum = {
  ekran: 'zaman',
  kayitlar: [],
  izNoktalari: [],
  durakDurumlari: {},
  yolModu: false,
  sonParaBirimi: '',
  uyanikKilit: null,
  sonUlke: null,
  uyarilmisDuraklar: new Set()
};

// ---------------------------------------------------------------- açılış ---

async function baslat() {
  temaBaslat();
  await veri.ac();
  await gerok.baslat();

  // Cihaz kimliği: iki telefonun kayıtlarını birbirinden ayıran şey.
  let cihaz = await veri.ayarOku('cihazKimligi');
  if (!cihaz) {
    cihaz = veri.yeniKimlik('c');
    await veri.ayarYaz('cihazKimligi', cihaz);
  }
  const ad = await veri.ayarOku('kullaniciAdi', null);
  iz.cihazAyarla(cihaz);
  kayit.sahipAyarla({ id: cihaz, ad });

  durum.uyarilmisDuraklar = new Set(await veri.ayarOku('uyarilmisDuraklar', []));
  durum.sonUlke = await veri.ayarOku('sonUlke', null);
  durum.sonParaBirimi = await veri.ayarOku('sonParaBirimi', '');

  await depolamaSagligi();

  sekmeleriKur();
  kayitDugmeleriniKur();
  izDinle();

  await tazele();
  ekranAc('zaman');

  // Ad girilmemişse önce onu sor — her kaydın sahibi yazılacak.
  if (!ad) adSor();

  setTimeout(() => {
    $('#yukleniyor').classList.add('cikiyor');
    setTimeout(() => $('#yukleniyor').classList.add('gizli'), 420);
  }, 260);

  iz.basla();
  gunSonuHatirlatmasiKur();
}

// Depolama sağlığı — açılışta bir kez.
//
// İki gerçek tehlike var ve ikisi de sessiz: (1) kalıcı depolama istenmezse
// iOS yer daraldığında uygulamanın verisini SİLEBİLİR — bir haftalık ses
// kaydı yok olur; (2) telefon dolarsa yeni kayıtlar yazılamaz. İkisini de
// açılışta bir kez kontrol edip kullanıcıya söylüyoruz.
const AZ_YER_ESIGI = 300 * 1024 * 1024;      // 300 MB

async function depolamaSagligi() {
  try {
    const s = await veri.kaliciDepolamaIste();
    durum.kaliciDepolama = !!s.kalici;

    const d = await veri.depolamaDurumu();
    durum.depolama = d;

    if (!durum.kaliciDepolama) {
      kayitBildir('Dikkat: kalıcı depolama açılmadı. Uygulamayı ANA EKRANDAKİ ' +
        'simgeden aç — Safari sekmesinden açarsan iOS verileri silebilir.', 'kotu');
      return;
    }
    if (d && d.kota && (d.kota - d.kullanilan) < AZ_YER_ESIGI) {
      kayitBildir(`Telefonda yer azalıyor: ${boyutYaz(d.kota - d.kullanilan)} kaldı. ` +
        'Yedek al ve galeriden yer aç.', 'kotu');
    }
  } catch { /* sorgulanamıyorsa sessiz geç, uygulama yine çalışır */ }
}

async function tazele() {
  durum.kayitlar = await veri.kayitlariGetir();
  durum.izNoktalari = await veri.izGetir();
  durum.durakDurumlari = await veri.durakDurumlari();
  ustBariYaz();
  if (durum.ekran === 'zaman') zamanCizgisiCiz();
  if (durum.ekran === 'duraklar') duraklariCiz();
  if (durum.ekran === 'gerok') paneliCiz();
  if (durum.ekran === 'harita') haritaGuncelle(durum.kayitlar, durum.izNoktalari);
}

// -------------------------------------------------------------- yönlendirme -

function sekmeleriKur() {
  $$('#altBar .sekme').forEach(d => {
    d.addEventListener('click', () => ekranAc(d.dataset.ekran));
  });
}

function ekranAc(ad) {
  // Haritadan çıkarken durak koyma kipi de kapansın — dönünce nişangâh
  // ekranda kalmış olurdu.
  if (durum.ekran === 'harita' && ad !== 'harita') durakKoymaKipi(false);
  durum.ekran = ad;
  $$('.ekran').forEach(e => e.classList.remove('acik'));
  $(`#ekran-${ad}`)?.classList.add('acik');
  $$('#altBar .sekme').forEach(d => d.classList.toggle('secili', d.dataset.ekran === ad));

  if (ad === 'zaman') zamanCizgisiCiz();
  if (ad === 'duraklar') duraklariCiz();
  if (ad === 'gerok') paneliCiz();
  if (ad === 'harita') {
    haritaKur().then(() => {
      haritaBoyutTazele();
      haritaKipleriniIsaretle();
      haritaGuncelle(durum.kayitlar, durum.izNoktalari);
    });
  }
}

function ustBariYaz() {
  const s = gerok.aktifGerok();
  const g = gerok.bugununGunu();
  $('#ustBaslik').textContent = s ? s.ad : 'Gerok';
  $('#ustAlt').textContent = g
    ? gerok.gunBasligi(g)
    : (s ? (gerok.gerokBittiMi() ? 'Gerok tamamlandı' : 'Gerok henüz başlamadı') : 'Gerok paketi yüklenmedi');
}

// ------------------------------------------------------------ zaman çizgisi -

// Zaman çizgisi bir haftada bini aşkın kayda çıkıyor. Hepsini birden çizmek
// hem yavaş hem de her fotoğraf için bir blob adresi açtığı için bellek yiyor.
// Bu yüzden en yeniden başlayarak sınırlı sayıda kayıt çiziliyor ve açılan
// adresler bir sonraki çizimde geri veriliyor.
const SAYFA_ADIMI = 120;
let gosterilenSayi = SAYFA_ADIMI;

// Önizleme adresleri kayıt başına BİR KEZ üretilip saklanıyor.
//
// Önce her çizimde yeniden üretiliyordu ve hiç geri verilmiyordu: liste her
// tazelendiğinde bellek büyüyordu. Çizim başında geri vermeyi denedim, o da
// hâlâ yüklenmekte olan görselleri iptal etti (görseller boş çıktı). Doğrusu
// bu: adres bir kez açılır, tekrar tekrar kullanılır. Büyüme çizim sayısıyla
// değil, farklı fotoğraf sayısıyla sınırlı — sayfalama da onu sınırlıyor.
const onizlemeAdresleri = new Map();

async function onizlemeAdresi(medyaId) {
  if (onizlemeAdresleri.has(medyaId)) return onizlemeAdresleri.get(medyaId);
  const url = await veri.medyaUrl(medyaId, 'image/jpeg');
  if (url) onizlemeAdresleri.set(medyaId, url);
  return url;
}

// Kayıt silinince adresi de bırak.
function onizlemeAdresiniBirak(medyaId) {
  const u = onizlemeAdresleri.get(medyaId);
  if (u) { URL.revokeObjectURL(u); onizlemeAdresleri.delete(medyaId); }
}

function zamanCizgisiCiz() {
  const kap = $('#zamanListe');
  const s = gerok.aktifGerok();

  if (!s) {
    kap.innerHTML = bosDurum('🧭', 'Henüz bir gerok yüklenmedi.<br>Gerok sekmesinden paketi yükle.');
    return;
  }
  if (!durum.kayitlar.length) {
    kap.innerHTML = bosDurum('🕘',
      'Zaman çizgisi boş.<br>Kayıt sekmesinden ilk sesli notunu bırak,<br>ya da bir fotoğraf ekle.');
    return;
  }

  // En yeniler önce: sınırı aşan eskiler "daha eskisini göster" ile gelir.
  const tumu = durum.kayitlar;
  const gosterilecek = tumu.slice(Math.max(0, tumu.length - gosterilenSayi));
  const gizliSayi = tumu.length - gosterilecek.length;

  const gruplar = new Map();
  for (const k of gosterilecek) {
    const anahtar = k.gun ?? 'disi';
    if (!gruplar.has(anahtar)) gruplar.set(anahtar, []);
    gruplar.get(anahtar).push(k);
  }

  const sirali = Array.from(gruplar.keys()).sort((a, b) => {
    if (a === 'disi') return 1;
    if (b === 'disi') return -1;
    return b - a;                       // en yeni gün üstte
  });

  let html = '';
  for (const anahtar of sirali) {
    const gunler = s.gunler.find(g => g.no === anahtar);
    const kayitlar = gruplar.get(anahtar).slice().reverse();

    html += `<div class="gun-basligi">
      <div class="gun-no">${anahtar === 'disi' ? 'Gerok dışı' : `Gün ${anahtar}`}</div>
      <div class="gun-ad">${gunler ? kacis(gunler.baslik) : 'Diğer kayıtlar'}</div>
      ${gunler ? `<div class="gun-bilgi">${kacis(gerok.tarihUzun(new Date(gunler.tarih).getTime()))}${gunler.km ? ` · ${gunler.km} km` : ''}</div>` : ''}
    </div>`;

    for (const k of kayitlar) html += kayitSatiri(k);
  }

  if (gizliSayi > 0) {
    html += `<div class="daha-eski">
      <button class="eylem-dugme" id="dahaEski">Daha eskisini göster (${gizliSayi})</button>
    </div>`;
  }
  kap.innerHTML = html;

  $('#dahaEski')?.addEventListener('click', () => {
    gosterilenSayi += SAYFA_ADIMI;
    zamanCizgisiCiz();
  });

  kap.querySelectorAll('[data-ses]').forEach(tus => {
    const kutu = tus.closest('.ses-oynat');
    const sure = +tus.dataset.sure || 0;
    tus.addEventListener('click', () => sesCal(tus.dataset.ses, kutu, tus.dataset.bicim, sure));
    cubuguKur(kutu.querySelector('.ses-cubuk'), kutu, tus.dataset.ses, tus.dataset.bicim, sure);
  });
  kap.querySelectorAll('[data-onizleme]').forEach(async (d) => {
    const url = await onizlemeAdresi(d.dataset.onizleme);
    if (url) d.innerHTML = `<img src="${url}" alt="" loading="lazy">`;
  });
  kap.querySelectorAll('[data-sil]').forEach(d => {
    d.addEventListener('click', () => kaydiSil(d.dataset.sil));
  });
  kap.querySelectorAll('[data-google]').forEach(d => {
    d.addEventListener('click', () => {
      const [lat, lon] = d.dataset.google.split(',');
      googleHaritalarAc({ lat, lon });
    });
  });
}

function kayitSatiri(k) {
  const tur = veri.TURLER[k.tur] || k.tur;
  const yer = k.konumKaynagi === 'iz' ? 'izden' : k.konumKaynagi === 'exif' ? 'fotoğraftan' : k.konumKaynagi === 'gps' ? '' : 'konumsuz';

  let govde = '';
  if (k.metin) govde += `<div class="kayit-metin">${kacis(k.metin)}</div>`;
  if (k.tur === 'fiyat' && k.tutar) {
    govde += `<div class="kayit-metin">${kacis(k.tutar)} ${kacis(k.paraBirimi || '')}</div>`;
  }
  if (k.tur === 'kisi' && k.not) govde += `<div class="kayit-yer">${kacis(k.not)}</div>`;

  if (k.medyaId && ['ses', 'ortam', 'gunluk', 'baslangic', 'bitis', 'mektup'].includes(k.tur)) {
    govde += `<div class="ses-oynat">
      <button class="ses-tus" data-ses="${k.medyaId}" data-bicim="${kacis(k.bicim || '')}" data-sure="${k.sure || 0}">▶</button>
      <input class="ses-cubuk" type="range" min="0" max="1000" value="0" step="1" aria-label="Ses konumu">
      <span class="sure">0:00 / ${sureYaz(k.sure)}</span>
    </div>`;
  }
  if (k.medyaId && ['foto', 'video', 'siradan'].includes(k.tur)) {
    govde += `<div class="kayit-foto" data-onizleme="${k.medyaId}"></div>`;
    if (k.tur === 'video') govde += `<div class="kayit-yer">video · ${sureYaz(k.videoSure)}</div>`;
  }

  const konumlu = k.lat != null && k.lon != null;

  return `<div class="kayit-satir ${k.tur}">
    <div class="kayit-saat">${gerok.saat(k.t)}</div>
    <div class="kayit-govde">
      <div class="kayit-tur">${kacis(tur)}</div>
      ${govde}
      <div class="kayit-sahip">${kacis(k.sahipAd || 'bilinmeyen')}${yer ? ` · ${yer}` : ''}</div>
      <div class="kayit-eylemler">
        ${konumlu ? `<button class="satir-dugme" data-google="${k.lat},${k.lon}">Google Haritalar</button>` : ''}
        <button class="satir-dugme sil" data-sil="${k.id}">Sil</button>
      </div>
    </div>
  </div>`;
}

// Google Haritalar: yorumlar ve fotoğraflar orada. İNTERNET İSTER — yolda
// çalışmaz, otelin wifi'sinde çalışır.
export function googleHaritalarAc({ lat, lon, ad = '', zoom = 15 }) {
  const adres = ad
    ? `https://www.google.com/maps/search/${encodeURIComponent(ad)}/@${lat},${lon},${zoom}z`
    : `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;

  // Bağlantı window.open ile değil, gerçek bir <a target="_blank"> ile açılıyor:
  // ana ekrana eklenmiş uygulamada window.open bazen aynı pencerede açıyor ve
  // geri düğmesi olmadığı için uygulamadan çıkış yolu kalmıyor. Anchor Safari'yi
  // ayrı uygulama olarak açıyor, Gerok arkada duruyor.
  const a = document.createElement('a');
  a.href = adres;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => a.remove(), 0);
}

async function kaydiSil(id) {
  const k = durum.kayitlar.find(x => x.id === id);
  if (!k) return;
  const tur = veri.TURLER[k.tur] || k.tur;

  ortuAc(`
    <div class="ortu-baslik">Bu kayıt silinsin mi?</div>
    <div class="ortu-alt">${kacis(tur)} · ${kacis(gerok.saat(k.t))}${k.metin ? ` · "${kacis(k.metin.slice(0, 60))}"` : ''}<br><br>
    Geri alınamaz. Ses dosyası da siliniyor. Arkadaşına paket gönderdiğinde
    onun telefonundan da silinir.</div>
    <button class="eylem-dugme birincil" id="silOnay">Sil</button>
    <button class="eylem-dugme" id="silVazgec">Vazgeç</button>
  `);

  $('#silVazgec').addEventListener('click', ortuKapat);
  $('#silOnay').addEventListener('click', async () => {
    ortuKapat();
    if (k.medyaId) onizlemeAdresiniBirak(k.medyaId);
    await veri.kayitYokEt(id);
    kayitBildir('Kayıt silindi.', 'iyi');
    await tazele();
  });
}

// Ses çalma.
//
// İki yol var, çünkü iOS'ta <audio> tek başına güvenilir değil:
//  a) OPFS'ten okunan dosyanın MIME türü boş kalıyor, Safari türsüz blob
//     adresinden sesi çözmüyor (bkz. depo.url) — kaydın `bicim` alanı veriliyor.
//  b) iOS'un MediaRecorder'ı parçalı (fragmented) MP4 üretiyor ve Safari kendi
//     ürettiği bu dosyayı <audio> ile bazen açamıyor.
// (a) düzeltilmesine rağmen ses gelmezse (b) devrede demektir: dosya baştan
// çözülüp Web Audio ile çalınıyor. Yolda düzeltme şansı yok, iki yol da duruyor.
//
// Sürükleme (ileri-geri alma) iki yolda da çalışıyor ama farklı işliyor:
// <audio>'da currentTime yazılıyor, Web Audio'da çalan kaynak durdurulup
// istenen saniyeden yenisi başlatılıyor — o yolda arabellek zaten baştan
// çözülmüş durumda, atlama anında oluyor.
let calan = null;

function calaniBirak() {
  if (!calan) return;
  clearInterval(calan.sayac);
  if (calan.kaynak) calan.kaynak.onended = null;
  try { calan.ses ? calan.ses.pause() : calan.kaynak?.stop(); } catch { /* zaten durmuş */ }
  calan.ikon.textContent = '▶';
  if (calan.sure) calan.sure.textContent = `0:00 / ${sureYaz(calan.toplam)}`;
  if (calan.cubuk) calan.cubuk.value = 0;
  URL.revokeObjectURL(calan.url);
  calan = null;
}

// Zaman çizgisi yeniden çizilince çalan kaydın düğmesi DOM'dan düşüyor:
// ses arkada çalmaya devam eder, durdurmanın yolu kalmazdı.
function calanKoptuMu() {
  return calan && !document.body.contains(calan.kap);
}

function sayaciBasla(gecenSaniye) {
  calan.sayac = setInterval(() => {
    if (!calan) return;
    if (calanKoptuMu()) { calaniBirak(); return; }
    const gecen = gecenSaniye();
    const toplam = calan.toplam || 0;
    if (calan.sure) calan.sure.textContent = `${sureYaz(gecen)} / ${sureYaz(toplam)}`;
    if (calan.cubuk && toplam > 0 && calan.cubuk.dataset.tutuluyor !== '1') {
      calan.cubuk.value = Math.round(Math.min(1, gecen / toplam) * 1000);
    }
  }, 200);
}

// Kaydın gerçek süresi. iOS'un ürettiği mp4'te <audio> süreyi çoğu zaman
// Infinity ya da yanlış veriyor — o zaman kayıt sırasında ölçülen süre
// kullanılıyor. Çubuğun doğru yerde durması buna bağlı.
function calmaSuresi(ses, kayitliSure) {
  const d = ses?.duration;
  return Number.isFinite(d) && d > 0.2 ? d : (kayitliSure || 0);
}

// Çalanın kimlik bilgilerini yedek yola taşımak için toplar.
function calaninKimligi() {
  const c = calan;
  return { url: c.url, kap: c.kap, ikon: c.ikon, medyaId: c.medyaId,
           sure: c.sure, cubuk: c.cubuk, kayitliSure: c.kayitliSure, sayac: null };
}

async function sesCal(medyaId, kap, bicim = '', kayitliSure = 0, baslaOrani = 0) {
  // Aynı kayda ikinci dokunuş: duraklat ya da devam et.
  if (calan && calan.medyaId === medyaId && !baslaOrani) {
    const duruyor = calan.ses ? calan.ses.paused : calan.ac.state === 'suspended';
    if (duruyor) {
      const nerede = calan.ses ? (calan.ses.currentTime || 0) : webAudioKonumu();
      const kimlik = calaninKimligi();
      const sesli = !!calan.ses;
      calan.ikon.textContent = '⏸';
      // Devam ettirmek her zaman tutmuyor: iOS'ta araya bir telefon görüşmesi
      // girdiyse <audio> bir daha başlamıyor. Sessizce durmasın diye yedek yol.
      Promise.resolve(calan.ses ? calan.ses.play() : calan.ac.resume())
        .catch(() => { if (sesli) yedekYolaGec(medyaId, kimlik, 'devam ettirilemedi', nerede); });
    } else {
      calan.ses ? calan.ses.pause() : calan.ac.suspend();
      calan.ikon.textContent = '▶';
    }
    return;
  }
  calaniBirak();

  const url = await veri.medyaUrl(medyaId, bicim || null);
  if (!url) { kayitBildir('Ses dosyası bulunamadı.', 'kotu'); return; }

  const ikon = kap.querySelector('.ses-tus');
  const ortak = {
    url, kap, ikon, medyaId, sayac: null,
    sure: kap.querySelector('.sure'),
    cubuk: kap.querySelector('.ses-cubuk'),
    kayitliSure, toplam: kayitliSure
  };

  const ses = new Audio();
  ses.preload = 'auto';
  ses.src = url;
  calan = { ...ortak, ses };

  ses.onloadedmetadata = () => { if (calan?.ses === ses) calan.toplam = calmaSuresi(ses, kayitliSure); };

  // Süre bilgisi yanlış olunca <audio> kaydın ortasında "bitti" deyip susuyor.
  // Gerçek süresine göre erken bittiyse dosyayı baştan çözen yola geçiliyor.
  ses.onended = () => {
    const calinan = ses.currentTime || 0;
    if (kayitliSure > 2 && calinan < kayitliSure - 1.5) {
      yedekYolaGec(medyaId, ortak, `erken bitti (${calinan.toFixed(1)}/${kayitliSure} sn)`, calinan);
    } else {
      calaniBirak();
    }
  };
  ses.onerror = () => yedekYolaGec(medyaId, ortak, 'dosya <audio> ile açılamadı');

  if (baslaOrani > 0) {
    try { ses.currentTime = baslaOrani * (calmaSuresi(ses, kayitliSure) || kayitliSure); } catch { /* açılınca denenecek */ }
  }

  try {
    await ses.play();
  } catch (hata) {
    await yedekYolaGec(medyaId, ortak, hata.message, baslaOrani * kayitliSure);
    return;
  }

  calan.toplam = calmaSuresi(ses, kayitliSure);
  ikon.textContent = '⏸';
  sayaciBasla(() => calan?.ses?.currentTime || 0);
}

// <audio> çalışmadığında: dosyayı baştan çöz ve Web Audio ile çal.
async function yedekYolaGec(medyaId, ortak, neden, baslaSaniye = 0) {
  if (calan && calan.medyaId === medyaId) { clearInterval(calan.sayac); calan = null; }
  console.warn('ses: yedek yola geçiliyor —', neden);

  try {
    const blob = await veri.medyaOku(medyaId);
    if (!blob) throw new Error('dosya yok');
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    const tampon = await ac.decodeAudioData(await blob.arrayBuffer());

    calan = { ...ortak, ac, tampon, toplam: tampon.duration };
    webAudioBaslat(baslaSaniye);

    ortak.ikon.textContent = '⏸';
    sayaciBasla(() => webAudioKonumu());
    kayitBildir(`Ses çözülerek çalınıyor · ${sureYaz(tampon.duration)}`);
  } catch (hata) {
    URL.revokeObjectURL(ortak.url);
    ortak.ikon.textContent = '▶';
    if (ortak.sure) ortak.sure.textContent = `0:00 / ${sureYaz(ortak.kayitliSure)}`;
    calan = null;
    kayitBildir(`Ses çalınamadı: ${hata.message}`, 'kotu');
  }
}

// Web Audio yolunda çalmayı istenen saniyeden (yeniden) başlatır.
// BufferSource bir kez çalıp biten bir nesne: her atlama yenisini gerektiriyor.
function webAudioBaslat(saniye) {
  const c = calan;
  if (!c?.tampon) return;

  if (c.kaynak) {
    c.kaynak.onended = null;             // durdurma "bitti" sayılmasın
    try { c.kaynak.stop(); } catch { /* zaten durmuş */ }
  }

  c.ofset = Math.max(0, Math.min(saniye || 0, c.tampon.duration - 0.05));
  c.baslangicAni = c.ac.currentTime;
  c.kaynak = c.ac.createBufferSource();
  c.kaynak.buffer = c.tampon;
  c.kaynak.connect(c.ac.destination);
  c.kaynak.onended = () => { if (calan === c) calaniBirak(); };
  c.kaynak.start(0, c.ofset);
}

function webAudioKonumu() {
  if (!calan?.tampon) return 0;
  return Math.min(calan.tampon.duration, calan.ofset + (calan.ac.currentTime - calan.baslangicAni));
}

// ---- Sürükleme --------------------------------------------------------------

// Parmak çubuğun üstündeyken sayaç çubuğu geri itmesin diye işaretleniyor.
function cubuguKur(cubuk, kap, medyaId, bicim, kayitliSure) {
  const tut = () => { cubuk.dataset.tutuluyor = '1'; };
  const birak = () => { cubuk.dataset.tutuluyor = '0'; };

  cubuk.addEventListener('pointerdown', tut);
  cubuk.addEventListener('touchstart', tut, { passive: true });

  // Sürüklerken yalnızca yazı güncelleniyor; ses gerçekten parmak kalkınca
  // atlıyor. Web Audio yolunda her ara adımda yeniden başlatmak sesi
  // tırmalardı, iki yol da aynı davransın diye tek kural.
  cubuk.addEventListener('input', () => {
    tut();
    const toplam = (calan?.medyaId === medyaId ? calan.toplam : kayitliSure) || kayitliSure;
    const yazi = kap.querySelector('.sure');
    if (yazi) yazi.textContent = `${sureYaz(cubuk.value / 1000 * toplam)} / ${sureYaz(toplam)}`;
  });

  cubuk.addEventListener('change', async () => {
    birak();
    const oran = cubuk.value / 1000;

    // Çalmıyorsa: sürükleyip bırakmak o saniyeden başlatır.
    if (!calan || calan.medyaId !== medyaId) {
      await sesCal(medyaId, kap, bicim, kayitliSure, oran);
      return;
    }
    await sesAtla(oran * (calan.toplam || kayitliSure));
  });

  cubuk.addEventListener('pointerup', birak);
  cubuk.addEventListener('touchend', birak, { passive: true });
}

async function sesAtla(hedefSaniye) {
  const c = calan;
  if (!c) return;

  if (c.tampon) { webAudioBaslat(hedefSaniye); return; }
  if (!c.ses) return;

  try { c.ses.currentTime = hedefSaniye; } catch { /* aşağıda yakalanıyor */ }
  if (c.ses.paused) c.ses.play().catch(() => {});

  // iOS'un parçalı mp4'ünde arama bazen hiç işlemiyor: currentTime yazılıyor
  // ama ses aynı yerden devam ediyor. Gerçekten atladı mı diye bakılıyor;
  // atlamadıysa dosyayı baştan çözen yola geçiliyor — orada arama kesin.
  const medyaId = c.medyaId;
  setTimeout(() => {
    if (!calan || calan.medyaId !== medyaId || !calan.ses) return;
    if (Math.abs(calan.ses.currentTime - hedefSaniye) > 2) {
      const kimlik = calaninKimligi();
      calan.ses.pause();
      yedekYolaGec(medyaId, kimlik, 'arama işlemedi', hedefSaniye);
    }
  }, 400);
}

// ------------------------------------------------------------ kayıt ekranı --

function kayitDugmeleriniKur() {
  sesDugmeleriniKur();
  $('#btnSes').addEventListener('click', () => sesKaydiBaslat('ses'));
  // Ortam sesi: konuşmadan, 30 saniye, o yerin nasıl duyulduğu.
  $('#btnOrtam').addEventListener('click', () => sesKaydiBaslat('ortam', {
    sinir: 30,
    ipucu: 'Konuşma — sadece burayı dinlet. 30 saniyede kendi biter.'
  }));

  $('#btnYazi').addEventListener('click', () => yaziSor());
  $('#btnIsaret').addEventListener('click', async () => {
    await kayit.isaretEkle('');
    kayitBildir('Buradasın — işaretlendi.');
    await tazele();
  });
  $('#btnKisi').addEventListener('click', kisiSor);
  $('#btnFiyat').addEventListener('click', fiyatSor);
  $('#btnFoto').addEventListener('click', () => $('#fotoSecici').click());

  $('#fotoSecici').addEventListener('change', async (e) => {
    if (!e.target.files.length) return;
    await fotograflariAl(e.target.files);
    e.target.value = '';
  });

  $('#btnYolModu').addEventListener('click', yolModuDegistir);

  // Durak koyma
  $('#haritaDurak').addEventListener('click', () =>
    durakKoymaKipi($('#haritaNisan').classList.contains('gizli')));
  $('#durakVazgec').addEventListener('click', () => durakKoymaKipi(false));
  $('#durakKoy').addEventListener('click', durakNoktasiOnayla);
  durakTiklamasi(durakKartiAc);

  $('#haritaBenim').addEventListener('click', () => konumaGit(iz.sonBilinenKonum()));
  $('#haritaHepsi').addEventListener('click', hepsiniGoster);
  $('#haritaGoogle').addEventListener('click', () => {
    const m = haritaMerkezi();
    if (m) googleHaritalarAc({ lat: m.lat, lon: m.lon, zoom: m.zoom });
  });
  $('#izRozet').addEventListener('click', izRozetTikla);
  haritaKipleriniKur();
}

// Gündüz / Gece / Uydu. Uydu internet ister — offline'ken zemin boş kalır,
// bu yüzden seçilince açıkça söyleniyor.
function haritaKipleriniKur() {
  $$('#haritaKipler .kip').forEach(d => {
    d.addEventListener('click', async () => {
      await kipDegistir(d.dataset.kip);
      haritaKipleriniIsaretle();
      if (d.dataset.kip === 'uydu') {
        kayitBildir(navigator.onLine
          ? 'Uydu görüntüsü internetten iniyor.'
          : 'Uydu için internet gerekiyor — şu an bağlantı yok, görüntü gelmez.',
          navigator.onLine ? 'iyi' : 'kotu');
      }
    });
  });
}

function haritaKipleriniIsaretle() {
  const k = aktifKipAl();
  $$('#haritaKipler .kip').forEach(d => d.classList.toggle('secili', d.dataset.kip === k));
}

// Ses kaydı — dokun başlat, dokun durdur.
//
// Önce "basılı tut, bırak" vardı ve gerçek telefonda çalışmıyordu: mikrofon
// izni sorulurken parmak kalkıyor, bırakma olayı izin penceresine gidiyor,
// kayıt hiç durmuyordu. Görünür bir durdurma düğmesi bu sınıfın bütün
// hatalarını kapatıyor — kaydı bitiren şey artık parmağın değil, bir düğme.
let sesOturum = null;

export function sesKaydiVarMi() { return sesOturum !== null; }

function sesKatmaniKapat() {
  $('#sesKatman').classList.add('gizli');
  $('#sesSure').textContent = '0:00';
  sesOturum = null;
}

// tur: kaydın türü · sinir: saniye (0 = sınırsız) · ipucu: katmanda yazan satır
export async function sesKaydiBaslat(tur, { sinir = 0, ipucu = 'Konuş — bitince "Durdur ve kaydet"', bittiginde = null } = {}) {
  if (sesOturum) return;
  const o = { tur, iptal: false, kapandi: false, sayac: null, bittiginde };
  sesOturum = o;

  $('#sesKatman').classList.remove('gizli');
  $('#sesSure').textContent = sinir ? sureYaz(sinir) : '0:00';
  $('#sesIpucu').textContent = 'Mikrofon açılıyor…';
  $('#sesDurdur').disabled = true;

  let basladi = false;
  try {
    basladi = await kayit.sesBasla();
  } catch {
    sesKatmaniKapat();
    kayitBildir('Mikrofon izni yok. Ayarlar → Safari → Mikrofon.', 'kotu');
    return;
  }

  // İzin beklenirken "Vazgeç"e basılmış olabilir — mikrofonu hemen bırak.
  if (o.iptal || !basladi) {
    kayit.sesIptal();
    if (!o.kapandi) sesKatmaniKapat();
    return;
  }

  $('#sesIpucu').textContent = ipucu;
  $('#sesDurdur').disabled = false;
  titret(12);

  o.sayac = setInterval(() => {
    const gecen = kayit.sesSuresi();
    $('#sesSure').textContent = sureYaz(sinir ? Math.max(0, sinir - gecen) : gecen);
    if (sinir && gecen >= sinir) sesKaydiBitir();
  }, 100);
}

export async function sesKaydiBitir() {
  const o = sesOturum;
  if (!o || o.kapandi) return;
  o.kapandi = true;
  clearInterval(o.sayac);
  sesKatmaniKapat();

  // Telefon dolduysa dosya yazılamaz. Sessiz kalırsa kullanıcı kaydettiğini
  // sanır ve ses kaybolur — bu yüzden hata açıkça söyleniyor.
  let k = null;
  try {
    k = await kayit.sesBitir(o.tur);
  } catch (hata) {
    kayitBildir(`KAYIT EDİLEMEDİ: ${hata.message}. Telefonda yer kalmamış olabilir.`, 'kotu');
    await o.bittiginde?.(null);
    return;
  }

  if (k) {
    kayitBildir(`Kaydedildi · ${sureYaz(k.sure)}`, 'iyi');
    titret([8, 40, 8]);
    await tazele();
  } else {
    kayitBildir('Çok kısaydı, kaydedilmedi.');
  }
  await o.bittiginde?.(k);
}

function sesKaydiVazgec() {
  const o = sesOturum;
  if (!o) return;
  o.iptal = true;
  if (o.kapandi) return;
  o.kapandi = true;
  clearInterval(o.sayac);
  kayit.sesIptal();
  sesKatmaniKapat();
  kayitBildir('Kayıt silindi.');
}

function sesDugmeleriniKur() {
  $('#sesDurdur').addEventListener('click', sesKaydiBitir);
  $('#sesVazgec').addEventListener('click', sesKaydiVazgec);
}

async function fotograflariAl(dosyalar, tur = null) {
  ortuAc(`
    <div class="ortu-baslik">Fotoğraflar alınıyor</div>
    <div class="ortu-alt" id="fotoIlerleme">Hazırlanıyor…</div>
    <div class="panel-not">Orijinaller galeride kalıyor — buraya küçük bir önizleme,
    çekilme saati ve konum yazılıyor.</div>
  `, false);

  // Ne olursa olsun örtü kapanmalı: burada takılırsa uygulama kilitli görünüyor.
  try {
    await kayit.fotoAl(dosyalar, (yapilan, toplam) => {
      const e = $('#fotoIlerleme');
      if (e) e.textContent = `${yapilan} / ${toplam}`;
    }, tur);
  } catch (hata) {
    ortuKapat();
    kayitBildir(`Fotoğraflar alınamadı: ${hata.message}`, 'kotu');
    return;
  }

  ortuKapat();
  await tazele();

  const atlanan = kayit.sonBasarisizlar();
  const izsiz = durum.kayitlar.filter(k => k.tur === 'foto' && !k.lat).length;
  kayitBildir(
    atlanan.length ? `${atlanan.length} dosya alınamadı, geri kalanı eklendi.`
      : izsiz ? `Eklendi. ${izsiz} fotoğrafın yeri bulunamadı — iz o saatte kapalıymış.`
              : 'Fotoğraflar eklendi ve haritaya yerleşti.',
    atlanan.length ? 'kotu' : 'iyi'
  );
}

// ------------------------------------------------------------- iz göstergesi -

function izDinle() {
  iz.dinle(async (olay) => {
    if (olay.tur === 'durum' || olay.tur === 'tasarruf') izRozetiYaz();
    if (olay.tur === 'hata') {
      $('#izYazi').textContent = 'izin yok';
      $('#izRozet').classList.remove('acik');
    }
    if (olay.tur === 'nokta') {
      durum.izNoktalari.push(olay.nokta);
      izRozetiYaz();
      if (durum.ekran === 'harita') haritaGuncelle(durum.kayitlar, durum.izNoktalari);
      await ulkeKontrol(olay.nokta);
    }
    if (olay.tur === 'konum' && durum.yolModu) {
      yaklasmaKontrol(olay.lat, olay.lon);
    }
  });
}

function izRozetiYaz() {
  const r = $('#izRozet');
  const calisiyor = iz.calisiyorMu();
  r.classList.toggle('acik', calisiyor && !iz.tasarruftaMi());
  r.classList.toggle('tasarruf', calisiyor && iz.tasarruftaMi());
  $('#izYazi').textContent = !calisiyor ? 'kapalı'
    : iz.tasarruftaMi() ? 'tasarruf' : `${durum.izNoktalari.length}`;
}

function izRozetTikla() {
  if (iz.calisiyorMu()) {
    iz.dur();
    kayitBildir('İz kaydı durdu. Harita rotayı çizmeyi bırakır.');
  } else {
    iz.basla();
  }
  izRozetiYaz();
}

// Sınır geçişini kendiliğinden zaman çizgisine yazar.
async function ulkeKontrol(nokta) {
  const u = gerok.ulkeBul(nokta.lat, nokta.lon);
  if (!u) return;
  if (durum.sonUlke && durum.sonUlke !== u.kod) {
    await kayit.sinirEkle(u.kod, u.ad, nokta.t, nokta.lat, nokta.lon);
    bildirimGoster(`${u.bayrak} ${u.ad}`, 'Yeni ülkeye girdin — zaman çizgisine işlendi.');
    titret([10, 60, 10, 60, 10]);
    await tazele();
  }
  if (durum.sonUlke !== u.kod) {
    durum.sonUlke = u.kod;
    await veri.ayarYaz('sonUlke', u.kod);
  }
}

// ------------------------------------------------- duraklar ve yaklaşma uyarısı -

// Duraklar listesi HARİTADAKİ ROTA SIRASINDA diziliyor ve aynı numaraları
// taşıyor: haritada 7 numaralı iğne, listede 7 numaralı kart. İkisi ayrı
// sıralanırsa "haritadaki hangisiydi" sorusu doğuyor.
function duraklariCiz() {
  const kap = $('#duraklarListe');
  const liste = gerok.duraklar();
  const bugun = gerok.bugununGunu();
  const s = gerok.aktifGerok();

  if (!liste.length) {
    kap.innerHTML = bosDurum('📌',
      'Henüz durak yok.<br>Haritada 📌 düğmesine basıp kendi duraklarını koyabilirsin —' +
      '<br>gerok paketi olmadan da çalışır.') +
      `<div class="daha-eski"><button class="eylem-dugme birincil" id="durakEkleBos">Haritadan durak ekle</button></div>`;
    $('#durakEkleBos').addEventListener('click', haritadanDurakEkle);
    return;
  }

  const konum = iz.sonBilinenKonum();

  // Gün gün başlıklar — rota da zaten gün gün renkleniyor.
  let html = `<div class="durak-ekle-satir">
    <button class="eylem-dugme" id="durakEkleHarita">📌 Haritadan durak ekle</button>
    <button class="eylem-dugme" id="durakEkleBurada">◎ Şu an buradayım, durak yap</button>
  </div>`;

  let sonGun = Symbol('yok');
  liste.forEach((d, i) => {
    if (d.gun !== sonGun) {
      sonGun = d.gun;
      const gunBilgi = s?.gunler?.find(g => g.no === d.gun);
      html += `<div class="gun-basligi">
        <div class="gun-no">${d.gun == null ? 'Günsüz' : `Gün ${d.gun}`}${bugun && d.gun === bugun.no ? ' · BUGÜN' : ''}</div>
        ${gunBilgi ? `<div class="gun-ad">${kacis(gunBilgi.baslik)}</div>` : ''}
      </div>`;
    }

    const dur = durum.durakDurumlari[d.id]?.durum;
    const uzaklik = konum ? iz.mesafe(konum.lat, konum.lon, d.lat, d.lon) : null;
    const kendi = d.kaynak === 'kendi';

    html += `<div class="durak-kart ${dur || ''}" data-durak="${d.id}">
      <div class="durak-ust">
        <div class="durak-ad"><span class="durak-no">${i + 1}</span>${kacis(d.ad)}</div>
        <div class="durak-sira">
          <button class="sira-dugme" data-tasi="-1" title="Yukarı">▲</button>
          <button class="sira-dugme" data-tasi="1" title="Aşağı">▼</button>
        </div>
      </div>
      ${uzaklik != null ? `<div class="durak-uzaklik">${uzaklikYaz(uzaklik)} uzakta${kendi ? ' · kendi durağın' : ''}</div>`
                        : kendi ? '<div class="durak-uzaklik">kendi durağın</div>' : ''}
      ${d.unutma?.length ? `<ul class="unutma">${d.unutma.map(u => `<li>${kacis(u)}</li>`).join('')}</ul>` : ''}
      <div class="durak-dugmeler">
        <button class="kucuk-dugme ${dur === 'gidildi' ? 'secili' : ''}" data-isaret="gidildi">Gittik</button>
        <button class="kucuk-dugme ${dur === 'kacirildi' ? 'secili' : ''}" data-isaret="kacirildi">Kaçırdık</button>
        <button class="kucuk-dugme" data-durak-google="${d.id}">Google</button>
      </div>
      ${kendi ? `<div class="durak-dugmeler">
        <button class="kucuk-dugme" data-duzenle="${d.id}">Düzenle</button>
        <button class="kucuk-dugme sil" data-durak-sil="${d.id}">Sil</button>
      </div>` : ''}
    </div>`;
  });

  kap.innerHTML = html;

  $('#durakEkleHarita').addEventListener('click', haritadanDurakEkle);
  $('#durakEkleBurada').addEventListener('click', buradanDurakEkle);

  kap.querySelectorAll('[data-durak-google]').forEach(d => {
    d.addEventListener('click', () => {
      const durak = gerok.durakBul(d.dataset.durakGoogle);
      if (durak) googleHaritalarAc({ lat: durak.lat, lon: durak.lon, ad: durak.ad, zoom: 16 });
    });
  });

  kap.querySelectorAll('[data-isaret]').forEach(d => {
    d.addEventListener('click', async (e) => {
      const id = e.target.closest('[data-durak]').dataset.durak;
      const yeni = e.target.dataset.isaret;
      const suanki = durum.durakDurumlari[id]?.durum;
      await veri.durakDurumuYaz(id, suanki === yeni ? null : yeni);
      await tazele();
    });
  });

  kap.querySelectorAll('[data-tasi]').forEach(d => {
    d.addEventListener('click', async (e) => {
      const id = e.target.closest('[data-durak]').dataset.durak;
      if (await gerok.durakTasi(id, +d.dataset.tasi)) await tazele();
      else kayitBildir('Aynı günün içinde daha ileri gitmiyor.');
    });
  });

  kap.querySelectorAll('[data-duzenle]').forEach(d => {
    d.addEventListener('click', () => durakSor({ mevcut: gerok.durakBul(d.dataset.duzenle) }));
  });
  kap.querySelectorAll('[data-durak-sil]').forEach(d => {
    d.addEventListener('click', () => durakSilSor(d.dataset.durakSil));
  });
}

// ---- Kendi durağını koyma --------------------------------------------------
//
// Haritanın ortasında bir nişangâh var; kullanıcı haritayı kaydırıp iğneyi
// yerleştiriyor. "Basılı tut" yerine bu seçildi: harita zaten parmakla
// kaydırılıyor, basılı tutma ikisini birbirine karıştırıyor. Nişangâh
// tek elle, araç sallanırken de isabetli.

function durakKoymaKipi(ac) {
  $('#haritaNisan').classList.toggle('gizli', !ac);
  $('#haritaEkleBar').classList.toggle('gizli', !ac);
  $('#haritaDurak').classList.toggle('secili', ac);
}

function haritadanDurakEkle() {
  ekranAc('harita');
  haritaKur().then(() => {
    durakKoymaKipi(true);
    kayitBildir('Haritayı kaydır, sonra "Buraya durak ekle" de.');
  });
}

async function buradanDurakEkle() {
  kayitBildir('Konum alınıyor…');
  const k = await iz.suAnkiKonum();
  if (!k) { kayitBildir('Konum alınamadı. Haritadan elle koyabilirsin.', 'kotu'); return; }
  durakSor({ lat: k.lat, lon: k.lon });
}

function durakNoktasiOnayla() {
  const m = haritaMerkezi();
  durakKoymaKipi(false);
  if (!m) { kayitBildir('Harita henüz hazır değil.', 'kotu'); return; }
  durakSor({ lat: m.lat, lon: m.lon });
}

// Gün seçenekleri: paket varsa paketin günleri, yoksa 1–10.
// Paketi olmayan biri (başka turdaki bir arkadaş) da günlerini numaralayabilsin.
function gunSecenekleri() {
  const g = gerok.aktifGerok()?.gunler;
  if (g?.length) return g.map(x => ({ no: x.no, ad: `Gün ${x.no}` }));
  return Array.from({ length: 10 }, (_, i) => ({ no: i + 1, ad: `Gün ${i + 1}` }));
}

function durakSor({ lat, lon, mevcut = null }) {
  const d = mevcut;
  const enlem = d ? d.lat : lat, boylam = d ? d.lon : lon;
  const secilenGun = d ? d.gun : (gerok.bugununGunu()?.no ?? null);

  ortuAc(`
    <div class="ortu-baslik">${d ? 'Durağı düzenle' : 'Yeni durak'}</div>
    <div class="ortu-alt">Haritada rotaya eklenecek ve sıradaki yerini alacak.
    Akşam paket gönderdiğinde arkadaşının telefonuna da geçer.</div>

    <div class="girdi-etiket">Adı</div>
    <input class="girdi" id="durakAd" placeholder="Şelale, kahvaltı yeri, köprü…" value="${kacis(d?.ad || '')}">

    <div class="girdi-etiket">Hangi gün?</div>
    <div class="secenekler" id="durakGun">
      ${gunSecenekleri().map(g =>
        `<button class="kucuk-dugme ${g.no === secilenGun ? 'secili' : ''}" data-gun="${g.no}">${g.ad}</button>`).join('')}
      <button class="kucuk-dugme ${secilenGun == null ? 'secili' : ''}" data-gun="">Günsüz</button>
    </div>

    <div class="girdi-etiket">Unutma listesi — her satıra bir şey</div>
    <textarea class="alan" id="durakUnutma" placeholder="Fotoğraf çek&#10;Su al&#10;Giriş ücreti var mı?">${kacis((d?.unutma || []).join('\n'))}</textarea>

    <div class="panel-not">Konum: ${(+enlem).toFixed(5)}, ${(+boylam).toFixed(5)}</div>
    <button class="eylem-dugme birincil" id="durakKaydet">${d ? 'Kaydet' : 'Durağı ekle'}</button>
    <button class="eylem-dugme" id="durakVaz">Vazgeç</button>
  `);

  setTimeout(() => $('#durakAd').focus(), 120);

  $$('#durakGun [data-gun]').forEach(b => {
    b.addEventListener('click', () => {
      $$('#durakGun [data-gun]').forEach(x => x.classList.remove('secili'));
      b.classList.add('secili');
    });
  });
  $('#durakVaz').addEventListener('click', ortuKapat);

  $('#durakKaydet').addEventListener('click', async () => {
    const ad = $('#durakAd').value.trim();
    if (!ad) { $('#durakAd').focus(); return; }
    const gunMetni = $('#durakGun .secili')?.dataset.gun ?? '';
    const gun = gunMetni === '' ? null : +gunMetni;
    const unutma = $('#durakUnutma').value.split('\n').map(x => x.trim()).filter(Boolean);
    ortuKapat();

    if (d) {
      await gerok.durakDuzenle(d.id, { ad, gun, unutma });
      kayitBildir('Durak güncellendi.', 'iyi');
    } else {
      await gerok.durakEkle({ ad, lat: enlem, lon: boylam, gun, unutma });
      kayitBildir(`"${ad}" rotaya eklendi.`, 'iyi');
    }
    await tazele();
    if (durum.ekran === 'harita') haritaGuncelle(durum.kayitlar, durum.izNoktalari);
  });
}

function durakSilSor(id) {
  const d = gerok.durakBul(id);
  if (!d) return;
  ortuAc(`
    <div class="ortu-baslik">"${kacis(d.ad)}" silinsin mi?</div>
    <div class="ortu-alt">Rotadan çıkar. Bu durakta yaptığın kayıtlar (ses, fotoğraf, not)
    silinmez — onlar yerinde kalır.</div>
    <button class="eylem-dugme birincil" id="durakSilOnay">Sil</button>
    <button class="eylem-dugme" id="durakSilVaz">Vazgeç</button>
  `);
  $('#durakSilVaz').addEventListener('click', ortuKapat);
  $('#durakSilOnay').addEventListener('click', async () => {
    ortuKapat();
    await gerok.durakYokEt(id);
    kayitBildir('Durak silindi.', 'iyi');
    await tazele();
    if (durum.ekran === 'harita') haritaGuncelle(durum.kayitlar, durum.izNoktalari);
  });
}

// Haritada bir durak iğnesine dokununca açılan kart.
function durakKartiAc(id) {
  // Durak koyarken haritaya dokunmak kart açmasın — o an iş nişangâhta.
  if (!$('#haritaNisan').classList.contains('gizli')) return;
  const d = gerok.durakBul(id);
  if (!d) return;
  const konum = iz.sonBilinenKonum();
  const uzaklik = konum ? iz.mesafe(konum.lat, konum.lon, d.lat, d.lon) : null;
  const dur = durum.durakDurumlari[id]?.durum;
  const sira = gerok.duraklar().findIndex(x => x.id === id) + 1;

  ortuAc(`
    <div class="ortu-baslik"><span class="durak-no">${sira}</span>${kacis(d.ad)}</div>
    <div class="ortu-alt">${d.gun == null ? 'Günsüz' : `Gün ${d.gun}`}${uzaklik != null ? ` · ${uzaklikYaz(uzaklik)} uzakta` : ''}${d.kaynak === 'kendi' ? ' · kendi durağın' : ''}</div>
    ${d.unutma?.length ? `<ul class="unutma">${d.unutma.map(u => `<li>${kacis(u)}</li>`).join('')}</ul>` : ''}
    <div class="durak-dugmeler">
      <button class="kucuk-dugme ${dur === 'gidildi' ? 'secili' : ''}" id="kartGidildi">Gittik</button>
      <button class="kucuk-dugme ${dur === 'kacirildi' ? 'secili' : ''}" id="kartKacirildi">Kaçırdık</button>
    </div>
    <button class="eylem-dugme" id="kartGoogle">Google Haritalar'da aç</button>
    ${d.kaynak === 'kendi' ? '<button class="eylem-dugme" id="kartDuzenle">Düzenle</button>' : ''}
    <button class="eylem-dugme" id="kartKapat">Kapat</button>
  `);

  $('#kartKapat').addEventListener('click', ortuKapat);
  $('#kartGoogle').addEventListener('click', () =>
    googleHaritalarAc({ lat: d.lat, lon: d.lon, ad: d.ad, zoom: 16 }));
  $('#kartDuzenle')?.addEventListener('click', () => durakSor({ mevcut: d }));

  for (const [dugme, deger] of [['#kartGidildi', 'gidildi'], ['#kartKacirildi', 'kacirildi']]) {
    $(dugme).addEventListener('click', async () => {
      ortuKapat();
      await veri.durakDurumuYaz(id, dur === deger ? null : deger);
      await tazele();
    });
  }
}

const YAKLASMA_METRE = 2000;

function yaklasmaKontrol(lat, lon) {
  for (const { durak, uzaklik } of gerok.yakinDuraklar(lat, lon, YAKLASMA_METRE)) {
    if (durum.uyarilmisDuraklar.has(durak.id)) continue;
    durum.uyarilmisDuraklar.add(durak.id);
    veri.ayarYaz('uyarilmisDuraklar', Array.from(durum.uyarilmisDuraklar));
    yaklasmaUyarisi(durak, uzaklik);
    break;                              // aynı anda tek uyarı, üst üste binmesin
  }
}

function yaklasmaUyarisi(durak, uzaklik) {
  titret([200, 100, 200, 100, 200]);
  uyariSesi();
  bildirimGoster(durak.ad, `${uzaklikYaz(uzaklik)} kaldı`);

  ortuAc(`
    <div class="panel uyari-kart">
      <div class="uyari-baslik">Yaklaşıyorsun · ${uzaklikYaz(uzaklik)}</div>
      <div class="ortu-baslik" style="margin-top:8px">${kacis(durak.ad)}</div>
      ${durak.unutma?.length
        ? `<ul class="unutma">${durak.unutma.map(u => `<li>${kacis(u)}</li>`).join('')}</ul>`
        : '<div class="ortu-alt">Not yok.</div>'}
    </div>
    <button class="eylem-dugme birincil" id="uyariTamam">Tamam</button>
  `);
  $('#uyariTamam').addEventListener('click', ortuKapat);
}

// Uyarı sesi için ses düzeneği.
//
// iOS'ta AudioContext yalnızca bir DOKUNUŞ sırasında açılırsa çalabiliyor;
// sonradan kendiliğinden çalmak isteyince askıda kalıp sessiz kalıyor.
// iPhone'da navigator.vibrate de yok. Yani Yol Modu açılırken burayı
// hazırlamazsak durağa yaklaşma uyarısı sessiz gelir — oysa bütün amacı
// ekrana bakmadan fark ettirmek.
let sesDuzenegi = null;

export async function sesDuzenegiHazirla() {
  try {
    if (!sesDuzenegi) sesDuzenegi = new (window.AudioContext || window.webkitAudioContext)();
    if (sesDuzenegi.state === 'suspended') await sesDuzenegi.resume();
    return sesDuzenegi.state === 'running';
  } catch {
    return false;
  }
}

function uyariSesi() {
  try {
    const ac = sesDuzenegi || new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === 'suspended') ac.resume().catch(() => {});
    [0, 0.18, 0.36].forEach((gecikme, i) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.frequency.value = [660, 880, 660][i];
      o.connect(g); g.connect(ac.destination);
      g.gain.setValueAtTime(0.0001, ac.currentTime + gecikme);
      g.gain.exponentialRampToValueAtTime(0.28, ac.currentTime + gecikme + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + gecikme + 0.15);
      o.start(ac.currentTime + gecikme);
      o.stop(ac.currentTime + gecikme + 0.16);
    });
  } catch { /* ses açılamazsa titreşim zaten var */ }
}

// Yol Modu: ekranı açık tutar, iz sıklaşır, yaklaşma uyarıları devrede.
async function yolModuDegistir() {
  durum.yolModu = !durum.yolModu;
  $('#btnYolModu').classList.toggle('acik', durum.yolModu);

  if (durum.yolModu) {
    iz.basla();
    // Dokunuş hâlâ sürüyorken ses düzeneğini aç — sonra uyarı sessiz kalmasın.
    const sesVar = await sesDuzenegiHazirla();
    try {
      durum.uyanikKilit = await navigator.wakeLock?.request('screen');
      durum.uyanikKilit?.addEventListener('release', () => { durum.uyanikKilit = null; });
    } catch { /* Wake Lock yoksa ekran normal davranır */ }
    $('#btnYolModu .yol-alt').textContent =
      (durum.uyanikKilit ? 'Açık — ekran sönmeyecek' : 'Açık') +
      (sesVar ? ', durağa yaklaşınca sesle uyaracak' : ', uyarı ekranda çıkacak (ses açılamadı)');
    kayitBildir('Yol Modu açık. Telefonu şarjda tut.', 'iyi');
  } else {
    durum.uyanikKilit?.release();
    durum.uyanikKilit = null;
    $('#btnYolModu .yol-alt').textContent = 'Ekran açık kalır, durağa yaklaşınca uyarır';
  }
}

// Sekme arkaya alınıp geri gelince Wake Lock düşer; geri geldiğinde tazele.
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible' && durum.yolModu && !durum.uyanikKilit) {
    try { durum.uyanikKilit = await navigator.wakeLock?.request('screen'); } catch { /* yok say */ }
  }
});

// ------------------------------------------------------------- Gerok paneli -

async function paneliCiz() {
  const s = gerok.aktifGerok();
  const depo = await veri.depolamaDurumu();
  const sahip = kayit.sahipAl();
  const km = iz.izUzunlugu(durum.izNoktalari);
  const sesler = durum.kayitlar.filter(k => ['ses', 'ortam', 'gunluk'].includes(k.tur)).length;
  const fotolar = durum.kayitlar.filter(k => ['foto', 'video', 'siradan'].includes(k.tur)).length;
  const ozelVarMi = {
    baslangic: durum.kayitlar.some(k => k.tur === 'baslangic'),
    bitis: durum.kayitlar.some(k => k.tur === 'bitis'),
    mektup: durum.kayitlar.some(k => k.tur === 'mektup')
  };

  $('#gerokPanel').innerHTML = `
    <div class="panel">
      <div class="panel-baslik">Bu gerok</div>
      ${s ? `
        <div class="panel-satir"><span class="etiket">Gerok</span><span class="deger">${kacis(s.ad)}</span></div>
        <div class="panel-satir"><span class="etiket">Kayıt</span><span class="deger">${durum.kayitlar.length}</span></div>
        <div class="panel-satir"><span class="etiket">Sesli</span><span class="deger">${sesler}</span></div>
        <div class="panel-satir"><span class="etiket">Görsel</span><span class="deger">${fotolar}</span></div>
        <div class="panel-satir"><span class="etiket">İz</span><span class="deger">${km.toFixed(1)} km · ${durum.izNoktalari.length} nokta</span></div>
      ` : '<div class="panel-not">Gerok paketi yüklenmedi.</div>'}
      <button class="eylem-dugme birincil" id="btnGunSonu">Gün Sonu</button>
    </div>

    <div class="panel">
      <div class="panel-baslik">Harcamalar</div>
      ${harcamalarPaneli()}
    </div>

    <div class="panel">
      <div class="panel-baslik">Görünüm</div>
      <div class="panel-not">Gündüz araç camından, gece otel odasında.
      Otomatik'te telefonun kendi ayarını izler.</div>
      <div class="secenekler" id="temaSecenek">
        ${TEMALAR.map(t => `<button class="kucuk-dugme" data-tema="${t.id}">${t.ad}</button>`).join('')}
      </div>
    </div>

    <div class="panel">
      <div class="panel-baslik">Eşitleme</div>
      <div class="panel-not">Akşam otelde: sen gönder, arkadaşın alsın. İnternet gerekmez —
      AirDrop iki telefon arasında doğrudan çalışır.</div>
      <button class="eylem-dugme" id="btnGonder">Günümü gönder (AirDrop)</button>
      <button class="eylem-dugme" id="btnAl">Gelen paketi al</button>
      <button class="eylem-dugme" id="btnYedek">Yedek al (Dosyalar'a)</button>
    </div>

    <div class="panel">
      <div class="panel-baslik">Kim</div>
      <div class="panel-satir"><span class="etiket">Bu telefon</span><span class="deger">${kacis(sahip.ad || '—')}</span></div>
      <div class="panel-not">Her kaydın kime ait olduğu yazılır. On yıl sonra
      "bunu kim söylemişti" sorusunun cevabı bu.</div>
      <button class="eylem-dugme" id="btnAd">Adımı değiştir</button>
    </div>

    <div class="panel">
      <div class="panel-baslik">Harita ve depolama</div>
      <div class="panel-satir"><span class="etiket">Offline harita</span>
        <span class="deger" id="haritaDurum">bakılıyor…</span></div>
      ${depo ? `
        <div class="panel-satir"><span class="etiket">Kullanılan</span><span class="deger">${boyutYaz(depo.kullanilan)}</span></div>
        <div class="panel-satir"><span class="etiket">Kalıcı depolama</span>
          <span class="deger">${depo.kalici ? 'evet' : 'hayır'}</span></div>
      ` : ''}
      <button class="eylem-dugme" id="btnHarita">Harita paketini indir</button>
      ${!depo?.kalici ? '<button class="eylem-dugme" id="btnKalici">Kalıcı depolama iste</button>' : ''}
    </div>

    <div class="panel">
      <div class="panel-baslik">Gerok başı ve sonu</div>
      <div class="panel-not">Anıları bir döneme oturtan çerçeve. Başlangıcı yola
      çıkmadan, bitişi ve mektubu son gece kaydet.</div>
      <button class="eylem-dugme" id="btnBaslangic">Başlangıç kaydı${ozelVarMi.baslangic ? ' ✓' : ''}</button>
      <button class="eylem-dugme" id="btnBitis">Bitiş kaydı${ozelVarMi.bitis ? ' ✓' : ''}</button>
      <button class="eylem-dugme" id="btnMektup">2036'ya mektup${ozelVarMi.mektup ? ' ✓' : ''}</button>
    </div>

    <div class="panel">
      <div class="panel-baslik">Gerok paketi</div>
      <div class="panel-not">Rota, duraklar ve hatırlatıcılar bu dosyadan geliyor.
      Uygulamanın koduna gömülü değil.</div>
      <button class="eylem-dugme" id="btnPaket">Gerok paketi yükle</button>
    </div>
  `;

  $('#btnHarcamaListe')?.addEventListener('click', harcamaDokumuAc);
  $('#btnHarcamaEkle')?.addEventListener('click', fiyatSor);
  temaSecenekleriniKur();

  $('#btnGunSonu').addEventListener('click', () => gunSonuAc(durum, tazele));
  $('#btnGonder').addEventListener('click', () => paketGonder(kayitBildir));
  $('#btnAl').addEventListener('click', () => paketAl(kayitBildir, tazele));
  $('#btnYedek').addEventListener('click', () => yedekAl(kayitBildir));
  $('#btnAd').addEventListener('click', adSor);
  $('#btnBaslangic').addEventListener('click', () => baslangicKaydiAc(tazele));
  $('#btnBitis').addEventListener('click', () => bitisKaydiAc(tazele));
  $('#btnMektup').addEventListener('click', () => mektupAc(tazele));
  $('#btnPaket').addEventListener('click', () => $('#dosyaSecici').click());
  $('#btnHarita').addEventListener('click', haritaIndirmeSor);
  $('#btnKalici')?.addEventListener('click', async () => {
    const s = await veri.kaliciDepolamaIste();
    kayitBildir(s.kalici ? 'Kalıcı depolama açıldı.' : 'iOS şimdilik vermedi — yedek almayı ihmal etme.',
      s.kalici ? 'iyi' : 'kotu');
    paneliCiz();
  });

  const { haritaVarMi } = await import('./harita.js');
  const varMi = await haritaVarMi();
  const e = $('#haritaDurum');
  if (e) e.textContent = varMi ? `${boyutYaz(varMi)} · hazır` : 'indirilmedi';
}

// --------------------------------------------------------------- diyaloglar -

function adSor() {
  ortuAc(`
    <div class="ortu-baslik">Adın ne?</div>
    <div class="ortu-alt">Her kaydın kime ait olduğu bununla yazılacak.
    İki telefonun kayıtları birleşince kimin ne söylediği belli olsun diye.</div>
    <input class="girdi" id="adGirdi" placeholder="Adın" autocomplete="off" enterkeyhint="done">
    <button class="eylem-dugme birincil" id="adKaydet">Kaydet</button>
  `, false);

  const girdi = $('#adGirdi');
  girdi.value = kayit.sahipAl().ad || '';
  setTimeout(() => girdi.focus(), 120);

  const kaydet = async () => {
    const ad = girdi.value.trim();
    if (!ad) return;
    await veri.ayarYaz('kullaniciAdi', ad);
    kayit.sahipAyarla({ ...kayit.sahipAl(), ad });
    ortuKapat();
    await tazele();
  };
  $('#adKaydet').addEventListener('click', kaydet);
  girdi.addEventListener('keydown', (e) => { if (e.key === 'Enter') kaydet(); });
}

function yaziSor() {
  ortuAc(`
    <div class="ortu-baslik">Yazı notu</div>
    <textarea class="alan" id="yaziAlan" placeholder="Ne oldu?"></textarea>
    <button class="eylem-dugme birincil" id="yaziKaydet">Kaydet</button>
  `);
  setTimeout(() => $('#yaziAlan').focus(), 120);
  $('#yaziKaydet').addEventListener('click', async () => {
    const m = $('#yaziAlan').value;
    ortuKapat();
    if (await kayit.yaziEkle(m)) { kayitBildir('Yazı kaydedildi.', 'iyi'); await tazele(); }
  });
}

function kisiSor() {
  ortuAc(`
    <div class="ortu-baslik">Tanıştığımız kişi</div>
    <div class="ortu-alt">Üç günde unutulur, on yıl sonra aranır.</div>
    <div class="girdi-etiket">Adı</div>
    <input class="girdi" id="kisiAd" placeholder="Rehber, otelci, yol arkadaşı…">
    <div class="girdi-etiket">Tek satır not</div>
    <input class="girdi" id="kisiNot" placeholder="Nerede, nasıl tanıştık?">
    <button class="eylem-dugme birincil" id="kisiKaydet">Kaydet</button>
  `);
  setTimeout(() => $('#kisiAd').focus(), 120);
  $('#kisiKaydet').addEventListener('click', async () => {
    const ad = $('#kisiAd').value, not = $('#kisiNot').value;
    ortuKapat();
    if (await kayit.kisiEkle(ad, not)) { kayitBildir('Kaydedildi.', 'iyi'); await tazele(); }
  });
}

function fiyatSor() {
  // Son kullanılan para birimi hatırlanıyor: aynı ülkede her seferinde
  // yeniden yazmak zorunda kalma.
  const sonPara = durum.sonParaBirimi || '';

  ortuAc(`
    <div class="ortu-baslik">Harcama</div>
    <div class="ortu-alt">Ne kadar parayı neye verdiğin yazılsın. Hem hesap tutar,
    hem "Belgrad'da kahve 120 dinardı" on yıl sonra bir sayfa yazıdan iyi anlatır.</div>
    <div class="girdi-etiket">Ne için?</div>
    <input class="girdi" id="fiyatNe" placeholder="Kahve, bilet, akşam yemeği…">
    <div class="girdi-etiket">Ne kadar?</div>
    <input class="girdi" id="fiyatTutar" placeholder="120" inputmode="decimal">
    <div class="girdi-etiket">Para birimi</div>
    <input class="girdi" id="fiyatPara" placeholder="dinar, euro, lek, marka…" value="${kacis(sonPara)}">
    <div class="girdi-etiket">Kategori</div>
    <div class="secenekler" id="fiyatKategori">
      ${kayit.HARCAMA_KATEGORILERI.map((k, i) =>
        `<button class="kucuk-dugme ${i === 0 ? 'secili' : ''}" data-kategori="${kacis(k)}">${kacis(k)}</button>`).join('')}
    </div>
    <button class="eylem-dugme birincil" id="fiyatKaydet">Kaydet</button>
  `);
  setTimeout(() => $('#fiyatNe').focus(), 120);

  $$('#fiyatKategori [data-kategori]').forEach(d => {
    d.addEventListener('click', () => {
      $$('#fiyatKategori [data-kategori]').forEach(x => x.classList.remove('secili'));
      d.classList.add('secili');
    });
  });

  $('#fiyatKaydet').addEventListener('click', async () => {
    const ne = $('#fiyatNe').value, tutar = $('#fiyatTutar').value, para = $('#fiyatPara').value;
    const kategori = $('#fiyatKategori .secili')?.dataset.kategori || '';
    ortuKapat();
    if (await kayit.fiyatEkle(ne, tutar, para, kategori)) {
      durum.sonParaBirimi = para.trim();
      await veri.ayarYaz('sonParaBirimi', durum.sonParaBirimi);
      kayitBildir('Harcama kaydedildi.', 'iyi');
      await tazele();
    }
  });
}

// ------------------------------------------------------------------ tema --

function temaSecenekleriniKur() {
  const isaretle = () => {
    const s = temaSecimi();
    $$('#temaSecenek [data-tema]').forEach(d => d.classList.toggle('secili', d.dataset.tema === s));
  };
  $$('#temaSecenek [data-tema]').forEach(d => {
    d.addEventListener('click', () => {
      temaSec(d.dataset.tema);
      isaretle();
    });
  });
  isaretle();
}

// ------------------------------------------------------------- harcamalar --
//
// Kur çevirmesi YOK. Altı ülkede altı para birimi var ve kurlar internet ister;
// uydurma bir kurla toplam vermektense her para birimi kendi başına toplanıyor.

// "1.450" bin dört yüz elli, "12,5" on iki buçuk. Türkçe yazılışta nokta
// binlik ayracı — düz parseFloat 1.450'yi 1,45 okuyup toplamı mahvediyor.
// Kural: virgül varsa ondalık odur, noktalar atılır. Yalnızca nokta varsa ve
// son öbek tam üç haneliyse binlik ayracıdır; değilse ondalıktır ("12.5").
export function tutarSayi(metin) {
  let s = String(metin ?? '').replace(/[^\d.,-]/g, '');
  if (!s) return 0;

  if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else {
    const obekler = s.split('.');
    if (obekler.length > 1 && obekler.slice(1).every(o => o.length === 3)) s = obekler.join('');
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

function harcamalariTopla() {
  const hepsi = durum.kayitlar.filter(k => k.tur === 'fiyat');
  const sayi = tutarSayi;

  const paralar = new Map();     // para birimi → toplam
  const kategoriler = new Map(); // kategori → { para → toplam }
  const gunler = new Map();      // gün → { para → toplam }

  for (const k of hepsi) {
    const p = (k.paraBirimi || '—').trim() || '—';
    const t = sayi(k.tutar);
    paralar.set(p, (paralar.get(p) || 0) + t);

    const kat = k.kategori || 'Diğer';
    if (!kategoriler.has(kat)) kategoriler.set(kat, new Map());
    const kp = kategoriler.get(kat);
    kp.set(p, (kp.get(p) || 0) + t);

    const g = k.gun ?? 'disi';
    if (!gunler.has(g)) gunler.set(g, new Map());
    const gp = gunler.get(g);
    gp.set(p, (gp.get(p) || 0) + t);
  }
  return { hepsi, paralar, kategoriler, gunler };
}

function tutarYaz(harita) {
  const satirlar = Array.from(harita.entries())
    .filter(([, t]) => t > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([p, t]) => `${t.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ${kacis(p)}`);
  return satirlar.length ? satirlar.join(' · ') : '—';
}

function harcamalarPaneli() {
  const { hepsi, paralar } = harcamalariTopla();
  if (!hepsi.length) {
    return `<div class="panel-not">Henüz harcama yok. Kayıt sekmesinden
      <b>Harcama</b> ile ekle — her biri saatiyle zaman çizgisine de düşer.</div>
      <button class="eylem-dugme" id="btnHarcamaEkle">Harcama ekle</button>`;
  }
  return `
    <div class="panel-satir"><span class="etiket">Toplam</span>
      <span class="deger">${tutarYaz(paralar)}</span></div>
    <div class="panel-satir"><span class="etiket">Kayıt</span>
      <span class="deger">${hepsi.length} harcama</span></div>
    <button class="eylem-dugme" id="btnHarcamaListe">Dökümü gör</button>
    <button class="eylem-dugme" id="btnHarcamaEkle">Harcama ekle</button>`;
}

function harcamaDokumuAc() {
  const { hepsi, paralar, kategoriler, gunler } = harcamalariTopla();
  const s = gerok.aktifGerok();

  const gunAdi = (g) => {
    if (g === 'disi') return 'Gerok dışı';
    const gun = s?.gunler?.find(x => x.no === g);
    return gun ? `Gün ${g} · ${gun.baslik}` : `Gün ${g}`;
  };

  const gunSirali = Array.from(gunler.keys()).sort((a, b) => {
    if (a === 'disi') return 1;
    if (b === 'disi') return -1;
    return a - b;
  });

  ortuAc(`
    <div class="ortu-baslik">Harcamalar</div>
    <div class="ortu-alt">Toplam: <b>${tutarYaz(paralar)}</b><br>
    Para birimleri ayrı toplanıyor — kur çevirmesi internet ister, uydurulmuyor.</div>

    <div class="girdi-etiket">Kategoriye göre</div>
    ${Array.from(kategoriler.entries()).map(([kat, p]) =>
      `<div class="panel-satir"><span class="etiket">${kacis(kat)}</span>
        <span class="deger">${tutarYaz(p)}</span></div>`).join('')}

    <div class="girdi-etiket" style="margin-top:16px">Güne göre</div>
    ${gunSirali.map(g =>
      `<div class="panel-satir"><span class="etiket">${kacis(gunAdi(g))}</span>
        <span class="deger">${tutarYaz(gunler.get(g))}</span></div>`).join('')}

    <div class="girdi-etiket" style="margin-top:16px">Tek tek (${hepsi.length})</div>
    <div class="harcama-liste">
      ${hepsi.slice().reverse().map(k => `
        <div class="harcama-satir">
          <div class="harcama-sol">
            <div class="harcama-ne">${kacis(k.metin)}</div>
            <div class="harcama-alt">${k.gun ? `Gün ${k.gun} · ` : ''}${kacis(gerok.saat(k.t))}${k.kategori ? ` · ${kacis(k.kategori)}` : ''} · ${kacis(k.sahipAd || '')}</div>
          </div>
          <div class="harcama-tutar">${kacis(k.tutar || '—')} ${kacis(k.paraBirimi || '')}</div>
        </div>`).join('')}
    </div>
    <button class="eylem-dugme" id="harcamaKapat">Kapat</button>
  `);
  $('#harcamaKapat').addEventListener('click', ortuKapat);
}

async function haritaIndirmeSor() {
  const { haritaIndir } = await import('./harita.js');
  ortuAc(`
    <div class="ortu-baslik">Offline harita</div>
    <div class="ortu-alt">357 MB, beş parça halinde iner. Altı ülkenin tamamı, sokak seviyesinde.
    <b>Ev wifi'sinde indir</b> — yolda internet olmayacak.
    Yarıda kesilirse sorun değil: <b>Tekrar dene</b> kaldığı yerden sürdürür.</div>
    <div id="haritaIlerleme" class="panel-not">Hazır.</div>
    <button class="eylem-dugme birincil" id="haritaBasla">İndir</button>
  `);
  $('#haritaBasla').addEventListener('click', async () => {
    $('#haritaBasla').textContent = 'İndiriliyor…';
    $('#haritaBasla').disabled = true;
    try {
      await haritaIndir((inen, toplam) => {
        const e = $('#haritaIlerleme');
        if (e) e.textContent = toplam
          ? `${boyutYaz(inen)} / ${boyutYaz(toplam)} — %${Math.round(inen / toplam * 100)}`
          : boyutYaz(inen);
      });
      ortuKapat();
      kayitBildir('Harita indirildi. Artık internetsiz çalışır.', 'iyi');
      paneliCiz();
    } catch (hata) {
      const e = $('#haritaIlerleme');
      if (e) e.textContent = `Kesildi: ${hata.message} — inen parçalar duruyor, "Tekrar dene" kaldığı yerden sürdürür.`;
      $('#haritaBasla').textContent = 'Tekrar dene';
      $('#haritaBasla').disabled = false;
    }
  });
}

$('#dosyaSecici').addEventListener('change', async (e) => {
  const dosya = e.target.files[0];
  e.target.value = '';
  if (!dosya) return;
  try {
    const s = await gerok.paketYukle(await dosya.text());
    kayitBildir(`"${s.ad}" yüklendi · ${s.gunler.length} gün, ${s.duraklar.length} durak`, 'iyi');
    await tazele();
  } catch (hata) {
    kayitBildir(hata.message, 'kotu');
  }
});

// ------------------------------------------------------ Gün Sonu hatırlatma -

function gunSonuHatirlatmasiKur() {
  const bak = async () => {
    const simdi = new Date();
    if (simdi.getHours() !== 21 || simdi.getMinutes() > 12) return;
    const bugun = simdi.toISOString().slice(0, 10);
    if (await veri.ayarOku('gunSonuHatirlatildi') === bugun) return;
    if (!gerok.bugununGunu()) return;
    await veri.ayarYaz('gunSonuHatirlatildi', bugun);
    bildirimGoster('Gün Sonu', 'Bugünden aklında ne kaldı? 90 saniye.');
    titret([100, 80, 100]);
  };
  bak();
  setInterval(bak, 5 * 60 * 1000);
}

async function bildirimGoster(baslik, govde) {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') {
    try { await Notification.requestPermission(); } catch { return; }
  }
  if (Notification.permission !== 'granted') return;
  try {
    const kayit = await navigator.serviceWorker?.ready;
    if (kayit) kayit.showNotification(baslik, { body: govde, icon: 'ikon/ikon-180.png', tag: 'gerok' });
    else new Notification(baslik, { body: govde });
  } catch { /* bildirim olmasa da uygulama içi uyarı zaten var */ }
}

// ------------------------------------------------------------- yardımcılar --

export function ortuAc(html, kapanabilir = true) {
  $('#ortuIc').innerHTML = html;
  $('#ortu').classList.remove('gizli');
  $('#ortu').onclick = kapanabilir
    ? (e) => { if (e.target.id === 'ortu') ortuKapat(); }
    : null;
}
export function ortuKapat() {
  $('#ortu').classList.add('gizli');
  $('#ortuIc').innerHTML = '';
}

// Bildirimler ekranın üstünde yüzen bir şeritte gösteriliyor. Önce yalnızca
// Kayıt ekranındaki satıra yazılıyordu; başka bir sekmedeyken hata mesajı
// hiç görünmüyordu — ses çalmayınca sebebi de görünmüyordu.
export function kayitBildir(mesaj, sinif = '') {
  const e = $('#kayitDurum');
  if (e) {
    e.textContent = mesaj;
    e.className = `kayit-durum ${sinif}`;
    clearTimeout(e._sayac);
    e._sayac = setTimeout(() => { e.textContent = ''; e.className = 'kayit-durum'; }, 5000);
  }

  const t = $('#bildirim');
  if (!t) return;
  t.textContent = mesaj;
  t.className = `bildirim ${sinif}`;
  clearTimeout(t._sayac);
  t._sayac = setTimeout(() => t.classList.add('gizli'), sinif === 'kotu' ? 8000 : 4000);
}

function titret(desen) { try { navigator.vibrate?.(desen); } catch { /* desteklenmiyor */ } }

export function kacis(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function sureYaz(saniye) {
  if (saniye == null) return '—';
  const s = Math.floor(saniye);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function boyutYaz(bayt) {
  if (!bayt) return '0';
  const b = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(b.length - 1, Math.floor(Math.log(bayt) / Math.log(1024)));
  return `${(bayt / Math.pow(1024, i)).toFixed(i ? 1 : 0)} ${b[i]}`;
}

export function uzaklikYaz(metre) {
  return metre < 1000 ? `${Math.round(metre)} m` : `${(metre / 1000).toFixed(1)} km`;
}

function bosDurum(ikon, yazi) {
  return `<div class="bos-durum"><div class="bos-ikon">${ikon}</div><div class="bos-yazi">${yazi}</div></div>`;
}

// --------------------------------------------------------------- servis worker -

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(e => console.warn('sw kaydı olmadı', e));
}

baslat();

export { tazele, durum };
