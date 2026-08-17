// Gerok — servis worker.
// Uygulamanın kendisi tamamen önbelleğe alınıyor: bir kez açıldıktan sonra
// internet olmadan da çalışıyor. Harita ve kayıtlar zaten cihazın içinde.

// DİKKAT: her yayında bu sürüm değişmeli, yoksa telefonlar eski dosyaları
// önbellekten sunmaya devam eder. arac/yayinla.sh bunu kendiliğinden günceller.
const SURUM = 'gerok-20260817-230918';

const DOSYALAR = [
  './',
  './index.html',
  './manifest.webmanifest',
  './sinama.html',
  './kurulum.html',
  './tamir.html',
  './css/stil.css',
  // Arayüz yazı tipleri. Google Fonts'a bağlanmıyoruz — yolda internet yok.
  // Bunlar olmadan uygulama çalışır ama sistem yazı tipine düşer.
  './yazitipi/dmsans-latin.woff2',
  './yazitipi/dmsans-latin-ext.woff2',
  './yazitipi/lora-latin.woff2',
  './yazitipi/lora-latin-ext.woff2',
  './js/app.js',
  './js/veri.js',
  './js/depo.js',
  './js/iz.js',
  './js/gerok.js',
  './js/kayit.js',
  './js/tema.js',
  './js/harita.js',
  './js/harita-stil.js',
  './js/gunsonu.js',
  './js/esitleme.js',
  './js/yer-ara.js',
  './js/ikon.js',
  './js/sema.js',
  './js/baglanti.js',
  // Bölgenin yer adları (kamuya açık GeoNames verisi, kişisel hiçbir şey yok).
  // Haritada yer aramak internetsiz de çalışsın diye gömülü — yolda wifi yok.
  './veri-yerler.json',
  // Harita yazı tipleri. Bunlar olmadan haritada tek bir yer adı görünmez.
  './yazi/noto-regular/0-255.pbf',
  './yazi/noto-regular/256-511.pbf',
  './yazi/noto-regular/512-767.pbf',
  './yazi/noto-regular/768-1023.pbf',
  './yazi/noto-regular/1024-1279.pbf',
  './yazi/noto-regular/7680-7935.pbf',
  './yazi/noto-regular/8192-8447.pbf',
  './yazi/noto-regular/8448-8703.pbf',
  './yazi/noto-medium/0-255.pbf',
  './yazi/noto-medium/256-511.pbf',
  './yazi/noto-medium/512-767.pbf',
  './yazi/noto-medium/768-1023.pbf',
  './yazi/noto-medium/1024-1279.pbf',
  './yazi/noto-medium/7680-7935.pbf',
  './yazi/noto-medium/8192-8447.pbf',
  './yazi/noto-medium/8448-8703.pbf',
  './vendor/maplibre-gl.js',
  './vendor/maplibre-gl.css',
  './vendor/pmtiles.js',
  './ikon/ikon-180.png',
  './ikon/ikon-512.png'
];

self.addEventListener('install', (olay) => {
  olay.waitUntil((async () => {
    const onbellek = await caches.open(SURUM);
    // Tek bir dosya bulunamazsa tüm kurulum çökmesin diye tek tek ekliyoruz.
    await Promise.all(DOSYALAR.map(async (d) => {
      try { await onbellek.add(new Request(d, { cache: 'reload' })); }
      catch (e) { console.warn('önbelleğe alınamadı:', d, e); }
    }));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (olay) => {
  olay.waitUntil((async () => {
    const adlar = await caches.keys();
    // Paylaşım önbelleği eski sürüm sayılmıyor: paylaşım tam bu sırada
    // gelmişse dosyalar silinirdi.
    await Promise.all(adlar
      .filter(a => a !== SURUM && a !== 'gerok-paylasim')
      .map(a => caches.delete(a)));
    await self.clients.claim();
  })());
});

// Başka bir uygulamadan "Paylaş" ile gelen medya buraya POST ediliyor
// (manifest.webmanifest → share_target). Sunucu yok, o yüzden isteği servis
// worker karşılıyor: dosyaları geçici bir önbelleğe koyup uygulamayı açıyor,
// uygulama açılışta oradan alıp zaman çizgisine ekliyor.
//
// DİKKAT — iOS/Safari Web Share Target'ı DESTEKLEMİYOR: iPhone'un paylaş
// menüsünde bu uygulama çıkmıyor. Buradaki yol Android ve masaüstünde
// çalışıyor, bir de ileride yazılacak native uygulama için hazır duruyor.
const PAYLASIM_ONBELLEGI = 'gerok-paylasim';

self.addEventListener('fetch', (olay) => {
  const istek = olay.request;

  if (istek.method === 'POST' && new URL(istek.url).pathname.endsWith('/paylas')) {
    olay.respondWith((async () => {
      try {
        const gelen = await istek.formData();
        const dosyalar = gelen.getAll('medya').filter(d => d && d.size);
        const onbellek = await caches.open(PAYLASIM_ONBELLEGI);
        let n = 0;
        for (const d of dosyalar) {
          await onbellek.put(new Request(`./paylasim/${n}`), new Response(d, {
            headers: {
              'content-type': d.type || 'application/octet-stream',
              'x-dosya-adi': encodeURIComponent(d.name || `paylasim-${n}`),
              'x-degisme': String(d.lastModified || Date.now())
            }
          }));
          n++;
        }
        return Response.redirect(`./?paylasim=${n}`, 303);
      } catch {
        return Response.redirect('./?paylasim=hata', 303);
      }
    })());
    return;
  }

  if (istek.method !== 'GET') return;

  const url = new URL(istek.url);
  if (url.origin !== self.location.origin) return;

  // Harita parçaları 357 MB. Servis worker önbelleğine de kopyalanırsa cihazda
  // iki kat yer kaplar — dosya sistemine (OPFS) zaten yazılıyor, buraya girmesin.
  if (url.pathname.includes('/harita/')) return;

  olay.respondWith((async () => {
    const onbellekli = await caches.match(istek);
    if (onbellekli) {
      // Arka planda tazele, ama cevabı bekletme.
      olay.waitUntil((async () => {
        try {
          const taze = await fetch(istek);
          if (taze.ok) (await caches.open(SURUM)).put(istek, taze.clone());
        } catch { /* çevrimdışıyız, önbellek yeterli */ }
      })());
      return onbellekli;
    }

    try {
      const yanit = await fetch(istek);
      if (yanit.ok) (await caches.open(SURUM)).put(istek, yanit.clone());
      return yanit;
    } catch {
      // Gezinme isteği ise uygulamanın kabuğunu ver.
      if (istek.mode === 'navigate') {
        const kabuk = await caches.match('./index.html');
        if (kabuk) return kabuk;
      }
      return new Response('Çevrimdışı', { status: 503, statusText: 'Cevrimdisi' });
    }
  })());
});
