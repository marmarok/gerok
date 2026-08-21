// Gerok — eşitleme ve yedek.
//
// İnternet yok, sunucu yok, hesap yok. Akşam otelde iki telefon arasında AirDrop.
// Paket: JSON metni + içine gömülü ses/önizleme dosyaları (base64).
// Fotoğraf ve videoların ORİJİNALLERİ pakete girmiyor — onlar galeride duruyor.

import * as veri from './veri.js';
import { aktifGerok, ozelDurakListesi, siraDuzeniAl, ozelDuraklariBirlestir,
         gunDuzeniAl, gunDuzeniBirlestir, durakDuzeniAl, durakDuzeniBirlestir,
         durakNotlariAl, durakNotlariBirlestir,
         durakPuanlariAl, durakPuanlariBirlestir,
         durakBilgileriAl, durakBilgileriBirlestir } from './gerok.js';

const PAKET_SURUM = 1;

// Paketi üreten uygulamanın sürümü. Servis worker'ın önbellek adından
// okunuyor — "şu an gerçekten hangi dosyalar çalışıyor"un en dürüst cevabı.
// İki işe yarıyor: dönüşte arşivi kurarken dosyanın hangi sürümden çıktığı
// belli oluyor, ve iki telefonun aynı sürümde olup olmadığı paketten
// anlaşılıyor — karşı telefonu elde tutmaya gerek kalmadan.
async function uygulamaSurumu() {
  try {
    if (!('caches' in window)) return null;
    const adlar = await caches.keys();
    return adlar.find(a => a.startsWith('gerok-')) || null;
  } catch { return null; }
}

function tarihEtiketi() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function base64Yap(blob) {
  const tampon = await blob.arrayBuffer();
  const baytlar = new Uint8Array(tampon);
  let s = '';
  const parca = 0x8000;                 // yığın taşmasın diye parça parça
  for (let i = 0; i < baytlar.length; i += parca) {
    s += String.fromCharCode.apply(null, baytlar.subarray(i, i + parca));
  }
  return btoa(s);
}

function base64Coz(metin, tur) {
  const ham = atob(metin);
  const baytlar = new Uint8Array(ham.length);
  for (let i = 0; i < ham.length; i++) baytlar[i] = ham.charCodeAt(i);
  return new Blob([baytlar], { type: tur || 'application/octet-stream' });
}

// ---- Paket üretme ---------------------------------------------------------

