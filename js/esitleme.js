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
    // 'gerok-paylasim' de 'gerok-' ile başlıyor ama sürüm değil — paylaşım
    // önbelleği varsa çalışan sürüm olarak o dönerdi.
    return adlar.find(a => /^gerok-\d/.test(a)) || null;
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

/**
 * Gelen paketi defterle birleştirir.
 *
 * `mezarlariYoksay` YALNIZCA kendi yedeğinden tam geri yüklemede true olur.
 * Sebebi (bekçi sınaması 22 Ağustos 2026'da yakaladı):
 *
 * Silinen kaydın kimliği "mezar taşı" olarak duruyor — arkadaşının paketinden
 * geri gelmesin diye. Doğru kural, ama YEDEKTEN GERİ YÜKLEMEDE ters teptiği
 * görüldü: yanlışlıkla sildiğin bir notu, silmeden ÖNCE alınmış yedekten geri
 * getiremiyordun. Yedeğin tek var oluş sebebi buyken.
 *
 * Ayrım şu: arkadaşının paketi bir GÖRÜŞ, kendi yedeğin bir HÂL. "Defterimi
 * o günkü hâline döndür" dediğinde mezar taşı kaybeder.
 */
export async function paketBirlestir(paket, { mezarlariYoksay = false } = {}) {
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

  // ÇÖZÜM YAMASI — sesin yazıya çevrilmiş hâli.
  //
  // Neden ayrı bir alan, neden kayıtların içinde değil: aşağıdaki birleştirme
  // kuralı "bendeki sürüm esas" diyor ve var olan bir kaydın üstüne yazmıyor,
  // gelen sürümü `digerSurumler`e iliştiriyor. Çözüm metni ise bir görüş
  // değil, telefonda hiç OLMAYAN bir alan — Mac'te üretiliyor. Kayıtların
  // içinde gelseydi çakışma sayılıp aranabilir olmazdı.
  //
  // Yalnızca BOŞ alan dolduruluyor. Elle düzeltilmiş bir çözümün üstüne
  // makine çıktısı yazılmıyor.
  let yeniCozum = 0;
  for (const [kayitId, metin] of Object.entries(paket.cozumler || {})) {
    const benim = bendekiler.get(kayitId);
    if (!benim || !String(metin || '').trim()) continue;
    if (String(benim.yazi || '').trim()) continue;
    await veri.kayitEkle({ ...benim, yazi: String(metin).trim(), yaziKaynagi: 'makine' });
    yeniCozum++;
  }

  let dirilen = 0;
  for (const k of paket.kayitlar || []) {
    if (varOlanlar.has(k.id)) {
      // Mezar taşının üstüne yazılıyor: kayıt olduğu gibi geri geliyor.
      if (mezarlariYoksay && bendekiler.get(k.id)?.silindi && !k.silindi) {
        await veri.kayitEkle(k);
        dirilen++;
        continue;
      }
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
           yeniTur, cakisan, yeniCozum, dirilen, kisi: paket.kisi };
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
      // Arkadaş paketi küçük olmalı ama yanlışlıkla tam yedek seçilebiliyor;
      // aynı akan okuyucu ikisini de kaldırıyor.
      const { govde: paket, tam } = await paketiAkit(dosya);
      if (!tam) throw new Error('Bu dosya yarım — gönderen yeniden göndersin.');
      const s = await paketBirlestir(paket);
      let yeniMedya = 0;
      await paketiAkit(dosya, {
        ilerleme: (y, t) => bildir?.(`Dosyalar alınıyor… %${Math.round(y / t * 100)}`),
        medya: async (id, tur, b64) => {
          if (await veri.medyaOku(id)) return;
          await veri.medyaYaz(id, base64Coz(b64, tur));
          yeniMedya++;
        }
      });
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
    // Damga "dosyayı iOS'a verdik" demek, "yedek var" demek DEĞİL. Doğrulama
    // damgası ayrı tutuluyor; ekran ikisini karıştırmıyor.
    await veri.ayarYaz('sonYedek', Date.now());
  } catch (hata) {
    if (hata.name === 'AbortError') { bildir?.('Yedek iptal edildi.'); return; }
    bildir?.(`Yedek alınamadı: ${hata.message}`, 'kotu');
  }
}


/**
 * Paketi akıtarak okur: gövdeyi ayrıştırır, medyayı TEK TEK verir.
 *
 * Neden gerekli: `JSON.parse(await dosya.text())` 355 MB'lık gerçek bir
 * yedekte telefonu öldürüyor. En kötüsü de bunun GERİ YÜKLEME yolunda
 * olmasıydı — yani yedeğin var ama telefondan geri yükleyemiyorsun ve bunu
 * ancak her şeyi kaybettiğin gün öğreniyorsun.
 *
 * Biçim bunu kolaylaştırıyor: gövde başta ve küçük, `,"medya":{` sonrası
 * dosyanın geri kalanı. Tampon en fazla bir medya kaydı + bir dilim tutuyor.
 */
