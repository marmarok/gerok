// Gerok — uygulama omurgası: açılış, ekran yönlendirme, arayüz.

import * as veri from './veri.js';
import * as iz from './iz.js';
import * as gerok from './gerok.js';
import * as kayit from './kayit.js';
import { haritaKur, haritaGuncelle, haritaBoyutTazele, konumaGit, hepsiniGoster,
         kipDegistir, aktifKipAl, haritaMerkezi, durakTiklamasi } from './harita.js';
import { gunSonuAc, geziSonuAc, baslangicKaydiAc, bitisKaydiAc, mektupAc } from './gunsonu.js';
import { paketGonder, paketAl, yedekAl, sonYedekZamani, yedekSina } from './esitleme.js';
import { TEMALAR, temaSecimi, temaSec, temaBaslat } from './tema.js';
import { SEMA_SECENEKLERI, semaSecimi, semaSec, semaUygula, cozulmusSema } from './sema.js';
import * as baglanti from './baglanti.js';
import * as yerAra from './yer-ara.js';
import { ikon, ikonlariYerlestir } from './ikon.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

let durum = {
  ekran: 'zaman',
  kayitlar: [],
  izNoktalari: [],
  durakDurumlari: {},
  yolModu: false,
  arama: '',
  suzgec: 'hepsi',
  acikSatir: null,          // uzun basılan kaydın kimliği
  sonParaBirimi: '',
  uyanikKilit: null,
  sonUlke: null,
  uyarilmisDuraklar: new Set()
};

// ---------------------------------------------------------------- açılış ---

// Şema, temanın üstüne biniyor: tema zeminin (kâğıt mı gece mi), şema
// vurgunun rengini söylüyor. Tema her değiştiğinde şema yeniden yazılmalı —
// her şemanın gece ve gündüz için ayrı vurgusu var.
function geziGunuNo() {
  const s = gerok.aktifGerok();
  if (!s?.baslangic) return 0;
  const gun = Math.floor((Date.now() - new Date(s.baslangic).getTime()) / 86400000);
  return Number.isFinite(gun) ? Math.max(0, gun) : 0;
}

function semayiTazele(secim = semaSecimi()) {
  return semaUygula(secim, geziGunuNo());
}

async function baslat() {
  temaBaslat();
  await veri.ac();
  await gerok.baslat();
  semayiTazele();
  // Telefon kendi kendine gece kipine geçerse (otomatik tema) vurgu da o
  // temanın karşılığına dönsün.
  matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', () => setTimeout(() => semayiTazele(), 0));

  // Cihaz kimliği: iki telefonun kayıtlarını birbirinden ayıran şey.
  let cihaz = await veri.ayarOku('cihazKimligi');
  if (!cihaz) {
    cihaz = veri.yeniKimlik('c');
    await veri.ayarYaz('cihazKimligi', cihaz);
  }
  const ad = await veri.ayarOku('kullaniciAdi', null);
  iz.cihazAyarla(cihaz);
  iz.gerokAyarla(gerok.aktifGerok()?.id ?? null);
  kayit.sahipAyarla({ id: cihaz, ad });

  await turAyrimiGocu();

  durum.uyarilmisDuraklar = new Set(await veri.ayarOku('uyarilmisDuraklar', []));
  durum.sonUlke = await veri.ayarOku('sonUlke', null);
  durum.sonParaBirimi = await veri.ayarOku('sonParaBirimi', '');

  await depolamaSagligi();

  ikonlariYerlestir();
  sekmeleriKur();
  kayitDugmeleriniKur();
  aramaVeSuzgecKur();
  calmaSeridiniKur();
  izDinle();

  await tazele();
  ekranAc('zaman');

  // Ad girilmemişse önce onu sor — her kaydın sahibi yazılacak.
  if (!ad) adSor();
  else await yarimKayitSor();

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

// Turlar ayrılmadan önce yazılmış kayıtlar hangi tura ait olduğunu bilmiyor.
// Süzgeç devreye girince görünmez olurlardı; açılışta bir kez o günün aktif
// turuna yazılıyorlar. Bir kez çalışıp bayrağını bırakıyor.
async function turAyrimiGocu() {
  if (await veri.ayarOku('turAyrimiYapildi', false)) return;
  const turId = gerok.aktifGerok()?.id ?? null;

  if (turId) {
    const eksikKayitlar = (await veri.tumKayitlar()).filter(k => k.gerokId == null);
    for (const k of eksikKayitlar) await veri.kayitEkle({ ...k, gerokId: turId });

    const eksikIz = (await veri.izGetir())
      .filter(n => n.gerokId == null)
      .map(n => ({ ...n, gerokId: turId }));
    if (eksikIz.length) await veri.izEkleToplu(eksikIz);

    await gerok.ozelDuraklaraTurYaz(turId);
  }
  await veri.ayarYaz('turAyrimiYapildi', true);
}

async function tazele() {
  const turId = gerok.aktifGerok()?.id ?? null;
  durum.turId = turId;
  durum.kayitlar = await veri.kayitlariGetir(turId);
  durum.izNoktalari = await veri.izGetir(turId);
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
  kaydirmaKur();
}

// Ekranların alt bardaki sırası. Kaydırma bu sırayı izliyor — parmak sola
// giderse sağdaki ekran gelir, tıpkı sayfa çevirir gibi.
const EKRAN_SIRASI = ['zaman', 'harita', 'kayit', 'duraklar', 'gerok'];

/**
 * Sağa-sola kaydırarak ekran değiştirme.
 *
 * Alt bar duruyor; bu onun yerine değil, yanına. Üç şeye dikkat edildi:
 *
 * 1. HARİTA. Haritada parmak zaten haritayı kaydırıyor. Orada sıradan
 *    kaydırma çalışsaydı harita her sürüklendiğinde ekran değişirdi. Bu
 *    yüzden haritanın üstünde YALNIZCA kenardan başlayan kaydırma sayılıyor
 *    — iOS'un kendi geri hareketiyle aynı mantık.
 * 2. DİKEY KAYDIRMA. Zaman çizgisi uzun; aşağı kaydırırken parmak biraz
 *    yana da kayıyor. Yatay hareket dikeyin iki katından fazla değilse
 *    kaydırma sayılmıyor.
 * 3. AÇIK KATMANLAR. Ses kaydı ya da bir soru penceresi açıkken ekran
 *    değişmemeli — arkada sekme değiştirmek kaydı görünmez hâle getirirdi.
 */
const KAYDIRMA_ESIK = 64;      // en az bu kadar yatay yol
const KENAR_PIKSEL = 56;       // ekran kenarından başlayan hareket

function kaydirmaKur() {
  const govde = $('#govde');
  let bx = 0, by = 0, bt = 0, kenardan = false, gecerli = false;

  govde.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) { gecerli = false; return; }
    const d = e.touches[0];
    bx = d.clientX; by = d.clientY; bt = Date.now();
    kenardan = bx <= KENAR_PIKSEL || bx >= innerWidth - KENAR_PIKSEL;
    // Haritada yalnızca kenardan; diğer ekranlarda her yerden.
    gecerli = durum.ekran === 'harita' ? kenardan : true;
  }, { passive: true });

  govde.addEventListener('touchend', (e) => {
    if (!gecerli) return;
    gecerli = false;

    // Üstte bir katman varsa el sürme.
    if (sesKaydiVarMi()) return;
    if (!$('#ortu').classList.contains('gizli')) return;
    if (!$('#haritaAramaKap').classList.contains('gizli')) return;
    if (!$('#haritaEkleBar').classList.contains('gizli')) return;

    const d = e.changedTouches[0];
    const dx = d.clientX - bx, dy = d.clientY - by;
    if (Date.now() - bt > 700) return;              // yavaş sürükleme değil
    if (Math.abs(dx) < KAYDIRMA_ESIK) return;
    if (Math.abs(dx) < Math.abs(dy) * 2) return;    // aslında aşağı kaydırıyor

    const yer = EKRAN_SIRASI.indexOf(durum.ekran);
    if (yer < 0) return;
    const hedef = EKRAN_SIRASI[yer + (dx < 0 ? 1 : -1)];
    if (!hedef) return;
    ekranAc(hedef, dx < 0 ? 'sol' : 'sag');
  }, { passive: true });
}

function ekranAc(ad, yon = null) {
  // Haritadan çıkarken durak koyma kipi de kapansın — dönünce nişangâh
  // ekranda kalmış olurdu.
  if (durum.ekran === 'harita' && ad !== 'harita') durakKoymaKipi(false);
  durum.ekran = ad;
  $$('.ekran').forEach(e => e.classList.remove('acik', 'gelir-sol', 'gelir-sag'));
  const ekran = $(`#ekran-${ad}`);
  ekran?.classList.add('acik');
  // Kaydırarak gelindiyse yönü belli olsun: nereden geldiğini görmek,
  // hangi sekmede olduğunu anlamayı kolaylaştırıyor.
  if (yon && ekran) {
    ekran.classList.add(yon === 'sol' ? 'gelir-sol' : 'gelir-sag');
  }
  $$('#altBar .sekme').forEach(d => d.classList.toggle('secili', d.dataset.ekran === ad));

  ustGunPenceresi();
  if (ad === 'zaman') zamanCizgisiCiz();
  if (ad === 'duraklar') duraklariCiz();
  if (ad === 'gerok') paneliCiz();
  if (ad === 'kayit') kayitUyarilariniCiz();
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
  ustGunPenceresi();
}

// ---- Üst şeritteki kayan gün başlığı ----------------------------------------
//
// Gün başlığı listenin içinde yapışkan durduğunda kaydırırken zıplıyor ve
// arama şeridiyle çakışıyordu. Artık üst şeridin içinde, 34 piksellik bir
// pencerede duruyor: liste kaydıkça yukarı kayıyor. Hangi gündeysen o yazıyor,
// yerinden hiç oynamadan.
let ustGunListesi = [];
let ustAktifGun = 0;

function ustGunPenceresi() {
  // Kayan başlık yalnızca zaman çizgisinde var; öteki ekranlarda üst şeritte
  // gezinin adından başka bir şey yok — tasarımdaki gibi.
  const zamanda = durum.ekran === 'zaman' && ustGunListesi.length > 0;
  $('#ustGunPencere').classList.toggle('gizli', !zamanda);
  $('#ustAlt').classList.toggle('gizli', zamanda);
}

function ustGunleriYaz(gunler) {
  ustGunListesi = gunler || [];
  ustAktifGun = 0;
  const yigin = $('#ustGunYigin');
  yigin.innerHTML = ustGunListesi.map(u => `<div class="ust-gun-satir">
    <div class="ust-gun-ad">${kacis(u.satir)}</div>
    ${u.bilgi ? `<div class="ust-gun-bilgi">${kacis(u.bilgi)}</div>` : ''}
  </div>`).join('');
  yigin.style.transform = 'translateY(0)';
  ustGunPenceresi();
}