// Paketin içeriğini toplar — MEDYA HARİÇ. Medya ayrı akıtılıyor (bkz. paketBlobu):
// sekizinci günde tüm ses kayıtlarının base64'ü tek bir dev metin olunca
// telefonun belleği yetmiyordu.
// `tumTurlar` yalnızca YEDEKTE açık: yedek telefonun tamamını kurtarmalı,
// arşivdeki turları da. Akşam gönderilen paket ise yalnızca o anki turu
// taşıyor — arkadaşının defterine başka gezilerin kayıtları düşmesin.
async function govdeTopla({ sadeceGun = null, tumTurlar = false } = {}) {
  const turId = aktifGerok()?.id ?? null;
  const suzgec = tumTurlar ? undefined : turId;

  const hepsi = await veri.kayitlariGetir(suzgec);
  const kayitlar = sadeceGun ? hepsi.filter(k => k.gun === sadeceGun) : hepsi;
  const izNoktalari = await veri.izGetir(suzgec);
  const durakDurumlari = await veri.durakDurumlari();
  const turTanimlari = tumTurlar
    ? await veri.geroklar()
    : (aktifGerok() ? [aktifGerok()] : []);

  // Silme kararı da paketle gidiyor: bir kaydı silen kişi ötekinde de silmiş
  // olsun, yoksa akşam eşitlemesinde sildiği şey geri geliyor.
  const silinenler = (await veri.tumKayitlar())
    .filter(k => k.silindi)
    .map(k => ({ id: k.id, silinme: k.silinme || 0 }));

  return {
    paketSurum: PAKET_SURUM,
    uygulamaSurum: await uygulamaSurumu(),
    uretim: Date.now(),
    gerokId: aktifGerok()?.id || null,
    // Turun kendi tanımı da gidiyor: karşı tarafta o tur hiç yoksa
    // kurulabilsin. Başka bir turdaki arkadaşına gönderdiğinde o, senin
    // turunu olduğu gibi alıyor — günler, duraklar, hepsi.
    gerokTanimlari: turTanimlari,
    cihaz: await veri.ayarOku('cihazKimligi'),
    kisi: await veri.ayarOku('kullaniciAdi'),
    kayitlar,
    silinenler,
    iz: sadeceGun
      ? izNoktalari.filter(n => kayitlar.some(k => Math.abs(k.t - n.t) < 24 * 3600_000))
      : izNoktalari,
    duraklar: durakDurumlari,
    // Haritaya kendi koyduğumuz duraklar da geçsin: biri bir yer bulup
    // durak yaptıysa ötekinin rotasında da görünsün. Silinenler de gidiyor
    // (silindi:true), yoksa karşı tarafta geri dirilirdi.
    ozelDuraklar: tumTurlar
      ? ozelDurakListesi()
      : ozelDurakListesi().filter(d => (d.gerokId ?? null) === turId),
    durakSirasi: siraDuzeniAl(),
    // Rehber programı değiştirdiğinde durak başka güne taşınıyor; bu karar da
    // karşı telefona geçmeli, yoksa iki kişide iki ayrı program oluyor.
    durakGunleri: gunDuzeniAl(),
    // Durağın adı düzeltildiyse ya da durak silindiyse o da geçsin: iki
    // telefonda iki ayrı rota kalmasın.
    durakDuzenleri: durakDuzeniAl(),
    // Elle yazılan durak notları ve puanlar. "Tatlıyı şu dükkândan al" gibi
    // bir notu tek telefonda bırakmak, ertesi gün oraya diğerinin gitmesi
    // hâlinde işe yaramaz hâle getiriyor.
    durakNotlari: durakNotlariAl(),
    durakPuanlari: durakPuanlariAl(),
    // Internetten gelen durak bilgisi: bir telefon wi-fi bulup cektiyse
    // otekinin ayni isi tekrar yapmasina gerek kalmasin.
    durakBilgileri: durakBilgileriAl()
  };
}

/**
 * Paketi Blob olarak üretir.
 *
 * NEDEN TEK METİN DEĞİL: bir haftanın sonunda ses kayıtları toplamı 50 MB'ı
 * bulabiliyor; base64'ü 67 MB, `JSON.stringify` bunun bir kopyasını daha
 * çıkarıyor ve telefonda 130 MB'lık bir tepe oluşuyordu — yedek sessizce
 * çökebilirdi. Burada her ses ayrı ayrı base64'e çevrilip parça olarak
 * Blob'a veriliyor; hiçbir an tüm paket bellekte tek parça durmuyor.
 *
 * `ilerleme(yapilan, toplam)` ile kaç medya işlendiğini haber verir.
 */
export async function paketBlobu({ sadeceGun = null, ilerleme = null, tumTurlar = false } = {}) {
  const govde = await govdeTopla({ sadeceGun, tumTurlar });
  const govdeMetni = JSON.stringify(govde);

  // Gövdenin son süslü parantezini açıp "medya" alanını elle ekliyoruz.
  const parcalar = [govdeMetni.slice(0, -1), ',"medya":{'];

  const medyaliKayitlar = govde.kayitlar.filter(k => k.medyaId);
  let yapilan = 0, ilkMi = true;

  for (const k of medyaliKayitlar) {
    ilerleme?.(yapilan, medyaliKayitlar.length);
    const dosya = await veri.medyaOku(k.medyaId);
    yapilan++;
    if (!dosya) continue;

    parcalar.push(`${ilkMi ? '' : ','}${JSON.stringify(k.medyaId)}:{"tur":${JSON.stringify(dosya.type || k.bicim || '')},"veri":"`);
    parcalar.push(await base64Yap(dosya));
    parcalar.push('"}');
    ilkMi = false;
  }

  parcalar.push('}}');
  ilerleme?.(medyaliKayitlar.length, medyaliKayitlar.length);
  return new Blob(parcalar, { type: 'application/json' });
}

