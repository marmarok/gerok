// Gerok — haritada yer arama.
//
// NEDEN GEREKLİ: durak koymak için haritayı elle kaydırıp doğru noktayı bulmak
// zor, hele araç sallanırken. "Struga" yazıp oraya gitmek istiyorsun.
//
// NEDEN ÇEVRİMDIŞI ÖNCE: yolda internet yok. `veri-yerler.json` içinde bölgenin
// 4300 yeri gömülü duruyor (kamuya açık GeoNames verisi, ~250 KB). Arama önce
// orada yapılıyor; sonuç yetersizse VE internet varsa Nominatim'e soruluyor.
//
// GİZLİLİK: çevrimdışı arama hiçbir yere bağlanmaz. İnternetli arama yalnızca
// kullanıcı "İnternette ara" düğmesine BASARSA yapılır — kendiliğinden değil.
// O zaman da dışarı giden tek şey yazdığı kelime olur.

let yerler = null;
let yukleniyor = null;

async function yerleriYukle() {
  if (yerler) return yerler;
  if (yukleniyor) return yukleniyor;
  yukleniyor = (async () => {
    try {
      const y = await fetch('./veri-yerler.json');
      yerler = await y.json();
    } catch {
      yerler = [];                 // dosya inmemişse arama boş döner, çökmez
    }
    return yerler;
  })();
  return yukleniyor;
}

// Türkçe arama için harf sadeleştirme.
//
// Kullanıcı "uskup" yazınca "Üsküp" bulunmalı; "İşkodra" ararken büyük İ ile
// küçük i'nin farkı sonucu kaçırmamalı. Yerel adlar da öyle: "Ohrid" verisinde
// "Ohrid" yazıyor ama kullanıcı "ohri" yazabilir.
const HARFLER = {
  'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u', 'İ': 'i', 'I': 'i',
  'â': 'a', 'î': 'i', 'û': 'u', 'é': 'e', 'è': 'e', 'ë': 'e', 'á': 'a', 'à': 'a',
  'ć': 'c', 'č': 'c', 'đ': 'd', 'š': 's', 'ž': 'z', 'ñ': 'n', 'ó': 'o', 'ô': 'o'
};

export function sadelestir(s) {
  return String(s || '')
    .replace(/[İI]/g, 'i')
    .toLowerCase()
    .replace(/[çğıöşüâîûéèëáàćčđšžñóô]/g, (h) => HARFLER[h] || h)
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const ULKE_ADI = {
  MK: 'Kuzey Makedonya', RS: 'Sırbistan', BA: 'Bosna-Hersek', ME: 'Karadağ',
  AL: 'Arnavutluk', XK: 'Kosova', HR: 'Hırvatistan', BG: 'Bulgaristan',
  GR: 'Yunanistan', TR: 'Türkiye'
};

/**
 * Çevrimdışı arama.
 *
 * Sıralama: başta geçen eşleşme önde, sonra nüfusu büyük olan. "Bel" yazınca
 * Belgrad ilk sırada çıksın diye — küçük bir köy önce gelirse arama işe
 * yaramıyor demektir.
 */
export async function ara(sorgu, { enFazla = 12, merkez = null } = {}) {
  const k = sadelestir(sorgu);
  if (k.length < 2) return [];
  await yerleriYukle();

  const bulunan = [];
  for (const y of yerler) {
    // İki ad da aranıyor: veride yerel ad yazıyor (Skopje) ama kullanıcı
    // Türkçesini yazıyor (Üsküp). Sınamada "uskup" hiçbir şey bulmuyordu.
    const adlar = y.t ? [sadelestir(y.t), sadelestir(y.a)] : [sadelestir(y.a)];
    let yer = -1, eslesen = '';
    for (const a of adlar) {
      const i = a.indexOf(k);
      if (i >= 0 && (yer < 0 || i < yer)) { yer = i; eslesen = a; }
    }
    if (yer < 0) continue;
    // Puan: baştan eşleşme en iyi, tam eşleşme daha da iyi, nüfus destekler.
    let puan = yer === 0 ? 1000 : 400 - yer * 10;
    if (eslesen === k) puan += 800;
    puan += Math.log10((y.n || 1) + 1) * 40;
    // Yakındaki yer öne çıksın: aynı adlı iki köyden yanındaki kastediliyordur.
    if (merkez) {
      const uz = Math.hypot((y.y - merkez.lat) * 111, (y.x - merkez.lon) * 85);
      if (uz < 300) puan += (300 - uz) / 3;
    }
    bulunan.push({ ...y, puan });
  }

  bulunan.sort((a, b) => b.puan - a.puan);
  return bulunan.slice(0, enFazla).map(y => ({
    // Türkçe adı varsa onu göster, yerel adı yanında dursun: "Üsküp (Skopje)"
    // — haritada yazan ad yerel olduğu için ikisini de görmek gerekiyor.
    ad: y.t ? `${y.t} (${y.a})` : y.a,
    lat: y.y,
    lon: y.x,
    alt: ULKE_ADI[y.u] || y.u,
    nufus: y.n,
    kaynak: 'gomulu'
  }));
}

/**
 * İnternetli arama (OpenStreetMap Nominatim).
 *
 * YALNIZCA kullanıcı isteyince çağrılır. Gömülü listede olmayan şeyler için:
 * sokak, restoran, otel, müze adı. Dışarı giden tek şey aranan kelime.
 */
export async function internetteAra(sorgu, { enFazla = 10 } = {}) {
  const adres = 'https://nominatim.openstreetmap.org/search?format=jsonv2'
    + `&limit=${enFazla}&accept-language=tr&q=${encodeURIComponent(sorgu)}`;
  const y = await fetch(adres, { headers: { 'Accept': 'application/json' } });
  if (!y.ok) throw new Error(`sunucu ${y.status}`);
  const d = await y.json();
  return d.map(x => ({
    ad: (x.name || x.display_name || '').split(',')[0],
    lat: Number(x.lat),
    lon: Number(x.lon),
    alt: (x.display_name || '').split(',').slice(1, 3).join(',').trim(),
    kaynak: 'internet'
  })).filter(x => x.ad && Number.isFinite(x.lat));
}
