/**
 * İç bekçi — uygulamanın içinde yaşayan yarısı.
 *
 * Bekçinin iki yarısı var ve ikisi de olmadan iş yürümüyor:
 *
 *   MAC YARISI (~/gerok/bekci)   mühendis. Kodu, yayını, gizliliği sınıyor,
 *                                onarıyor, gerekirse Claude'a dosya bırakıyor.
 *   TELEFON YARISI (bu dosya)    yüz. Konuşuyor, öğretiyor ve Mac'in ASLA
 *                                göremediği yeri sınıyor: bu telefonun kendi
 *                                deposunu, izinlerini, medyasını, önbelleğini.
 *
 * Bugüne kadarki en sinsi hatalar tam o kör noktadan çıktı — video önizlemesi
 * masaüstünde çalışıyordu, iOS'ta hiç çalışmıyordu. Mac'teki bekçi onu
 * göremezdi. Buradaki görebiliyor.
 *
 * NEDEN YAPAY ZEKÂ DEĞİL: bu bekçi bir dil modeline bağlanmıyor. Üç sebep —
 * yolda internet yok, ücret istenmedi, ve en önemlisi: uydurmuyor. Bilmediği
 * soruya "bilmiyorum, şunu sorabilirsin" diyor. Emin olmadığı yerde tahmin
 * yürüten bir bekçi, yanlış öten bir alarmdan farksız olurdu.
 */

import * as veri from './veri.js';
import * as depo from './depo.js';

const $ = (s, k = document) => k.querySelector(s);
const $$ = (s, k = document) => Array.from(k.querySelectorAll(s));

const AKIS_ADRESI = 'https://raw.githubusercontent.com/marmarok/gerok/bekci/akis.json';

// app.js açılışta dolduruyor: bekçinin uygulamaya uzanan kolları.
let B = null;
export function baglamKur(baglam) {
  B = baglam;
  // Akıl ayarı hemen okunuyor: Gerok panelindeki bekçi satırı sohbet
  // açılmadan çiziliyor ve bağlı olup olmadığını oradan da göstermesi gerek.
  akliYukle().then(() => B.rozetiTazele?.());
}

const kacis = (m) => String(m ?? '').replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------------------------------------------------------------- akış -----
//
// Mac'teki bekçinin durumu. Ayrı bir dalda duran 2 KB'lık bir dosya; internet
// varken tazeleniyor, sonra cihazda saklanıyor. Uçak modunda da son bilinen
// durum görünüyor — "bilmiyorum" demek yerine "dün 14:00'te şöyleydi" demek
// her zaman daha dürüst.

let akis = null;

export async function akisiTazele({ zorla = false } = {}) {
  const yerel = await veri.ayarOku('bekciAkis', null);
  if (yerel && !zorla) akis = yerel;
  if (!navigator.onLine) return akis;
  try {
    const y = await fetch(`${AKIS_ADRESI}?t=${Date.now()}`, { cache: 'no-store' });
    if (!y.ok) return akis;
    const d = await y.json();
    if (d?.bicim !== 1) return akis;
    akis = d;
    await veri.ayarYaz('bekciAkis', d);
  } catch { /* internetsizlik hata değil */ }
  return akis;
}

/** Alt bardaki Gerok sekmesine düşecek rozet: okunmamış mesaj ya da sorun. */
export async function rozetDurumu() {
  const a = akis || await veri.ayarOku('bekciAkis', null);
  if (!a) return null;
  const okunan = await veri.ayarOku('bekciOkunan', 0);
  const yeni = (a.mesajlar || []).filter(m => m.t > okunan).length;
  const sorun = (a.sorunlar || []).length;
  const bekleyen = (a.bekleyen || []).length;
  if (sorun) return { tip: 'sorun', sayi: sorun };
  if (bekleyen) return { tip: 'karar', sayi: bekleyen };
  if (yeni) return { tip: 'mesaj', sayi: yeni };
  return null;
}

/** Panelde tek satırlık özet. */
export function ozet() {
  if (!akis) return { yazi: 'daha bakılmadı', sinif: '' };
  const s = akis.sayilar || {};
  const yas = zamanFarki(akis.zaman);
  if (akis.durum === 'sorun') return { yazi: `${s.sorun} sorun · ${yas}`, sinif: 'kotu' };
  if (akilAcikMi()) {
    const dd = akis.derin;
    return { yazi: `akıl açık · ${(dd?.sinama || s.sinama).toLocaleString('tr-TR')} sınama · ${yas}`,
             sinif: 'akil' };
  }
  // Büyük sayı en son GENİŞ koşudan; "ne zaman baktı" en son koşudan. Saatlik
  // koşunun 14 sınamasını yazmak "bekçi 14 şeye bakıyor" demek olurdu.
  const d = akis.derin;
  return { yazi: `${(d?.sinama || s.sinama || s.toplam).toLocaleString('tr-TR')} sınama · hepsi yolunda · ${yas}`,
           sinif: 'iyi' };
}

function zamanFarki(iso) {
  if (!iso) return '';
  const dk = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (dk < 2) return 'az önce';
  if (dk < 60) return `${dk} dk önce`;
  if (dk < 48 * 60) return `${Math.round(dk / 60)} saat önce`;
  return `${Math.round(dk / 1440)} gün önce`;
}

// ------------------------------------------------------------- sınamalar ---
//
// Telefonun kendi sınamaları. Her biri bir soruya cevap veriyor ve KAÇ AYRI
// iddia sınadığını söylüyor: "önbellek tam" tek satır görünür ama 49 ayrı
// dosyanın tek tek arandığı anlamına gelir.

// Sınama koşusu boyunca geçerli olan anlık görüntü. Her sınamanın kendi
// başına veritabanını taraması, 116 kayıtta aynı işi yirmi kez yapmak olurdu.
let tumKayit = [];