// Eski çağrılar için: tüm paketi bellekte nesne olarak verir.
// Yalnızca sınamada ve küçük paketlerde kullanılmalı.
export async function paketUret({ sadeceGun = null } = {}) {
  return JSON.parse(await (await paketBlobu({ sadeceGun })).text());
}

// ---- Paket alma (birleştirme) ---------------------------------------------
//
// Birleştirme kayıpsız: her kaydın benzersiz kimliği var, aynı paket iki kez
// alınırsa hiçbir şey iki kez yazılmıyor ve hiçbir şey silinmiyor.

/**
 * Bir kaydın "içeriği" — çakışma var mı diye bakarken karşılaştırılan şey.
 *
 * Kaydın kendisi tümüyle karşılaştırılmıyor: `yuklenme` gibi alanlar her
 * telefonda farklı ve bunları saymak, hiçbir şey değişmemişken çakışma
 * uydururdu. Karşılaştırılan yalnızca insanın girdiği alanlar.
 */
function imza(k) {
  return JSON.stringify([k.metin, k.baslik, k.kategori, k.tutar, k.paraBirimi,
    k.puan, k.gun, k.t, k.lat, k.lon, k.yerAdi, k.silinmis]);
}
const farkliMi = (a, b) => imza(a) !== imza(b);

