// Gerok — Gün Sonu.
//
// Yedi ayrı akşam ritüeli yerine tek ekran, aşağı doğru akan, ~90 saniye:
// özet → sesli günlük → sıradan kare → kişi/fiyat → fotoğrafları topla →
// yedek → arkadaşına gönder.
//
// Yedek ve eşitleme de bilerek buraya gömülü: hatırlanacak yedi şey değil, bir tane.

import * as veri from './veri.js';
import * as iz from './iz.js';
import * as gerok from './gerok.js';
import * as kayit from './kayit.js';
import { paketGonder, yedekAl } from './esitleme.js';
import { sesKaydiBaslat, kayitBildir } from './app.js';
import { ikon } from './ikon.js';

const $ = (s) => document.querySelector(s);

let adim = 0;
let gun = null;
let tazeleDisari = null;

// Tasarım Gün Sonu'nu DÖRT adım olarak kapatmış: özet → sesli günlük →
// bugünü topla → yedek ve gönder. Bizde altı adım vardı.
//
// "Sıradan kare" ayrı bir adım değil artık; "Bugünü topla"nın içinde, çünkü
// ikisi de aynı şeyi istiyor: galeriden bugünü seç. İki ayrı ekranda sormak
// akşam 21:00'de aynı işi iki kez yaptırıyordu.
//
// "Kişi ve fiyat" adımı akıştan çıktı. İkisi de Kayıt sekmesinde kendi
// düğmeleriyle duruyor — gün sonunda bir daha sormak fazladan iki ekrandı.
// Hiçbir şey silinmedi, yalnızca zorunlu soru kalktı.
const ADIMLAR = ['ozet', 'gunluk', 'fotograf', 'kapanis'];

export async function gunSonuAc(durum, tazele) {
  tazeleDisari = tazele;
  gun = gerok.bugununGunu() || sonGun();
  adim = 0;
  await ciz(durum);
}

function sonGun() {
  const s = gerok.aktifGerok();
  if (!s?.gunler?.length) return null;
  // Pencere eksik bir günde çökmesin; gerok.js aynı savunmayı yapıyor.
  const gecmis = s.gunler.filter(g => {
    const [bas] = gerok.gunPenceresi(g);
    return bas != null && bas <= Date.now();
  });
  return gecmis[gecmis.length - 1] || s.gunler[0];
}

/** `kat`: şartnamenin §3.3 katman ölçeği — bkz. app.js'teki `ortuAc`. */
function ortu(html, kat = 'gunsonu') {
  $('#ortuIc').innerHTML = html;
  $('#ortu').dataset.kat = kat;
  $('#ortu').classList.remove('gizli');
  $('#ortu').onclick = null;            // akış yanlışlıkla kapanmasın
}
function kapat() {
  $('#ortu').classList.add('gizli');
  $('#ortuIc').innerHTML = '';
}

async function ilerle(durum) {
  adim++;
  if (adim >= ADIMLAR.length) { kapat(); await tazeleDisari?.(); return; }
  await ciz(durum);
}

function ustBilgi(baslik, alt) {
  // Noktalar Gezi Sonu'nda vardı, Gün Sonu'nda yoktu — oysa altı adımlı olan
  // bu. "Daha kaç adım var" sorusunun cevabı akşam en çok burada gerekiyor.
  return `<div class="gs-sayac">Gün Sonu · ${adim + 1}/${ADIMLAR.length}</div>
    <div class="gs-noktalar">${ADIMLAR.map((_, i) =>
      `<span class="gs-nokta${i <= adim ? ' dolu' : ''}"></span>`).join('')}</div>
    <div class="ortu-baslik">${baslik}</div>
    ${alt ? `<div class="ortu-alt">${alt}</div>` : ''}`;
}

async function ciz(durum) {
  const ad = ADIMLAR[adim];
  if (ad === 'ozet') return ozetAdimi(durum);
  if (ad === 'gunluk') return gunlukAdimi(durum);
  if (ad === 'fotograf') return fotografAdimi(durum);
  if (ad === 'kapanis') return kapanisAdimi(durum);
}

