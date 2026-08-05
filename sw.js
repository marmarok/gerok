// Sefer — servis worker.
// Uygulamanın kendisi tamamen önbelleğe alınıyor: bir kez açıldıktan sonra
// internet olmadan da çalışıyor. Harita ve kayıtlar zaten cihazın içinde.

// DİKKAT: her yayında bu sürüm değişmeli, yoksa telefonlar eski dosyaları
// önbellekten sunmaya devam eder. arac/yayinla.sh bunu kendiliğinden günceller.
const SURUM = 'sefer-20260806-002330';

const DOSYALAR = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/stil.css',
  './js/app.js',
  './js/veri.js',
  './js/depo.js',
  './js/iz.js',
  './js/sefer.js',
  './js/kayit.js',
  './js/harita.js',
  './js/gunsonu.js',
  './js/esitleme.js',
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
    await Promise.all(adlar.filter(a => a !== SURUM).map(a => caches.delete(a)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (olay) => {
  const istek = olay.request;
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