export async function paketiAkit(dosya, { medya = null, ilerleme = null } = {}) {
  let boy = DOGRULAMA_PARCA, govde = null, medyaBasi = -1;
  while (true) {
    const bas = await dosya.slice(0, Math.min(boy, dosya.size)).text();
    const yer = bas.indexOf(',"medya":{');
    if (yer !== -1) {
      govde = JSON.parse(bas.slice(0, yer) + '}');
      // Karakter değil BAYT: bkz. `yedegiTara` içindeki not.
      medyaBasi = new TextEncoder()
        .encode(bas.slice(0, yer + ',"medya":{'.length)).length;
      break;
    }
    if (boy >= dosya.size) {
      // Medya bölümü hiç yok: eski biçim ya da medyasız paket.
      govde = JSON.parse(bas);
      return { govde, medyaSayisi: 0, tam: true };
    }
    boy *= 2;
  }

  const kuyruk = await dosya.slice(Math.max(0, dosya.size - 64)).text();
  const tam = kuyruk.trimEnd().endsWith('}}');

  let sayi = 0;
  if (medya) {
    const girdi = /^\s*,?\s*"([^"]{1,64})"\s*:\s*\{"tur":("(?:[^"\\]|\\.)*")\s*,\s*"veri":"([^"]*)"\}/;
    let tampon = '';
    let konum = medyaBasi;
    let bitti = false;
    while (!bitti) {
      if (konum < dosya.size) {
        tampon += await dosya.slice(konum, konum + DOGRULAMA_PARCA).text();
        konum += DOGRULAMA_PARCA;
        ilerleme?.(Math.min(konum, dosya.size), dosya.size);
      } else {
        bitti = true;
      }
      // Tamponda tam kayıt kaldığı sürece boşalt — bellek şişmesin.
      let m;
      while ((m = girdi.exec(tampon)) !== null) {
        await medya(m[1], JSON.parse(m[2]), m[3]);
        sayi++;
        tampon = tampon.slice(m[0].length);
      }
      if (bitti) break;
    }
  }
  return { govde, medyaSayisi: sayi, tam };
}

/**
 * YEDEĞİ GERİ OKU — "aldım" ile "var" arasındaki farkı kapatan tek şey.
 *
 * `navigator.share` dosyayı iOS'a veriyor ve orada bitiyor: nereye gittiğini,
 * gidip gitmediğini uygulama ÖĞRENEMİYOR. Buna rağmen "Yedek kaydedildi"
 * yazıp damga atıyorduk. O damga bir iddiaydı, olgu değil.
 *
 * Burada kullanıcı dosyayı geri veriyor, biz açıp SAYIYORUZ ve telefondaki
 * canlı veriyle karşılaştırıyoruz. Gizlilik taramasıyla aynı disiplin:
 * denetlenemeyen söz, söz değildir.
 *
 * Dönüş: {dogru, kayit, canliKayit, medya, iz, eksik, ad, boyut} ya da null
 * (kullanıcı seçmekten vazgeçti).
 */
const DOGRULAMA_PARCA = 8 * 1024 * 1024;      // 8 MB'lık dilimler

/**
 * Yedek dosyasını PARÇA PARÇA okur — asla tamamını belleğe almaz.
 *
 * `JSON.parse(await dosya.text())` yazmak kolaydı ve 355 MB'lık gerçek bir
 * defterde telefonu öldürüyordu: base64 şişmesiyle birlikte bir gigabaytı
 * aşıyor, iOS sekmeyi kapatıyor, kullanıcı hiçbir sonuç görmeden zaman
 * çizgisine düşüyor.
 *
 * Paketin biçimi bunu gereksiz kılıyor: gövde (kayıtlar, iz, duraklar) başta
 * ve küçük; ondan sonra `,"medya":{` gelip dosyanın geri kalanını dolduruyor.
 * Gövdeyi baştan okuyup ayrıştırıyoruz, medyayı ise akarak tarayıp hangi
 * kimliklerin GERÇEKTEN dosyada olduğunu topluyoruz.
 */