const SINAMALAR = [
  // ---- depolama ----
  { id: 'depo-kota', ad: 'Depolama payı okunabiliyor', oyku: 'depolama', async kos() {
      const d = await veri.depolamaDurumu();
      return { gecti: !!d?.kota, not: d?.kota ? `${boyut(d.kullanilan)} / ${boyut(d.kota)}` : 'okunamadı' };
    } },
  { id: 'depo-yer', ad: 'Yeterli yer var', oyku: 'depolama', async kos() {
      const d = await veri.depolamaDurumu();
      if (!d?.kota) return { gecti: true, not: 'pay okunamadı, geçildi' };
      const bos = d.kota - d.kullanilan;
      return { gecti: bos > 300 * 1024 * 1024, not: `${boyut(bos)} boş`,
               onarim: bos > 300 * 1024 * 1024 ? null : 'yer-ac' };
    } },
  { id: 'depo-kalici', ad: 'Veri kalıcı korunuyor', oyku: 'depolama', async kos() {
      const d = await veri.depolamaDurumu();
      return { gecti: !!d?.kalici,
               not: d?.kalici ? 'iOS veriyi kendiliğinden silmez'
                              : 'iOS yer daralırsa silebilir — yedek almayı ihmal etme',
               onarim: d?.kalici ? null : 'kalici-iste' };
    } },
  { id: 'veri-turu', ad: 'Veritabanı yazıp okuyor', oyku: 'depolama', async kos() {
      const anahtar = '__bekciSinama';
      const damga = Date.now();
      await veri.ayarYaz(anahtar, damga);
      const geri = await veri.ayarOku(anahtar, null);
      await veri.ayarYaz(anahtar, null);
      return { gecti: geri === damga, not: geri === damga ? 'gidiş-dönüş tamam' : 'yazılan geri okunamadı', sayi: 2 };
    } },

  // ---- kayıtların bütünlüğü ----
  { id: 'medya-var', ad: 'Her kaydın medyası yerinde', oyku: 'kayit', async kos() {
      const kayitlar = tumKayit.filter(k => k.medyaId);
      const kayip = [];
      for (const k of kayitlar) {
        const b = await depo.boyut('medya', k.medyaId).catch(() => 0);
        if (!b) kayip.push(k);
      }
      return { gecti: !kayip.length, sayi: kayitlar.length,
               not: kayip.length ? `${kayip.length} kaydın dosyası yok (${kayitlar.length} içinde)`
                                 : `${kayitlar.length} dosyanın hepsi yerinde`,
               ayrinti: kayip.slice(0, 6).map(k => `${k.tur} · ${new Date(k.t).toLocaleString('tr-TR')}`) };
    } },
  { id: 'kayit-kimlik', ad: 'Aynı kimlikte iki kayıt yok', oyku: 'kayit', async kos() {
      const g = new Map();
      tumKayit.forEach(k => g.set(k.id, (g.get(k.id) || 0) + 1));
      const cift = [...g].filter(([, n]) => n > 1);
      return { gecti: !cift.length, sayi: tumKayit.length || 1,
               not: cift.length ? `${cift.length} kimlik iki kez` : `${g.size} benzersiz kimlik` };
    } },
  { id: 'kayit-zaman', ad: 'Her kaydın saati geçerli', oyku: 'kayit', async kos() {
      const kotu = tumKayit.filter(k =>
        !Number.isFinite(k.t) || k.t < 946684800000 || k.t > Date.now() + 86400000);
      return { gecti: !kotu.length, sayi: tumKayit.length || 1,
               not: kotu.length ? `${kotu.length} kaydın saati geçersiz — zaman çizgisinde yanlış yere düşer`
                                : `${tumKayit.length} kaydın saati yerinde` };
    } },
  { id: 'kayit-gezi', ad: 'Her kayıt bir geziye bağlı', oyku: 'kayit', async kos() {
      // BÜTÜN kayıtlara bakılıyor, açık gezininkilere değil. Öksüz kayıt zaten
      // "hiçbir gezide görünmeyen kayıt" demek — açık gezinin listesinde
      // olması imkânsız. İlk yazımda oraya bakıyordu ve sınama hiçbir zaman
      // bir şey bulamıyordu; tarayıcı sınaması yakaladı.
      const idler = (await veri.geroklar()).map(g => g.id);
      const oksuz = await veri.oksuzKayitlar(idler);
      return { gecti: !oksuz.length, sayi: tumKayit.length || 1,
               not: oksuz.length ? `${oksuz.length} kayıt silinmiş bir geziye bağlı — hiçbir yerde görünmez`
                                 : `${idler.length} gezi · ${tumKayit.length} kaydın hepsi bağlı`,
               onarim: oksuz.length ? 'oksuz-tasi' : null };
    } },
  { id: 'ses-cozulur', ad: 'Ses kayıtları çalınabiliyor', oyku: 'kayit', async kos() {
      const sesler = tumKayit.filter(k =>
        ['ses', 'ortam', 'gunluk', 'baslangic', 'bitis', 'mektup'].includes(k.tur) && k.medyaId);
      const ornek = ornekle(sesler, 4);
      const bozuk = [];
      for (const k of ornek) {
        try {
          const blob = await veri.medyaOku(k.medyaId);
          if (!blob || blob.size < 512) { bozuk.push(k); continue; }
          // Gerçekten çözülüyor mu: sadece boyuta bakmak yetmiyor, yarım
          // yazılmış bir dosya da dolu görünüyor.
          const ac = new (window.AudioContext || window.webkitAudioContext)();
          await ac.decodeAudioData(await blob.arrayBuffer());
          ac.close();
        } catch { bozuk.push(k); }
      }
      return { gecti: !bozuk.length, sayi: ornek.length,
               not: !sesler.length ? 'ses kaydı yok'
                    : bozuk.length ? `${bozuk.length}/${ornek.length} ses çözülemedi`
                                   : `${ornek.length} ses örneklendi · ${sesler.length} kayıt içinde` };
    } },
  { id: 'gorsel-acilir', ad: 'Fotoğraf önizlemeleri açılıyor', oyku: 'kayit', async kos() {
      const g = tumKayit.filter(k => ['foto', 'video', 'siradan'].includes(k.tur) && k.medyaId);
      const ornek = ornekle(g, 4);
      let bozuk = 0;
      for (const k of ornek) {
        const blob = await veri.medyaOku(k.medyaId).catch(() => null);
        if (!blob) { bozuk++; continue; }
        const tamam = await new Promise(r => {
          const u = URL.createObjectURL(blob);
          const i = new Image();
          i.onload = () => { URL.revokeObjectURL(u); r(true); };
          i.onerror = () => { URL.revokeObjectURL(u); r(false); };
          i.src = u;
        });
        if (!tamam) bozuk++;
      }
      return { gecti: !bozuk, sayi: ornek.length,
               not: !g.length ? 'görsel yok'
                    : bozuk ? `${bozuk}/${ornek.length} önizleme açılmadı`
                            : `${ornek.length} görsel örneklendi · ${g.length} kayıt içinde` };
    } },
  { id: 'medya-oksuz', ad: 'Sahipsiz dosya birikmemiş', oyku: 'kayit', async kos() {
      // BÜTÜN kayıtlar — silinmişler dahil. Açık gezinin listesine bakmak,
      // öteki gezilerin fotoğraflarını "sahipsiz" ilan edip SİLİNMELERİNİ
      // önermek olurdu. Veri silen bir onarımda bu affedilmez.
      const kullanilan = new Set((await veri.tumKayitlar()).filter(k => k.medyaId).map(k => k.medyaId));
      const hepsi = await depo.listele?.('medya').catch(() => null);
      if (!hepsi) return { gecti: true, not: 'dosya listesi okunamıyor, atlandı' };
      const oksuz = hepsi.filter(a => !kullanilan.has(a));
      return { gecti: !oksuz.length, sayi: hepsi.length,
               not: oksuz.length ? `${oksuz.length} sahipsiz dosya yer kaplıyor` : `${hepsi.length} dosya · hepsinin sahibi var`,
               onarim: oksuz.length ? 'oksuz-sil' : null };
    } },

  // ---- iz ve duraklar ----
  { id: 'iz-saglam', ad: 'İz noktaları tutarlı', oyku: 'iz', async kos() {
      const n = B.durum.izNoktalari || [];
      const kotu = n.filter(p => !Number.isFinite(p.lat) || !Number.isFinite(p.lon)
        || Math.abs(p.lat) > 90 || Math.abs(p.lon) > 180);
      return { gecti: !kotu.length, sayi: n.length || 1,
               not: !n.length ? 'iz noktası yok'
                    : kotu.length ? `${kotu.length} nokta harita dışında`
                                  : `${n.length} nokta · hepsi geçerli` };
    } },
  { id: 'durak-saglam', ad: 'Durak koordinatları geçerli', oyku: 'iz', async kos() {
      const d = B.gerok.duraklar?.() || [];
      const kotu = d.filter(x => !Number.isFinite(x.lat) || !Number.isFinite(x.lon));
      return { gecti: !kotu.length, sayi: d.length || 1,
               not: !d.length ? 'durak yok' : kotu.length ? `${kotu.length} durak haritaya oturmaz` : `${d.length} durak` };
    } },

  // ---- uygulamanın kendisi ----
  { id: 'onbellek-tam', ad: 'Çevrimdışı dosyaların hepsi inmiş', oyku: 'uygulama', async kos() {
      // Bu, Mac'teki bekçinin GÖREMEDİĞİ en önemli şey: dosyalar sunucuda
      // duruyor olabilir ama BU telefonun önbelleğinde eksik olabilir. O
      // zaman uygulama uçak modunda yarım açılır ve sebebi hiç görünmez.
      if (!('caches' in window)) return { gecti: true, not: 'bu tarayıcıda önbellek yok' };
      let liste;
      try {
        const y = await fetch('./surum.json', { cache: 'no-store' });
        liste = await y.json();
      } catch {
        return { gecti: true, not: 'internet yok — liste alınamadı, atlandı' };
      }
      const adlar = await caches.keys();
      const ad = adlar.find(a => a === B.SURUM) || adlar.find(a => /^gerok-\d/.test(a));
      if (!ad) return { gecti: false, not: 'hiç önbellek yok — uygulama internetsiz açılmaz' };
      const o = await caches.open(ad);
      const yollar = Object.keys(liste.dosyalar || {});
      const eksik = [];
      for (const y of yollar) if (!(await o.match(y))) eksik.push(y);
      return { gecti: !eksik.length, sayi: yollar.length,
               not: eksik.length ? `${eksik.length}/${yollar.length} dosya eksik — uçak modunda yarım açılır`
                                 : `${yollar.length} dosyanın hepsi telefonda`,
               ayrinti: eksik.slice(0, 8), onarim: eksik.length ? 'onbellek-doldur' : null };
    } },
  { id: 'surum-tutarli', ad: 'Çalışan sürüm önbellekle aynı', oyku: 'uygulama', async kos() {
      if (!('caches' in window)) return { gecti: true, not: 'önbellek yok' };
      const adlar = (await caches.keys()).filter(a => /^gerok-\d/.test(a));
      return { gecti: adlar.length === 1 && adlar[0] === B.SURUM, sayi: 2,
               not: adlar.length === 1 && adlar[0] === B.SURUM ? B.SURUM
                    : `çalışan ${B.SURUM}, önbellekte ${adlar.join(', ') || 'yok'} — güncelleme yarım kalmış olabilir` };
    } },
  { id: 'sw-ayakta', ad: 'Çevrimdışı motor çalışıyor', oyku: 'uygulama', async kos() {
      const k = await navigator.serviceWorker?.getRegistration();
      const suruyor = !!navigator.serviceWorker?.controller;
      return { gecti: !!k && suruyor, sayi: 2,
               not: !k ? 'servis worker kurulu değil — internetsiz açılmaz'
                    : !suruyor ? 'kurulu ama devrede değil — bir kez kapat aç'
                    : 'kurulu ve devrede' };
    } },
  { id: 'simgeden', ad: 'Ana ekran simgesinden açılmış', oyku: 'uygulama', async kos() {
      const tam = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
      return { gecti: !!tam,
               not: tam ? 'tam ekran kipinde'
                        : 'Safari sekmesinden açılmış — iOS bu kipte verileri silebilir. '
                          + 'Paylaş → Ana Ekrana Ekle ve BURADAN aç.' };
    } },
  { id: 'yazitipi', ad: 'Yazı tipleri yüklendi', oyku: 'uygulama', async kos() {
      if (!document.fonts?.check) return { gecti: true, not: 'sınanamıyor' };
      await document.fonts.ready;
      const l = document.fonts.check('16px Lora'), d = document.fonts.check('16px "DM Sans"');
      return { gecti: l && d, sayi: 2,
               not: l && d ? 'Lora + DM Sans' : `eksik: ${[!l && 'Lora', !d && 'DM Sans'].filter(Boolean).join(', ')}` };
    } },
  { id: 'harita-paketi', ad: 'Harita paketi telefonda', oyku: 'uygulama', async kos() {
      const { haritaVarMi } = await import('./harita.js');
      const v = await haritaVarMi().catch(() => false);
      return { gecti: !!v,
               not: v ? `${boyut(v)} · uçak modunda çalışır`
                      : 'indirilmemiş — internetsizken harita boş kalır',
               onarim: v ? null : 'harita-indir' };
    } },

  // ---- izinler ----
  { id: 'izin-mikrofon', ad: 'Mikrofon izni duruyor', oyku: 'izin', async kos() {
      const d = await izinDurumu('microphone');
      return { gecti: d !== 'denied', not: izinYazi(d, 'Sesli not bırakılamaz') };
    } },
  { id: 'izin-konum', ad: 'Konum izni duruyor', oyku: 'izin', async kos() {
      const d = await izinDurumu('geolocation');
      return { gecti: d !== 'denied', not: izinYazi(d, 'İz kaydedilemez, kayıtlar haritaya oturmaz') };
    } },

  // ---- düzen ----
  { id: 'sahip', ad: 'Bu telefonun adı konmuş', oyku: 'duzen', gizli: true, async kos() {
      const ad = B.kayit.sahipAl()?.ad;
      return { gecti: !!ad, not: ad ? ad : 'ad konmamış — kayıtların kimden geldiği yazılamaz',
               onarim: ad ? null : 'ad-koy' };
    } },
  { id: 'aktif-gezi', ad: 'Açık bir gezi var', oyku: 'duzen', gizli: true, async kos() {
      const s = B.gerok.aktifGerok();
      return { gecti: !!s, not: s ? s.ad : 'gezi yüklenmemiş' };
    } },
  { id: 'yedek-yasi', ad: 'Yedek taze', oyku: 'duzen', async kos() {
      const y = await veri.ayarOku('sonYedek', null);
      if (!y) return { gecti: false, not: 'hiç yedek alınmadı', onarim: 'yedek-al' };
      const gun = (Date.now() - y) / 86400000;
      return { gecti: gun < 3, not: `${gun < 1 ? 'bugün' : `${Math.round(gun)} gün önce`}`,
               onarim: gun < 3 ? null : 'yedek-al' };
    } },
  { id: 'cozum-bekleyen', ad: 'Yazıya çevrilmeyi bekleyen ses yok', oyku: 'duzen', async kos() {
      const b = tumKayit.filter(k => k.cozumIsteniyor && !k.yazi);
      return { gecti: !b.length, sayi: b.length || 1,
               not: b.length ? `${b.length} ses bekliyor` : 'bekleyen yok' };
    } },
  { id: 'saat', ad: 'Telefonun saati doğru', oyku: 'duzen', async kos() {
      const ileri = tumKayit.filter(k => k.t > Date.now() + 3600000).length;
      return { gecti: !ileri, not: ileri ? `${ileri} kayıt gelecekte görünüyor — saat ayarına bak` : 'tutarlı' };
    } },
];