export async function paketBirlestir(paket) {
  if (!paket?.paketSurum) throw new Error('Bu dosya bir Gerok paketi değil.');

  // Paket bizde hiç olmayan bir tura aitse turu da kuruyoruz — yoksa gelen
  // kayıtlar hiçbir ekranda görünmezdi. Aktif tur DEĞİŞTİRİLMİYOR: kimsenin
  // gönderdiği bir dosya, o an içinde bulunduğun turu değiştiremesin.
  let yeniTur = null;
  for (const tanim of paket.gerokTanimlari || []) {
    if (!tanim?.id) continue;
    const bendeki = await veri.gerokOku(tanim.id);
    if (!bendeki) {
      await veri.gerokYaz({ ...tanim, arsiv: true, yuklenme: Date.now() });
      yeniTur = yeniTur || tanim.ad;
      continue;
    }
    // Tur zaten kurulu. Adına, tarihine, duraklarına DOKUNMUYORUZ — birinin
    // gönderdiği dosya senin turunu yeniden adlandırmasın. Yalnızca gidilen
    // yol ve km sayıları güncelleniyor: onları uygulama kendi başına bilemiyor,
    // Mac'te harita sunucusuna sorularak hesaplanıyor (arac/iz-onar.py) ve
    // arac/rota-yamasi.py ile pakete yazılıyor.
    const yamalar = {};
    for (const alan of ['karayoluKm', 'ucusKm', 'izlenenKm', 'gunlukKm',
                        'gidilenYol', 'ucuslar']) {
      if (tanim[alan] == null) continue;
      // Rota ve günlük km birer dizi/nesne: !== her seferinde farklı der.
      const ayni = typeof tanim[alan] === 'object'
        ? JSON.stringify(tanim[alan]) === JSON.stringify(bendeki[alan])
        : tanim[alan] === bendeki[alan];
      if (!ayni) yamalar[alan] = tanim[alan];
    }
    if (Object.keys(yamalar).length) await veri.gerokYaz({ ...bendeki, ...yamalar });
  }

  // Silinmişler de sayılıyor: kimliği burada duran bir kayıt yeniden eklenmez.
  const bendekiler = new Map((await veri.tumKayitlar()).map(k => [k.id, k]));
  const varOlanlar = new Set(bendekiler.keys());
  let yeniKayit = 0, yeniIz = 0, yeniMedya = 0, silinen = 0, cakisan = 0;

  // Önce silmeler: karşı tarafın sildiği kayıt bizde de gitsin.
  for (const s of paket.silinenler || []) {
    varOlanlar.add(s.id);
    if (await veri.kayitYokEt(s.id)) silinen++;
    else await veri.mezarTasiYaz(s.id, s.silinme);
  }

  for (const [medyaId, m] of Object.entries(paket.medya || {})) {
    if (await veri.medyaOku(medyaId)) continue;
    await veri.medyaYaz(medyaId, base64Coz(m.veri, m.tur));
    yeniMedya++;
  }

  for (const k of paket.kayitlar || []) {
    if (varOlanlar.has(k.id)) {
      // ÇAKIŞMA: aynı kayıt iki telefonda ayrı ayrı değiştirilmiş.
      //
      // Kural — defterin sahibinin kararı (17 Ağustos): BENDEKİ SÜRÜM ESAS. Ekranda
      // duran, yedeğe giren, arşive geçen hep senin sürümün.
      //
      // Ama karşı sürüm SİLİNMİYOR. Eskiden sessizce düşüyordu; artık kaydın
      // içine iliştiriliyor. İki sebebi var: (1) on yıl sonra arşive bakan
      // biri "o gün ikisi ne yazmış" diye sorabilir, (2) sessizce veri
      // düşürmek, düştüğünü kimsenin bilmemesi demek.
      const benim = bendekiler.get(k.id);

      // İŞARET ÇAKIŞMAZ. "Bendeki esas" kuralı burada geçerli değil: işaret
      // bir görüş değil, bir oy. İkinizden biri kaydı önemli bulduysa önemli
      // sayılıyor — karşı tarafın işareti bende yoksa buraya da geçiyor.
      // Kaldırmak yine tek dokunuş, o yüzden yanlış bir şey eklemiyor.
      if (benim && k.isaretli && !benim.isaretli) {
        benim.isaretli = true;
        await veri.kayitEkle(benim);
      }

      if (benim && farkliMi(benim, k)) {
        const oncekiler = benim.digerSurumler || [];
        // Aynı paket iki kez alınırsa aynı sürüm iki kez iliştirilmesin.
        if (!oncekiler.some(o => imza(o) === imza(k))) {
          benim.digerSurumler = [...oncekiler, { ...k, kimden: paket.sahip?.ad || '' }];
          await veri.kayitEkle(benim);
          cakisan++;
        }
      }
      continue;
    }
    await veri.kayitEkle(k);
    yeniKayit++;
  }

  const mevcutIz = new Set((await veri.izGetir()).map(n => n.id));
  const eklenecek = (paket.iz || []).filter(n => !mevcutIz.has(n.id));
  if (eklenecek.length) {
    await veri.izEkleToplu(eklenecek);
    yeniIz = eklenecek.length;
  }

  // Durak durumunda en son işaretleyen kazanır.
  const bizdeki = await veri.durakDurumlari();
  for (const [id, d] of Object.entries(paket.duraklar || {})) {
    if (!bizdeki[id] || (d.guncelleme || 0) > (bizdeki[id].guncelleme || 0)) {
      await veri.durakDurumuYaz(id, d.durum);
    }
  }

  const yeniDurak = await ozelDuraklariBirlestir(paket.ozelDuraklar || [], paket.durakSirasi || null);
  const yeniGun = await gunDuzeniBirlestir(paket.durakGunleri || null);
  await durakDuzeniBirlestir(paket.durakDuzenleri || null);
  const yeniNot = await durakNotlariBirlestir(paket.durakNotlari || null);
  await durakPuanlariBirlestir(paket.durakPuanlari || null);
  await durakBilgileriBirlestir(paket.durakBilgileri || null);

  return { yeniKayit, yeniIz, yeniMedya, silinen, yeniDurak, yeniGun, yeniNot,
           yeniTur, cakisan, kisi: paket.kisi };
}

