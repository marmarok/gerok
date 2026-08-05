// Gerok — uygulama omurgası: açılış, ekran yönlendirme, arayüz.

import * as veri from './veri.js';
import * as iz from './iz.js';
import * as gerok from './gerok.js';
import * as kayit from './kayit.js';
import { haritaKur, haritaGuncelle, haritaBoyutTazele, konumaGit, hepsiniGoster } from './harita.js';
import { gunSonuAc, baslangicKaydiAc, bitisKaydiAc, mektupAc } from './gunsonu.js';
import { paketGonder, paketAl, yedekAl } from './esitleme.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

let durum = {
  ekran: 'zaman',
  kayitlar: [],
  izNoktalari: [],
  durakDurumlari: {},
  yolModu: false,
  uyanikKilit: null,
  sonUlke: null,
  uyarilmisDuraklar: new Set()
};

// ---------------------------------------------------------------- açılış ---

async function baslat() {
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
    d.addEventListener('click', () => sesCal(d.dataset.ses, d));
  });
  kap.querySelectorAll('[data-onizleme]').forEach(async (d) => {
    const url = await veri.medyaUrl(d.dataset.onizleme);
    if (url) d.innerHTML = `<img src="${url}" alt="" loading="lazy">`;
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
    govde += `<button class="ses-oynat" data-ses="${k.medyaId}">
      <span class="ikon">▶</span><span class="sure">${sureYaz(k.sure)}</span>
    </button>`;
  }
  if (k.medyaId && ['foto', 'video', 'siradan'].includes(k.tur)) {
    govde += `<div class="kayit-foto" data-onizleme="${k.medyaId}"></div>`;
    if (k.tur === 'video') govde += `<div class="kayit-yer">video · ${sureYaz(k.videoSure)}</div>`;
  }

  return `<div class="kayit-satir ${k.tur}">
    <div class="kayit-saat">${gerok.saat(k.t)}</div>
    <div class="kayit-govde">
      <div class="kayit-tur">${kacis(tur)}</div>
      ${govde}
      <div class="kayit-sahip">${kacis(k.sahipAd || 'bilinmeyen')}${yer ? ` · ${yer}` : ''}</div>
    </div>
  </div>`;
}

let calan = null;
async function sesCal(medyaId, dugme) {
  if (calan) { calan.pause(); calan = null; }
  const url = await veri.medyaUrl(medyaId);
  if (!url) return;
  const ses = new Audio(url);
  calan = ses;
  const ikon = dugme.querySelector('.ikon');
  ikon.textContent = '⏸';
  ses.onended = () => { ikon.textContent = '▶'; URL.revokeObjectURL(url); calan = null; };
  ses.play();
}

// ------------------------------------------------------------ kayıt ekranı --

function kayitDugmeleriniKur() {
  basiliTutKur($('#btnSes'), 'ses');
  $('#btnOrtam').addEventListener('click', ortamSesiAl);

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
  $('#izRozet').addEventListener('click', izRozetTikla);
}

// Sesli notta "basılı tut, konuş, bırak" — yolda tek elle kullanılsın diye.
function basiliTutKur(dugme, tur) {
  let sayac = null, baslamis = false;

  const basla = async (e) => {
    e.preventDefault();
    baslamis = false;
    try {
      const oldu = await kayit.sesBasla();
      if (!oldu) return;
      baslamis = true;
      $('#sesKatman').classList.remove('gizli');
      $('#sesIpucu').textContent = 'Bırakınca kaydedilir';
      titret(12);
      sayac = setInterval(() => {
        $('#sesSure').textContent = sureYaz(kayit.sesSuresi());
      }, 100);
    } catch (hata) {
      kayitBildir('Mikrofon izni yok. Ayarlar → Safari → Mikrofon.', 'kotu');
    }
  };

  const bitir = async (e) => {
    e.preventDefault();
    if (!baslamis) return;
    baslamis = false;
    clearInterval(sayac);
    $('#sesKatman').classList.add('gizli');
    $('#sesSure').textContent = '0:00';

    const k = await kayit.sesBitir(tur);
    if (k) {
      kayitBildir(`Sesli not kaydedildi · ${sureYaz(k.sure)}`, 'iyi');
      titret([8, 40, 8]);
      await tazele();
    } else {
      kayitBildir('Çok kısaydı, kaydedilmedi.');
    }
  };

  dugme.addEventListener('pointerdown', basla);
  dugme.addEventListener('pointerup', bitir);
  dugme.addEventListener('pointercancel', bitir);
  dugme.addEventListener('pointerleave', bitir);
  dugme.addEventListener('contextmenu', (e) => e.preventDefault());
}