function ornekle(dizi, n) {
  if (dizi.length <= n) return dizi.slice();
  const adim = Math.floor(dizi.length / n);
  return Array.from({ length: n }, (_, i) => dizi[i * adim]);
}

async function izinDurumu(ad) {
  try { return (await navigator.permissions.query({ name: ad })).state; }
  catch { return 'bilinmiyor'; }
}
const izinYazi = (d, kotuyse) => ({
  granted: 'verildi', prompt: 'henüz sorulmadı', denied: `REDDEDİLMİŞ — ${kotuyse}`,
}[d] || 'sorgulanamadı');

const boyut = (b) => b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`;

/** Bütün telefon sınamalarını koşturur. */
export async function kendiniSina(ilerleme = null) {
  // Defterin tamamı, bir kez. Açık gezinin listesi yetmiyor: görünmeyen bir
  // gezideki bozuk dosya da veri kaybı, üstelik fark edilmesi daha zor.
  tumKayit = await veri.kayitlariGetir();
  const sonuclar = [];
  for (let i = 0; i < SINAMALAR.length; i++) {
    const s = SINAMALAR[i];
    ilerleme?.(i + 1, SINAMALAR.length, s.ad);
    try {
      const r = await s.kos();
      sonuclar.push({ ...s, ...r, sayi: r.sayi || 1 });
    } catch (h) {
      sonuclar.push({ ...s, gecti: false, sayi: 1, not: `sınama çöktü: ${h.message}` });
    }
    await new Promise(r => setTimeout(r, 0));   // ekran donmasın
  }
  const an = Date.now();
  await veri.ayarYaz('bekciSonSinama', {
    an, gecen: sonuclar.filter(s => s.gecti).length, toplam: sonuclar.length
  });
  // Akıl açıkken bağlam olarak gidiyor: yalnızca sınama ADI ve SONUCU —
  // kayıtların içeriği değil. Bekçinin ne gördüğü, defterin ne yazdığı değil.
  await veri.ayarYaz('bekciSonSinamaAyrinti', sonuclar.map(s =>
    // `gizli` olanların notu gezinin ya da telefonun ADINI taşıyor. Ekranda
    // görünmesi doğru, dışarı çıkması değil — bağlama yalnızca sonucu giriyor.
    ({ ad: s.ad, gecti: s.gecti, not: s.gizli ? (s.gecti ? 'tamam' : 'eksik') : s.not })));
  return sonuclar;
}

// -------------------------------------------------------------- onarımlar --
//
// Yalnızca TEK DOĞRU CEVABI olan işler ve hepsi geri alınabilir ya da
// zararsız. Veri silen tek onarım (sahipsiz dosya) önce ne sileceğini
// söylüyor ve onay istiyor.

export const ONARIMLAR = {
  'kalici-iste': { ad: 'Kalıcı depolama iste', async yap() {
      const s = await veri.kaliciDepolamaIste();
      return s.kalici ? 'Açıldı — iOS artık veriyi kendiliğinden silmez.'
                      : 'iOS şimdilik vermedi. Uygulamayı bir süre kullanınca tekrar denenebilir.';
    } },
  'oksuz-sil': { ad: 'Sahipsiz dosyaları sil', onay:
      'Hiçbir kayda bağlı olmayan dosyalar silinecek. Kayıtların kendisine dokunulmuyor.',
    async yap() {
      const kullanilan = new Set((await veri.tumKayitlar()).filter(k => k.medyaId).map(k => k.medyaId));
      const hepsi = await depo.listele?.('medya').catch(() => null);
      if (!hepsi) return 'Dosya listesi okunamadı.';
      const oksuz = hepsi.filter(a => !kullanilan.has(a));
      let n = 0;
      for (const a of oksuz) { try { await veri.medyaSil(a); n++; } catch { /* silinemedi */ } }
      return `${n} sahipsiz dosya silindi.`;
    } },
  'oksuz-tasi': { ad: 'Öksüz kayıtları bu geziye taşı', onay:
      'Silinmiş bir geziye bağlı kalmış kayıtlar şu anki geziye taşınacak. Hiçbir şey silinmiyor.',
    async yap() {
      const s = B.gerok.aktifGerok();
      if (!s) return 'Önce bir gezi açman gerek.';
      const idler = (await veri.geroklar()).map(g => g.id);
      const oksuz = await veri.oksuzKayitlar(idler);
      if (!oksuz.length) return 'Öksüz kayıt kalmamış.';
      await veri.kayitlariTuraTasi(oksuz, s.id);
      await B.tazele();
      return `${oksuz.length} kayıt “${s.ad}” gezisine taşındı.`;
    } },
  'onbellek-doldur': { ad: 'Eksik dosyaları indir', async yap() {
      const k = await navigator.serviceWorker?.getRegistration();
      if (!k) return 'Çevrimdışı motor kurulu değil.';
      await k.update();
      return 'İndirme başlatıldı. Birkaç saniye sonra sınamayı tekrar çalıştır.';
    } },
  'yedek-al': { ad: 'Şimdi yedek al', async yap() { B.yedekAl(); return 'Yedek akışı açıldı.'; } },
  'harita-indir': { ad: 'Harita paketini indir', async yap() { B.haritaIndir(); return 'Harita indirme açıldı.'; } },
  'ad-koy': { ad: 'Telefonun adını koy', async yap() { B.adSor(); return 'Ad soruldu.'; } },
  'yer-ac': { ad: 'Yer açmanın yollarını göster', async yap() {
      return 'En büyük yer harita paketinde (yaklaşık 357 MB). Gerok → bu telefon → '
           + 'harita paketini silebilirsin; yolda internet varken tekrar inebilir. '
           + 'Fotoğraf ve videolar zaten galeride duruyor, Gerok onları kopyalamıyor.';
    } },
};

// ------------------------------------------------------------- bilgi tabanı -
//
// Uygulamayı bilmeyene öğreten yarısı. Her konu bir soruya cevap veriyor ve
// mümkünse İŞİ DE YAPIYOR — "Gerok sekmesine git, şunu bul" demek yerine
// düğmeye basınca oraya götürüyor.

const KONULAR = [
  { id: 'sesli-not', baslik: 'Sesli not nasıl bırakılır?',
    anahtar: ['ses', 'sesli', 'not', 'konus', 'kaydet', 'mikrofon', 'söyle'],
    cevap: 'Alt şeritten <b>Kayıt</b>’a geç, mikrofon düğmesine <b>basılı tut</b>, konuş, '
         + 'bırak. Kayıt biter bitmez zaman çizgisine düşer.<br><br>'
         + 'Yolda yazmak zor, konuşmak kolay — defterin en çok dolan yeri burası.',
    eylem: { ad: 'Kayıt ekranını aç', yap: () => B.ekranAc('kayit') } },
  { id: 'ortam-sesi', baslik: 'Ortam sesi nedir?',
    anahtar: ['ortam', 'çevre', 'atmosfer', 'gürültü', '30'],
    cevap: 'Konuşmadan, bir yerin nasıl duyulduğunu kaydeder: çarşı, yağmur, ezan, tren. '
         + 'Kayıt ekranındaki <b>ortam</b> düğmesi 30 saniyelik bir parça alır.<br><br>'
         + 'Fotoğraf herkeste var; ses kimsede yok. On yıl sonra en sert vuran tür bu.',
    eylem: { ad: 'Kayıt ekranını aç', yap: () => B.ekranAc('kayit') } },
  { id: 'foto', baslik: 'Fotoğraf nasıl eklenir?',
    anahtar: ['foto', 'fotoğraf', 'resim', 'görsel', 'galeri', 'video', 'ekle'],
    cevap: 'Kayıt ekranındaki <b>fotoğraf</b> düğmesi galerini açar; birden fazla '
         + 'seçebilirsin. Gerok dosyaları <b>kopyalamıyor</b> — galerinde, tam '
         + 'kalitede, iCloud yedeğiyle kalıyorlar. Buraya yalnızca saat, konum ve '
         + 'küçük bir önizleme giriyor.<br><br>Çünkü 4K video dakikada ~400 MB, '
         + 've tarayıcıdan çekilen fotoğrafın konumunu iOS siliyor.',
    eylem: { ad: 'Kayıt ekranını aç', yap: () => B.ekranAc('kayit') } },
  { id: 'yedek', baslik: 'Yedek nasıl alınır?',
    anahtar: ['yedek', 'kaydet', 'kaybol', 'güvence', 'sakla', 'kopya'],
    cevap: 'Gerok → <b>eşitleme</b> → “Yedek al”. Tek bir dosya çıkar; onu Dosyalar’a '
         + 'ya da iCloud Drive’a kaydet.<br><br>Gün Sonu akışının son adımı da bu — '
         + 'hatırlanacak yedi şey değil, bir tane.',
    eylem: { ad: 'Şimdi yedek al', yap: () => B.yedekAl() } },
  { id: 'geri-yukle', baslik: 'Yedeği nasıl geri yüklerim?',
    anahtar: ['geri', 'yükle', 'kurtar', 'sildim', 'kayıp', 'geri getir', 'eski'],
    cevap: 'Gerok → eşitleme → <b>Yedeği geri yükle</b>. İki kip var:<br>'
         + '<b>birleştir</b> — gelenler eklenir, sendekiler durur.<br>'
         + '<b>değiştir</b> — defter o yedeğin hâline döner; sildiğin kayıtlar da geri gelir.<br><br>'
         + 'Fark önemli: arkadaşının paketi bir <i>görüş</i>, senin yedeğin bir <i>hâl</i>.',
    eylem: { ad: 'Eşitleme panelini aç', yap: () => B.paneliAc('eşitleme') } },
  { id: 'airdrop', baslik: 'Arkadaşıma nasıl gönderirim?',
    anahtar: ['arkadaş', 'gönder', 'airdrop', 'paylaş', 'eşitle', 'aktar'],
    cevap: 'Gerok → eşitleme → <b>Günü gönder</b>. Bir dosya çıkar, AirDrop’la '
         + 'karşıya geçer, o da <b>Gelen paketi al</b> der.<br><br>'
         + 'Sunucu yok, hesap yok, internet gerekmiyor. Aynı paketi iki kez alsa '
         + 'bile kayıtlar ikilenmiyor.',
    eylem: { ad: 'Eşitleme panelini aç', yap: () => B.paneliAc('eşitleme') } },
  { id: 'harita-bos', baslik: 'Harita boş görünüyor',
    anahtar: ['harita', 'boş', 'gri', 'görünmüyor', 'yüklenmiyor', 'beyaz'],
    cevap: 'Neredeyse her zaman tek sebebi var: <b>harita paketi inmemiş</b>. '
         + 'Paket 357 MB ve internetsiz çalışabilmek için bir kez indiriliyor.<br><br>'
         + 'Gerok → bu telefon → <b>Harita paketi indir</b>. Ev wi-fi’sinde yap, '
         + 'yolda değil.',
    eylem: { ad: 'Haritayı indir', yap: () => B.haritaIndir() } },
  { id: 'guncelleme', baslik: 'Nasıl güncellenir?',
    anahtar: ['güncelle', 'sürüm', 'yeni', 'versiyon', 'yenile'],
    cevap: 'Yeni sürüm çıkınca uygulama açılışta <b>soruyor</b>: ne kadar ineceğini '
         + 'yazıp izin istiyor. “Güncelle” dedin mi kendi yenileniyor — kapat-aç yok.<br><br>'
         + 'Elle bakmak için: Gerok → sürüm ve yardım → <b>Yeni sürüm var mı?</b>',
    eylem: { ad: 'Şimdi bak', yap: () => B.surumuAra() } },
  { id: 'yazi-cevir', baslik: 'Sesi yazıya çevirme',
    anahtar: ['yazıya', 'çevir', 'metin', 'transkript', 'deşifre', 'okunur'],
    cevap: 'Bir sese dokun, altındaki düğmelerden <b>Yazıya çevir</b>’i seç. '
         + 'İnternet ister; çevrilen yazı aranabilir olur.<br><br>'
         + 'Makine yanlış yazarsa <b>Yazıyı düzelt</b> ile elle düzeltebilirsin — '
         + 'elle yazdığın metnin üstüne makine bir daha yazmıyor.' },
  { id: 'iz', baslik: 'İz kaydı nedir?',
    anahtar: ['iz', 'rota', 'takip', 'konum', 'gps', 'yol', 'nereye'],
    cevap: 'Uygulama açıkken 30 saniyede bir konum noktası biriktirir. Her fotoğraf, '
         + 'ses ve not <b>saatine göre</b> bu ize eşleştirilip haritaya oturur.<br><br>'
         + 'Bu yüzden fotoğrafın konumu silinmiş olsa bile haritada doğru yerde çıkar. '
         + 'Şarj %20’nin altına inince aralık 2 dakikaya çıkar.' },
  { id: 'yol-modu', baslik: 'Yol Modu ne işe yarar?',
    anahtar: ['yol modu', 'araç', 'araba', 'ekran', 'uyanık', 'yaklaşma', 'uyarı'],
    cevap: 'Araçtayken aç: ekran kapanmaz, iz kesintisiz kaydedilir ve bir durağa '
         + '<b>2 km kala sesli uyarı</b> gelir, o durağın notları ekrana düşer.<br><br>'
         + 'Uygulama kapalıyken iOS buna izin vermiyor — kritik duraklar için '
         + 'Anımsatıcılar köprüsü kuruldu.' },
  { id: 'gun-sonu', baslik: 'Gün Sonu nedir?',
    anahtar: ['gün sonu', 'akşam', 'günlük', 'özet', 'ritüel'],
    cevap: 'Akşam tek ekran, doksan saniye: günün özeti, sesli günlük, günün sıradan '
         + 'karesi, tanıştığın kişi, fiyat, sonra yedek ve arkadaşına gönderme.<br><br>'
         + 'Yedi ayrı ritüel yerine bir tane — hatırlanacak tek şey.',
    eylem: { ad: 'Gün Sonu’nu başlat', yap: () => B.gunSonu() } },
  { id: 'mektup', baslik: 'Mühürlü mektup',
    anahtar: ['mektup', 'mühür', '2036', 'gelecek', 'kilit'],
    cevap: 'Gelecekteki kendine bir mektup: sesli ya da yazılı. Arşivde ayrı bir '
         + 'klasörde durur, görüntüleyici içeriğini göstermez, yalnızca hangi yıl '
         + 'açılacağını yazar.<br><br><b>Şifrelenmiyor</b> — on yıl sonra kaybolacak '
         + 'tek şey parola olurdu. Kilit değil, söz.',
    eylem: { ad: 'Mektup yaz', yap: () => B.mektup() } },
  { id: 'yer-yok', baslik: 'Yer doldu / uygulama yavaş',
    anahtar: ['yer', 'dolu', 'yavaş', 'depolama', 'alan', 'doldu', 'takılıyor'],
    cevap: 'En büyük yer <b>harita paketinde</b> (~357 MB). Silebilirsin, internet '
         + 'varken tekrar iner. Fotoğraf ve videolar Gerok’ta değil, galerinde.<br><br>'
         + 'Bekçiye “kendini sına” dersen ne kadar yer kaldığını tam olarak söylerim.' },
  { id: 'internet-yok', baslik: 'İnternet olmadan çalışır mı?',
    anahtar: ['internet', 'çevrimdışı', 'uçak', 'wifi', 'bağlantı', 'offline'],
    cevap: '<b>Tamamı çalışır.</b> Kayıt, harita, arama, zaman çizgisi, yedek, '
         + 'AirDrop — hepsi cihazın içinde.<br><br>İnternet yalnızca dört şey için: '
         + 'güncelleme, kur düzeltme, sesi yazıya çevirme ve bekçinin durumu. '
         + 'Dışarı giden tek şey koordinatlar ve para birimi kodları; metin, ses, '
         + 'fotoğraf, isim hiçbir zaman gitmiyor.' },
  { id: 'gizlilik', baslik: 'Verilerim nereye gidiyor?',
    anahtar: ['gizlilik', 'veri', 'nereye', 'sunucu', 'güvenli', 'kim görüyor', 'bulut'],
    cevap: '<b>Hiçbir yere.</b> Sunucu yok, hesap yok, kullanıcı adı yok. Her şey '
         + 'telefonun içinde; yedek de senin seçtiğin yere gidiyor.<br><br>'
         + 'GitHub’daki depoda yalnızca <b>uygulamanın kodu</b> var: rota, otel, '
         + 'durak, not, koordinat, isim — hiçbiri orada değil. Her yayından önce '
         + 'beş katmanlı tarama yapılıyor ve bulgu varsa yayın durduruluyor.' },
  { id: 'durak-ekle', baslik: 'Kendi durağımı nasıl eklerim?',
    anahtar: ['durak', 'ekle', 'yer ekle', 'iğne', 'işaretle'],
    cevap: 'Haritada boş bir yere <b>uzun bas</b>, ya da Duraklar ekranındaki '
         + '“buradan durak ekle”yi kullan. Durağa not ve puan da verebilirsin.',
    eylem: { ad: 'Haritayı aç', yap: () => B.ekranAc('harita') } },
  { id: 'suzgec', baslik: 'Süzgeçler ne işe yarıyor?',
    anahtar: ['süzgeç', 'filtre', 'ara', 'bul', 'işaretli', 'yıldız'],
    cevap: 'Zaman çizgisinin üstündeki düğme kaydı türe göre süzer: yalnızca sesler, '
         + 'yalnızca fotoğraflar, yalnızca işaretlediklerin…<br><br>'
         + 'Bir kayda <b>iki kez dokunmak</b> onu yıldızlar. Arama kutusu '
         + 'başlıklarda, notlarda ve yazıya çevrilmiş seslerde arar.',
    eylem: { ad: 'Zaman çizgisini aç', yap: () => B.ekranAc('zaman') } },
  { id: 'cift-dokunus', baslik: 'Alt şeritteki kısayollar',
    anahtar: ['çift', 'dokun', 'kısayol', 'hızlı', 'yukarı', 'başa'],
    cevap: 'Alt şeritteki simgeye <b>iki kez</b> dokunmak kısayol açar:<br>'
         + '• Duraklar, Zaman çizgisi, Gerok → <b>sayfanın başına döner</b><br>'
         + '• Harita → <b>seni bulur</b><br>'
         + '• Kayıt → <b>sesli not başlatır</b>' },
  { id: 'bekci-nedir', baslik: 'Bekçi nedir?',
    anahtar: ['bekçi', 'sen kimsin', 'nesin', 'ne yapıyorsun', 'ajan'],
    cevap: 'İki yarım bir bekçi.<br><br><b>Mac’teki yarı</b> saatte bir, altı saatte '
         + 'bir, günde ve haftada bir uygulamayı sınıyor: yayın, kod, gizlilik, '
         + 'şartname, arşiv. Bulduğunu onarabiliyorsa onarıyor, onaramıyorsa '
         + 'Claude’a dosya bırakıyor.<br><br><b>Bu telefondaki yarı</b> — yani ben — '
         + 'Mac’in göremediği yeri sınıyorum: senin deponu, izinlerini, '
         + 'medyanı, önbelleğini. Sorularını da cevaplıyorum.<br><br>'
         + 'Her şey yolundayken ses çıkarmıyorum. Sessizlik iyi haber.' },
  { id: 'akil', baslik: 'Dil modeline bağlanma',
    anahtar: ['akıl', 'dil modeli', 'yapay zeka', 'model', 'bağla', 'akıllı', 'claude', 'chatgpt'],
    cevap: 'İsteğe bağlı ikinci beynim. <b>Varsayılan kapalı</b> ve kapalıyken de '
         + 'tastamam çalışırım: sınamalar, onarımlar, bildiklerim — hepsi internetsiz '
         + 've ücretsiz.<br><br>Bağlarsan serbest cümleyi daha iyi anlarım. '
         + 'Akıldan gelen cevapların kenarı <b>mavi</b> olur — hangi cevabın ezberimden, '
         + 'hangisinin modelden geldiğini karıştırma diye.<br><br>'
         + '<b>Dışarı gitmeyenler:</b> kayıtlarının metni, ses çözümleri, fotoğraflar, '
         + 'kişi ve durak adları, koordinatlar, gezinin adı. Anahtar yalnızca bu '
         + 'telefonda durur. Her soru birkaç kuruş harcar.',
    eylem: { ad: 'Ayarları aç', yap: () => akilKarti() } },
  { id: 'bekci-sina', baslik: 'Bu telefonu sına',
    anahtar: ['sına', 'kontrol', 'test', 'bak', 'dene', 'sorun var mı', 'çalışıyor mu'],
    cevap: 'Şu anda bu telefonda bir düzine şeyi tek tek sınayabilirim: depolama, '
         + 'kayıtların dosyaları, seslerin çalınabilirliği, çevrimdışı önbellek, '
         + 'izinler, harita, yedeğin yaşı.',
    eylem: { ad: 'Şimdi sına', yap: () => sinamaAkisi() } },
];

// -------------------------------------------------------------- niyet bulma -
//
// Yazılan cümleyi konuya bağlar. Dil modeli yok; ağırlıklı kelime eşleşmesi
// var. Kural şu: EMİN DEĞİLSE TAHMİN ETMEZ. Tek bir konu açık ara öndeyse
// onu açıyor, birkaçı yakınsa seçenek olarak gösteriyor, hiçbiri tutmuyorsa
// dürüstçe "bilmiyorum" deyip menüyü açıyor. Yanlış cevap veren bir bekçi,
// hiç cevap vermeyenden kötüdür.

function sadelestir(m) {
  return String(m).toLocaleLowerCase('tr')
    .replace(/[İI]/g, 'i').replace(/[^a-zçğıöşü0-9\s]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

/** Kelime kökü kabaca: Türkçe ekleri kırpıyor. "sesleri" → "ses" */
function kok(k) {
  return k.replace(/(lar|ler|ları|leri|ında|inde|dan|den|tan|ten|nın|nin|ını|ini|ye|ya|da|de|ta|te|i|ı|u|ü)$/,'')
          .slice(0, 8);
}

export function niyetBul(metin) {
  const sade = sadelestir(metin);
  const kelimeler = sade.split(' ').filter(k => k.length > 1);
  if (!kelimeler.length) return [];
  const kokler = kelimeler.map(kok);
  const puanlar = KONULAR.map(konu => {
    let p = 0;
    for (const a of konu.anahtar) {
      const as = sadelestir(a);
      // Çok kelimeli anahtar ("gün sonu", "yol modu") tek tek kelimelerle
      // hiç eşleşmiyordu; cümlenin içinde aranıyor ve daha ağır sayılıyor —
      // iki kelimenin yan yana gelmesi tesadüf değil.
      if (as.includes(' ')) { if (sade.includes(as)) p += 5; continue; }
      const ak = kok(as);
      for (let i = 0; i < kelimeler.length; i++) {
        if (kelimeler[i] === as) p += 3;                      // birebir
        else if (kokler[i] && ak && kokler[i] === ak) p += 2; // kök
        else if (ak.length > 3 && kelimeler[i].includes(ak)) p += 1;
      }
    }
    // Başlığın tamamı cümlenin içinde geçiyorsa ("gün sonu ne demek")
    // tartışma yok.
    const bs = sadelestir(konu.baslik).replace(/\?$/, '');
    if (bs.length > 5 && sade.includes(bs.split(' ').slice(0, 2).join(' '))) p += 4;
    // Başlıktaki tek tek kelimeler de sayılıyor.
    const basKelimeleri = sadelestir(konu.baslik).split(' ');
    for (const k of kelimeler) if (k.length > 3 && basKelimeleri.includes(k)) p += 2;
    return { konu, p };
  }).filter(x => x.p >= 3).sort((a, b) => b.p - a.p);
  return puanlar;
}

// ------------------------------------------------------------------ akıl ---
//
// Bekçinin isteğe bağlı ikinci beyni.
//
// VARSAYILAN KAPALI ve öyle kalması gerekiyor: bekçinin gövdesi — sınamalar,
// onarımlar, bilgi tabanı — internetsiz, ücretsiz ve tahmin yürütmeden
// çalışıyor. Akıl bunun YERİNE geçmiyor, ÜSTÜNE biniyor. Kapalıyken
// bekçi bugünkü hâliyle tastamam çalışır; açıkken aynı bilgiyi daha iyi
// anlatır ve serbest cümleyi daha iyi anlar.
//
// RENK NEDEN DEĞİŞİYOR: cevabın nereden geldiğini bilmek, cevabın kendisi
// kadar önemli. Yerelden gelen cevap bekçinin ezberi — sabit, denenmiş,
// bedava. Akıldan gelen cevap bir dil modelinin cümlesi — daha akıcı ama
// bir modelin cümlesi. Mavi kenar bunu söylüyor. Karışmasınlar diye.
//
// DIŞARI NE GİDİYOR: yazdığın cümle, ve aşağıdaki BEYAZ LİSTE. Kayıtlarının
// metni, ses çözümleri, başlıklar, kişi adları, koordinatlar, durak adları,
// gezinin adı — HİÇBİRİ gitmiyor. Bekçinin kendi durumu ve uygulamanın
// bilgisi gidiyor, defterin içeriği değil.

const AKIL_ADRESI = 'https://api.anthropic.com/v1/messages';

const MODELLER = [
  { id: 'claude-haiku-4-5-20251001', ad: 'Haiku 4.5', not: 'hızlı ve en ucuz' },
  { id: 'claude-sonnet-5', ad: 'Sonnet 5', not: 'daha iyi anlar, birkaç kat pahalı' },
];

let akil = { acik: false, anahtar: '', model: MODELLER[0].id, sayac: 0 };
let yazilanAnahtar = '';

async function akliYukle() {
  const d = await veri.ayarOku('bekciAkil', null);
  if (d) akil = { ...akil, ...d };
  return akil;
}
async function akliKaydet() {
  await veri.ayarYaz('bekciAkil', akil);
}
export function akilAcikMi() { return !!(akil.acik && akil.anahtar); }

// Dışarı çıkacak bağlamın son savunması. Kullanıcının KENDİ yazdığı cümleye
// dokunulmuyor — onu göndermeyi kendisi seçti. Temizlenen şey bizim eklediğimiz
// bağlam: bir gün bir kontrol notu dosya yolu ya da ad taşırsa diye.
const AKIL_YASAK = [
  /\/Users\/[A-Za-z0-9_.-]+/g, /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
  /\b(?:\d{1,3}\.){3}\d{1,3}\b/g, /\+90\d{10}/g,
];
const temizBaglam = (m) => AKIL_YASAK.reduce((x, d) => x.replace(d, '…'), String(m || ''));

/**
 * Bu defterin kendi özel adları: telefonun adı, arkadaşın adı, gezilerin adı,
 * durak adları, tanıştığınız kişiler.
 *
 * Düzenli ifade bunları yakalayamaz — "Balkanlar Geroku" hiçbir desene
 * uymuyor. O yüzden kaynağından okunup çıkan metinden siliniyorlar.
 * Çok kelimeli adlar parçalarıyla birlikte siliniyor: "Üsküp Havaalanı"
 * kadar "Üsküp" de.
 */
async function kendiAdlarim() {
  const ham = [];
  try {
    ham.push(B.kayit.sahipAl()?.ad);
    for (const g of await veri.geroklar()) ham.push(g.ad);
    for (const d of (B.gerok.duraklar?.() || [])) ham.push(d.ad);
    for (const k of tumKayit) { ham.push(k.sahipAd); if (k.tur === 'kisi') ham.push(k.metin); }
  } catch { /* okunamayan kaynak varsa gerisi yine karartılır */ }
  const parcalar = new Set();
  for (const a of ham) {
    if (!a) continue;
    parcalar.add(String(a).trim());
    for (const p of String(a).split(/[\s·—–\-,;:()]+/)) if (p.length > 2) parcalar.add(p);
  }
  // Uzun olan önce silinsin: "Üsküp Havaalanı" parçalanmadan gitsin.
  return [...parcalar].filter(x => x.length > 2).sort((a, b) => b.length - a.length);
}

function adlariKarart(metin, adlar) {
  let m = metin;
  for (const a of adlar) {
    m = m.split(a).join('…');
    // Türkçe ekli hâlleri de ("Ohrid'de", "Üsküp'ten") aynı bölünmeyle düşüyor.
  }
  return m;
}

/**
 * Modele verilen bilgi. TAMAMI BEYAZ LİSTE — burada olmayan hiçbir şey
 * dışarı çıkmıyor.
 */
async function baglamMetni(sonSinama) {
  const a = akis;
  const d = a?.derin || a?.sayilar;
  const satir = [];

  satir.push('# Sen kimsin');
  satir.push('Gerok adlı gezi anı defteri uygulamasının içindeki bekçisin. İki yarımdan '
    + 'birisin: Mac’teki yarı kodu ve yayını sınıyor, sen bu telefonu sınıyorsun ve '
    + 'kullanıcıyla konuşuyorsun. Kullanıcının adıyla hitap etme, bilmiyorsun.');
  satir.push('Kullanıcı KOD BİLMİYOR ve teknik terim bilmiyor. Sade Türkçe konuş, kısa '
    + 'yaz (en fazla 5-6 cümle), madde madde anlat. Emoji kullanma.');
  satir.push('Bilmediğin bir şey sorulursa BİLMİYORUM de. Uydurma. Gerok’un nasıl '
    + 'çalıştığına dair aşağıdaki bilgi tabanının dışına çıkma; oradaki bir konuysa '
    + 'kendi cümlelerinle değil, KONU eylemiyle asıl metni göster.');
  satir.push('Gerok’la ilgisi olmayan sorulara (hava durumu, genel bilgi, sohbet) '
    + 'kibarca "ben yalnızca Gerok’a bakıyorum" de.');

  satir.push('\n# Yapabileceklerin');
  satir.push('Cevabının EN SONUNA, ayrı bir satır olarak en fazla iki tane eylem '
    + 'yazabilirsin. Biçim tam olarak şöyle ve başka hiçbir şey yazma:');
  satir.push('EYLEM: <ad>');
  satir.push(Object.entries(AKIL_EYLEMLERI)
    .map(([k, v]) => `  ${k} — ${v.aciklama}`).join('\n'));
  satir.push(`  konu:<id> — bilgi tabanındaki bir konuyu olduğu gibi göster. `
    + `Kimlikler: ${KONULAR.map(k => k.id).join(', ')}`);

  satir.push('\n# Bilgi tabanı (Gerok’un gerçek çalışma biçimi)');
  for (const k of KONULAR) {
    satir.push(`## ${k.id} — ${k.baslik}\n${k.cevap.replace(/<[^>]+>/g, '')}`);
  }

  satir.push('\n# Mac’teki bekçinin son durumu');
  satir.push(a
    ? `${d.kontrol} kontrol · ${d.sinama} ayrı sınama · durum: ${a.durum} · `
      + `en son ${zamanFarki(a.zaman)}`
      + (a.sorunlar?.length
          ? `\nAçık sorunlar:\n${a.sorunlar.map(s => `- ${s.ad}: ${s.not}`).join('\n')}`
          : '\nAçık sorun yok.')
    : 'Rapor alınamadı (internet yok ya da henüz koşmadı).');

  if (sonSinama?.length) {
    satir.push('\n# Bu telefonun son sınaması');
    satir.push(sonSinama.map(s =>
      `- ${s.gecti ? 'geçti' : 'TAKILDI'} · ${s.ad}: ${s.not}`).join('\n'));
  }

  satir.push('\n# Bilmediklerin');
  satir.push('Kullanıcının kayıtlarının içeriğini, notlarını, ses çözümlerini, '
    + 'gittiği yerleri, durak adlarını, kişi adlarını ve gezinin adını GÖRMÜYORSUN. '
    + 'Bunlar telefonda kalıyor, sana gönderilmiyor. Sorulursa bunu söyle.');

  return adlariKarart(temizBaglam(satir.join('\n')), await kendiAdlarim());
}

