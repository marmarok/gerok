// Gerok — ilk açılışta uygulamayı gezdiren rehber.
//
// NEDEN VAR: Gerok'u kuran kişi çoğu zaman onu yapanı tanıyor ama uygulamayı
// tanımıyor. Sekmelerin ne olduğu kendiliğinden anlaşılıyor; ANLAŞILMAYAN
// şey görünmeyenler:
//
//   · İz yalnızca uygulama AÇIKKEN kaydediliyor (iOS başka türlüsüne
//     izin vermiyor). Bunu bilmeyen, akşam haritada boş bir gün görüyor.
//   · Harita alanı YOLA ÇIKMADAN inmeli. Yurtdışında internet yokken
//     indirilemiyor ve o an öğrenmek çok geç.
//   · Ortam sesi diye bir şey olduğu akla gelmiyor; en çok pişman
//     olunan eksik bu oluyor.
//
// NEDEN KAYDIRMALI TANITIM DEĞİL: App Store'daki "5 ekran kaydır, sonra
// başla" tanıtımını herkes atlıyor, atlamayan da unutuyor. Burada bunun
// yerine GERÇEK DÜĞMELERİN üstü işaretleniyor — kişi anlatılan şeyin
// nerede durduğunu görüyor.
//
// Rehber bir kez kendiliğinden çıkıyor, sonra Gerok panelinden istendiği
// kadar tekrar açılabiliyor: ihtiyaç duyan kişi çoğu zaman 3. gün otobüste.

import * as veri from './veri.js';
import { ç } from './dil.js';

const ANAHTAR = 'rehberGosterildi';
const KENAR = 10;              // İşaret çerçevesinin hedeften taşma payı.
const BALON_BOSLUK = 14;

let adimlar = [];
let sira = 0;
let kat = null;
let disari = null;             // ekranAc gibi dışarıdan gelen işlevler

/**
 * Adım listesi.
 *
 * `hedef` bulunamazsa o adım ATLANIYOR — uygulama değişip bir düğme
 * kalkarsa rehber boş bir yeri işaret etmesin. `ekran` varsa önce o
 * sekmeye geçiliyor.
 */
function adimListesi() {
  return [
    {
      ekran: 'zaman', hedef: null,
      baslik: ç`Gerok’a hoş geldin`,
      metin: ç`Bu bir gezi defteri. İnternetsiz çalışır — yurtdışında şebeke yokken de yazar, ses kaydeder, haritayı gösterir. Sana en çok işe yarayacak üç şeyi göstereyim.`,
    },
    {
      ekran: 'kayit', hedef: '#btnSes',
      baslik: ç`Konuş, yazma`,
      metin: ç`Yolda yazmak zor, konuşmak kolay. Dokun, anlat, bitir. Kaydın saatiyle birlikte haritadaki yerine kendiliğinden oturur.`,
    },
    {
      ekran: 'kayit', hedef: '#btnOrtam',
      baslik: ç`Bir de sesi kaydet`,
      metin: ç`Çarşı, yağmur, ezan, tren. Fotoğraf herkeste var, o yerin nasıl duyulduğu kimsede yok. Yıllar sonra en çok bu vuruyor.`,
    },
    {
      ekran: 'harita', hedef: '.sekme[data-ekran="harita"]',
      baslik: ç`Haritayı yola çıkmadan indir`,
      metin: ç`İnternet varken harita her yerde çalışır. Ama yurtdışında şebeke yoksa yalnızca ÖNCEDEN indirdiğin alanlar açılır. Gerok → Harita alanı indir, şehri ekrana getir, indir. Bir şehir birkaç MB ve birkaç saniye.`,
    },
    {
      ekran: 'duraklar', hedef: '#btnYolModu',
      baslik: ç`Yol Modu ve gidilen iz`,
      metin: ç`Gittiğin yol ancak uygulama AÇIKKEN kaydedilir — telefon kilitliyken iOS buna izin vermiyor. Araçta telefonu şarja takıp Yol Modu’nu aç: ekran açık kalır, durağa yaklaşınca uyarır.`,
    },
    {
      ekran: 'gerok', hedef: '.sekme[data-ekran="gerok"]',
      baslik: ç`Akşamları buraya uğra`,
      metin: ç`Gün Sonu bütün günü 90 saniyede toparlar ve yedeğini alır. Bir şey ters giderse ya da bir fikrin olursa, aynı ekrandaki “Gerok’u yapana yaz” ile doğrudan bana ulaşırsın.`,
    },
  ];
}

// ---- Çizim ----------------------------------------------------------------