// ---- Gönderme (AirDrop) ---------------------------------------------------

export async function paketGonder(bildir, sadeceGun = null) {
  bildir?.('Paket hazırlanıyor…');
  try {
    const kisi = await veri.ayarOku('kullaniciAdi');
    const blob = await paketBlobu({
      sadeceGun,
      ilerleme: (y, t) => { if (t > 3) bildir?.(`Paket hazırlanıyor… ${y}/${t}`); }
    });
    const ad = `gerok-${kisi || 'ben'}-${tarihEtiketi()}.gerok.json`;
    const dosya = new File([blob], ad, { type: 'application/json' });

    // iOS'ta paylaş sayfası açılır; oradan AirDrop seçiliyor.
    if (navigator.canShare?.({ files: [dosya] })) {
      await navigator.share({ files: [dosya], title: 'Gerok paketi' });
      bildir?.('Gönderildi. Karşı taraf "Gelen paketi al" desin.', 'iyi');
      return;
    }

    // Paylaşım yoksa indirmeye düş.
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = ad; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
    // "İndirildi" tek başına eksik: dosyanın ne olduğu ve bundan sonra ne
    // olacağı söylenmezse, kullanıcı gönderme işinin bittiğini sanıyor.
    bildir?.('Gün paketi hazır · arkadaşın yakınken AirDrop ile gidecek', 'iyi');
  } catch (hata) {
    if (hata.name === 'AbortError') { bildir?.('Gönderme iptal edildi.'); return; }
    bildir?.(`Gönderilemedi: ${hata.message}`, 'kotu');
  }
}

export function paketAl(bildir, tazele) {
  const secici = document.createElement('input');
  secici.type = 'file';
  secici.accept = ".json,application/json";

  secici.addEventListener('change', async () => {
    const dosya = secici.files[0];
    if (!dosya) return;
    bildir?.('Paket okunuyor…');
    try {
      const paket = JSON.parse(await dosya.text());
      const s = await paketBirlestir(paket);
      const silNotu = s.silinen ? ` ${s.silinen} kayıt da silinmiş, burada da silindi.` : '';
      const cakismaNotu = s.cakisan
        ? ` ${s.cakisan} kayıtta iki sürüm vardı — seninki tutuldu, diğeri kaydın içinde duruyor.`
        : '';
      const durakNotu = s.yeniDurak ? ` ${s.yeniDurak} yeni durak rotaya eklendi.` : '';
      const notNotu = s.yeniNot ? ` ${s.yeniNot} durak notu geldi.` : '';
      const turNotu = s.yeniTur
        ? ` Bu paket "${s.yeniTur}" turuna ait — Gerok → Turları yönet'ten o tura geçebilirsin.`
        : '';
      bildir?.(
        s.yeniKayit || s.yeniIz || s.yeniDurak || s.yeniNot || s.yeniTur || s.cakisan
          ? `${s.kisi || 'Arkadaşın'} eklendi: ${s.yeniKayit} kayıt, ${s.yeniIz} iz noktası.${durakNotu}${notNotu}${silNotu}${cakismaNotu}${turNotu}`
          : `Bu paket zaten alınmış — hiçbir şey yinelenmedi.${silNotu}`,
        'iyi'
      );
      await tazele?.();
    } catch (hata) {
      bildir?.(`Alınamadı: ${hata.message}`, 'kotu');
    }
  });

  secici.click();
}

// ---- Yedek ----------------------------------------------------------------
//
// Uygulama silinse bile veri dursun diye. Tek kopya bırakılmıyor.