// Modelin isteyebileceği her şey burada. Listede olmayan bir ad gelirse
// GÖRMEZDEN GELİNİYOR — modelin cümlesi bir öneri, bir komut değil.
const AKIL_EYLEMLERI = {
  'sina':         { et: 'Bu telefonu sına', aciklama: 'bu telefonda 26 kontrol koştur',
                    is: () => sinamaAkisi() },
  'rapor':        { et: 'Mac raporunu göster', aciklama: 'Mac’teki bekçinin son raporu',
                    is: () => raporuGoster() },
  'yedek':        { et: 'Yedek al', aciklama: 'yedek alma akışını aç', is: () => { kapat(); B.yedekAl(); } },
  'harita-indir': { et: 'Haritayı indir', aciklama: 'harita paketi indirmeyi aç',
                    is: () => { kapat(); B.haritaIndir(); } },
  'gunsonu':      { et: 'Gün Sonu’nu başlat', aciklama: 'akşam ritüelini aç',
                    is: () => { kapat(); B.gunSonu(); } },
  'kayit':        { et: 'Kayıt ekranını aç', aciklama: 'ses/foto/not bırakılan ekran',
                    is: () => { kapat(); B.ekranAc('kayit'); } },
  'harita':       { et: 'Haritayı aç', aciklama: 'harita ekranı', is: () => { kapat(); B.ekranAc('harita'); } },
  'zaman':        { et: 'Zaman çizgisini aç', aciklama: 'kayıtların listesi',
                    is: () => { kapat(); B.ekranAc('zaman'); } },
  'claude-cagir': { et: 'Mac’teki bekçiye ilet', aciklama: 'çözemediğin bir şeyi sabahki Claude görevine bırak',
                    is: () => emirSor('claude-cagir', '') },
};