// ---- 1. Günün özeti -------------------------------------------------------

async function ozetAdimi(durum) {
  const turId = gerok.aktifGerok()?.id ?? null;
  const kayitlar = await veri.kayitlariGetir(turId);
  const izNoktalari = await veri.izGetir(turId);

  const bugunkuler = gun ? kayitlar.filter(k => k.gun === gun.no) : [];
  const pencere = gun ? gerok.gunPenceresi(gun) : [0, 0];
  const bugunkuIz = pencere[0] == null ? []
    : izNoktalari.filter(n => n.t >= pencere[0] && n.t <= pencere[1]);

  const km = iz.izUzunlugu(bugunkuIz);
  const sesler = bugunkuler.filter(k => ['ses', 'ortam', 'gunluk'].includes(k.tur)).length;
  const gorseller = bugunkuler.filter(k => ['foto', 'video', 'siradan'].includes(k.tur)).length;

  const ulkeler = [...new Set(bugunkuler.filter(k => k.tur === 'sinir').map(k => k.ulke))];

  ortu(`
    ${ustBilgi('Günün özeti', 'Bugün ne oldu, sayılarla.')}
    <div class="gs-ozet">
      <div class="gs-kutu"><div class="gs-sayi">${km.toFixed(0)}</div><div class="gs-etiket">km yol</div></div>
      <div class="gs-kutu"><div class="gs-sayi">${gorseller}</div><div class="gs-etiket">fotoğraf</div></div>
      <div class="gs-kutu"><div class="gs-sayi">${sesler}</div><div class="gs-etiket">ses kaydı</div></div>
      <div class="gs-kutu"><div class="gs-sayi">${bugunkuler.length}</div><div class="gs-etiket">toplam kayıt</div></div>
    </div>
    ${ulkeler.length ? `<div class="panel-not">Bugün geçtiğin sınır: ${ulkeler.map(gerok.ulkeAdi).join(', ')}</div>` : ''}
    <div class="panel-not gs-guvence">Buradaki hiçbir adım kayıt silmez, günü
    kapatmaz, hiçbir şeyi kesinleştirmez. İstediğin yerde çıkabilirsin; bugüne
    sonra da kayıt ekleyebilir, bu akışı tekrar açabilirsin.</div>
    <div class="gs-dugmeler">
      <button class="eylem-dugme" id="gsCik">Şimdi değil</button>
      <button class="eylem-dugme birincil" id="gsIleri">Başla</button>
    </div>
  `);
  $('#gsCik').onclick = kapat;
  $('#gsIleri').onclick = () => ilerle(durum);
}

// ---- 2. Sesli günlük ------------------------------------------------------

async function gunlukAdimi(durum) {
  ortu(`
    ${ustBilgi('Bugünden aklında ne kaldı?', 'Sesli günlük. Bir dakika yeter.')}
    <div id="gunlukDurum" class="panel-not">Dokun ve konuş. Bitince "Durdur ve kaydet".</div>
    <button class="buyuk-dugme birincil" id="gunlukKayit" style="margin-top:14px">
      <span class="dugme-ikon">${ikon('mikrofon', 28)}</span>
      <span class="dugme-ad">Konuşmaya başla</span>
    </button>
    <div class="gs-dugmeler">
      <button class="eylem-dugme" id="gsAtla">Atla</button>
      <button class="eylem-dugme birincil" id="gsIleri">Devam</button>
    </div>
  `);

  $('#gunlukKayit').addEventListener('click', () => sesKaydiBaslat('gunluk', {
    ipucu: 'Bugünden aklında ne kaldı? Bitince "Durdur ve kaydet".',
    bittiginde: (k) => {
      const e = $('#gunlukDurum');
      if (!e) return;
      e.textContent = k
        ? `Kaydedildi · ${Math.round(k.sure)} saniye. İstersen bir tane daha.`
        : 'Çok kısaydı.';
    }
  }));

  $('#gsAtla').onclick = () => ilerle(durum);
  $('#gsIleri').onclick = () => ilerle(durum);
}

// ---- 3. Bugünü topla ------------------------------------------------------

