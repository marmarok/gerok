// Gerok — gezi paketi içe alma sihirbazı.
//
// Eskiden tek adımdı: dosyayı seç, uygulama okusun, bitti. İki sorunu vardı.
//
//   1. GÖRMEDEN KABUL. Dosyada ne olduğu ancak yüklendikten sonra
//      görülüyordu. Yanlış dosya seçilince gezi bozuluyor, geri almak için
//      elle temizlemek gerekiyordu.
//   2. HEPSİ YA DA HİÇBİRİ. Programdaki 26 durağın 4'ü istenmiyorsa
//      çaresi yoktu; hepsi geliyor, sonra tek tek siliniyordu.
//
// Sihirbaz altı-yedi adımda ilerliyor ve HİÇBİR ŞEY YAZMIYOR — son adımda
// "Yeni gezi olarak aç" denene kadar telefonda hiçbir şey değişmiyor.
// Her adımda "Vazgeç, hiçbir şey eklemeden çık" duruyor.
//
// Adımlar: dosya → [işaret] → günler → duraklar → öneriler → harita → özet
// "işaret" adımı yalnızca dosya düz metinse çıkıyor: yapılandırılmış bir
// .gerok paketinde işaretlenecek bir şey yok, o adımı göstermek kullanıcıyı
// boş bir ekranda "Devam"a bastırmak olurdu.

import * as gerok from './gerok.js';
import * as veri from './veri.js';