const kapat = () => { acik = false; B.ortuKapat(); };

/** Modelin cevabından eylemleri ayıklar. Tanınmayan ad sessizce düşer. */
function eylemleriAyikla(metin) {
  const dugmeler = [];
  const govde = metin.replace(/^EYLEM:\s*(.+)$/gim, (_, ham) => {
    const ad = ham.trim();
    if (ad.startsWith('konu:')) {
      const konu = KONULAR.find(k => k.id === ad.slice(5).trim());
      if (konu) dugmeler.push({ et: konu.baslik, is: () => konuAnlat(konu) });
    } else if (AKIL_EYLEMLERI[ad]) {
      dugmeler.push({ et: AKIL_EYLEMLERI[ad].et, is: AKIL_EYLEMLERI[ad].is });
    }
    return '';
  }).trim();
  return { govde, dugmeler };
}

/**
 * Soruyu akla götürür.
 *
 * Başarısız olursa SESSİZCE PES ETMİYOR: yerel eşleştiriciye düşüyor ve
 * neden düştüğünü söylüyor. Yolda internetin gidip gelmesi olağan; bekçinin
 * o anda susması olmaz.
 */
async function akliSor(soru) {
  const sonSinama = await veri.ayarOku('bekciSonSinamaAyrinti', null);
  const gecmis = konusma.filter(m => m.duz).slice(-8)
    .map(m => ({ role: m.kim === 'sen' ? 'user' : 'assistant', content: m.duz }));

  const yanit = await fetch(AKIL_ADRESI, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': akil.anahtar,
      'anthropic-version': '2023-06-01',
      // Tarayıcıdan doğrudan çağrı için gereken başlık.
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: akil.model,
      max_tokens: 700,
      system: await baglamMetni(sonSinama),
      messages: [...gecmis, { role: 'user', content: soru }],
    }),
  });

  if (!yanit.ok) {
    const h = await yanit.text().catch(() => '');
    throw new Error(yanit.status === 401 ? 'anahtar kabul edilmedi'
      : yanit.status === 429 ? 'çok hızlı — biraz bekle'
      : `${yanit.status} ${h.slice(0, 120)}`);
  }
  const d = await yanit.json();
  akil.sayac++;
  await akliKaydet();
  return (d.content || []).filter(p => p.type === 'text').map(p => p.text).join('\n').trim();
}