async function fotografAdimi(durum) {
  ortu(`
    ${ustBilgi('Bugünden fotoğraf ekle',
      'Galeriden seç, deftere eklensin. Manzara şart değil: oda, kahvaltı masası, '
      + 'otobüsün içi. Seçmediklerin galerinde olduğu gibi kalır — burada '
      + 'yapılan tek şey EKLEMEK.')}
    <button class="eylem-dugme birincil" id="fotoSec">Galeriden seç</button>
    <div id="fotoDurum" class="panel-not"></div>
    <div class="gs-dugmeler">
      <button class="eylem-dugme" id="gsAtla">Atla</button>
      <button class="eylem-dugme birincil" id="gsIleri">Devam</button>
    </div>
  `);

  $('#fotoSec').onclick = () => {
    const secici = document.createElement('input');
    secici.type = 'file';
    secici.accept = 'image/*,video/*';
    secici.multiple = true;
    secici.addEventListener('change', async () => {
      if (!secici.files.length) return;
      try {
        const eklenenler = await kayit.fotoAl(secici.files, (yapilan, toplam) => {
          $('#fotoDurum').textContent = `${yapilan} / ${toplam}`;
        });
        const yersiz = eklenenler.filter(k => k.lat == null).length;
        const atlanan = kayit.sonBasarisizlar().length;
        $('#fotoDurum').textContent =
          `${eklenenler.length} eklendi` +
          (yersiz ? `. ${yersiz} tanesinin yeri bulunamadı — o saatlerde iz kapalıymış.` : ', hepsi haritaya yerleşti.') +
          (atlanan ? ` ${atlanan} dosya alınamadı.` : '');
        navigator.vibrate?.([8, 40, 8]);
      } catch (hata) {
        $('#fotoDurum').textContent = `Eklenemedi: ${hata.message}`;
      }
    });
    secici.click();
  };

  $('#gsAtla').onclick = () => ilerle(durum);
  $('#gsIleri').onclick = () => ilerle(durum);
}

// ---- 4. Yedek ve gönder ---------------------------------------------------

async function kapanisAdimi(durum) {
  const sonYedek = await veri.ayarOku('sonYedek', null);
  const gecen = sonYedek ? Math.round((Date.now() - sonYedek) / 3600_000) : null;

  ortu(`
    ${ustBilgi('Son iki adım', 'Yedek al, sonra günü arkadaşına gönder.')}
    ${sonYedek
      ? `<div class="panel-not">Son yedek ${gecen < 1 ? 'az önce' : `${gecen} saat önce`} alındı.</div>`
      : '<div class="panel-not">Henüz hiç yedek alınmadı.</div>'}
    <button class="eylem-dugme birincil" id="kYedek">Yedek al</button>
    <button class="eylem-dugme" id="kGonder">Günümü arkadaşıma gönder</button>
    <div id="kDurum" class="panel-not"></div>
    <div class="gs-dugmeler">
      <button class="eylem-dugme birincil" id="gsBitir">Bitir</button>
    </div>
  `);

  const bildir = (m) => { const e = $('#kDurum'); if (e) e.textContent = m; };
  $('#kYedek').onclick = () => yedekAl(bildir);
  $('#kGonder').onclick = () => paketGonder(bildir, gun?.no ?? null);
  $('#gsBitir').onclick = async () => {
    kapat();
    kayitBildir('Bitti · bugünün kayıtları yerinde', 'iyi');
    await tazeleDisari?.();
  };
}

// ---- Gerok başı ve sonu ---------------------------------------------------
//
// Anıları bir döneme oturtan çerçeve. Gezinin başında ve sonunda birer kayıt,
// bir de 2036'ya mühürlü mektup.

export function baslangicKaydiAc(tazele) {
  ozelKayitAc({
    tur: 'baslangic',
    baslik: 'Başlangıç kaydı',
    alt: 'Yola çıkmadan: kaç yaşındasın, hayatında ne var, bu geziden ne bekliyorsun? ' +
         'On yıl sonra anıları bir döneme oturtacak olan şey bu.',
    tazele
  });
}