// `kacis` app.js'te de var ama oradan almak döngüsel içe aktarma yapardı
// (app.js bu dosyayı alıyor). Üç satırlık bir işlev için buna değmez.
const kacis = (s) => String(s ?? '').replace(/[&<>"']/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const ADIMLAR = {
  dosya:    { baslik: 'Hangi dosyayı okuyayım?' },
  isaret:   { baslik: 'Satırları parmakla işaretle' },
  gunler:   { baslik: 'Günler doğru mu?' },
  duraklar: { baslik: 'Hangi duraklar alınsın?' },
  oneriler: { baslik: 'Programdaki notlar' },
  harita:   { baslik: 'İndirilecek harita paketleri' },
  ozet:     { baslik: 'Paket hazır' }
};

// Sihirbazın belleği. Hiçbiri kalıcı değil — pencere kapanınca gidiyor.
let d = null;

/**
 * Sihirbazı açar.
 *
 * `ortuAc`, `ortuKapat`, `bildir`, `tazele`: app.js'ten geliyor. Bu dosya
 * DOM'a doğrudan dokunmuyor ki aynı akış ileride başka bir kabuğun içinde
 * de çalışabilsin.
 */
export function sihirbaziAc({ ortuAc, ortuKapat, bildir, tazele, haritayaGit }) {
  d = {
    adim: 'dosya', dosyaAdi: '', metin: '', paket: null,
    satirlar: [], gunler: [], duraklar: [], oneriler: [],
    seciliDurak: new Set(), seciliOneri: new Set(),
    haritaIste: true,
    araclar: { ortuAc, ortuKapat, bildir, tazele, haritayaGit }
  };
  ciz();
}

function kapat() {
  d?.araclar.ortuKapat();
  d = null;
}

// --- Çerçeve ---------------------------------------------------------------

function ciz() {
  const a = ADIMLAR[d.adim];
  const sira = gorunurAdimlar();
  const no = sira.indexOf(d.adim) + 1;

  d.araclar.ortuAc(`
    <div class="sihirbaz">
      <div class="sihirbaz-sayac">${no}/${sira.length}</div>
      <div class="ortu-baslik">${a.baslik}</div>
      ${govde()}
      <div class="sihirbaz-alt">
        ${no > 1 ? '<button class="eylem-dugme" id="shGeri">Geri</button>' : ''}
        ${ileriDugmesi()}
      </div>
      <button class="eylem-dugme" id="shVaz">Vazgeç, hiçbir şey eklemeden çık</button>
    </div>
  `, false, 'paket');

  // Örtü `kapanabilir: false` açılıyor: yanlışlıkla dışarı dokununca seçilen
  // dosya ve işaretlenen satırlar kaybolmasın. Çıkış yalnızca düğmelerden.
  document.getElementById('shVaz').addEventListener('click', kapat);
  document.getElementById('shGeri')?.addEventListener('click', () => {
    d.adim = sira[no - 2];
    ciz();
  });
  bagla();
}

/** Bu dosya için hangi adımlar var? "işaret" yalnızca düz metinde. */
function gorunurAdimlar() {
  const hepsi = ['dosya', 'isaret', 'gunler', 'duraklar', 'oneriler', 'harita', 'ozet'];
  return hepsi.filter(k => k !== 'isaret' || d.duzMetin);
}

function ileri() {
  const sira = gorunurAdimlar();
  d.adim = sira[sira.indexOf(d.adim) + 1];
  ciz();
}

function ileriDugmesi() {
  if (d.adim === 'ozet') {
    return '<button class="eylem-dugme birincil" id="shBitir">Yeni gezi olarak aç</button>';
  }
  // Düğme sönük ama TIKLANABİLİR kalıyor: karartılmış bir düğmeye basıp
  // hiçbir şey olmaması, neden olmadığını da söylemiyor. Basılınca sebebi
  // yazıyor.
  const hazir = d.adim !== 'dosya' || !!d.paket || d.duzMetin;
  return `<button class="eylem-dugme birincil${hazir ? '' : ' sonuk'}" id="shIleri">Devam</button>`;
}

// --- Adımların gövdeleri ---------------------------------------------------

function govde() {
  switch (d.adim) {
    case 'dosya': return dosyaGovde();
    case 'isaret': return isaretGovde();
    case 'gunler': return gunlerGovde();
    case 'duraklar': return duraklarGovde();
    case 'oneriler': return onerilerGovde();
    case 'harita': return haritaGovde();
    case 'ozet': return ozetGovde();
  }
  return '';
}

function dosyaGovde() {
  return `
    <div class="ortu-alt">Bilgisayardan gelen gezi paketi (.gerok) ya da
    programın düz metin hâli. Dosya yalnızca OKUNUYOR — bu adımda telefona
    hiçbir şey yazılmıyor.</div>
    <input type="file" id="shDosya" class="alan" accept=".gerok,.json,.txt,.md,text/plain">
    ${d.dosyaAdi ? `<div class="sihirbaz-ozet">
      <div class="sihirbaz-satir"><span>Dosya</span><b>${kacis(d.dosyaAdi)}</b></div>
      <div class="sihirbaz-satir"><span>Tür</span><b>${d.duzMetin ? 'düz metin' : 'Gerok paketi'}</b></div>
      ${d.paket ? `<div class="sihirbaz-satir"><span>Gezi</span><b>${kacis(d.paket.gerok?.ad || '—')}</b></div>` : ''}
    </div>` : ''}
    ${d.hata ? `<div class="sihirbaz-hata">${kacis(d.hata)}</div>` : ''}`;
}

function isaretGovde() {
  return `
    <div class="ortu-alt">Bu düz bir metin. Hangi satır ne, uygulamanın
    bilmesi mümkün değil — sen söyle. Satıra her dokunuşta sırayla değişir:
    <b>gün başlığı</b> → <b>durak</b> → <b>not</b> → boş.</div>
    <div class="sihirbaz-satirlar">
      ${d.satirlar.map((s, i) => `
        <button class="isaret-satir ${s.tur || ''}" data-satir="${i}">
          <span class="isaret-etiket">${{ gun: 'GÜN', durak: 'DURAK', not: 'NOT' }[s.tur] || '—'}</span>
          <span class="isaret-yazi">${kacis(s.metin)}</span>
        </button>`).join('')}
    </div>`;
}

function gunlerGovde() {
  if (!d.gunler.length) {
    return `<div class="ortu-alt">Dosyada gün bulunamadı. Sorun değil —
    duraklar günsüz de alınabilir, sonra tek tek güne taşırsın.</div>`;
  }
  return `
    <div class="ortu-alt">Başlıkları düzeltebilirsin. Bunlar zaman çizgisinde
    gün ayraçlarının üstünde yazacak.</div>
    ${d.gunler.map((g, i) => `
      <div class="sihirbaz-gun">
        <span class="sihirbaz-gunno">Gün ${g.no ?? i + 1}</span>
        <input class="alan tek" data-gun="${i}" value="${kacis(g.baslik || '')}"
               placeholder="Örn. sabah şehirden ayrılış">
      </div>`).join('')}`;
}

function duraklarGovde() {
  if (!d.duraklar.length) {
    return '<div class="ortu-alt">Dosyada durak yok. Gezi yine de açılır; durakları haritadan elle koyabilirsin.</div>';
  }
  return `
    <div class="ortu-alt">İşaretli olanlar alınacak. İstemediğin durağı
    şimdi çıkarmak, sonra tek tek silmekten kolay.</div>
    <div class="sihirbaz-secim">
      ${d.duraklar.map((s, i) => `
        <button class="sec-satir ${d.seciliDurak.has(i) ? 'secili' : ''}" data-durak="${i}">
          <span class="tik-kutu">${d.seciliDurak.has(i) ? '✓' : ''}</span>
          <span class="sec-yazi">${kacis(s.ad)}
            ${s.gun != null ? `<i>${s.gun}. gün</i>` : ''}</span>
        </button>`).join('')}
    </div>
    <div class="sihirbaz-alt-satir">
      <button class="kucuk-dugme" id="shHepsi">Hepsini seç</button>
      <button class="kucuk-dugme" id="shHicbiri">Hiçbirini seçme</button>
    </div>`;
}

function onerilerGovde() {
  if (!d.oneriler.length) {
    return '<div class="ortu-alt">Programda durağa bağlı not yok.</div>';
  }
  return `
    <div class="ortu-alt">Duraklara bağlı "unutma" notları. Durağa varınca
    ekrana bunlar düşecek.</div>
    <div class="sihirbaz-secim">
      ${d.oneriler.map((o, i) => `
        <button class="sec-satir ${d.seciliOneri.has(i) ? 'secili' : ''}" data-oneri="${i}">
          <span class="tik-kutu">${d.seciliOneri.has(i) ? '✓' : ''}</span>
          <span class="sec-yazi">${kacis(o.metin)}<i>${kacis(o.durakAd)}</i></span>
        </button>`).join('')}
    </div>`;
}

function haritaGovde() {
  const k = kutu();
  const secili = [...d.seciliDurak].map(i => d.duraklar[i]).filter(s => s.lat != null);
  return `
    <div class="ortu-alt">Seçtiğin durakların kapladığı alan. Harita paketi
    ev wi-fi'sinde bir kez inip telefonda kalıyor — yolda internet
    gerekmiyor.</div>
    <div class="sihirbaz-ozet">
      <div class="sihirbaz-satir"><span>Koordinatlı durak</span><b>${secili.length}</b></div>
      ${k ? `<div class="sihirbaz-satir"><span>Kuzey–güney</span><b>${k.kmY} km</b></div>
      <div class="sihirbaz-satir"><span>Doğu–batı</span><b>${k.kmX} km</b></div>` : ''}
    </div>
    <button class="sec-satir ${d.haritaIste ? 'secili' : ''}" id="shHaritaIste">
      <span class="tik-kutu">${d.haritaIste ? '✓' : ''}</span>
      <span class="sec-yazi">Gezi açılınca harita indirmeyi hatırlat</span>
    </button>
    <div class="panel-not kucuk">İndirme burada başlamıyor: paket birkaç yüz
    megabayt olabiliyor ve mobil veriyle inmesi doğru olmaz. Gezi açıldıktan
    sonra Gerok → “Harita paketi indir”den, wi-fi'deyken.</div>`;
}

function ozetGovde() {
  const gunSayi = d.gunler.length;
  const durakSayi = d.seciliDurak.size;
  const oneriSayi = d.seciliOneri.size;
  return `
    <div class="ortu-alt">Aşağıdaki gezi açılacak. Şu ana kadar telefonda
    hiçbir şey değişmedi — değişiklik bu düğmeyle oluyor.</div>
    <div class="sihirbaz-ozet">
      <div class="sihirbaz-satir"><span>Gezi</span><b>${kacis(geziAdi())}</b></div>
      <div class="sihirbaz-satir"><span>Gün</span><b>${gunSayi}</b></div>
      <div class="sihirbaz-satir"><span>Durak</span><b>${durakSayi}</b></div>
      <div class="sihirbaz-satir"><span>Not</span><b>${oneriSayi}</b></div>
      <div class="sihirbaz-satir"><span>Harita</span><b>${d.haritaIste ? 'sonra indirilecek' : 'istenmedi'}</b></div>
    </div>
    <div class="panel-not kucuk">Şu anki gezin arşive geçmiyor, duruyor —
    Gerok → “Bütün geziler”den aralarında geçebilirsin.</div>`;
}

// --- Olaylar ---------------------------------------------------------------

function bagla() {
  document.getElementById('shIleri')?.addEventListener('click', () => {
    if (d.adim === 'dosya' && !d.paket && !d.duzMetin) {
      d.araclar.bildir('Önce bir dosya seç');
      return;
    }
    ileri();
  });
  document.getElementById('shBitir')?.addEventListener('click', bitir);

  document.getElementById('shDosya')?.addEventListener('change', async (e) => {
    const dosya = e.target.files[0];
    if (!dosya) return;
    await dosyayiOku(dosya);
    ciz();
  });

  document.querySelectorAll('[data-satir]').forEach(b => {
    b.addEventListener('click', () => {
      const s = d.satirlar[+b.dataset.satir];
      const dizi = [null, 'gun', 'durak', 'not'];
      s.tur = dizi[(dizi.indexOf(s.tur || null) + 1) % dizi.length];
      metindenCikar();
      ciz();
    });
  });

  document.querySelectorAll('[data-gun]').forEach(g => {
    g.addEventListener('input', () => { d.gunler[+g.dataset.gun].baslik = g.value; });
  });

  document.querySelectorAll('[data-durak]').forEach(b => {
    b.addEventListener('click', () => {
      const i = +b.dataset.durak;
      d.seciliDurak.has(i) ? d.seciliDurak.delete(i) : d.seciliDurak.add(i);
      ciz();
    });
  });
  document.getElementById('shHepsi')?.addEventListener('click', () => {
    d.duraklar.forEach((_, i) => d.seciliDurak.add(i)); ciz();
  });
  document.getElementById('shHicbiri')?.addEventListener('click', () => {
    d.seciliDurak.clear(); ciz();
  });

  document.querySelectorAll('[data-oneri]').forEach(b => {
    b.addEventListener('click', () => {
      const i = +b.dataset.oneri;
      d.seciliOneri.has(i) ? d.seciliOneri.delete(i) : d.seciliOneri.add(i);
      ciz();
    });
  });

  document.getElementById('shHaritaIste')?.addEventListener('click', () => {
    d.haritaIste = !d.haritaIste; ciz();
  });
}

// --- Okuma -----------------------------------------------------------------

async function dosyayiOku(dosya) {
  d.dosyaAdi = dosya.name;
  d.hata = '';
  d.paket = null;
  d.duzMetin = false;
  const metin = await dosya.text();

  try {
    const p = JSON.parse(metin);
    if (!p.gerok?.id || !Array.isArray(p.gunler)) {
      throw new Error('Bu JSON bir Gerok paketine benzemiyor.');
    }
    d.paket = p;
    d.gunler = (p.gunler || []).map(g => ({ ...g }));
    d.duraklar = (p.duraklar || []).map(s => ({ ...s }));
    d.oneriler = [];
    d.duraklar.forEach((s, si) => (s.unutma || []).forEach(u =>
      d.oneriler.push({ metin: u, durakAd: s.ad, durakNo: si })));
    d.duraklar.forEach((_, i) => d.seciliDurak.add(i));
    d.oneriler.forEach((_, i) => d.seciliOneri.add(i));
  } catch (hata) {
    // JSON değilse düz metin sayılıyor: PDF'ten kopyalanan program da böyle
    // geliyor. Kullanıcı satırları kendisi işaretleyecek.
    if (/^\s*[[{]/.test(metin)) { d.hata = hata.message; return; }
    d.duzMetin = true;
    d.metin = metin;
    d.satirlar = metin.split('\n').map(s => s.trim()).filter(Boolean)
      .slice(0, 400).map(m => ({ metin: m, tur: tahmin(m) }));
    metindenCikar();
  }
}

/**
 * Satır ne olabilir? Sadece bir ilk tahmin — son sözü kullanıcı söylüyor.
 * "1. gün", "Gün 3", "3. GÜN" gibi satırlar gün başlığı sayılıyor.
 */
function tahmin(m) {
  if (/^(gün\s*\d+|\d+\.\s*gün)/i.test(m)) return 'gun';
  if (m.length < 60 && !/[.!?]$/.test(m)) return 'durak';
  return 'not';
}

/** İşaretlenen satırlardan gün/durak/not listelerini kurar. */
function metindenCikar() {
  d.gunler = [];
  d.duraklar = [];
  d.oneriler = [];
  let gunNo = null;
  let sonDurak = -1;

  for (const s of d.satirlar) {
    if (s.tur === 'gun') {
      gunNo = d.gunler.length + 1;
      d.gunler.push({ no: gunNo, baslik: s.metin });
      sonDurak = -1;
    } else if (s.tur === 'durak') {
      sonDurak = d.duraklar.length;
      d.duraklar.push({ id: `s${sonDurak}`, ad: s.metin, gun: gunNo, unutma: [] });
    } else if (s.tur === 'not' && sonDurak >= 0) {
      d.duraklar[sonDurak].unutma.push(s.metin);
      d.oneriler.push({ metin: s.metin, durakAd: d.duraklar[sonDurak].ad, durakNo: sonDurak });
    }
  }
  d.seciliDurak = new Set(d.duraklar.map((_, i) => i));
  d.seciliOneri = new Set(d.oneriler.map((_, i) => i));
}

function geziAdi() {
  return d.paket?.gerok?.ad
    || d.gunler[0]?.baslik
    || d.dosyaAdi.replace(/\.(gerok|json|txt|md)$/i, '')
    || 'Yeni gezi';
}

/** Seçili durakların kapladığı kutu — harita adımındaki iki sayı. */
function kutu() {
  const n = [...d.seciliDurak].map(i => d.duraklar[i]).filter(s => s.lat != null);
  if (n.length < 2) return null;
  const lat = n.map(s => s.lat), lon = n.map(s => s.lon);
  const dLat = Math.max(...lat) - Math.min(...lat);
  const dLon = Math.max(...lon) - Math.min(...lon);
  const ortLat = (Math.max(...lat) + Math.min(...lat)) / 2;
  return {
    kmY: Math.round(dLat * 111),
    kmX: Math.round(dLon * 111 * Math.cos(ortLat * Math.PI / 180))
  };
}

// --- Bitiş -----------------------------------------------------------------

async function bitir() {
  const { bildir, tazele } = d.araclar;
  try {
    // Seçilmeyen notlar duraktan da çıkarılıyor: listede olmayan bir not
    // durağa varınca ekrana düşmemeli.
    const duraklar = [...d.seciliDurak].sort((a, b) => a - b).map(i => {
      const s = { ...d.duraklar[i] };
      const izinli = d.oneriler
        .filter((o, oi) => o.durakNo === i && d.seciliOneri.has(oi))
        .map(o => o.metin);
      s.unutma = (s.unutma || []).filter(u => izinli.includes(u));
      return s;
    });

    const temel = d.paket?.gerok || {};
    const paket = {
      gerok: {
        ...temel,
        id: temel.id || `g${Date.now().toString(36)}`,
        ad: geziAdi()
      },
      gunler: d.gunler,
      duraklar,
      sinirGecisleri: d.paket?.sinirGecisleri || []
    };

    const haritaIste = d.haritaIste;
    const s = await gerok.paketYukle(paket);
    // Harita indirme burada başlamıyor (birkaç yüz megabayt, mobil veride
    // olmaz). İstek bir bayrak olarak yazılıyor; Gerok panelindeki uyarıyı
    // o bayrak çıkarıyor.
    await veri.ayarYaz('haritaHatirlat', haritaIste ? s.id : null);
    kapat();
    bildir(`Yeni gezi açıldı · ${kisaAd(s.ad)}`, 'iyi');
    await tazele?.();
  } catch (hata) {
    d.hata = hata.message;
    d.araclar.bildir(`Alınamadı: ${hata.message}`, 'kotu');
  }
}

function kisaAd(ad) {
  return ad && ad.length > 28 ? ad.slice(0, 27) + '…' : (ad || 'gezi');
}