export async function yedekAl(bildir) {
  bildir?.('Yedek hazırlanıyor…');
  try {
    const blob = await paketBlobu({
      tumTurlar: true,
      ilerleme: (y, t) => { if (t > 3) bildir?.(`Yedek hazırlanıyor… ${y}/${t}`); }
    });
    const ad = `gerok-yedek-${tarihEtiketi()}.gerok.json`;
    const dosya = new File([blob], ad, { type: 'application/json' });

    if (navigator.canShare?.({ files: [dosya] })) {
      await navigator.share({ files: [dosya], title: 'Gerok yedeği' });
      bildir?.('Yedek kaydedildi. "Dosyalar\'a Kaydet" seçtiysen iCloud\'a da gider.', 'iyi');
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = ad; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 3000);
      bildir?.('Yedek indirildi.', 'iyi');
    }
    await veri.ayarYaz('sonYedek', Date.now());
  } catch (hata) {
    if (hata.name === 'AbortError') { bildir?.('Yedek iptal edildi.'); return; }
    bildir?.(`Yedek alınamadı: ${hata.message}`, 'kotu');
  }
}

export async function sonYedekZamani() {
  return veri.ayarOku('sonYedek', null);
}

/**
 * iCloud / Google Drive'a tek dokunuşla yükleme.
 *
 * DÜRÜST OLUNACAK YER: bir web uygulaması ARKA PLANDA buluta kopyalayamaz.
 * iOS bunu yalnızca kendi uygulamalarına veriyor. "Otomatik yedek" diye bir
 * anahtar koyup sessizce hiçbir şey yapmamak, kullanıcıya yedeği olduğunu
 * sandırmak olurdu — ve bunun öğrenileceği gün, her şeyin kaybolduğu gün.
 *
 * Yapılabilenin tamamı bu: tek dokunuş, paylaş sayfası açılır, "Dosyalar'a
 * Kaydet" (iCloud Drive) ya da Drive seçilir. Dosya adı tarihli, hep aynı
 * biçimde — aynı klasöre birikiyorlar, üst üste yazmıyorlar.
 */
export async function bulutaYukle(bildir) {
  bildir?.('Bulut yedeği hazırlanıyor…');
  try {
    const blob = await paketBlobu({
      tumTurlar: true,
      ilerleme: (y, t) => { if (t > 3) bildir?.(`Bulut yedeği hazırlanıyor… ${y}/${t}`); }
    });
    const ad = `gerok-yedek-${tarihEtiketi()}.gerok.json`;
    const dosya = new File([blob], ad, { type: 'application/json' });

    if (navigator.canShare?.({ files: [dosya] })) {
      await navigator.share({ files: [dosya], title: 'Gerok yedeği' });
      bildir?.('Yüklendi · “Dosyalar’a Kaydet” ya da Drive seçtiysen bulutta', 'iyi');
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = ad; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 3000);
      bildir?.('Dosya indirildi · buluta elle koyman gerekiyor', 'iyi');
    }
    const an = Date.now();
    await veri.ayarYaz('sonBulut', an);
    await veri.ayarYaz('sonYedek', an);
  } catch (hata) {
    if (hata.name === 'AbortError') { bildir?.('Yükleme iptal edildi.'); return; }
    bildir?.(`Yüklenemedi: ${hata.message}`, 'kotu');
  }
}

/**
 * Yedekten geri yükleme — iki kip.
 *
 * BİRLEŞTİR: yedekteki kayıtlar eklenir, telefondaki hiçbir şey silinmez.
 * DEĞİŞTİR: telefondaki her şey silinir, yerine yedek konur. Yedeğin
 * alınmasından sonra girilen kayıtlar kaybolur.
 *
 * "Değiştir" geri dönülemez ve gezi verisinin yerine konulacak bir şey yok.
 * Bu yüzden üç kapılı: kip seçilir → dosya seçilir → dosyanın İÇİ okunup
 * "şu kadar kayıt gelecek, şu kadarı silinecek" diye sayıyla onaylatılır.
 *
 * SIRA ÖNEMLİ — ilk yazdığım hâli yanlıştı ve tarayıcıda sınarken yakalandı.
 * Önce siliyor, sonra yedeği yüklüyordu; yedek doğrulamadan geçmeyince her
 * şey gitti, yerine hiçbir şey gelmedi. Doğrusu: ÖNCE birleştir (birleştirme
 * hiçbir şeyi silmez), birleştirme başarılı olduktan SONRA fazlasını sil.
 * Böylece bozuk bir dosya seçildiğinde tek bir kayıt bile kaybolmuyor.
 */