export function bitisKaydiAc(tazele) {
  ozelKayitAc({
    tur: 'bitis',
    baslik: 'Bitiş kaydı',
    alt: 'Ne oldu, ne değişti, ne beklemiyordun?',
    tazele
  });
}

// ---- Gezi Sonu ------------------------------------------------------------
//
// Gün Sonu her akşamın ritüeli; Gezi Sonu geziyi kapatan tek seferlik akış.
// Beş adım: özet → bitiş kaydı → gidilmeyen duraklar → mühürlü mektup → kapat.
//
// Adımların hiçbiri zorunlu değil: her birinde "Atla" var. Zorunlu tek şey
// sonda: gezi arşive geçmeden önce yedek istiyoruz. Kapatmak yeni kayıt
// eklenmesini durduruyor — geri alınabilir ama sessizce olmamalı.

const GEZI_ADIMLARI = ['ozet', 'kayit', 'kacan', 'mektup', 'kapat'];
let geziAdim = 0;
let geziDurum = null;

export async function geziSonuAc(durum, tazele) {
  tazeleDisari = tazele;
  geziDurum = durum;
  geziAdim = 0;
  await geziCiz();
}

function geziUst(baslik, alt) {
  return `<div class="gs-sayac">Gezi Sonu · ${geziAdim + 1}/${GEZI_ADIMLARI.length}</div>
    <div class="gs-noktalar">${GEZI_ADIMLARI.map((_, i) =>
      `<span class="gs-nokta${i <= geziAdim ? ' dolu' : ''}"></span>`).join('')}</div>
    <div class="ortu-baslik">${baslik}</div>
    ${alt ? `<div class="ortu-alt">${alt}</div>` : ''}`;
}

// Alt şerit her adımda aynı: geri, atla/devam. Son adımda "Geziyi kapat".
function geziAlt(ileriYazi = 'Devam') {
  return `<div class="gs-dugmeler">
    ${geziAdim > 0 ? '<button class="eylem-dugme" id="gzGeri">Geri</button>' : ''}
    <button class="eylem-dugme birincil" id="gzIleri">${ileriYazi}</button>
  </div>`;
}

function geziAltiKur(ileriIslev = null) {
  $('#gzGeri') && ($('#gzGeri').onclick = () => { geziAdim = Math.max(0, geziAdim - 1); geziCiz(); });
  $('#gzIleri').onclick = ileriIslev || (() => {
    geziAdim++;
    if (geziAdim >= GEZI_ADIMLARI.length) { kapat(); tazeleDisari?.(); return; }
    geziCiz();
  });
}

async function geziCiz() {
  const ad = GEZI_ADIMLARI[geziAdim];
  if (ad === 'ozet') return geziOzet();
  if (ad === 'kayit') return geziKayit();
  if (ad === 'kacan') return geziKacan();
  if (ad === 'mektup') return geziMektup();
  if (ad === 'kapat') return geziKapat();
}

async function geziOzet() {
  const s = gerok.aktifGerok();
  const turId = s?.id ?? null;
  const kayitlar = await veri.kayitlariGetir(turId);
  const izNoktalari = await veri.izGetir(turId);

  const km = iz.izUzunlugu(izNoktalari);
  const sesler = kayitlar.filter(k => ['ses', 'ortam', 'gunluk', 'baslangic', 'bitis', 'mektup'].includes(k.tur)).length;
  const kisiler = kayitlar.filter(k => k.tur === 'kisi').length;
  const gunSayisi = s?.gunler?.length || 0;

  ortu(`
    ${geziUst('Gezinin özeti', s ? kacisYerel(s.ad) : 'Sayılarla.')}
    <div class="gs-ozet">
      <div class="gs-kutu"><div class="gs-sayi">${gunSayisi || '—'}</div><div class="gs-etiket">gün</div></div>
      <div class="gs-kutu"><div class="gs-sayi">${km.toFixed(0)}</div><div class="gs-etiket">km</div></div>
      <div class="gs-kutu"><div class="gs-sayi">${kayitlar.length}</div><div class="gs-etiket">kayıt · ${sesler} ses</div></div>
      <div class="gs-kutu"><div class="gs-sayi">${kisiler}</div><div class="gs-etiket">tanıştığın kişi</div></div>
    </div>
    ${geziAlt()}
  `, 'gezisonu');
  geziAltiKur();
}

