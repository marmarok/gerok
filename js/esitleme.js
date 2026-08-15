// Gerok — eşitleme ve yedek.
//
// İnternet yok, sunucu yok, hesap yok. Akşam otelde iki telefon arasında AirDrop.
// Paket: JSON metni + içine gömülü ses/önizleme dosyaları (base64).
// Fotoğraf ve videoların ORİJİNALLERİ pakete girmiyor — onlar galeride duruyor.

import * as veri from './veri.js';
import { aktifGerok, ozelDurakListesi, siraDuzeniAl, ozelDuraklariBirlestir,
         gunDuzeniAl, gunDuzeniBirlestir, durakNotlariAl, durakNotlariBirlestir,
         durakPuanlariAl, durakPuanlariBirlestir } from './gerok.js';

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
    // Elle yazılan durak notları ve puanlar. "Tatlıyı şu dükkândan al" gibi
    // bir notu tek telefonda bırakmak, ertesi gün oraya diğerinin gitmesi
    // hâlinde işe yaramaz hâle getiriyor.
    durakNotlari: durakNotlariAl(),
    durakPuanlari: durakPuanlariAl()
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

export async function paketBirlestir(paket) {
  if (!paket?.paketSurum) throw new Error('Bu dosya bir Gerok paketi değil.');

  // Paket bizde hiç olmayan bir tura aitse turu da kuruyoruz — yoksa gelen
  // kayıtlar hiçbir ekranda görünmezdi. Aktif tur DEĞİŞTİRİLMİYOR: kimsenin
  // gönderdiği bir dosya, o an içinde bulunduğun turu değiştiremesin.
  let yeniTur = null;
  for (const tanim of paket.gerokTanimlari || []) {
    if (!tanim?.id || await veri.gerokOku(tanim.id)) continue;
    await veri.gerokYaz({ ...tanim, arsiv: true, yuklenme: Date.now() });
    yeniTur = yeniTur || tanim.ad;
  }

  // Silinmişler de sayılıyor: kimliği burada duran bir kayıt yeniden eklenmez.
  const varOlanlar = new Set((await veri.tumKayitlar()).map(k => k.id));
  let yeniKayit = 0, yeniIz = 0, yeniMedya = 0, silinen = 0;

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
    if (varOlanlar.has(k.id)) continue;
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
  const yeniNot = await durakNotlariBirlestir(paket.durakNotlari || null);
  await durakPuanlariBirlestir(paket.durakPuanlari || null);

  return { yeniKayit, yeniIz, yeniMedya, silinen, yeniDurak, yeniGun, yeniNot,
           yeniTur, kisi: paket.kisi };
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
    bildir?.('Dosya indirildi. Dosyalar üzerinden AirDrop\'la.', 'iyi');
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
      const durakNotu = s.yeniDurak ? ` ${s.yeniDurak} yeni durak rotaya eklendi.` : '';
      const notNotu = s.yeniNot ? ` ${s.yeniNot} durak notu geldi.` : '';
      const turNotu = s.yeniTur
        ? ` Bu paket "${s.yeniTur}" turuna ait — Gerok → Turları yönet'ten o tura geçebilirsin.`
        : '';
      bildir?.(
        s.yeniKayit || s.yeniIz || s.yeniDurak || s.yeniNot || s.yeniTur
          ? `${s.kisi || 'Arkadaşın'} eklendi: ${s.yeniKayit} kayıt, ${s.yeniIz} iz noktası.${durakNotu}${notNotu}${silNotu}${turNotu}`
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
