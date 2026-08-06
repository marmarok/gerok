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
import { sesKaydiBaslat } from './app.js';

const $ = (s) => document.querySelector(s);

let adim = 0;
let gun = null;
let tazeleDisari = null;

const ADIMLAR = ['ozet', 'gunluk', 'siradan', 'ufak', 'fotograf', 'kapanis'];

export async function gunSonuAc(durum, tazele) {
  tazeleDisari = tazele;
  gun = gerok.bugununGunu() || sonGun();
  adim = 0;
  await ciz(durum);
}

function sonGun() {
  const s = gerok.aktifGerok();
  if (!s?.gunler?.length) return null;
  const gecmis = s.gunler.filter(g => new Date(g.pencere[0]).getTime() <= Date.now());
  return gecmis[gecmis.length - 1] || s.gunler[0];
}

function ortu(html) {
  $('#ortuIc').innerHTML = html;
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
  return `<div class="gs-sayac">Gün Sonu · ${adim + 1}/${ADIMLAR.length}</div>
    <div class="ortu-baslik">${baslik}</div>
    ${alt ? `<div class="ortu-alt">${alt}</div>` : ''}`;
}

async function ciz(durum) {
  const ad = ADIMLAR[adim];
  if (ad === 'ozet') return ozetAdimi(durum);
  if (ad === 'gunluk') return gunlukAdimi(durum);
  if (ad === 'siradan') return siradanAdimi(durum);
  if (ad === 'ufak') return ufakAdimi(durum);
  if (ad === 'fotograf') return fotografAdimi(durum);
  if (ad === 'kapanis') return kapanisAdimi(durum);
}

// ---- 1. Günün özeti -------------------------------------------------------