async function geziKayit() {
  const turId = gerok.aktifGerok()?.id ?? null;
  const varMi = (await veri.kayitlariGetir(turId)).some(k => k.tur === 'bitis');

  ortu(`
    ${geziUst('Bitiş kaydı',
      'Son sesli not. Hâlâ oradayken, dönüş yolunu beklerken: ne oldu, ne değişti, ' +
      'ne beklemiyordun?')}
    ${varMi ? '<div class="panel-not">Bitiş kaydı zaten alınmış. İstersen bir tane daha bırakabilirsin.</div>' : ''}
    <button class="buyuk-dugme birincil" id="gzKayit" style="margin-top:14px">
      <span class="dugme-ikon">${ikon('mikrofon', 28)}</span>
      <span class="dugme-ad">Bitiş kaydını al</span>
    </button>
    <div id="gzKayitDurum" class="panel-not"></div>
    ${geziAlt('Atla')}
  `, 'gezisonu');

  $('#gzKayit').onclick = () => sesKaydiBaslat('bitis', {
    ipucu: 'Bitiş kaydı · bitince "Durdur ve kaydet"',
    bittiginde: async (k) => {
      const e = $('#gzKayitDurum');
      if (e) e.textContent = k ? `Kaydedildi · ${Math.round(k.sure)} saniye.` : 'Çok kısaydı.';
      if (k) { await tazeleDisari?.(); $('#gzIleri').textContent = 'Devam'; }
    }
  });
  geziAltiKur();
}

// Gidilmeyen duraklar bir sonraki gezinin başlangıcı. "Kaçırdık" işaretlisi ve
// hiç dokunulmamışı birlikte listeleniyor — ikisi de gidilmemiş demek.
async function geziKacan() {
  const durumlar = await veri.durakDurumlari();
  const tumDuraklar = gerok.duraklar();
  const kacanlar = tumDuraklar.filter(d => durumlar[d.id]?.durum !== 'gidildi');
  // "Hepsine gidilmiş" ile "hiç durak yok" aynı şey değil; ikisine aynı
  // cümleyi yazmak yanlış bir şey söylemek olurdu.
  const bosMesaj = tumDuraklar.length
    ? 'Bütün duraklara gidilmiş. Nadir olur.'
    : 'Bu gezide durak listesi yok — kaçırılan bir şey de yok.';

  ortu(`
    ${geziUst('Gidilmeyen duraklar',
      'Kaçırdıklarını bir yere yazalım — sonraki gezinin başlangıcı bu liste olur.')}
    ${kacanlar.length ? `
      <div class="gs-liste">
        ${kacanlar.map(d => `<div class="gs-liste-satir">
          <div class="gs-liste-ad">${kacisYerel(d.ad)}</div>
          <div class="gs-liste-alt">${d.gun == null ? 'günsüz' : `${d.gun}. gün`}</div>
        </div>`).join('')}
      </div>
      <button class="eylem-dugme" id="gzKacanYaz">“Bir sonraki gezi” listesine yaz</button>
    ` : `<div class="panel-not">${bosMesaj}</div>`}
    <div id="gzKacanDurum" class="panel-not"></div>
    ${geziAlt(kacanlar.length ? 'Atla' : 'Devam')}
  `, 'gezisonu');

  $('#gzKacanYaz') && ($('#gzKacanYaz').onclick = async () => {
    // Not bir kayıt olarak yazılıyor: zaman çizgisinde durur, yedeğe girer,
    // arşive geçer. Ayrı bir "listeler" kavramı icat etmeye gerek yok.
    const metin = 'Bir sonraki gezi — gidilmeyen duraklar:\n' +
      kacanlar.map(d => `· ${d.ad}`).join('\n');
    const temel = await kayit.yaziEkle(metin);
    if (temel) await veri.kayitEkle(temel);
    $('#gzKacanDurum').textContent = `${kacanlar.length} durak zaman çizgisine yazıldı.`;
    kayitBildir('Kaçırdıkların “bir sonraki gezi” listesine yazıldı', 'iyi');
    $('#gzIleri').textContent = 'Devam';
    await tazeleDisari?.();
  });
  geziAltiKur();
}