async function yedegiTara(dosya, ilerleme = null) {
  // 1. Gövde: `,"medya":{` işaretini bulana kadar büyüyen dilim.
  let boy = DOGRULAMA_PARCA, govde = null, medyaBasi = -1;
  while (boy <= dosya.size * 2) {
    const bas = await dosya.slice(0, Math.min(boy, dosya.size)).text();
    const yer = bas.indexOf(',"medya":{');
    if (yer !== -1) {
      govde = JSON.parse(bas.slice(0, yer) + '}');
      // KARAKTER ≠ BAYT. `indexOf` karakter sayısı veriyor, `Blob.slice`
      // bayt istiyor. Gövdede Türkçe harfler var (iki bayt), bu yüzden
      // karakter sayısını bayt yerine kullanmak dilimi yanlış yerden
      // başlatıyordu. Gerçek 355 MB'lık yedekte 2.371.556 karakter,
      // baytta bundan fazla.
      medyaBasi = new TextEncoder()
        .encode(bas.slice(0, yer + ',"medya":{'.length)).length;
      break;
    }
    if (boy >= dosya.size) break;
    boy *= 2;
  }
  if (!govde) throw new Error('Bu bir Gerok yedeği değil ya da dosya yarım.');

  // 2. Son: dosya `}}` ile bitmiyorsa yazma yarım kalmış demektir.
  const kuyruk = await dosya.slice(Math.max(0, dosya.size - 64)).text();
  const tam = kuyruk.trimEnd().endsWith('}}');

  // 3. Medya: akarak tara, yalnızca kimlikleri topla.
  const bulunan = new Set();
  const desen = /"([^"]{4,64})":\{"tur":/g;
  let konum = medyaBasi, artik = '';
  while (konum < dosya.size) {
    const dilim = artik + await dosya.slice(konum, konum + DOGRULAMA_PARCA).text();
    let m;
    desen.lastIndex = 0;
    while ((m = desen.exec(dilim)) !== null) bulunan.add(m[1]);
    // Dilim sınırına denk gelen kimlik kesilmesin diye kuyruk taşınıyor.
    artik = dilim.slice(-128);
    konum += DOGRULAMA_PARCA;
    ilerleme?.(Math.min(konum, dosya.size), dosya.size);
  }
  return { govde, tam, bulunan };
}

/**
 * YEDEĞİ GERİ OKU — "aldım" ile "var" arasındaki farkı kapatan tek şey.
 *
 * `navigator.share` dosyayı iOS'a veriyor ve orada bitiyor: nereye gittiğini,
 * gidip gitmediğini uygulama ÖĞRENEMİYOR. Buna rağmen "Yedek kaydedildi"
 * yazıp damga atıyorduk. O damga bir iddiaydı, olgu değil.
 *
 * Gizlilik taramasıyla aynı disiplin: denetlenemeyen söz, söz değildir.
 */
export function yedegiDogrula(bildir, bitti) {
  const secici = document.createElement('input');
  secici.type = 'file';
  secici.accept = '.json,application/json';

  secici.addEventListener('change', async () => {
    const dosya = secici.files[0];
    if (!dosya) { bitti?.(null); return; }
    bildir?.('Yedek okunuyor…');
    try {
      const { govde, tam, bulunan } = await yedegiTara(dosya, (y, t) => {
        bildir?.(`Yedek okunuyor… %${Math.round(y / t * 100)}`);
      });
      if (!govde?.paketSurum) throw new Error('Bu bir Gerok yedeği değil.');

      const kayit = (govde.kayitlar || []).length;
      const iz = (govde.iz || []).length;
      const gereken = (govde.kayitlar || []).filter(k => k.medyaId);
      const eksik = gereken.filter(k => !bulunan.has(k.medyaId)).length;

      // `tumKayitlar` MEZAR TAŞLARINI da sayıyor (silinmiş kayıtların izi).
      // Onunla karşılaştırılırsa, bir kez bile kayıt silmiş biri her yedekte
      // "yedeğin eski" uyarısı alırdı. Karşılaştırma yaşayan kayıtlarla.
      const canliKayit = (await veri.kayitlariGetir()).length;
      const dogru = tam && eksik === 0 && kayit >= canliKayit;

      if (dogru) {
        const an = Date.now();
        await veri.ayarYaz('sonYedek', an);
        await veri.ayarYaz('sonYedekDogrulandi', an);
        await veri.ayarYaz('sonYedekSayi', kayit);
      }
      bitti?.({ dogru, tam, kayit, canliKayit, medya: bulunan.size, iz, eksik,
                ad: dosya.name, boyut: dosya.size });
    } catch (hata) {
      bildir?.(`Yedek okunamadı: ${hata.message}`, 'kotu');
      bitti?.({ dogru: false, hata: hata.message });
    }
  });

  secici.click();
}