function katYap() {
  const k = document.createElement('div');
  k.className = 'rehber-kat';
  k.innerHTML = `
    <div class="rehber-isaret" id="rehberIsaret"></div>
    <div class="rehber-balon" id="rehberBalon">
      <div class="rehber-sayac" id="rehberSayac"></div>
      <div class="rehber-baslik" id="rehberBaslik"></div>
      <div class="rehber-metin" id="rehberMetin"></div>
      <div class="rehber-dugmeler">
        <button class="rehber-gec" id="rehberGec">${ç`Geç`}</button>
        <button class="rehber-ileri" id="rehberIleri">${ç`İleri`}</button>
      </div>
    </div>`;
  document.body.appendChild(k);
  k.querySelector('#rehberGec').addEventListener('click', bitir);
  k.querySelector('#rehberIleri').addEventListener('click', ileri);
  // Karanlığa dokunmak da ilerletiyor: parmağın nereye gideceğini
  // düşünmek zorunda kalmasın.
  k.addEventListener('click', (o) => { if (o.target === k) ileri(); });
  return k;
}

function yerlestir(adim) {
  const isaret = kat.querySelector('#rehberIsaret');
  const balon = kat.querySelector('#rehberBalon');
  const hedef = adim.hedef ? document.querySelector(adim.hedef) : null;

  if (!hedef) {
    // Hedefsiz adım: karanlık tam, balon ortada.
    isaret.style.display = 'none';
    balon.style.top = ''; balon.style.bottom = '';
    balon.classList.add('ortada');
    return;
  }

  balon.classList.remove('ortada');
  const k = hedef.getBoundingClientRect();
  isaret.style.display = 'block';
  isaret.style.left = `${k.left - KENAR}px`;
  isaret.style.top = `${k.top - KENAR}px`;
  isaret.style.width = `${k.width + KENAR * 2}px`;
  isaret.style.height = `${k.height + KENAR * 2}px`;

  // Balon hedefin altına sığıyorsa altına, sığmıyorsa üstüne.
  const balonBoy = balon.offsetHeight || 200;
  const altBosluk = window.innerHeight - k.bottom;
  if (altBosluk > balonBoy + BALON_BOSLUK + 20) {
    balon.style.top = `${k.bottom + BALON_BOSLUK}px`;
    balon.style.bottom = 'auto';
  } else {
    balon.style.top = 'auto';
    balon.style.bottom = `${window.innerHeight - k.top + BALON_BOSLUK}px`;
  }
}

async function ciz() {
  const adim = adimlar[sira];
  if (!adim) return bitir();

  if (adim.ekran && disari?.ekranAc) {
    disari.ekranAc(adim.ekran);
    // Sekme geçişinin bitmesini bekliyoruz: hedefin yeri değişiyor ve
    // beklemeden ölçersek çerçeve yanlış yere oturuyor.
    await new Promise(r => setTimeout(r, 260));
  }

  kat.querySelector('#rehberSayac').textContent = `${sira + 1} / ${adimlar.length}`;
  kat.querySelector('#rehberBaslik').textContent = adim.baslik;
  kat.querySelector('#rehberMetin').textContent = adim.metin;
  kat.querySelector('#rehberIleri').textContent =
    sira === adimlar.length - 1 ? ç`Başla` : ç`İleri`;

  yerlestir(adim);
}

function ileri() {
  sira++;
  if (sira >= adimlar.length) return bitir();
  ciz();
}

async function bitir() {
  if (kat) { kat.remove(); kat = null; }
  window.removeEventListener('resize', tazele);
  await veri.ayarYaz(ANAHTAR, true);
}

function tazele() { if (kat && adimlar[sira]) yerlestir(adimlar[sira]); }

// ---- Dışarıya açılanlar ---------------------------------------------------

/** Rehberi başlatır. */
export async function rehberiAc(baglar = {}) {
  if (kat) return;
  disari = baglar;
  adimlar = adimListesi();
  sira = 0;
  kat = katYap();
  window.addEventListener('resize', tazele);
  await ciz();
}

/**
 * İlk açılışsa rehberi kendiliğinden gösterir.
 *
 * Açık bir pencere varsa AÇMIYOR. İlk açılışta uygulama önce adı, sonra
 * yarım kalmış kayıtları soruyor; rehber onların üstüne biniyordu ve yeni
 * kullanıcı ilk saniyesinde iki pencere birden görüyordu. Koruma burada,
 * çağıran tarafta değil: kim çağırırsa çağırsın aynı kural işlesin.
 *
 * Elle açılan `rehberiAc` bu kurala tabi değil — orada isteyen kişi var.
 */
export async function gerekiyorsaAc(baglar = {}) {
  if (await veri.ayarOku(ANAHTAR, false)) return false;
  const ortu = document.getElementById('ortu');
  if (ortu && !ortu.classList.contains('gizli')) return false;
  await rehberiAc(baglar);
  return true;
}

export async function gosterildiMi() {
  return !!(await veri.ayarOku(ANAHTAR, false));
}