async function geziMektup() {
  const turId = gerok.aktifGerok()?.id ?? null;
  const mektuplar = (await veri.kayitlariGetir(turId)).filter(k => k.tur === 'mektup');

  ortu(`
    ${geziUst('Mühürlü mektup',
      'Kendine yaz, yıllar sonra açılsın. Şifre yok — o kadar yıl sonra kaybolacak ' +
      'tek şey parola olurdu. Kilit değil, söz.')}
    ${mektuplar.length
      ? `<div class="panel-not">Yazılmış: ${mektuplar.map(m => m.hedefYil || '?').join(', ')}</div>`
      : ''}
    <button class="eylem-dugme birincil" id="gzMektup">Mektubu yaz</button>
    ${geziAlt('Atla')}
  `, 'gezisonu');

  // Mektup akışı örtüyü kendi devralıyor; kapanınca Gezi Sonu'na dönüyoruz.
  $('#gzMektup').onclick = () => mektupAc(async () => {
    await tazeleDisari?.();
  });
  geziAltiKur();
}

async function geziKapat() {
  const s = gerok.aktifGerok();
  const sonYedek = await veri.ayarOku('sonYedek', null);
  const gecen = sonYedek ? Math.round((Date.now() - sonYedek) / 3600_000) : null;

  ortu(`
    ${geziUst('Geziyi kapat',
      'Önce son yedeği al, sonra arşive geçir. Kayıtlar telefonda kalır, ' +
      'hiçbir yere gönderilmez.')}
    ${sonYedek
      ? `<div class="panel-not">Son yedek ${gecen < 1 ? 'az önce' : `${gecen} saat önce`} alındı.</div>`
      : '<div class="panel-not">Henüz hiç yedek alınmadı. Kapatmadan önce al.</div>'}
    <button class="eylem-dugme birincil" id="gzYedek">Son yedeği al</button>
    <button class="eylem-dugme" id="gzGonder">Bütün geziyi arkadaşıma gönder</button>
    <div id="gzKapatDurum" class="panel-not"></div>
    <div class="panel-not">Kapatınca gezi arşive geçer: yeni kayıt eklenmez,
    her şey okunur kalır. Gerok → gezi → Bütün geziler'den geri açılabilir.</div>
    <div class="gs-dugmeler">
      <button class="eylem-dugme" id="gzGeri">Geri</button>
      <button class="eylem-dugme birincil" id="gzKapatOnay">Geziyi kapat</button>
    </div>
  `, 'gezisonu');

  const bildir = (m) => { const e = $('#gzKapatDurum'); if (e) e.textContent = m; };
  $('#gzYedek').onclick = () => yedekAl(bildir);
  $('#gzGonder').onclick = () => paketGonder(bildir, null);
  $('#gzGeri').onclick = () => { geziAdim--; geziCiz(); };
  $('#gzKapatOnay').onclick = async () => {
    if (!s) { kapat(); await tazeleDisari?.(); return; }
    await gerok.turArsivle(s.id, true);
    kapat();
    kayitBildir('Gezi kapandı · arşive geçti', 'iyi');
    await tazeleDisari?.();
  };
}