// Ortam sesi: konuşmadan, 30 saniye, o yerin nasıl duyulduğu.
async function ortamSesiAl() {
  try {
    const oldu = await kayit.sesBasla();
    if (!oldu) return;
  } catch {
    kayitBildir('Mikrofon izni yok. Ayarlar → Safari → Mikrofon.', 'kotu');
    return;
  }

  $('#sesKatman').classList.remove('gizli');
  $('#sesIpucu').textContent = 'Konuşma — sadece burayı dinlet · dokununca erken biter';
  titret(12);

  let bitti = false;
  const bitirme = async () => {
    if (bitti) return;
    bitti = true;
    clearInterval(sayac);
    $('#sesKatman').classList.add('gizli');
    $('#sesKatman').removeEventListener('click', bitirme);
    const k = await kayit.sesBitir('ortam');
    if (k) {
      kayitBildir(`Ortam sesi kaydedildi · ${sureYaz(k.sure)}`, 'iyi');
      titret([8, 40, 8]);
      await tazele();
    }
  };

  const sayac = setInterval(() => {
    const gecen = kayit.sesSuresi();
    $('#sesSure').textContent = sureYaz(Math.max(0, 30 - gecen));
    if (gecen >= 30) bitirme();
  }, 100);

  $('#sesKatman').addEventListener('click', bitirme);
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
      </div>
    </div>`;
  }).join('');

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
  ortuAc(`
    <div class="ortu-baslik">Fiyat</div>
    <div class="ortu-alt">"Belgrad'da kahve 120 dinar." On yıl sonra bu tek satır
    bir sayfa yazıdan iyi anlatacak.</div>
    <div class="girdi-etiket">Ne aldın?</div>
    <input class="girdi" id="fiyatNe" placeholder="Kahve, bilet, akşam yemeği…">
    <div class="girdi-etiket">Kaça?</div>
    <input class="girdi" id="fiyatTutar" placeholder="120" inputmode="decimal">
    <div class="girdi-etiket">Para birimi</div>
    <input class="girdi" id="fiyatPara" placeholder="dinar, euro, lek, marka…">
    <button class="eylem-dugme birincil" id="fiyatKaydet">Kaydet</button>
  `);
  setTimeout(() => $('#fiyatNe').focus(), 120);
  $('#fiyatKaydet').addEventListener('click', async () => {
    const ne = $('#fiyatNe').value, tutar = $('#fiyatTutar').value, para = $('#fiyatPara').value;
    ortuKapat();
    if (await kayit.fiyatEkle(ne, tutar, para)) { kayitBildir('Kaydedildi.', 'iyi'); await tazele(); }
  });
}

async function haritaIndirmeSor() {
  const { haritaIndir } = await import('./harita.js');
  ortuAc(`
    <div class="ortu-baslik">Offline harita</div>
    <div class="ortu-alt">357 MB, beş parça halinde iner. Altı ülkenin tamamı, sokak seviyesinde.
    <b>Ev wifi'sinde indir</b> — yolda internet olmayacak.</div>
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
      if (e) e.textContent = `Olmadı: ${hata.message}`;
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

export function kayitBildir(mesaj, sinif = '') {
  const e = $('#kayitDurum');
  if (!e) return;
  e.textContent = mesaj;
  e.className = `kayit-durum ${sinif}`;
  clearTimeout(e._sayac);
  e._sayac = setTimeout(() => { e.textContent = ''; e.className = 'kayit-durum'; }, 5000);
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
