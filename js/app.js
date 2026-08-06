// Gerok — uygulama omurgası: açılış, ekran yönlendirme, arayüz.

import * as veri from './veri.js';
import * as iz from './iz.js';
import * as gerok from './gerok.js';
import * as kayit from './kayit.js';
import { haritaKur, haritaGuncelle, haritaBoyutTazele, konumaGit, hepsiniGoster,
         kipDegistir, aktifKipAl, haritaMerkezi } from './harita.js';
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

  const gruplar = new Map();
  for (const k of durum.kayitlar) {
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
  kap.innerHTML = html;

  kap.querySelectorAll('[data-ses]').forEach(d => {
    d.addEventListener('click', () => sesCal(d.dataset.ses, d, d.dataset.bicim, +d.dataset.sure || 0));
  });
  kap.querySelectorAll('[data-onizleme]').forEach(async (d) => {
    const url = await veri.medyaUrl(d.dataset.onizleme, 'image/jpeg');
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
    govde += `<button class="ses-oynat" data-ses="${k.medyaId}" data-bicim="${kacis(k.bicim || '')}" data-sure="${k.sure || 0}">
      <span class="ikon">▶</span><span class="sure">${sureYaz(k.sure)}</span>
    </button>`;
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
let calan = null;

function calaniBirak() {
  if (!calan) return;
  clearInterval(calan.sayac);
  try { calan.ses ? calan.ses.pause() : calan.kaynak?.stop(); } catch { /* zaten durmuş */ }
  calan.ikon.textContent = '▶';
  if (calan.sure) calan.sure.textContent = calan.ilkYazi;
  URL.revokeObjectURL(calan.url);
  calan = null;
}

function sayaciBasla(gecenSaniye) {
  calan.sayac = setInterval(() => {
    if (calan?.sure) calan.sure.textContent = sureYaz(gecenSaniye());
  }, 200);
}

async function sesCal(medyaId, dugme, bicim = '', kayitliSure = 0) {
  // Aynı kayda ikinci dokunuş: duraklat ya da devam et.
  if (calan && calan.medyaId === medyaId) {
    const duruyor = calan.ses ? calan.ses.paused : calan.ac.state === 'suspended';
    if (duruyor) {
      (calan.ses ? calan.ses.play() : calan.ac.resume()).catch?.(() => {});
      calan.ikon.textContent = '⏸';
    } else {
      calan.ses ? calan.ses.pause() : calan.ac.suspend();
      calan.ikon.textContent = '▶';
    }
    return;
  }
  calaniBirak();

  const url = await veri.medyaUrl(medyaId, bicim || null);
  if (!url) { kayitBildir('Ses dosyası bulunamadı.', 'kotu'); return; }

  const ikon = dugme.querySelector('.ikon');
  const sure = dugme.querySelector('.sure');
  const ortak = { url, dugme, ikon, sure, medyaId, ilkYazi: sure?.textContent || '', sayac: null };

  const ses = new Audio();
  ses.preload = 'auto';
  ses.src = url;
  calan = { ...ortak, ses };

  // iOS'un ürettiği mp4'te süre bilgisi çoğu zaman yanlış: <audio> kaydın
  // ortasında "bitti" deyip susuyor. Kaydın gerçek süresine göre erken bittiyse
  // dosyayı baştan çözen yedek yola geçiliyor.
  ses.onended = () => {
    const calinan = ses.currentTime || 0;
    if (kayitliSure > 2 && calinan < kayitliSure - 1.5) {
      yedekYolaGec(medyaId, ortak, `erken bitti (${calinan.toFixed(1)}/${kayitliSure} sn)`);
    } else {
      calaniBirak();
    }
  };
  ses.onerror = () => yedekYolaGec(medyaId, ortak, 'dosya <audio> ile açılamadı');

  try {
    await ses.play();
  } catch (hata) {
    await yedekYolaGec(medyaId, ortak, hata.message);
    return;
  }

  ikon.textContent = '⏸';
  sayaciBasla(() => calan?.ses?.currentTime || 0);
}

// <audio> çalışmadığında: dosyayı baştan çöz ve Web Audio ile çal.
async function yedekYolaGec(medyaId, ortak, neden) {
  if (calan && calan.medyaId === medyaId) { clearInterval(calan.sayac); calan = null; }
  console.warn('ses: yedek yola geçiliyor —', neden);

  try {
    const blob = await veri.medyaOku(medyaId);
    if (!blob) throw new Error('dosya yok');
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    const tampon = await ac.decodeAudioData(await blob.arrayBuffer());

    const kaynak = ac.createBufferSource();
    kaynak.buffer = tampon;
    kaynak.connect(ac.destination);

    const baslangic = ac.currentTime;
    calan = { ...ortak, ac, kaynak };
    kaynak.onended = () => calaniBirak();
    kaynak.start();

    ortak.ikon.textContent = '⏸';
    sayaciBasla(() => Math.min(tampon.duration, (calan?.ac.currentTime || 0) - baslangic));
    kayitBildir(`Ses çözülerek çalınıyor · ${sureYaz(tampon.duration)}`);
  } catch (hata) {
    URL.revokeObjectURL(ortak.url);
    ortak.ikon.textContent = '▶';
    if (ortak.sure) ortak.sure.textContent = ortak.ilkYazi;
    calan = null;
    kayitBildir(`Ses çalınamadı: ${hata.message}`, 'kotu');
  }
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

  const k = await kayit.sesBitir(o.tur);
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

  await kayit.fotoAl(dosyalar, (yapilan, toplam) => {
    const e = $('#fotoIlerleme');
    if (e) e.textContent = `${yapilan} / ${toplam}`;
  }, tur);

  ortuKapat();
  await tazele();

  const izsiz = durum.kayitlar.filter(k => k.tur === 'foto' && !k.lat).length;
  kayitBildir(
    izsiz ? `Eklendi. ${izsiz} fotoğrafın yeri bulunamadı — iz o saatte kapalıymış.`
          : 'Fotoğraflar eklendi ve haritaya yerleşti.',
    'iyi'
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

function duraklariCiz() {
  const kap = $('#duraklarListe');
  const s = gerok.aktifGerok();
  if (!s) { kap.innerHTML = bosDurum('📌', 'Gerok paketi yüklenmedi.'); return; }

  const konum = iz.sonBilinenKonum();
  const bugun = gerok.bugununGunu();

  const liste = gerok.duraklar().slice().sort((a, b) => {
    if (bugun) {
      const ab = a.gun === bugun.no ? 0 : 1;
      const bb = b.gun === bugun.no ? 0 : 1;
      if (ab !== bb) return ab - bb;
    }
    return a.gun - b.gun;
  });

  kap.innerHTML = liste.map(d => {
    const dur = durum.durakDurumlari[d.id]?.durum;
    const uzaklik = konum ? iz.mesafe(konum.lat, konum.lon, d.lat, d.lon) : null;
    return `<div class="durak-kart ${dur || ''}" data-durak="${d.id}">
      <div class="durak-ust">
        <div class="durak-ad">${kacis(d.ad)}</div>
        <div class="durak-gun">Gün ${d.gun}</div>
      </div>
      ${uzaklik != null ? `<div class="durak-uzaklik">${uzaklikYaz(uzaklik)} uzakta</div>` : ''}
      ${d.unutma?.length ? `<ul class="unutma">${d.unutma.map(u => `<li>${kacis(u)}</li>`).join('')}</ul>` : ''}
      <div class="durak-dugmeler">
        <button class="kucuk-dugme ${dur === 'gidildi' ? 'secili' : ''}" data-isaret="gidildi">Gittik</button>
        <button class="kucuk-dugme ${dur === 'kacirildi' ? 'secili' : ''}" data-isaret="kacirildi">Kaçırdık</button>
        <button class="kucuk-dugme" data-google="${d.id}">Google</button>
      </div>
    </div>`;
  }).join('');

  kap.querySelectorAll('[data-google]').forEach(d => {
    d.addEventListener('click', () => {
      const durak = gerok.duraklar().find(x => x.id === d.dataset.google);
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

function uyariSesi() {
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
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
    try {
      durum.uyanikKilit = await navigator.wakeLock?.request('screen');
      durum.uyanikKilit?.addEventListener('release', () => { durum.uyanikKilit = null; });
    } catch { /* Wake Lock yoksa ekran normal davranır */ }
    $('#btnYolModu .yol-alt').textContent =
      durum.uyanikKilit ? 'Açık — ekran sönmeyecek, duraklara yaklaşınca uyaracak'
                        : 'Açık — uyarılar çalışıyor (ekran kilidi bu cihazda yok)';
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