/**
 * Dışarı çıkacak metnin TAMAMI.
 *
 * "Kişisel bir şey göndermiyorum" bir söz; bu işlev o sözün kanıtı.
 * Kullanıcı ayarlar kartından görebiliyor, bir tarayıcı sınaması da her gün
 * içinde kişisel desen arıyor.
 */
export async function baglamOnizle() {
  if (!tumKayit.length) tumKayit = await veri.kayitlariGetir();
  return baglamMetni(await veri.ayarOku('bekciSonSinamaAyrinti', null));
}

/** Akıl açıkken cevabın yolu. */
async function akillaCevapla(metin) {
  soyle('<span class="bk-soluk">düşünüyorum…</span>', [], { gecici: true });
  try {
    const ham = await akliSor(metin);
    konusma.pop();
    if (!ham) throw new Error('boş cevap');
    const { govde, dugmeler } = eylemleriAyikla(ham);
    soyle(kacis(govde).replace(/\n/g, '<br>'), dugmeler, { akil: true, duz: govde });
  } catch (h) {
    konusma.pop();
    // Yerel eşleştirici hâlâ yerinde — akıl bir katman, bir bağımlılık değil.
    soyle(`<span class="bk-soluk">Akla ulaşamadım (${kacis(h.message)}). `
        + 'Kendi bildiklerimle cevaplıyorum:</span>');
    yerelCevapla(metin);
  }
}

// ---- Ayarlar kartı ---------------------------------------------------------

function akilKarti() {
  const m = MODELLER.find(x => x.id === akil.model) || MODELLER[0];
  soyle(`<b>Dil modeline bağlanma</b><br><br>`
    + (akilAcikMi()
        ? `Şu an <b>bağlı</b> · ${kacis(m.ad)} · bu cihazdan ${akil.sayac} soru gitti.<br><br>`
        : 'Şu an <b>kapalı</b>. Bekçi kendi bildikleriyle çalışıyor: internetsiz, '
          + 'ücretsiz, tahmin yürütmeden.<br><br>')
    + '<span class="bk-soluk">Bağlıyken serbest cümleyi daha iyi anlarım ve daha akıcı '
    + 'anlatırım. Akıldan gelen cevapların kenarı <b>mavi</b> olur — hangi cevabın '
    + 'ezberimden, hangisinin modelden geldiğini karıştırma diye.<br><br>'
    + '<b>Dışarı ne gidiyor:</b> yazdığın cümle, uygulamanın nasıl çalıştığına dair '
    + 'bilgi ve bekçinin durumu. <b>Ne gitmiyor:</b> kayıtlarının metni, ses '
    + 'çözümleri, fotoğraflar, kişi adları, durak adları, koordinatlar, gezinin adı. '
    + 'Anahtar yalnızca bu telefonda durur.<br><br>'
    + 'Her soru Anthropic hesabından birkaç kuruş harcar.</span>'
    + `<div class="bk-alan">
        <div class="girdi-etiket">Anahtar (sk-ant-…)</div>
        <input class="girdi" id="bkAnahtar" type="password" autocomplete="off"
               placeholder="${akil.anahtar ? '•••••••• kayıtlı' : 'buraya yapıştır'}">
        <div class="girdi-etiket" style="margin-top:10px">Model</div>
        <div class="bk-dugmeler">${MODELLER.map(x =>
          `<button class="bk-dugme${x.id === akil.model ? ' secili' : ''}"
             data-model="${x.id}">${kacis(x.ad)} · ${kacis(x.not)}</button>`).join('')}</div>
      </div>`,
    [{ et: akilAcikMi() ? 'Kapat' : 'Bağla', is: () => akliDegistir() },
     { et: 'Ne gönderdiğimi göster', is: () => baglamiGoster() },
     ...(akil.anahtar ? [{ et: 'Anahtarı sil', is: () => anahtariSil() }] : []),
     { et: 'Vazgeç', is: () => soyle('Tamam.') }]);
}

async function akliDegistir() {
  const yeni = (yazilanAnahtar || $('#bkAnahtar')?.value || '').trim();
  if (yeni) { akil.anahtar = yeni; yazilanAnahtar = ''; }
  if (akilAcikMi()) {                          // açıkken basıldı → kapat
    akil.acik = false;
    await akliKaydet();
    soyle('Kapattım. Kendi bildiklerimle devam ediyorum — internetsiz de çalışırım.');
    ciz();
    return;
  }
  if (!akil.anahtar) {
    soyle('Anahtar yok. Anthropic hesabından bir anahtar alıp yukarıdaki kutuya '
        + 'yapıştırman gerekiyor. Anahtar bu telefondan hiçbir yere gitmiyor, '
        + 'yalnızca soruları gönderirken kullanılıyor.');
    return;
  }
  soyle('<span class="bk-soluk">bağlanıyor…</span>', [], { gecici: true });
  akil.acik = true;
  try {
    // Gerçekten çalıştığını GÖRMEDEN "bağlandım" demiyorum.
    await akliSor('Bağlantı sınaması. Tek kelimeyle "hazır" yaz.');
    await akliKaydet();
    konusma.pop();
    soyle('<b>Bağlandım.</b> Artık serbest yazabilirsin — cümleyi anlamaya çalışırım. '
        + 'Mavi kenarlı cevaplar modelden geliyor.<br><br>'
        + '<span class="bk-soluk">İnternet giderse kendi bildiklerime dönerim, '
        + 'susmam.</span>', [], { akil: true });
  } catch (h) {
    akil.acik = false;
    konusma.pop();
    soyle(`Bağlanamadım: <b>${kacis(h.message)}</b>.<br><br>`
        + '<span class="bk-soluk">Anahtar yanlış olabilir ya da internet yok. '
        + 'Kapalı kaldım, bekçi çalışmaya devam ediyor.</span>',
      [{ et: 'Tekrar dene', is: () => akilKarti() }]);
  }
  ciz();
}