// Liste kaydırılırken ekranın tepesine en son giren gün işareti hangisiyse
// üst şeritte o gösteriliyor.
function ustGunuTazele(liste) {
  if (!ustGunListesi.length) return;
  const esik = liste.getBoundingClientRect().top + 26;
  let aktif = 0;
  liste.querySelectorAll('[data-gun]').forEach(n => {
    if (n.getBoundingClientRect().top <= esik) aktif = Number(n.dataset.gun) || 0;
  });
  if (aktif === ustAktifGun) return;
  ustAktifGun = aktif;
  $('#ustGunYigin').style.transform = `translateY(-${aktif * 34}px)`;
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

// Zaman çizgisi süzgeçleri. `hepsi` dışındakiler tür ailelerine bakıyor;
// `baskasi` ise sahibine — iki telefonun kayıtları birleşince "arkadaşım ne
// kaydetmiş" sorusu en çok sorulan şey oluyor.
const SUZGECLER = {
  hepsi: () => true,
  ses: (k) => ['ses', 'ortam', 'gunluk', 'baslangic', 'bitis', 'mektup'].includes(k.tur),
  gorsel: (k) => ['foto', 'video', 'siradan'].includes(k.tur),
  baskasi: (k) => k.sahip && k.sahip !== kayit.sahipAl().id
};
const SUZGEC_ADI = {
  hepsi: 'hepsi', ses: 'yalnızca sesler',
  gorsel: 'fotoğraf ve video', baskasi: 'arkadaşının kayıtları'
};

// Bir kaydın aranan metni: gördüğün her şey aranabilir olmalı.
function aranabilirMetin(k) {
  return [k.metin, k.not, k.baslik, k.ad, k.tutar, k.paraBirimi,
          k.kategori, k.sahipAd, veri.TURLER[k.tur] || k.tur]
    .filter(Boolean).join(' ').toLocaleLowerCase('tr');
}

function zamanCizgisiCiz() {
  const kap = $('#zamanListe');
  const s = gerok.aktifGerok();
  // Aşağıdaki boş durumların hepsinde erken çıkılıyor; kayan gün başlığı
  // eski günde takılı kalmasın diye şimdiden temizleniyor.
  ustGunleriYaz([]);

  // Tur yokken de kayıtlar gösterilmeli. Eskiden burada koşulsuz "paketi yükle"
  // yazıyordu; paketten önce bırakılan sesli not silinmiş gibi görünüyordu
  // (iPhone'da denerken çıktı). Kayıt duruyor, sadece görünmüyordu.
  if (!s && !durum.kayitlar.length) {
    kap.innerHTML = bosDurum('harita', 'Henüz bir gerok yüklenmedi.<br>Gerok sekmesinden paketi yükle.');
    return;
  }
  if (!durum.kayitlar.length) {
    kap.innerHTML = bosDurum('zamanBos',
      'Zaman çizgisi boş.<br>Kayıt sekmesinden ilk sesli notunu bırak,<br>ya da bir fotoğraf ekle.');
    return;
  }

  // Arama ve süzgeç önce uygulanıyor: sayfalama süzülmüş liste üzerinden
  // işlesin, yoksa "son 120 kayıt içinde ara" gibi tuhaf bir şey olurdu.
  const sorgu = (durum.arama || '').trim().toLocaleLowerCase('tr');
  const suzgec = SUZGECLER[durum.suzgec] || SUZGECLER.hepsi;
  const tumu = durum.kayitlar.filter(k =>
    suzgec(k) && (!sorgu || aranabilirMetin(k).includes(sorgu)));

  if (!tumu.length) {
    kap.innerHTML = `<div class="bos-durum">
      <div class="bos-yazi">Bu süzgeçle kayıt yok.<br>
      <span style="color:var(--vurgu)">${kacis(sorgu ? `“${sorgu}”` : SUZGEC_ADI[durum.suzgec])}</span></div>
    </div>`;
    return;
  }

  // En yeniler önce: sınırı aşan eskiler "daha eskisini göster" ile gelir.
  const gosterilecek = tumu.slice(Math.max(0, tumu.length - gosterilenSayi));
  const gizliSayi = tumu.length - gosterilecek.length;

  // Turun günlerine düşmeyen kayıtlar KENDİ TARİHLERİNE göre gruplanıyor.
  //
  // Eskiden hepsi tek bir "Gerok dışı" torbasına giriyor ve o torba listenin
  // EN DİBİNE konuyordu. Sonuç: tur bittikten sonra yapılan bir sesli not,
  // sekiz günlük gezinin altına düşüyordu. Gerçek kullanımda "kayıt hiçbir
  // yere düşmüyor" diye bildirildi; oysa kayıt duruyordu, sadece kimsenin
  // bakmadığı yerdeydi.
  // Artık gruplar takvim sırasına göre diziliyor: bugün yapılan kayıt en üstte.
  const gunAnahtari = (t) => {
    const d = new Date(t);
    return `t:${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const gruplar = new Map();
  for (const k of gosterilecek) {
    const anahtar = k.gun ?? gunAnahtari(k.t);
    if (!gruplar.has(anahtar)) gruplar.set(anahtar, []);
    gruplar.get(anahtar).push(k);
  }

  // Sıralama artık gün numarasına değil ZAMANA göre: her grup en yeni kaydının
  // anına göre yerleşiyor. Böylece turdan önce, tur sırasında ve turdan sonra
  // yapılan kayıtlar tek bir doğru zincirde diziliyor.
  const grupAni = new Map();
  for (const [anahtar, liste] of gruplar) {
    grupAni.set(anahtar, Math.max(...liste.map(k => k.t || 0)));
  }
  const sirali = Array.from(gruplar.keys())
    .sort((a, b) => grupAni.get(b) - grupAni.get(a));

  // Paket yüklenmeden bırakılan kayıtlar kaybolmuş sanılmasın.
  let html = s ? '' : `<div class="uyari-satir">Henüz bir gerok yüklenmedi —
    aşağıdaki kayıtlar duruyor. Paketi yükleyince ya da yeni tur başlatınca
    Gerok → Turlar'dan tek düğmeyle o tura taşınırlar.</div>`;
  const turBasi = s ? new Date(s.baslangic).getTime() : 0;
  const turSonu = s ? new Date(s.bitis).getTime() : 0;

  // Üst şeritteki kayan gün başlığı bu listeden kuruluyor.
  const ustGunler = [];

  for (const [sira, anahtar] of sirali.entries()) {
    const gunler = s?.gunler?.find(g => g.no === anahtar);
    const kayitlar = gruplar.get(anahtar).slice().reverse();
    const grupZamani = grupAni.get(anahtar);

    let rozet, gunAdi, gunAlt = '';
    if (gunler) {
      // Turun kendi günü: paketteki başlık.
      const gunTarihi = gerok.tarihUzun(new Date(gunler.tarih).getTime());
      rozet = `Gün ${anahtar}`;
      gunAdi = gunler.baslik || gunTarihi;
      gunAlt = gunler.baslik ? gunTarihi : '';
    } else {
      // Turun dışında kalan gün. Rozet ne olduğunu söylüyor: "Gerok dışı"
      // hiçbir şey anlatmıyordu, kaydın kaybolduğu izlenimini veriyordu.
      gunAdi = gerok.tarihUzun(grupZamani);
      rozet = !s ? 'Tur yok'
        : grupZamani > turSonu ? 'Tur bittikten sonra'
        : grupZamani < turBasi ? 'Tur başlamadan önce'
        : 'Turun günlerinin dışında';
    }

    const bilgi = gunler
      ? `${gunAlt}${gunler.km ? `${gunAlt ? ' · ' : ''}${gunler.km} km` : ''}`
      : '';
    ustGunler.push({ satir: `${rozet} · ${gunAdi}`, bilgi });

    // İşaret düğümü: liste kaydırılırken hangi günde olduğumuzu bu söylüyor.
    html += `<div class="gun-isaret" data-gun="${sira}"></div>`;
    // İlk günün başlığı gizli — o an üst şeritte zaten yazıyor.
    html += `<div class="gun-basligi${sira === 0 ? ' gizli-baslik' : ''}">
      <div class="gun-no">${kacis(rozet)}</div>
      <div class="gun-ad">${kacis(gunAdi)}</div>
      ${bilgi ? `<div class="gun-bilgi">${kacis(bilgi)}</div>` : ''}
    </div>`;

    for (const k of kayitlar) html += kayitSatiri(k);
  }

  if (gizliSayi > 0) {
    html += `<div class="daha-eski">
      <button class="eylem-dugme" id="dahaEski">Daha eskisini göster (${gizliSayi})</button>
    </div>`;
  }
  kap.innerHTML = html;
  ustGunleriYaz(ustGunler);

  $('#dahaEski')?.addEventListener('click', () => {
    gosterilenSayi += SAYFA_ADIMI;
    zamanCizgisiCiz();
  });

  kap.querySelectorAll('[data-ses]').forEach(tus => {
    const kutu = tus.closest('.ses-oynat');
    const sure = +tus.dataset.sure || 0;
    tus.addEventListener('click', () => sesCal(tus.dataset.ses, kutu, tus.dataset.bicim, sure));
    dalgayiKur(kutu.querySelector('.dalga'), kutu, tus.dataset.ses, tus.dataset.bicim, sure);
  });
  kap.querySelectorAll('[data-onizleme]').forEach(async (d) => {
    const url = await onizlemeAdresi(d.dataset.onizleme);
    // Etiketin üstüne yazılmıyor, ALTINA konuyor: innerHTML kullanılsaydı
    // "orijinali galeride" yazısı silinirdi.
    if (url) d.insertAdjacentHTML('afterbegin', `<img src="${url}" alt="" loading="lazy">`);
  });
  kap.querySelectorAll('[data-sil]').forEach(d => {
    d.addEventListener('click', () => kaydiSil(d.dataset.sil));
  });
  kap.querySelectorAll('[data-baslik]').forEach(d => {
    d.addEventListener('click', () => kayitBasligiSor(d.dataset.baslik));
  });
  kap.querySelectorAll('[data-tasi]').forEach(d => {
    d.addEventListener('click', () => kaydiTasiSor(d.dataset.tasi));
  });
  kap.querySelectorAll('[data-google]').forEach(d => {
    d.addEventListener('click', () => {
      const [lat, lon] = d.dataset.google.split(',');
      googleHaritalarAc({ lat, lon });
    });
  });

  uzunBasmayiKur(kap);
}

// Uzun basma: satırın eylemleri açılıyor.
//
// Eşik 420 ms. Daha kısası listede kaydırırken kazara açıyordu; daha uzunu
// "basılı tuttum, bir şey olmadı" hissi veriyor. Parmak 10 pikselden fazla
// kayarsa iptal — kaydırmakla basılı tutmak karışmasın.
const BASMA_SURESI = 420;
const BASMA_KAYMA = 10;

function uzunBasmayiKur(kap) {
  kap.querySelectorAll('.kayit-satir').forEach(satir => {
    let zaman = null, bas = null;

    const iptal = () => { clearTimeout(zaman); zaman = null; };

    const baslat = (ev) => {
      // Kartın içindeki düğmeye (çalma, silme) basılıyorsa karışma.
      if (ev.target.closest('button, input, a')) return;
      const n = ev.touches?.[0] || ev;
      bas = { x: n.clientX, y: n.clientY };
      zaman = setTimeout(() => {
        durum.acikSatir = durum.acikSatir === satir.dataset.kayit ? null : satir.dataset.kayit;
        titret(12);
        zamanCizgisiCiz();
      }, BASMA_SURESI);
    };

    const kaydi = (ev) => {
      if (!zaman || !bas) return;
      const n = ev.touches?.[0] || ev;
      if (Math.abs(n.clientX - bas.x) > BASMA_KAYMA ||
          Math.abs(n.clientY - bas.y) > BASMA_KAYMA) iptal();
    };

    satir.addEventListener('touchstart', baslat, { passive: true });
    satir.addEventListener('touchmove', kaydi, { passive: true });
    satir.addEventListener('touchend', iptal);
    satir.addEventListener('touchcancel', iptal);
    // Fare: masaüstünde sınamak için. Telefonda bu yol hiç çalışmıyor.
    satir.addEventListener('mousedown', baslat);
    satir.addEventListener('mousemove', kaydi);
    satir.addEventListener('mouseup', iptal);
    satir.addEventListener('mouseleave', iptal);
  });
}

// Arama kutusu ve süzgeçler.
function aramaVeSuzgecKur() {
  const girdi = $('#araGirdi');
  let bekle = null;
  girdi.addEventListener('input', () => {
    clearTimeout(bekle);
    // 180 ms bekleme: her harfte yüzlerce kaydı yeniden çizmek yazmayı
    // takılıyor gibi hissettiriyordu.
    bekle = setTimeout(() => {
      durum.arama = girdi.value;
      gosterilenSayi = SAYFA_ADIMI;
      zamanCizgisiCiz();
    }, 180);
  });

  $$('#suzgecler .suzgec').forEach(d => {
    d.addEventListener('click', () => {
      // Aynı süzgece ikinci dokunuş kapatıyor: "hepsi"ye dönmek için ayrıca
      // düğme aramak gerekmesin.
      durum.suzgec = durum.suzgec === d.dataset.suzgec ? 'hepsi' : d.dataset.suzgec;
      $$('#suzgecler .suzgec').forEach(x =>
        x.classList.toggle('secili', x.dataset.suzgec === durum.suzgec));
      gosterilenSayi = SAYFA_ADIMI;
      zamanCizgisiCiz();
    });
  });

  // Aşağı kaydırınca şerit çekiliyor, yukarı çıkınca geri geliyor. Küçük
  // ekranda arama kutusu sürekli yer kaplamasın. Aynı kaydırmada üst şeritteki
  // gün başlığı da tazeleniyor.
  const liste = $('#zamanListe');
  let sonY = 0;
  liste.addEventListener('scroll', () => {
    const y = liste.scrollTop;
    if (y > sonY + 6 && y > 40) $('#zamanAra').classList.add('cekildi');
    else if (y < sonY - 6 || y < 12) $('#zamanAra').classList.remove('cekildi');
    sonY = y;
    ustGunuTazele(liste);
  }, { passive: true });
}

// Konumun NEREDEN geldiği yazılıyor. On yıl sonra haritadaki iğneye bakıp
// "burası gerçekten orası mıydı" diye sorulduğunda cevabı olan tek şey bu:
// uydu ölçümü ile izden tahmin arasındaki fark birkaç yüz metre olabiliyor.
const KONUM_KAYNAGI = {
  gps: 'konum: uydudan',
  iz: 'konum: iz kaydından',
  exif: 'konum: fotoğrafın içinden',
  elle: 'konum: elle işaretlendi'
};

const SESLI_TURLER = ['ses', 'ortam', 'gunluk', 'baslangic', 'bitis', 'mektup'];
const GORSEL_TURLER = ['foto', 'video', 'siradan'];

// Ses dalgası. GERÇEK dalga biçimi değil — onu çizmek için her kaydın tamamını
// çözmek gerekir; yüz kayıtta bu dakikalar ve epey pil demek. Bunun yerine
// kaydın kimliğinden türetilen sabit bir çizgi: aynı kayıt her açılışta aynı
// çizgiyi veriyor, göz onu o kaydın imzası olarak öğreniyor. Çubuğun işi
// süreyi ve nerede olduğunu göstermek; ikisi de doğru.
const DALGA_SAYISI = 74;
function dalgaCubuklari(id) {
  let tohum = 0;
  for (let i = 0; i < id.length; i++) tohum += id.charCodeAt(i);
  let html = '';
  for (let i = 0; i < DALGA_SAYISI; i++) {
    const a = Math.abs(Math.sin((i + 1) * (tohum % 7 + 2) * 0.53));
    const b = Math.abs(Math.sin((i + 1) * 0.17 + tohum));
    const c = Math.abs(Math.sin((i + 1) * 2.3));
    const zarf = 0.45 + 0.55 * Math.abs(Math.sin((i + 1) * 0.08 + tohum * 0.3));
    const v = Math.min(1, Math.max(0.08, (a * 0.55 + b * 0.3 + c * 0.4 - 0.12) * zarf * 1.5));
    html += `<span style="height:${Math.round(v * 100)}%"></span>`;
  }
  return html;
}

// Kaydın kendi cümlesi. Harcama ve tanışma kayıtları parçalardan kuruluyor:
// ayrı ayrı satırlara bölünürse liste form doldurulmuş gibi görünüyor,
// tek cümle olunca deftere yazılmış gibi.
function kayitCumlesi(k) {
  if (k.tur === 'fiyat') {
    return [k.metin, [k.tutar, k.paraBirimi].filter(Boolean).join(' '), k.kategori]
      .filter(Boolean).join(' · ');
  }
  if (k.tur === 'kisi') return [k.ad, k.not].filter(Boolean).join(' — ');
  if (k.tur === 'video' && !k.metin) return `Video · ${sureYaz(k.videoSure)}`;
  return k.metin || k.baslik || '';
}

function kayitSatiri(k) {
  const tur = veri.TURLER[k.tur] || k.tur;
  const yer = (k.lat != null && k.lon != null)
    ? (KONUM_KAYNAGI[k.konumKaynagi] || 'konum: uydudan')
    : 'konum: bulunamadı';

  const sesli = SESLI_TURLER.includes(k.tur);
  const gorsel = GORSEL_TURLER.includes(k.tur);
  const konumlu = k.lat != null && k.lon != null;
  const acik = durum.acikSatir === k.id;
  const metin = kayitCumlesi(k);

  // Tür etiketi sesli kayıtlarda ve metni olmayan kayıtlarda yazılıyor.
  // Ötekilerde solundaki renk çizgisi zaten söylüyor; iki kez söylemek
  // listeyi etiket tarlasına çeviriyordu.
  const turGoster = sesli || !metin;

  let govde = '';
  if (metin) govde += `<div class="kayit-metin">${kacis(metin)}</div>`;

  if (k.medyaId && sesli) {
    const cubuklar = dalgaCubuklari(k.id);
    govde += `<div class="ses-oynat">
      <button class="ses-tus" data-ses="${k.medyaId}" data-bicim="${kacis(k.bicim || '')}" data-sure="${k.sure || 0}">▶</button>
      <div class="dalga" role="slider" aria-label="Ses konumu"
           aria-valuemin="0" aria-valuemax="1000" aria-valuenow="0">
        <div class="dalga-kat sonuk">${cubuklar}</div>
        <div class="dalga-kat dolu">${cubuklar}</div>
      </div>
      <span class="sure">0:00 / ${sureYaz(k.sure)}</span>
    </div>`;
  }
  if (k.medyaId && gorsel) {
    // "orijinali galeride" bir süs değil, uygulamanın en önemli sözü:
    // fotoğraf buraya KOPYALANMIYOR, tam çözünürlüklü hali telefonun kendi
    // galerisinde duruyor. Uygulama silinse bile fotoğraflar yerinde kalır.
    const etiket = k.tur === 'video'
      ? `video · ${sureYaz(k.videoSure)} · orijinali galeride`
      : 'önizleme · orijinali galeride';
    govde += `<div class="kayit-foto" data-onizleme="${k.medyaId}">
      <span class="foto-etiket">${kacis(etiket)}</span>
    </div>`;
  }

  // Ses ve başlıksız kayıtlara sonradan bir satır eklenebiliyor.
  const basliklanabilir = sesli;

  // Eylemler ve konum satırı UZUN BASINCA açılıyor. Her satırın altında duran
  // "Sil" düğmesi listeyi düğme tarlasına çeviriyordu ve araç sallanırken
  // yanlışlıkla basılabiliyordu.
  return `<div class="kayit-satir ${k.tur}${acik ? ' acik' : ''}" data-kayit="${k.id}">
    <div class="kayit-ust">
      <span class="kayit-saat">${gerok.saat(k.t)}</span>
      ${turGoster ? `<span class="kayit-tur">${kacis(tur)}</span>` : ''}
      <span class="kayit-bosluk"></span>
      <span class="kayit-sahip">${kacis(k.sahipAd || 'bilinmeyen')}</span>
    </div>
    ${govde}
    ${acik ? `<div class="kayit-yer">${yer}</div>
      <div class="kayit-eylemler">
        ${konumlu ? `<button class="satir-dugme" data-google="${k.lat},${k.lon}">Haritalar'da aç</button>` : ''}
        ${basliklanabilir ? `<button class="satir-dugme vurgulu" data-baslik="${k.id}">Başlık yaz</button>` : ''}
        <button class="satir-dugme" data-tasi="${k.id}">Saat / gün</button>
        <button class="satir-dugme sil" data-sil="${k.id}">Sil</button>
      </div>` : ''}
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
    Beş saniye "Geri al" düğmesi duracak. O geçtikten sonra dönüşü yok:
    ses dosyası da siliniyor ve arkadaşına paket gönderdiğinde onun
    telefonundan da silinir.</div>
    <button class="eylem-dugme birincil" id="silOnay">Sil</button>
    <button class="eylem-dugme" id="silVazgec">Vazgeç</button>
  `);

  $('#silVazgec').addEventListener('click', ortuKapat);
  $('#silOnay').addEventListener('click', async () => {
    ortuKapat();
    durum.acikSatir = null;

    // Silme beş saniye BEKLETİLİYOR. Bu süre boyunca kayıt listeden kalkıyor
    // ama diskte duruyor: "Geri al"a basılırsa hiçbir şey olmamış gibi geri
    // geliyor. Sildikten sonra pişman olmak, silememekten daha sık oluyor.
    const eskiKayitlar = durum.kayitlar;
    durum.kayitlar = durum.kayitlar.filter(x => x.id !== id);
    zamanCizgisiCiz();

    let iptal = false;
    geriAlinabilirBildir('Kayıt silindi.', () => {
      iptal = true;
      durum.kayitlar = eskiKayitlar;
      zamanCizgisiCiz();
      kayitBildir('Geri alındı.', 'iyi');
    });

    setTimeout(async () => {
      if (iptal) return;
      if (k.medyaId) onizlemeAdresiniBirak(k.medyaId);
      await veri.kayitYokEt(id);
      await tazele();
    }, GERI_AL_SURESI);
  });
}

// Var olan bir kaydın başlığını (metnini) yaz ya da düzelt.
function kayitBasligiSor(id) {
  const k = durum.kayitlar.find(x => x.id === id);
  if (!k) return;
  durum.acikSatir = null;

  ortuAc(`
    <div class="ortu-baslik">Bu kayıt ne hakkında?</div>
    <div class="ortu-alt">Tek satır yeter — sonradan açmadan ne olduğunu anlamak için.</div>
    <input class="girdi" id="kBaslik" value="${kacis(k.metin || '')}"
           placeholder="ör. Ohrid gölünde akşam" autocomplete="off" enterkeyhint="done">
    <button class="eylem-dugme birincil" id="kBaslikKaydet">Kaydet</button>
    <button class="eylem-dugme" id="kBaslikVazgec">Vazgeç</button>
  `);
  setTimeout(() => $('#kBaslik')?.focus(), 120);

  const kaydet = async () => {
    const m = $('#kBaslik').value.trim();
    ortuKapat();
    await veri.kayitEkle({ ...k, metin: m });
    kayitBildir(m ? 'Başlık yazıldı.' : 'Başlık silindi.', 'iyi');
    await tazele();
  };
  $('#kBaslikKaydet').addEventListener('click', kaydet);
  $('#kBaslikVazgec').addEventListener('click', ortuKapat);
  $('#kBaslik').addEventListener('keydown', (e) => { if (e.key === 'Enter') kaydet(); });
}

/**
 * Kaydı başka bir saate ya da güne taşı.
 *
 * Gerçek ihtiyaç: telefonun saati yanlışken yapılan kayıt, ya da gece yarısını
 * geçtikten sonra "hâlâ dünün akşamı" olan bir not — ikisi de yanlış güne
 * düşüyor. Kaydın kendisi değişmiyor, sadece defterdeki yeri.
 */
function kaydiTasiSor(id) {
  const k = durum.kayitlar.find(x => x.id === id);
  if (!k) return;
  durum.acikSatir = null;

  const s = gerok.aktifGerok();
  const d = new Date(k.t);
  const saatMetni = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const tarihMetni = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  ortuAc(`
    <div class="ortu-baslik">Saat ve gün</div>
    <div class="ortu-alt">Yanlış güne düşen kaydı buradan taşı. Kaydın kendisi
    değişmez — yalnızca zaman çizgisindeki yeri.</div>
    <div class="girdi-etiket">Tarih</div>
    <input class="girdi" id="tasiTarih" type="date" value="${tarihMetni}">
    <div class="girdi-etiket">Saat</div>
    <input class="girdi" id="tasiSaat" type="time" value="${saatMetni}">
    ${s?.gunler?.length ? `<div class="panel-not">Yeni saat turun bir gününe düşerse
      kayıt kendiliğinden o güne yerleşir.</div>` : ''}
    <button class="eylem-dugme birincil" id="tasiKaydet">Taşı</button>
    <button class="eylem-dugme" id="tasiVazgec">Vazgeç</button>
  `);

  $('#tasiVazgec').addEventListener('click', ortuKapat);
  $('#tasiKaydet').addEventListener('click', async () => {
    const tarih = $('#tasiTarih').value;
    const saat = $('#tasiSaat').value;
    const yeni = new Date(`${tarih}T${saat || '00:00'}:00`).getTime();
    if (!Number.isFinite(yeni)) { kayitBildir('Tarih anlaşılmadı.', 'kotu'); return; }
    ortuKapat();
    // Gün numarası yeniden hesaplanıyor: turun gün pencerelerine göre.
    await veri.kayitEkle({ ...k, t: yeni, gun: gerok.gunNo(yeni) });
    kayitBildir(`Taşındı · ${gerok.tarihUzun(yeni)} ${gerok.saat(yeni)}`, 'iyi');
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
  $('#calmaSerit')?.classList.add('gizli');
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
    // Parmak çubuğun üstündeyken sayaç karışmıyor: ne çubuğu geri itiyor
    // ne de yazıyı. Yazıyı da susturmak gerekiyordu — yoksa sürüklerken
    // "kaçıncı saniyedeyim" bilgisi 200 ms'de bir çalan sesin saniyesiyle
    // eziliyor ve çubuk nereye gittiği görünmüyordu (simülatörde yakalandı).
    if (calan.cubuk?.dataset.tutuluyor === '1') return;

    const gecen = gecenSaniye();
    const toplam = calan.toplam || 0;
    if (calan.sure) calan.sure.textContent = `${sureYaz(gecen)} / ${sureYaz(toplam)}`;
    if (calan.cubuk && toplam > 0) {
      calan.cubuk.value = Math.round(Math.min(1, gecen / toplam) * 1000);
    }
    calmaSeridiYaz(gecen, toplam);
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
    cubuk: kap.querySelector('.dalga'),
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

// Dalga çizgisi bir <input type="range"> değil ama çalma kodu için öyle
// davranıyor: üstüne 0–1000 arası bir `value` özelliği tanımlanıyor, yazılınca
// dolu kat o orana kırpılıyor. Böylece sayaç ve durdurma kodunun tek satırı
// bile değişmedi — oynatıcının işleyişi sınanmış haliyle duruyor.
function dalgayiKur(dalga, kap, medyaId, bicim, kayitliSure) {
  if (!dalga || dalga.dataset.kurulu === '1') return;
  dalga.dataset.kurulu = '1';

  const dolu = dalga.querySelector('.dalga-kat.dolu');
  let deger = 0;
  Object.defineProperty(dalga, 'value', {
    get: () => deger,
    set: (yeni) => {
      deger = Math.max(0, Math.min(1000, Number(yeni) || 0));
      dolu.style.clipPath = `inset(0 ${100 - deger / 10}% 0 0)`;
      dalga.setAttribute('aria-valuenow', String(Math.round(deger)));
    }
  });

  const oranBul = (ev) => {
    const r = dalga.getBoundingClientRect();
    const x = (ev.touches?.[0]?.clientX ?? ev.clientX) - r.left;
    return Math.max(0, Math.min(1, r.width ? x / r.width : 0));
  };

  const yaziYaz = (oran) => {
    const toplam = (calan?.medyaId === medyaId ? calan.toplam : kayitliSure) || kayitliSure;
    const yazi = kap.querySelector('.sure');
    if (yazi) yazi.textContent = `${sureYaz(oran * toplam)} / ${sureYaz(toplam)}`;
  };

  let suruklu = false;

  const bas = (ev) => {
    suruklu = true;
    dalga.dataset.tutuluyor = '1';
    const oran = oranBul(ev);
    dalga.value = oran * 1000;
    yaziYaz(oran);
  };

  // Sürüklerken yalnızca çizgi ve yazı oynuyor; ses gerçekten parmak kalkınca
  // atlıyor. Web Audio yolunda her ara adımda yeniden başlatmak sesi
  // tırmalardı, iki yol da aynı davransın diye tek kural.
  const kaydir = (ev) => {
    if (!suruklu) return;
    const oran = oranBul(ev);
    dalga.value = oran * 1000;
    yaziYaz(oran);
  };

  const birak = async (ev) => {
    if (!suruklu) return;
    suruklu = false;
    dalga.dataset.tutuluyor = '0';
    const oran = (ev && oranBul(ev)) ?? dalga.value / 1000;

    // Çalmıyorsa: dokunmak o saniyeden başlatır.
    if (!calan || calan.medyaId !== medyaId) {
      await sesCal(medyaId, kap, bicim, kayitliSure, oran);
      return;
    }
    await sesAtla(oran * (calan.toplam || kayitliSure));
  };

  dalga.addEventListener('pointerdown', (ev) => { dalga.setPointerCapture?.(ev.pointerId); bas(ev); });
  dalga.addEventListener('pointermove', kaydir);
  dalga.addEventListener('pointerup', birak);
  dalga.addEventListener('pointercancel', () => { suruklu = false; dalga.dataset.tutuluyor = '0'; });
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
  // Ortam sesi: konuşmadan, o yerin nasıl duyulduğu. Süre artık seçiliyor —
  // 30 saniye çarşı için yetiyordu ama ezan, yağmur, dalga için kısa kalıyordu.
  $('#btnOrtam').addEventListener('click', ortamSuresiSor);

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
  // Nişangâh açıkken iğneye dokunmak durak kartını açmasın: o an amaç yeni
  // durak koymak, kartın üstüne binmesi kafa karıştırıyor.
  durakTiklamasi((id) => { if (!nisanAcik) durakKartiAc(id); });

  $('#haritaBenim').addEventListener('click', () => konumaGit(iz.sonBilinenKonum()));
  $('#haritaHepsi').addEventListener('click', hepsiniGoster);
  yerAramaKur();
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

// ---- Yarım kalan kayıt ----------------------------------------------------
//
// iOS uygulamayı arka planda öldürebiliyor: yer darsa, telefon yeniden
// başlarsa, kart yukarı kaydırılırsa. O an kayıt sürüyorsa eskiden bellekteki
// ses onunla birlikte giderdi. Artık her parça diske de yazılıyor
// (kayit.js) — burada, açılışta, o dosya bulunursa ne yapılacağı soruluyor.
//
// Varsayılan SAKLAMAK: yarım bir kayıt, hiç olmayan kayıttan iyidir.

async function yarimKayitSor() {
  const g = await kayit.yarimKayitVarMi();
  if (!g) return;

  const sure = Math.max(0, (g.sonParca - g.baslangic) / 1000);
  const ne = veri.TURLER[g.tur] || 'Sesli not';

  ortuAc(`
    <div class="gs-sayac">kayıt yarıda kalmış</div>
    <div class="ortu-baslik">Yarım bir kayıt bulundu</div>
    <div class="ortu-alt">${kacis(gerok.tarihUzun(g.baslangic))} ${kacis(gerok.saat(g.baslangic))}'de
    başlayan ses kaydı bitmeden uygulama kapanmış. Kaydedilen kısım duruyor.</div>
    <div class="gs-liste-satir" style="display:flex;align-items:center;gap:12px">
      <span class="dugme-ikon" style="flex:none">${ikon('mikrofon', 22)}</span>
      <span style="flex:1;min-width:0">${kacis(ne)} · ${kacis(sureYaz(sure))}</span>
      <button class="satir-dugme" id="yarimDinle">Dinle</button>
    </div>
    <button class="eylem-dugme birincil" id="yarimSakla">Sakla · ${kacis(gerok.saat(g.baslangic))}'e koy</button>
    <button class="eylem-dugme sil" id="yarimSil">Sil</button>
  `, false);

  $('#yarimDinle').addEventListener('click', async () => {
    const url = await kayit.yarimKayitAdresi();
    if (!url) { kayitBildir('Yarım dosya okunamadı.', 'kotu'); return; }
    const ses = new Audio(url);
    ses.play().catch(() => kayitBildir('Yarım kayıt çalınamadı — yine de saklanabilir.', 'kotu'));
  });

  $('#yarimSakla').addEventListener('click', async () => {
    ortuKapat();
    const k = await kayit.yarimKaydiSakla();
    await tazele();
    kayitBildir(k
      ? `Yarım kayıt ${gerok.saat(k.t)}'e yerleştirildi.`
      : 'Yarım dosya boş çıktı, kaydedilecek ses yoktu.', k ? 'iyi' : 'kotu');
  });

  $('#yarimSil').addEventListener('click', async () => {
    ortuKapat();
    await kayit.yarimKaydiSil();
    kayitBildir('Yarım kayıt silindi.');
  });
}

// ---- Kayıt ekranındaki uyarı şeritleri ------------------------------------
//
// İki sessiz arıza var ve ikisi de kayda basana kadar görünmüyor: mikrofon
// izni verilmemiş olabilir, ya da telefonda yer kalmamış olabilir. İkincisi
// daha kötü — kayıt başlıyor ve ORTASINDA ölüyor. Uyarı, kayda basmadan önce
// görünsün diye ekranın en üstünde duruyor.

function kayitUyarilariniCiz() {
  const kap = $('#kayitUyari');
  if (!kap) return;

  const d = durum.depolama;
  const bosYer = d?.kota ? d.kota - d.kullanilan : null;
  const azYer = bosYer != null && bosYer < AZ_YER_ESIGI;

  let html = '';

  if (durum.mikrofonRed) {
    html += `<div class="kayit-uyari izin">
      <div class="uyari-ad">Mikrofon izni yok</div>
      <div class="uyari-alt">Ses kaydı yapılamıyor. Yazı, fotoğraf, işaret ve
      harcama çalışmaya devam ediyor.</div>
      <button class="eylem-dugme birincil" id="uyariIzin">İzni nasıl veririm?</button>
    </div>`;
  }

  if (azYer) {
    html += `<div class="kayit-uyari depo">
      <div class="uyari-ad">Yer azalıyor</div>
      <div class="uyari-alt">${boyutYaz(bosYer)} boş yer kaldı. Uzun kayıt ve yedek
      için önce yer aç — kaydın ortasında dolarsa o kayıt yarım kalır.</div>
      <button class="eylem-dugme" id="uyariDepo">Nasıl yer açarım?</button>
    </div>`;
  }

  kap.innerHTML = html;

  // Yalnızca okunacak bir açıklama penceresi: aç, tek düğmeyle kapat.
  const bilgiOrtu = (ic) => {
    ortuAc(ic);
    $('#uyariKapat')?.addEventListener('click', ortuKapat);
  };

  $('#uyariIzin')?.addEventListener('click', () => bilgiOrtu(`
    <div class="ortu-baslik">Mikrofon izni</div>
    <div class="ortu-alt">
      Ana ekrandaki simgeden açtıysan:<br>
      <b>Ayarlar → Gerok → Mikrofon → İzin ver</b><br><br>
      Safari sekmesinden açtıysan:<br>
      <b>Ayarlar → Safari → Mikrofon → İzin ver</b><br><br>
      İzni verdikten sonra uygulamayı tamamen kapat (kartı yukarı kaydır) ve
      yeniden aç. İzin, uygulama açıkken değişmiyor.
    </div>
    <button class="eylem-dugme birincil" id="uyariKapat">Anladım</button>
  `));

  $('#uyariDepo')?.addEventListener('click', () => bilgiOrtu(`
    <div class="ortu-baslik">Yer açmak</div>
    <div class="ortu-alt">
      Sırayla:<br><br>
      1 · Önce <b>yedek al</b> (Gerok → eşitleme). Silmeden önce her zaman yedek.<br>
      2 · Harita paketini sil (Gerok → bu telefon). Sonra yeniden indirilebilir.<br>
      3 · Videolar uygulamada değil <b>galeride</b> duruyor. Yeri onlar kaplıyorsa
      Fotoğraflar uygulamasından temizle.
    </div>
    <button class="eylem-dugme birincil" id="uyariKapat">Anladım</button>
  `));
}

// Ses kaydı — dokun başlat, dokun durdur.
//
// Önce "basılı tut, bırak" vardı ve gerçek telefonda çalışmıyordu: mikrofon
// izni sorulurken parmak kalkıyor, bırakma olayı izin penceresine gidiyor,
// kayıt hiç durmuyordu. Görünür bir durdurma düğmesi bu sınıfın bütün
// hatalarını kapatıyor — kaydı bitiren şey artık parmağın değil, bir düğme.
let sesOturum = null;

export function sesKaydiVarMi() { return sesOturum !== null; }

// Kayıt sürerken ekranın kendiliğinden sönmesini engelleyen kilit.
//
// Asıl önlem bu: iOS ekran sönünce sayfayı donduruyor ve kayıt kesiliyordu.
// Wake Lock, kullanıcı güç düğmesine basmadıkça ekranı açık tutuyor.
// (Güç düğmesine basılırsa kilit işe yaramaz — o durumda kayit.js'teki
// parça parça kaydetme devreye giriyor.)
let sesKilidi = null;

async function sesKilidiAl() {
  try {
    sesKilidi = await navigator.wakeLock?.request('screen') || null;
    sesKilidi?.addEventListener('release', () => { sesKilidi = null; });
  } catch { /* Wake Lock yoksa ekran normal davranır */ }
  return !!sesKilidi;
}

function sesKilidiBirak() {
  // Yol Modu kendi kilidini tutuyorsa ona dokunma.
  try { sesKilidi?.release(); } catch { /* zaten bırakılmış */ }
  sesKilidi = null;
}

function sesKatmaniKapat() {
  $('#sesKatman').classList.add('gizli');
  $('#sesKatman').classList.remove('durakli');
  $('#sesSure').textContent = '0:00';
  sesKilidiBirak();
  sesOturum = null;
}

/**
 * Kaydı duraklatır ya da kaldığı yerden devam ettirir.
 *
 * Neden gerekli: rehber anlatırken araya biri girdi, telefon çaldı, otobüs
 * durdu — kaydı bitirip yenisini açmak o konuşmayı ikiye bölüyordu. Aynı
 * dosyada devam etmek, on yıl sonra dinlerken tek bir anlatı bırakıyor.
 */
function sesDuraklatDegistir() {
  const o = sesOturum;
  if (!o || o.kapandi) return;
  const dugme = $('#sesDuraklat');

  if (kayit.sesDuraklandiMi()) {
    if (!kayit.sesDevam()) { kayitBildir('Devam ettirilemedi.', 'kotu'); return; }
    $('#sesKatman').classList.remove('durakli');
    dugme.textContent = '⏸ Duraklat';
    dugme.classList.remove('birincil');
    // Kayıt sürerken asıl eylem yine "Durdur ve kaydet".
    $('#sesDurdur').classList.add('birincil');
    $('#sesIpucu').textContent = o.ipucu;
    titret(12);
  } else {
    if (!kayit.sesDuraklat()) { kayitBildir('Duraklatılamadı.', 'kotu'); return; }
    $('#sesKatman').classList.add('durakli');
    dugme.textContent = '▶ Devam et';
    dugme.classList.add('birincil');
    // Duraklıyken asıl eylem "Devam et". İki düğme birden vurgulu olunca
    // hangisine basılacağı bir anda anlaşılmıyordu (ekran görüntüsünde
    // ikisi de kahverengi çıktı) — tek vurgulu düğme kalsın.
    $('#sesDurdur').classList.remove('birincil');
    $('#sesIpucu').textContent = 'Duraklatıldı — "Devam et" deyince aynı kaydın '
      + 'içinden sürer. Ara kayda girmez.';
    titret([8, 40, 8]);
  }
}

// tur: kaydın türü · sinir: saniye (0 = sınırsız) · ipucu: katmanda yazan satır
export async function sesKaydiBaslat(tur, { sinir = 0, ipucu = 'Konuş — bitince "Durdur ve kaydet"', bittiginde = null, baslikSor = true, ekler = null } = {}) {
  if (sesOturum) return;
  const o = { tur, iptal: false, kapandi: false, sayac: null, bittiginde, baslikSor, ekler, ipucu };
  sesOturum = o;

  $('#sesKatman').classList.remove('gizli');
  $('#sesKatman').classList.remove('durakli');
  $('#sesSure').textContent = sinir ? sureYaz(sinir) : '0:00';
  $('#sesIpucu').textContent = 'Mikrofon açılıyor…';
  $('#sesDurdur').disabled = true;
  $('#sesDurdur').classList.add('birincil');

  // Duraklatma her tarayıcıda yok; olmayan yerde düğmeyi hiç gösterme —
  // basınca hiçbir şey olmayan bir düğme, bozuk bir düğmedir.
  const durDugme = $('#sesDuraklat');
  durDugme.textContent = '⏸ Duraklat';
  durDugme.classList.remove('birincil');
  durDugme.disabled = true;
  durDugme.classList.toggle('gizli', !kayit.sesDuraklatilabilirMi());

  // Türü kayıt başlamadan söylüyoruz: yarım kayıt günlüğüne de bu giriyor,
  // yoksa kurtarılan bir "mektup" sıradan bir sesli not olarak geri gelirdi.
  kayit.sesTuruAyarla(tur);

  let basladi = false;
  try {
    basladi = await kayit.sesBasla();
    // Bir kez izin verildiyse uyarı şeridi kalksın.
    durum.mikrofonRed = false;
  } catch (hata) {
    sesOturum = null;
    sesKatmaniKapat();
    // İzin reddi ile mikrofonun başka bir sebeple açılamaması aynı şey değil;
    // ikisine aynı cevabı vermek insanı Ayarlar'da boşuna dolaştırıyor.
    const izinYok = hata?.name === 'NotAllowedError' || hata?.name === 'SecurityError';
    durum.mikrofonRed = izinYok;
    kayitUyarilariniCiz();
    kayitBildir(izinYok
      ? 'Mikrofon izni yok. Ayarlar → Gerok → Mikrofon → İzin ver.'
      : `Mikrofon açılamadı: ${hata?.message || 'bilinmeyen sebep'}`, 'kotu');
    return;
  }

  // İzin beklenirken "Vazgeç"e basılmış olabilir — mikrofonu hemen bırak.
  if (o.iptal || !basladi) {
    kayit.sesIptal();
    if (!o.kapandi) sesKatmaniKapat();
    return;
  }

  // Ekranın kendiliğinden sönmesini engelle: sönerse iOS kaydı kesiyor.
  const kilitli = await sesKilidiAl();
  o.ipucu = kilitli ? ipucu : `${ipucu}\nEkranı kapatma — kayıt kesilir.`;
  $('#sesIpucu').textContent = o.ipucu;
  $('#sesDurdur').disabled = false;
  $('#sesDuraklat').disabled = false;
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
    k = await kayit.sesBitir(o.tur, o.ekler || {});
  } catch (hata) {
    // İki ayrı sebep var ve ikisine yapılacak şey farklı — ayırt et.
    // Üç ayrı sebep var ve yapılacak şey her birinde farklı — ayırt et.
    kayitBildir(
      hata.sesKesildi
        ? 'KAYIT EDİLEMEDİ: ekran kapalıyken iOS kaydı kesmiş. Kayıt sırasında '
          + 'ekranı açık tut ya da Yol Modu\'nu aç — o ekranı söndürmüyor.'
      : hata.yazilamadi
        ? `KAYIT EDİLEMEDİ: ${hata.message}. Telefonda yer kalmamış olabilir — `
          + 'Gerok sekmesinden yer durumuna bak, yedek al ve eski kayıtları temizle.'
        : `KAYIT EDİLEMEDİ: ${hata.message}. Telefonda yer kalmamış olabilir.`,
      'kotu');
    await o.bittiginde?.(null);
    return;
  }

  if (k) {
    // Nereye düştüğünü söyle. "Kaydedildi" demek yetmiyordu: tur bittikten
    // sonra yapılan kayıt turun günlerine girmediği için farklı bir başlığın
    // altına düşüyor ve aranıyordu.
    const nere = k.gun != null
      ? `Gün ${k.gun}`
      : `zaman çizgisinin başında · ${gerok.tarihUzun(k.t)}`;
    kayitBildir(`Kaydedildi · ${sureYaz(k.sure)} → ${nere}`, 'iyi');
    titret([8, 40, 8]);
    await tazele();
    // Kaydın ne olduğunu şimdi sor. Gezide çıkan sorun: zaman çizgisinde
    // 82 tane aynı görünen ses kartı vardı, hangisinin ne olduğunu anlamak
    // için tek tek açmak gerekiyordu. Tek satır başlık bunu bitiriyor.
    if (o.baslikSor !== false) await sesBasligiSor(k);
  } else {
    kayitBildir('Çok kısaydı, kaydedilmedi.');
  }
  await o.bittiginde?.(k);
}

// Ortam sesi süreleri. Son seçilen hatırlanıyor: aynı gezide genelde aynı
// süre kullanılıyor, her seferinde seçtirmek gereksiz dokunuş olurdu.
const ORTAM_SURELERI = [
  { sn: 15,  ad: '15 saniye', alt: 'kısa bir an' },
  { sn: 30,  ad: '30 saniye', alt: 'çarşı, sokak' },
  { sn: 60,  ad: '1 dakika',  alt: 'ezan, müzik' },
  { sn: 120, ad: '2 dakika',  alt: 'yağmur, dalga, tren' },
  { sn: 0,   ad: 'Elle durdur', alt: 'ne kadar sürerse' }
];

async function ortamSuresiSor() {
  const son = await veri.ayarOku('ortamSuresi', 30);
  ortuAc(`
    <div class="ortu-baslik">Ortam sesi</div>
    <div class="ortu-alt">Konuşma — sadece burayı dinlet. Ne kadar kaydedelim?</div>
    ${ORTAM_SURELERI.map(s => `
      <button class="eylem-dugme ${s.sn === son ? 'birincil' : ''}" data-sn="${s.sn}">
        ${s.ad}<span class="yol-alt">${s.alt}</span>
      </button>`).join('')}
  `);
  $$('#ortuIc [data-sn]').forEach(d => {
    d.addEventListener('click', async () => {
      const sn = Number(d.dataset.sn);
      ortuKapat();
      await veri.ayarYaz('ortamSuresi', sn);
      sesKaydiBaslat('ortam', {
        sinir: sn,
        ipucu: sn
          ? `Konuşma — sadece burayı dinlet. ${sureYaz(sn)} sonra kendi biter.`
          : 'Konuşma — sadece burayı dinlet. Bitince "Durdur ve kaydet".'
      });
    });
  });
}

/**
 * Kayıttan hemen sonra tek satır başlık ister. Atlanabilir — yolda acelesi
 * olan biri "Atla"ya basıp devam edebilsin; zorunlu olsaydı kayıt almaktan
 * vazgeçilirdi.
 */
function sesBasligiSor(k) {
  return new Promise((bitti) => {
    ortuAc(`
      <div class="ortu-baslik">Bu kayıt ne hakkında?</div>
      <div class="ortu-alt">Tek satır yeter. Sonra açmadan ne olduğunu bilirsin.</div>
      <input class="girdi" id="sesBaslik" placeholder="Ohrid'de rehberin anlattığı…"
             autocomplete="off" enterkeyhint="done">
      <button class="eylem-dugme birincil" id="sesBaslikKaydet">Kaydet</button>
      <button class="eylem-dugme" id="sesBaslikAtla">Atla</button>
    `);
    setTimeout(() => $('#sesBaslik')?.focus(), 120);

    const kapat = async (yaz) => {
      const m = yaz ? $('#sesBaslik').value.trim() : '';
      ortuKapat();
      if (m) {
        await veri.kayitEkle({ ...k, metin: m });
        await tazele();
      }
      bitti();
    };
    $('#sesBaslikKaydet').addEventListener('click', () => kapat(true));
    $('#sesBaslikAtla').addEventListener('click', () => kapat(false));
    $('#sesBaslik').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') kapat(true);
    });
  });
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
  $('#sesDuraklat').addEventListener('click', sesDuraklatDegistir);
}

async function fotograflariAl(dosyalar, tur = null) {
  ortuAc(`
    <div class="ortu-baslik">Fotoğraflar alınıyor</div>
    <div class="ortu-alt" id="fotoIlerleme">Hazırlanıyor…</div>
    <div class="panel-not">Orijinaller galeride kalıyor — buraya küçük bir önizleme,
    çekilme saati ve konum yazılıyor.</div>
  `, false);

  // Ne olursa olsun örtü kapanmalı: burada takılırsa uygulama kilitli görünüyor.
  let eklenen = [];
  try {
    eklenen = await kayit.fotoAl(dosyalar, (yapilan, toplam) => {
      const e = $('#fotoIlerleme');
      if (e) e.textContent = `${yapilan} / ${toplam}`;
    }, tur) || [];
  } catch (hata) {
    ortuKapat();
    kayitBildir(`Fotoğraflar alınamadı: ${hata.message}`, 'kotu');
    return;
  }

  ortuKapat();
  await tazele();

  const atlanan = kayit.sonBasarisizlar();
  const izsiz = durum.kayitlar.filter(k => k.tur === 'foto' && !k.lat).length;

  // NEREYE GİTTİĞİNİ SÖYLE.
  //
  // Gezide "fotoğraflar 10 dakika sonra düşüyor" diye görünen şey aslında
  // buydu: fotoğraf EKLENDİĞİ ana değil ÇEKİLDİĞİ ana yerleşiyor (doğrusu da
  // bu). Akşam 20:47'de eklenen, öğleden sonra 18:57'de çekilmiş bir fotoğraf
  // zaman çizgisinde iki saat YUKARIDA beliriyor — aşağıya bakan kişi
  // "gelmedi" sanıyor. Gerçek kayıtlarda fark 12 dakika ile 22 saat arasında
  // değişiyordu. Çözüm saati değiştirmek değil, nereye düştüğünü söylemek.
  const eklenenler = (eklenen || []).filter(k => k?.t).sort((a, b) => a.t - b.t);
  let nereye = '';
  if (eklenenler.length) {
    const ilk = eklenenler[0], son = eklenenler[eklenenler.length - 1];
    const ayniGun = new Date(ilk.t).toDateString() === new Date(son.t).toDateString();
    nereye = eklenenler.length === 1 || (ayniGun && ilk.t === son.t)
      ? ` ${gerok.tarihUzun(ilk.t)} ${gerok.saat(ilk.t)} hizasına yerleşti.`
      : ` ${gerok.tarihUzun(ilk.t)} ${gerok.saat(ilk.t)}` +
        `${ayniGun ? '' : ' – ' + gerok.tarihUzun(son.t)}` +
        `${ayniGun ? '–' + gerok.saat(son.t) : ' ' + gerok.saat(son.t)} arasına yerleşti.`;
  }

  kayitBildir(
    atlanan.length ? `${atlanan.length} dosya alınamadı, geri kalanı eklendi.`
      : (`${eklenenler.length} görsel eklendi.${nereye}` +
         (izsiz ? ` ${izsiz} tanesinin yeri bulunamadı — iz o saatte kapalıymış.` : '')),
    atlanan.length ? 'kotu' : 'iyi'
  );

  // Çekildikleri ana git: eklediğini gözüyle görsün, aramak zorunda kalmasın.
  if (eklenenler.length) fotografaGit(eklenenler[0].id);
}

// Eklenen ilk fotoğrafın zaman çizgisindeki yerine kaydırır ve kısa süre
// vurgular. "Nereye gitti?" sorusunu okumakla değil göstererek cevaplıyoruz.
function fotografaGit(id) {
  setTimeout(() => {
    if (durum.ekran !== 'zaman') return;
    const e = document.querySelector(`[data-kayit="${id}"]`);
    if (!e) return;
    e.scrollIntoView({ behavior: 'smooth', block: 'center' });
    e.classList.add('yeni-eklendi');
    setTimeout(() => e.classList.remove('yeni-eklendi'), 2600);
  }, 260);
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
/**
 * Durağa elle yazılmış notlar.
 *
 * Paketten gelen "unutma" listesinden ayrı gösteriliyor: biri Mac'te önceden
 * hazırlanmış program, öteki yolda öğrenilen şey ("tatlıyı köşedeki dükkândan
 * al"). İkisini aynı listede toplamak hangisinin nereden geldiğini siliyordu.
 */
function kendiNotlari(d) {
  if (!d.notlar?.length) return '';
  return `<ul class="unutma kendi">${d.notlar.map(n => `
    <li>
      <div class="not-govde">
        <span class="not-metin">${kacis(n.metin)}</span>
        ${n.sahipAd ? `<span class="not-kim">${kacis(n.sahipAd)}</span>` : ''}
      </div>
      <button class="not-sil" data-not-sil="${n.id}" data-not-durak="${d.id}"
              title="Notu sil" aria-label="Notu sil">✕</button>
    </li>`).join('')}</ul>`;
}

/**
 * Beş yıldız — yatay.
 *
 * Yatay seçildi: kart zaten yukarıdan aşağı okunuyor, dikey bir yıldız
 * sütunu kartı iki katına çıkarırdı ve 26 duraklık listede kaydırmayı
 * uzatırdı. Yatay beş yıldız tek satır, başparmakla ulaşılır.
 */
function yildizSatiri(d) {
  return `<div class="puan" data-puan-durak="${d.id}">
    ${[1, 2, 3, 4, 5].map(n => `
      <button class="yildiz ${(d.puan || 0) >= n ? 'dolu' : ''}" data-puan="${n}"
              aria-label="${n} yıldız">★</button>`).join('')}
    <span class="puan-yazi">${d.puan ? `${d.puan}/5` : 'puanın'}</span>
  </div>`;
}

/** Durağa yeni not yazma penceresi. */
function durakNotuSor(id, sonra = null) {
  const d = gerok.durakBul(id);
  if (!d) return;
  ortuAc(`
    <div class="ortu-baslik">${kacis(d.ad)}</div>
    <div class="ortu-alt">Buraya gelince ne yapmalı? Kendi notun — akşam
    eşitlemesinde arkadaşının telefonuna da geçer.</div>
    <textarea class="alan" id="durakNot"
      placeholder="Örn. Tarçınlı tatlıyı saat kulesinin yanındaki dükkândan al."></textarea>
    <button class="eylem-dugme birincil" id="durakNotKaydet">Kaydet</button>
    <button class="eylem-dugme" id="durakNotVaz">Vazgeç</button>
  `);
  setTimeout(() => $('#durakNot')?.focus(), 120);
  $('#durakNotVaz').addEventListener('click', () => { ortuKapat(); sonra?.(); });
  $('#durakNotKaydet').addEventListener('click', async () => {
    const m = $('#durakNot').value.trim();
    ortuKapat();
    if (m) {
      await gerok.durakNotEkle(id, m, kayit.sahipAl().ad || '');
      kayitBildir('Not eklendi.', 'iyi');
      await tazele();
    }
    sonra?.();
  });
}

/**
 * Kart içindeki not silme, yıldız ve "not yaz" düğmelerini bağlar.
 *
 * `sonra`: haritadaki durak kartında kullanılıyor. Orada `tazele()` kartı
 * yeniden çizmiyor — yıldıza basınca ekranda hiçbir şey değişmiyormuş gibi
 * görünüyordu. Bu geri çağrı kartı yeniden açıyor.
 */
function durakNotVePuanKur(kap, sonra = null) {
  kap.querySelectorAll('[data-not-ekle]').forEach(b => {
    b.addEventListener('click', () => durakNotuSor(b.dataset.notEkle, sonra));
  });
  kap.querySelectorAll('[data-not-sil]').forEach(b => {
    b.addEventListener('click', async () => {
      await gerok.durakNotSil(b.dataset.notDurak, b.dataset.notSil);
      await tazele();
      sonra?.();
    });
  });
  kap.querySelectorAll('.puan [data-puan]').forEach(b => {
    b.addEventListener('click', async () => {
      const id = b.closest('[data-puan-durak]').dataset.puanDurak;
      await gerok.durakPuanla(id, Number(b.dataset.puan));
      titret(8);
      await tazele();
      sonra?.();
    });
  });
}

function duraklariCiz() {
  const kap = $('#duraklarListe');
  const liste = gerok.duraklar();
  const bugun = gerok.bugununGunu();
  const s = gerok.aktifGerok();

  if (!liste.length) {
    kap.innerHTML = bosDurum('yolBos',
      'Henüz durak yok.<br>Haritadaki iğne düğmesine basıp kendi duraklarını koyabilirsin —' +
      '<br>gerok paketi olmadan da çalışır.') +
      `<div class="daha-eski"><button class="eylem-dugme birincil" id="durakEkleBos">Haritadan durak ekle</button></div>`;
    $('#durakEkleBos').addEventListener('click', haritadanDurakEkle);
    return;
  }

  const konum = iz.sonBilinenKonum();

  // Gün gün başlıklar — rota da zaten gün gün renkleniyor.
  let html = `<div class="durak-ekle-satir">
    <button class="eylem-dugme" id="durakEkleHarita">Haritadan durak ekle</button>
    <button class="eylem-dugme" id="durakEkleBurada">Şu an buradayım, durak yap</button>
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
          <button class="sira-dugme" data-gun-tasi="${d.id}" title="Başka güne taşı">⇄</button>
        </div>
      </div>
      ${uzaklik != null ? `<div class="durak-uzaklik">${uzaklikYaz(uzaklik)} uzakta${kendi ? ' · kendi durağın' : ''}${d.gunTasindi ? ' · başka güne taşındı' : ''}</div>`
                        : (kendi || d.gunTasindi) ? `<div class="durak-uzaklik">${kendi ? 'kendi durağın' : ''}${kendi && d.gunTasindi ? ' · ' : ''}${d.gunTasindi ? 'başka güne taşındı' : ''}</div>` : ''}
      ${d.osmBilgi && d.osmBilgi !== '\u2014'
        ? `<div class="durak-osm" title="OpenStreetMap'ten geldi">${kacis(d.osmBilgi)}</div>` : ''}
      ${d.unutma?.length ? `<ul class="unutma">${d.unutma.map(u => `<li>${kacis(u)}</li>`).join('')}</ul>` : ''}
      ${kendiNotlari(d)}
      ${yildizSatiri(d)}
      <div class="durak-dugmeler">
        <button class="kucuk-dugme ${dur === 'gidildi' ? 'secili' : ''}" data-isaret="gidildi">Gittik</button>
        <button class="kucuk-dugme ${dur === 'kacirildi' ? 'secili' : ''}" data-isaret="kacirildi">Kaçırdık</button>
        <button class="kucuk-dugme" data-durak-google="${d.id}">Google</button>
      </div>
      <div class="durak-dugmeler">
        <button class="kucuk-dugme" data-not-ekle="${d.id}">＋ Not yaz</button>
        ${kendi ? `<button class="kucuk-dugme" data-duzenle="${d.id}">Düzenle</button>
        <button class="kucuk-dugme sil" data-durak-sil="${d.id}">Sil</button>` : ''}
      </div>
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

  kap.querySelectorAll('[data-gun-tasi]').forEach(d => {
    d.addEventListener('click', () => durakGunuSor(d.dataset.gunTasi));
  });

  kap.querySelectorAll('[data-duzenle]').forEach(d => {
    d.addEventListener('click', () => durakSor({ mevcut: gerok.durakBul(d.dataset.duzenle) }));
  });
  kap.querySelectorAll('[data-durak-sil]').forEach(d => {
    d.addEventListener('click', () => durakSilSor(d.dataset.durakSil));
  });
  durakNotVePuanKur(kap);
}

/**
 * Durağı başka bir güne taşır.
 *
 * Balkanlar'da gerçekten oldu: rehber bazı duraklara bir gün erken götürdü,
 * durak yanlış günde asılı kaldı. Paket durakları için de çalışıyor —
 * paketin kendisi değişmiyor, üstüne bir katman yazılıyor.
 */
function durakGunuSor(id) {
  const d = gerok.durakBul(id);
  if (!d) return;
  const gunler = gerok.aktifGerok()?.gunler || [];

  ortuAc(`
    <div class="ortu-baslik">${kacis(d.ad)}</div>
    <div class="ortu-alt">Şu an ${d.gun ? `Gün ${d.gun}` : 'günsüz'}. Hangi güne taşıyalım?</div>
    ${gunler.map(g => `
      <button class="eylem-dugme ${g.no === d.gun ? 'birincil' : ''}" data-gun="${g.no}">
        Gün ${g.no}<span class="yol-alt">${kacis(g.baslik || '')}</span>
      </button>`).join('')}
    ${d.gunTasindi ? '<button class="eylem-dugme" data-gun="">Paketteki gününe geri al</button>' : ''}
  `);

  $$('#ortuIc [data-gun]').forEach(b => {
    b.addEventListener('click', async () => {
      const g = b.dataset.gun === '' ? null : Number(b.dataset.gun);
      ortuKapat();
      if (g === d.gun) return;
      await gerok.durakGunuDegistir(id, g);
      kayitBildir(g ? `${d.ad} → Gün ${g}` : `${d.ad} paketteki gününe döndü.`, 'iyi');
      await tazele();
    });
  });
}

// ---- Kendi durağını koyma --------------------------------------------------
//
// Haritanın ortasında bir nişangâh var; kullanıcı haritayı kaydırıp iğneyi
// yerleştiriyor. "Basılı tut" yerine bu seçildi: harita zaten parmakla
// kaydırılıyor, basılı tutma ikisini birbirine karıştırıyor. Nişangâh
// tek elle, araç sallanırken de isabetli.

let nisanAcik = false;

// Hangi sürümü çalıştırdığımız. Servis worker dosyaları "gerok-YYYYAAGG-ssdd"
// adlı bir önbelleğe koyuyor; o adı okumak "şu an gerçekten hangi dosyalar
// çalışıyor" sorusunun en dürüst cevabı — sabit bir yazıya güvenmiyoruz.
async function calisanSurum() {
  if (!('caches' in window)) return null;
  const adlar = await caches.keys();
  return adlar.find(a => a.startsWith('gerok-')) || null;
}

function surumOku(ad) {
  const p = /^gerok-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})/.exec(ad || '');
  return p ? `${p[3]}.${p[2]}.${p[1]} ${p[4]}:${p[5]}` : (ad || 'bilinmiyor');
}

async function surumuYaz() {
  const yer = $('#surumYazi');
  if (!yer) return;
  const ad = await calisanSurum();
  yer.textContent = ad ? surumOku(ad) : 'çevrimdışı kurulmamış';
}

// Elle güncelleme yoklaması. Kendiliğinden sayfa yenilemiyoruz (kayıt sırasında
// olursa kaydı uçurur), onun yerine yenisi indiyse "kapat aç" diyoruz.
async function surumuAra() {
  const tus = $('#btnSurum');
  if (tus) { tus.disabled = true; tus.textContent = 'Bakılıyor…'; }
  const oncekiler = ('caches' in window) ? await caches.keys() : [];

  try {
    const kayit = await navigator.serviceWorker?.getRegistration();
    if (!kayit) throw new Error('çevrimdışı kurulum yok');
    await kayit.update();
    // Yeni servis worker kurulup önbelleğini yazana kadar biraz bekliyoruz.
    await new Promise(r => setTimeout(r, 2500));

    const sonrakiler = await caches.keys();
    const yeni = sonrakiler.find(a => a.startsWith('gerok-') && !oncekiler.includes(a));
    if (yeni) {
      kayitBildir(`Yeni sürüm indi: ${surumOku(yeni)}. Uygulamayı tamamen kapatıp aç.`, 'iyi');
    } else {
      kayitBildir('Zaten en son sürümdesin.', 'iyi');
    }
  } catch (h) {
    // Yolda internet yok — bu bir hata değil, uygulama önbellekten çalışıyor.
    kayitBildir(`Bakılamadı (${h.message}). İnternet varken dene.`, 'kotu');
  }

  if (tus) { tus.disabled = false; tus.textContent = 'Yeni sürüm var mı?'; }
  surumuYaz();
}

function durakKoymaKipi(ac) {
  nisanAcik = !!ac;
  $('#haritaNisan').classList.toggle('gizli', !ac);
  $('#haritaEkleBar').classList.toggle('gizli', !ac);
  $('#haritaDurak').classList.toggle('secili', ac);
}

// ---- Haritada yer arama ----------------------------------------------------
//
// Durak koymak için haritayı elle kaydırıp doğru noktayı bulmak zordu —
// özellikle araç sallanırken. Artık "Struga" yazıp oraya gidiliyor.
// Arama ÇEVRİMDIŞI çalışıyor: bölgenin yer adları uygulamada gömülü.
// İnternet gerektiren geniş arama ayrı bir düğmede ve ancak basılırsa çalışır.

let aramaZaman = null;

function yerAramaKur() {
  const kap = $('#haritaAramaKap');
  const girdi = $('#haritaArama');

  const ac = (acik) => {
    kap.classList.toggle('gizli', !acik);
    $('#haritaAra').classList.toggle('secili', acik);
    if (acik) setTimeout(() => girdi.focus(), 100);
    else { girdi.value = ''; $('#aramaSonuc').innerHTML = ''; }
  };

  $('#haritaAra').addEventListener('click', () => ac(kap.classList.contains('gizli')));
  $('#aramaKapat').addEventListener('click', () => ac(false));

  girdi.addEventListener('input', () => {
    clearTimeout(aramaZaman);
    aramaZaman = setTimeout(() => aramaYap(girdi.value), 180);
  });
  girdi.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      $('#aramaSonuc .arama-satiri')?.click();   // ilk sonuca git
    }
  });
}

async function aramaYap(sorgu) {
  const yer = $('#aramaSonuc');
  if (!sorgu || sorgu.trim().length < 2) { yer.innerHTML = ''; return; }

  const merkez = haritaMerkezi();
  const sonuc = await yerAra.ara(sorgu, { merkez });

  if (!sonuc.length) {
    yer.innerHTML = `<div class="arama-bos">Yakında böyle bir yer yok.
      <button class="kucuk-dugme" id="aramaInternet">İnternette ara</button></div>`;
  } else {
    yer.innerHTML = sonuc.map((s, i) => `
      <button class="arama-satiri" data-i="${i}">
        <span>${kacis(s.ad)}</span>
        <span class="yer-alt">${kacis(s.alt)}</span>
      </button>`).join('')
      + `<div class="arama-bos">Aradığın burada yoksa
         <button class="kucuk-dugme" id="aramaInternet">internette ara</button>
         (wifi gerekir).</div>`;
  }

  $$('#aramaSonuc .arama-satiri').forEach(d => {
    d.addEventListener('click', () => yereGit(sonuc[+d.dataset.i]));
  });
  $('#aramaInternet')?.addEventListener('click', () => internetAramasi(sorgu));
}

async function internetAramasi(sorgu) {
  const yer = $('#aramaSonuc');
  yer.innerHTML = '<div class="arama-bos">İnternette aranıyor…</div>';
  try {
    const sonuc = await yerAra.internetteAra(sorgu);
    if (!sonuc.length) {
      yer.innerHTML = '<div class="arama-bos">Bulunamadı.</div>';
      return;
    }
    yer.innerHTML = sonuc.map((s, i) => `
      <button class="arama-satiri" data-i="${i}">
        <span>${kacis(s.ad)}</span>
        <span class="yer-alt">${kacis(s.alt)}</span>
      </button>`).join('');
    $$('#aramaSonuc .arama-satiri').forEach(d => {
      d.addEventListener('click', () => yereGit(sonuc[+d.dataset.i]));
    });
  } catch (h) {
    yer.innerHTML = `<div class="arama-bos">İnternete ulaşılamadı (${kacis(h.message)}).
      Wifi varken dene — gömülü listede arama internet olmadan da çalışıyor.</div>`;
  }
}

// Seçilen yere git ve nişangâhı aç: amaç zaten oraya durak koymak.
function yereGit(s) {
  if (!s) return;
  $('#haritaAramaKap').classList.add('gizli');
  $('#haritaAra').classList.remove('secili');
  $('#haritaArama').value = '';
  $('#aramaSonuc').innerHTML = '';

  konumaGit({ lat: s.lat, lon: s.lon }, 13);
  durakKoymaKipi(true);
  kayitBildir(`${s.ad} — haritayı ince ayarla, sonra "Buraya durak ekle".`, 'iyi');
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
    ${kendiNotlari(d)}
    ${yildizSatiri(d)}
    <div class="durak-dugmeler">
      <button class="kucuk-dugme ${dur === 'gidildi' ? 'secili' : ''}" id="kartGidildi">Gittik</button>
      <button class="kucuk-dugme ${dur === 'kacirildi' ? 'secili' : ''}" id="kartKacirildi">Kaçırdık</button>
    </div>
    <button class="eylem-dugme" data-not-ekle="${d.id}">＋ Not yaz</button>
    <button class="eylem-dugme" id="kartGoogle">Google Haritalar'da aç</button>
    ${d.kaynak === 'kendi' ? '<button class="eylem-dugme" id="kartDuzenle">Düzenle</button>' : ''}
    ${d.kaynak === 'kendi' ? '<button class="eylem-dugme sil" id="kartSil">Sil</button>' : ''}
    <button class="eylem-dugme" id="kartKapat">Kapat</button>
  `);

  // Not ve puan haritadaki kartta da çalışsın: durak listesine gidip aynı
  // durağı 26'nın arasından bulmak yolda vakit alıyor.
  durakNotVePuanKur($('#ortuIc'), () => durakKartiAc(id));

  $('#kartKapat').addEventListener('click', ortuKapat);
  $('#kartGoogle').addEventListener('click', () =>
    googleHaritalarAc({ lat: d.lat, lon: d.lon, ad: d.ad, zoom: 16 }));
  $('#kartDuzenle')?.addEventListener('click', () => durakSor({ mevcut: d }));
  // Yanlış yere durak koymak en kolay hata; iğneye dokunup silebilmeli.
  // Önce yalnızca Duraklar listesinde vardı — 25 durağın arasında onu bulmak
  // yolda kaydırmakla vakit alıyordu (telefonda denendi).
  $('#kartSil')?.addEventListener('click', () => durakSilSor(id));

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

// Uyarı sesi.
//
// GEZİDE ÇALIŞMADI. Sebebi iki ayrı iOS kısıtı (7–14 Ağustos, gerçek kullanım):
//
//   1. iPhone'da `navigator.vibrate` HİÇ YOK. Safari bu API'yi vermiyor;
//      kod çağırıyor, iOS sessizce yok sayıyor. Titreşim hiç çalışmadı.
//   2. AudioContext, ekran sönüp uygulama arkaya alınınca ASKIYA ALINIYOR.
//      Yol Modu açılırken bir dokunuşla hazırlamak yetmiyor: telefon cebe
//      girince düzenek donuyor, uyarı anındaki `resume()` ise dokunuş
//      olmadığı için çalışmıyor. Uyarı zaman çizgisine düşüyor ama sessiz —
//      oysa bütün amacı ekrana bakmadan fark ettirmek.
//
// ÇÖZÜM: AudioContext yerine gerçek bir <audio> ögesi. iOS, bir dokunuşla
// başlatılmış MEDYA OYNATIMINI ekran sönse de sürdürüyor (müzik dinlerken
// ekranı kilitlemek gibi). Yol Modu açılırken duyulmayacak kadar kısık bir ses
// döngüye alınıyor; bu, ses oturumunu ayakta tutuyor. Uyarı geldiğinde aynı
// oturum üzerinden yüksek sesli ton çalıyor — telefon cepteyken bile duyuluyor.
//
// Sessiz döngü pili yakmıyor: saniyede birkaç bayt çözülüyor.

let sesTutucu = null;      // sessiz döngü — ses oturumunu canlı tutar
let uyariCalar = null;     // asıl uyarı sesi

// Küçük WAV üreticisi. Hazır dosya eklemiyoruz: çevrimdışı önbelleğe bir dosya
// daha koymak, o dosya inmediğinde uyarıyı büsbütün susturma riski demek.
function wavVer(saniye, tonlar = [], ses = 0.9) {
  const hz = 22050, n = Math.floor(hz * saniye);
  const tampon = new ArrayBuffer(44 + n * 2);
  const g = new DataView(tampon);
  const yaz = (o, s) => { for (let i = 0; i < s.length; i++) g.setUint8(o + i, s.charCodeAt(i)); };
  yaz(0, 'RIFF'); g.setUint32(4, 36 + n * 2, true); yaz(8, 'WAVEfmt ');
  g.setUint32(16, 16, true); g.setUint16(20, 1, true); g.setUint16(22, 1, true);
  g.setUint32(24, hz, true); g.setUint32(28, hz * 2, true);
  g.setUint16(32, 2, true); g.setUint16(34, 16, true);
  yaz(36, 'data'); g.setUint32(40, n * 2, true);

  for (let i = 0; i < n; i++) {
    const t = i / hz;
    let v = 0;
    for (const { hzTon, bas, sure } of tonlar) {
      if (t < bas || t > bas + sure) continue;
      const yerel = t - bas;
      // Kenarları yumuşat: sert başlangıç iPhone hoparlöründe "tık" yapıyor.
      const zarf = Math.min(1, yerel / 0.01, (sure - yerel) / 0.03);
      v += Math.sin(2 * Math.PI * hzTon * yerel) * zarf;
    }
    g.setInt16(44 + i * 2, Math.max(-1, Math.min(1, v * ses)) * 32767, true);
  }
  let ikili = '';
  const bayt = new Uint8Array(tampon);
  for (let i = 0; i < bayt.length; i++) ikili += String.fromCharCode(bayt[i]);
  return 'data:audio/wav;base64,' + btoa(ikili);
}

/**
 * Yol Modu açılırken, DOKUNUŞ SIRASINDA çağrılmalı.
 * Ses oturumunu açar ve açık tutar. `true` dönerse uyarı ekran kapalıyken de
 * duyulur.
 */
export async function sesDuzenegiHazirla() {
  try {
    if (!sesTutucu) {
      sesTutucu = new Audio(wavVer(2, [{ hzTon: 40, bas: 0, sure: 2 }], 0.0006));
      sesTutucu.loop = true;
      sesTutucu.setAttribute('playsinline', '');
      // Ses seviyesi 0 OLMAMALI: iOS tamamen sessiz oynatımı "boş oturum"
      // sayıp askıya alıyor. Duyulmayacak kadar kısık ama sıfır değil.
      sesTutucu.volume = 0.02;
    }
    if (!uyariCalar) {
      uyariCalar = new Audio(wavVer(1.1, [
        { hzTon: 880, bas: 0.00, sure: 0.16 },
        { hzTon: 660, bas: 0.22, sure: 0.16 },
        { hzTon: 880, bas: 0.44, sure: 0.16 },
        { hzTon: 660, bas: 0.66, sure: 0.30 }
      ]));
      uyariCalar.setAttribute('playsinline', '');
      uyariCalar.volume = 1;
    }
    await sesTutucu.play();
    return !sesTutucu.paused;
  } catch {
    return false;
  }
}

export function sesDuzenegiKapat() {
  try { sesTutucu?.pause(); } catch { /* zaten durmuş */ }
}

function uyariSesi() {
  try {
    if (!uyariCalar) return;
    uyariCalar.currentTime = 0;
    uyariCalar.play().catch(() => {});
    // Sessiz döngü bir şekilde kesildiyse geri başlat: bir sonraki durakta
    // oturum yine ayakta olsun.
    if (sesTutucu?.paused) sesTutucu.play().catch(() => {});
  } catch { /* ses açılamazsa uyarı ekranda yine çıkıyor */ }
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
    kayitBildir(sesVar
      ? 'Yol Modu açık. Telefonu şarjda tut. Sesi açık bırak — uyarı sesle gelecek.'
      : 'Yol Modu açık ama ses açılamadı: uyarı yalnızca ekranda çıkar.', sesVar ? 'iyi' : 'orta');
  } else {
    durum.uyanikKilit?.release();
    durum.uyanikKilit = null;
    sesDuzenegiKapat();
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

// Hangi panelin açık olduğu. Aynı anda bir tanesi — ayarlar ekranı on bir
// kartlık bir duvar olduğunda aranan şey bulunamıyordu.
let acikPanel = null;

// Panel kabuğu. Başlık bir düğme: dokununca açılıp kapanıyor, ok dönüyor.
// `uyari` doğruysa başlığın yanına bir yıldız düşüyor — panel kapalıyken bile
// içeride bekleyen bir şey olduğu görünsün diye.
function panelKur({ ad, uyari = false, ic, not = '' }) {
  const acik = acikPanel === ad;
  return `<div class="panel${acik ? ' acik' : ''}">
    <button class="panel-baslik katlanir" data-panel="${kacis(ad)}">
      <span>${kacis(ad)}</span>${uyari ? '<span class="panel-yildiz">*</span>' : ''}
      <span class="panel-ok">▼</span>
    </button>
    <div class="panel-ic"${acik ? '' : ' hidden'}>
      ${ic}
      ${not ? `<div class="panel-not">${not}</div>` : ''}
    </div>
  </div>`;
}

async function paneliCiz() {
  const s = gerok.aktifGerok();
  const depo = await veri.depolamaDurumu();
  const sahip = kayit.sahipAl();
  const km = iz.izUzunlugu(durum.izNoktalari);

  const sayi = (turler) => durum.kayitlar.filter(k => turler.includes(k.tur)).length;
  const yaziSayi = sayi(['yazi', 'isaret', 'sinir']);
  const sesSayi = sayi(['ses', 'ortam', 'gunluk', 'baslangic', 'bitis', 'mektup']);
  const gorselSayi = sayi(['foto', 'video', 'siradan']);
  const kisiSayi = sayi(['kisi']);

  const ozelVarMi = {
    baslangic: durum.kayitlar.some(k => k.tur === 'baslangic'),
    bitis: durum.kayitlar.some(k => k.tur === 'bitis'),
    mektup: durum.kayitlar.some(k => k.tur === 'mektup')
  };
  // Yazılmış mektupların yılları. Birden fazla olabilir — bir mektup on yıl
  // sonrasına, bir başkası gelecek yıla yazılabiliyor.
  const mektupYillari = [...new Set(durum.kayitlar
    .filter(k => k.tur === 'mektup' && k.hedefYil)
    .map(k => k.hedefYil))].sort();

  const { hepsi: harcamalar, paralar } = harcamalariTopla();
  const harcamaEuro = euroToplami(harcamalar);

  // Bugün sesli günlük bırakılmış mı? Bırakılmamışsa ve akşam olmuşsa
  // Gün Sonu düğmesi nabız gibi atıyor — hatırlatan tek şey bu.
  const bugun = new Date(); bugun.setHours(0, 0, 0, 0);
  const bugunGunluk = durum.kayitlar.some(k =>
    k.tur === 'gunluk' && k.t >= bugun.getTime());
  const gunSonuGerek = new Date().getHours() >= 19 && !bugunGunluk;

  const yedek = await sonYedekZamani();
  const yedekEski = !yedek || (Date.now() - yedek) > 24 * 60 * 60 * 1000;
  const azYer = depo?.kota && (depo.kota - depo.kullanilan) < AZ_YER_ESIGI;

  const yedekYazi = yedek
    ? gerok.tarihUzun(yedek) + ' ' + gerok.saat(yedek)
    : 'hiç alınmadı';

  // Bağlantı kuyruğu: internet bulununca tamamlanacak işler.
  const ag = await baglanti.agVarMi();
  const kuyruk = await baglanti.kuyrukDurumu();

  $('#gerokPanel').innerHTML = `
    <div class="panel">
      <div class="panel-baslik">bu gezi</div>
      ${s ? `
        <div class="panel-satir"><span class="etiket">Gerok</span><span class="deger">${kacis(s.ad)}</span></div>
        <div class="panel-satir"><span class="etiket">Kayıt</span>
          <span class="deger sayi-izgara">
            <span title="yazı, işaret, sınır">${yaziSayi}</span>
            <span title="ses kayıtları">${sesSayi}</span>
            <span title="fotoğraf ve video">${gorselSayi}</span>
            <span title="tanıştığınız kişiler">${kisiSayi}</span>
          </span></div>
        <div class="panel-satir"><span class="etiket">Yol</span>
          <span class="deger">${km.toFixed(1)} km · ${durum.izNoktalari.length} nokta</span></div>
        <div class="panel-satir harcama-ust"><span class="etiket">Harcama</span>
          <span class="deger">
            <span>${harcamaEuro ? euroYaz(harcamaEuro) : (harcamalar.length ? tutarYaz(paralar) : '—')}</span>
            <button class="satir-dugme" id="btnHarcamaListe">Döküm</button>
          </span></div>
        <div class="panel-not kucuk">${harcamaEuro
          ? `${harcamaEuro.sayi} harcama, her biri kendi günündeki kurla euroya çevrildi.` +
            (harcamaEuro.eksik ? ` ${harcamaEuro.eksik} tanesi henüz çevrilmedi.` : '') +
            `<br>Para birimlerine göre: ${tutarYaz(paralar)}`
          : 'Para birimleri ayrı toplanıyor. Tek toplam için Bağlantı → ' +
            '“Harcamaların kurunu düzelt”.'}</div>
      ` : '<div class="panel-not">Gerok paketi yüklenmedi.</div>'}
      <button class="eylem-dugme birincil${gunSonuGerek ? ' nabiz' : ''}" id="btnGunSonu">Gün Sonu'nu başlat</button>
      ${gunSonuGerek ? '<div class="panel-uyari-yazi">Bugün henüz sesli günlük yok</div>' : ''}
    </div>

    ${panelKur({
      ad: 'bağlantı',
      uyari: kuyruk.bekleyenToplam > 0,
      ic: `
        <div class="net-durum">
          <span class="net-led${ag ? ' acik' : ''}"></span>
          <span class="net-yazi">${ag
            ? `bağlı · ${kacis(baglanti.KIPLER[kuyruk.kip]?.ad || kuyruk.kip)}`
            : 'internet yok'}</span>
          <span class="net-kipler">
            ${Object.entries(baglanti.KIPLER).map(([id, o]) =>
              `<button class="kucuk-dugme${kuyruk.kip === id ? ' secili' : ''}" data-veri-kipi="${id}">${o.ad}</button>`).join('')}
          </span>
        </div>

        ${kuyruk.bekleyenToplam
          ? `<div class="net-oneri${ag ? ' acik' : ''}">${ag
              ? `${kuyruk.bekleyenToplam} şey bekliyor — şimdi hallolabilir.`
              : `${kuyruk.bekleyenToplam} şey internet bekliyor. Otelde wi-fi bulunca tek dokunuşla hallolur; o zamana kadar her şey çevrimdışı çalışmaya devam eder.`}</div>`
          : '<div class="net-oneri">Bekleyen bir şey yok.</div>'}

        <div class="is-liste">
          ${kuyruk.satirlar.map(i => `
            <button class="is-satir${i.sayi ? '' : ' bitti'}" data-is="${i.k}">
              <span class="is-sol">
                <span class="is-ad">${kacis(i.ad)}</span>
                <span class="is-not">${kacis(i.not)}${i.sayi ? ` · ${i.sayi} tane` : ''}</span>
              </span>
              <span class="is-durum${i.engelli ? ' engelli' : (i.sayi ? (ag ? ' hazir' : '') : ' bitti')}">
                ${!i.sayi ? 'bitti' : i.engelli ? 'wi-fi bekler' : ag ? 'hallet' : 'bekliyor'}
              </span>
            </button>`).join('')}
        </div>

        <button class="eylem-dugme${ag && kuyruk.bekleyenToplam ? ' birincil' : ''}" id="btnHepsiniHallet"
          ${kuyruk.bekleyenToplam ? '' : 'disabled'}>
          ${ag ? 'Hepsini şimdi hallet' : 'İnternet bulununca hallolacak'}
        </button>
        <div id="netIlerleme" class="panel-not"></div>`,
      not: 'Gerok internetsiz tam çalışır. Bağlantı yalnızca yukarıdaki işleri ' +
           'düzeltmek için kullanılır. Dışarı giden tek şey: para birimi kodları, ' +
           'kayıtların ve durakların koordinatları. Metin, ses, fotoğraf, isim — ' +
           'hiçbiri gitmiyor, hiçbir kaydın buluta yüklenmiyor.'
    })}

    ${panelKur({
      ad: 'eşitleme',
      uyari: yedekEski,
      ic: `
        <div class="panel-satir"><span class="etiket">Son yedek</span>
          <span class="deger">${kacis(yedekYazi)}</span></div>
        <button class="eylem-dugme" id="btnGonder">Günümü gönder (AirDrop)</button>
        <button class="eylem-dugme" id="btnAl">Gelen paketi al</button>
        <button class="eylem-dugme" id="btnYedek">Yedek al (Dosyalar'a)</button>
        <button class="eylem-dugme" id="btnYedekSina">Yedeği sına</button>`,
      not: 'İki telefon arası dosya alışverişi ve yedek. Sunucu yok, hesap yok — ' +
           'AirDrop iki telefon arasında doğrudan çalışır, internet gerekmez.'
    })}

    ${panelKur({
      ad: 'bu telefon',
      uyari: azYer,
      ic: `
        <div class="girdi-etiket">Aydınlık</div>
        <div class="secenekler" id="temaSecenek">
          ${TEMALAR.map(t => `<button class="kucuk-dugme" data-tema="${t.id}">${t.ad}</button>`).join('')}
        </div>

        <div class="girdi-etiket">Renk</div>
        <div class="secenekler" id="semaSecenek">
          ${SEMA_SECENEKLERI.map(o => `<button class="kucuk-dugme" data-sema="${kacis(o.id)}">${kacis(o.ad)}</button>`).join('')}
        </div>
        <div class="panel-not kucuk">Kâğıdın rengi değişmiyor; değişen tek şey
        üzerine basılabilecek şeylerin rengi. Bugünkü renk:
        <b>${kacis(cozulmusSema(semaSecimi(), geziGunuNo()))}</b>.</div>

        <div class="panel-satir"><span class="etiket">Bu telefon</span>
          <span class="deger">${kacis(sahip.ad || '—')}</span></div>
        <button class="eylem-dugme" id="btnAd">Adımı değiştir</button>

        <div class="panel-satir" style="margin-top:14px"><span class="etiket">İndirilmiş harita</span>
          <span class="deger" id="haritaDurum">bakılıyor…</span></div>
        ${depo ? `
          <div class="panel-satir"><span class="etiket">Telefonda kullanılan</span>
            <span class="deger">${boyutYaz(depo.kullanilan)}</span></div>
          <div class="panel-satir"><span class="etiket">Boş yer</span>
            <span class="deger">${depo.kota ? boyutYaz(depo.kota - depo.kullanilan) : '—'}${azYer ? ' · az' : ''}</span></div>
          <div class="panel-satir"><span class="etiket">Veri kalıcı korunuyor</span>
            <span class="deger">${depo.kalici ? 'evet' : 'hayır'}</span></div>
        ` : ''}
        <button class="eylem-dugme" id="btnHarita">Harita paketini indir</button>
        ${!depo?.kalici ? '<button class="eylem-dugme" id="btnKalici">Kalıcı depolama iste</button>' : ''}`,
      not: 'Görünüm, ad, indirilmiş harita ve yer.'
    })}

    ${panelKur({
      ad: 'gezi',
      ic: `
        <button class="eylem-dugme" id="btnBaslangic">Başlangıç kaydı${ozelVarMi.baslangic ? ' ✓' : ''}</button>
        <button class="eylem-dugme" id="btnGeziSonu">Gezi Sonu'nu başlat${ozelVarMi.bitis ? ' ✓' : ''}</button>
        <button class="eylem-dugme" id="btnMektup">Mühürlü mektup yaz${ozelVarMi.mektup ? ' ✓' : ''}
          ${mektupYillari.length ? `<span class="yol-alt">yazılmış: ${mektupYillari.join(', ')}</span>` : ''}
        </button>

        <div class="panel-satir" style="margin-top:14px"><span class="etiket">Şu anki gezi</span>
          <span class="deger">${s ? kacis(s.ad) : 'yok'}</span></div>
        <button class="eylem-dugme" id="btnTurlar">Bütün geziler</button>
        <button class="eylem-dugme" id="btnYeniTur">Yeni gezi başlat</button>
        <button class="eylem-dugme" id="btnPaket">Gezi paketi yükle</button>`,
      not: 'Gezinin başı ve sonu, bütün geziler, program dosyası. ' +
           'Paket zorunlu değil — gezi elle de başlatılabiliyor.'
    })}

    ${panelKur({
      ad: 'sürüm ve yardım',
      ic: `
        <div class="panel-satir"><span class="etiket">Telefondaki sürüm</span>
          <span class="deger" id="surumYazi">bakılıyor…</span></div>
        <button class="eylem-dugme" id="btnSurum">Yeni sürüm var mı?</button>
        <button class="eylem-dugme" id="btnSinama">Telefonu sına</button>
        <button class="eylem-dugme" id="btnKurulum">Nasıl kullanılır</button>
        <button class="eylem-dugme" id="btnTamir">Bir şey ters giderse</button>`,
      not: 'Sürüm bilgisi, sınama ve tamir kılavuzu. Üçü de telefonun içinden ' +
           'çalışır; yalnızca sürüm sorgusu internet ister.'
    })}
  `;

  // Panel başlıkları: dokununca aç/kapa, aynı anda bir tanesi açık.
  $$('#gerokPanel [data-panel]').forEach(d => {
    d.addEventListener('click', () => {
      acikPanel = acikPanel === d.dataset.panel ? null : d.dataset.panel;
      paneliCiz();
    });
  });

  surumuYaz();

  $('#btnHarcamaListe')?.addEventListener('click', harcamaDokumuAc);
  $('#btnHarcamaEkle')?.addEventListener('click', fiyatSor);
  temaSecenekleriniKur();
  semaSecenekleriniKur();
  baglantiPaneliniKur(ag, kuyruk);

  $('#btnGunSonu').addEventListener('click', () => gunSonuAc(durum, tazele));
  $('#btnGonder').addEventListener('click', () => paketGonder(kayitBildir));
  $('#btnAl').addEventListener('click', () => paketAl(kayitBildir, tazele));
  $('#btnYedek').addEventListener('click', () => yedekAl(kayitBildir));
  $('#btnYedekSina').addEventListener('click', yedegiSina);
  $('#btnAd').addEventListener('click', adSor);
  $('#btnBaslangic').addEventListener('click', () => baslangicKaydiAc(tazele));
  $('#btnGeziSonu').addEventListener('click', () => geziSonuAc(durum, tazele));
  $('#btnMektup').addEventListener('click', () => mektupAc(tazele));
  $('#btnPaket').addEventListener('click', () => $('#dosyaSecici').click());
  $('#btnTurlar').addEventListener('click', turlariYonet);
  $('#btnYeniTur').addEventListener('click', () => yeniTurSor());
  $('#btnHarita').addEventListener('click', haritaIndirmeSor);
  $('#btnSurum').addEventListener('click', surumuAra);
  // Sınama ve kurulum kartı ana ekrandan kurulu uygulamada adres çubuğu
  // olmadığı için başka türlü açılamıyordu — teknik olmayan biri oraya
  // hiç ulaşamazdı. İkisi de çevrimdışı önbellekte, yolda da açılır.
  $('#btnSinama').addEventListener('click', () => window.open('./sinama.html', '_blank'));
  $('#btnKurulum').addEventListener('click', () => window.open('./kurulum.html', '_blank'));
  $('#btnTamir').addEventListener('click', () => window.open('./tamir.html', '_blank'));
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
    // Ad sorulurken örtü doluydu; yarım kayıt penceresi ancak şimdi çıkabilir.
    await yarimKayitSor();
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
    hem "kahve 120 dinardı" on yıl sonra bir sayfa yazıdan iyi anlatır.</div>
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

// ------------------------------------------------------------- bağlantı --
//
// Kural: hiçbir iş kendiliğinden çalışmıyor. İnternet bulununca uygulama
// sessizce bir şeyler indirmeye başlamıyor — ne yapılacağı yazıyor, dokunan
// sen oluyorsun. "Buluta gitmiyor" sözünün karşılığı bu.

function baglantiPaneliniKur(ag, kuyruk) {
  // Wi-fi / mobil veri seçimi. iPhone bunu uygulamaya söylemiyor, o yüzden
  // tahmin etmiyoruz — sen söylüyorsun, uygulama hatırlıyor.
  $$('#gerokPanel [data-veri-kipi]').forEach(d => {
    d.addEventListener('click', async () => {
      const kip = d.dataset.veriKipi;
      if (kip === 'mobil' && kuyruk.kip !== 'mobil') { mobilVeriSor(); return; }
      await baglanti.veriKipiYaz(kip);
      kayitBildir(kip === 'wifi'
        ? 'Wi-fi kipi: büyük indirmeler de yapılabilir.'
        : 'Mobil veri kipi: yalnızca küçük işler.', 'iyi');
      paneliCiz();
    });
  });

  $$('#gerokPanel [data-is]').forEach(d => {
    d.addEventListener('click', () => isCalistir(d.dataset.is, ag, kuyruk));
  });

  $('#btnHepsiniHallet')?.addEventListener('click', async () => {
    if (!ag) {
      kayitBildir('İnternet yok — bağlanınca bu düğme çalışacak.', 'kotu');
      return;
    }
    for (const i of kuyruk.satirlar) {
      if (!i.sayi || i.engelli) continue;
      await isCalistir(i.k, ag, kuyruk, { sessiz: true });
    }
    kayitBildir('Bekleyen işler bitti.', 'iyi');
    paneliCiz();
  });
}

async function isCalistir(anahtar, ag, kuyruk, { sessiz = false } = {}) {
  const is = kuyruk.satirlar.find(x => x.k === anahtar);
  if (!is) return;

  if (!is.sayi) { if (!sessiz) kayitBildir(`${is.ad} · bekleyen bir şey yok.`); return; }
  if (!ag) {
    if (!sessiz) kayitBildir('İnternet yok · bağlanınca hallolur.', 'kotu');
    return;
  }
  if (is.engelli) {
    if (!sessiz) kayitBildir('Bu iş yüzlerce megabayt — mobil veride indirilmiyor, wi-fi bekliyor.', 'kotu');
    return;
  }

  // Harita kendi akışını açıyor: indirme uzun sürüyor ve kendi ilerleme
  // çubuğu var, kuyruğun içine sıkıştırmak doğru olmazdı.
  if (anahtar === 'harita') { haritaIndirmeSor(); return; }

  const yaz = (m) => { const e = $('#netIlerleme'); if (e) e.textContent = m; kayitBildir(m); };
  yaz(`${is.ad}…`);

  try {
    const sonuc = await is.calistir((y, t) => yaz(`${is.ad}… ${y}/${t}`));
    kayitBildir(sonuc.mesaj, sonuc.yapilan ? 'iyi' : '');
    await tazele();
    if (!sessiz) paneliCiz();
  } catch (hata) {
    kayitBildir(`${is.ad} olmadı: ${hata.message}`, 'kotu');
  }
}

// Mobil veri onayı. Tasarımın kararı: büyük indirmeler için ayrıca izin
// istenir, çünkü sürpriz fatura gezinin en gereksiz sürprizi olur.
function mobilVeriSor() {
  ortuAc(`
    <div class="gs-sayac">mobil veri</div>
    <div class="ortu-baslik">Mobil veri kullanılsın mı?</div>
    <div class="ortu-alt">Gerok kendi başına veri harcamaz — hiçbir kayıt buluta
    gitmiyor. İzin verirsen yalnızca bekleyen şu işler için kullanır.</div>
    <div class="gs-liste">
      <div class="gs-liste-satir"><div class="gs-liste-ad">Kurlar, yer adları, durak bilgisi</div>
        <div class="gs-liste-alt">birkaç yüz kilobayt</div></div>
      <div class="gs-liste-satir"><div class="gs-liste-ad">Harita paketi</div>
        <div class="gs-liste-alt">yüzlerce megabayt — mobil veride indirilmez</div></div>
    </div>
    <button class="eylem-dugme birincil" id="mobilKucuk">Yalnızca küçük işler</button>
    <button class="eylem-dugme" id="mobilVazgec">Wi-fi bekle</button>
  `);
  $('#mobilKucuk').addEventListener('click', async () => {
    ortuKapat();
    await baglanti.veriKipiYaz('mobil');
    kayitBildir('Mobil veri: yalnızca küçük işler. Harita wi-fi bekliyor.', 'iyi');
    paneliCiz();
  });
  $('#mobilVazgec').addEventListener('click', ortuKapat);
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
      // Tema değişti: vurgu rengi de o temanın karşılığına dönmeli.
      semayiTazele();
      isaretle();
      paneliCiz();
    });
  });
  isaretle();
}

function semaSecenekleriniKur() {
  const isaretle = () => {
    const s = semaSecimi();
    $$('#semaSecenek [data-sema]').forEach(d => d.classList.toggle('secili', d.dataset.sema === s));
  };
  $$('#semaSecenek [data-sema]').forEach(d => {
    d.addEventListener('click', () => {
      semaSec(d.dataset.sema, geziGunuNo());
      isaretle();
      paneliCiz();
    });
  });
  isaretle();
}

// ------------------------------------------------------------ yedeği sına --
//
// Yedek almanın sessiz tehlikesi: dosya oluşuyor, boyutu makul görünüyor,
// ama içi bozuk. Bu ancak geri yüklemeye çalıştığın gün — yani her şeyin
// kaybolduğu gün — anlaşılıyor. Bu düğme o günü öne çekiyor.
async function yedegiSina() {
  kayitBildir('Yedek sınanıyor…');
  try {
    const r = await yedekSina((y, t) => {
      if (t > 3) kayitBildir(`Yedek sınanıyor… ${y}/${t}`);
    });
    if (r.saglam) {
      kayitBildir(`Yedek okunabilir ✓ · ${boyutYaz(r.boyut)} · ` +
        `${r.kayitSayi} kayıt, ${r.medyaSayi} ses/görsel, ${r.izSayi} iz noktası.`, 'iyi');
    } else {
      kayitBildir(`Dikkat: ${r.eksik} kaydın ses/görsel dosyası yedeğe girmedi. ` +
        'Yer açıp tekrar dene; olmuyorsa tamir kılavuzuna bak.', 'kotu');
    }
  } catch (hata) {
    kayitBildir(`Yedek sınanamadı: ${hata.message}`, 'kotu');
  }
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

// Kuru yazilmis harcamalarin euro toplami. Kur internetten geldiginde
// (bkz. js/baglanti.js) her kaydin icine `euro` alani yaziliyor; burada
// yalnizca toplaniyor. Hicbiri cevrilmemisse null donuyor.
function euroToplami(hepsi) {
  const cevrilen = hepsi.filter(k => typeof k.euro === 'number' && Number.isFinite(k.euro));
  if (!cevrilen.length) return null;
  return {
    toplam: cevrilen.reduce((t, k) => t + k.euro, 0),
    sayi: cevrilen.length,
    eksik: hepsi.length - cevrilen.length
  };
}

function euroYaz(e) {
  return e.toplam.toLocaleString('tr-TR', { maximumFractionDigits: 0 }) + ' \u20ac';
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
  const euro = euroToplami(hepsi);
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
    <div class="ortu-alt">${euro
      ? `Toplam: <b>${euroYaz(euro)}</b> · ${tutarYaz(paralar)}<br>
         Her harcama kendi günündeki gerçek kurla çevrildi${euro.eksik ? `, ${euro.eksik} tanesi hariç` : ''}.`
      : `Toplam: <b>${tutarYaz(paralar)}</b><br>
         Para birimleri ayrı toplanıyor — tek toplam için Bağlantı → “Harcamaların kurunu düzelt”.`}</div>

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
          <div class="harcama-tutar">${kacis(k.tutar || '—')} ${kacis(k.paraBirimi || '')}${
            typeof k.euro === 'number'
              ? `<span class="harcama-euro">${k.euro.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} \u20ac</span>`
              : ''}</div>
        </div>`).join('')}
    </div>
    <button class="eylem-dugme" id="harcamaKapat">Kapat</button>
  `);
  $('#harcamaKapat').addEventListener('click', ortuKapat);
}

// ------------------------------------------------------------------ turlar --
//
// Bir gezi bitince arşivlenir, yenisi başlar. Kayıtlar silinmiyor: her kayıt
// kendi `gerokId`sini taşıyor, ekranlar yalnızca o anki turunkini gösteriyor.
// Arşivdeki bir tura geri dönmek tek dokunuş.

async function turOzetleri() {
  const hepsi = await gerok.turlar();
  const idler = hepsi.map(t => t.id);
  const ozetler = [];
  for (const t of hepsi) {
    const kayitlar = await veri.kayitlariGetir(t.id);
    ozetler.push({ tur: t, kayitSayisi: kayitlar.length });
  }
  const oksuz = await veri.oksuzKayitlar(idler);
  return { ozetler, oksuz };
}

function turTarihi(t) {
  const bas = new Date(t.baslangic).getTime();
  const bit = new Date(t.bitis).getTime();
  if (!Number.isFinite(bas)) return '';
  const g = Math.max(1, Math.round((bit - bas) / 86400_000));
  return `${new Date(bas).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })} · ${g} gün`;
}

async function turlariYonet() {
  ortuAc('<div class="ortu-baslik">Turlar</div><div class="ortu-alt">yükleniyor…</div>');
  const { ozetler, oksuz } = await turOzetleri();
  const aktifId = gerok.aktifGerok()?.id ?? null;

  const kart = ({ tur, kayitSayisi }) => `
    <div class="tur-kart ${tur.id === aktifId ? 'aktif' : ''} ${tur.arsiv ? 'arsiv' : ''}">
      <div class="tur-ust">
        <div class="tur-ad">${kacis(tur.ad)}</div>
        <div class="tur-rozet">${tur.id === aktifId ? 'şu anki' : tur.arsiv ? 'arşiv' : ''}</div>
      </div>
      <div class="tur-alt">${kacis(turTarihi(tur))} · ${kayitSayisi} kayıt${tur.kendiKurulmus ? '' : ' · paketten'}</div>
      <div class="durak-dugmeler">
        ${tur.id === aktifId
          ? `<button class="kucuk-dugme" data-arsivle="${tur.id}">Arşivle</button>`
          : `<button class="kucuk-dugme secili" data-gec="${tur.id}">Bu tura geç</button>
             <button class="kucuk-dugme sil" data-tursil="${tur.id}">Sil</button>`}
      </div>
    </div>`;

  ortuAc(`
    <div class="ortu-baslik">Turlar</div>
    <div class="ortu-alt">Şu anki turun kayıtları ekranlarda görünür. Arşivdekiler
    telefonda durur, karışmaz; istediğin an geri dönebilirsin.</div>
    ${ozetler.map(kart).join('')}
    ${oksuz.length ? `
      <div class="panel-not" style="margin-top:14px">
        <b>${oksuz.length} kayıt hiçbir tura bağlı değil.</b> Eski bir turdan kalmış
        olabilir. Şu anki tura taşıyabilirsin.</div>
      <button class="eylem-dugme" id="oksuzTasi">${oksuz.length} kaydı bu tura taşı</button>` : ''}
    <button class="eylem-dugme birincil" id="turYeni">Yeni tur başlat</button>
    <button class="eylem-dugme" id="turKapat">Kapat</button>
  `);

  $('#turKapat').addEventListener('click', ortuKapat);
  $('#turYeni').addEventListener('click', () => yeniTurSor());

  $('#oksuzTasi')?.addEventListener('click', async () => {
    if (!aktifId) { kayitBildir('Önce bir tur başlat.', 'kotu'); return; }
    ortuKapat();
    const n = await veri.kayitlariTuraTasi(oksuz, aktifId);
    kayitBildir(`${n} kayıt bu tura taşındı.`, 'iyi');
    await tazele();
  });

  $$('[data-gec]').forEach(d => d.addEventListener('click', async () => {
    ortuKapat();
    await gerok.turSec(d.dataset.gec);
    await turDegisti();
  }));

  $$('[data-arsivle]').forEach(d => d.addEventListener('click', () => turArsivleSor(d.dataset.arsivle)));
  $$('[data-tursil]').forEach(d => d.addEventListener('click', () => turSilSor(d.dataset.tursil)));
}

// Tur değişince her şey yeniden kuruluyor: iz artık yeni tura yazılmalı,
// harita eski turun rotasını göstermeye devam etmemeli.
async function turDegisti() {
  const yeni = gerok.aktifGerok();
  iz.gerokAyarla(yeni?.id ?? null);
  gosterilenSayi = SAYFA_ADIMI;
  durum.uyarilmisDuraklar = new Set();
  await veri.ayarYaz('uyarilmisDuraklar', []);
  await tazele();
  if (durum.ekran === 'harita') haritaGuncelle(durum.kayitlar, durum.izNoktalari);
  kayitBildir(yeni ? `"${yeni.ad}" turundasın.` : 'Aktif tur yok.', 'iyi');
}

function turArsivleSor(id) {
  ortuAc(`
    <div class="ortu-baslik">Tur arşivlensin mi?</div>
    <div class="ortu-alt">Kayıtların, sesli notların, fotoğrafların ve izin
    <b>silinmez</b> — telefonda durur. Sadece ekranlardan çekilir, yeni turla
    karışmaz. İstediğin an geri dönebilirsin.</div>
    <div class="panel-not">Yine de önce yedek almak en doğrusu: yedek dosyası
    telefondan bağımsız durur.</div>
    <button class="eylem-dugme" id="arsivYedek">Önce yedek al</button>
    <button class="eylem-dugme birincil" id="arsivOnay">Arşivle</button>
    <button class="eylem-dugme" id="arsivVaz">Vazgeç</button>
  `);
  $('#arsivVaz').addEventListener('click', ortuKapat);
  $('#arsivYedek').addEventListener('click', () => yedekAl(kayitBildir));
  $('#arsivOnay').addEventListener('click', async () => {
    ortuKapat();
    await gerok.turArsivle(id, true);
    await turDegisti();
  });
}

function turSilSor(id) {
  ortuAc(`
    <div class="ortu-baslik">Bu tur tamamen silinsin mi?</div>
    <div class="ortu-alt">Turun <b>bütün kayıtları, sesli notları, fotoğraf
    önizlemeleri ve izi</b> telefondan gider. <b>Geri alınamaz.</b><br><br>
    Yalnızca yer açmak istiyorsan <b>arşivle</b> yeter — o hiçbir şeyi silmiyor.</div>
    <button class="eylem-dugme" id="silYedek">Önce yedek al</button>
    <button class="eylem-dugme" id="silOnayla">Anladım, sil</button>
    <button class="eylem-dugme birincil" id="silVazgec2">Vazgeç</button>
  `);
  $('#silVazgec2').addEventListener('click', ortuKapat);
  $('#silYedek').addEventListener('click', () => yedekAl(kayitBildir));
  $('#silOnayla').addEventListener('click', async () => {
    ortuKapat();
    const s = await gerok.turSil(id);
    kayitBildir(`Tur silindi · ${s.silinenKayit} kayıt, ${s.silinenIz} iz noktası.`, 'kotu');
    await turDegisti();
  });
}

function yeniTurSor() {
  const bugun = new Date();
  const tarihYaz = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const aktifVar = !!gerok.aktifGerok();

  ortuAc(`
    <div class="ortu-baslik">Yeni tur</div>
    <div class="ortu-alt">Boş bir defter açılır. Duraklarını haritadan kendin
    koyarsın; hazır bir rota dosyan varsa onu da yükleyebilirsin.</div>

    <div class="girdi-etiket">Turun adı</div>
    <input class="girdi" id="turAd" placeholder="Karadeniz turu, Ege 2027…">

    <div class="girdi-etiket">Ne zaman başlıyor?</div>
    <input class="girdi" id="turBas" type="date" value="${tarihYaz(bugun)}">

    <div class="girdi-etiket">Kaç gün sürecek?</div>
    <div class="secenekler" id="turGun">
      ${[3, 5, 7, 10, 14, 21, 30].map(g =>
        `<button class="kucuk-dugme ${g === 7 ? 'secili' : ''}" data-gun="${g}">${g} gün</button>`).join('')}
    </div>
    <div class="panel-not">Gün sayısını sonra değiştiremezsin ama sorun değil —
    süre bitse de kayıt almaya devam edebilirsin, "Gerok dışı" olarak yazılır.</div>

    ${aktifVar ? `<div class="panel-not"><b>"${kacis(gerok.aktifGerok().ad)}"</b> arşive
      kaldırılacak. Kayıtları silinmiyor, istediğin an geri dönersin.</div>` : ''}

    <button class="eylem-dugme birincil" id="turKur">Turu başlat</button>
    <button class="eylem-dugme" id="turVaz">Vazgeç</button>
  `);

  setTimeout(() => $('#turAd').focus(), 120);
  $$('#turGun [data-gun]').forEach(b => b.addEventListener('click', () => {
    $$('#turGun [data-gun]').forEach(x => x.classList.remove('secili'));
    b.classList.add('secili');
  }));
  $('#turVaz').addEventListener('click', ortuKapat);

  $('#turKur').addEventListener('click', async () => {
    const ad = $('#turAd').value.trim();
    if (!ad) { $('#turAd').focus(); return; }
    const tarih = $('#turBas').value;
    const gunSayisi = +($('#turGun .secili')?.dataset.gun || 7);
    ortuKapat();

    // Saat 00:00 değil, o günün sabahı: gün penceresi gece yarısında
    // dönmesin — geceyarısından sonraki kayıt hâlâ o güne yazılsın.
    const bas = tarih ? new Date(`${tarih}T06:00:00`).getTime() : Date.now();

    const eski = gerok.aktifGerok();
    if (eski) await gerok.turArsivle(eski.id, true);
    await gerok.turBaslat({ ad, baslangic: bas, gunSayisi });
    await turDegisti();
  });
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
    iz.gerokAyarla(s.id);
    gosterilenSayi = SAYFA_ADIMI;
    kayitBildir(`"${s.ad}" yüklendi · ${s.gunler.length} gün, ${s.duraklar.length} durak`, 'iyi');
    await tazele();
    if (durum.ekran === 'harita') haritaGuncelle(durum.kayitlar, durum.izNoktalari);
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

// Geri alınabilir bildirim: mesajın yanında beş saniye duran bir "Geri al".
//
// Silme bu yüzden anında değil. İki kural: silmek gürültülü olsun, veri
// sessizce kaybolmasın. Beş saniye, "eyvah" demeye yetiyor.
export const GERI_AL_SURESI = 5000;

export function geriAlinabilirBildir(mesaj, geriAl) {
  const t = $('#bildirim');
  if (!t) { geriAl?.(); return; }

  t.innerHTML = `<span class="bildirim-yazi"></span>
    <button class="bildirim-geri">Geri al</button>`;
  t.querySelector('.bildirim-yazi').textContent = mesaj;
  t.className = 'bildirim geri-alinabilir';
  clearTimeout(t._sayac);

  const kapat = () => {
    t.classList.add('gizli');
    t.innerHTML = '';
    t.className = 'bildirim gizli';
  };
  t.querySelector('.bildirim-geri').addEventListener('click', () => {
    clearTimeout(t._sayac);
    kapat();
    geriAl?.();
  });
  t._sayac = setTimeout(kapat, GERI_AL_SURESI - 200);
}

// ---- Çalma şeridi ---------------------------------------------------------
//
// Bir sesi dinlerken başka sekmeye geçince ses devam ediyor ama durdurmanın
// yolu kalmıyordu — kaydın kartı görünmüyor. Şerit her ekranda duruyor.

function calmaSeridiYaz(gecen, toplam) {
  const serit = $('#calmaSerit');
  if (!serit) return;
  if (!calan) { serit.classList.add('gizli'); return; }

  serit.classList.remove('gizli');
  const k = durum.kayitlar.find(x => x.medyaId === calan.medyaId);
  const ad = k
    ? `${veri.TURLER[k.tur] || k.tur} · ${gerok.saat(k.t)}${k.metin ? ` · ${k.metin.slice(0, 40)}` : ''}`
    : 'ses kaydı';
  $('#calmaAd').textContent = ad;
  $('#calmaSure').textContent = sureYaz(gecen);
  $('#calmaDolgu').style.width =
    (toplam > 0 ? Math.min(100, (gecen / toplam) * 100) : 0).toFixed(1) + '%';
}

function calmaSeridiniKur() {
  $('#calmaDurdur').addEventListener('click', () => {
    calaniBirak();
    calmaSeridiYaz(0, 0);
  });
  $('#calmaGit').addEventListener('click', () => {
    ekranAc('zaman');
    // Çalan kaydın kartına kaydır: hangi kaydı dinlediğini görsün.
    const k = durum.kayitlar.find(x => x.medyaId === calan?.medyaId);
    const satir = k && $(`[data-kayit="${k.id}"]`);
    satir?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
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

// `ikonAdi` js/ikon.js'teki çizimlerden biri. Boş ekranlar uygulamanın en
// sessiz anları; oradaki çizim de sessiz olsun diye tek renk, ince çizgi.
function bosDurum(ikonAdi, yazi) {
  return `<div class="bos-durum"><div class="bos-ikon">${ikon(ikonAdi, 46)}</div>`
       + `<div class="bos-yazi">${yazi}</div></div>`;
}

// --------------------------------------------------------------- servis worker -

// Yeni sürüm telefona daha çabuk insin diye güncelleme açılışta ve uygulamaya
// her dönüşte elle soruluyor; iOS Safari kendi başına aramakta ağır davranıyor.
// Bilerek SAYFA KENDİLİĞİNDEN YENİLENMİYOR: yolda yeni sürüm çıkmayacak
// (bilgisayar evde), buna karşılık kendiliğinden yenileme sesli not kaydının
// tam ortasına denk gelse kaydı uçururdu. Yeni dosyalar bir sonraki açılışta
// zaten devreye giriyor. Yolda internet yoksa update() sessizce düşer.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').then((kayit) => {
    const sor = () => kayit.update().catch(() => {});
    sor();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') sor();
    });
  }).catch(e => console.warn('sw kaydı olmadı', e));
}

baslat();

export { tazele, durum };
