// Gerok — eşitleme ve yedek.
//
// İnternet yok, sunucu yok, hesap yok. Akşam otelde iki telefon arasında AirDrop.
// Paket: JSON metni + içine gömülü ses/önizleme dosyaları (base64).
// Fotoğraf ve videoların ORİJİNALLERİ pakete girmiyor — onlar galeride duruyor.

import * as veri from './veri.js';
import { aktifGerok } from './gerok.js';

const PAKET_SURUM = 1;

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

export async function paketUret({ sadeceGun = null } = {}) {
  const hepsi = await veri.kayitlariGetir();
  const kayitlar = sadeceGun ? hepsi.filter(k => k.gun === sadeceGun) : hepsi;
  const izNoktalari = await veri.izGetir();
  const durakDurumlari = await veri.durakDurumlari();

  const medya = {};
  for (const k of kayitlar) {
    if (!k.medyaId) continue;
    const dosya = await veri.medyaOku(k.medyaId);
    if (dosya) {
      medya[k.medyaId] = { tur: dosya.type, veri: await base64Yap(dosya) };
    }
  }

  // Silme kararı da paketle gidiyor: bir kaydı silen kişi ötekinde de silmiş
  // olsun, yoksa akşam eşitlemesinde sildiği şey geri geliyor.
  const silinenler = (await veri.tumKayitlar())
    .filter(k => k.silindi)
    .map(k => ({ id: k.id, silinme: k.silinme || 0 }));

  return {
    paketSurum: PAKET_SURUM,
    uretim: Date.now(),
    gerokId: aktifGerok()?.id || null,
    cihaz: await veri.ayarOku('cihazKimligi'),
    kisi: await veri.ayarOku('kullaniciAdi'),
    kayitlar,
    silinenler,
    iz: sadeceGun
      ? izNoktalari.filter(n => kayitlar.some(k => Math.abs(k.t - n.t) < 24 * 3600_000))
      : izNoktalari,
    duraklar: durakDurumlari,
    medya
  };
}

// ---- Paket alma (birleştirme) ---------------------------------------------
//
// Birleştirme kayıpsız: her kaydın benzersiz kimliği var, aynı paket iki kez
// alınırsa hiçbir şey iki kez yazılmıyor ve hiçbir şey silinmiyor.

export async function paketBirlestir(paket) {
  if (!paket?.paketSurum) throw new Error('Bu dosya bir Gerok paketi değil.');

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

  return { yeniKayit, yeniIz, yeniMedya, silinen, kisi: paket.kisi };
}

// ---- Gönderme (AirDrop) ---------------------------------------------------

export async function paketGonder(bildir, sadeceGun = null) {
  bildir?.('Paket hazırlanıyor…');
  try {
    const paket = await paketUret({ sadeceGun });
    const metin = JSON.stringify(paket);
    const blob = new Blob([metin], { type: 'application/json' });
    const ad = `gerok-${paket.kisi || 'ben'}-${tarihEtiketi()}.gerok.json`;
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
      bildir?.(
        s.yeniKayit || s.yeniIz
          ? `${s.kisi || 'Arkadaşın'} eklendi: ${s.yeniKayit} kayıt, ${s.yeniIz} iz noktası.${silNotu}`
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
    const paket = await paketUret();
    paket.yedek = true;
    const blob = new Blob([JSON.stringify(paket)], { type: 'application/json' });
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