export function yedektenGeriYukle(bildir, tazele, onayla) {
  const secici = document.createElement('input');
  secici.type = 'file';
  secici.accept = '.json,application/json';

  secici.addEventListener('change', async () => {
    const dosya = secici.files[0];
    if (!dosya) return;
    bildir?.('Yedek okunuyor…');
    try {
      const paket = JSON.parse(await dosya.text());
      // Doğrulama ONAYDAN ÖNCE: kullanıcıya "2 kaydın silinecek" diye
      // sorup sonra "bu dosya okunamadı" demek olmaz.
      if (!paket?.paketSurum) throw new Error('Bu dosya bir Gerok yedeği değil.');
      const gelen = (paket.kayitlar || []).length;
      if (!gelen && !(paket.duraklar || []).length) {
        bildir?.('Bu dosyada kayıt yok — hiçbir şey değiştirilmedi.', 'kotu');
        return;
      }
      const mevcut = (await veri.tumKayitlar()).length;
      const onay = await onayla({ gelen, mevcut, ad: dosya.name });
      if (!onay) { bildir?.('Vazgeçildi — hiçbir şey değişmedi.'); return; }

      const s = await paketBirlestir(paket);

      if (onay === 'degistir') {
        const kalacak = new Set((paket.kayitlar || []).map(k => k.id));
        const kalacakIz = new Set((paket.iz || []).map(n => n.id));
        const silinen = await veri.disindakileriSil(kalacak, kalacakIz);
        bildir?.(`Geri yüklendi · ${kalacak.size} kayıt · ${silinen} fazla kayıt silindi`, 'iyi');
      } else {
        bildir?.(`Birleştirildi · ${s.yeniKayit} yeni kayıt eklendi`, 'iyi');
      }
      await tazele?.();
    } catch (hata) {
      bildir?.(`Geri yüklenemedi: ${hata.message}`, 'kotu');
    }
  });

  secici.click();
}

/**
 * Yedeği sınar: paketi üretir, GERİ OKUR ve ne çıktığını sayar.
 *
 * Yedek almanın sessiz tehlikesi şu: dosya oluşuyor, boyutu da makul
 * görünüyor, ama içi bozuk. Bunu ancak geri yüklemeye çalışırken —
 * yani her şeyin kaybolduğu gün — fark ediyorsun.
 *
 * Bu işlev tam olarak o günü öne çekiyor: yedeği üretiyor, JSON'u geri
 * çözüyor, kaç kayıt ve kaç ses dosyası okunabildiğini sayıyor. Hiçbir şey
 * yazmıyor, hiçbir şeyi değiştirmiyor — sadece okuyup rapor veriyor.
 */
export async function yedekSina(ilerleme = null) {
  const blob = await paketBlobu({ tumTurlar: true, ilerleme });
  const metin = await blob.text();

  let paket;
  try { paket = JSON.parse(metin); }
  catch { throw new Error('Yedek okunamadı — dosya bozuk çıktı.'); }

  if (!paket?.paketSurum) throw new Error('Yedek okunamadı — paket damgası yok.');

  const kayitSayi = (paket.kayitlar || []).length;
  const medyaAnahtarlari = Object.keys(paket.medya || {});
  // Ses/görsel taşıması gereken ama paketten çıkmayan kayıtlar: asıl tehlike bu.
  const eksik = (paket.kayitlar || [])
    .filter(k => k.medyaId && !(k.medyaId in (paket.medya || {}))).length;

  return {
    boyut: blob.size,
    kayitSayi,
    medyaSayi: medyaAnahtarlari.length,
    izSayi: (paket.iz || []).length,
    eksik,
    saglam: eksik === 0
  };
}