/** Söz değil, kanıt: gidecek metnin kendisi. */
async function baglamiGoster() {
  const m = await baglamOnizle();
  soyle('<b>Bir soru sorduğunda dışarı çıkan metin bu.</b><br>'
    + `<span class="bk-soluk">${(m.length / 1024).toFixed(1)} KB · yazdığın cümle de `
    + 'buna ekleniyor. Başka hiçbir şey gitmiyor.</span>'
    + `<pre class="bk-onizleme">${kacis(m)}</pre>`,
    [{ et: 'Tamam', is: () => soyle('İstediğin zaman tekrar bakabilirsin.') }]);
}

async function anahtariSil() {
  akil = { acik: false, anahtar: '', model: akil.model, sayac: 0 };
  await akliKaydet();
  soyle('Anahtarı sildim. Bu telefonda hiçbir izi kalmadı.');
  ciz();
}

// -------------------------------------------------------------- konuşma ----
//
// Sohbet ekranı. Çoğu iş DOKUNARAK yapılıyor, yazmak isteyene de kutu var:
// yolda tek elle telefon kullanırken düğme, klavyeden her zaman iyidir.

let konusma = [];          // { kim: 'bekci' | 'sen', html, dugmeler }
let acik = false;

const KARSILAMA = [
  { et: 'Bu telefonu sına', is: () => sinamaAkisi() },
  { et: 'Bekçi raporu', is: () => raporuGoster() },
  { et: 'Neler yapabilirsin?', is: () => menuGoster() },
  { et: 'Bir sorunum var', is: () => sorunMenusu() },
  { et: 'Dil modeline bağla', is: () => akilKarti() },
];

export async function bekciAc() {
  acik = true;
  await akliYukle();
  await akisiTazele();
  await veri.ayarYaz('bekciOkunan', Date.now());
  B.rozetiTazele?.();

  if (!konusma.length) {
    const s = ozet();
    const a = akis;
    const d = a?.derin || a?.sayilar;
    let govde = a
      ? `Mac’teki yarım en son <b>${zamanFarki(a.zaman)}</b> baktı. `
        + `Son geniş koşuda <b>${(d.sinama).toLocaleString('tr-TR')} ayrı sınama</b> yapıldı`
        + `${a.sayilar.sorun ? ` ve ${a.sayilar.sorun} tanesinde sorun var` : ' ve hepsi yolunda'}.`
      : 'Mac’teki yarımın raporunu henüz alamadım — internet olunca gelir. '
        + 'Bu telefonla ilgili her şeyi internetsiz de sınayabilirim.';
    if (a?.sorunlar?.length) {
      govde += '<br><br>' + a.sorunlar.map(x =>
        `• <b>${kacis(x.ad)}</b><br><span class="bk-soluk">${kacis(x.not)}</span>`).join('<br>');
      govde += '<br><br><span class="bk-soluk">Bunlar bende değil, Mac tarafında. '
             + 'Kendim onaramadım — Claude’a iletirsem sabah bakar.</span>';
    }
    soyle(govde, a?.sorunlar?.length
      ? [{ et: 'Claude’a ilet', is: () => emirSor('claude-cagir',
            a.sorunlar.map(x => `${x.ad}: ${x.not}`).join('\n')) },
         { et: 'Şimdi tekrar kontrol et', is: () => emirSor('tam-kontrol', '') },
         ...KARSILAMA]
      : KARSILAMA);
    if (a?.bekleyen?.length) kararlariSor(a.bekleyen);
  }
  ciz();
}

/**
 * Bekçinin ağzından bir satır.
 *
 * `kaynak.akil` doğruysa balon mavi kenarlı çiziliyor: cevabın modelden
 * geldiğini söylüyor. `kaynak.duz` modelin ham metni — sonraki soruda
 * geçmiş olarak geri gönderiliyor (HTML değil, düz metin).
 */
function soyle(html, dugmeler = [], kaynak = {}) {
  konusma.push({ kim: 'bekci', html, dugmeler, ...kaynak });
  konusma = konusma.slice(-50);
  if (acik) ciz();
}

/** Kullanıcının ağzından bir satır. */
function dedim(metin) {
  konusma.push({ kim: 'sen', html: kacis(metin), duz: metin });
  if (acik) ciz();
}

function ciz() {
  const s = ozet();
  const a = akis;
  B.ortuAc(`
    <div class="bk-ust">
      <div class="bk-baslik">
        <span class="bk-nokta ${s.sinif}"></span>
        <span>Bekçi</span>
        <button class="bk-akil-rozet${akilAcikMi() ? ' acik' : ''}" id="bkAkilRozet">
          ${akilAcikMi() ? 'akıl açık' : 'akıl kapalı'}
        </button>
      </div>
      <div class="bk-alt">${kacis(a
        ? `${(a.derin || a.sayilar).kontrol} kontrol · `
          + `${((a.derin || a.sayilar).sinama).toLocaleString('tr-TR')} sınama · `
          + `en son ${zamanFarki(a.zaman)}`
        : 'Mac raporu bekleniyor')}</div>
    </div>
    <div class="bk-akis" id="bkAkis">
      ${konusma.map((m, i) => m.kim === 'sen'
        ? `<div class="bk-satir sen"><div class="bk-balon sen">${m.html}</div></div>`
        : `<div class="bk-satir"><div class="bk-balon${m.akil ? ' akil' : ''}">${m.html}
             ${(m.dugmeler || []).length ? `<div class="bk-dugmeler">${
               m.dugmeler.map((d, j) => `<button class="bk-dugme" data-m="${i}" data-d="${j}">${kacis(d.et)}</button>`).join('')
             }</div>` : ''}
           </div></div>`).join('')}
    </div>
    <div class="bk-girdi">
      <input class="girdi" id="bkGirdi" placeholder="Bir şey sor ya da anlat…"
             autocomplete="off" enterkeyhint="send">
      <button class="bk-yolla" id="bkYolla" aria-label="Gönder">↑</button>
    </div>
    <button class="bk-kapat" id="bkKapat">Kapat</button>
  `, true, 'bekci');

  // Bağlıyken vurgu rengi maviye kayıyor: gönder düğmesi, imleç, kenarlar.
  // Bekçinin hangi kipte olduğu tek bakışta görünsün diye.
  $('#ortu').dataset.akil = akilAcikMi() ? 'acik' : 'kapali';

  const kap = $('#bkAkis');
  if (kap) kap.scrollTop = kap.scrollHeight;

  $$('#ortuIc .bk-dugme').forEach(d => d.addEventListener('click', () => {
    const m = konusma[+d.dataset.m];
    const dug = m?.dugmeler?.[+d.dataset.d];
    if (!dug) return;
    dedim(dug.et);
    dug.is();
  }));

  const yolla = () => {
    const g = $('#bkGirdi');
    const m = g?.value.trim();
    if (!m) return;
    g.value = '';
    dedim(m);
    cevapla(m);
  };
  $('#bkAkilRozet')?.addEventListener('click', () => akilKarti());
  $('#bkAnahtar')?.addEventListener('input', (e) => { yazilanAnahtar = e.target.value; });
  $$('#ortuIc [data-model]').forEach(d => d.addEventListener('click', async () => {
    akil.model = d.dataset.model;
    await akliKaydet();
    akilKarti();
  }));
  $('#bkYolla')?.addEventListener('click', yolla);
  $('#bkGirdi')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') yolla(); });
  $('#bkKapat')?.addEventListener('click', () => { acik = false; B.ortuKapat(); });
}

/**
 * Yazılana cevap. Kural: EMİN DEĞİLSEN TAHMİN ETME.
 *
 * Üç yol var ve üçü de dürüst: tek konu açık ara öndeyse cevap veriliyor,
 * birkaçı yakınsa seçenek sunuluyor, hiçbiri tutmuyorsa "bilmiyorum" deniyor.
 * Dördüncü bir yol — yakın duran bir konuyu doğruymuş gibi anlatmak — bu
 * bekçide yok. Yanlış cevap veren bekçi, boşuna öten alarmdan farksızdır.
 */
function cevapla(metin) {
  if (akilAcikMi() && navigator.onLine) { akillaCevapla(metin); return; }
  if (akilAcikMi()) {
    soyle('<span class="bk-soluk">İnternet yok — akla ulaşamıyorum. '
        + 'Kendi bildiklerimle cevaplıyorum:</span>');
  }
  yerelCevapla(metin);
}

/** Ezberden cevap. Akıl kapalıyken, internetsizken ve akıl hata verdiğinde. */
function yerelCevapla(metin) {
  const bulunan = niyetBul(metin);

  if (!bulunan.length) {
    soyle('Bunu anlayamadım — ve anlamış gibi yapmayacağım, yanlış yönlendirmek '
        + 'hiç cevap vermemekten kötü.<br><br>Şunlardan biri olabilir mi?',
      [...menuDugmeleri().slice(0, 5),
       { et: 'Hepsini göster', is: () => menuGoster() },
       { et: 'Bunu Claude’a ilet', is: () => emirSor('claude-cagir', metin) }]);
    return;
  }

  const [ilk, ikinci] = bulunan;
  if (!ikinci || ilk.p >= ikinci.p + 3) { konuAnlat(ilk.konu); return; }

  soyle('Bunlardan hangisi?', bulunan.slice(0, 3).map(x =>
    ({ et: x.konu.baslik, is: () => konuAnlat(x.konu) })));
}

function konuAnlat(konu) {
  const d = [];
  if (konu.eylem) d.push({ et: konu.eylem.ad, is: () => { B.ortuKapat(); acik = false; konu.eylem.yap(); } });
  d.push({ et: 'Başka bir şey', is: () => menuGoster() });
  soyle(`<b>${kacis(konu.baslik)}</b><br><br>${konu.cevap}`, d);
}

const menuDugmeleri = () => KONULAR.map(k => ({ et: k.baslik, is: () => konuAnlat(k) }));

function menuGoster() {
  soyle('Bildiklerim:', menuDugmeleri());
}

function sorunMenusu() {
  soyle('Nerede takıldın?', [
    { et: 'Bir şey görünmüyor / boş', is: () => sinamaAkisi() },
    { et: 'Ses çalmıyor', is: () => konuAnlat(KONULAR.find(k => k.id === 'sesli-not')) },
    { et: 'Harita boş', is: () => konuAnlat(KONULAR.find(k => k.id === 'harita-bos')) },
    { et: 'Yer doldu', is: () => konuAnlat(KONULAR.find(k => k.id === 'yer-yok')) },
    { et: 'Bilmiyorum, sen bak', is: () => sinamaAkisi() },
    { et: 'Claude’a ilet', is: () => emirSor('claude-cagir', '') },
  ]);
}

