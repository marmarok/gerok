// Gerok — uygulama omurgası: açılış, ekran yönlendirme, arayüz.

// EKRANDA ÇALIŞAN sürüm. arac/surum-yaz.py her yayında bu satırı yeniden yazar.
//
// Neden önbelleğin adına bakmıyoruz: yeni sürüm indiğinde önbellek adı değişiyor
// ama ekrandaki kod hâlâ eski oluyor — uygulama kendini güncellenmiş sanıyordu.
// Bu satır ekrandaki dosyanın içinde olduğu için yalan söyleyemiyor.
const BU_SURUM = 'gerok-129-20260830-210145';

import * as veri from './veri.js';
import * as iz from './iz.js';
import * as gerok from './gerok.js';
import * as kayit from './kayit.js';
import { haritaKur, haritaGuncelle, haritaBoyutTazele, konumaGit, hepsiniGoster,
         kipDegistir, aktifKipAl, haritaMerkezi, durakTiklamasi,
         duragaUc, gorunenKutu, hareketDinle, hareketiBirak } from './harita.js';
import * as haritaAlan from './harita-alan.js';
import { gunSonuAc, geziSonuAc, baslangicKaydiAc, bitisKaydiAc, mektupAc } from './gunsonu.js';
import { paketGonder, paketAl, yedekAl, sonYedekZamani, yedekSina,
         yedegiDogrula, yedekDogrulamaDurumu,
  bulutaYukle, yedektenGeriYukle } from './esitleme.js';
import { temaBaslat, kagitSecimi, kagitSec, kagitSil, varsayilanKagit } from './tema.js';
import { semaSecimi, semaUygula, gununRenkleri,
  ozelVurgu, ozelVurguSec, ozelVurguSil } from './sema.js';
import * as baglanti from './baglanti.js';
import { sihirbaziAc } from './sihirbaz.js';
import * as yerAra from './yer-ara.js';
import { ikon, ikonlariYerlestir } from './ikon.js';
import * as bekci from './bekci.js';
import * as kutu from './kutu.js';
import * as rehber from './rehber.js';
import { ç, dilBaslat, dilSec, aktifDil, tarihYaz, DILLER } from './dil.js';

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
  sadeceIsaretli: false,
  acikSatir: null,          // uzun basılan kaydın kimliği
  acikKisiFotosu: null,     // büyütülmüş tanışma fotoğrafının kaydı
  sonParaBirimi: '',
  uyanikKilit: null,
  sonUlke: null,
  uyarilmisDuraklar: new Set(),
  sorulmusDuraklar: new Set()
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
  // Dil her şeyden önce: index.html'in içindeki sabit yazılar uygulama
  // kendi ekranlarını çizmeden çevrilmeli, yoksa bir an Türkçe çakıyor.
  dilBaslat();
  temaBaslat();
  await veri.ac();
  // Kara kutu erken açılıyor: açılışın KENDİSİNDE çıkan hata da yakalansın.
  await kutu.baslat(BU_SURUM);
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
  durum.sorulmusDuraklar = new Set(await veri.ayarOku('sorulmusDuraklar', []));
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
  agDegisiminiIzle();
  bekciyiKur();
  await paylasilanlariAl();
  // Hatayı bildirmek kimsenin aklına gelmez; sorulunca gelir. Gecikme,
  // açılışın önüne geçmemesi için.
  setTimeout(rehberiDusun, 1400);
  setTimeout(sorunSorHatirlat, 9000);
  // Açılışı yavaşlatmasın; haftada bir gerçekten gönderiyor, gerisi erken dönüyor.
  setTimeout(() => kutu.istatistikGonder(), 15000);
  // Kuyrukta bekleyen mesajlar: açılışta ve internet geri geldiğinde.
  // Yurtdışında yazılan bir mesaj, eve dönünce kendiliğinden gidiyor.
  setTimeout(() => kutu.kuyruguBosalt(), 6000);
  window.addEventListener('online', () => kutu.kuyruguBosalt());
}


/**
 * Bildirilmemiş hata varsa bir kez sor.
 *
 * İnsanlar hata bildirmez — ama sorulduğunda "evet" der. Sessiz kalan bir
 * hata kimseye ulaşmıyor; en çok can yakan hatalar da zaten sessiz olanlar.
 *
 * Rahatsız etmeme kuralı: günde bir kez, ve ekranda başka bir pencere
 * açıkken hiç. "Şimdi değil" denince o hatalar bir daha sorulmuyor.
 */
/**
 * Rehberi açmanın DOĞRU anını beklemek.
 *
 * İlk açılışta önce ad soruluyor, sonra yarım kalmış kayıtlar. Rehber
 * onların üstüne binmesin diye iki yerden çağrılıyor: açılışta bir kez,
 * bir de ad kaydedildikten sonra. Açık pencere varsa rehberin kendisi
 * zaten açılmıyor (bkz. rehber.gerekiyorsaAc), o yüzden burada ikinci
 * bir kontrol yok — kural tek yerde dursun.
 */
async function rehberiDusun() {
  await rehber.gerekiyorsaAc({ ekranAc });
}


async function sorunSorHatirlat() {
  // Rehber ekrandayken araya girmiyor: ilk açılışta iki pencere üst üste
  // binerse yeni kullanıcı ikisini de kapatıp gidiyor.
  if (document.querySelector('.rehber-kat')) return;
  if (!kutu.bildirilmeyenHatalar().length) return;
  if (document.querySelector('#ortu:not(.gizli)')) return;
  const bugun = new Date().toDateString();
  if (await veri.ayarOku('sorunSoruldu', null) === bugun) return;
  await veri.ayarYaz('sorunSoruldu', bugun);
  sorunBildir(true);
}

/**
 * İç bekçiyi uygulamaya bağlar.
 *
 * Bekçinin uygulamaya uzanan tek kolu bu nesne: hangi ekranı açabileceği,
 * neyi sınayabileceği, neyi onarabileceği burada yazılı. Bekçi app.js'in
 * içine dağılmış bir şey değil, dışarıdan bağlanan bir konuk — böylece ne
 * yapabildiği tek bakışta görülüyor ve sınırı belli oluyor.
 */
function bekciyiKur() {
  bekci.baglamKur({
    SURUM: BU_SURUM,
    durum, gerok, kayit, veri,
    ortuAc, ortuKapat,
    ekranAc: (a) => ekranAc(a),
    tazele,
    bildir: kayitBildir,
    rozetiTazele: bekciRozetiYaz,
    yedekAl: () => yedekAl(kayitBildir),
    haritaIndir: haritaAlaniSec,
    adSor,
    surumuAra,
    gunSonu: () => gunSonuAc(durum, tazele, yedekAlVeDogrula),
    mektup: () => mektupAc(tazele),
    paneliAc: (ad) => { acikPanel = ad; ekranAc('gerok'); paneliCiz(); },
    duraklar: () => gerok.duraklar(),
  });
  // Açılışta sessizce bakılıyor; internet yoksa son bilinen durum kullanılıyor.
  bekci.akisiTazele().then(bekciRozetiYaz);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) bekci.akisiTazele().then(bekciRozetiYaz);
  });
}

/**
 * Alt şeritteki Gerok sekmesine düşen rozet.
 *
 * Sessizlik varsayılan olduğu için bekçinin konuşmak istediğini gösteren tek
 * sessiz işaret bu: bildirim gibi araya girmiyor, ama görülmeden de kalmıyor.
 */
async function bekciRozetiYaz() {
  const sekme = $('#altBar .sekme[data-ekran="gerok"]');
  if (!sekme) return;
  sekme.querySelector('.sekme-rozet')?.remove();
  const r = await bekci.rozetDurumu();
  if (!r) return;
  const e = document.createElement('span');
  e.className = `sekme-rozet ${r.tip}`;
  e.textContent = r.sayi > 9 ? '9+' : String(r.sayi);
  sekme.appendChild(e);
  if (durum.ekran === 'gerok') paneliCiz();
}

/**
 * Başka bir uygulamadan "Paylaş" ile gelen medyayı zaman çizgisine ekler.
 *
 * Servis worker paylaşılan dosyaları geçici bir önbelleğe koyup uygulamayı
 * `?paylasim=N` ile açıyor (bkz. sw.js). Buradan sonrası galeriden fotoğraf
 * eklemekle aynı yol: çekim saati ve konumu okunuyor, küçültülmüş önizleme
 * yazılıyor, kayıt çekildiği ana yerleşiyor.
 *
 * iPhone'da bu yol HİÇ ÇALIŞMIYOR — Safari paylaş menüsüne web uygulaması
 * koymuyor. Android, masaüstü ve ileride yazılacak native uygulama için var.
 */
async function paylasilanlariAl() {
  const adres = new URL(location.href);
  const sayi = adres.searchParams.get('paylasim');
  if (!sayi) return;

  // Adres çubuğunu temizle: sayfa yenilenince aynı paylaşım ikinci kez
  // işlenmeye çalışılmasın.
  adres.searchParams.delete('paylasim');
  history.replaceState(null, '', adres.pathname + adres.search + adres.hash);

  if (sayi === 'hata' || !('caches' in window)) {
    kayitBildir(ç`Paylaşılan dosya okunamadı`, 'kotu');
    return;
  }

  const onbellek = await caches.open('gerok-paylasim');
  const anahtarlar = await onbellek.keys();
  const dosyalar = [];
  for (const a of anahtarlar) {
    const yanit = await onbellek.match(a);
    if (!yanit) continue;
    const blob = await yanit.blob();
    const ad = decodeURIComponent(yanit.headers.get('x-dosya-adi') || 'paylasim');
    const degisme = Number(yanit.headers.get('x-degisme')) || Date.now();
    dosyalar.push(new File([blob], ad, { type: blob.type, lastModified: degisme }));
  }
  // Önbellek her hâlükârda boşaltılıyor — yarıda kalsa bile artık dosya kalmasın.
  await Promise.all(anahtarlar.map(a => onbellek.delete(a)));

  if (dosyalar.length) await fotograflariAl(dosyalar);
}

/**
 * İnternet gidip gelince haber ver.
 *
 * Sebebi şu: yolda internet sık sık kesiliyor ve uygulama hiçbir şey
 * söylemediği için "bozuldu mu" endişesi doğuyor. Oysa Gerok'un tamamı
 * çevrimdışı çalışıyor — söylenmesi gereken tek şey bu.
 *
 * Açılışta bildirim çıkmıyor: uygulama zaten internetsiz açılabilir ve
 * her açılışta uyarı görmek gürültü olurdu. Yalnızca DEĞİŞİMDE konuşuyor.
 */