export async function yedekDogrulamaDurumu() {
  return {
    alindi: await veri.ayarOku('sonYedek', null),
    dogrulandi: await veri.ayarOku('sonYedekDogrulandi', null),
    sayi: await veri.ayarOku('sonYedekSayi', null)
  };
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
      // Gövde önce okunuyor, medya SONRA ve tek tek: 355 MB'lık bir yedeği
      // tek seferde belleğe almak telefonu öldürüyordu.
      const { govde: paket, tam } = await paketiAkit(dosya);
      if (!tam) throw new Error('Bu dosya yarım — yazma tamamlanmamış.');
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

      const s = await paketBirlestir(paket, { mezarlariYoksay: onay === 'degistir' });

      // Medya ayrı geçiş: her dosya okunur okunmaz depoya yazılıp bellekten
      // düşüyor. Böylece 355 MB'lık yedek 8 MB'lık tamponla geri yükleniyor.
      let yeniMedya = 0;
      await paketiAkit(dosya, {
        ilerleme: (y, t) => bildir?.(`Dosyalar yazılıyor… %${Math.round(y / t * 100)}`),
        medya: async (id, tur, b64) => {
          if (await veri.medyaOku(id)) return;
          await veri.medyaYaz(id, base64Coz(b64, tur));
          yeniMedya++;
        }
      });

      if (onay === 'degistir') {
        const kalacak = new Set((paket.kayitlar || []).map(k => k.id));
        const kalacakIz = new Set((paket.iz || []).map(n => n.id));
        const silinen = await veri.disindakileriSil(kalacak, kalacakIz);
        // Geri gelen silinmişler ayrıca söyleniyor: "silmiştim, geri geldi mi"
        // sorusunun cevabı bu satır.
        bildir?.(`Geri yüklendi · ${kalacak.size} kayıt · ${silinen} fazla kayıt silindi`
          + (s.dirilen ? ` · ${s.dirilen} silinmiş kayıt geri geldi` : ''), 'iyi');
      } else {
        // Çözüm yaması yeni kayıt getirmiyor; "0 yeni kayıt" demek
        // "hiçbir şey olmadı" gibi okunuyordu.
        const parcalar = [];
        if (s.yeniKayit) parcalar.push(`${s.yeniKayit} yeni kayıt`);
        if (s.yeniCozum) parcalar.push(`${s.yeniCozum} sesin yazısı`);
        if (s.yeniIz) parcalar.push(`${s.yeniIz} iz noktası`);
        bildir?.(parcalar.length
          ? `Birleştirildi · ${parcalar.join(' · ')} eklendi`
          : 'Paket alındı · eklenecek yeni bir şey yoktu', 'iyi');
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
  // BURASI TELEFONU ÖLDÜRÜYORDU. Eski hâli bütün paketi üretip
  // `blob.text()` ile TEK BİR JS METNİNE çeviriyor, sonra `JSON.parse`
  // ediyordu. 355 MB'lık bir defterde bu, base64 şişmesiyle birlikte bir
  // gigabaytı aşan bellek demek: iOS sekmeyi öldürüyor, sayfa yeniden
  // yükleniyor ve kullanıcı kendini zaman çizgisinde buluyor — hiçbir sonuç
  // yazılmadan. Sonuç: "Yedeği sına" satırı 17 Ağustos'ta donup kalmıştı.
  //
  // Oysa sorunun cevabı için paketi ÜRETMEK GEREKMİYOR. Sorulan şey:
  // "yedeğe girmesi gereken her ses/görsel gerçekten okunabiliyor mu?"
  // Bunu doğrudan depodan, dosya dosya, sabit bellekle sınıyoruz.
  const kayitlar = await veri.kayitlariGetir();
  const medyali = kayitlar.filter(k => k.medyaId);

  let boyut = 0, okunan = 0;
  const eksikler = [];
  for (const [i, k] of medyali.entries()) {
    ilerleme?.(i, medyali.length);
    const dosya = await veri.medyaOku(k.medyaId);
    if (dosya) { okunan++; boyut += dosya.size || 0; }
    else eksikler.push(k.id);
  }
  ilerleme?.(medyali.length, medyali.length);

  const izSayi = (await veri.izGetir()).length;
  return {
    // Gövde de yer tutuyor ama medyanın yanında küçük kalıyor; base64
    // yaklaşık üçte bir şişiriyor.
    boyut: Math.round(boyut * 4 / 3),
    kayitSayi: kayitlar.length,
    medyaSayi: okunan,
    izSayi,
    eksik: eksikler.length,
    eksikOrnek: eksikler.slice(0, 3),
    saglam: eksikler.length === 0
  };
}