// ------------------------------------------------------------ sınama akışı --

async function sinamaAkisi() {
  soyle(`<b>Bu telefonu sınıyorum…</b><div class="bk-ilerleme"><div id="bkCubuk"></div></div>
         <div class="bk-soluk" id="bkAdim">başlıyor</div>`);
  const cubuk = () => $('#bkCubuk'), adim = () => $('#bkAdim');

  const sonuclar = await kendiniSina((y, t, ad) => {
    const c = cubuk(); if (c) c.style.width = `${(y / t) * 100}%`;
    const a = adim(); if (a) a.textContent = `${y}/${t} · ${ad}`;
  });

  const kotu = sonuclar.filter(s => !s.gecti);
  const sinama = sonuclar.reduce((t, s) => t + s.sayi, 0);

  // Son satırı sonuçla değiştiriyoruz — ilerleme çubuğu sohbette kalmasın.
  konusma.pop();

  let govde = kotu.length
    ? `<b>${kotu.length} şey takılıyor.</b> ${sonuclar.length - kotu.length} kontrol temiz `
      + `(${sinama} ayrı sınama).<br><br>`
      + kotu.map(s => `• <b>${kacis(s.ad)}</b><br><span class="bk-soluk">${kacis(s.not)}</span>`
          + (s.ayrinti?.length ? `<br><span class="bk-soluk kucuk">${kacis(s.ayrinti.join(' · '))}</span>` : '')).join('<br>')
    : `<b>Bu telefonda her şey yolunda.</b><br>${sonuclar.length} kontrol · ${sinama} ayrı sınama · hepsi geçti.`;

  const d = [];
  const onarilabilir = kotu.filter(s => s.onarim && ONARIMLAR[s.onarim]);
  for (const s of onarilabilir) {
    d.push({ et: ONARIMLAR[s.onarim].ad, is: () => onar(s.onarim) });
  }
  if (kotu.length && !onarilabilir.length) {
    d.push({ et: 'Bunu Claude’a ilet', is: () => emirSor('claude-cagir',
      kotu.map(s => `${s.ad}: ${s.not}`).join('\n')) });
  }
  d.push({ et: 'Tümünü göster', is: () => tumSinamalar(sonuclar) });
  soyle(govde, d);
}

function tumSinamalar(sonuclar) {
  const gruplu = {};
  for (const s of sonuclar) (gruplu[s.oyku] ||= []).push(s);
  const ADLAR = { depolama: 'Depolama', kayit: 'Kayıtların bütünlüğü', iz: 'İz ve duraklar',
                  uygulama: 'Uygulamanın kendisi', izin: 'İzinler', duzen: 'Düzen' };
  soyle(Object.entries(gruplu).map(([g, liste]) =>
    `<div class="bk-grup">${kacis(ADLAR[g] || g)}</div>`
    + liste.map(s => `<div class="bk-sinama ${s.gecti ? '' : 'kotu'}">
         <span>${s.gecti ? '✓' : '✗'}</span>
         <span><b>${kacis(s.ad)}</b><br><span class="bk-soluk">${kacis(s.not)}</span></span>
       </div>`).join('')).join(''));
}

async function onar(anahtar) {
  const o = ONARIMLAR[anahtar];
  if (!o) return;
  if (o.onay) {
    soyle(`${kacis(o.onay)}<br><br>Yapayım mı?`, [
      { et: 'Evet, yap', is: () => onarUygula(anahtar) },
      { et: 'Vazgeç', is: () => soyle('Tamam, dokunmadım.') },
    ]);
    return;
  }
  onarUygula(anahtar);
}

async function onarUygula(anahtar) {
  const o = ONARIMLAR[anahtar];
  soyle('Yapıyorum…');
  try {
    const sonuc = await o.yap();
    konusma.pop();
    soyle(`<b>Yaptım.</b><br>${kacis(sonuc)}`,
      [{ et: 'Yeniden sına', is: () => sinamaAkisi() }]);
  } catch (h) {
    konusma.pop();
    soyle(`Yapamadım: ${kacis(h.message)}`, [{ et: 'Claude’a ilet', is: () => emirSor('claude-cagir', `${o.ad}: ${h.message}`) }]);
  }
}

// ------------------------------------------------------------ Mac raporu ---

async function raporuGoster() {
  await akisiTazele({ zorla: true });
  if (!akis) {
    soyle('Mac’teki yarımdan haber alamadım. İnternet varken tekrar dene — '
        + 'o arada bu telefonu sınayabilirim.',
      [{ et: 'Bu telefonu sına', is: () => sinamaAkisi() }]);
    return;
  }
  const a = akis, s = a.derin || a.sayilar;
  const gruplar = Object.entries((a.derin?.gruplar) || a.gruplar || {}).map(([g, v]) =>
    `<div class="bk-sinama ${v.gecen < v.toplam ? 'kotu' : ''}">
       <span>${v.gecen < v.toplam ? '✗' : '✓'}</span>
       <span><b>${kacis(OYKU_ADI[g] || g)}</b><br>
         <span class="bk-soluk">${v.gecen}/${v.toplam} kontrol · ${v.sinama} sınama</span></span>
     </div>`).join('');

  soyle(`<b>Mac’teki bekçi · ${kacis(zamanFarki(a.zaman))}</b><br>`
    + `<span class="bk-soluk">${s.kontrol} kontrol · <b>${(s.sinama).toLocaleString('tr-TR')} ayrı sınama</b>`
    + ` · ${a.sayilar.kosu} koşu</span><br><br>${gruplar}`
    + (a.onarilan?.length ? `<br><b>Kendi onardıkları</b><br>`
        + a.onarilan.map(o => `• ${kacis(o)}`).join('<br>') : '')
    + (a.bilinenler?.length ? `<br><br><b>Bilinen ve kabul edilenler</b><br>`
        + a.bilinenler.map(b => `• ${kacis(b.ad)}`).join('<br>') : ''),
    [
      { et: 'Şimdi tam kontrol yap', is: () => emirSor('tam-kontrol', '') },
      { et: 'Aylık telefon sınaması', is: () => telefonSinamasi() },
      { et: 'Bu telefonu sına', is: () => sinamaAkisi() },
    ]);
}

const OYKU_ADI = {
  yayin: 'Yayın ve sürüm', kod: 'Kod sağlığı', gizlilik: 'Gizlilik',
  veri: 'Veri güvenliği', sartname: 'Şartname', kaynak: 'Kaynaklar',
  depolama: 'Depolama ve arşiv', bekci: 'Bekçinin kendisi', davranis: 'Gerçek tarayıcı sınamaları',
};

function telefonSinamasi() {
  const liste = akis?.telefonSinamasi || [];
  if (!liste.length) { soyle('Aylık sınama listesi henüz gelmedi.'); return; }
  soyle('<b>Mac’in göremediği yer.</b><br>'
      + '<span class="bk-soluk">Bunları ancak sen deneyebilirsin — mikrofon, galeri '
      + 've GPS bilgisayardan sınanamıyor. Kırk saniye sürer.</span><br><br>'
      + liste.map((x, i) => `${i + 1}. ${kacis(x)}`).join('<br>'),
    [{ et: 'Hepsini denedim, çalışıyor', is: () => emirSor('sinama-tamam', '') },
     { et: 'Biri çalışmadı', is: () => emirSor('claude-cagir', 'Aylık telefon sınamasında bir madde çalışmadı.') }]);
}

function kararlariSor(bekleyen) {
  for (const b of bekleyen) {
    soyle(`<b>Kararını bekliyorum</b><br>${kacis(b.soru)}`,
      b.secenekler.map(s => ({ et: s, is: () => emirSor('not', `${b.soru}\nCEVAP: ${s}`) })));
  }
}

// ---------------------------------------------------------------- emirler --
//
// Telefondan Mac'e giden tek yol. Sunucu yok, o yüzden köprü bir DOSYA:
// uygulama küçük bir emir dosyası üretiyor, sen onu iCloud Drive → Gerok'a
// kaydediyorsun, bekçi saatlik koşusunda okuyup uyguluyor.
//
// Dosya bir komut değil bir SEÇİM taşıyor: Mac tarafında sabit bir liste var
// ve listede olmayan hiçbir ad çalışmıyor. Klasöre yanlışlıkla düşen bir
// dosya bekçiye iş yaptıramaz.

const EMIR_ADI = {
  'tam-kontrol': 'kontrolün tamamını şimdi koşması',
  'claude-cagir': 'Claude’a dosya bırakması',
  'sinama-tamam': 'aylık sınamayı yapılmış işaretlemesi',
  'yayinla': 'yayınlaması',
  'onar': 'onarımları denemesi',
  'not': 'notunu iletmesi',
  'durum': 'durumu yazması',
};

function emirSor(ad, metin) {
  soyle(`Bekçiye <b>${kacis(EMIR_ADI[ad] || ad)}</b> için bir emir dosyası hazırlayacağım.<br><br>`
      + '<span class="bk-soluk">Çıkan dosyayı <b>iCloud Drive → Gerok</b> klasörüne kaydet. '
      + 'Bekçi en geç bir saat içinde okuyup uygular ve cevabını buraya yazar.</span>',
    [{ et: 'Dosyayı hazırla', is: () => emirYolla(ad, metin) },
     { et: 'Vazgeç', is: () => soyle('Tamam, göndermedim.') }]);
}

async function emirYolla(ad, metin) {
  const paket = {
    gerok: 'emir', bicim: 1, t: Date.now(),
    telefon: B.kayit.sahipAl()?.ad || '',
    surum: B.SURUM,
    emirler: [{ ad, metin: String(metin || '').slice(0, 2000) }],
  };
  const dosyaAdi = `bekci-emir-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '')}.json`;
  const blob = new Blob([JSON.stringify(paket, null, 1)], { type: 'application/json' });
  const dosya = new File([blob], dosyaAdi, { type: 'application/json' });
  try {
    if (navigator.canShare?.({ files: [dosya] })) {
      await navigator.share({ files: [dosya], title: 'Gerok bekçisine emir' });
      soyle('Gönderildi. <b>iCloud Drive → Gerok</b> klasörüne kaydettiysen bekçi bir saat '
          + 'içinde okuyacak ve cevabı burada görünecek.');
    } else {
      const u = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = u; a.download = dosyaAdi; a.click();
      setTimeout(() => URL.revokeObjectURL(u), 3000);
      soyle('Dosya indirildi. iCloud Drive → Gerok klasörüne koy.');
    }
  } catch (h) {
    if (h.name === 'AbortError') { soyle('Vazgeçildi.'); return; }
    soyle(`Gönderilemedi: ${kacis(h.message)}`);
  }
}