function agDegisiminiIzle() {
  addEventListener('offline', () =>
    kayitBildir(ç`İnternet kesildi · her şey çevrimdışı sürüyor`));
  addEventListener('online', () =>
    kayitBildir(ç`İnternet geri geldi`, 'iyi'));
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
      kayitBildir(ç`Dikkat: kalıcı depolama açılmadı. Uygulamayı ANA EKRANDAKİ simgeden aç — Safari sekmesinden açarsan iOS verileri silebilir.`, 'kotu');
      return;
    }
    if (d && d.kota && (d.kota - d.kullanilan) < AZ_YER_ESIGI) {
      kayitBildir(ç`Gerok'a ayrılan yer azalıyor: ${boyutYaz(d.kota - d.kullanilan)} kaldı. Yedek al ve galeriden yer aç.`, 'kotu');
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

/**
 * Alt şeritteki sekmeler.
 *
 * ÜSTÜNDE OLDUĞUN sekmeye yeniden dokunmak ekranı YENİDEN ÇİZMİYOR. Eskiden
 * çiziyordu ve zaman çizgisindeki bütün fotoğraflar bir anda göz kırpıyordu:
 * liste HTML'i baştan yazılınca <img> etiketleri yeniden kuruluyor, tarayıcı
 * resimleri yeniden çözüyor. Çift dokunuşta bu iki kez oluyordu.
 *
 * Onun yerine ÇİFT DOKUNUŞ bir kısayol: "başa dön". 400 kayıtlık bir listede
 * en tepeye parmakla çıkmak gerçekten uzun sürüyor.
 *
 * Kısayol yalnızca ZATEN O EKRANDAYKEN yapılan çift dokunuşta çalışıyor.
 * Başka ekrandan gelip hızlıca iki kez dokunmak kısayolu tetiklemesin —
 * Kayıt sekmesinde bu, istemeden ses kaydı başlatmak demek olurdu.
 */
const CIFT_DOKUNUS_MS = 450;

function sekmeleriKur() {
  let son = { ekran: null, an: 0, zaten: false };
  $$('#altBar .sekme').forEach(d => {
    d.addEventListener('click', () => {
      const ad = d.dataset.ekran;
      const simdi = Date.now();
      const zatenBurada = durum.ekran === ad;
      const cift = son.ekran === ad && son.zaten
        && simdi - son.an < CIFT_DOKUNUS_MS;

      son = cift ? { ekran: null, an: 0, zaten: false }
                 : { ekran: ad, an: simdi, zaten: zatenBurada };

      if (cift) { sekmeKisayolu(ad); return; }
      if (zatenBurada) { kisayoluOgret(ad); return; }   // yeniden çizme yok
      ekranAc(ad);
    });
  });
  kaydirmaKur();
}

/**
 * Kısayolu ÖĞRETEN satır.
 *
 * Üstünde olduğun sekmeye tek dokunmak artık hiçbir şey yapmıyor — bu boşa
 * giden dokunuşu öğretmen olarak kullanıyoruz. Yalnızca listenin dibindeyken
 * çıkıyor (yani yukarı çıkmak isteyen biri dokunmuştur) ve ömür boyu üç kez.
 * Öğrendikten sonra bir daha görünmemeli; her seferinde çıksa gürültü olurdu.
 */
const OGRET_SINIRI = 3;
let ogretilen = null;

async function kisayoluOgret(ad) {
  const yazi = { zaman: ç`Çift dokun · listenin başına dön`,
                 duraklar: ç`Çift dokun · listenin başına dön`,
                 gerok: ç`Çift dokun · sayfanın başına dön`,
                 harita: ç`Çift dokun · tümünü göster`,
                 kayit: ç`Çift dokun · sesli not başlat` }[ad];
  if (!yazi) return;

  const kaydirici = { zaman: '#zamanListe', duraklar: '#ekran-duraklar', gerok: '#ekran-gerok' }[ad];
  if (kaydirici && ($(kaydirici)?.scrollTop || 0) < 600) return;

  if (ogretilen == null) ogretilen = await veri.ayarOku('kisayolOgretildi', {}) || {};
  if ((ogretilen[ad] || 0) >= OGRET_SINIRI) return;
  ogretilen[ad] = (ogretilen[ad] || 0) + 1;
  await veri.ayarYaz('kisayolOgretildi', ogretilen);
  kayitBildir(yazi);
}

// Uzun listede kaydırma animasyonu iyi durur ama asıl derdi çözmez: 400
// kaydın dibinden tepeye yumuşak çıkmak da uzun sürüyor. Yakınsa akıyor,
// uzaksa anında gidiyor.
function basaDon(secici) {
  const e = $(secici);
  if (!e) return false;
  e.scrollTo({ top: 0, behavior: e.scrollTop > 3000 ? 'auto' : 'smooth' });
  // Aşağı kaydırırken çekilen şeritler geri gelsin: tepedeyken arama kutusu
  // ve alt bar açık olmalı.
  $('#altBar')?.classList.remove('cekildi');
  $('#zamanAra')?.classList.remove('cekildi');
  return true;
}

function sekmeKisayolu(ad) {
  // Harita ve Kayıt'ta kaydırılacak liste yok; oralarda "başa dön"ün karşılığı
  // başka bir şey.
  if (ad === 'harita') {
    // Haritanın "başa dönmesi" bu: bütün rota ve iz yeniden ekrana sığıyor.
    // Yakınlaşıp kaybolduktan sonra kendine gelmenin en kısa yolu.
    hepsiniGoster();
    titret(8);
    return;
  }
  if (ad === 'kayit') {
    // Uygulamanın en çok yapılan işi sesli not; şartnamenin en başından beri
    // "yolda yazmak zor, konuşmak kolay" diye duruyor. Zaten Kayıt ekranında
    // olan biri için çift dokunuş doğrudan kaydı başlatıyor.
    // Yanlışlıkla başlarsa görünür bir "Vazgeç" var ve hiçbir şey yazılmıyor.
    if (kayit.sesKaydediyorMu()) return;
    titret(8);
    sesKaydiBaslat('ses', { ipucu: ç`Konuş. Ekranı kapatma.` + '\n' + ç`Bitince Durdur ve kaydet.` });
    return;
  }

  const kaydirici = { zaman: '#zamanListe', duraklar: '#ekran-duraklar', gerok: '#ekran-gerok' }[ad];
  if (kaydirici && basaDon(kaydirici)) titret(8);
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
  // Zaman, Duraklar ya da Gerok'ta çekilmiş olabilecek alt şerit her ekran
  // değişiminde geri açılıyor: gizli bir alt bar, yeni gelinen ekranda
  // çıkışsızlık hissi verirdi.
  $('#altBar')?.classList.remove('cekildi');
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
    : (s ? (gerok.gerokBittiMi() ? ç`Gerok tamamlandı` : ç`Gerok henüz başlamadı`) : ç`Gerok paketi yüklenmedi`);
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
// Sıra listedeki sırayla aynı — en çok kullanılan üstte.
// `ad` listede, `kisa` şeritteki düğmede kullanılıyor. İkisi ayrı olmalı:
// listede yer bol, açıklayıcı olmak serbest — şeritte ise düğme uzayınca
// arama kutusunu eziyor (375 piksellik ekranda 133'e kadar düştüğü ölçüldü).
const SUZGECLER = [
  { id: 'hepsi', ad: ç`Hepsi`, kisa: ç`Süzgeç`, dene: () => true },
  { id: 'ses', ad: ç`Sesler`, kisa: ç`Sesler`, ipucu: ç`sesli not, ortam sesi, günlük`,
    dene: (k) => ['ses', 'ortam', 'gunluk', 'baslangic', 'bitis', 'mektup'].includes(k.tur) },
  { id: 'gorsel', ad: ç`Fotoğraf ve video`, kisa: ç`Görseller`, ipucu: ç`sıradan kareler dahil`,
    dene: (k) => ['foto', 'video', 'siradan'].includes(k.tur) },
  { id: 'insanPara', ad: ç`Harcama ve tanıştıklarımız`, kisa: ç`Harcama`,
    dene: (k) => ['kisi', 'fiyat'].includes(k.tur) },
  { id: 'yaziIsaret', ad: ç`Yazılar ve buradayım işaretleri`, kisa: ç`Yazılar`,
    dene: (k) => ['yazi', 'isaret'].includes(k.tur) },
  { id: 'sinir', ad: ç`Sınır geçişleri`, kisa: ç`Sınırlar`,
    dene: (k) => k.tur === 'sinir' },
  { id: 'baskasi', ad: ç`Arkadaşının kayıtları`, kisa: ç`Arkadaşın`,
    dene: (k) => k.sahip && k.sahip !== kayit.sahipAl().id }
];
const suzgecBul = (id) => SUZGECLER.find(x => x.id === id) || SUZGECLER[0];

// Çift dokunarak işaretlediklerin. Öbür süzgeçlerden ayrı duruyor ve onlarla
// BİRLEŞİYOR: "işaretlediğim fotoğraflar" tek başına bir süzgeç olarak
// listelenseydi bu soru sorulamazdı. Şeritte kendi yıldız düğmesi var.
const isaretliMi = (k) => !!k.isaretli;

// Bir kaydın aranan metni: gördüğün her şey aranabilir olmalı.
function aranabilirMetin(k) {
  return [k.metin, k.not, k.baslik, k.ad, k.tutar, k.paraBirimi,
          // `yazi` = ses kaydının yazıya çevrilmiş hâli. Aramanın asıl kazancı
          // bu: "Ohrid'de ne demiştik" sorusunun cevabı kaydın İÇİNDE.
          k.yazi,
          k.kategori, k.sahipAd, veri.TURLER[k.tur] || k.tur,
          ç(veri.TURLER[k.tur] || k.tur), k.kategori && ç(k.kategori)]
    .filter(Boolean).join(' ').toLocaleLowerCase('tr');
}

function zamanCizgisiCiz() {
  const kap = $('#zamanListe');
  const s = gerok.aktifGerok();
  // Şeritteki düğmeler her çizimde tazeleniyor — aşağıdaki erken çıkışlardan
  // ÖNCE, yoksa liste boşken düğme eski süzgecin adında kalıyor.
  suzgecEtiketiYaz();
  // Aşağıdaki boş durumların hepsinde erken çıkılıyor; kayan gün başlığı
  // eski günde takılı kalmasın diye şimdiden temizleniyor.
  ustGunleriYaz([]);

  // Tur yokken de kayıtlar gösterilmeli. Eskiden burada koşulsuz "paketi yükle"
  // yazıyordu; paketten önce bırakılan sesli not silinmiş gibi görünüyordu
  // (iPhone'da denerken çıktı). Kayıt duruyor, sadece görünmüyordu.
  // "Paketi yükle" demek, gezisini ARŞİVLEMİŞ birine YALAN söylemek: kayıtları
  // yerinde duruyor, ekran onları göstermiyor. Gezisini bitiren biri tam da
  // bunu görüp "gezi hiç yok" diye bildirdi.
  //
  // BURAYA İSİM YAZILMAZ. Bu dosya herkese açık depoda; kişi adı, gezi adı ya
  // da yer adı örneği yorum satırında bile dışarı çıkar.
  //
  // Çağrı İKİ dalın da üstünde: hangi boş duruma düşüldüğü önemli değil, tur
  // yokken arşivde bir gezi varsa bunun söylenmesi gerekiyor.
  if (!s) arsivVarsaAnlat();

  if (!s && !durum.kayitlar.length) {
    kap.innerHTML = bosDurum('harita', ç`Henüz bir gerok yüklenmedi.<br>Gerok sekmesinden paketi yükle.`);
    return;
  }
  if (!durum.kayitlar.length) {
    kap.innerHTML = bosDurum('zamanBos',
      ç`Zaman çizgisi boş.<br>Kayıt sekmesinden ilk sesli notunu bırak,<br>ya da bir fotoğraf ekle.`);
    return;
  }

  // Arama ve süzgeç önce uygulanıyor: sayfalama süzülmüş liste üzerinden
  // işlesin, yoksa "son 120 kayıt içinde ara" gibi tuhaf bir şey olurdu.
  const sorgu = (durum.arama || '').trim().toLocaleLowerCase('tr');
  const suzgec = suzgecBul(durum.suzgec);
  const tumu = durum.kayitlar.filter(k =>
    suzgec.dene(k)
    && (!durum.sadeceIsaretli || isaretliMi(k))
    && (!sorgu || aranabilirMetin(k).includes(sorgu)));

  if (!tumu.length) {
    const hicYok = !durum.kayitlar.length;
    kap.innerHTML = hicYok
      ? `<div class="bos-durum ilk">
          <div class="bos-halka"></div>
          <div class="bos-yazi">${ç`Bu gerokta henüz kayıt yok.<br>Alt şeritteki <span style="color:var(--vurgu)">Kayıt</span>'a bas, bir sesli not bırak.<br>Yolda tek dokunuş yeter.`}</div>
        </div>`
      : `<div class="bos-durum">
          <div class="bos-yazi">${ç`Bu süzgeçle kayıt yok.`}<br>
          <span style="color:var(--vurgu)">${kacis(sorgu ? `“${sorgu}”`
            : (durum.sadeceIsaretli ? ç`işaretlediklerin` : suzgec.ad.toLocaleLowerCase('tr')))}</span>
          ${durum.sadeceIsaretli && !sorgu
            ? `<br><br>${ç`Bir kayda <b>çift dokun</b> — yıldız çıkar, kayıt buraya düşer.`}`
            : ''}</div>
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
  let html = s ? '' : `<div class="uyari-satir">${ç`Henüz bir gerok yüklenmedi — aşağıdaki kayıtlar duruyor. Paketi yükleyince ya da yeni tur başlatınca Gerok → Turlar'dan tek düğmeyle o tura taşınırlar.`}</div>`;
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
      rozet = !s ? ç`Tur yok`
        : grupZamani > turSonu ? ç`Tur bittikten sonra`
        : grupZamani < turBasi ? ç`Tur başlamadan önce`
        : ç`Turun günlerinin dışında`;
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
  // Resim ALTINA konuyor, innerHTML ile değil: üstüne yazılsaydı fotoğrafın
  // içindeki konum etiketi silinirdi.
  //
  // ADRES BELLEKTEYSE BEKLETİLMİYOR. Liste her dokunuşta baştan çiziliyor
  // (innerHTML) ve bütün <img>ler siliniyor; eskiden hepsi `await` ile geri
  // konuyordu. Adres zaten elde olsa bile `await` bir sonraki kareye
  // atlıyordu, yani arada bir kare fotoğrafsız çiziliyordu — ekranda göz
  // kırpması gibi görünen şey buydu. Bellekteki adres artık aynı karede,
  // sayfa boyanmadan önce yerine konuyor.
  const resmiKoy = (d, url) => {
    if (url) d.insertAdjacentHTML('afterbegin', `<img src="${url}" alt="" loading="lazy">`);
  };
  kap.querySelectorAll('[data-onizleme]').forEach((d) => {
    const hazir = onizlemeAdresleri.get(d.dataset.onizleme);
    if (hazir) { resmiKoy(d, hazir); return; }
    // İlk açılışta dosya diskten okunuyor; o ancak bekleyerek olur.
    onizlemeAdresi(d.dataset.onizleme).then((url) => resmiKoy(d, url));
  });
  kap.querySelectorAll('[data-kisi-foto]').forEach(b => {
    b.addEventListener('click', (e) => {
      // Satırın kendi çift-dokunma/basılı-tutma dinleyicisine gitmesin:
      // fotoğrafa dokunmak ayrıntı panelini açmamalı.
      e.stopPropagation();
      const id = b.dataset.kisiFoto;
      const buyuk = durum.acikKisiFotosu !== id;
      durum.acikKisiFotosu = buyuk ? id : null;
      titret(8);
      // Burada da liste yeniden çizilmiyor: aynı <img> yerinde kalıp
      // yalnızca boyu değişiyor, böylece büyürken kırpışmıyor.
      b.classList.toggle('buyuk', buyuk);
      b.setAttribute('aria-expanded', String(buyuk));
      b.setAttribute('aria-label', buyuk ? ç`Fotoğrafı küçült` : ç`Fotoğrafı büyüt`);
    });
  });
  ayrintiDugmeleriniBagla(kap);
  uzunBasmayiKur(kap);
}

/**
 * Açılan paneldeki düğmeleri bağlar.
 *
 * Ayrı bir işlev, çünkü iki yerden çağrılıyor: liste baştan çizilirken ve
 * tek bir satırın paneli açılırken (bkz. ayrintiyiUygula).
 */
function ayrintiDugmeleriniBagla(kok) {
  kok.querySelectorAll('[data-galeri]').forEach(b => {
    b.addEventListener('click', () => galeridenAc(b.dataset.galeri));
  });
  kok.querySelectorAll('[data-sil]').forEach(d => {
    d.addEventListener('click', () => kaydiSil(d.dataset.sil));
  });
  kok.querySelectorAll('[data-baslik]').forEach(d => {
    d.addEventListener('click', () => kayitBasligiSor(d.dataset.baslik));
  });
  kok.querySelectorAll('[data-yazi-duzenle]').forEach(d => {
    d.addEventListener('click', () => yaziDuzenleSor(d.dataset.yaziDuzenle));
  });
  kok.querySelectorAll('[data-cozum]').forEach(d => {
    d.addEventListener('click', () => cozumSor(d.dataset.cozum));
  });
  kok.querySelectorAll('[data-google]').forEach(d => {
    d.addEventListener('click', () => {
      const [lat, lon] = d.dataset.google.split(',');
      googleHaritalarAc({ lat, lon });
    });
  });
}

/**
 * Ayrıntı panelini açar/kapatır — LİSTEYİ YENİDEN ÇİZMEDEN.
 *
 * Eskiden dokununca `zamanCizgisiCiz()` çağrılıyordu; o da listenin tamamını
 * `innerHTML` ile siliyordu. Bütün fotoğraflar DOM'dan çıkıp geri giriyordu ve
 * ekranda göz kırpması gibi bir boşluk oluyordu. Adresi bellekten aynı karede
 * koymak Chromium'da yetti, telefondaki Safari'de yetmedi: yeni bir <img>
 * elemanı her hâlükârda yeniden yükleniyor.
 *
 * Çözüm semptomu değil kökü kesiyor — fotoğraflara HİÇ DOKUNULMUYOR. Yalnızca
 * açılan satıra bir düğüm ekleniyor, kapanandan çıkarılıyor.
 */
function ayrintiyiUygula(oncekiId, yeniId) {
  const kap = $('#zamanListe');
  if (!kap) return;

  const satirBul = (id) => id ? kap.querySelector(`.kayit-satir[data-kayit="${id}"]`) : null;
  const fotoylaBitiyorMu = (id) => {
    const k = durum.kayitlar.find(x => x.id === id);
    return !!(k && k.medyaId && GORSEL_TURLER.includes(k.tur));
  };

  const kapanan = satirBul(oncekiId);
  if (kapanan) {
    kapanan.classList.remove('acik');
    kapanan.querySelector('.ayrinti')?.remove();
    // Fotoğrafla biten kart kapanınca alttaki boşluk yine sıfırlanıyor.
    if (fotoylaBitiyorMu(oncekiId)) kapanan.classList.add('foto-sonu');
  }

  const acilan = satirBul(yeniId);
  if (!acilan) return;
  const k = durum.kayitlar.find(x => x.id === yeniId);
  if (!k) return;

  const sesli = SESLI_TURLER.includes(k.tur);
  const gorsel = GORSEL_TURLER.includes(k.tur);
  acilan.classList.add('acik');
  acilan.classList.remove('foto-sonu');
  acilan.insertAdjacentHTML('beforeend', ayrintiPaneli(k, {
    konumlu: k.lat != null && k.lon != null,
    basliklanabilir: sesli || ['foto', 'video', 'siradan'].includes(k.tur),
    gorsel: gorsel && !!k.medyaId,
    videoSure: k.tur === 'video' ? k.videoSure : null
  }));
  ayrintiDugmeleriniBagla(acilan);
}

// Zaman çizgisinde iki hareket var:
//
//   · TEK DOKUNUŞ  → kaydın eylemleri açılır/kapanır.
//   · ÇİFT DOKUNUŞ → kayıt işaretlenir (bkz. isaretiDegistir).
//
// Uzun basma kalktı: tek dokunuş zaten aynı paneli anında açıyor, 420 ms
// beklemenin bir karşılığı kalmadı.
//
// Parmak 10 pikselden fazla kayarsa dokunuş sayılmıyor — listeyi kaydırmak
// panel açmamalı. 320 ms, iki dokunuşu bir hareket saymak için: daha kısası
// gerçek çift dokunmayı kaçırıyor, daha uzunu arka arkaya iki ayrı kayda
// bakmayı işaretlemeye çeviriyor.
const CIFT_DOKUNMA = 320;
const BASMA_KAYMA = 10;

/**
 * Kaydı işaretler ya da işareti kaldırır — çift dokunmanın karşılığı.
 *
 * NEDEN VAR: gezinin üçüncü günü hangi kaydın önemli olduğunu bilirsin ama
 * hiçbir yere yazmazsın; dönüşte dört yüz kayda bakınca artık bilmezsin.
 * Aradaki fark tek bir hareket. O yüzden hızlı olması şart — panel açıp
 * düğme aramak değil, ekrana iki kere vurmak.
 *
 * Liste yeniden ÇİZİLMİYOR: hem fotoğraflar yerinde kalsın (bkz.
 * ayrintiyiUygula) hem de patlayan yıldız yarıda kesilmesin.
 */
async function isaretiDegistir(satir) {
  const id = satir.dataset.kayit;
  const k = durum.kayitlar.find(x => x.id === id);
  if (!k) return;

  const acildi = !k.isaretli;
  k.isaretli = acildi || undefined;      // false yerine alanı hiç tutma
  titret(acildi ? 14 : 8);

  // Önce ekran, sonra disk: dokunuşun karşılığı beklemeden görünsün.
  yildiziCiz(satir, acildi);
  if (acildi) yildiziPatlat(satir);

  try {
    await veri.kayitEkle({ ...k, isaretli: acildi ? true : undefined });
  } catch {
    kayitBildir(ç`İşaret kaydedilemedi`, 'kotu');
  }
}

// Künyedeki minik yıldız: sahip adının solunda. Sağ üst köşede zaten ad
// duruyor; yıldız oraya konsa adı örterdi. Bu yer her kayıt türünde aynı,
// fotoğrafı örtmüyor ve soldaki gün rengi şeridiyle çakışmıyor.
function yildiziCiz(satir, isaretli) {
  const ust = satir.querySelector('.kayit-ust');
  if (!ust) return;
  const varOlan = ust.querySelector('.isaret-yildiz');
  if (!isaretli) { varOlan?.remove(); return; }
  if (varOlan) return;
  const sahip = ust.querySelector('.kayit-sahip');
  const y = document.createElement('span');
  y.className = 'isaret-yildiz';
  y.setAttribute('aria-label', 'işaretli');
  y.textContent = '★';
  ust.insertBefore(y, sahip || null);
}

// Instagram'daki kalp gibi: kaydın ortasında büyüyüp sönen büyük yıldız.
// Kendi kendini siliyor — kalıcı iz künyedeki minik yıldız.
function yildiziPatlat(satir) {
  // Kendi kırpma kutusu: kısa bir kayıtta 116 piksellik yıldız komşu kayda
  // taşıyordu. Satırın kendisine overflow konamıyor — fotoğraf iki yandan
  // bilerek taşıyor, o kırpılırdı.
  const kap = document.createElement('span');
  kap.className = 'yildiz-kap';
  kap.setAttribute('aria-hidden', 'true');
  const p = document.createElement('span');
  p.className = 'yildiz-pat';
  p.textContent = '★';
  kap.appendChild(p);
  satir.appendChild(kap);
  p.addEventListener('animationend', () => kap.remove(), { once: true });
  // Animasyon hiç başlamazsa (hareketi azalt ayarı) yine de temizlensin.
  setTimeout(() => kap.remove(), 1200);
}

function uzunBasmayiKur(kap) {
  kap.querySelectorAll('.kayit-satir').forEach(satir => {
    let bas = null, kaydirdi = false, sonDokunma = 0, sonTemas = 0;

    const ac = () => {
      const onceki = durum.acikSatir;
      durum.acikSatir = onceki === satir.dataset.kayit ? null : satir.dataset.kayit;
      titret(12);
      // Liste baştan çizilmiyor: fotoğraflar yerinde kalsın (bkz.
      // ayrintiyiUygula). Aynı anda tek panel açık olduğu için önceki
      // satırın panelini de burası kapatıyor.
      ayrintiyiUygula(onceki, durum.acikSatir);
    };

    // Bir dokunuş tamamlandı. Tek mi çift mi olduğuna burada karar veriliyor.
    const dokunusBitti = () => {
      const simdi = Date.now();
      if (simdi - sonDokunma < CIFT_DOKUNMA) {
        // İKİNCİ dokunuş: işaretle. Birinci dokunuşun açtığı panel olduğu
        // gibi kalıyor — geri kapatmak, ekranın açılıp hemen kapanmasına ve
        // listenin zıplamasına yol açıyordu.
        sonDokunma = 0;
        isaretiDegistir(satir);
        return;
      }
      sonDokunma = simdi;
      ac();
    };

    const basla = (ev) => {
      if (ev.target.closest('button, input, a')) { bas = null; return; }
      const n = ev.touches?.[0] || ev;
      bas = { x: n.clientX, y: n.clientY, t: Date.now() };
      kaydirdi = false;
    };

    const kaydi = (ev) => {
      if (!bas) return;
      const n = ev.touches?.[0] || ev;
      if (Math.abs(n.clientX - bas.x) > BASMA_KAYMA ||
          Math.abs(n.clientY - bas.y) > BASMA_KAYMA) kaydirdi = true;
    };

    // Parmak kaydıysa dokunuş sayılmıyor: listeyi kaydırmak panel açmamalı.
    const bitti = () => {
      const b = bas; bas = null;
      if (!b || kaydirdi) return;
      if (Date.now() - b.t > 700) return;      // uzun basma: dokunuş değil
      dokunusBitti();
    };

    satir.addEventListener('touchstart', (e) => { sonTemas = Date.now(); basla(e); }, { passive: true });
    satir.addEventListener('touchmove', kaydi, { passive: true });
    satir.addEventListener('touchend', () => { sonTemas = Date.now(); bitti(); });
    satir.addEventListener('touchcancel', () => { bas = null; });

    // FARE OLAYLARI YOK SAYILIYOR — iOS her gerçek dokunuştan sonra uyum için
    // sahte bir fare tıklaması da gönderiyor. Eskiden ikisi de dinlendiği için
    // TEK dokunuş çift sayılıyordu; panelin tek dokunuşta açılması bu kazadan
    // geliyordu. Çift dokunma artık yıldız bastığı için o kaza kabul edilemez:
    // her tek dokunuş kaydı işaretlerdi. Fare yolu yalnızca gerçek fare için,
    // yani masaüstünde sınarken çalışıyor.
    const fareOlur = () => Date.now() - sonTemas > 700;
    satir.addEventListener('mousedown', (e) => { if (fareOlur()) basla(e); });
    satir.addEventListener('mousemove', (e) => { if (fareOlur()) kaydi(e); });
    satir.addEventListener('mouseup', () => { if (fareOlur()) bitti(); });
    satir.addEventListener('mouseleave', () => { bas = null; });
  });
}

// Şerittteki düğmenin üstünde açık olan süzgecin ADI yazıyor. Beş ikonlu
// eski şeritte hangi süzgecin açık olduğunu ikonun rengiyle anlamak
// gerekiyordu ve telefonda ikonun adını gösterecek bir yol yok.
function suzgecEtiketiYaz() {
  const dugme = $('#btnSuzgec'), etiket = $('#suzgecEtiket');
  if (!dugme || !etiket) return;
  const acik = durum.suzgec !== 'hepsi';
  etiket.textContent = acik ? suzgecBul(durum.suzgec).kisa : ç`Süzgeç`;
  dugme.classList.toggle('secili', acik);
  $('#btnIsaretli')?.classList.toggle('secili', !!durum.sadeceIsaretli);
}

// Süzgeç listesi. Her satırda adı ve KAÇ KAYIT olduğu yazıyor: sayı olmadan
// "sınır geçişleri"ne dokunup boş liste görmek kullanıcının hatası gibi
// duruyordu, oysa o türden kaydı hiç yoktu.
function suzgecListesiAc() {
  const satirlar = SUZGECLER.map(x => {
    const n = durum.kayitlar.filter(k => x.dene(k)).length;
    const secili = durum.suzgec === x.id;
    return `<button class="suzgec-satir ${secili ? 'secili' : ''}" data-suzgec="${x.id}"
              ${n || x.id === 'hepsi' ? '' : 'disabled'}>
      <span class="ss-ad">${kacis(x.ad)}${x.ipucu
        ? `<span class="ss-ipucu">${kacis(x.ipucu)}</span>` : ''}</span>
      <span class="ss-sayi">${n}</span>
    </button>`;
  }).join('');

  const isaretliSayi = durum.kayitlar.filter(isaretliMi).length;

  ortuAc(`
    <div class="ortu-baslik">${ç`Süzgeç`}</div>
    <div class="suzgec-liste">${satirlar}</div>
    <button class="suzgec-satir yildizli ${durum.sadeceIsaretli ? 'secili' : ''}"
            id="ssIsaretli" ${isaretliSayi ? '' : 'disabled'}>
      <span class="ss-ad">${ç`Yalnızca işaretlediklerin`}
        <span class="ss-ipucu">${ç`yukarıdakiyle birlikte çalışır`}</span></span>
      <span class="ss-sayi">${isaretliSayi}</span>
    </button>
    <button class="eylem-dugme" id="ssKapat">${ç`Kapat`}</button>
  `, true, 'suzgec');

  const uygula = () => {
    ortuKapat();
    gosterilenSayi = SAYFA_ADIMI;
    zamanCizgisiCiz();
  };
  $$('#ortuIc .suzgec-satir[data-suzgec]').forEach(d =>
    d.addEventListener('click', () => { durum.suzgec = d.dataset.suzgec; uygula(); }));
  $('#ssIsaretli').addEventListener('click', () => {
    durum.sadeceIsaretli = !durum.sadeceIsaretli; uygula();
  });
  $('#ssKapat').addEventListener('click', ortuKapat);
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

  $('#btnSuzgec').addEventListener('click', suzgecListesiAc);

  $('#btnIsaretli').addEventListener('click', () => {
    durum.sadeceIsaretli = !durum.sadeceIsaretli;
    gosterilenSayi = SAYFA_ADIMI;
    zamanCizgisiCiz();
  });

  // Aşağı kaydırınca şerit çekiliyor, yukarı çıkınca geri geliyor. Küçük
  // ekranda arama kutusu sürekli yer kaplamasın. Aynı kaydırmada üst şeritteki
  // gün başlığı da tazeleniyor.
  const liste = $('#zamanListe');
  seridiKur(liste, '#zamanAra', () => ustGunuTazele(liste));

  // Aynı davranış uzun listesi olan öteki iki ekranda da: duraklarda 26 kart,
  // Gerok'ta açılmış paneller ekranı doldurunca alt bar da yer kaplıyordu.
  // Harita bunun dışında — orada kaydırılacak liste yok, harita kayıyor.
  seridiKur($('#ekran-duraklar'));
  seridiKur($('#ekran-gerok'));
}

/**
 * Bir kaydırma alanına "aşağı inince şeritler çekilsin" davranışını takar.
 *
 * Alt bar her ekranda çekiliyor ama ekran değişince geri açılıyor (bkz.
 * ekranAc): gizli bir alt bar başka bir ekranda açılırsa "sekmeler nereye
 * gitti" sorusu doğar.
 *
 * @param kaydirici kaydırılan öğe
 * @param ustSerit  varsa üstte birlikte çekilecek şerit
 * @param herAdimda her kaydırmada çağrılacak ek iş
 */
function seridiKur(kaydirici, ustSerit = null, herAdimda = null) {
  if (!kaydirici) return;
  let sonY = 0;
  const seritler = (gizle) => {
    if (ustSerit) $(ustSerit)?.classList.toggle('cekildi', gizle);
    $('#altBar').classList.toggle('cekildi', gizle);
  };
  kaydirici.addEventListener('scroll', () => {
    const y = kaydirici.scrollTop;
    // Şeritler birlikte gidip birlikte geliyor: okurken küçük ekranda ~140
    // piksel yer açılıyor. Ayrı ayrı davransalar ekran sallanıyormuş gibi
    // olurdu. 6 piksellik eşik, parmağın titremesini yön sanmasın diye.
    if (y > sonY + 6 && y > 40) seritler(true);
    else if (y < sonY - 6 || y < 12) seritler(false);
    sonY = y;
    herAdimda?.();
  }, { passive: true });
}

// Konumun NEREDEN geldiği yazılıyor. On yıl sonra haritadaki iğneye bakıp
// "burası gerçekten orası mıydı" diye sorulduğunda cevabı olan tek şey bu:
// uydu ölçümü ile izden tahmin arasındaki fark birkaç yüz metre olabiliyor.
const KONUM_KAYNAGI = {
  gps: ç`konum: uydudan`,
  iz: ç`konum: iz kaydından`,
  exif: ç`konum: fotoğrafın içinden`,
  elle: ç`konum: elle işaretlendi`
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
    return [k.metin, [k.tutar, k.paraBirimi].filter(Boolean).join(' '),
            k.kategori && ç(k.kategori)]
      .filter(Boolean).join(' · ');
  }
  // `k.ad` DEĞİL `k.metin`: tanışma kaydında ad `metin` alanına yazılıyor
  // (bkz. kayit.js → kisiEkle). Burası `k.ad` okuduğu için kişinin ADI zaman
  // çizgisinde hiç görünmüyordu — yalnızca notu. Kaydın var oluş sebebi
  // ("on yıl sonra adını hatırlamayacaksın") tam da o addı.
  if (k.tur === 'kisi') return [k.ad || k.metin, k.not].filter(Boolean).join(' — ');
  if (k.tur === 'video' && !k.metin) return `Video · ${sureYaz(k.videoSure)}`;
  return k.metin || k.baslik || '';
}

function kayitSatiri(k) {
  const tur = ç(veri.TURLER[k.tur] || k.tur);
  // Yer adı çözülmüşse koordinatın NEREDEN geldiğini söylemenin anlamı
  // kalmıyor — adın kendisi daha çok şey anlatıyor. Küre işareti yalnızca
  // burada çıkıyor. Ad elle de yazılmış olabilir; kullanıcı için ikisi de
  // aynı şey: yerin adı.
  const yer = k.yerAdi
    ? `🌐 ${ç`konum: ${kacis(k.yerAdi)}`}`
    : (k.lat != null && k.lon != null)
      ? (KONUM_KAYNAGI[k.konumKaynagi] || ç`konum: uydudan`)
      : ç`konum: bulunamadı`;

  const sesli = SESLI_TURLER.includes(k.tur);
  const gorsel = GORSEL_TURLER.includes(k.tur);
  const konumlu = k.lat != null && k.lon != null;
  const acik = durum.acikSatir === k.id;
  const metin = kayitCumlesi(k);

  // Tür etiketi sesli kayıtlarda ve metni olmayan kayıtlarda yazılıyor.
  // Ötekilerde solundaki renk çizgisi zaten söylüyor; iki kez söylemek
  // listeyi etiket tarlasına çeviriyordu.
  //
  // Görsel kayıtlar bunun dışında: saatin yanındaki o hiza BAŞLIĞA ayrıldı.
  // "FOTOĞRAF" yazısı hiçbir şey söylemiyordu — altında zaten fotoğraf
  // duruyor. Başlık ise fotoğrafın içinde olmayan tek bilgi.
  const turGoster = (sesli || !metin) && !gorsel;

  let govde = '';
  if (metin && !gorsel) govde += `<div class="kayit-metin">${kacis(metin)}</div>`;

  // Çakışma: aynı kaydı ikiniz de değiştirmişsiniz. Ekranda duran senin
  // sürümün (bkz. esitleme.js'teki kural), karşı sürüm burada, altında.
  // Gizlemek yerine göstermek şart: on yıl sonra "o gün ikimiz ne yazmıştık"
  // sorusunun cevabı bu satır.
  for (const d of k.digerSurumler || []) {
    const dm = d.metin || d.baslik || '';
    if (!dm) continue;
    govde += `<div class="diger-surum">
      <div class="diger-etiket">${ç`${kacis(d.kimden || ç`arkadaşının`)} sürümü`}</div>
      <div class="diger-metin">${kacis(dm)}</div>
    </div>`;
  }

  // Sesin yazıya çevrilmiş hâli. Uzun olabiliyor; listede kısaltılıyor,
  // satır açılınca tamamı görünüyor — 400 satırlık listede her biri yarım
  // sayfa tutsaydı zaman çizgisi okunmaz olurdu.
  //
  // "makineden" etiketi şart: bunu bir insan yazmadı, yanlış olabilir.
  // On yıl sonra buna bakan biri, kelimesi kelimesine söylenmiş sanmasın.
  if (sesli && (k.yazi || '').trim()) {
    const tam = k.yazi.trim();
    const kisa = tam.length > 130 && !acik ? tam.slice(0, 130).trimEnd() + '…' : tam;
    // Etiket yalnızca MAKİNE çıktısında. Elle düzeltilmiş bir metne
    // "makineden" demek yalan olurdu — ve on yıl sonra bu satıra bakan biri
    // hangisinin insan sözü olduğunu bilmek isteyecek.
    const elle = k.yaziKaynagi === 'elle';
    govde += `<div class="cozum${acik ? ' acik' : ''}">
      ${elle ? '' : `<span class="cozum-etiket">${ç`makineden`}</span>`}${kacis(kisa)}
    </div>`;
  }

  if (k.medyaId && sesli) {
    const cubuklar = dalgaCubuklari(k.id);
    govde += `<div class="ses-oynat">
      <button class="ses-tus" data-ses="${k.medyaId}" data-bicim="${kacis(k.bicim || '')}" data-sure="${k.sure || 0}">▶</button>
      <div class="dalga" role="slider" aria-label="${ç`Ses konumu`}"
           aria-valuemin="0" aria-valuemax="1000" aria-valuenow="0">
        <div class="dalga-kat sonuk">${cubuklar}</div>
        <div class="dalga-kat dolu">${cubuklar}</div>
      </div>
      <span class="sure">0:00 / ${sureYaz(k.sure)}</span>
    </div>`;
  }
  // Tanıştığımız kişinin fotoğrafı MİNİK: not satırından uzun olmasın.
  // Bu kayıtta asıl şey ad ve not; fotoğraf onları hatırlatan bir işaret.
  // Tam boy gösterilseydi listede tanışma kayıtları fotoğraf kayıtları gibi
  // görünürdü. Dokununca büyüyor, bir daha dokununca küçülüyor.
  if (k.medyaId && k.tur === 'kisi') {
    const buyuk = durum.acikKisiFotosu === k.id;
    govde += `<button class="kisi-foto${buyuk ? ' buyuk' : ''}"
      data-kisi-foto="${k.id}" data-onizleme="${k.medyaId}"
      aria-label="${buyuk ? ç`Fotoğrafı küçült` : ç`Fotoğrafı büyüt`}"
      aria-expanded="${buyuk}"></button>`;
  }
  if (k.medyaId && gorsel) {
    // Fotoğrafın üstünde duran tek yazı KONUM. Sol altta, saydam, küçük —
    // resmi örtmüyor. Eskiden fotoğrafın altında ayrı bir satırdı ve iki
    // fotoğrafın arasına 30 piksellik bir yazı şeridi giriyordu; liste
    // fotoğraf albümü değil form gibi görünüyordu.
    //
    // "orijinali galeride" cümlesi buradan alınıp ayrıntı paneline taşındı
    // (bkz. ayrintiPaneli): okunacak bir bilgi değil, bir kez öğrenilecek
    // bir kural.
    govde += `<div class="kayit-foto" data-onizleme="${k.medyaId}">
      <span class="foto-yer">${yer}</span>
    </div>`;
  }

  // Ses ve fotoğraflara sonradan bir satır eklenebiliyor. Fotoğrafa başlık
  // yazmak on yıl sonra en çok işe yarayan şey: "bu nerenin fotoğrafıydı"
  // sorusunun cevabı resmin içinde olmuyor.
  const basliklanabilir = sesli || ['foto', 'video', 'siradan'].includes(k.tur);

  // Konum satırı HER ZAMAN görünüyor. Tasarım dosyasında basılı tutunca
  // çıkıyordu ama hem README hem de zaman çizgisi denemeleri (1d) onu satırın
  // sabit parçası sayıyor — ve README bunu bir ürün ilkesi olarak yazıyor:
  // kayıt her zaman konumun NEREDEN geldiğini söylemeli. Uydu ölçümü ile izden
  // tahmin arasındaki fark birkaç yüz metre; on yıl sonra "burası gerçekten
  // orası mıydı" sorusunun tek cevabı bu satır. Görmek için kaydı basılı
  // tutmak gerekmemeli.
  //
  // Eylemler ise basılı tutunca açılıyor: her satırın altında duran "Sil"
  // düğmesi listeyi düğme tarlasına çeviriyordu ve araç sallanırken
  // yanlışlıkla basılabiliyordu.
  // Fotoğrafla biten kapalı kartın altında boşluk yok: fotoğrafın bittiği
  // yerde bir sonraki kayıt başlıyor. Kart açılınca ayrıntı paneli geldiği
  // için boşluk geri konuyor.
  const fotoylaBitiyor = gorsel && k.medyaId && !acik;

  return `<div class="kayit-satir ${k.tur}${acik ? ' acik' : ''}${
      fotoylaBitiyor ? ' foto-sonu' : ''}" data-kayit="${k.id}">
    <div class="kayit-ust">
      <span class="kayit-saat">${gerok.saat(k.t)}</span>
      ${turGoster ? `<span class="kayit-tur">${kacis(tur)}</span>` : ''}
      ${gorsel && metin ? `<span class="kayit-ust-baslik">${kacis(metin)}</span>` : ''}
      <span class="kayit-bosluk"></span>
      ${k.isaretli ? `<span class="isaret-yildiz" aria-label="${ç`işaretli`}">★</span>` : ''}
      <span class="kayit-sahip">${kacis(k.sahipAd || 'bilinmeyen')}</span>
    </div>
    ${govde}
    ${gorsel && k.medyaId ? '' : `<div class="kayit-yer">${yer}</div>`}
    ${acik ? ayrintiPaneli(k, { konumlu, basliklanabilir, gorsel: gorsel && k.medyaId,
      videoSure: k.tur === 'video' ? k.videoSure : null }) : ''}
  </div>`;
}

/**
 * Kaydın altından açılan ayrıntı paneli — çift dokunma ya da basılı tutma.
 *
 * BİLGİ LİSTESİ YOK. Bir ara ses ve fotoğraf kayıtlarında süre, tarih, yer,
 * koordinat, konum kaynağı ve kaydeden satırlarını gösteren bir künye vardı;
 * 17 Ağustos'ta ikisi de kaldırıldı. Aynı bilgiler kartın kendisinde zaten
 * duruyor — saat üstte, kaydeden sağ üstte, yer altta, süre oynatıcının
 * yanında. İkinci kez, tablo hâlinde söylemek anıyı dosya kayıt fişine
 * çeviriyordu.
 *
 * "Saat / gün" düğmesi de kaldırıldı: kaydın saatini elle değiştirmek, on yıl
 * sonra güvenilecek tek şeyi — ne zaman olduğunu — kırılgan yapıyordu.
 * Yanlış güne düşen kayıt zaten iz kaydından düzeliyor.
 */
function ayrintiPaneli(k, { konumlu, basliklanabilir, gorsel = false, videoSure = null }) {
  // "orijinali galeride" uygulamanın en önemli sözü: fotoğraf buraya
  // KOPYALANMIYOR, tam çözünürlüklü hâli telefonun kendi galerisinde duruyor.
  // Uygulama silinse bile fotoğraflar yerinde kalır. Ama bu bir kez öğrenilen
  // bir kural — yüzlerce fotoğrafın üstünde tekrar tekrar okunacak bir şey
  // değil. O yüzden düğmelerin yanına, açılan panele indi.
  const fotoNotu = !gorsel ? ''
    : videoSure != null
      ? ç`video · ${sureYaz(videoSure)} · önizleme, orijinali galeride`
      : 'önizleme · orijinali galeride';

  // Tek bir sarmalayıcı: panel açılıp kapanırken bu düğüm olduğu gibi
  // ekleniyor ya da çıkarılıyor. Listenin tamamı yeniden çizilmiyor —
  // fotoğraflara hiç dokunulmuyor (bkz. ayrintiyiUygula).
  return `<div class="ayrinti">
    ${fotoNotu ? `<div class="foto-not">${kacis(fotoNotu)}</div>` : ''}
    <div class="kayit-eylemler">
      ${konumlu ? `<button class="satir-dugme" data-google="${k.lat},${k.lon}">${ç`Haritalar'da aç`}</button>` : ''}
      ${gorsel ? `<button class="satir-dugme" data-galeri="${k.id}">${ç`Fotoğrafları aç`}</button>` : ''}
      ${k.tur === 'yazi' ? `<button class="satir-dugme vurgulu" data-yazi-duzenle="${k.id}">${ç`Düzenle`}</button>` : ''}
      ${SESLI_TURLER.includes(k.tur) ? `<button class="satir-dugme vurgulu" data-cozum="${k.id}">${
        (k.yazi || '').trim() ? ç`Yazıyı düzelt` : ç`Yazıya çevir`}</button>` : ''}
      ${basliklanabilir ? `<button class="satir-dugme vurgulu" data-baslik="${k.id}">${
        k.baslik || k.metin ? ç`Adını değiştir` : ç`Başlık yaz`}</button>` : ''}
      <button class="satir-dugme sil" data-sil="${k.id}">${ç`Sil`}</button>
    </div>
  </div>`;
}

/**
 * Fotoğraflar uygulamasını açar.
 *
 * DÜRÜST OLMASI GEREKEN YER — düğme "Galeride göster" değil "Fotoğrafları aç".
 * Bir web uygulaması Fotoğraflar'da BELİRLİ bir kareyi açamıyor:
 *
 *   · Dosya seçici bize yalnızca görüntünün baytlarını veriyor. Fotoğrafın
 *     kitaplıktaki kimliği (PHAsset localIdentifier) hiç gelmiyor.
 *   · Kimlik olmadan "şunu aç" diyebileceğimiz bir adres yok. `photos://`
 *     ailesinde tarih ya da dosya adıyla arama yapan bir yol da yok.
 *   · `photos-redirect://` yapabildiğinin tamamı: uygulamayı öne getirmek.
 *
 * 17 Ağustos'ta telefonda denendi ve tam da bu oldu — Fotoğraflar açıldı,
 * kare açılmadı. Bu bir eksiklik değil, iOS'un kapalı kapısı; ancak native
 * uygulamada aşılabilir (native taraf kimliği saklayabiliyor).
 *
 * Elimizden gelen: uygulamayı açarken kaydın tam gün ve saatini söylemek.
 * Galeri tarihe göre sıralı olduğu için aranan kareye götüren tek ipucu bu;
 * aynı bilgi ayrıntı panelinde "Çekildiği an" satırında da yazıyor.
 *
 * Uygulama içindeki önizleme bundan bağımsız: küçültülmüş bir KOPYA olarak
 * Gerok'un kendi deposunda duruyor. Galeriden silinse bile buradaki kayıt
 * ve önizleme yerinde kalıyor.
 */
function galeridenAc(kayitId) {
  const k = durum.kayitlar.find(x => x.id === kayitId);
  if (!k) return;
  kayitBildir(ç`Fotoğraflar açılıyor · aslı ${gerok.tarihUzun(k.t)} ${gerok.saat(k.t)} hizasında`);
  // Konum ya da kimlik taşımayan, yalnızca uygulamayı öne getiren bir adres.
  const a = document.createElement('a');
  a.href = 'photos-redirect://';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// Google Haritalar: yorumlar ve fotoğraflar orada. İNTERNET İSTER — yolda
// çalışmaz, otelin wifi'sinde çalışır.
export function googleHaritalarAc({ lat, lon, ad = '', zoom = 15 }) {
  kayitBildir(ç`Google Haritalar’da açılıyor`);
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
    <div class="ortu-baslik">${ç`Bu kayıt silinsin mi?`}</div>
    <div class="ortu-alt">${kacis(ç(tur))} · ${kacis(gerok.saat(k.t))}${k.metin ? ` · "${kacis(k.metin.slice(0, 60))}"` : ''}<br><br>
    ${ç`Beş saniye "Geri al" düğmesi duracak. O geçtikten sonra dönüşü yok: ses dosyası da siliniyor ve arkadaşına paket gönderdiğinde onun telefonundan da silinir.`}</div>
    <button class="eylem-dugme birincil" id="silOnay">${ç`Sil`}</button>
    <button class="eylem-dugme" id="silVazgec">${ç`Vazgeç`}</button>
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
    geriAlinabilirBildir(ç`Kayıt silindi`, () => {
      iptal = true;
      durum.kayitlar = eskiKayitlar;
      zamanCizgisiCiz();
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
    <div class="ortu-baslik">${ç`Bir satırla ne oldu?`}</div>
    <div class="ortu-alt">${ç`Tek satır yeter — sonradan açmadan ne olduğunu anlamak için.`}</div>
    <input class="girdi" id="kBaslik" value="${kacis(k.metin || '')}"
           placeholder="${ç`ör. Ohrid gölünde akşam`}" autocomplete="off" enterkeyhint="done">
    <button class="eylem-dugme birincil" id="kBaslikKaydet">${ç`Kaydet`}</button>
    <button class="eylem-dugme" id="kBaslikVazgec">${ç`Vazgeç`}</button>
  `);
  setTimeout(() => $('#kBaslik')?.focus(), 120);

  const kaydet = async () => {
    const m = $('#kBaslik').value.trim();
    ortuKapat();
    await veri.kayitEkle({ ...k, metin: m });
    kayitBildir(m ? ç`Başlık yazıldı.` : ç`Başlık silindi.`, 'iyi');
    await tazele();
  };
  $('#kBaslikKaydet').addEventListener('click', kaydet);
  $('#kBaslikVazgec').addEventListener('click', ortuKapat);
  $('#kBaslik').addEventListener('keydown', (e) => { if (e.key === 'Enter') kaydet(); });
}

/**
 * Yazılı notu düzeltir.
 *
 * Başlık kutusu değil, notu yazdığın kutunun aynısı: çok satırlı alan ve
 * yerin adı. Yazılı not tek satırlık bir etiket değil, defterin sayfası —
 * araçta sallanırken yazılan bir cümlede harf hatası olması normal ve
 * düzeltilemiyor olması sinir bozucuydu.
 *
 * Yerin adı elle değiştirilince `yerKaynagi` "elle" oluyor: internet gelince
 * çalışan adres çözücü (bkz. baglanti.js) yalnızca boş ya da duraktan gelen
 * adları değiştiriyor, senin yazdığının üstüne yazmıyor.
 */
/**
 * Sesin yazısı — okuma, düzeltme, yazma.
 *
 * WhatsApp'taki "sesi yazıya çevir" düğmesinin karşılığı, ama bir farkla ve o
 * fark dürüstçe söyleniyor: ÇEVİRME TELEFONDA OLMUYOR.
 *
 * Sebebi araştırıldı (22 Ağustos 2026): tarayıcının konuşma tanıma özelliği
 * (`webkitSpeechRecognition`) iOS'ta ana ekrana eklenmiş uygulamalarda
 * çalışmıyor ve zaten yalnızca CANLI mikrofonu dinliyor — kayıtlı bir dosyayı
 * çeviremiyor. Geriye iki yol kalıyor: sesi buluta yollamak (anahtar ister,
 * ses telefondan çıkar) ya da Mac'teki Whisper (bedava, internetsiz, hiçbir
 * şey dışarı çıkmaz). İkincisi seçildi.
 *
 * Bu yüzden düğme her zaman ELDE BİR ŞEY BIRAKIYOR: metin varsa düzeltirsin,
 * yoksa kendin yazarsın. Hiçbir şey yapmayan bir düğme olmasın.
 */
function cozumSor(id) {
  const k = durum.kayitlar.find(x => x.id === id);
  if (!k) return;
  durum.acikSatir = null;
  const varOlan = (k.yazi || '').trim();

  ortuAc(`
    <div class="ortu-baslik">${varOlan ? ç`Sesin yazısı` : ç`Yazıya çevir`}</div>
    <div class="ortu-alt">${kacis(ç(veri.TURLER[k.tur] || k.tur))} · ${
      kacis(gerok.tarihUzun(k.t))} ${kacis(gerok.saat(k.t))}${
      k.sure ? ` · ${sureYaz(k.sure)}` : ''}</div>
    ${varOlan ? `<div class="girdi-etiket">${k.yaziKaynagi === 'elle'
        ? ç`Senin düzelttiğin metin` : ç`Makinenin duyduğu — yanlış duymuş olabilir`}</div>`
      : `<div class="cozum-bilgi">${ç`Bu ses henüz çevrilmedi. <b>Çevirme Mac'te yapılıyor</b> — bedava, internetsiz, ses telefondan çıkmıyor. Bir sonraki arşivlemede kendiliğinden çevrilecek. Beklemek istemiyorsan aşağıya kendin yazabilirsin.`}</div>`}
    <textarea class="alan cozum-alan" id="cozumAlan" rows="8"
      placeholder="${ç`Bu kayıtta ne söylendi?`}">${kacis(varOlan)}</textarea>
    <button class="eylem-dugme birincil" id="cozumKaydet">${ç`Kaydet`}</button>
    ${varOlan ? `<button class="eylem-dugme sil" id="cozumSil">${ç`Yazıyı sil`}</button>` : ''}
    <button class="eylem-dugme" id="cozumVazgec">${ç`Vazgeç`}</button>
  `);
  setTimeout(() => $('#cozumAlan')?.focus(), 120);

  $('#cozumVazgec').addEventListener('click', async () => {
    ortuKapat();
    // Metni yoksa ve dokunup vazgeçtiyse: Mac'te çevrilmesini istediği
    // anlaşılıyor. İşaret paketle Mac'e gidiyor, orada önce bunlar çevriliyor.
    if (!varOlan && !k.cozumIsteniyor) {
      await veri.kayitEkle({ ...k, cozumIsteniyor: true });
      kayitBildir(ç`Sıraya alındı — bir sonraki arşivlemede çevrilecek`, 'iyi');
      await tazele();
    }
  });

  $('#cozumSil')?.addEventListener('click', async () => {
    ortuKapat();
    const { yazi, yaziKaynagi, ...kalan } = k;
    await veri.kayitEkle(kalan);
    kayitBildir(ç`Yazı silindi`);
    await tazele();
  });

  $('#cozumKaydet').addEventListener('click', async () => {
    const m = $('#cozumAlan').value.trim();
    ortuKapat();
    if (!m && !varOlan) return;
    if (!m) { const { yazi, yaziKaynagi, ...kalan } = k; await veri.kayitEkle(kalan); }
    // Elle yazılan metnin üstüne bir daha makine çıktısı YAZILMAMALI —
    // esitleme.js yalnızca boş alanı dolduruyor, bu da orada korunuyor.
    else await veri.kayitEkle({ ...k, yazi: m, yaziKaynagi: 'elle', cozumIsteniyor: undefined });
    kayitBildir(m ? ç`Yazı kaydedildi · artık aranabilir` : ç`Yazı silindi`, 'iyi');
    await tazele();
  });
}

function yaziDuzenleSor(id) {
  const k = durum.kayitlar.find(x => x.id === id);
  if (!k) return;
  durum.acikSatir = null;

  ortuAc(`
    <div class="ortu-baslik">${ç`Notu düzenle`}</div>
    <div class="ortu-alt">${ç`${gerok.tarihUzun(k.t)} · ${gerok.saat(k.t)} — saat değişmiyor.`}</div>
    <div class="girdi-etiket">${ç`Not`}</div>
    <textarea class="alan" id="yaziDuzAlan" placeholder="${ç`Ne oldu?`}">${kacis(k.metin || '')}</textarea>
    <div class="girdi-etiket">${ç`Yer (isteğe bağlı)`}</div>
    <input class="girdi" id="yaziDuzYer" value="${kacis(k.yerAdi || '')}" placeholder="${ç`Ohrid, göl kıyısı`}">
    <button class="eylem-dugme birincil" id="yaziDuzKaydet">${ç`Kaydet`}</button>
    <button class="eylem-dugme" id="yaziDuzVazgec">${ç`Vazgeç`}</button>
  `);
  setTimeout(() => $('#yaziDuzAlan')?.focus(), 120);

  $('#yaziDuzVazgec').addEventListener('click', ortuKapat);
  $('#yaziDuzKaydet').addEventListener('click', async () => {
    const m = $('#yaziDuzAlan').value.trim();
    const yer = $('#yaziDuzYer').value.trim();
    if (!m) { kayitBildir(ç`Boş not kaydedilmiyor · silmek için “Sil”`); return; }
    ortuKapat();
    const degisti = yer !== (k.yerAdi || '');
    await veri.kayitEkle({
      ...k, metin: m,
      yerAdi: yer,
      yerKaynagi: degisti ? (yer ? 'elle' : null) : k.yerKaynagi
    });
    kayitBildir(ç`Not güncellendi`, 'iyi');
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
  if (!url) { kayitBildir(ç`Ses dosyası bulunamadı.`, 'kotu'); return; }

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
    if (!blob) throw new Error(ç`dosya yok`);
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    const tampon = await ac.decodeAudioData(await blob.arrayBuffer());

    calan = { ...ortak, ac, tampon, toplam: tampon.duration };
    webAudioBaslat(baslaSaniye);

    ortak.ikon.textContent = '⏸';
    sayaciBasla(() => webAudioKonumu());
    kayitBildir(ç`Ses çözülerek çalınıyor · ${sureYaz(tampon.duration)}`);
  } catch (hata) {
    URL.revokeObjectURL(ortak.url);
    ortak.ikon.textContent = '▶';
    if (ortak.sure) ortak.sure.textContent = `0:00 / ${sureYaz(ortak.kayitliSure)}`;
    calan = null;
    kayitBildir(ç`Ses çalınamadı: ${hata.message}`, 'kotu');
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
  $('#btnSes').addEventListener('click', () => sesKaydiBaslat('ses', {
    ipucu: ç`Konuş. Ekranı kapatma.` + '\n' + ç`Bitince Durdur ve kaydet.`
  }));
  // Ortam sesi: konuşmadan, o yerin nasıl duyulduğu. Süre artık seçiliyor —
  // 30 saniye çarşı için yetiyordu ama ezan, yağmur, dalga için kısa kalıyordu.
  $('#btnOrtam').addEventListener('click', ortamSuresiSor);

  $('#btnYazi').addEventListener('click', () => yaziSor());
  $('#btnIsaret').addEventListener('click', async () => {
    const y = await kayit.isaretEkle('');
    kayitBildir(y && Number.isFinite(y.lat)
      ? ç`Burayı işaretle · ${y.lat.toFixed(2)}, ${y.lon.toFixed(2)}`
      : ç`Burayı işaretle · konum bulunamadı`);
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

  $('#btnSesDosya').addEventListener('click', () => $('#sesSecici').click());

  $('#sesSecici').addEventListener('change', async (e) => {
    if (!e.target.files.length) return;
    await sesDosyalariniAl(e.target.files);
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
          ? ç`Uydu görüntüsü internetten iniyor.`
          : ç`Uydu için internet gerekiyor — şu an bağlantı yok, görüntü gelmez.`,
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
  const ne = ç(veri.TURLER[g.tur] || 'Sesli not');

  ortuAc(`
    <div class="gs-sayac">${ç`kayıt yarıda kalmış`}</div>
    <div class="ortu-baslik">${ç`Yarım bir kayıt bulundu`}</div>
    <div class="ortu-alt">${ç`${kacis(gerok.tarihUzun(g.baslangic))} ${kacis(gerok.saat(g.baslangic))}'de başlayan ses kaydı bitmeden uygulama kapanmış. Kaydedilen kısım duruyor.`}</div>
    <div class="gs-liste-satir" style="display:flex;align-items:center;gap:12px">
      <span class="dugme-ikon" style="flex:none">${ikon('mikrofon', 22)}</span>
      <span style="flex:1;min-width:0">${kacis(ne)} · ${kacis(sureYaz(sure))}</span>
      <button class="satir-dugme" id="yarimDinle">${ç`Dinle`}</button>
    </div>
    <button class="eylem-dugme birincil" id="yarimSakla">${ç`Sakla · ${kacis(gerok.saat(g.baslangic))}'e koy`}</button>
    <button class="eylem-dugme sil" id="yarimSil">${ç`Sil`}</button>
  `, false, 'kurtarma');

  $('#yarimDinle').addEventListener('click', async () => {
    const url = await kayit.yarimKayitAdresi();
    if (!url) { kayitBildir(ç`Yarım dosya okunamadı.`, 'kotu'); return; }
    const ses = new Audio(url);
    ses.play().catch(() => kayitBildir(ç`Yarım kayıt çalınamadı — yine de saklanabilir.`, 'kotu'));
  });

  $('#yarimSakla').addEventListener('click', async () => {
    ortuKapat();
    const k = await kayit.yarimKaydiSakla();
    await tazele();
    kayitBildir(k
      ? ç`Yarım kayıt ${gerok.saat(k.t)}'e yerleştirildi.`
      : ç`Yarım dosya boş çıktı, kaydedilecek ses yoktu.`, k ? 'iyi' : 'kotu');
  });

  $('#yarimSil').addEventListener('click', async () => {
    ortuKapat();
    // Silmek beş saniye bekletiliyor: yarım kayıt ekran kapandığı için
    // kurtarılmış tek kopya, geri getirilecek bir yeri yok.
    let iptal = false;
    geriAlinabilirBildir(ç`Yarım kayıt siliniyor`, () => {
      iptal = true;
    });
    setTimeout(async () => {
      if (iptal) return;
      await kayit.yarimKaydiSil();
      kayitBildir(ç`Yarım kayıt silindi`);
    }, GERI_AL_SURESI);
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
      <div class="uyari-ad">${ç`Mikrofon izni yok`}</div>
      <div class="uyari-alt">${ç`Ses kaydı yapılamıyor. Yazı, fotoğraf ve harcama çalışmaya devam ediyor.`}</div>
      <button class="eylem-dugme birincil" id="uyariIzin">${ç`İzin ver`}</button>
    </div>`;
  }

  if (durum.konumRed) {
    html += `<div class="kayit-uyari izin">
      <div class="uyari-ad">${ç`Konum izni yok`}</div>
      <div class="uyari-alt">${ç`Kayıtlar tutulur, yerleri boş kalır. Sonradan haritada elle işaretleyebilirsin.`}</div>
      <button class="eylem-dugme birincil" id="uyariKonum">${ç`İzin ver`}</button>
    </div>`;
  }

  if (azYer) {
    html += `<div class="kayit-uyari depo">
      <div class="uyari-ad">${ç`Yer azalıyor`}</div>
      <div class="uyari-alt">${ç`${boyutYaz(bosYer)} boş yer kaldı. Uzun kayıt ve yedek için harita paketini silebilirsin — sonra yeniden indirilir.`}</div>
      <button class="eylem-dugme" id="uyariDepo">${ç`Nasıl yer açarım?`}</button>
    </div>`;
  }

  kap.innerHTML = html;

  // Yalnızca okunacak bir açıklama penceresi: aç, tek düğmeyle kapat.
  const bilgiOrtu = (ic) => {
    ortuAc(ic);
    $('#uyariKapat')?.addEventListener('click', ortuKapat);
  };

  $('#uyariKonum')?.addEventListener('click', () =>
    kayitBildir(ç`Ayarlar → Gerok → Konum → Uygulamayı kullanırken`));

  $('#uyariIzin')?.addEventListener('click', () => bilgiOrtu(`
    <div class="ortu-baslik">${ç`Mikrofon izni`}</div>
    <div class="ortu-alt">
      ${ç`Ana ekrandaki simgeden açtıysan:<br><b>Ayarlar → Gerok → Mikrofon → İzin ver</b><br><br>Safari sekmesinden açtıysan:<br><b>Ayarlar → Safari → Mikrofon → İzin ver</b><br><br>İzni verdikten sonra uygulamayı tamamen kapat (kartı yukarı kaydır) ve yeniden aç. İzin, uygulama açıkken değişmiyor.`}
    </div>
    <button class="eylem-dugme birincil" id="uyariKapat">${ç`Anladım`}</button>
  `));

  $('#uyariDepo')?.addEventListener('click', () => bilgiOrtu(`
    <div class="ortu-baslik">${ç`Yer açmak`}</div>
    <div class="ortu-alt">
      ${ç`Sırayla:<br><br>1 · Önce <b>yedek al</b> (Gerok → eşitleme). Silmeden önce her zaman yedek.<br>2 · Harita paketini sil (Gerok → bu telefon). Sonra yeniden indirilebilir.<br>3 · Videolar uygulamada değil <b>galeride</b> duruyor. Yeri onlar kaplıyorsa Fotoğraflar uygulamasından temizle.`}
    </div>
    <button class="eylem-dugme birincil" id="uyariKapat">${ç`Anladım`}</button>
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
    if (!kayit.sesDevam()) { kayitBildir(ç`Devam ettirilemedi.`, 'kotu'); return; }
    $('#sesKatman').classList.remove('durakli');
    dugme.textContent = ç`⏸ Duraklat`;
    dugme.classList.remove('birincil');
    // Kayıt sürerken asıl eylem yine "Durdur ve kaydet".
    $('#sesDurdur').classList.add('birincil');
    $('#sesIpucu').textContent = o.ipucu;
    titret(12);
  } else {
    if (!kayit.sesDuraklat()) { kayitBildir(ç`Duraklatılamadı.`, 'kotu'); return; }
    $('#sesKatman').classList.add('durakli');
    dugme.textContent = ç`▶ Devam et`;
    dugme.classList.add('birincil');
    // Duraklıyken asıl eylem "Devam et". İki düğme birden vurgulu olunca
    // hangisine basılacağı bir anda anlaşılmıyordu (ekran görüntüsünde
    // ikisi de kahverengi çıktı) — tek vurgulu düğme kalsın.
    $('#sesDurdur').classList.remove('birincil');
    $('#sesIpucu').textContent = ç`Devam edince aynı dosyanın içinden sürer.`;
    titret([8, 40, 8]);
  }
}

// tur: kaydın türü · sinir: saniye (0 = sınırsız) · ipucu: katmanda yazan satır
export async function sesKaydiBaslat(tur, { sinir = 0, ipucu = ç`Konuş — bitince "Durdur ve kaydet"`, bittiginde = null, baslikSor = true, ekler = null } = {}) {
  if (sesOturum) return;
  const o = { tur, iptal: false, kapandi: false, sayac: null, bittiginde, baslikSor, ekler, ipucu };
  sesOturum = o;

  $('#sesKatman').classList.remove('gizli');
  $('#sesKatman').classList.remove('durakli');
  $('#sesTuru').textContent = ç(veri.TURLER[tur] || 'Kayıt');
  $('#sesSure').textContent = sinir ? sureYaz(sinir) : '0:00';
  $('#sesIpucu').textContent = ç`Mikrofon açılıyor…`;
  // İlerleme yayı yalnızca süresi belli kayıtlarda anlamlı.
  $('#sesIlerleme').classList.toggle('gizli', !sinir);
  $('#sesIlerleme').style.setProperty('--dolu', '0deg');
  $('#sesDurdur').disabled = true;
  $('#sesDurdur').classList.add('birincil');

  // Duraklatma her tarayıcıda yok; olmayan yerde düğmeyi hiç gösterme —
  // basınca hiçbir şey olmayan bir düğme, bozuk bir düğmedir.
  const durDugme = $('#sesDuraklat');
  durDugme.textContent = ç`⏸ Duraklat`;
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
      ? ç`Mikrofon izni yok · Ayarlar → Gerok → Mikrofon`
      : ç`Mikrofon açılamadı: ${hata?.message || ç`bilinmeyen sebep`}`, 'kotu');
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
  o.ipucu = kilitli ? ipucu : ipucu + '\n' + ç`Ekranı kapatma — kayıt kesilir.`;
  $('#sesIpucu').textContent = o.ipucu;
  $('#sesDurdur').disabled = false;
  $('#sesDuraklat').disabled = false;
  titret(12);

  o.sayac = setInterval(() => {
    const gecen = kayit.sesSuresi();
    $('#sesSure').textContent = sureYaz(sinir ? Math.max(0, sinir - gecen) : gecen);
    if (sinir) {
      const oran = Math.min(1, gecen / sinir);
      $('#sesIlerleme').style.setProperty('--dolu', `${(oran * 360).toFixed(1)}deg`);
    }
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
        ? ç`KAYIT EDİLEMEDİ: ekran kapalıyken iOS kaydı kesmiş. Kayıt sırasında ekranı açık tut ya da Yol Modu'nu aç — o ekranı söndürmüyor.`
      : hata.yazilamadi
        ? ç`KAYIT EDİLEMEDİ: ${hata.message}. Telefonda yer kalmamış olabilir — Gerok sekmesinden yer durumuna bak, yedek al ve eski kayıtları temizle.`
        : ç`KAYIT EDİLEMEDİ: ${hata.message}. Telefonda yer kalmamış olabilir.`,
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
      : ç`zaman çizgisinin başında · ${gerok.tarihUzun(k.t)}`;
    kayitBildir(`Kaydedildi · ${sureYaz(k.sure)} → ${nere}`, 'iyi');
    const d = $('#kayitDurum');
    if (d) d.textContent = ç`Kaydedildi · zaman çizgisine düştü`;
    titret([8, 40, 8]);
    await tazele();
    // Kaydın ne olduğunu şimdi sor. Gezide çıkan sorun: zaman çizgisinde
    // 82 tane aynı görünen ses kartı vardı, hangisinin ne olduğunu anlamak
    // için tek tek açmak gerekiyordu. Tek satır başlık bunu bitiriyor.
    if (o.baslikSor !== false) await sesBasligiSor(k);
  } else {
    kayitBildir(ç`Çok kısaydı, kaydedilmedi.`);
  }
  await o.bittiginde?.(k);
}

// Ortam sesi süreleri. Son seçilen hatırlanıyor: aynı gezide genelde aynı
// süre kullanılıyor, her seferinde seçtirmek gereksiz dokunuş olurdu.
const ORTAM_SURELERI = [
  { sn: 15,  ad: ç`15 saniye`, alt: ç`kısa bir an` },
  { sn: 30,  ad: ç`30 saniye`, alt: ç`çarşı, sokak` },
  { sn: 60,  ad: ç`1 dakika`,  alt: ç`ezan, müzik` },
  { sn: 120, ad: ç`2 dakika`,  alt: ç`yağmur, dalga, tren` },
  { sn: 0,   ad: ç`Elle durduracağım`, alt: ç`ne kadar sürerse` }
];

async function ortamSuresiSor() {
  // Ortam sesi kayıtların en ağırı ve en sessiz yer yiyeni: iki dakikalık bir
  // kayıt ~24 MB. Yer bittiğinde kayıt yarıda kesiliyor ve o an bir daha
  // gelmiyor — bu yüzden uyarı kaydın ÖNÜNDE, sonrasında değil.
  const d = await veri.depolamaDurumu();
  if (d?.kota && (d.kota - d.kullanilan) < AZ_YER_ESIGI) {
    kayitBildir(ç`Ortam sesi 2 dakikada ~24 MB · önce yer aç`, 'kotu');
  }
  const son = await veri.ayarOku('ortamSuresi', 30);
  ortuAc(`
    <div class="ortu-baslik">${ç`Ne kadar sürsün?`}</div>
    <div class="ortu-alt">${ç`Konuşmayacaksın — o yerin nasıl duyulduğunu kaydediyorsun.`}</div>
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
        ipucu: ç`Telefonu sesin geldiği yöne çevir.` + '\n' + (sn
          ? ç`Konuşma, sadece dinlet.`
          : ç`Bitince Durdur ve kaydet.`)
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
      <div class="ortu-baslik">${ç`Bir satırla ne oldu?`}</div>
      <div class="ortu-alt">${ç`Tek satır yeter. Sonra açmadan ne olduğunu bilirsin.`}</div>
      <input class="girdi" id="sesBaslik" placeholder="${ç`Ohrid'de rehberin anlattığı…`}"
             autocomplete="off" enterkeyhint="done">
      <button class="eylem-dugme birincil" id="sesBaslikKaydet">${ç`Kaydet`}</button>
      <button class="eylem-dugme" id="sesBaslikAtla">${ç`Atla`}</button>
    `);
    setTimeout(() => $('#sesBaslik')?.focus(), 120);

    const kapat = async (yaz) => {
      const m = yaz ? $('#sesBaslik').value.trim() : '';
      ortuKapat();
      if (m) {
        await veri.kayitEkle({ ...k, metin: m });
        await tazele();
      }
      kayitBildir(m
        ? ç`Kaydedildi · ${gerok.tarihUzun(k.t)} ${gerok.saat(k.t)}`
        : ç`Kaydedildi · başlıksız`, 'iyi');
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
  kayitBildir(ç`Kayıt silindi`);
}

function sesDugmeleriniKur() {
  $('#sesDurdur').addEventListener('click', sesKaydiBitir);
  $('#sesVazgec').addEventListener('click', sesKaydiVazgec);
  $('#sesDuraklat').addEventListener('click', sesDuraklatDegistir);
}

async function fotograflariAl(dosyalar, tur = null) {
  const toplam = Array.from(dosyalar).length;
  if (!toplam) return;

  let iptal = false;
  const basladi = Date.now();

  ortuAc(`
    <div class="ortu-baslik">${ç`Görseller alınıyor`}</div>
    <div class="ilerleme-yol"><div class="ilerleme-dolu" id="fotoCubuk"></div></div>
    <div class="ilerleme-satir">
      <span id="fotoSayi">0 / ${toplam}</span>
      <span id="fotoKalan"></span>
    </div>
    <div class="ilerleme-dosya" id="fotoDosya">${ç`başlıyor…`}</div>
    <div class="panel-not">${ç`Orijinaller galeride kalıyor — buraya küçük bir önizleme, çekilme saati ve konum yazılıyor. Büyük fotoğraflarda her biri birkaç saniye sürebilir.`}</div>
    <button class="eylem-dugme" id="fotoDurdur">${ç`Durdur`}</button>
  `, false);

  $('#fotoDurdur').addEventListener('click', () => {
    iptal = true;
    $('#fotoDurdur').disabled = true;
    $('#fotoDosya').textContent = ç`bu dosya bitince duracak…`;
  });

  let eklenen = [];
  try {
    eklenen = await kayit.fotoAl(dosyalar, (yapilan, hepsi, ad) => {
      const yuzde = Math.round(yapilan / hepsi * 100);
      const cubuk = $('#fotoCubuk'); if (cubuk) cubuk.style.width = `${yuzde}%`;
      const sayi = $('#fotoSayi'); if (sayi) sayi.textContent = `${yapilan} / ${hepsi}`;
      const dosya = $('#fotoDosya'); if (dosya && !iptal) dosya.textContent = ad || '…';

      // Kalan süre ilk üç dosyadan sonra tahmin ediliyor: ilk dosya her zaman
      // ötekilerden yavaş (iCloud'dan inmesi gerekebiliyor), tek örnekten
      // yapılan tahmin gülünç sayılar veriyordu.
      const kalanYer = $('#fotoKalan');
      if (kalanYer && yapilan >= 3) {
        const basina = (Date.now() - basladi) / yapilan;
        kalanYer.textContent = kalanSureYaz(basina * (hepsi - yapilan));
      }
    }, tur, () => iptal) || [];
  } catch (hata) {
    ortuKapat();
    kayitBildir(ç`Görseller alınamadı: ${hata.message}`, 'kotu');
    return;
  }

  await tazele();
  fotoOzetiAc(eklenen, toplam, iptal);
}

function kalanSureYaz(ms) {
  const sn = Math.round(ms / 1000);
  if (sn < 5) return ç`birazdan biter`;
  if (sn < 60) return ç`yaklaşık ${sn} saniye kaldı`;
  const dk = Math.round(sn / 60);
  return ç`yaklaşık ${dk} dakika kaldı`;
}

/**
 * Aktarım bitince ne olduğunu SÖYLEYEN kart.
 *
 * Eskiden örtü sessizce kapanıp yerine birkaç saniyelik bir şerit çıkıyordu.
 * 39 fotoğraf ekleyen biri o şeridi kaçırıyor ve "geldi mi?" diye soruyordu —
 * nitekim soruldu. Kart kendiliğinden kapanmıyor.
 *
 * Fotoğrafın zaman çizgisinde NEREYE düştüğünü söylemek şart: fotoğraf
 * eklendiği ana değil ÇEKİLDİĞİ ana yerleşiyor (doğrusu da bu). Akşam 20:47'de
 * eklenen, öğleden sonra çekilmiş bir kare listede saatlerce YUKARIDA beliriyor;
 * aşağıya bakan kişi "gelmedi" sanıyor. Gerçek kayıtlarda fark 12 dakika ile
 * 22 saat arasında değişiyordu.
 */
/**
 * Telefonda duran ses dosyalarını deftere ekler. Fotoğraf aktarımının aynısı,
 * daha sade: önizleme üretilmiyor, o yüzden hızlı.
 */
async function sesDosyalariniAl(dosyalar) {
  const toplam = Array.from(dosyalar).length;
  if (!toplam) return;
  let iptal = false;

  ortuAc(`
    <div class="ortu-baslik">${ç`Ses dosyaları alınıyor`}</div>
    <div class="ilerleme-yol"><div class="ilerleme-dolu" id="sesCubuk"></div></div>
    <div class="ilerleme-satir"><span id="sesSayi">0 / ${toplam}</span></div>
    <div class="ilerleme-dosya" id="sesDosyaAd">${ç`başlıyor…`}</div>
    <div class="panel-not">${ç`Ses dosyasının kendisi deftere kopyalanıyor — kaynaktan silsen de burada kalır. Dosyalarda çekim saati bulunmadığı için tarih dosyanın kendi tarihinden alınıyor; sonra sana sorulacak.`}</div>
    <button class="eylem-dugme" id="sesDurdur">${ç`Durdur`}</button>
  `, false);

  $('#sesDurdur').addEventListener('click', () => {
    iptal = true;
    $('#sesDurdur').disabled = true;
  });

  let eklenen = [];
  try {
    eklenen = await kayit.sesDosyasiAl(dosyalar, (yapilan, hepsi, ad) => {
      const c = $('#sesCubuk'); if (c) c.style.width = `${Math.round(yapilan / hepsi * 100)}%`;
      const n = $('#sesSayi'); if (n) n.textContent = `${yapilan} / ${hepsi}`;
      const d = $('#sesDosyaAd'); if (d && !iptal) d.textContent = ad || '…';
    }, () => iptal) || [];
  } catch (hata) {
    ortuKapat();
    kayitBildir(ç`Ses dosyaları alınamadı: ${hata.message}`, 'kotu');
    return;
  }

  await tazele();
  const atlanan = kayit.sonBasarisizlar();
  if (!eklenen.length) {
    ortuKapat();
    kayitBildir(ç`Hiçbir ses dosyası eklenemedi (${toplam} dosya denendi).`, 'kotu');
    return;
  }
  kayitBildir(ç`${eklenen.length} ses dosyası eklendi` +
    (atlanan.length ? ç` · ${atlanan.length} tanesi alınamadı` : ''), 'iyi');
  eksikBilgiSor(eklenen);
}

/**
 * Tarihi ya da yeri olmayan kayıtlar için tek bir soru. CEVAP İSTEĞE BAĞLI —
 * "Geç" düğmesi her zaman duruyor ve boş bırakmak bir şeyi bozmuyor.
 *
 * Neden gerekli: WhatsApp'tan gelen fotoğrafta çekim saati de konum da
 * silinmiş oluyor. Elimizde kalan dosyanın indirilme tarihi — yani yanlış
 * bir sayı. Bunu sessizce doğruymuş gibi yazmak, on yıl sonra güvenilecek
 * tek şeyi bozar. Sormak, uydurmaktan iyidir.
 *
 * Saat DEĞİŞTİRİLMİYOR, yalnızca gün: kullanıcının bildiği şey gündür.
 */
function eksikBilgiSor(kayitlar, sonra = null) {
  const eksik = kayit.bilgisiEksikler(kayitlar || []);
  const bitir = () => { ortuKapat(); sonra?.(); };
  if (!eksik.length) return bitir();

  const tarihsiz = eksik.filter(k => k.zamanKaynagi === 'dosya').length;
  const yersiz = eksik.filter(k => k.lat == null).length;

  // Varsayılan tarih: eldeki en eski kaydın günü. Kullanıcı çoğu zaman
  // bunu birkaç gün geri alacak, sıfırdan yazmayacak.
  const enEski = eksik.reduce((a, k) => Math.min(a, k.t), Infinity);
  const g = new Date(Number.isFinite(enEski) ? enEski : Date.now());
  const iso = `${g.getFullYear()}-${String(g.getMonth() + 1).padStart(2, '0')}-${String(g.getDate()).padStart(2, '0')}`;

  ortuAc(`
    <div class="ortu-baslik">${ç`Ne zaman ve nerede?`}</div>
    <div class="ortu-alt">${
      tarihsiz && yersiz
        ? ç`${eksik.length} kayıtta çekim tarihi ya da konum yok — WhatsApp'tan gelen dosyalarda bunlar silinmiş olur.`
        : tarihsiz
          ? ç`${tarihsiz} kayıtta çekim tarihi yok; şimdilik dosyanın kendi tarihi yazılı.`
          : ç`${yersiz} kayıtta konum yok.`
    }</div>
    <div class="panel-not">${ç`İstersen boş bırak — hiçbir şey bozulmaz, sonra da yazabilirsin.`}</div>
    ${tarihsiz ? `<div class="girdi-etiket">${ç`Hangi gün?`}</div>
      <input class="girdi" type="date" id="ebTarih" value="${iso}">` : ''}
    ${yersiz ? `<div class="girdi-etiket">${ç`Neredeydi?`}</div>
      <input class="girdi" type="text" id="ebYer" placeholder="${kacis(ç`Ohrid, göl kıyısı`)}">` : ''}
    <button class="eylem-dugme birincil" id="ebYaz">${ç`Yaz`}</button>
    <button class="eylem-dugme" id="ebGec">${ç`Geç`}</button>
  `, true, 'eksikbilgi');

  $('#ebGec').addEventListener('click', bitir);
  $('#ebYaz').addEventListener('click', async () => {
    const tarihAlan = $('#ebTarih');
    const yerAlan = $('#ebYer');
    // Tarih alanına dokunulmadıysa yazmıyoruz: varsayılan değer bir tahmindi,
    // onaylanmadan gerçekmiş gibi kaydedilmemeli.
    const t = (tarihAlan && tarihAlan.value && tarihAlan.value !== iso)
      ? new Date(`${tarihAlan.value}T12:00:00`).getTime() : null;
    const yer = yerAlan ? yerAlan.value : '';
    const sayi = await kayit.bilgiTamamla(eksik, { t, yerAdi: yer });
    bitir();
    await tazele();
    if (sayi) kayitBildir(ç`${sayi} kayıt güncellendi`, 'iyi');
  });
}

function fotoOzetiAc(eklenen, istenen, iptal) {
  const atlanan = kayit.sonBasarisizlar();
  // Videoların önizlemesi zaten alınamıyor (iOS geçerli videodan da kare
  // vermiyor); onları "sorun" diye saymak yanlış alarm olurdu.
  const resimsiz = kayit.sonOnizlemesizler()
    .filter(ad => !/\.(mov|mp4|m4v|avi|hevc)$/i.test(ad));
  const liste = (eklenen || []).filter(k => k?.t).sort((a, b) => a.t - b.t);

  if (!liste.length) {
    ortuKapat();
    kayitBildir(iptal ? ç`Durduruldu, hiçbir şey eklenmedi.`
      : ç`Hiçbir görsel eklenemedi (${istenen} dosya denendi).`, 'kotu');
    return;
  }

  const video = liste.filter(k => k.tur === 'video').length;
  const foto = liste.length - video;
  // Konumsuzları YALNIZCA yeni eklenenler arasında sayıyoruz. Eskiden bütün
  // zaman çizgisine bakılıyordu; 39 fotoğraf ekleyen biri "77 tanesinin yeri
  // bulunamadı" yazısını görüyordu ve bunun kendi eklediklerine dair olduğunu
  // sanıyordu.
  const konumsuz = liste.filter(k => k.lat == null).length;

  const ilk = liste[0], son = liste[liste.length - 1];
  const ayniGun = new Date(ilk.t).toDateString() === new Date(son.t).toDateString();
  const nereye = liste.length === 1 || ilk.t === son.t
    ? `${gerok.tarihUzun(ilk.t)} ${gerok.saat(ilk.t)}`
    : ayniGun
      ? `${gerok.tarihUzun(ilk.t)} ${gerok.saat(ilk.t)} – ${gerok.saat(son.t)}`
      : `${gerok.tarihUzun(ilk.t)} ${gerok.saat(ilk.t)} – ${gerok.tarihUzun(son.t)} ${gerok.saat(son.t)}`;

  const satir = (etiket, deger, sinif = '') =>
    `<div class="ozet-satir ${sinif}"><span>${etiket}</span><span>${deger}</span></div>`;

  ortuAc(`
    <div class="ortu-baslik">${ç`${liste.length} görsel eklendi`}</div>
    ${iptal ? `<div class="ortu-alt">${ç`Sen durdurdun — ${istenen} dosyadan ${liste.length} tanesi alındı.`}</div>` : ''}
    <div class="ozet-kutu">
      ${foto ? satir(ç`Fotoğraf`, foto) : ''}
      ${video ? satir(ç`Video`, video) : ''}
      ${liste.length - konumsuz ? satir(ç`Yeri bulunan`, liste.length - konumsuz) : ''}
      ${konumsuz ? satir(ç`Yeri bulunamayan`, konumsuz, 'soluk') : ''}
      ${resimsiz.length ? satir(ç`Önizlemesi çıkmayan`, resimsiz.length, 'soluk') : ''}
      ${atlanan.length ? satir(ç`Alınamayan`, atlanan.length, 'kotu') : ''}
    </div>
    <div class="ozet-nereye">
      <span class="ozet-etiket">${ç`Zaman çizgisinde`}</span>
      ${ç`${kacis(nereye)} hizasına yerleşti`}
      <span class="ozet-ipucu">${ç`Fotoğraflar eklendikleri saate değil, çekildikleri saate oturuyor — listede yukarıda olabilirler.`}</span>
    </div>
    ${konumsuz ? `<div class="ozet-ipucu tek">${ç`${konumsuz} görselin yeri bulunamadı: fotoğrafta konum yok ve iz kaydı o saatte kapalıymış. Haritada elle iğneleyebilirsin.`}</div>` : ''}
    ${resimsiz.length ? `<div class="ozet-ipucu tek">${resimsiz.length}
      ${ç`dosyanın önizlemesi çıkmadı — zaman çizgisinde resimsiz görünecekler. Saatleri ve yerleri duruyor, "Fotoğrafları aç" düğmesi galeride o ana götürüyor.`}</div>` : ''}
    ${atlanan.length ? `<div class="ozet-ipucu tek kotu">${ç`Alınamayanlar:`}
      ${kacis(atlanan.slice(0, 6).join(', '))}${atlanan.length > 6
        ? ç` ve ${atlanan.length - 6} tane daha` : ''}</div>` : ''}
    <button class="eylem-dugme birincil" id="ozetGoster">${ç`Zaman çizgisinde göster`}</button>
    <button class="eylem-dugme" id="ozetKapat">${ç`Tamam`}</button>
  `, true, 'ozet');

  $('#ozetKapat').addEventListener('click', () => eksikBilgiSor(liste));
  $('#ozetGoster').addEventListener('click', () => {
    eksikBilgiSor(liste, () => { ekranAc('zaman'); fotografaGit(ilk.id); });
  });
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
      $('#izYazi').textContent = ç`izin yok`;
      $('#izRozet').classList.remove('acik');
      if (olay.kod === 1 && !durum.konumRed) {
        durum.konumRed = true;
        kayitUyarilariniCiz();
      }
    }
    if (olay.tur === 'nokta') {
      durum.izNoktalari.push(olay.nokta);
      izRozetiYaz();
      if (durum.ekran === 'harita') haritaGuncelle(durum.kayitlar, durum.izNoktalari);
      await ulkeKontrol(olay.nokta);
    }
    if (olay.tur === 'konum' && durum.yolModu) {
      onSeziKontrol(olay.lat, olay.lon);
      yaklasmaKontrol(olay.lat, olay.lon);
    }
  });
}

function izRozetiYaz() {
  const r = $('#izRozet');
  const calisiyor = iz.calisiyorMu();
  r.classList.toggle('acik', calisiyor && !iz.tasarruftaMi());
  r.classList.toggle('tasarruf', calisiyor && iz.tasarruftaMi());
  $('#izYazi').textContent = !calisiyor ? ç`kapalı`
    : iz.tasarruftaMi() ? ç`tasarruf · ${durum.izNoktalari.length}`
      : `${durum.izNoktalari.length}`;
}

function izRozetTikla() {
  if (iz.calisiyorMu()) {
    iz.dur();
    kayitBildir(ç`İz kaydı kapatıldı`);
  } else {
    iz.basla();
    kayitBildir(ç`İz kaydı açıldı`);
  }
  izRozetiYaz();
}

// Sınır geçişini kendiliğinden zaman çizgisine yazar.
//
// DİKKAT — yeni ülke işareti ilk beklemeden ÖNCE konuyor. Konum noktaları peş
// peşe gelebiliyor; işaret en sona konsaydı iki nokta da eski değeri görür ve
// aynı sınır iki kez yazılırdı. (11.08 20:01:47'de tam bu oldu.)
async function ulkeKontrol(nokta) {
  const u = gerok.ulkeBul(nokta.lat, nokta.lon);
  if (!u) return;
  if (durum.sonUlke === u.kod) return;

  const onceki = durum.sonUlke;
  durum.sonUlke = u.kod;

  try {
    if (onceki) {
      await kayit.sinirEkle(u.kod, u.ad, nokta.t, nokta.lat, nokta.lon);
      bildirimGoster(`${u.bayrak} ${ç(u.ad)}`, ç`Yeni ülkeye girdin — zaman çizgisine işlendi.`);
      titret([10, 60, 10, 60, 10]);
      await tazele();
    }
    await veri.ayarYaz('sonUlke', u.kod);
  } catch (e) {
    // Yazılamadıysa işareti geri al, bir sonraki konum noktası tekrar denesin.
    durum.sonUlke = onceki;
    console.warn('sınır geçişi yazılamadı', e);
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
// `notEkle` yalnızca duraklar listesinde açık. Alttaki dört düğme (Gitmedik,
// Düzenle, Sil, G) dolu olduğu için "Not yaz" oraya sığmıyordu; notların
// zaten durduğu yere, listenin sonuna küçük bir satır olarak kondu.
function kendiNotlari(d, notEkle = false) {
  const ekle = notEkle
    ? `<button class="not-ekle-satir" data-not-ekle="${d.id}">${ç`+ not yaz`}</button>` : '';
  if (!d.notlar?.length) return ekle;
  return `<ul class="unutma kendi">${d.notlar.map(n => `
    <li>
      <div class="not-govde">
        <span class="not-metin">${kacis(n.metin)}</span>
        ${n.sahipAd ? `<span class="not-kim">${kacis(n.sahipAd)}</span>` : ''}
      </div>
      <button class="not-sil" data-not-sil="${n.id}" data-not-durak="${d.id}"
              title="${ç`Notu sil`}" aria-label="${ç`Notu sil`}">✕</button>
    </li>`).join('')}</ul>${ekle}`;
}

/**
 * Beş yıldız — dikey sütun, kartın sağ kenarında.
 *
 * Yatayken kartın altına bir satır daha ekliyordu; 26 duraklık listede her
 * kart o kadar uzuyordu. Dikey sütun, unutma listesinin yanındaki boş alanda
 * duruyor — kart hiç uzamıyor. En üstteki yıldız 5, en alttaki 1: aşağıdan
 * yukarı dolan bir çubuk gibi.
 */
function yildizSutunu(d) {
  return `<div class="puan dikey" data-puan-durak="${d.id}">
    ${[5, 4, 3, 2, 1].map(n => `
      <button class="yildiz ${(d.puan || 0) >= n ? 'dolu' : ''}" data-puan="${n}"
              aria-label="${n} yıldız">★</button>`).join('')}
    <span class="puan-yazi">${d.puan ? `${d.puan}/5` : '—'}</span>
  </div>`;
}

/** Aynı yıldızların yatay hâli — harita üstündeki dar durak kartında. */
function yildizSatiri(d) {
  return `<div class="puan" data-puan-durak="${d.id}">
    ${[1, 2, 3, 4, 5].map(n => `
      <button class="yildiz ${(d.puan || 0) >= n ? 'dolu' : ''}" data-puan="${n}"
              aria-label="${n} yıldız">★</button>`).join('')}
    <span class="puan-yazi">${d.puan ? `${d.puan}/5` : ç`puanın`}</span>
  </div>`;
}

/** Durağa yeni not yazma penceresi. */
function durakNotuSor(id, sonra = null) {
  const d = gerok.durakBul(id);
  if (!d) return;
  ortuAc(`
    <div class="ortu-baslik">${kacis(d.ad)}</div>
    <div class="ortu-alt">${ç`Buraya gelince ne yapmalı? Kendi notun — akşam eşitlemesinde arkadaşının telefonuna da geçer.`}</div>
    <textarea class="alan" id="durakNot"
      placeholder="${ç`Örn. Tarçınlı tatlıyı saat kulesinin yanındaki dükkândan al.`}"></textarea>
    <button class="eylem-dugme birincil" id="durakNotKaydet">${ç`Kaydet`}</button>
    <button class="eylem-dugme" id="durakNotVaz">${ç`Vazgeç`}</button>
  `);
  setTimeout(() => $('#durakNot')?.focus(), 120);
  $('#durakNotVaz').addEventListener('click', () => { ortuKapat(); sonra?.(); });
  $('#durakNotKaydet').addEventListener('click', async () => {
    const m = $('#durakNot').value.trim();
    ortuKapat();
    if (m) {
      await gerok.durakNotEkle(id, m, kayit.sahipAl().ad || '');
      kayitBildir(ç`Not eklendi.`, 'iyi');
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
      const durakId = b.dataset.notDurak, notId = b.dataset.notSil;
      await gerok.durakNotSil(durakId, notId);
      geriAlinabilirBildir(ç`Not silindi`, async () => {
        await gerok.durakNotGeriAl(durakId, notId);
        await tazele();
        sonra?.();
      });
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

// Ekleme anını kaçırmış duraklar için tek seferlik tarama.
//
// Soru yalnızca durak EKLENİRKEN çıkıyor. Daha önce eklenmiş ya da o anda
// bir hata yüzünden sorulamamış durakların kartı hiç istenmiyordu. Duraklar
// ekranına girmek bunu sormak için doğru an: zaten listeye bakıyorsun.
let duraklarTarandi = false;

function duraklariCiz() {
  const kap = $('#duraklarListe');
  const liste = gerok.duraklar();
  const bugun = gerok.bugununGunu();
  const s = gerok.aktifGerok();

  if (!liste.length) {
    kap.innerHTML = bosDurum('yolBos',
      ç`Henüz durak yok.<br>Haritadaki iğne düğmesine basıp kendi duraklarını koyabilirsin —<br>gerok paketi olmadan da çalışır.`) +
      `<div class="daha-eski"><button class="eylem-dugme birincil" id="durakEkleBos">${ç`Haritadan durak ekle`}</button></div>`;
    $('#durakEkleBos').addEventListener('click', haritadanDurakEkle);
    return;
  }

  const konum = iz.sonBilinenKonum();

  // Gün gün başlıklar — rota da zaten gün gün renkleniyor.
  let html = `<div class="durak-ekle-satir">
    <button class="eylem-dugme" id="durakEkleHarita">${ç`Haritadan durak koy`}</button>
    <button class="eylem-dugme" id="durakEkleBurada">${ç`Burayı durak yap`}</button>
  </div>`;

  let sonGun = Symbol('yok');
  liste.forEach((d, i) => {
    if (d.gun !== sonGun) {
      sonGun = d.gun;
      const gunBilgi = s?.gunler?.find(g => g.no === d.gun);
      html += `<div class="gun-basligi">
        <div class="gun-no">${d.gun == null ? ç`Günsüz` : ç`Gün ${d.gun}`}${bugun && d.gun === bugun.no ? ' · ' + ç`BUGÜN` : ''}</div>
        ${gunBilgi ? `<div class="gun-ad">${kacis(gunBilgi.baslik)}</div>` : ''}
      </div>`;
    }

    const dur = durum.durakDurumlari[d.id]?.durum;
    const tikler = durum.durakDurumlari[d.id]?.tikler || [];
    const uzaklik = konum ? iz.mesafe(konum.lat, konum.lon, d.lat, d.lon) : null;
    const kendi = d.kaynak === 'kendi';

    html += `<div class="durak-kart ${dur || ''}" data-durak="${d.id}">
      <div class="durak-ust">
        <div class="durak-ad"><span class="durak-no">${i + 1}</span>${kacis(d.ad)}</div>
        <div class="durak-sira">
          <button class="sira-dugme" data-tasi="-1" title="${ç`Yukarı`}">↑</button>
          <button class="sira-dugme" data-tasi="1" title="${ç`Aşağı`}">↓</button>
        </div>
      </div>
      ${uzaklik != null ? `<div class="durak-uzaklik">${ç`${uzaklikYaz(uzaklik)} uzakta`}${kendi ? ' · ' + ç`kendi durağın` : ''}${d.gunTasindi ? ' · ' + ç`başka güne taşındı` : ''}</div>`
                        : (kendi || d.gunTasindi) ? `<div class="durak-uzaklik">${kendi ? ç`kendi durağın` : ''}${kendi && d.gunTasindi ? ' · ' : ''}${d.gunTasindi ? ç`başka güne taşındı` : ''}</div>` : ''}
      ${d.osmBilgi && d.osmBilgi !== '\u2014'
        ? `<div class="durak-osm" title="${ç`OpenStreetMap'ten geldi`}">${kacis(d.osmBilgi)}</div>` : ''}
      <div class="durak-govde">
        <div class="durak-liste">
          ${d.unutma?.length ? `<ul class="unutma">${d.unutma.map((u, ui) => {
            // Unutma listesi artık işaretlenebiliyor. Bir listenin tek işi
            // "hangisini yaptım" sorusunu cevaplamak; okunup geçilen bir liste
            // ikinci kez okununca baştan başlatıyordu.
            const tik = tikler.includes(ui);
            return `<li><button class="unutma-tik${tik ? ' tikli' : ''}"
              data-tik="${d.id}" data-tik-no="${ui}">
              <span class="tik-kutu">${tik ? '✓' : ''}</span>
              <span class="tik-yazi">${kacis(u)}</span></button></li>`;
          }).join('')}</ul>` : ''}
          ${kendiNotlari(d, true)}
        </div>
        ${yildizSutunu(d)}
      </div>
      <div class="durak-dugmeler">
        <button class="kucuk-dugme gidis-dugme ${dur === 'gidildi' ? 'gidildi' : 'gidilmedi'}"
                data-gidis="${d.id}">${dur === 'gidildi' ? ç`Gittik` : ç`Gitmedik`}</button>
        <button class="kucuk-dugme" data-duzenle="${d.id}">${ç`Düzenle`}</button>
        <button class="kucuk-dugme sil" data-durak-sil="${d.id}">${ç`Sil`}</button>
        <button class="kucuk-dugme g-dugme" data-durak-google="${d.id}"
                title="${ç`Google Haritalar'da aç`}" aria-label="${ç`Google Haritalar'da aç`}">G</button>
      </div>
    </div>`;
  });

  // Silinen duraklar geri getirilebiliyor. Gezi programı yeniden yazılamaz;
  // 26 kartlık listede yanlış düğmeye basmak ise kolay.
  const silinmis = gerok.silinmisDuraklar();
  if (silinmis.length) {
    html += `<div class="silinmis-alan">
      <div class="silinmis-baslik">${ç`Silinen duraklar (${silinmis.length})`}</div>
      ${silinmis.map(d => `<button class="silinmis-satir" data-durak-geri="${d.id}">
        <span>${kacis(d.ad)}</span><span class="geri-getir">${ç`geri getir`}</span></button>`).join('')}
    </div>`;
  }

  kap.innerHTML = html;

  $('#durakEkleHarita').addEventListener('click', haritadanDurakEkle);
  $('#durakEkleBurada').addEventListener('click', buradanDurakEkle);

  if (!duraklarTarandi) {
    duraklarTarandi = true;
    // Aynı "bir kez sor" defterini kullanıyor: daha önce sorulmuş ya da
    // "gerek yok" denmiş duraklar burada da tekrar sorulmuyor.
    setTimeout(() => bilgiEksikSor(gerok.duraklar(), { paket: true }), 900);
  }

  kap.querySelectorAll('[data-durak-google]').forEach(d => {
    d.addEventListener('click', () => {
      const durak = gerok.durakBul(d.dataset.durakGoogle);
      if (durak) googleHaritalarAc({ lat: durak.lat, lon: durak.lon, ad: durak.ad, zoom: 16 });
    });
  });

  // Tek düğmelik gidildi/gidilmedi. Eskiden "Gittik" ve "Kaçırdık" ayrı iki
  // düğmeydi ve üçüncü bir hâl daha vardı (hiçbiri seçilmemiş) — üç hâl bir
  // soruya çok geliyordu. Artık iki hâl var: gidildi ya da gidilmedi.
  // "kacirildi" verisi korunuyor, gezi sonundaki "kaçırdıkların" listesi
  // ona bakıyor.
  kap.querySelectorAll('[data-gidis]').forEach(b => {
    b.addEventListener('click', async () => {
      const id = b.dataset.gidis;
      const gidildi = durum.durakDurumlari[id]?.durum === 'gidildi';
      await veri.durakDurumuYaz(id, gidildi ? 'kacirildi' : 'gidildi');
      titret(10);
      await tazele();
    });
  });

  kap.querySelectorAll('[data-tasi]').forEach(d => {
    d.addEventListener('click', async (e) => {
      const id = e.target.closest('[data-durak]').dataset.durak;
      const sonuc = await gerok.durakTasi(id, +d.dataset.tasi);
      if (!sonuc) { kayitBildir(ç`Listenin ucu — daha ileri gitmiyor.`); return; }
      await tazele();
      // Gün değişimi sessiz geçmemeli: durak listede tek satır kaydı ama
      // aslında programın başka bir gününe geçti.
      if (sonuc.yeniGun != null) {
        const d2 = gerok.durakBul(id);
        // Ek yerine ok: "Gün 2'ye" ile "Gün 3'e" ayrı ekler istiyor,
        // sayıdan doğru eki üretmek bu bildirim için gereğinden karmaşık.
        kayitBildir(ç`${d2?.ad || ç`Durak`} → Gün ${sonuc.yeniGun}`, 'iyi');
      }
    });
  });

  kap.querySelectorAll('[data-tik]').forEach(b => {
    b.addEventListener('click', async () => {
      const id = b.dataset.tik;
      const no = +b.dataset.tikNo;
      const su = durum.durakDurumlari[id]?.tikler || [];
      await veri.durakTikleriYaz(id, su.includes(no) ? su.filter(x => x !== no) : [...su, no]);
      durum.durakDurumlari = await veri.durakDurumlari();
      titret(8);
      duraklariCiz();
    });
  });

  kap.querySelectorAll('[data-duzenle]').forEach(d => {
    d.addEventListener('click', () => durakSor({ mevcut: gerok.durakBul(d.dataset.duzenle) }));
  });
  kap.querySelectorAll('[data-durak-sil]').forEach(d => {
    d.addEventListener('click', () => durakSilSor(d.dataset.durakSil));
  });
  kap.querySelectorAll('[data-durak-geri]').forEach(b => {
    b.addEventListener('click', async () => {
      await gerok.durakGeriGetir(b.dataset.durakGeri);
      kayitBildir(ç`Durak geri geldi`, 'iyi');
      await tazele();
    });
  });
  durakNotVePuanKur(kap);
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
// çalışıyor" sorusunun cevabı. Eskiden önbelleğin adına bakıyordu; yeni sürüm
// inip önbellek adı değişince ekrandaki kod eski olduğu hâlde yeni görünüyordu.
function calisanSurum() { return BU_SURUM; }

// Sürüm adı: gerok-82-20260822-101530  →  "#82 · 22.08.2026 10:15"
// Baştaki numara kaçıncı güncelleme olduğunu söylüyor; her yayında bir artıyor.
// Numarasız eski adlar da okunabilsin diye o bölüm isteğe bağlı bırakıldı —
// telefonda eski bir sürüm asılı kalırsa yazı yine de anlaşılır çıksın.
function surumOku(ad) {
  const p = /^gerok-(?:(\d+)-)?(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})/.exec(ad || '');
  if (!p) return ad || 'bilinmiyor';
  const tarih = `${p[4]}.${p[3]}.${p[2]} ${p[5]}:${p[6]}`;
  return p[1] ? `#${p[1]} · ${tarih}` : tarih;
}

function surumuYaz() {
  const yer = $('#surumYazi');
  if (!yer) return;
  yer.textContent = surumOku(calisanSurum());
}

// ---- Güncelleme (22 Ağustos 2026'da yeniden yazıldı) -----------------------
//
// Eskiden yeni sürüm için uygulamayı İKİ KEZ kapatıp açmak gerekiyordu: birinci
// açılışta servis worker kuruluyor, ikincisinde devreye giriyordu. Arada da hiç
// haber verilmiyordu — kullanıcı yeni bir şey olup olmadığını bilmiyordu.
//
// Şimdi: açılışta sessizce `surum.json`a bakılıyor (birkaç KB), yeni sürüm
// varsa NE KADAR indirileceğiyle birlikte soruluyor, "Güncelle" denince
// sayfa kendisi yenileniyor. Kapat-aç yok.
//
// Neden yine de kendiliğinden yenilemiyoruz: sayfa yenilemesi sesli notun
// ortasına denk gelirse kaydı uçurur. Kararı kullanıcı veriyor, biz de
// kayıt sürerken güncellemeyi reddediyoruz.

const SURUM_LISTESI = './surum.json';
const DEGISIKLIK_LISTESI = './degisiklikler.json';

/**
 * Bir sürümün notları: ne eklendi, ne düzeldi, ne çıktı.
 *
 * Neden var: "3 dosya yenilendi, 147 KB" bir insana hiçbir şey anlatmıyor.
 * Güncellemeyi kabul edip etmemeye karar verecek olan kişi neyin değiştiğini
 * bilmeli — özellikle bir şey ÇIKARILDIYSA.
 *
 * Sürüm numarası `gerok-105-20260825-...` biçiminde; ortadaki sayı anahtar.
 */
function surumSayisi(surum) {
  const m = /gerok-(\d+)-/.exec(surum || '');
  return m ? Number(m[1]) : null;
}

/** Bütün sürüm notları, yeniden eskiye. Boş dizi = okunamadı. */
async function degisiklikDosyasi({ agdan = true } = {}) {
  try {
    const yol = agdan ? `${DEGISIKLIK_LISTESI}?t=${Date.now()}` : DEGISIKLIK_LISTESI;
    const yanit = await fetch(yol, agdan ? { cache: 'no-store' } : undefined);
    if (!yanit.ok) return [];
    const d = await yanit.json();
    return (d.surumler || [])
      .filter(x => Number.isFinite(x.sayi))
      .sort((a, b) => b.sayi - a.sayi);
  } catch { return []; }          // internet yoksa kart notsuz çıkar, susmaz
}

async function degisiklikNotlari(surum, { agdan = true } = {}) {
  const sayi = surumSayisi(surum);
  if (sayi == null) return null;
  return (await degisiklikDosyasi({ agdan })).find(x => x.sayi === sayi) || null;
}

/**
 * İki sürüm ARASINDAKİ bütün notlar, yeniden eskiye.
 *
 * Neden gerekti: telefon birkaç sürüm geride kalabiliyor. Kart yalnızca en son
 * sürümün notunu gösterdiği sürece arada olan biten hiç görünmüyordu — 30
 * Ağustos'ta beş sürüm birikti ve kullanıcı en küçük değişikliği görüp en
 * büyüğünü göremeyecekti.
 */
async function degisiklikNotlariAralik(yeniSurum, eskiSurum) {
  const yeni = surumSayisi(yeniSurum);
  const eski = surumSayisi(eskiSurum);
  if (yeni == null) return [];
  return (await degisiklikDosyasi())
    .filter(x => x.sayi <= yeni && (eski == null || x.sayi > eski));
}

/** "2026-08-30" → "30.08.2026". Tarih yoksa boş. */
function tarihKisa(t) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t || '');
  return m ? `${m[3]}.${m[2]}.${m[1]}` : '';
}

/** Tek sürümün bloğu: başlık + notlar. */
function surumBloguHtml(n, simdiki = false) {
  const tarih = tarihKisa(n.tarih);
  return `<div class="gnc-surum">
    <div class="gnc-surum-basi">
      <span class="gnc-surum-no">#${n.sayi}</span>
      ${tarih ? `<span class="gnc-surum-tarih">${tarih}</span>` : ''}
      ${simdiki ? `<span class="gnc-simdiki">${ç`şu an sendeki`}</span>` : ''}
    </div>
    ${notlariHtml(n)}
  </div>`;
}

/** Kart ve panel aynı listeyi çizsin diye tek yerde. */
function notlariHtml(n) {
  if (!n) return '';
  const bolum = (baslik, sinif, liste) => (liste && liste.length)
    ? `<div class="gnc-bolum ${sinif}"><div class="gnc-baslik">${baslik}</div>`
      + `<ul>${liste.map(x => `<li>${kacis(x)}</li>`).join('')}</ul></div>`
    : '';
  const html = bolum(ç`Eklenenler`, 'gnc-ekle', n.eklendi)
             + bolum(ç`Düzelenler`, 'gnc-duzel', n.duzeldi)
             + bolum(ç`Çıkarılanlar`, 'gnc-cikar', n.cikti);
  return html || `<div class="gnc-bolum"><div class="gnc-baslik">${
    ç`Bu güncellemede görünür bir değişiklik yok — içeride iyileştirme var.`}</div></div>`;
}

// Telefondaki önbellekte duran baytların özeti. Sunucudaki listeyle
// karşılaştırılıp yalnızca GERÇEKTEN değişen dosyaların boyutu toplanıyor —
// "147 KB" dediğimizde o sayı uydurma değil.
async function degisenBoyut(liste) {
  if (!('caches' in window)) return null;
  const adlar = await caches.keys();
  if (!adlar.includes(BU_SURUM)) return null;
  // Karşılaştırma ÇALIŞAN sürümün önbelleğine karşı yapılıyor. Yeni sürüm
  // inmiş olsa bile eski önbellek duruyor (sw.js artık kendiliğinden devreye
  // girmiyor), o yüzden "ne değişti" sorusu hâlâ cevaplanabiliyor.
  const onbellek = await caches.open(BU_SURUM);
  let toplam = 0, sayi = 0;

  for (const [yol, bilgi] of Object.entries(liste.dosyalar || {})) {
    let ayni = false;
    try {
      const yanit = await onbellek.match(yol);
      if (yanit) {
        const ham = await yanit.arrayBuffer();
        const ozet = await crypto.subtle.digest('SHA-256', ham);
        const yazi = Array.from(new Uint8Array(ozet).slice(0, 8))
          .map(b => b.toString(16).padStart(2, '0')).join('');
        ayni = yazi === bilgi.ozet;
      }
    } catch { /* okunamayan dosya değişmiş sayılıyor */ }
    if (!ayni) { toplam += bilgi.boyut || 0; sayi++; }
  }
  return { bayt: toplam, sayi };
}

// Ağdan sürüm listesini alır. İnternet yoksa sessizce null döner — yolda
// internetsizlik hata değil, olağan durum.
async function guncellemeBak() {
  if (!navigator.onLine) return null;
  let liste;
  try {
    const yanit = await fetch(`${SURUM_LISTESI}?t=${Date.now()}`, { cache: 'no-store' });
    if (!yanit.ok) return null;
    liste = await yanit.json();
  } catch { return null; }

  if (!liste.surum || liste.surum === BU_SURUM) return null;
  const adlar = ('caches' in window) ? await caches.keys() : [];
  return {
    ...liste,
    indi: adlar.includes(liste.surum),   // dosyalar zaten inmiş mi
    degisen: await degisenBoyut(liste),
    notlar: await degisiklikNotlariAralik(liste.surum, BU_SURUM)
  };
}

function baytYaz(b) {
  if (b == null) return null;
  return b >= 1024 * 1024 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;
}

function guncellemeKarti(bilgi) {
  const boyut = baytYaz(bilgi.degisen?.bayt);
  const sayi = bilgi.degisen?.sayi;
  ortuAc(`
    <div class="ortu-baslik">${ç`Yeni güncelleme var`}</div>
    <div class="ortu-alt">${surumOku(bilgi.surum)}</div>
    <div class="guncelleme-boyut">
      <span>${boyut || '—'}</span>
      ${sayi ? `<span class="guncelleme-alt">${ç`${sayi} dosya yenilendi`}</span>` : ''}
    </div>
    ${Array.isArray(bilgi.notlar)
      ? (bilgi.notlar.length > 1
          ? bilgi.notlar.map(n => surumBloguHtml(n)).join('')
          : notlariHtml(bilgi.notlar[0]))
      : notlariHtml(bilgi.notlar)}
    <div class="guncelleme-not">${bilgi.indi
      ? ç`Dosyalar indi bile. Tek yapılacak uygulamayı yenilemek — birkaç saniye.`
      : ç`İnternetten inecek, sonra uygulama kendi kendine yenilenecek.`}</div>
    <button class="eylem-dugme birincil" id="gncEvet">${bilgi.indi
      ? ç`Şimdi güncelle` : ç`İndir ve güncelle`}</button>
    <button class="eylem-dugme" id="gncHayir">${ç`Sonra`}</button>
  `, true, 'guncelleme');

  $('#gncHayir').addEventListener('click', async () => {
    ortuKapat();
    // Aynı sürüm için her açılışta tekrar sorulmuyor. Yeni bir sürüm
    // çıkınca kart yine gelir.
    await veri.ayarYaz('guncellemeErtelendi', bilgi.surum);
  });
  $('#gncEvet').addEventListener('click', () => guncellemeyiUygula(bilgi));
}

async function guncellemeyiUygula(bilgi) {
  if (kayit.sesKaydediyorMu()) {
    kayitBildir(ç`Ses kaydı sürüyor — önce onu bitir, sonra güncelle.`, 'kotu');
    return;
  }

  const tus = $('#gncEvet');
  const yaz = (m) => { if (tus) tus.textContent = m; };
  if (tus) tus.disabled = true;
  yaz(bilgi.indi ? 'Yenileniyor…' : 'İndiriliyor…');

  try {
    const kurulum = await navigator.serviceWorker?.getRegistration();
    if (!kurulum) throw new Error(ç`çevrimdışı kurulum yok`);

    // Sayfa, yeni servis worker devreye girdiği anda yenileniyor. Yenilemeyi
    // burada bekletmek şart: erken yenilersek eski dosyalar tekrar yüklenir.
    let yenilendi = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (yenilendi) return;
      yenilendi = true;
      location.reload();
    });

    // Bekleyen sürüm varsa ona "geç" diyoruz; yoksa önce indirtiyoruz.
    // Süre değil SONUÇ bekleniyor: 3,6 MB yavaş bir bağlantıda sabit bir
    // süreye sığmaz.
    const bitis = Date.now() + 90000;
    while (Date.now() < bitis && !yenilendi) {
      const k = await navigator.serviceWorker.getRegistration();
      if (k?.waiting) { k.waiting.postMessage({ tip: 'gec' }); }
      else if (!k?.installing) { await k?.update().catch(() => {}); }
      if (await calisanSurumOnbellegi() === bilgi.surum) { location.reload(); return; }
      await new Promise(r => setTimeout(r, 800));
    }
    if (!yenilendi) throw new Error(ç`indirme tamamlanmadı`);
  } catch (h) {
    kayitBildir(ç`Güncellenemedi (${h.message}). İnternet varken tekrar dene.`, 'kotu');
    if (tus) { tus.disabled = false; yaz(bilgi.indi ? ç`Şimdi güncelle` : ç`İndir ve güncelle`); }
  }
}

// Servis worker'ın o an SUNDUĞU önbellek. Devreye girip girmediğini anlamanın
// tek güvenilir yolu: eski sürümün önbelleği silindiyse geçiş olmuştur.
async function calisanSurumOnbellegi() {
  if (!('caches' in window)) return null;
  const adlar = (await caches.keys()).filter(a => /^gerok-\d/.test(a));
  return adlar.length === 1 ? adlar[0] : null;
}

// Açılışta sessiz yoklama. Uygulama çizilsin diye biraz bekliyoruz; internet
// yoksa, yeni sürüm yoksa ya da kullanıcı bu sürümü zaten ertelediyse hiçbir
// şey görünmüyor.
// Yoklama TEK SEFERLİK DEĞİL.
//
// İlk hâli 4 saniye bekleyip bir kez bakıyordu ve şu üç durumda sessizce
// vazgeçiyordu: ekran o an gizliyse, başka bir kart açıksa (ad sorma,
// sihirbaz, gün sonu), ya da internet henüz gelmemişse. Üçü de açılışta
// olağan — yani "yeni sürüm var" kartı hiç görünmeyebiliyordu ve kullanıcı
// haklı olarak "bildirim gelmedi" diyordu.
//
// Şimdi: uygun an gelene kadar bekliyor, uygulamaya her dönüşte yeniden
// deniyor. Kart bir kez gösterildikten sonra o oturumda bir daha sorulmuyor.
let guncellemeSoruldu = false;

async function guncellemeYokla({ gecikme = 4000 } = {}) {
  if (guncellemeSoruldu) return;
  await new Promise(r => setTimeout(r, gecikme));
  if (guncellemeSoruldu) return;

  // Uygun an değilse VAZGEÇMİYORUZ — 20 saniye sonra tekrar bakıyoruz.
  const uygunDegil = document.hidden
    || !$('#ortu').classList.contains('gizli')
    || kayit.sesKaydediyorMu();
  if (uygunDegil) { setTimeout(() => guncellemeYokla({ gecikme: 0 }), 20000); return; }

  try {
    const bilgi = await guncellemeBak();
    if (!bilgi) return;                       // en son sürümdeyiz ya da internet yok
    if (await veri.ayarOku('guncellemeErtelendi') === bilgi.surum) return;
    guncellemeSoruldu = true;
    guncellemeKarti(bilgi);
  } catch { /* yoklama sessiz başarısız olur; dönüşte yine denenecek */ }
}

// "Yeni sürüm var mı?" düğmesi — açılıştaki sessiz yoklamanın elle çağrılan hâli.
async function surumuAra() {
  const tus = $('#btnSurum');
  if (tus) { tus.disabled = true; tus.textContent = ç`Bakılıyor…`; }
  try {
    const bilgi = await guncellemeBak();
    if (bilgi) guncellemeKarti(bilgi);
    else if (!navigator.onLine) kayitBildir(ç`İnternet yok — bakılamadı.`, 'kotu');
    else kayitBildir(ç`Zaten en son sürümdesin.`, 'iyi');
  } catch (h) {
    kayitBildir(ç`Bakılamadı (${h.message}). İnternet varken dene.`, 'kotu');
  }
  if (tus) { tus.disabled = false; tus.textContent = ç`Yeni sürüm var mı?`; }
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
    yer.innerHTML = `<div class="arama-bos">${ç`Yakında böyle bir yer yok.`}
      <button class="kucuk-dugme" id="aramaInternet">${ç`İnternette ara`}</button></div>`;
  } else {
    yer.innerHTML = sonuc.map((s, i) => `
      <button class="arama-satiri" data-i="${i}">
        <span>${kacis(s.ad)}</span>
        <span class="yer-alt">${kacis(s.alt)}</span>
      </button>`).join('')
      + `<div class="arama-bos">${ç`Aradığın burada yoksa`}
         <button class="kucuk-dugme" id="aramaInternet">${ç`internette ara`}</button>
         ${ç`(wifi gerekir).`}</div>`;
  }

  $$('#aramaSonuc .arama-satiri').forEach(d => {
    d.addEventListener('click', () => yereGit(sonuc[+d.dataset.i]));
  });
  $('#aramaInternet')?.addEventListener('click', () => internetAramasi(sorgu));
}

async function internetAramasi(sorgu) {
  const yer = $('#aramaSonuc');
  yer.innerHTML = `<div class="arama-bos">${ç`İnternette aranıyor…`}</div>`;
  try {
    const sonuc = await yerAra.internetteAra(sorgu);
    if (!sonuc.length) {
      yer.innerHTML = `<div class="arama-bos">${ç`Bulunamadı.`}</div>`;
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
  kayitBildir(ç`${s.ad} — haritayı ince ayarla, sonra "Buraya durak ekle".`, 'iyi');
}

function haritadanDurakEkle() {
  ekranAc('harita');
  haritaKur().then(() => {
    durakKoymaKipi(true);
    kayitBildir(ç`Haritayı kaydır, sonra "Buraya durak ekle" de.`);
  });
}

async function buradanDurakEkle() {
  kayitBildir(ç`Konum alınıyor…`);
  const k = await iz.suAnkiKonum();
  if (!k) { kayitBildir(ç`Konum alınamadı. Haritadan elle koyabilirsin.`, 'kotu'); return; }
  durakSor({ lat: k.lat, lon: k.lon, buradan: true });
}

function durakNoktasiOnayla() {
  const m = haritaMerkezi();
  durakKoymaKipi(false);
  if (!m) { kayitBildir(ç`Harita henüz hazır değil.`, 'kotu'); return; }
  durakSor({ lat: m.lat, lon: m.lon });
}

// Gün seçenekleri: paket varsa paketin günleri, yoksa 1–10.
// Paketi olmayan biri (başka turdaki bir arkadaş) da günlerini numaralayabilsin.
function gunSecenekleri() {
  const g = gerok.aktifGerok()?.gunler;
  if (g?.length) return g.map(x => ({ no: x.no, ad: `Gün ${x.no}` }));
  return Array.from({ length: 10 }, (_, i) => ({ no: i + 1, ad: `Gün ${i + 1}` }));
}

function durakSor({ lat, lon, mevcut = null, buradan = false }) {
  const d = mevcut;
  const enlem = d ? d.lat : lat, boylam = d ? d.lon : lon;
  const secilenGun = d ? d.gun : (gerok.bugununGunu()?.no ?? null);

  ortuAc(`
    <div class="ortu-baslik">${d ? ç`Durağı düzenle` : ç`Yeni durak`}</div>
    <div class="ortu-alt">${ç`Haritada rotaya eklenecek ve sıradaki yerini alacak. Akşam paket gönderdiğinde arkadaşının telefonuna da geçer.`}</div>

    <div class="girdi-etiket">${ç`Adı`}</div>
    <input class="girdi" id="durakAd" placeholder="${ç`Şelale, kahvaltı yeri, köprü…`}" value="${kacis(d?.ad || '')}">

    <div class="girdi-etiket">${ç`Hangi gün?`}</div>
    <div class="secenekler" id="durakGun">
      ${gunSecenekleri().map(g =>
        `<button class="kucuk-dugme ${g.no === secilenGun ? 'secili' : ''}" data-gun="${g.no}">${g.ad}</button>`).join('')}
      <button class="kucuk-dugme ${secilenGun == null ? 'secili' : ''}" data-gun="">${ç`Günsüz`}</button>
    </div>

    <div class="girdi-etiket">${ç`Unutma listesi — her satıra bir şey`}</div>
    <textarea class="alan" id="durakUnutma" placeholder="${ç`Fotoğraf çek`}&#10;${ç`Su al`}&#10;${ç`Giriş ücreti var mı?`}">${kacis((d?.unutma || []).join('\n'))}</textarea>

    <div class="panel-not">${ç`Konum: ${(+enlem).toFixed(5)}, ${(+boylam).toFixed(5)}`}</div>
    <button class="eylem-dugme birincil" id="durakKaydet">${d ? ç`Kaydet` : ç`Durağı ekle`}</button>
    <button class="eylem-dugme" id="durakVaz">${ç`Vazgeç`}</button>
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
      kayitBildir(ç`Durak güncellendi.`, 'iyi');
    } else {
      // `durum.duraklar` diye bir alan HİÇ OLMADI; buradaki okuma her durak
      // eklemede sessizce patlıyordu. Sonucu görünmezdi ama ağırdı: durak
      // kaydediliyor, ardından gelen bildirim, `tazele()` ve bekçinin sorusu
      // hiç çalışmıyordu. Durak listesi ancak başka bir şey ekranı yeniden
      // çizdiğinde güncelleniyordu.
      const yeni = await gerok.durakEkle({ ad, lat: enlem, lon: boylam, gun, unutma });
      // Nereden geldiğini söylemek işe yarıyor: "Burayı durak yap"a basınca
      // konumun gerçekten alındığı ancak bu cümleyle anlaşılıyor.
      kayitBildir(buradan
        ? ç`Bulunduğun yer durak yapıldı`
        : ç`Durak eklendi · ${gerok.duraklar().length}. sıra`, 'iyi');
      // Mac'teki bekçi telefondan eklenen durağı hiç görmüyor. Kartı yoksa
      // bunu ancak buradan haber verebiliyoruz. Dönen kaydı kullanıyoruz;
      // ada göre aramak, aynı adlı iki durakta yanlış olanı bulurdu.
      if (yeni) setTimeout(() => bilgiEksikSor(yeni), 1200);
    }
    await tazele();
    if (durum.ekran === 'harita') haritaGuncelle(durum.kayitlar, durum.izNoktalari);
  });
}

function durakSilSor(id) {
  const d = gerok.durakBul(id);
  if (!d) return;
  ortuAc(`
    <div class="ortu-baslik">${ç`"${kacis(d.ad)}" silinsin mi?`}</div>
    <div class="ortu-alt">${ç`Rotadan çıkar. Bu durakta yaptığın kayıtlar (ses, fotoğraf, not) silinmez — onlar yerinde kalır. Listenin en altındaki “Silinen duraklar”dan geri getirebilirsin.`}</div>
    <button class="eylem-dugme birincil" id="durakSilOnay">${ç`Sil`}</button>
    <button class="eylem-dugme" id="durakSilVaz">${ç`Vazgeç`}</button>
  `);
  $('#durakSilVaz').addEventListener('click', ortuKapat);
  $('#durakSilOnay').addEventListener('click', async () => {
    ortuKapat();
    await gerok.durakYokEt(id);
    // Silme katman olarak yazıldığı için geri alması ucuz: beş saniyelik
    // düğme hemen burada, listenin altındaki "Silinen duraklar" da yerinde.
    geriAlinabilirBildir(ç`Durak silindi`, async () => {
      await gerok.durakGeriGetir(id);
      await tazele();
      if (durum.ekran === 'harita') haritaGuncelle(durum.kayitlar, durum.izNoktalari);
    });
    await tazele();
    if (durum.ekran === 'harita') haritaGuncelle(durum.kayitlar, durum.izNoktalari);
  });
}

// Haritada bir durak iğnesine dokununca açılan kart.
function durakKartiAc(id, { uc = false } = {}) {
  // Durak koyarken haritaya dokunmak kart açmasın — o an iş nişangâhta.
  if (!$('#haritaNisan').classList.contains('gizli')) return;
  const d = gerok.durakBul(id);
  if (!d) return;
  const konum = iz.sonBilinenKonum();
  const uzaklik = konum ? iz.mesafe(konum.lat, konum.lon, d.lat, d.lon) : null;
  const dur = durum.durakDurumlari[id]?.durum;
  const liste = gerok.duraklar();
  const yer = liste.findIndex(x => x.id === id);
  const sira = yer + 1;
  const onceki = yer > 0 ? liste[yer - 1] : null;
  const sonraki = yer >= 0 && yer < liste.length - 1 ? liste[yer + 1] : null;

  ortuAc(`
    <div class="durak-gezin">
      <button class="gezin-dugme" id="kartOnceki" ${onceki ? '' : 'disabled'}>
        <span class="gezin-ok">‹</span>
        <span class="gezin-yazi">${onceki ? kacis(onceki.ad) : 'ilk durak'}</span>
      </button>
      <div class="gezin-sayac">${sira} / ${liste.length}</div>
      <button class="gezin-dugme sag" id="kartSonraki" ${sonraki ? '' : 'disabled'}>
        <span class="gezin-yazi">${sonraki ? kacis(sonraki.ad) : 'son durak'}</span>
        <span class="gezin-ok">›</span>
      </button>
    </div>
    <div class="ortu-baslik"><span class="durak-no">${sira}</span>${kacis(d.ad)}</div>
    <div class="ortu-alt">${d.gun == null ? ç`Günsüz` : ç`Gün ${d.gun}`}${uzaklik != null ? ' · ' + ç`${uzaklikYaz(uzaklik)} uzakta` : ''}${d.kaynak === 'kendi' ? ' · ' + ç`kendi durağın` : ''}</div>
    ${d.unutma?.length ? `<ul class="unutma">${d.unutma.map(u => `<li>${kacis(u)}</li>`).join('')}</ul>` : ''}
    ${kendiNotlari(d)}
    ${yildizSatiri(d)}
    <div class="durak-dugmeler">
      <button class="kucuk-dugme ${dur === 'gidildi' ? 'secili' : ''}" id="kartGidildi">${ç`Gittik`}</button>
      <button class="kucuk-dugme ${dur === 'kacirildi' ? 'secili' : ''}" id="kartKacirildi">${ç`Kaçırdık`}</button>
      <button class="kucuk-dugme" data-not-ekle="${d.id}">${ç`Not yaz`}</button>
      <button class="kucuk-dugme" id="kartBilgi" hidden>${ç`Bilgi`}</button>
      <button class="kucuk-dugme g-dugme" id="kartGoogle"
              title="${ç`Google Haritalar'da aç`}" aria-label="${ç`Google Haritalar'da aç`}">G</button>
    </div>
    ${d.kaynak === 'kendi' ? `<button class="eylem-dugme" id="kartDuzenle">${ç`Düzenle`}</button>` : ''}
    ${d.kaynak === 'kendi' ? `<button class="eylem-dugme sil" id="kartSil">${ç`Sil`}</button>` : ''}
    <button class="eylem-dugme" id="kartKapat">${ç`Kapat`}</button>
  `, true, 'durak');

  // Not ve puan haritadaki kartta da çalışsın: durak listesine gidip aynı
  // durağı 26'nın arasından bulmak yolda vakit alıyor.
  durakNotVePuanKur($('#ortuIc'), () => durakKartiAc(id));

  // Bilgi kartı varsa düğme açılıyor. Sorulan ilk soru yolda "burası neresi"
  // oluyordu; cevabı artık kartın kendi üstünde.
  bekci.durakBilgisiVarMi(d).then(v => {
    if (v) $('#kartBilgi')?.removeAttribute('hidden');
  });
  $('#kartBilgi')?.addEventListener('click', () => bekci.durakBilgisi(d));

  // Zıplama kartın AÇILMASINDAN sonra yapılıyor: kaydırma payı kartın gerçek
  // yüksekliğine göre hesaplanıyor, tahmin edilmiyor. Haritaya dokunarak
  // açılan kartta zıplamıyoruz — zaten oraya bakıyorsun.
  if (uc) duragaUc(d, $('#ortuIc')?.getBoundingClientRect().height || 0);

  $('#kartOnceki')?.addEventListener('click', () => {
    if (onceki) durakKartiAc(onceki.id, { uc: true });
  });
  $('#kartSonraki')?.addEventListener('click', () => {
    if (sonraki) durakKartiAc(sonraki.id, { uc: true });
  });

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
      const kaldir = dur === deger;
      await veri.durakDurumuYaz(id, kaldir ? null : deger);
      // Aynı hata buradaydı: "Gittik" işareti yazılıyor, ama bildirim ve
      // `tazele()` patlayan bu satır yüzünden hiç çalışmıyordu.
      const d = gerok.durakBul(id);
      if (!kaldir && d) kayitBildir(`${d.ad} · ${deger === 'gidildi' ? ç`gittik` : ç`kaçırdık`}`, 'iyi');
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
  bildirimGoster(durak.ad, ç`${uzaklikYaz(uzaklik)} kaldı`);

  ortuAc(`
    <div class="panel uyari-kart">
      <div class="uyari-baslik">${ç`Yaklaşıyorsun · ${uzaklikYaz(uzaklik)}`}</div>
      <div class="ortu-baslik" style="margin-top:8px">${kacis(durak.ad)}</div>
      ${durak.unutma?.length
        ? `<ul class="unutma">${durak.unutma.map(u => `<li>${kacis(u)}</li>`).join('')}</ul>`
        : `<div class="ortu-alt">${ç`Not yok.`}</div>`}
    </div>
    <button class="eylem-dugme" id="uyariBilgi" hidden>${ç`Burası hakkında bilgi`}</button>
    <button class="eylem-dugme birincil" id="uyariTamam">${ç`Tamam`}</button>
  `);
  $('#uyariTamam').addEventListener('click', ortuKapat);
  // Kart varsa düğme açılıyor; yoksa hiç görünmüyor — basınca "bilgim yok"
  // diyen bir düğme, olmayan düğmeden kötüdür.
  bekci.durakBilgisiVarMi(durak).then(v => {
    if (v) $('#uyariBilgi')?.removeAttribute('hidden');
  });
  $('#uyariBilgi')?.addEventListener('click', () => bekci.durakBilgisi(durak));
}

/**
 * Bekçi kartı olmayan bir durak gördüğünde soran küçük şerit.
 *
 * Uyarı vermiyoruz, SORUYORUZ: bilgiyi isteyip istemediğine sen karar
 * veriyorsun ve "gerek yok" dersen aynı durak için bir daha çıkmıyor.
 */

/**
 * Yedek hatırlatıcısı — Gün Sonu'ndan BAĞIMSIZ.
 *
 * Yedek alma adımı Gün Sonu akışının içindeydi. Akış yapılmayınca yedek de
 * alınmıyordu; gerçek gezide tam olarak bu oldu ve dokuz sesli not neredeyse
 * gidiyordu. Bir korumanın, kullanıcının kaçınabileceği bir ritüelin arkasına
 * saklanması tasarım hatasıydı.
 *
 * Ölçü: günde en fazla bir kez, yalnızca son yedekten sonra YENİ kayıt varsa,
 * ve "bugün olmaz" denince o gün bir daha sorulmuyor.
 */
const YEDEK_ARALIK = 24 * 60 * 60 * 1000;


/**
 * Yedek al, sonra HEMEN doğrula — her yedekte, kullanıcının kararı.
 *
 * Doğrulamayı atlamak serbest ama sonucu görünür: ekran "alındı" ile
 * "doğrulandı"yı ayrı gösteriyor. Yedeğin var sanıp olmaması, hiç yedek
 * almamaktan kötüdür.
 */
async function yedekAlVeDogrula() {
  await yedekAl(kayitBildir);
  const d = await yedekDogrulamaDurumu();
  if (!d.alindi) return;                 // iptal edilmiş, sorma

  ortuAc(`
    <div class="ortu-baslik">${ç`Yedeği doğrulayalım`}</div>
    <div class="ortu-alt">${ç`Telefon, dosyanın nereye kaydedildiğini göremiyor — o yüzden "kaydedildi" yazısı bir <b>varsayım</b>. Az önce kaydettiğin dosyayı seç, açıp sayayım. Böylece yedeğin olduğunu <b>bilelim</b>.`}</div>
    <button class="eylem-dugme birincil" id="ydgSec">${ç`Dosyayı seç`}</button>
    <button class="eylem-dugme" id="ydgAtla">${ç`Şimdi değil`}</button>
    <div id="ydgDurum" class="panel-not"></div>
  `);
  $('#ydgAtla').addEventListener('click', ortuKapat);
  $('#ydgSec').addEventListener('click', () => {
    const yaz = (m) => { const e = $('#ydgDurum'); if (e) e.innerHTML = m; };
    yedegiDogrula(kayitBildir, (s) => {
      if (!s) return;
      if (s.dogru) {
        ortuKapat();
        kayitBildir(ç`Yedek doğrulandı · ${s.kayit} kayıt, ${s.medya} dosya`, 'iyi');
        tazele();
      } else if (s.tam === false) {
        yaz(ç`<b>Bu dosya yarım.</b> Yazma tamamlanmamış — kaydetme sırasında iptal edilmiş ya da yer bitmiş olabilir. Yeniden yedek al.`);
      } else if (s.eksik) {
        yaz(ç`<b>Dikkat:</b> ${s.eksik} kaydın sesi ya da görseli yedeğe girmemiş. Bu yedek eksik — yer açıp yeniden dene.`);
      } else if (s.kayit != null && s.kayit < s.canliKayit) {
        yaz(ç`Bu yedek <b>eski</b>: içinde ${s.kayit} kayıt var, telefonunda ${s.canliKayit}. Yeni bir yedek al.`);
      } else {
        yaz(ç`Doğrulanamadı. Doğru dosyayı seçtiğinden emin ol.`);
      }
    });
  });
}

async function yedekHatirlat() {
  const yedek = await sonYedekZamani();
  const esik = yedek || 0;
  if (yedek && Date.now() - yedek < YEDEK_ARALIK) return;

  // Yedekten sonra yeni kayıt yoksa hatırlatmanın anlamı yok.
  const yeni = (durum.kayitlar || []).filter(k => (k.t || 0) > esik).length;
  if (!yeni) return;

  const bugunAnahtar = new Date().toISOString().slice(0, 10);
  if (await veri.ayarOku('yedekErtelendi', null) === bugunAnahtar) return;
  if (document.getElementById('yedekSerit')) return;

  const kutu = document.createElement('div');
  kutu.id = 'yedekSerit';
  kutu.className = 'on-sezi';
  kutu.innerHTML = `
    <div class="on-sezi-yazi">
      <div class="on-sezi-ust">${ç`Yedek`}</div>
      <div class="on-sezi-ad">${yedek ? ç`Son yedekten beri` : ç`Henüz hiç yedek yok`}</div>
      <div class="on-sezi-alt">${ç`${yeni} yeni kayıt · tek dosya, telefonda kalır`}</div>
    </div>
    <div class="on-sezi-dugmeler">
      <button class="kucuk-dugme birincil" id="yedekSimdi">${ç`Yedek al`}</button>
      <button class="kucuk-dugme" id="yedekSonra">${ç`Bugün olmaz`}</button>
    </div>`;
  document.body.appendChild(kutu);
  const kapat = () => kutu.remove();
  $('#yedekSimdi').addEventListener('click', () => { kapat(); yedekAlVeDogrula(); });
  $('#yedekSonra').addEventListener('click', async () => {
    kapat();
    await veri.ayarYaz('yedekErtelendi', bugunAnahtar);
  });
  setTimeout(() => { if (document.body.contains(kutu)) kapat(); }, 45000);
}

async function bilgiEksikSor(duraklar, secenek = {}) {
  const s = await bekci.yeniDuraklariGozden(duraklar, secenek);
  if (!s) return;
  document.getElementById('onSezi')?.remove();
  const kutu = document.createElement('div');
  kutu.id = 'onSezi';
  kutu.className = 'on-sezi';
  kutu.innerHTML = `
    <div class="on-sezi-yazi">
      <div class="on-sezi-ust">${ç`Bekçi`}</div>
      <div class="on-sezi-ad">${kacis(s.baslik)}</div>
      <div class="on-sezi-alt">${ç`${kacis(s.ad)} · bilgisini isteyeyim mi?`}</div>
    </div>
    <div class="on-sezi-dugmeler">
      <button class="kucuk-dugme birincil" id="onSeziEvet">${ç`İste`}</button>
      <button class="kucuk-dugme" id="onSeziHayir">${ç`Gerek yok`}</button>
    </div>`;
  document.body.appendChild(kutu);
  const kapat = () => kutu.remove();
  $('#onSeziHayir').addEventListener('click', kapat);
  $('#onSeziEvet').addEventListener('click', () => { kapat(); s.iste(); });
  setTimeout(() => { if (document.body.contains(kutu)) kapat(); }, 45000);
}

// Yaklaşma uyarısından ÖNCE gelen küçük soru.
//
// 2 km'de gelen uyarı "geldik" demek; okumaya vakit kalmıyor. Bu yüzden daha
// uzaktan, ekranı kaplamayan tek satırlık bir soru soruluyor: sıradaki durağı
// haber veriyor ve detay isteyip istemediğini soruyor. İstemezsen bir daha
// sormuyor.
const ONSEZI_METRE = 15000;

function onSeziKontrol(lat, lon) {
  if (durum.sorulmusDuraklar?.size == null) return;
  for (const { durak, uzaklik } of gerok.yakinDuraklar(lat, lon, ONSEZI_METRE)) {
    if (durum.sorulmusDuraklar.has(durak.id)) continue;
    if (durum.uyarilmisDuraklar.has(durak.id)) continue;
    if (uzaklik < YAKLASMA_METRE) continue;        // zaten oradayız, uyarı gelecek
    durum.sorulmusDuraklar.add(durak.id);
    veri.ayarYaz('sorulmusDuraklar', Array.from(durum.sorulmusDuraklar));
    onSeziSor(durak, uzaklik);
    break;
  }
}

async function onSeziSor(durak, uzaklik) {
  if (!await bekci.durakBilgisiVarMi(durak)) return;
  const eski = $('#onSezi');
  if (eski) eski.remove();
  const kutu = document.createElement('div');
  kutu.id = 'onSezi';
  kutu.className = 'on-sezi';
  kutu.innerHTML = `
    <div class="on-sezi-yazi">
      <div class="on-sezi-ust">${ç`Sıradaki · ${uzaklikYaz(uzaklik)}`}</div>
      <div class="on-sezi-ad">${kacis(durak.ad)}</div>
      <div class="on-sezi-alt">${ç`Bu durakla ilgili detay ister misin?`}</div>
    </div>
    <div class="on-sezi-dugmeler">
      <button class="kucuk-dugme birincil" id="onSeziEvet">${ç`Anlat`}</button>
      <button class="kucuk-dugme" id="onSeziHayir">${ç`Şimdi değil`}</button>
    </div>`;
  document.body.appendChild(kutu);
  const kapat = () => kutu.remove();
  $('#onSeziHayir').addEventListener('click', kapat);
  $('#onSeziEvet').addEventListener('click', () => { kapat(); bekci.durakBilgisi(durak); });
  // Kendiliğinden çekiliyor: yolda ekranı kalıcı olarak işgal etmesin.
  setTimeout(() => { if (document.body.contains(kutu)) kapat(); }, 40000);
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
  $('#btnYolModu .yol-durum').textContent = durum.yolModu ? ç`açık` : ç`kapalı`;

  if (durum.yolModu) {
    iz.basla();
    // Dokunuş hâlâ sürüyorken ses düzeneğini aç — sonra uyarı sessiz kalmasın.
    const sesVar = await sesDuzenegiHazirla();
    try {
      durum.uyanikKilit = await navigator.wakeLock?.request('screen');
      durum.uyanikKilit?.addEventListener('release', () => { durum.uyanikKilit = null; });
    } catch { /* Wake Lock yoksa ekran normal davranır */ }
    $('#btnYolModu .yol-alt').textContent =
      (durum.uyanikKilit ? ç`Açık — ekran sönmeyecek` : ç`Açık`) +
      (sesVar ? ç`, durağa yaklaşınca sesle uyaracak` : ç`, uyarı ekranda çıkacak (ses açılamadı)`);
    kayitBildir(sesVar
      ? ç`Yol Modu açık · ekran sönmeyecek`
      : ç`Yol Modu açık ama ses açılamadı: uyarı yalnızca ekranda çıkar.`, sesVar ? 'iyi' : 'orta');
  } else {
    durum.uyanikKilit?.release();
    durum.uyanikKilit = null;
    sesDuzenegiKapat();
    $('#btnYolModu .yol-alt').textContent = ç`Ekran açık kalır, durağa yaklaşınca uyarır`;
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

// Bağlantının beş hâli, tasarımın cümleleriyle. Ayrı bir işlev olmasının
// sebebi: mobil veride "bağlı" demek yetmiyor — büyük işlerin yapılıp
// yapılmadığı da bu satırda söyleniyor.
function baglantiDurumu(ag, kip) {
  const mobil = kip === 'mobil' || kip === 'mobilTam';
  if (!ag) return mobil ? ç`mobil veri var · izin bekliyor` : ç`internet yok`;
  if (!mobil) return ç`wi-fi · bağlı`;
  return baglanti.KIPLER[kip]?.buyukIsler
    ? ç`mobil veri · izin verildi`
    : ç`mobil veri · yalnızca küçük işler`;
}

function panelSatiri({ etiket, deger = '', id = '', rozet = '' }) {
  return `<button class="panel-satir dokunulur"${id ? ` id="${id}"` : ''}>
    <span class="etiket">${etiket}</span>
    <span class="deger">${deger}${rozet ? `<span class="satir-rozet">${kacis(String(rozet))}</span>` : ''}</span>
  </button>`;
}

// Panel kabuğu. Başlık bir düğme: dokununca açılıp kapanıyor, ok dönüyor.
// `uyari` doğruysa başlığın yanına bir yıldız düşüyor — panel kapalıyken bile
// içeride bekleyen bir şey olduğu görünsün diye.
// Hangi panellerin açıklaması açık. Panel kapanıp açılınca da hatırlanıyor,
// ama uygulama kapanınca sıfırlanıyor: bu bir tercih değil, o anki merak.
const acikBilgiler = new Set();

/**
 * Panel başlığındaki küçük açıklama artık hep görünmüyor.
 *
 * Sebebi: beş panelin altında beşer satır gri yazı vardı ve hiçbiri bir işe
 * yaramıyordu — bir kez okunduktan sonra sadece yer kaplıyorlardı. Ama
 * silmek de olmazdı; ilk kez bakan biri "bu panel ne işe yarıyor" diye
 * sorabilir.
 *
 * Çözüm: başlığın sağındaki (i) harfi. Basınca açıklama açılıyor, bir daha
 * basınca kapanıyor. Açıklaması olmayan panelde harf de yok.
 */
function panelKur({ ad, uyari = false, ic, not = '' }) {
  const acik = acikPanel === ad;
  const bilgiAcik = acikBilgiler.has(ad);
  return `<div class="panel${acik ? ' acik' : ''}">
    <div class="panel-ust">
      <button class="panel-baslik katlanir" data-panel="${kacis(ad)}">
        <span>${kacis(ad)}</span>${uyari ? '<span class="panel-yildiz">*</span>' : ''}
        <span class="panel-ok">▼</span>
      </button>
      ${not ? `<button class="panel-bilgi${bilgiAcik ? ' acik' : ''}"
        data-bilgi="${kacis(ad)}" aria-label="${kacis(ad)} nedir?"
        aria-expanded="${bilgiAcik}">i</button>` : ''}
    </div>
    ${not && bilgiAcik ? `<div class="panel-not bilgi-not">${not}</div>` : ''}
    <div class="panel-ic"${acik ? '' : ' hidden'}>${ic}</div>
  </div>`;
}

/**
 * Gerok panelindeki bekçi satırı.
 *
 * Katlanan bir panel DEĞİL, tek bir düğme: bekçi bir ayar değil, konuşulacak
 * biri. Beş panelin arasına altıncı bir katlanır kutu koymak onu ayarların
 * içinde kaybederdi.
 */
function bekciSatiri() {
  const o = bekci.ozet();
  return `<button class="bekci-satir" id="btnBekci">
    <span class="bk-nokta ${o.sinif}"></span>
    <span class="bekci-yazi">
      <b>${ç`Bekçi`}</b>
      <div class="bekci-durum ${o.sinif === 'kotu' ? 'kotu' : o.sinif === 'akil' ? 'akil' : ''}">${kacis(o.yazi)}</div>
    </span>
    <span class="bekci-ok">›</span>
  </button>`;
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

  // "Alındı" ile "doğrulandı" AYRI gösteriliyor. Telefon dosyanın nereye
  // gittiğini göremiyor; doğrulanmamış bir yedek bir iddia, olgu değil.
  const ydg = await yedekDogrulamaDurumu();
  const dogruMu = ydg.dogrulandi && yedek && ydg.dogrulandi >= yedek;
  const yedekYazi = yedek
    ? gerok.tarihUzun(yedek) + ' ' + gerok.saat(yedek)
      + (dogruMu ? ç` · doğrulandı${ydg.sayi ? ç` (${ydg.sayi} kayıt)` : ''}`
                 : ' · ' + ç`DOĞRULANMADI`)
    : ç`hiç alınmadı`;

  const bulut = await veri.ayarOku('sonBulut', null);
  const bulutYazi = bulut
    ? gerok.tarihUzun(bulut) + ' ' + gerok.saat(bulut)
    : ç`hiç yüklenmedi`;

  const sinama = await veri.ayarOku('sonSinama', null);
  const sinamaYazi = sinama
    ? `${gerok.tarihUzun(sinama.an)} ${gerok.saat(sinama.an)} · ` +
      (sinama.saglam ? ç`okunabilir ✓` : ç`eksik var`)
    : ç`sınanmadı`;

  // Etiket bilerek KİŞİSİZ. Önceden gelen kayıtlardan arkadaşın adı okunup
  // "Günü Berxik'e gönder" yazıyordu. İki sorunu vardı: uygulamayı kuran
  // herkes bunu yanındaki kişiye gönderecek, o kişi de her gezide başkası
  // olacak; ve ekranda duran bir isim, telefonu birine gösterdiğinde
  // yanındakinin adını da göstermek demek.
  const gonderEtiketi = ç`Günü yol arkadaşına gönder`;

  // Bağlantı kuyruğu: internet bulununca tamamlanacak işler.
  const ag = await baglanti.agVarMi();
  const kuyruk = await baglanti.kuyrukDurumu();

  $('#gerokPanel').innerHTML = `
    <div class="panel">
      <div class="panel-baslik">${ç`bu gezi`}</div>
      ${s ? `
        <div class="panel-satir"><span class="etiket">Gerok</span><span class="deger">${kacis(s.ad)}</span></div>
        <div class="panel-satir"><span class="etiket">${ç`Kayıt`}</span>
          <span class="deger sayi-izgara">
            <span title="${ç`yazı, işaret, sınır`}"><i data-ikon="kalem" data-ikon-boy="14"></i>${yaziSayi}</span>
            <span title="${ç`ses kayıtları`}"><i data-ikon="dalga" data-ikon-boy="14"></i>${sesSayi}</span>
            <span title="${ç`fotoğraf ve video`}"><i data-ikon="gorsel" data-ikon-boy="14"></i>${gorselSayi}</span>
            <span title="${ç`tanıştığınız kişiler`}"><i data-ikon="kisi" data-ikon-boy="14"></i>${kisiSayi}</span>
          </span></div>
        ${s.karayoluKm ? `
        <div class="panel-satir"><span class="etiket">${ç`Yol`}</span>
          <span class="deger">${Math.round(s.karayoluKm).toLocaleString('tr-TR')} km${
            s.ucusKm ? ' · ' + ç`${Math.round(s.ucusKm).toLocaleString('tr-TR')} km uçuş` : ''}</span></div>
        <div class="panel-satir"><span class="etiket">${ç`İz kaydı`}</span>
          <span class="deger">${ç`${km.toFixed(1)} km · ${durum.izNoktalari.length} nokta`}</span></div>`
        : `
        <div class="panel-satir"><span class="etiket">${ç`İz kaydı`}</span>
          <span class="deger">${ç`${km.toFixed(1)} km · ${durum.izNoktalari.length} nokta`}</span></div>`}
        <div class="panel-satir harcama-ust"><span class="etiket">${ç`Harcama`}</span>
          <span class="deger">
            <span>${harcamaEuro ? euroYaz(harcamaEuro) : (harcamalar.length ? tutarYaz(paralar) : '—')}</span>
            <button class="satir-dugme" id="btnHarcamaListe">${ç`Döküm`}</button>
          </span></div>
        <div class="panel-not kucuk">${harcamaEuro
          ? (harcamaEuro.eksik
              // Kur işi bitmemiş: hangi tarihin kuruyla hesaplandığını söylemek
              // şart. Yoksa toplam kesin bir sayı gibi duruyor, oysa değil.
              ? ç`Son bilinen kurla: ${gerok.tarihUzun(harcamaEuro.sonKurAni || Date.now())}. İnternete bağlanınca günlük kurlarla yeniden hesaplanır.`
              : ç`Her harcama kendi günündeki kurla hesaplandı.`) +
            '<br>' + ç`Para birimlerine göre: ${tutarYaz(paralar)}`
          : ç`Para birimleri ayrı toplanıyor. Tek toplam için Bağlantı → “Harcamaların kurunu düzelt”.`}</div>
      ` : `<div class="panel-not">${ç`Gerok paketi yüklenmedi.`}</div>`}
      <button class="eylem-dugme birincil${gunSonuGerek ? ' nabiz' : ''}" id="btnGunSonu">${ç`Gün Sonu'nu başlat`}</button>
      ${gunSonuGerek ? `<div class="panel-uyari-yazi">${ç`Bugün henüz sesli günlük yok`}</div>` : ''}
    </div>

    ${bekciSatiri()}

    ${panelKur({
      ad: ç`bağlantı`,
      uyari: kuyruk.bekleyenToplam > 0,
      ic: `
        <div class="net-durum">
          <span class="net-led${ag ? ' acik' : ''}"></span>
          <span class="net-yazi">${kacis(baglantiDurumu(ag, kuyruk.kip))}</span>
          <span class="net-kipler">
            ${[['wifi', ç`wi-fi`], ['mobil', ç`mobil veri`]].map(([id, ad]) =>
              `<button class="kucuk-dugme${(kuyruk.kip === id || (id === 'mobil' && kuyruk.kip === 'mobilTam')) ? ' secili' : ''}" data-veri-kipi="${id}">${ad}</button>`).join('')}
          </span>
        </div>

        ${kuyruk.bekleyenToplam
          ? `<div class="net-oneri${ag ? ' acik' : ''}">${ag
              ? ç`${kuyruk.bekleyenToplam} şey bekliyor — şimdi hallolabilir.`
              : ç`${kuyruk.bekleyenToplam} şey internet bekliyor. Otelde wi-fi bulunca tek dokunuşla hallolur; o zamana kadar her şey çevrimdışı çalışmaya devam eder.`}</div>`
          : `<div class="net-oneri">${ç`Bekleyen bir şey yok.`}</div>`}

        <div class="is-liste">
          ${kuyruk.satirlar.map(i => `
            <button class="is-satir${i.sayi ? '' : ' bitti'}" data-is="${i.k}">
              <span class="is-sol">
                <span class="is-ad">${kacis(i.ad)}</span>
                <span class="is-not">${kacis(i.not)}${i.sayi ? ' · ' + ç`${i.sayi} tane` : ''}</span>
              </span>
              <span class="is-durum${i.engelli ? ' engelli' : (i.sayi ? (ag ? ' hazir' : '') : ' bitti')}">
                ${!i.sayi ? ç`bitti` : i.engelli ? ç`wi-fi bekler` : ag ? ç`hallet` : ç`bekliyor`}
              </span>
            </button>`).join('')}
        </div>

        <button class="eylem-dugme${ag && kuyruk.bekleyenToplam ? ' birincil' : ''}" id="btnHepsiniHallet"
          ${kuyruk.bekleyenToplam ? '' : 'disabled'}>
          ${ag ? ç`Hepsini şimdi hallet` : ç`İnternet bulununca hallolacak`}
        </button>
        <div id="netIlerleme" class="panel-not"></div>`,
      not: ç`Gerok internetsiz tam çalışır. Bağlantı yalnızca yukarıdaki işleri düzeltmek için kullanılır. Dışarı giden tek şey: para birimi kodları, kayıtların ve durakların koordinatları. Metin, ses, fotoğraf, isim — hiçbiri gitmiyor, hiçbir kaydın buluta yüklenmiyor.`
    })}

    ${panelKur({
      ad: ç`eşitleme`,
      uyari: yedekEski,
      ic: `
        ${panelSatiri({ etiket: gonderEtiketi,
          deger: ag ? ç`AirDrop · uzaktan` : ç`AirDrop · yan yana`, id: 'btnGonder' })}
        ${panelSatiri({ etiket: ç`Gelen paketi al`, id: 'btnAl' })}
        ${panelSatiri({ etiket: ç`Yedek al`, deger: kacis(yedekYazi), id: 'btnYedek' })}
        ${panelSatiri({ etiket: ç`iCloud ve Drive’ı güncelle`, deger: kacis(bulutYazi), id: 'btnBulut' })}
        ${panelSatiri({ etiket: ç`Yedeği sına`, deger: kacis(sinamaYazi), id: 'btnYedekSina' })}
        ${panelSatiri({ etiket: ç`Yedeği geri yükle`, deger: ç`birleştir · değiştir`, id: 'btnGeriYukle' })}`,
      not: ag
        ? ç`Bağlıyken gün paketi uzaktan da gidebilir — yine dosya olarak, hesapsız.`
        : ç`Sunucu yok, hesap yok. Şu an iki telefon yan yana olmalı; internet varsa uzaktan da gönderilebilir.`
    })}

    ${panelKur({
      ad: ç`bu telefon`,
      uyari: azYer,
      ic: `
        ${panelSatiri({ etiket: ç`Bu telefon`, deger: kacis(sahip.ad || '—') })}
        ${panelSatiri({ etiket: ç`Adı değiştir`, id: 'btnAd' })}
        ${panelSatiri({ etiket: ç`Çevrimdışı harita`, deger: `<span id="haritaDurum">${ç`bakılıyor…`}</span>` })}
        ${depo ? `
          ${panelSatiri({ etiket: ç`Telefonda kullanılan`, deger: boyutYaz(depo.kullanilan) })}
          ${panelSatiri({ etiket: ç`Gerok'a kalan yer`, id: 'btnBosYer',
            deger: (depo.kota ? boyutYaz(depo.kota - depo.kullanilan) : '—') + (azYer ? ' · ' + ç`az` : ''),
            rozet: azYer ? '!' : '' })}
          ${panelSatiri({ etiket: ç`Veri kalıcı korunuyor`, deger: depo.kalici ? ç`evet` : ç`hayır` })}
        ` : ''}
        ${panelSatiri({ etiket: ç`Harita alanı indir`, id: 'btnHaritaAlan',
          deger: `<span id="alanDurum">${ç`bakılıyor…`}</span>` })}
        <span id="tamHaritaSatir"></span>
        ${!depo?.kalici ? panelSatiri({ etiket: ç`Kalıcı depolama iste`, id: 'btnKalici' }) : ''}

        <div class="girdi-etiket">${ç`Dil`}</div>
        <div class="net-kipler dil-secim">
          ${DILLER.map(d => `<button class="kucuk-dugme${
            d.kod === aktifDil() ? ' secili' : ''}" data-dil="${d.kod}">${kacis(d.kendi)}</button>`).join('')}
        </div>

        <div class="girdi-etiket">${ç`Renk`}</div>
        ${renkUclusu()}`,
      not: ç`Görünüm, ad, indirilmiş harita ve yer.`
    })}

    ${panelKur({
      ad: ç`gezi`,
      ic: `
        ${panelSatiri({ etiket: ç`Başlangıç kaydı`, id: 'btnBaslangic',
          deger: ozelVarMi.baslangic ? ç`alındı` : ç`boş` })}
        ${panelSatiri({ etiket: ç`Bitiş kaydı`,
          deger: ozelVarMi.bitis ? ç`alındı` : ç`boş` })}
        ${panelSatiri({ etiket: ç`Mühürlü mektup`, id: 'btnMektup',
          deger: mektupYillari.length
            ? ç`${mektupYillari.length} mektup · ${kacis(mektupYillari.join(', '))}`
            : ç`yok` })}
        ${panelSatiri({ etiket: ç`Şu anki gezi`, deger: s ? kacis(s.ad) : ç`yok` })}
        ${panelSatiri({ etiket: ç`Bütün geziler`, id: 'btnTurlar' })}
        ${panelSatiri({ etiket: ç`Yeni gezi başlat`, id: 'btnYeniTur' })}
        ${panelSatiri({ etiket: ç`Program dosyası yükle`, id: 'btnPaket', deger: 'PDF · .gerok' })}
        ${panelSatiri({ etiket: ç`Paketi dışa ver`, id: 'btnDisaVer', deger: '.gerok' })}

        <div class="cift-izgara">
          <button class="kucuk-dugme" id="btnGeziSonu">${ç`Gezi Sonu’nu başlat`}</button>
          <button class="kucuk-dugme" id="btnMektupYaz">${ç`Mühürlü mektup yaz`}</button>
        </div>`,
      not: ç`Gezinin başı ve sonu, bütün geziler, program dosyası.`
    })}

    ${panelKur({
      ad: ç`sürüm ve yardım`,
      ic: `
        ${panelSatiri({ etiket: ç`Telefondaki sürüm`, id: 'btnSurum',
          deger: `<span id="surumYazi">${ç`bakılıyor…`}</span>` })}
        ${panelSatiri({ etiket: ç`Neler değişti`, id: 'btnDegisiklik' })}
        ${panelSatiri({ etiket: ç`Telefonu sına`, id: 'btnSinama' })}
        ${panelSatiri({ etiket: ç`Nasıl kullanılır`, id: 'btnKurulum',
          // Kurulum ve tamir kılavuzları ayrı HTML sayfaları; henüz
          // çevrilmediler. Kürtçe arayüzdeki biri boşuna dokunmasın diye
          // satırda yazıyor. Türkçede bu not görünmüyor.
          deger: aktifDil() === 'ku' ? ç`şimdilik Türkçe` : '' })}
        ${panelSatiri({ etiket: ç`Tanıtım turunu göster`, id: 'btnRehber',
          deger: ç`baştan gezdir` })}
        ${panelSatiri({ etiket: ç`Uygulamayı paylaş`, id: 'btnPaylas',
          deger: ç`arkadaşına gönder` })}
        ${panelSatiri({ etiket: ç`Bir şey ters giderse`, id: 'btnTamir',
          deger: aktifDil() === 'ku' ? ç`tamir kılavuzu · şimdilik Türkçe` : ç`tamir kılavuzu` })}
        ${panelSatiri({ etiket: ç`Gerok’u yapana yaz`, id: 'btnBanaYaz',
          deger: `<span id="mesajYazi">${ç`bir şey sor ya da söyle`}</span>` })}
        ${panelSatiri({ etiket: ç`Sorun bildir`, id: 'btnSorunBildir',
          deger: kacis(kutuOzetYazi()) })}
        ${panelSatiri({ etiket: ç`Kullanım sayıları`, id: 'btnIstatistik',
          deger: `<span id="istatistikYazi">${ç`bakılıyor…`}</span>` })}`,
      not: ç`Sürüm bilgisi, sınama ve tamir kılavuzu.`
    })}
  `;

  // Panel her çizimde baştan kuruluyor; içindeki ikonlar da yeniden dolsun.
  ikonlariYerlestir($('#gerokPanel'));

  // Panel başlıkları: dokununca aç/kapa, aynı anda bir tanesi açık.
  $$('#gerokPanel [data-panel]').forEach(d => {
    d.addEventListener('click', () => {
      acikPanel = acikPanel === d.dataset.panel ? null : d.dataset.panel;
      paneliCiz();
    });
  });

  $$('#gerokPanel [data-bilgi]').forEach(d => {
    d.addEventListener('click', () => {
      const ad = d.dataset.bilgi;
      acikBilgiler.has(ad) ? acikBilgiler.delete(ad) : acikBilgiler.add(ad);
      paneliCiz();
    });
  });

  surumuYaz();

  // Bu satır sık yanlış anlaşılıyor: telefonun boş alanı DEĞİL, tarayıcının
  // Gerok'a ayırdığı pay. Dokununca aradaki fark söyleniyor.
  $('#btnBosYer')?.addEventListener('click', () => kayitBildir(azYer
    ? ç`Gerok'a ayrılan yer azaldı · harita paketini silebilirsin, videolar zaten galeride`
    : ç`Telefonun boş alanı değil — tarayıcının Gerok'a ayırdığı pay. Telefon dolarsa iOS bunu küçültür; gerçek boş alan Ayarlar → Genel → iPhone Saklama Alanı’nda yazıyor.`));

  $('#btnBekci')?.addEventListener('click', () => bekci.bekciAc());
  $('#btnHarcamaListe')?.addEventListener('click', harcamaDokumuAc);
  $('#btnHarcamaEkle')?.addEventListener('click', fiyatSor);
  renkDugmeleriniKur();
  baglantiPaneliniKur(ag, kuyruk);

  $('#btnGunSonu').addEventListener('click', () => gunSonuAc(durum, tazele, yedekAlVeDogrula));
  $('#btnGonder').addEventListener('click', () => paketGonder(kayitBildir));
  $('#btnAl').addEventListener('click', () => paketAl(kayitBildir, tazele));
  $('#btnYedek').addEventListener('click', yedekAlVeDogrula);
  $('#btnBulut').addEventListener('click', async () => {
    await bulutaYukle(kayitBildir);
    paneliCiz();
  });
  $('#btnYedekSina').addEventListener('click', yedegiSina);
  $('#btnGeriYukle').addEventListener('click', () =>
    yedektenGeriYukle(kayitBildir, tazele, geriYuklemeOnayi));
  // Dil değişince sayfa yeniden yükleniyor: ekranların bir kısmı açılışta
  // bir kez çiziliyor, tek tek yeniden çizdirmek yerine baştan yüklemek hem
  // kesin hem de çevrimdışı uygulamada göz açıp kapayana kadar sürüyor.
  $$('#gerokPanel [data-dil]').forEach(d => {
    d.addEventListener('click', () => { if (dilSec(d.dataset.dil)) location.reload(); });
  });

  $('#btnAd').addEventListener('click', adSor);
  $('#btnBaslangic').addEventListener('click', () => baslangicKaydiAc(tazele));
  $('#btnGeziSonu').addEventListener('click', () => geziSonuAc(durum, tazele));
  // İki giriş de aynı akışı açıyor: satırdaki bilgi ve alttaki düğme.
  $('#btnMektup').addEventListener('click', () => mektupAc(tazele));
  $('#btnMektupYaz')?.addEventListener('click', () => mektupAc(tazele));
  // Dışa verme ile yedek alma aynı dosyayı üretiyor; iki ayrı yol değil,
  // aynı yolun iki girişi.
  $('#btnDisaVer')?.addEventListener('click', () => yedekAl(kayitBildir));
  $('#btnPaket').addEventListener('click', () => sihirbaziAc({
    ortuAc, ortuKapat, bildir: kayitBildir,
    tazele: async () => {
      iz.gerokAyarla(gerok.aktifGerok()?.id);
      gosterilenSayi = SAYFA_ADIMI;
      await tazele();
      if (durum.ekran === 'harita') haritaGuncelle(durum.kayitlar, durum.izNoktalari);
    }
  }));
  $('#btnTurlar').addEventListener('click', turlariYonet);
  $('#btnDegisiklik').addEventListener('click', degisiklikleriGoster);
  $('#btnYeniTur').addEventListener('click', () => yeniTurSor());
  $('#btnHaritaAlan').addEventListener('click', inenAlanlariGoster);
  alanDurumunuYaz();
  $('#btnSurum').addEventListener('click', surumuAra);
  // Sınama ve kurulum kartı ana ekrandan kurulu uygulamada adres çubuğu
  // olmadığı için başka türlü açılamıyordu — teknik olmayan biri oraya
  // hiç ulaşamazdı. İkisi de çevrimdışı önbellekte, yolda da açılır.
  $('#btnSinama').addEventListener('click', async () => {
    const d = await veri.depolamaDurumu();
    const mik = !durum.mikrofonRed;
    const kon = !durum.konumRed;
    const har = await (await import('./harita.js')).haritaVarMi().catch(() => false);
    const im = (v) => v ? '✓' : '✗';
    kayitBildir(`Sınama: mikrofon ${im(mik)} · depo ${im(d?.kota)} · ` +
      `konum ${im(kon)} · harita ${im(har)}`, (mik && kon && har) ? 'iyi' : '');
    window.open('./sinama.html', '_blank');
  });
  $('#btnKurulum').addEventListener('click', () => window.open('./kurulum.html', '_blank'));
  $('#btnRehber').addEventListener('click', () => rehber.rehberiAc({ ekranAc }));
  $('#btnPaylas').addEventListener('click', uygulamayiPaylas);
  $('#btnSorunBildir').addEventListener('click', () => sorunBildir());
  $('#btnBanaYaz').addEventListener('click', () => banaYaz());
  $('#btnIstatistik').addEventListener('click', istatistikAyariniSor);
  istatistikSatiriniYaz();
  $('#btnTamir').addEventListener('click', () => window.open('./tamir.html', '_blank'));
  $('#btnKalici')?.addEventListener('click', async () => {
    const s = await veri.kaliciDepolamaIste();
    kayitBildir(s.kalici ? ç`Kalıcı depolama açıldı.` : ç`iOS şimdilik vermedi — yedek almayı ihmal etme.`,
      s.kalici ? 'iyi' : 'kotu');
    paneliCiz();
  });

  // Bu satır artık İNEN ALANLARI sayıyor. Eskiden tek bir 375 MB'lık dosya
  // vardı ve "indirilmedi" demek "harita yok" demekti; artık internet varken
  // harita zaten çalışıyor, inen alanlar yalnızca çevrimdışı için.
  const { haritaVarMi } = await import('./harita.js');
  const tam = await haritaVarMi().catch(() => 0);
  const alanlar = await haritaAlan.yerelKaroDurumu();
  const e = $('#haritaDurum');
  if (e) {
    const parcalar = [];
    if (alanlar.karo) parcalar.push(`${boyutYaz(alanlar.bayt)} alan`);
    if (tam) parcalar.push(`${boyutYaz(tam)} eski tam harita`);
    e.textContent = parcalar.length ? parcalar.join(' · ') : ç`çevrimdışı alan yok`;
  }
}

// --------------------------------------------------------------- diyaloglar -

function adSor() {
  ortuAc(`
    <div class="ortu-baslik">${ç`Adın ne?`}</div>
    <div class="ortu-alt">${ç`Her kaydın kime ait olduğu bununla yazılacak. İki telefonun kayıtları birleşince kimin ne söylediği belli olsun diye.`}</div>
    <input class="girdi" id="adGirdi" placeholder="${ç`Adın`}" autocomplete="off" enterkeyhint="done">
    <button class="eylem-dugme birincil" id="adKaydet">${ç`Kaydet`}</button>
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
    // Ve rehber ancak şimdi: yeni kullanıcının ilk gördüğü şey adını
    // sormak, ikincisi rehber. Üst üste değil, sırayla.
    setTimeout(rehberiDusun, 600);
  };
  $('#adKaydet').addEventListener('click', kaydet);
  girdi.addEventListener('keydown', (e) => { if (e.key === 'Enter') kaydet(); });
}

// Tasarımın kuralı: onay NEREYE gittiğini söyler. "Kaydedildi." tek başına
// yolda hiçbir şey anlatmıyordu — hangi güne düştüğü asıl merak edilen.
function kaydedildiMetni(t = Date.now()) {
  return `Kaydedildi · ${gerok.tarihUzun(t)}`;
}

function yaziSor() {
  ortuAc(`
    <div class="ortu-baslik">${ç`Yazılı not`}</div>
    <div class="ortu-alt">${ç`Defterin sayfasına bir satır.`}</div>
    <div class="girdi-etiket">${ç`Not`}</div>
    <textarea class="alan" id="yaziAlan" placeholder="${ç`Ne oldu?`}"></textarea>
    <div class="girdi-etiket">${ç`Yer (isteğe bağlı)`}</div>
    <input class="girdi" id="yaziYer" placeholder="${ç`Ohrid, göl kıyısı`}">
    <button class="eylem-dugme birincil" id="yaziKaydet">${ç`Kaydet`}</button>
  `);
  setTimeout(() => $('#yaziAlan').focus(), 120);
  $('#yaziKaydet').addEventListener('click', async () => {
    const m = $('#yaziAlan').value;
    const yer = $('#yaziYer').value.trim();
    ortuKapat();
    if (await kayit.yaziEkle(m, yer)) { kayitBildir(kaydedildiMetni(), 'iyi'); await tazele(); }
  });
}

function kisiSor() {
  ortuAc(`
    <div class="ortu-baslik">${ç`Tanıştık`}</div>
    <div class="ortu-alt">${ç`On yıl sonra adını hatırlamayacaksın.`}</div>
    <div class="girdi-etiket">${ç`Adı`}</div>
    <input class="girdi" id="kisiAd" placeholder="Goran">
    <div class="girdi-etiket">${ç`Tek satır not`}</div>
    <input class="girdi" id="kisiNot" placeholder="${ç`Tekne sahibi, sabah 7 tavsiyesi`}">

    <div class="girdi-etiket">${ç`Fotoğraf (isteğe bağlı)`}</div>
    <button class="eylem-dugme" id="kisiFotoSec">${ç`Fotoğraf seç`}</button>
    <div class="kisi-secim" id="kisiSecim" hidden>
      <img id="kisiOnizleme" alt="">
      <button class="kucuk-dugme sil" id="kisiFotoKaldir">${ç`Kaldır`}</button>
    </div>
    <input type="file" id="kisiFotoGirdi" accept="image/*" hidden>

    <button class="eylem-dugme birincil" id="kisiKaydet">${ç`Kaydet`}</button>
  `);
  setTimeout(() => $('#kisiAd').focus(), 120);

  // Seçilen dosya kaydedilene kadar hiçbir yere yazılmıyor; "Vazgeç"le
  // kapatılırsa depoda iz kalmasın.
  let secilenDosya = null;
  let onizlemeAdres = null;

  const onizlemeyiBirak = () => {
    if (onizlemeAdres) { URL.revokeObjectURL(onizlemeAdres); onizlemeAdres = null; }
  };

  $('#kisiFotoSec').addEventListener('click', () => $('#kisiFotoGirdi').click());
  $('#kisiFotoGirdi').addEventListener('change', (e) => {
    const d = e.target.files?.[0];
    if (!d) return;
    secilenDosya = d;
    onizlemeyiBirak();
    onizlemeAdres = URL.createObjectURL(d);
    $('#kisiOnizleme').src = onizlemeAdres;
    $('#kisiSecim').hidden = false;
    $('#kisiFotoSec').textContent = ç`Başka fotoğraf seç`;
  });
  $('#kisiFotoKaldir').addEventListener('click', () => {
    secilenDosya = null;
    onizlemeyiBirak();
    $('#kisiSecim').hidden = true;
    $('#kisiFotoGirdi').value = '';
    $('#kisiFotoSec').textContent = ç`Fotoğraf seç`;
  });

  $('#kisiKaydet').addEventListener('click', async () => {
    const ad = $('#kisiAd').value, not = $('#kisiNot').value;
    const dosya = secilenDosya;
    onizlemeyiBirak();
    ortuKapat();
    if (dosya) kayitBildir(ç`Fotoğraf küçültülüyor…`);
    if (await kayit.kisiEkle(ad, not, dosya)) {
      kayitBildir(kaydedildiMetni(), 'iyi');
      await tazele();
    }
  });
}

function fiyatSor() {
  // Son kullanılan para birimi hatırlanıyor: aynı ülkede her seferinde
  // yeniden yazmak zorunda kalma.
  const sonPara = durum.sonParaBirimi || '';

  ortuAc(`
    <div class="ortu-baslik">${ç`Harcama`}</div>
    <div class="ortu-alt">${ç`Tutar ve para birimi ayrı ayrı toplanır.`}</div>
    <div class="girdi-etiket">${ç`Ne alındı`}</div>
    <input class="girdi" id="fiyatNe" placeholder="${kacis(ç`Öğle yemeği`)}">
    <div class="girdi-etiket">${ç`Tutar ve para birimi`}</div>
    <div class="girdi-cift">
      <input class="girdi" id="fiyatTutar" placeholder="480" inputmode="decimal">
      <input class="girdi" id="fiyatPara" placeholder="MKD" value="${kacis(sonPara)}">
    </div>
    <div class="girdi-etiket">${ç`Kategori`}</div>
    <div class="secenekler" id="fiyatKategori">
      ${kayit.HARCAMA_KATEGORILERI.map((k, i) =>
        // data-kategori TÜRKÇE kalıyor: o kaydın içine yazılan VERİ. Ekranda
        // görünen ad çevriliyor, saklanan değer değil — yoksa dil değişince
        // eski kayıtların kategorisi tanınmaz olur.
        `<button class="kucuk-dugme ${i === 0 ? 'secili' : ''}" data-kategori="${kacis(k)}">${kacis(ç(k))}</button>`).join('')}
    </div>
    <button class="eylem-dugme birincil" id="fiyatKaydet">${ç`Kaydet`}</button>
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
      kayitBildir(kaydedildiMetni(), 'iyi');
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
      // Mobil veriye geçmek HER ZAMAN onay penceresinden geçiyor: izin
      // "bu bağlantı boyunca" geçerli, kalıcı bir ayar değil.
      const mobildeyiz = kuyruk.kip === 'mobil' || kuyruk.kip === 'mobilTam';
      if (kip === 'mobil' && !mobildeyiz) { mobilVeriSor(); return; }
      await baglanti.veriKipiYaz(kip);
      kayitBildir(kip === 'wifi' ? ç`Wi-fi bulundu` : ç`Yalnızca küçük işler · harita ve yedek wi-fi bekliyor`, 'iyi');
      paneliCiz();
    });
  });

  $$('#gerokPanel [data-is]').forEach(d => {
    d.addEventListener('click', () => isCalistir(d.dataset.is, ag, kuyruk));
  });

  $('#btnHepsiniHallet')?.addEventListener('click', async () => {
    if (!ag) {
      kayitBildir(ç`İnternet yok · bağlanınca hepsi kendiliğinden hallolur`, 'kotu');
      return;
    }
    let yapilan = 0;
    for (const i of kuyruk.satirlar) {
      if (!i.sayi || i.engelli) continue;
      await isCalistir(i.k, ag, kuyruk, { sessiz: true });
      yapilan++;
    }
    kayitBildir(ç`${yapilan} iş halledildi`, 'iyi');
    paneliCiz();
  });
}

async function isCalistir(anahtar, ag, kuyruk, { sessiz = false } = {}) {
  const is = kuyruk.satirlar.find(x => x.k === anahtar);
  if (!is) return;

  if (!is.sayi) { if (!sessiz) kayitBildir(ç`${is.ad} · bekleyen bir şey yok.`); return; }
  if (!ag) {
    if (!sessiz) kayitBildir(ç`İnternet yok · bağlanınca kendiliğinden hallolur`, 'kotu');
    return;
  }
  if (is.engelli) {
    if (!sessiz) kayitBildir(ç`${is.boyutYazi || ç`Bu iş`} · mobil veride indirilmiyor, wi-fi bekliyor`, 'kotu');
    return;
  }

  // Harita kendi akışını açıyor: önce alan seçiliyor, indirme ondan sonra.
  if (anahtar === 'harita') { haritaAlaniSec(); return; }

  const yaz = (m) => { const e = $('#netIlerleme'); if (e) e.textContent = m; kayitBildir(m); };
  yaz(`${is.ad}…`);

  try {
    const sonuc = await is.calistir((y, t) => yaz(`${is.ad}… ${y}/${t}`));
    kayitBildir(sonuc.mesaj, sonuc.yapilan ? 'iyi' : '');
    await tazele();
    if (!sessiz) paneliCiz();
  } catch (hata) {
    kayitBildir(ç`${is.ad} olmadı: ${hata.message}`, 'kotu');
  }
}

// Mobil veri onayı. Tasarımın kararı: büyük indirmeler için ayrıca izin
// istenir, çünkü sürpriz fatura gezinin en gereksiz sürprizi olur.
function mobilVeriSor() {
  ortuAc(`
    <div class="gs-sayac">wi-fi yok · mobil veri var</div>
    <div class="ortu-baslik">Mobil veri kullanılsın mı?</div>
    <div class="ortu-alt">Gerok kendi başına veri harcamaz. İzin verirsen
    yalnızca bekleyen şu işler için kullanır.</div>
    <div class="gs-liste">
      <div class="gs-liste-satir"><div class="gs-liste-ad">Kurlar, yer adları, durak bilgisi</div>
        <div class="gs-liste-alt">birkaç yüz kilobayt</div></div>
      <div class="gs-liste-satir"><div class="gs-liste-ad">Rotanın önündeki harita</div>
        <div class="gs-liste-alt">yüzlerce megabayt — yalnızca "hepsine izin ver" derse</div></div>
    </div>
    <button class="eylem-dugme onayli" id="mobilKucuk">Yalnızca küçük işler</button>
    <button class="eylem-dugme birincil" id="mobilHepsi">Hepsine izin ver</button>
    <button class="eylem-dugme" id="mobilVazgec">Wi-fi bekle</button>
  `, true, 'mobil');
  $('#mobilKucuk').addEventListener('click', async () => {
    ortuKapat();
    await baglanti.veriKipiYaz('mobil');
    kayitBildir(ç`Yalnızca küçük işler · harita ve yedek wi-fi bekliyor`, 'iyi');
    paneliCiz();
  });
  $('#mobilHepsi').addEventListener('click', async () => {
    ortuKapat();
    await baglanti.veriKipiYaz('mobilTam');
    kayitBildir(ç`Mobil veriye izin verildi · bu bağlantı boyunca`, 'iyi');
    paneliCiz();
  });
  $('#mobilVazgec').addEventListener('click', ortuKapat);
}

// ----------------------------------------------------------------- renk --
//
// İki renk seçicisi. Telefonun kendi renk çarkı açılıyor (`input type=color`)
// — sekiz hazır isim yerine sınırsız renk. Renk seçilirken canlı uygulanıyor
// ki çarkı kapatmadan sonucu görülebilsin; "Vazgeç"e basılırsa eski rengine
// dönüyor.

function renkSecicisiAc({ baslik, alt, baslangic, ozelMi, uygula, sifirla, sifirlaYazi }) {
  ortuAc(`
    <div class="ortu-baslik">${baslik}</div>
    <div class="ortu-alt">${alt}</div>
    <input type="color" class="renk-secici" id="renkGirdi" value="${baslangic}">
    <button class="eylem-dugme birincil" id="renkTamam">Tamam</button>
    ${ozelMi ? `<button class="eylem-dugme" id="renkSifirla">${sifirlaYazi}</button>` : ''}
    <button class="eylem-dugme" id="renkVazgec">Vazgeç</button>
  `);
  const eski = ozelMi ? baslangic : null;
  const girdi = $('#renkGirdi');
  girdi.addEventListener('input', () => uygula(girdi.value));
  $('#renkTamam').addEventListener('click', () => {
    uygula(girdi.value);
    ortuKapat();
    kayitBildir(ç`Renk değişti`, 'iyi');
    paneliCiz();
  });
  $('#renkSifirla')?.addEventListener('click', () => {
    sifirla();
    ortuKapat();
    kayitBildir(ç`Renk eski hâline döndü`, 'iyi');
    paneliCiz();
  });
  $('#renkVazgec').addEventListener('click', () => {
    if (eski) uygula(eski); else sifirla();
    ortuKapat();
  });
}

/**
 * Üç renk düğmesi yan yana: 7 günlük · Zemin · Düğmeler.
 *
 * Kutu yok, çerçeve yok, altında durum yazısı yok — üç renk dairesi ve üç
 * kelime. Renk ayarının kendisi bir görünüş meselesi; ayarın durduğu yer de
 * form gibi değil, renk gibi görünmeli. Hangisinin açık olduğu dairenin
 * çevresindeki ince halkadan okunuyor, yazıdan değil.
 *
 * Daireler gerçek değerleri gösteriyor: zemin dairesi kâğıdın rengi, ötekiler
 * vurgunun. Dokunmadan önce ne değişeceği belli.
 *
 * "7 günlük" VARSAYILAN: dokununca hem zemin hem düğmeler kendi
 * varsayılanlarına dönüyor — yani tek düğme "her şeyi eski hâline al"
 * demek. İki ayrı sıfırlama aramak gerekmiyor.
 */
/**
 * "7 günlük" dairesinin içi: yedi günün rengi, koni biçiminde yan yana.
 *
 * Tek düz renk yanlış söz verirdi — o düğme bir renk seçmiyor, yedi rengin
 * sırasını açıyor. Halka bunu tek bakışta anlatıyor. Dilimler sert geçişli:
 * yumuşak geçişte yedi ayrı gün değil bulanık bir gökkuşağı görünüyordu.
 */
function gunHalkasi() {
  const renkler = gununRenkleri();
  const dilim = 360 / renkler.length;
  const duraklar = renkler
    .map((r, i) => `${r} ${(i * dilim).toFixed(1)}deg ${((i + 1) * dilim).toFixed(1)}deg`)
    .join(',');
  return `conic-gradient(from -90deg, ${duraklar})`;
}

function renkUclusu() {
  const kagit = kagitSecimi();
  const ozel = ozelVurgu();
  const daireler = [
    { id: 'btnGunRengi', ad: ç`7 günlük`, acik: !kagit && !ozel,
      // Yedi günün rengi tek daireye sığmıyor; koni biçiminde yedisi birden.
      ornek: gunHalkasi() },
    { id: 'btnKagitRenk', ad: ç`Zemin`, acik: !!kagit,
      ornek: kagit || 'var(--zemin)' },
    { id: 'btnVurguRenk', ad: ç`Düğmeler`, acik: !!ozel,
      ornek: 'var(--vurgu)' }
  ];
  return `<div class="renk-uclu">
    ${daireler.map(k => `<button class="renk-tas${k.acik ? ' secili' : ''}" id="${k.id}"
        aria-pressed="${k.acik}">
      <i class="renk-daire" style="background:${k.ornek}"></i>
      <span class="renk-ad">${kacis(k.ad)}</span>
    </button>`).join('')}
  </div>`;
}

function renkDugmeleriniKur() {
  // Haftanın günü: seçici açmıyor, tek dokunuşla dönüyor. Yedi rengin
  // hangisinin hangi güne düştüğünü göstermenin bir faydası yok — seçilebilir
  // değiller, sıra kendiliğinden dönüyor.
  // "7 günlük" VARSAYILAN durum: seçici açmıyor, ikisini birden geri alıyor.
  // Zemini ve düğme rengini ayrı ayrı sıfırlamak iki adımdı ve ikincisi
  // unutuluyordu; tek dokunuşla her şey eski hâline dönüyor.
  $('#btnGunRengi')?.addEventListener('click', () => {
    const kagitVar = !!kagitSecimi(), vurguVar = !!ozelVurgu();
    if (!kagitVar && !vurguVar) {
      kayitBildir(ç`Zaten varsayılan · renk haftanın gününe göre dönüyor`);
      return;
    }
    if (kagitVar) kagitSil();
    if (vurguVar) ozelVurguSil(geziGunuNo());
    semayiTazele();
    titret(10);
    kayitBildir(ç`Varsayılana dönüldü · renk haftanın gününe göre dönüyor`, 'iyi');
    paneliCiz();
  });

  $('#btnKagitRenk')?.addEventListener('click', () => renkSecicisiAc({
    baslik: ç`Kâğıdın rengi`,
    alt: ç`Zeminin rengi. Açık bir renk seçersen gündüz kipi, koyu bir renk seçersen gece kipi kendiliğinden açılır — yazılar ve çizgiler bu renkten türetilir.`,
    baslangic: varsayilanKagit(),
    ozelMi: !!kagitSecimi(),
    uygula: (h) => { kagitSec(h); semayiTazele(); },
    sifirla: () => { kagitSil(); semayiTazele(); },
    sifirlaYazi: ç`Telefonun ayarına dön`
  }));

  $('#btnVurguRenk')?.addEventListener('click', () => renkSecicisiAc({
    baslik: ç`Üzerine basılabilecek şeylerin rengi`,
    alt: ç`Düğmeler, seçili sekme, bağlantılar. Kâğıdın rengi değişmez. Bunu boş bırakırsan renk haftanın gününe göre kendiliğinden döner.`,
    baslangic: ozelVurgu() ||
      getComputedStyle(document.documentElement).getPropertyValue('--vurgu').trim() || '#d29346',
    ozelMi: !!ozelVurgu(),
    uygula: (h) => ozelVurguSec(h, geziGunuNo()),
    sifirla: () => ozelVurguSil(geziGunuNo()),
    sifirlaYazi: ç`Haftanın gününe dön`
  }));
}

// ------------------------------------------------------- geri yükleme --
//
// Dosya okundu, sayılar elde: kaç kayıt gelecek, kaç kayıt duruyor. Karar
// burada veriliyor — sayılar ekranda dururken. "Değiştir" kırmızı, çünkü
// gezi verisinin yerine konacak bir şey yok.
function geriYuklemeOnayi({ gelen, mevcut, ad }) {
  return new Promise((cevap) => {
    let verildi = false;
    const bitir = (d) => { if (!verildi) { verildi = true; ortuKapat(); cevap(d); } };

    ortuAc(`
      <div class="ortu-baslik">${ç`Yedek okundu`}</div>
      <div class="ortu-alt">${kacis(ad)}<br>
        ${ç`Dosyada <b>${gelen}</b> kayıt var. Telefonda şu an <b>${mevcut}</b> kayıt duruyor.`}</div>
      <button class="eylem-dugme birincil" id="gyBirlestir">${ç`Birleştir`}</button>
      <div class="panel-not kucuk">${ç`Yedektekiler eklenir. Telefondaki hiçbir şey silinmez — aynı kayıt iki kez eklenmez.`}</div>
      <button class="eylem-dugme sil" id="gyDegistir">${ç`Değiştir`}</button>
      <div class="panel-not kucuk">${ç`Geri yükleme birleştirme değil, değiştirme. Telefonda yedekte olmayan ne varsa silinir — yani yedek alındıktan sonra girdiğin her şey. Geriye tam olarak yedekteki <b>${gelen}</b> kayıt kalır. <b>Geri dönüşü yok.</b>`}</div>
      <button class="eylem-dugme" id="gyVaz">${ç`Vazgeç`}</button>
    `, true, 'geriyukle');

    $('#gyBirlestir').addEventListener('click', () => bitir('birlestir'));
    $('#gyVaz').addEventListener('click', () => bitir(null));
    $('#gyDegistir').addEventListener('click', () => {
      // İkinci kapı. Silinecek sayı burada bir kez daha yazıyor: ilk ekranda
      // "Değiştir"e alışkanlıkla basmak mümkün, bunda değil.
      ortuAc(`
        <div class="ortu-baslik">${ç`${Math.max(0, mevcut - gelen)} kayıt silinecek`}</div>
        <div class="ortu-alt">${ç`Yedekte olmayan kayıtlar — sesleriyle birlikte — silinecek. Geriye yedekteki ${gelen} kayıt kalacak. Bu işlem geri alınamaz. Emin misin?`}</div>
        <button class="eylem-dugme" id="gyOnceYedek">${ç`Önce şimdiki hâli yedekle`}</button>
        <button class="eylem-dugme sil" id="gyEminim">${ç`Evet, sil ve yedeği yükle`}</button>
        <button class="eylem-dugme birincil" id="gyVaz2">${ç`Vazgeç`}</button>
      `, true, 'geriyukle');
      // Kaybolacak olan şeyin bir kopyası alınmadan silinmesi için hiçbir
      // sebep yok. Bu düğme geri yüklemeyi iptal ETMİYOR — dosya inince
      // pencere olduğu yerde duruyor, karar hâlâ verilmemiş oluyor.
      $('#gyOnceYedek').addEventListener('click', async () => {
        await yedekAl(kayitBildir);
        kayitBildir(ç`Şimdiki hâl yedeklendi · sonra geri yükleyebilirsin`, 'iyi');
      });
      $('#gyEminim').addEventListener('click', () => bitir('degistir'));
      $('#gyVaz2').addEventListener('click', () => bitir(null));
    });
  });
}

// ------------------------------------------------------------ yedeği sına --
//
// Yedek almanın sessiz tehlikesi: dosya oluşuyor, boyutu makul görünüyor,
// ama içi bozuk. Bu ancak geri yüklemeye çalıştığın gün — yani her şeyin
// kaybolduğu gün — anlaşılıyor. Bu düğme o günü öne çekiyor.
async function yedegiSina() {
  kayitBildir(ç`Yedek sınanıyor…`);
  try {
    const r = await yedekSina((y, t) => {
      if (t > 3) kayitBildir(ç`Yedek sınanıyor… ${y}/${t} dosya`);
    });
    if (r.saglam) {
      await veri.ayarYaz('sonSinama', { an: Date.now(), saglam: true });
      kayitBildir(ç`Yedek sınandı ✓ · ${boyutYaz(r.boyut)} · ${r.kayitSayi} kayıt okunabiliyor`, 'iyi');
      paneliCiz();
    } else {
      await veri.ayarYaz('sonSinama', { an: Date.now(), saglam: false });
      kayitBildir(ç`Dikkat: ${r.eksik} kaydın ses/görsel dosyası okunamıyor. Yer açıp tekrar dene; olmuyorsa tamir kılavuzuna bak.`, 'kotu');
      paneliCiz();          // sonuç kötü de olsa satır TAZELENMELİ
    }
  } catch (hata) {
    kayitBildir(ç`Yedek sınanamadı: ${hata.message}`, 'kotu');
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

    const kat = (k.kategori || 'diğer').toLocaleLowerCase('tr');
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
    eksik: hepsi.length - cevrilen.length,
    // Çevrilmiş harcamaların en yenisinin tarihi: "son bilinen kur" derken
    // kastedilen gün bu. Kur işi yarım kaldığında panelde yazıyor.
    sonKurAni: Math.max(...cevrilen.map(k => k.kurAni || k.t || 0)) || null
  };
}

function euroYaz(e) {
  return e.toplam.toLocaleString('tr-TR', { maximumFractionDigits: 0 }) + ' \u20ac';
}

function harcamalarPaneli() {
  const { hepsi, paralar } = harcamalariTopla();
  if (!hepsi.length) {
    return `<div class="panel-not">${ç`Henüz harcama yok. Kayıt sekmesinden <b>Harcama</b> ile ekle — her biri saatiyle zaman çizgisine de düşer.`}</div>
      <button class="eylem-dugme" id="btnHarcamaEkle">${ç`Harcama ekle`}</button>`;
  }
  return `
    <div class="panel-satir"><span class="etiket">${ç`Toplam`}</span>
      <span class="deger">${tutarYaz(paralar)}</span></div>
    <div class="panel-satir"><span class="etiket">${ç`Kayıt`}</span>
      <span class="deger">${ç`${hepsi.length} harcama`}</span></div>
    <button class="eylem-dugme" id="btnHarcamaListe">${ç`Dökümü gör`}</button>
    <button class="eylem-dugme" id="btnHarcamaEkle">${ç`Harcama ekle`}</button>`;
}

function harcamaDokumuAc() {
  kayitBildir(ç`Döküm açılıyor · gün gün, tür tür`);
  const { hepsi, paralar, kategoriler, gunler } = harcamalariTopla();
  const euro = euroToplami(hepsi);
  const s = gerok.aktifGerok();

  const gunAdi = (g) => {
    if (g === 'disi') return ç`Gerok dışı`;
    const gun = s?.gunler?.find(x => x.no === g);
    return gun ? ç`Gün ${g} · ${gun.baslik}` : ç`Gün ${g}`;
  };

  const gunSirali = Array.from(gunler.keys()).sort((a, b) => {
    if (a === 'disi') return 1;
    if (b === 'disi') return -1;
    return a - b;
  });

  ortuAc(`
    <div class="ortu-baslik">${ç`Harcamalar`}</div>
    <div class="ortu-alt">${euro
      ? ç`Toplam: <b>${euroYaz(euro)}</b> · ${tutarYaz(paralar)}<br>Her harcama kendi günündeki gerçek kurla çevrildi${euro.eksik ? ç`, ${euro.eksik} tanesi hariç` : ''}.`
      : ç`Toplam: <b>${tutarYaz(paralar)}</b><br>Para birimleri ayrı toplanıyor — tek toplam için Bağlantı → “Harcamaların kurunu düzelt”.`}</div>

    <div class="girdi-etiket">${ç`Kategoriye göre`}</div>
    ${Array.from(kategoriler.entries()).map(([kat, p]) =>
      `<div class="panel-satir"><span class="etiket">${kacis(ç(kat))}</span>
        <span class="deger">${tutarYaz(p)}</span></div>`).join('')}

    <div class="girdi-etiket" style="margin-top:16px">${ç`Güne göre`}</div>
    ${gunSirali.map(g =>
      `<div class="panel-satir"><span class="etiket">${kacis(gunAdi(g))}</span>
        <span class="deger">${tutarYaz(gunler.get(g))}</span></div>`).join('')}

    <div class="girdi-etiket" style="margin-top:16px">${ç`Tek tek (${hepsi.length})`}</div>
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
    <button class="eylem-dugme" id="harcamaKapat">${ç`Kapat`}</button>
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
  return ç`${tarihYaz(bas, 'uzun')} · ${g} gün`;
}

async function turlariYonet() {
  ortuAc(`<div class="ortu-baslik">${ç`Turlar`}</div><div class="ortu-alt">${ç`yükleniyor…`}</div>`);
  const { ozetler, oksuz } = await turOzetleri();
  const aktifId = gerok.aktifGerok()?.id ?? null;

  const kart = ({ tur, kayitSayisi }) => `
    <div class="tur-kart ${tur.id === aktifId ? 'aktif' : ''} ${tur.arsiv ? 'arsiv' : ''}">
      <div class="tur-ust">
        <div class="tur-ad">${kacis(tur.ad)}</div>
        <div class="tur-rozet">${tur.id === aktifId ? ç`şu anki` : tur.arsiv ? ç`arşiv` : ''}</div>
      </div>
      <div class="tur-alt">${kacis(turTarihi(tur))} · ${ç`${kayitSayisi} kayıt`}${tur.kendiKurulmus ? '' : ' · ' + ç`paketten`}</div>
      <div class="durak-dugmeler">
        ${tur.id === aktifId
          ? `<button class="kucuk-dugme" data-arsivle="${tur.id}">${ç`Arşivle`}</button>`
          : `<button class="kucuk-dugme secili" data-gec="${tur.id}">${ç`Bu tura geç`}</button>
             <button class="kucuk-dugme sil" data-tursil="${tur.id}">${ç`Sil`}</button>`}
      </div>
    </div>`;

  ortuAc(`
    <div class="ortu-baslik">${ç`Turlar`}</div>
    <div class="ortu-alt">${ç`Şu anki turun kayıtları ekranlarda görünür. Arşivdekiler telefonda durur, karışmaz; istediğin an geri dönebilirsin.`}</div>
    ${ozetler.map(kart).join('')}
    ${oksuz.length ? `
      <div class="panel-not" style="margin-top:14px">
        ${ç`<b>${oksuz.length} kayıt hiçbir tura bağlı değil.</b> Eski bir turdan kalmış olabilir. Şu anki tura taşıyabilirsin.`}</div>
      <button class="eylem-dugme" id="oksuzTasi">${ç`${oksuz.length} kaydı bu tura taşı`}</button>` : ''}
    <button class="eylem-dugme birincil" id="turYeni">${ç`Yeni tur başlat`}</button>
    <button class="eylem-dugme" id="turKapat">${ç`Kapat`}</button>
  `);

  $('#turKapat').addEventListener('click', ortuKapat);
  $('#turYeni').addEventListener('click', () => yeniTurSor());

  $('#oksuzTasi')?.addEventListener('click', async () => {
    if (!aktifId) { kayitBildir(ç`Önce bir tur başlat.`, 'kotu'); return; }
    ortuKapat();
    const n = await veri.kayitlariTuraTasi(oksuz, aktifId);
    kayitBildir(ç`${n} kayıt bu tura taşındı.`, 'iyi');
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
  kayitBildir(yeni ? ç`"${yeni.ad}" turundasın.` : ç`Aktif tur yok.`, 'iyi');
}


/** Telefondaki harita parçalarının toplamı — ağa hiç çıkmadan. */
async function yerelHaritaMB() {
  try {
    const depo = await import('./depo.js');
    const adlar = await depo.listele('harita');
    let t = 0;
    for (const a of adlar) t += await depo.boyut('harita', a);
    return Math.round(t / 1e6);
  } catch { return 0; }
}


/**
 * "Kullanım sayıları" satırının yazısı.
 *
 * "gönderildi" DEMİYOR, "gönderiliyor" diyor. Sebep: gönderim cevabı
 * okunamayan bir yolla gidiyor (`no-cors`), yani ulaştığı doğrulanamıyor.
 * Uygulamanın bilmediği bir şeyi biliyormuş gibi yazması, bu projede
 * baştan beri kaçınılan şey.
 */
async function istatistikSatiriniYaz() {
  const yer = $('#istatistikYazi');
  if (!yer) return;
  if (!await kutu.istatistikAcikMi()) { yer.textContent = ç`kapalı`; return; }
  const son = await kutu.sonIstatistikZamani();
  yer.textContent = son
    ? ç`haftada bir · son ${gerok.tarihUzun(son)}`
    : ç`haftada bir gönderiliyor`;
}


/**
 * Sayı gönderimini açıp kapatmak.
 *
 * BU DOSYA HERKESE AÇIK — buraya kimsenin adı yazılmaz.
 * Açık geliyor: uygulamanın nasıl kullanıldığını görmek hataların
 * düzelmesini sağlıyor.
 * Ama gizli değil: panelde yazıyor, ne gittiği burada anlatılıyor ve tek
 * dokunuşla kapanıyor. Arkadaşına haber vermeden veri toplamak, bu
 * uygulamanın en baştaki sözüyle bağdaşmazdı.
 */
async function istatistikAyariniSor() {
  const acik = await kutu.istatistikAcikMi();
  const o = kutu.sayacOzeti();
  ortuAc(`
    <div class="ortu-baslik">${ç`Kullanım sayıları`}</div>
    <div class="ortu-alt">${ç`Gerok’u yapana haftada bir kez birkaç sayı gidiyor: kaç kez açıldı, kaç kayıt var, hata çıktı mı, hangi sürüm ve hangi telefon. Hataların düzelmesi buna bakılarak oluyor.`}</div>
    <div class="panel-not">${ç`Notların, seslerin, fotoğrafların, konumun ve adın <b>gitmiyor</b>. Hata yazıları da bu yoldan gitmiyor — onlar yalnızca sen “Sorun bildir” deyip okuduğunda gidiyor.`}</div>
    <details style="margin:14px 0">
      <summary class="panel-not">${ç`Giden şeyin tamamı`}</summary>
      <pre style="white-space:pre-wrap;word-break:break-word;font-size:12px;
        max-height:200px;overflow:auto">${kacis(JSON.stringify(o, null, 1))}</pre>
    </details>
    <button class="eylem-dugme ${acik ? '' : 'birincil'}" id="istAc">
      ${acik ? ç`Açık — kapatmak için dokun` : ç`Kapalı — açmak için dokun`}</button>
    <button class="eylem-dugme" id="istKapat">${ç`Kapat`}</button>
  `);
  $('#istKapat').addEventListener('click', ortuKapat);
  $('#istAc').addEventListener('click', async () => {
    await kutu.istatistikAyarla(!acik);
    ortuKapat();
    kayitBildir(acik ? ç`Sayı gönderimi kapatıldı.` : ç`Sayı gönderimi açıldı.`, 'iyi');
    paneliCiz();
  });
}


/**
 * Rapora eklenecek CANLI sayılar.
 *
 * Neden her çağrı yerine sayaç koymadık: sayaç kodun içine serpiştirilir,
 * biri unutulur ve sayı sessizce yanlış olur. Buradaki sayılar rapor
 * anında veritabanından okunuyor — unutulacak bir yer yok.
 *
 * Yalnızca SAYI çıkıyor. Kaydın türü sayılıyor, içeriği değil; gezinin
 * kaç tane olduğu sayılıyor, adı değil.
 */
async function canliSayilar() {
  try {
    const kayitlar = await veri.kayitlariGetir();
    const tur = {};
    for (const k of kayitlar) tur[k.tur] = (tur[k.tur] || 0) + 1;
    const izler = await veri.izGetir();
    const geziler = await veri.geroklar();
    const yedek = await sonYedekZamani();
    return {
      kayit: kayitlar.length,
      kayitTuru: tur,
      izNoktasi: izler.length,
      gezi: geziler.length,
      // Haritayı YEREL depodan sayıyoruz. `haritaVarMi()` uzaktaki parça
      // listesini indiriyor; rapor ekranı internetsizken de anında açılmalı.
      haritaMB: await yerelHaritaMB(),
      yedekYasiGun: yedek ? Math.round((Date.now() - yedek) / 86400000) : null,
    };
  } catch (h) {
    // Sayı toplarken çıkan bir hata raporu engellememeli: rapor asıl iş.
    return { sayilamadi: String(h.message || h).slice(0, 120) };
  }
}


/**
 * Panel satırında görünen kısa özet: bildirilecek bir şey var mı?
 */
function kutuOzetYazi() {
  const o = kutu.sayacOzeti();
  if (!o) return '';
  const yeni = kutu.bildirilmeyenHatalar().length;
  if (yeni) return ç`${yeni} yeni hata`;
  return o.sayaclar.hata ? ç`hata yok · sayılar hazır` : ç`her şey yolunda`;
}


/**
 * "Sorun bildir" — kara kutuyu sahibine göndermek.
 *
 * KURAL: gönderilecek şey ÖNCE ekranda gösteriliyor. Kimse görmediği bir
 * şeyi göndermek zorunda kalmıyor. Uygulamanın en baştaki sözü "hiçbir şey
 * telefondan çıkmıyor"du; bu kapı o sözü bozmuyor çünkü kapıyı kişi açıyor.
 *
 * Raporun içinde kaydın İÇERİĞİ yok — not, ses, fotoğraf, konum, isim, gezi
 * adı hiçbiri geçmiyor. Bu `kutu.js` tarafında güvence altına alınmış,
 * burada da bekçi sınamasıyla kontrol ediliyor.
 */
async function sorunBildir(otomatikSoruldu = false) {
  const r = kutu.tamRapor();
  if (!r) { kayitBildir(ç`Kara kutu henüz açılmadı.`, 'kotu'); return; }
  r.kullanim = await canliSayilar();

  const metin = JSON.stringify(r, null, 1);
  const satirlar = r.hatalar.length
    ? r.hatalar.slice(-8).reverse().map(h => `
        <div class="gs-liste-satir">
          <div>${kacis(h.ne)}</div>
          <div class="panel-not">${kacis(h.yer || ç`yer bilinmiyor`)}
            ${h.kac > 1 ? ' · ' + ç`${h.kac} kez` : ''} · ${kacis(h.ne_zaman)}</div>
        </div>`).join('')
    : `<div class="panel-not">${ç`Kayıtlı hata yok. Yine de sayıları gönderebilirsin.`}</div>`;

  ortuAc(`
    <div class="ortu-baslik">${ç`Sorun bildir`}</div>
    <div class="ortu-alt">${otomatikSoruldu
      ? ç`Geçen sefer bir şey ters gitti. Aşağıdakini gönderirsen düzeltilebilir.`
      : ç`Gönderilecek şeyin tamamı aşağıda.`}
      ${ç`Notların, seslerin ve fotoğrafların gönderilmiyor. <b>Ama bir hata mesajı, o an elindeki bir yazıyı alıntılamış olabilir.</b> Aşağıyı oku; göndermek istemediğin bir şey varsa gönderme.`}</div>
    <div class="panel-not">${kacis(r.surum)} · ${kacis(r.telefon)} ·
      ${ç`${r.gun} gün · ${r.sayaclar.acilis || 0} açılış`}</div>
    ${satirlar}
    <details style="margin:14px 0">
      <summary class="panel-not">${ç`Ham hali (gönderilecek dosyanın aynısı)`}</summary>
      <pre style="white-space:pre-wrap;word-break:break-word;font-size:12px;
        max-height:220px;overflow:auto">${kacis(metin)}</pre>
    </details>
    <textarea class="girdi" id="sbNot" rows="3"
      placeholder="${ç`İstersen ne olduğunu kendi cümlenle yaz (isteğe bağlı)`}"></textarea>
    <button class="eylem-dugme birincil" id="sbGonder">${ç`Gönder`}</button>
    <button class="eylem-dugme" id="sbSonra">${ç`Şimdi değil`}</button>
  `);

  $('#sbSonra').addEventListener('click', async () => {
    // "Şimdi değil" de bir cevap: aynı hatalar için bir daha sorulmuyor.
    if (otomatikSoruldu) await kutu.bildirildiIsaretle();
    ortuKapat();
  });

  $('#sbGonder').addEventListener('click', async () => {
    // Not ortuKapat'tan ÖNCE okunuyor. Sonra okunduğunda alan silinmiş
    // oluyor ve `?.` sayesinde çökmüyor ama kişinin yazdığı açıklama
    // SESSİZCE düşüyordu — "gönderildi" yazıp notu atmak en kötüsü.
    const ekNot = $('#sbNot')?.value?.trim() || '';
    ortuKapat();
    // Eskiden burada JSON dosyası üretilip "Gerok'u yapana gönder" deniyordu.
    // Kimse onunla uğraşmıyordu: dosyayı kaydet, bul, birine ilet — üç
    // adımda kaybolan bir yol. Artık düğmeye basınca gerçekten gidiyor.
    try {
      const sonuc = await kutu.mesajGonder({ mesaj: ekNot, rapor: r });
      await kutu.bildirildiIsaretle();
      kayitBildir(sonuc === 'kuyrukta'
        ? ç`İnternet yok — rapor kuyruğa alındı, bağlanınca kendiliğinden gidecek.`
        : ç`Rapor gönderildi ✓`, 'iyi');
      paneliCiz();
    } catch (hata) {
      kayitBildir(ç`Gönderilemedi: ${hata.message}`, 'kotu');
    }
  });
}


// --------------------------------------------------- harita alanı seçme ----

/**
 * İnen harita alanları: neler var, ne kadar yer kaplıyor, hangisi silinsin.
 *
 * Alan indirmek tek yönlü bir işlem olmamalı. Telefon dolduğunda ya da bir
 * gezi bittiğinde o alanların gitmesi gerekiyor; yolu yoksa tek çare
 * uygulamayı silmek olurdu ve o da kayıtları götürürdü.
 */
async function inenAlanlariGoster() {
  const alanlar = await haritaAlan.inenAlanlar();
  const d = await haritaAlan.yerelKaroDurumu();

  const satirlar = alanlar.length
    ? alanlar.map((a, i) => {
        const k = a.kutu;
        const orta = `${((k.guney + k.kuzey) / 2).toFixed(2)}, ${((k.bati + k.dogu) / 2).toFixed(2)}`;
        return `
        <div class="gs-liste-satir" style="display:flex;align-items:center;gap:12px">
          <span style="flex:1;min-width:0">
            ${kacis(boyutYaz(a.bayt || 0))} · ${a.karo} karo
            <div class="panel-not">${kacis(orta)} ·
              ${a.enFazlaZ >= 14 ? ç`sokak` : ç`yol`} ·
              ${kacis(gerok.tarihUzun(a.an))}</div>
          </span>
          <button class="satir-dugme" data-alan-sil="${i}">${ç`Sil`}</button>
        </div>`;
      }).join('')
    : `<div class="panel-not">${ç`Henüz alan inmedi. İnternetsizken harita boş kalır.`}</div>`;

  ortuAc(`
    <div class="ortu-baslik">${ç`Çevrimdışı harita alanları`}</div>
    <div class="ortu-alt">${ç`İnternet yokken yalnızca buradaki alanlar açılır. İnternet varken harita her yerde çalışır.`}</div>
    <div class="panel-not">${ç`Toplam ${d.karo} karo · ${kacis(boyutYaz(d.bayt))}`}</div>
    ${satirlar}
    <button class="eylem-dugme birincil" id="alYeni">${ç`Yeni alan indir`}</button>
    ${alanlar.length > 1
      ? `<button class="eylem-dugme sil" id="alHepsi">${ç`Hepsini sil`}</button>` : ''}
    <button class="eylem-dugme" id="alKapat">${ç`Kapat`}</button>
  `);

  $('#alKapat').addEventListener('click', ortuKapat);
  $('#alYeni').addEventListener('click', () => { ortuKapat(); haritaAlaniSec(); });

  $('#alHepsi')?.addEventListener('click', async () => {
    ortuKapat();
    const b = await haritaAlan.alanlariSil();
    kayitBildir(ç`${boyutYaz(b)} yer açıldı.`, 'iyi');
    paneliCiz();
  });

  $$('[data-alan-sil]').forEach(d2 => d2.addEventListener('click', async () => {
    const i = +d2.dataset.alanSil;
    d2.disabled = true; d2.textContent = ç`siliniyor…`;
    const b = await haritaAlan.alanSil(i);
    kayitBildir(ç`Alan silindi · ${boyutYaz(b)} yer açıldı.`, 'iyi');
    paneliCiz();
    inenAlanlariGoster();
  }));
}


// Ayrıntı seviyesi. 14 sokak adı ve bina, 12 yollar ve şehirler.
// 12'de alan yaklaşık on beşte bir yer kaplıyor; uzun bir yol güzergâhı
// için sokak ayrıntısı çoğu zaman gereksiz.
const ALAN_AYRINTI = { sokak: 14, yol: 12 };
let alanAyrinti = 'sokak';
let alanTahminZaman = null;

async function alanDurumunuYaz() {
  const yer = $('#alanDurum');
  if (!yer) return;
  const d = await haritaAlan.yerelKaroDurumu();
  const alanlar = await haritaAlan.inenAlanlar();
  yer.textContent = d.karo
    ? `${alanlar.length} alan · ${boyutYaz(d.bayt)}`
    : ç`henüz alan inmedi`;

  // Eski usul TAM harita duruyorsa yer açmayı öner. Yeni kurulumlarda bu
  // satır hiç görünmüyor — artık tam harita diye bir şey inmiyor.
  const kap = $('#tamHaritaSatir');
  if (!kap) return;
  const { haritaVarMi } = await import('./harita.js');
  const tam = await haritaVarMi().catch(() => 0);
  if (!tam) { kap.innerHTML = ''; return; }
  kap.innerHTML = panelSatiri({ etiket: ç`Eski tam harita`, id: 'btnTamHaritaSil',
    deger: kacis(ç`${boyutYaz(tam)} · yer aç`) });
  $('#btnTamHaritaSil').addEventListener('click', () => tamHaritayiSilSor(tam));
}


/**
 * Eski tam haritayı silmeyi sormak.
 *
 * Silmeden önce ne kaybedileceği açıkça yazılıyor: internetsizken yalnızca
 * indirilmiş alanlar kalacak. Yanlışlıkla basıp gezi ortasında haritasız
 * kalmak, kazanılan 375 MB'dan çok daha pahalıya gelir.
 */
async function tamHaritayiSilSor(boyut) {
  const d = await haritaAlan.yerelKaroDurumu();
  ortuAc(`
    <div class="ortu-baslik">${ç`Eski tam haritayı sil`}</div>
    <div class="ortu-alt">${ç`Telefonunda altı ülkenin tamamı duruyor: ${kacis(boyutYaz(boyut))}. Artık yalnızca ihtiyaç duyduğun alanlar iniyor, bu dosyaya gerek kalmadı.`}</div>
    <div class="panel-not">${ç`Sildikten sonra <b>internetsizken</b> yalnızca indirdiğin alanlar açılır. Şu an ${d.karo ? ç`${d.karo} karo (${kacis(boyutYaz(d.bayt))}) inmiş durumda` : ç`<b>hiç alan inmemiş</b>`}. İnternet varken harita her yerde çalışmaya devam eder.`}</div>
    <button class="eylem-dugme sil" id="thSil">${ç`Sil ve ${kacis(boyutYaz(boyut))} yer aç`}</button>
    <button class="eylem-dugme" id="thVazgec">${ç`Vazgeç`}</button>
  `);
  $('#thVazgec').addEventListener('click', ortuKapat);
  $('#thSil').addEventListener('click', async () => {
    ortuKapat();
    kayitBildir(ç`Siliniyor…`);
    try {
      const { tamHaritayiSil } = await import('./harita.js');
      const s = await tamHaritayiSil();
      kayitBildir(ç`${boyutYaz(s)} yer açıldı.`, 'iyi');
      paneliCiz();
    } catch (hata) {
      kayitBildir(ç`Silinemedi: ${hata.message}`, 'kotu');
    }
  });
}


/**
 * "Harita alanı indir" — haritada gördüğün yeri cihaza almak.
 *
 * Neden kutu çizdirmiyoruz: telefonda parmakla dikdörtgen çizmek haritayı
 * kaydırmakla karışıyor ve iki parmakla yakınlaştırmayı bozuyor. Zaten
 * baktığın yeri indirmek hem tek dokunuş hem de ne alacağını GÖRÜYORSUN.
 */
async function haritaAlaniSec() {
  ekranAc('harita');
  await haritaKur();
  const bar = $('#haritaAlanBar');
  bar.classList.remove('gizli');
  $('#alanAyrinti').textContent = alanAyrinti === 'sokak' ? ç`Sokak` : ç`Yol`;

  const kapat = () => {
    bar.classList.add('gizli');
    hareketiBirak(tahminiTazele);
    clearTimeout(alanTahminZaman);
  };

  $('#alanVazgec').onclick = kapat;

  $('#alanAyrinti').onclick = () => {
    alanAyrinti = alanAyrinti === 'sokak' ? 'yol' : 'sokak';
    $('#alanAyrinti').textContent = alanAyrinti === 'sokak' ? ç`Sokak` : ç`Yol`;
    tahminiTazele();
  };

  $('#alanIndir').onclick = () => alaniIndir(kapat);

  hareketDinle(tahminiTazele);
  tahminiTazele();
}


/**
 * "Ne kadar sürer?" — kaba ama dürüst.
 *
 * sureYaz kullanılmıyor: o ses/video için "0:03" biçiminde yazıyor ve
 * indirme yanında kronometre gibi duruyor.
 *
 * Sayı ölçümden geliyor: Üsküp merkezi, sokak ayrıntısı, 188 karo /
 * 6,4 MB, 10,3 saniye — saniyede 18 karo. Bölen bilerek 15 tutuldu:
 * telefonun bağlantısı masaüstünden yavaş olur ve süreyi olduğundan
 * kısa söylemek, uzun söylemekten kötü.
 */
function indirmeSuresi(karo) {
  const sn = Math.ceil(karo / 15);
  if (sn < 10) return ç`birkaç saniye`;
  if (sn < 90) return ç`≈ ${Math.round(sn / 5) * 5} saniye`;
  return ç`≈ ${Math.round(sn / 60)} dakika`;
}


/**
 * Tahmini yenile.
 *
 * Ağdan ~20 karo okuyor, yani birkaç saniye sürüyor. Her kaydırmada
 * çalışmasın diye gecikmeli; kullanıcı haritayı bırakınca hesaplıyor.
 */
function tahminiTazele() {
  const yer = $('#alanTahmin');
  if (!yer) return;
  clearTimeout(alanTahminZaman);
  yer.textContent = ç`hesaplanıyor…`;
  alanTahminZaman = setTimeout(async () => {
    const kutu = gorunenKutu();
    if (!kutu) return;
    const z = ALAN_AYRINTI[alanAyrinti];

    const t = await haritaAlan.alanTahmini(kutu, z);
    if (t.cokBuyuk) {
      yer.textContent = ç`Alan çok büyük (${t.karo.toLocaleString('tr')} karo). Yakınlaş ya da ayrıntıyı "Yol" yap.`;
    } else if (t.agYok) {
      yer.textContent = ç`İnternet yok — alan indirmek için internet gerekiyor.`;
    } else {
      // "≈" bilerek: örneklemeyle bulunuyor, kesin değil.
      // Süre de yazılıyor: basmadan önce "10 saniye mi, 5 dakika mı"
      // bilinsin. Ölçülen hız saniyede ~20 karo.
      yer.textContent = ç`≈ ${boyutYaz(t.bayt)} · ${t.karo.toLocaleString('tr')} karo · ${indirmeSuresi(t.karo)}`;
    }
  }, 600);
}


async function alaniIndir(kapat) {
  const kutu = gorunenKutu();
  if (!kutu) return;
  const z = ALAN_AYRINTI[alanAyrinti];

  const t = await haritaAlan.alanTahmini(kutu, z);
  if (t.cokBuyuk) {
    kayitBildir(ç`Alan çok büyük — ${t.karo.toLocaleString('tr')} karo. Yakınlaş.`, 'kotu');
    return;
  }
  kapat();
  kayitBildir(ç`Alan iniyor…`);
  try {
    // Yüzde de yazılıyor: "312/2840" tek başına ne kadar kaldığını
    // söylemiyor, insan oranı okumak istiyor.
    const r = await haritaAlan.alanIndir(kutu, z, (y, toplam, bayt) => {
      if (y % 10 === 0 || y === toplam)
        kayitBildir(ç`Alan iniyor… %${Math.round(y / toplam * 100)} · ${y}/${toplam} karo · ${boyutYaz(bayt)}`);
    });
    kayitBildir(ç`Alan indi ✓ · ${boyutYaz(r.bayt)} · ${r.yazilan} karo` +
      (r.atlanan ? ç` · ${r.atlanan} zaten vardı` : ''), 'iyi');
    paneliCiz();
  } catch (hata) {
    kayitBildir(ç`İnmedi: ${hata.message}`, 'kotu');
  }
}


/**
 * Gerok'u yapana doğrudan yazmak.
 *
 * NEDEN VAR: uygulamayı kuran herkes beni tanımıyor, telefon numaramı
 * bilmiyor. Bilse bile "şunu yazayım mı, rahatsız eder miyim" diye
 * yazmıyor. Uygulamanın içinde bir kutu olunca yazıyor.
 *
 * NEDEN E-POSTA YA DA WHATSAPP BAĞLANTISI DEĞİL: bu uygulamanın kaynağı
 * herkese açık. Oraya bir adres ya da kullanıcı adı koymak, o bilgiyi
 * kalıcı ve aranabilir biçimde internete koymak olurdu. Form kanalı
 * kimseye kimin yaptığını söylemeden mesajı iletiyor.
 *
 * NE GİDİYOR: yalnızca yazdığın metin, istersen adın, ve sürüm/telefon
 * türü gibi sayılar. Notların, seslerin, fotoğrafların, gezin gitmiyor.
 */
async function banaYaz() {
  const bekleyen = await kutu.bekleyenMesajSayisi();
  const gecmis = (await kutu.gonderilenMesajlar()).slice(-5).reverse();

  const gecmisYazi = gecmis.length ? `
    <details style="margin:14px 0">
      <summary class="panel-not">${ç`Daha önce yazdıkların (${gecmis.length})`}</summary>
      ${gecmis.map(m => `
        <div class="gs-liste-satir">
          <div>${kacis(m.mesaj || ç`(yalnızca rapor)`)}</div>
          <div class="panel-not">${kacis(gerok.tarihUzun(m.an))}
            ${m.durum === 'kuyrukta' ? ' · ' + ç`<b>henüz gitmedi</b>` : ' · ' + ç`gönderildi`}</div>
        </div>`).join('')}
    </details>` : '';

  ortuAc(`
    <div class="ortu-baslik">${ç`Gerok’u yapana yaz`}</div>
    <div class="ortu-alt">${ç`Bir şey çalışmıyorsa, bir şey eksikse ya da bir fikrin varsa buraya yaz. Doğrudan bana gelir.`}</div>
    ${bekleyen ? `<div class="panel-not">${ç`<b>${bekleyen} mesajın</b> internet bekliyor. Bağlanınca kendiliğinden gidecek.`}</div>` : ''}
    <textarea class="girdi" id="byMetin" rows="5"
      placeholder="${ç`Ne oldu? Ne olsun isterdin?`}"></textarea>
    <input class="girdi" id="byKim" maxlength="60"
      placeholder="${ç`Adın (istersen — boş bırakabilirsin)`}">
    <div class="panel-not">${ç`Giden şey: yazdığın metin, yazdıysan adın, bir de sürüm ve telefon türü. <b>Notların, seslerin, fotoğrafların ve gezin gitmiyor.</b>`}</div>
    ${gecmisYazi}
    <button class="eylem-dugme birincil" id="byGonder">${ç`Gönder`}</button>
    <button class="eylem-dugme" id="byKapat">${ç`Vazgeç`}</button>
  `);

  $('#byKapat').addEventListener('click', ortuKapat);
  $('#byGonder').addEventListener('click', async () => {
    // İKİSİ DE ortuKapat'tan ÖNCE okunuyor. ortuKapat örtünün içini
    // siliyor; sonra okumaya kalkmak alanı null buluyordu ve mesaj hiç
    // gitmiyordu. (Aynı tuzağa bu projede daha önce de düşüldü.)
    const metin = $('#byMetin').value.trim();
    const kim = $('#byKim').value.trim();
    if (!metin) { kayitBildir(ç`Önce bir şeyler yaz.`, 'kotu'); return; }
    ortuKapat();
    try {
      const sonuc = await kutu.mesajGonder({ mesaj: metin, kim });
      kayitBildir(sonuc === 'kuyrukta'
        ? ç`İnternet yok — mesajın kuyrukta, bağlanınca gidecek.`
        : ç`Gönderildi ✓ Kopyası Gerok’ta duruyor.`, 'iyi');
      paneliCiz();
    } catch (hata) {
      kayitBildir(ç`Gönderilemedi: ${hata.message}`, 'kotu');
    }
  });
}


/**
 * Uygulamanın kendisini paylaşmak.
 *
 * Çıplak bağlantı YETMİYOR. iPhone'da Gerok yalnızca SAFARI'den "Ana Ekrana
 * Ekle" ile kuruluyor; bağlantı WhatsApp'ın kendi tarayıcısında açılırsa o
 * seçenek listede hiç çıkmıyor ve karşı taraf "bende çalışmadı" diyor.
 * Metindeki o tek cümle bu yüzden var.
 *
 * Giden şey yalnızca genel adres. Gezinin kendisi — kayıtlar, rota, duraklar,
 * isimler — bu bağlantıda YOK, onlar telefondan hiç çıkmıyor. Paylaşmak
 * uygulamayı verir, defteri vermez.
 */
async function uygulamayiPaylas() {
  const adres = new URL('./', location.href).href;
  const metin =
    ç`Gerok — internetsiz çalışan gezi defteri.` + '\n\n' +
    ç`Bu bağlantıyı SAFARİ\u2019de aç, sonra alttaki paylaş düğmesinden \u201CAna Ekrana Ekle\u201D de. Başka tarayıcıda kurulmuyor.` + '\n\n' +
    ç`Ayrıntılı kurulum: ` + new URL('./kurulum.html', location.href).href;

  try {
    if (navigator.share) {
      await navigator.share({ title: 'Gerok', text: metin, url: adres });
      kayitBildir(ç`Gönderildi.`, 'iyi');
      return;
    }
    // Paylaşım yoksa panoya düş: bağlantı hiç olmazsa elde kalsın.
    await navigator.clipboard.writeText(metin + '\n\n' + adres);
    kayitBildir(ç`Bağlantı kopyalandı — yapıştırıp gönder.`, 'iyi');
  } catch (hata) {
    // Paylaş sayfasından vazgeçmek hata değil, karar.
    if (hata.name === 'AbortError') return;
    kayitBildir(ç`Paylaşılamadı: ${hata.message}`, 'kotu');
  }
}


/**
 * "Neler değişti" — çalışan sürümün notları.
 *
 * Güncelleme kartı bir kez çıkıyor ve "Sonra" denince kapanıyor; notlar orada
 * kalırsa kaybolmuş oluyor. Burada ağdan DEĞİL, telefondaki dosyadan okunuyor:
 * internetsizken de açılıyor.
 */
/**
 * Bütün sürüm geçmişi, yeniden eskiye.
 *
 * Önce yalnızca o anki sürümün notu görünüyordu. Uygulamanın sürekli
 * geliştiği — arkasında emek olduğu — hiçbir yerde görünmüyordu. Liste
 * ağdan değil önbellekten okunuyor: internetsizken de açılmalı.
 */
async function degisiklikleriGoster() {
  const hepsi = await degisiklikDosyasi({ agdan: false });
  const buSayi = surumSayisi(BU_SURUM);
  const enEski = hepsi.length ? tarihKisa(hepsi[hepsi.length - 1].tarih) : '';
  ortuAc(`
    <div class="ortu-baslik">${ç`Neler değişti`}</div>
    <div class="ortu-alt">${surumOku(BU_SURUM)}</div>
    ${hepsi.length && enEski
      ? `<div class="gnc-ozet">${ç`${hepsi.length} güncelleme · ${enEski} tarihinden beri`}</div>`
      : ''}
    ${hepsi.length
      ? `<div class="gnc-gecmis">${
          hepsi.map(n => surumBloguHtml(n, n.sayi === buSayi)).join('')}</div>`
      : `<div class="panel-not">${ç`Sürüm notu bulunamadı.`}</div>`}
    <button class="eylem-dugme" id="dgsKapat">${ç`Kapat`}</button>
  `);
  $('#dgsKapat').addEventListener('click', ortuKapat);
}

async function turArsivleSor(id) {
  // Son turu arşivlemek ekranların TAMAMINI boşaltıyor. Bunu önceden söylemek
  // gerekiyor: sonradan görünce insan haklı olarak "veriler gitti" sanıyor.
  const kalan = (await gerok.turlar()).filter(t => !t.arsiv && t.id !== id).length;
  ortuAc(`
    <div class="ortu-baslik">${ç`Tur arşivlensin mi?`}</div>
    ${kalan ? '' : `<div class="panel-not">${ç`<b>Bu son turun.</b> Arşivleyince zaman çizgisi, harita ve duraklar boşalacak — kayıtların yerinde duracak ve ekranda <b>Geziye geri dön</b> düğmesi çıkacak.`}</div>`}
    <div class="ortu-alt">${ç`Kayıtların, sesli notların, fotoğrafların ve izin <b>silinmez</b> — telefonda durur. Sadece ekranlardan çekilir, yeni turla karışmaz. İstediğin an geri dönebilirsin.`}</div>
    <div class="panel-not">${ç`Yine de önce yedek almak en doğrusu: yedek dosyası telefondan bağımsız durur.`}</div>
    <button class="eylem-dugme" id="arsivYedek">${ç`Önce yedek al`}</button>
    <button class="eylem-dugme birincil" id="arsivOnay">${ç`Arşivle`}</button>
    <button class="eylem-dugme" id="arsivVaz">${ç`Vazgeç`}</button>
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
    <div class="ortu-baslik">${ç`Bu tur tamamen silinsin mi?`}</div>
    <div class="ortu-alt">${ç`Turun <b>bütün kayıtları, sesli notları, fotoğraf önizlemeleri ve izi</b> telefondan gider.<br><br>Beş saniye "Geri al" düğmesi duracak; o geçtikten sonra <b>dönüşü yok</b>.<br><br>Yalnızca yer açmak istiyorsan <b>arşivle</b> yeter — o hiçbir şeyi silmiyor.`}</div>
    <button class="eylem-dugme" id="silYedek">${ç`Önce yedek al`}</button>
    <button class="eylem-dugme" id="silOnayla">${ç`Anladım, sil`}</button>
    <button class="eylem-dugme birincil" id="silVazgec2">${ç`Vazgeç`}</button>
  `);
  $('#silVazgec2').addEventListener('click', ortuKapat);
  $('#silYedek').addEventListener('click', () => yedekAl(kayitBildir));
  $('#silOnayla').addEventListener('click', async () => {
    ortuKapat();

    // Tur silme geri ALINAMAZ bir iş: kayıtlar, iz, duraklar ve turun kendisi
    // diskten gidiyor. O yüzden burada "sil, sonra geri koy" yolu yok —
    // silme beş saniye BEKLETİLİYOR. Geri al'a basılırsa hiçbir şey olmuyor,
    // çünkü henüz hiçbir şey yapılmadı.
    let iptal = false;
    geriAlinabilirBildir(ç`Tur beş saniye içinde silinecek`, () => {
      iptal = true;
    });

    setTimeout(async () => {
      if (iptal) return;
      const s = await gerok.turSil(id);
      kayitBildir(ç`Tur silindi · ${s.silinenKayit} kayıt, ${s.silinenIz} iz noktası.`, 'kotu');
      await turDegisti();
    }, GERI_AL_SURESI);
  });
}

function yeniTurSor() {
  const bugun = new Date();
  // <input type="date"> yalnızca ISO biçimi kabul ediyor; bu yüzden dilden
  // bağımsız. Adı `tarihYaz` idi ve dil.js'ten geleni gölgeliyordu.
  const isoGun = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const aktifVar = !!gerok.aktifGerok();

  ortuAc(`
    <div class="ortu-baslik">${ç`Yeni tur`}</div>
    <div class="ortu-alt">${ç`Boş bir defter açılır. Duraklarını haritadan kendin koyarsın; hazır bir rota dosyan varsa onu da yükleyebilirsin.`}</div>

    <div class="girdi-etiket">${ç`Turun adı`}</div>
    <input class="girdi" id="turAd" placeholder="${ç`Karadeniz turu, Ege 2027…`}">

    <div class="girdi-etiket">${ç`Ne zaman başlıyor?`}</div>
    <input class="girdi" id="turBas" type="date" value="${isoGun(bugun)}">

    <div class="girdi-etiket">${ç`Kaç gün sürecek?`}</div>
    <div class="secenekler" id="turGun">
      ${[3, 5, 7, 10, 14, 21, 30].map(g =>
        `<button class="kucuk-dugme ${g === 7 ? 'secili' : ''}" data-gun="${g}">${ç`${g} gün`}</button>`).join('')}
    </div>
    <div class="panel-not">${ç`Gün sayısını sonra değiştiremezsin ama sorun değil — süre bitse de kayıt almaya devam edebilirsin, "Gerok dışı" olarak yazılır.`}</div>

    ${aktifVar ? `<div class="panel-not">${ç`<b>"${kacis(gerok.aktifGerok().ad)}"</b> arşive kaldırılacak. Kayıtları silinmiyor, istediğin an geri dönersin.`}</div>` : ''}

    <button class="eylem-dugme birincil" id="turKur">${ç`Turu başlat`}</button>
    <button class="eylem-dugme" id="turVaz">${ç`Vazgeç`}</button>
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

$('#dosyaSecici').addEventListener('change', async (e) => {
  const dosya = e.target.files[0];
  e.target.value = '';
  if (!dosya) return;
  try {
    const s = await gerok.paketYukle(await dosya.text());
    iz.gerokAyarla(s.id);
    gosterilenSayi = SAYFA_ADIMI;
    kayitBildir(ç`"${s.ad}" yüklendi · ${s.gunler.length} gün, ${s.duraklar.length} durak`, 'iyi');
    // Yeni bir tur geldi: rehberde karşılığı olmayan durakları sor.
    setTimeout(() => bilgiEksikSor(gerok.duraklar(), { paket: true }), 1500);
    setTimeout(yedekHatirlat, 6000);
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
    bildirimGoster(ç`Gün Sonu`, ç`Bugünden aklında ne kaldı? 90 saniye.`);
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

/**
 * `kat`: şartnamenin §3.3 katman ölçeğindeki yeri. Boş bırakılırsa temel
 * katman (75) — sheet'ler ve durak kartı orada. Adları css/stil.css'te.
 */
export function ortuAc(html, kapanabilir = true, kat = '') {
  $('#ortuIc').innerHTML = html;
  const o = $('#ortu');
  if (kat) o.dataset.kat = kat; else delete o.dataset.kat;
  o.classList.remove('gizli');
  o.onclick = kapanabilir
    ? (e) => { if (e.target.id === 'ortu') ortuKapat(); }
    : null;
}
export function ortuKapat() {
  $('#ortu').classList.add('gizli');
  delete $('#ortu').dataset.kat;
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
  // Tasarımın süresi 2800 ms. Hata mesajı istisna: okunup ne yapılacağına
  // karar verilmesi gerekiyor, 2,8 saniye ona yetmiyor.
  t._sayac = setTimeout(() => t.classList.add('gizli'), sinif === 'kotu' ? 6000 : 2800);
}

// Geri alınabilir bildirim: mesajın yanında duran bir "Geri al".
//
// Silme bu yüzden anında değil. İki kural: silmek gürültülü olsun, veri
// sessizce kaybolmasın. Beş saniye, "eyvah" demeye yetiyor.
//
// Süre 5,2 saniye — okumak VE düğmeye basmak için. Düz bildirimin iki
// katına yakın, çünkü burada kullanıcıdan bir karar bekleniyor.
//
// 17 Ağustos'tan beri HER SİLME geri alınabiliyor: kayıt, durak, durak notu,
// yarım ses kaydı, tur. Eskiden yalnızca kayıt silme ve gezi kapatmada vardı;
// "hangisinde var" diye hatırlamak gerekiyordu ve gezi verisi geri
// getirilemez. İki yol kullanılıyor:
//   · Silme yumuşaksa (kayıt, durak, durak notu) silinip geri konabiliyor.
//   · Silme sertse (tur, yarım kayıt) İŞ BEŞ SANİYE BEKLETİLİYOR — geri al'a
//     basılırsa hiçbir şey olmuyor, çünkü henüz hiçbir şey yapılmadı.
export const GERI_AL_SURESI = 5200;

export function geriAlinabilirBildir(mesaj, geriAl) {
  const t = $('#bildirim');
  if (!t) { geriAl?.(); return; }

  t.innerHTML = `<span class="bildirim-yazi"></span>
    <button class="bildirim-geri">${ç`Geri al`}</button>`;
  t.querySelector('.bildirim-yazi').textContent = mesaj;
  t.className = 'bildirim geri-alinabilir';
  clearTimeout(t._sayac);

  const kapat = () => {
    t.classList.add('gizli');
    t.innerHTML = '';
    t.className = 'bildirim gizli';
  };
  t.querySelector('.bildirim-geri').addEventListener('click', async () => {
    clearTimeout(t._sayac);
    kapat();
    // Geri alma da sessiz olmuyor: geri alındığını söyleyen kendi bildirimi var.
    try { await geriAl?.(); } finally { kayitBildir(ç`Geri alındı`); }
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
    ? `${ç(veri.TURLER[k.tur] || k.tur)} · ${gerok.saat(k.t)}${k.metin ? ` · ${k.metin.slice(0, 40)}` : ''}`
    : ç`ses kaydı`;
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

/**
 * Aktif tur yokken: arşivde tur var mı, varsa kaç kayıt duruyor?
 *
 * Boş ekranın kendisi zararsız görünüyor ama insanın aklına ilk geleni
 * söylüyor: "veriler gitti". Bu yüzden burada sayı VERİLİYOR — "duruyor"
 * demek yetmez, kaç tanesinin durduğunu görmek gerekiyor.
 *
 * Çizim eşzamanlı olmak zorunda olduğu için önce boş durum basılıyor, arşiv
 * bulunursa üstüne yazılıyor. Bulunmazsa hiçbir şey değişmiyor.
 */
async function arsivVarsaAnlat() {
  const turlar = await gerok.turlar();
  const arsiv = turlar.filter(t => t.arsiv);
  if (!arsiv.length) return;
  let kayit = 0;
  for (const t of arsiv) kayit += (await veri.kayitlariGetir(t.id)).length;
  // Kabı ŞİMDİ arıyoruz. Çağıran anda yakalanan öğe bu bekleme sırasında
  // yeniden çizilmiş olabiliyordu; öyle olunca yazı hiç görünmüyordu.
  const kap = $('#zamanListe');
  if (!kap || gerok.aktifGerok()) return;            // arada tur açılmışsa dokunma
  if (kap.querySelector('#arsivDon')) return;        // zaten yazılmış

  const son = arsiv[0];
  const yazi = ç`<b>${kacis(son.ad)}</b> arşivde. ${kayit} kayıt telefonunda duruyor — hiçbiri silinmedi.`;
  const dugme = `<div class="bos-eylem"><button class="eylem-dugme birincil"`
    + ` id="arsivDon">${ç`Geziye geri dön`}</button></div>`;

  // Aşağıdaki "Henüz bir gerok yüklenmedi" uyarısı arşiv varken ARTIK DOĞRU
  // DEĞİL: gerok var, arşivde. İki satır yan yana durursa hangisine
  // inanacağını bilemezsin, o yüzden yanlış olan kaldırılıyor.
  for (const u of kap.querySelectorAll('.uyari-satir'))
    if (/Henüz bir gerok yüklenmedi/.test(u.textContent)) u.remove();

  // Liste boşsa yerini alıyor, doluysa ÜSTÜNE biniyor: aşağıdaki kayıtları
  // silip yerine açıklama koymak, açıklamanın anlattığı korkuyu doğrularadı.
  if (kap.querySelector('.bos-durum') || !kap.children.length) {
    kap.innerHTML = bosDurum('saat', yazi.replace('. ', '.<br>')) + dugme;
  } else {
    kap.insertAdjacentHTML('afterbegin',
      `<div class="uyari-satir">${yazi}</div>${dugme}`);
  }
  $('#arsivDon').addEventListener('click', async () => {
    await gerok.turSec(son.id);
    await turDegisti();
    kayitBildir(ç`${son.ad} yeniden açıldı.`, 'iyi');
  });
}

// --------------------------------------------------------------- servis worker -

// Sayfa BİZİM HABERİMİZ OLMADAN yenilenmiyor: kendiliğinden bir yenileme sesli
// not kaydının ortasına denk gelse kaydı uçururdu. Yenilemeyi yalnızca kullanıcı
// "İndir ve güncelle" dediğinde yapıyoruz (guncellemeyiUygula). Buradaki
// update() sadece yoklama; iOS Safari kendi başına aramakta ağır davranıyor.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').then((sw) => {
    const sor = () => sw.update().catch(() => {});
    sor();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') sor();
    });
  }).catch(e => console.warn('sw kaydı olmadı', e));

  // Açılışta ve uygulamaya her dönüşte: yeni sürüm varsa boyutuyla sorulur.
  // Dönüşte de bakmak şart — telefon cepteyken yayınlanan sürüm, uygulama
  // yeniden açılmadığı sürece hiç sorulmazdı.
  guncellemeYokla();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') guncellemeYokla({ gecikme: 2500 });
  });
}

baslat();

export { tazele, durum };