// Örtü içinde metin basarken kullanılan küçük kaçış. app.js'teki `kacis` dışa
// açık ama buraya almak döngüsel bir bağımlılık kurardı; kopyası daha ucuz.
function kacisYerel(s) {
  return String(s ?? '').replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

/**
 * Mühürlü mektup.
 *
 * Önce yıl sabitti (2036). Artık soruluyor: bir mektup on yıl sonrasına,
 * bir başkası çocuğun 18 yaşına, bir başkası önümüzdeki yılın aynı gününe
 * yazılabilsin. Yıl kaydın içine yazılıyor; arşiv de o yılı gösteriyor.
 */
/**
 * Yıla yönelme eki: 2036'ya, 2044'e, 2031'e, 2027'ye…
 *
 * Sabit bir "'ya" koymak "2044'ya mektup" gibi yanlış bir başlık üretiyordu.
 * Ek, yılın SÖYLENİŞİNDEKİ son kelimeye göre değişiyor: kırk dört → dörde,
 * otuz altı → altıya. O yüzden son rakama (sıfırsa onlar basamağına) bakılıyor.
 */
export function yilaEk(yil) {
  const s = String(yil);
  const son = +s.slice(-1);
  if (son !== 0) {
    // bire, ikiye, üçe, dörde, beşe, altıya, yediye, sekize, dokuza
    return ['', "'e", "'ye", "'e", "'e", "'e", "'ya", "'ye", "'e", "'a"][son];
  }
  const onlar = +s.slice(-2, -1);
  // ona, yirmiye, otuza, kırka, elliye, altmışa, yetmişe, seksene, doksana
  if (onlar !== 0) return ["", "'a", "'ye", "'a", "'a", "'ye", "'a", "'e", "'e", "'a"][onlar];
  return "'e";   // 2000 → "iki bin" → bine
}

/**
 * Doğum yılı bir kez soruluyor — yalnızca "50. yaşım" seçeneği için.
 * Telefonda kalıyor, hiçbir pakete girmiyor: kimseye gönderilen bir bilgi değil.
 */
function dogumYiliSor(tazele) {
  const buYil = new Date().getFullYear();
  ortu(`
    <div class="ortu-baslik">Kaç yılında doğdun?</div>
    <div class="ortu-alt">Yalnızca "50. yaşım" seçeneğinin hangi yıla denk
    geldiğini hesaplamak için. Telefonda kalır, hiçbir pakete girmez.</div>
    <input class="girdi" id="dogumYil" type="number" inputmode="numeric"
           min="${buYil - 120}" max="${buYil}" placeholder="örn. ${buYil - 35}">
    <button class="eylem-dugme birincil" id="dogumTamam">Kaydet</button>
    <button class="eylem-dugme" id="dogumVaz">Geri</button>
  `, 'gezisonu');
  setTimeout(() => $('#dogumYil')?.focus(), 120);
  $('#dogumVaz').onclick = () => mektupAc(tazele);
  $('#dogumTamam').onclick = async () => {
    const y = Number($('#dogumYil').value);
    if (!Number.isFinite(y) || y < buYil - 120 || y > buYil) { $('#dogumYil').focus(); return; }
    await veri.ayarYaz('dogumYili', y);
    await mektupAc(tazele);
  };
}

/**
 * Mühürlü mektup — hangi yıla.
 *
 * Dördüncü seçenek bir yıl değil, bir yaş: "50. yaşım". Şartnamenin fikri ve
 * doğru olan bu — on yıl sonra "2046" bir sayı, "50 yaşıma girdiğim gün" bir
 * an. Doğum yılı bir kez soruluyor, sonra hep hatırlanıyor.
 */
export async function mektupAc(tazele) {
  const buYil = new Date().getFullYear();
  const dogum = await veri.ayarOku('dogumYili', null);
  const ellinci = dogum ? dogum + 50 : null;

  const secenekler = [
    { yil: buYil + 5,  alt: 'beş yıl sonra' },
    { yil: buYil + 10, alt: 'on yıl sonra' },
    { yil: buYil + 20, alt: 'yirmi yıl sonra' }
  ];
  // Elli yaşı geçmişse o seçenek anlamsız; listeye konmuyor.
  if (!ellinci || ellinci > buYil) {
    secenekler.push({
      yil: ellinci, yas: true,
      alt: ellinci ? `${ellinci} — o yıl 50 yaşına giriyorsun` : 'doğum yılını sorar'
    });
  }

  ortu(`
    <div class="ortu-baslik">Hangi yıla yazıyorsun?</div>
    <div class="ortu-alt">O yıl gelene kadar mektup arşivde kapalı durur.
    Şifre yok — kilit değil, söz.</div>
    ${secenekler.map(s => `
      <button class="eylem-dugme ${s.yil === buYil + 10 ? 'birincil' : ''}"
              data-yil="${s.yil ?? ''}"${s.yas ? ' data-yas="1"' : ''}>
        ${s.yas ? '50. yaşım' : s.yil}<span class="yol-alt">${s.alt}</span>
      </button>`).join('')}
    <div class="girdi-etiket" style="margin-top:14px">Ya da bir yıl yaz</div>
    <input class="girdi" id="mektupYil" type="number" inputmode="numeric"
           min="${buYil}" max="2200" placeholder="örn. ${buYil + 30}">
    <button class="eylem-dugme" id="mektupYilTamam">Bu yıla yaz</button>
  `, 'gezisonu');

  const basla = (yil) => {
    ozelKayitAc({
      tur: 'mektup',
      baslik: `${yil}${yilaEk(yil)} mektup`,
      alt: 'Konuşarak ya da yazarak. İkisi de olur.',
      ekler: { hedefYil: yil },
      tazele
    });
  };

  document.querySelectorAll('#ortuIc [data-yil]').forEach(b => {
    b.addEventListener('click', () => {
      if (b.dataset.yas && !dogum) { dogumYiliSor(tazele); return; }
      basla(Number(b.dataset.yil));
    });
  });
  $('#mektupYilTamam').addEventListener('click', () => {
    const y = Number($('#mektupYil').value);
    // Geçmişe mühürlü mektup olmaz; yanlış yazımı sessizce kabul etmek,
    // on yıl sonra "1926'ya mektup" diye bir kayıt bırakırdı.
    if (!Number.isFinite(y) || y <= buYil || y > 2200) {
      $('#mektupYil').focus();
      return;
    }
    basla(y);
  });
}

function ozelKayitAc({ tur, baslik, alt, tazele, ekler = null }) {
  const muhur = tur === 'mektup';
  ortu(`
    <div class="ortu-baslik">${baslik}</div>
    <div class="ortu-alt">${alt}</div>
    <button class="buyuk-dugme birincil" id="ozelSes">
      <span class="dugme-ikon">${ikon('mikrofon', 28)}</span>
      <span class="dugme-ad">Konuşmaya başla</span>
    </button>
    <div class="girdi-etiket" style="margin-top:16px">Ya da yaz</div>
    <textarea class="alan" id="ozelYazi"
      placeholder="${muhur ? 'O gün bunu okuyan kişiye…' : '…'}"></textarea>
    <div id="ozelDurum" class="panel-not"></div>
    <div class="gs-dugmeler">
      <button class="eylem-dugme" id="ozelKapat">Kapat</button>
      <button class="eylem-dugme birincil" id="ozelKaydet">${muhur ? 'Mühürle' : 'Yazıyı kaydet'}</button>
    </div>
  `, 'gezisonu');

  $('#ozelSes').addEventListener('click', () => sesKaydiBaslat(tur, {
    ipucu: `${baslik} · bitince "Durdur ve kaydet"`,
    ekler,
    bittiginde: async (k) => {
      const e = $('#ozelDurum');
      if (e) e.textContent = k ? `Kaydedildi · ${Math.round(k.sure)} saniye.` : 'Çok kısaydı.';
      if (k) await tazele?.();
    }
  }));

  $('#ozelKaydet').onclick = async () => {
    const metin = $('#ozelYazi').value.trim();
    if (metin) {
      const { kayitEkle } = await import('./veri.js');
      const temel = await kayit.yaziEkle(metin);
      if (temel) {
        temel.tur = tur;
        Object.assign(temel, ekler || {});
        await kayitEkle(temel);
      }
      $('#ozelDurum').textContent = muhur ? 'Mühürlendi.' : 'Yazı kaydedildi.';
      $('#ozelYazi').value = '';
      if (muhur) kayitBildir(`Mühürlendi · ${ekler?.hedefYil ?? ''} yılına`, 'iyi');
      await tazele?.();
    }
  };
  $('#ozelKapat').onclick = kapat;
}