async function ozetAdimi(durum) {
  const turId = gerok.aktifGerok()?.id ?? null;
  const kayitlar = await veri.kayitlariGetir(turId);
  const izNoktalari = await veri.izGetir(turId);

  const bugunkuler = gun ? kayitlar.filter(k => k.gun === gun.no) : [];
  const pencere = gun ? gun.pencere.map(s => new Date(s).getTime()) : [0, 0];
  const bugunkuIz = izNoktalari.filter(n => n.t >= pencere[0] && n.t <= pencere[1]);

  const km = iz.izUzunlugu(bugunkuIz);
  const sesler = bugunkuler.filter(k => ['ses', 'ortam', 'gunluk'].includes(k.tur)).length;
  const gorseller = bugunkuler.filter(k => ['foto', 'video', 'siradan'].includes(k.tur)).length;

  const ulkeler = [...new Set(bugunkuler.filter(k => k.tur === 'sinir').map(k => k.ulke))];

  ortu(`
    ${ustBilgi(gun ? `Gün ${gun.no} · ${gun.baslik}` : 'Bugün', gun ? gerok.tarihUzun(new Date(gun.tarih).getTime()) : '')}
    <div class="gs-ozet">
      <div class="gs-kutu"><div class="gs-sayi">${km.toFixed(0)}</div><div class="gs-etiket">km yol</div></div>
      <div class="gs-kutu"><div class="gs-sayi">${gorseller}</div><div class="gs-etiket">fotoğraf</div></div>
      <div class="gs-kutu"><div class="gs-sayi">${sesler}</div><div class="gs-etiket">ses kaydı</div></div>
      <div class="gs-kutu"><div class="gs-sayi">${bugunkuler.length}</div><div class="gs-etiket">toplam kayıt</div></div>
    </div>
    ${ulkeler.length ? `<div class="panel-not">Bugün geçtiğin sınır: ${ulkeler.map(gerok.ulkeAdi).join(', ')}</div>` : ''}
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
    ${ustBilgi('Bugünden aklında ne kaldı?',
      'Otuz saniye yeter. On yıl sonra en çok bunu dinleyeceksin — fotoğrafları değil.')}
    <div id="gunlukDurum" class="panel-not">Dokun ve konuş. Bitince "Durdur ve kaydet".</div>
    <button class="buyuk-dugme birincil" id="gunlukKayit" style="margin-top:14px">
      <span class="dugme-ikon">🎙</span>
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

// ---- 3. Sıradan kare ------------------------------------------------------

async function siradanAdimi(durum) {
  ortu(`
    ${ustBilgi('Bugünün sıradan karesi',
      'Manzara değil: odan, kahvaltı masası, otobüsün içi, benzinlik, elindeki para. ' +
      'Şu an anlamsız gelir. On yıl sonra en çok bakacağın kare bu olacak.')}
    <button class="eylem-dugme birincil" id="siradanSec">Galeriden seç</button>
    <div id="siradanDurum" class="panel-not"></div>
    <div class="gs-dugmeler">
      <button class="eylem-dugme" id="gsAtla">Bugün yok</button>
      <button class="eylem-dugme birincil" id="gsIleri">Devam</button>
    </div>
  `);

  $('#siradanSec').onclick = () => {
    const secici = document.createElement('input');
    secici.type = 'file';
    secici.accept = 'image/*';
    secici.addEventListener('change', async () => {
      if (!secici.files.length) return;
      $('#siradanDurum').textContent = 'Ekleniyor…';
      try {
        await kayit.fotoAl(secici.files, null, 'siradan');
        $('#siradanDurum').textContent = 'Eklendi.';
        navigator.vibrate?.([8, 40, 8]);
      } catch (hata) {
        // Akış burada takılı kalmasın; "Devam" hep basılabilir olsun.
        $('#siradanDurum').textContent = `Eklenemedi: ${hata.message}`;
      }
    });
    secici.click();
  };

  $('#gsAtla').onclick = () => ilerle(durum);
  $('#gsIleri').onclick = () => ilerle(durum);
}

// ---- 4. Kişi ve fiyat -----------------------------------------------------

async function ufakAdimi(durum) {
  ortu(`
    ${ustBilgi('Bugünden iki ufak şey', 'İkisi de atlanabilir.')}
    <div class="girdi-etiket">Tanıştığın biri oldu mu?</div>
    <input class="girdi" id="uKisi" placeholder="Adı">
    <input class="girdi" id="uKisiNot" placeholder="Nerede, nasıl?" style="margin-top:8px">
    <div class="girdi-etiket" style="margin-top:16px">Kayda değer bir fiyat?</div>
    <input class="girdi" id="uFiyatNe" placeholder="Kahve, bilet, yemek…">
    <div style="display:flex; gap:8px; margin-top:8px">
      <input class="girdi" id="uFiyatTutar" placeholder="120" inputmode="decimal" style="flex:1">
      <input class="girdi" id="uFiyatPara" placeholder="dinar" style="flex:1.4">
    </div>
    <div class="gs-dugmeler">
      <button class="eylem-dugme" id="gsAtla">Atla</button>
      <button class="eylem-dugme birincil" id="gsIleri">Devam</button>
    </div>
  `);

  const kaydetVeIlerle = async () => {
    const ad = $('#uKisi').value;
    if (ad.trim()) await kayit.kisiEkle(ad, $('#uKisiNot').value);
    const ne = $('#uFiyatNe').value;
    if (ne.trim()) await kayit.fiyatEkle(ne, $('#uFiyatTutar').value, $('#uFiyatPara').value);
    await ilerle(durum);
  };

  $('#gsAtla').onclick = () => ilerle(durum);
  $('#gsIleri').onclick = kaydetVeIlerle;
}

// ---- 5. Bugünü topla ------------------------------------------------------

async function fotografAdimi(durum) {
  ortu(`
    ${ustBilgi('Bugünü topla',
      'Günün fotoğraf ve videolarını seç. Orijinaller galeride kalıyor — ' +
      'buraya küçük bir önizleme, çekilme saati ve konum yazılıyor.')}
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

// ---- 6. Yedek ve gönder ---------------------------------------------------

async function kapanisAdimi(durum) {
  const sonYedek = await veri.ayarOku('sonYedek', null);
  const gecen = sonYedek ? Math.round((Date.now() - sonYedek) / 3600_000) : null;

  ortu(`
    ${ustBilgi('Son iki adım',
      'Yedek: uygulama silinse bile veri dursun diye. Gönder: arkadaşınla birleşsin diye. ' +
      'İkisi de internet istemez.')}
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
  $('#gsBitir').onclick = async () => { kapat(); await tazeleDisari?.(); };
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

export function mektupAc(tazele) {
  ozelKayitAc({
    tur: 'mektup',
    baslik: '2036\'ya mektup',
    alt: 'On yıl sonraki kendine. Arşivde ayrı bir MÜHÜRLÜ klasöründe duracak, ' +
         'görüntüleyici içeriğini göstermeyecek. Şifrelenmiyor — on yıl sonra ' +
         'kaybolacak tek şey parola olurdu. Kilit değil, söz.',
    tazele
  });
}

function ozelKayitAc({ tur, baslik, alt, tazele }) {
  ortu(`
    <div class="ortu-baslik">${baslik}</div>
    <div class="ortu-alt">${alt}</div>
    <button class="buyuk-dugme birincil" id="ozelSes">
      <span class="dugme-ikon">🎙</span>
      <span class="dugme-ad">Konuşmaya başla</span>
    </button>
    <div class="girdi-etiket" style="margin-top:16px">Ya da yaz</div>
    <textarea class="alan" id="ozelYazi" placeholder="…"></textarea>
    <div id="ozelDurum" class="panel-not"></div>
    <div class="gs-dugmeler">
      <button class="eylem-dugme" id="ozelKapat">Kapat</button>
      <button class="eylem-dugme birincil" id="ozelKaydet">Yazıyı kaydet</button>
    </div>
  `);

  $('#ozelSes').addEventListener('click', () => sesKaydiBaslat(tur, {
    ipucu: `${baslik} · bitince "Durdur ve kaydet"`,
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
        await kayitEkle(temel);
      }
      $('#ozelDurum').textContent = 'Yazı kaydedildi.';
      $('#ozelYazi').value = '';
      await tazele?.();
    }
  };
  $('#ozelKapat').onclick = kapat;
}
