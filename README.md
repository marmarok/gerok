# Gerok

İnternetsiz çalışan gezi anı defteri. Telefona kurulan bir web uygulaması (PWA).

Bir gezi = bir **Gerok**. İçinde günlere göre dizilmiş anılar, üzerine oturdukları
offline bir harita, planlanan duraklar ve o duraklara yaklaşınca çalan hatırlatıcılar.

## Ne yapar

- **Zaman çizgisi** — gezi günlerine göre gruplanmış kronolojik akış
- **Offline harita** — tek bir `.pmtiles` dosyası, ağ isteği yok, uçak modunda çalışır
- **İz** — uygulama açıkken 30 saniyede bir konum noktası
- **Kayıt türleri** — sesli not, ortam sesi, yazı, konum işareti, tanışılan kişi, fiyat
- **Duraklar** — planlanan yerler, her birinde unutulmayacaklar listesi, gittik/kaçırdık işareti
- **Yol Modu** — ekranı açık tutar, durağa yaklaşınca sesli ve titreşimli uyarır
- **Gün Sonu** — tek ekranda akşam ritüeli: özet, sesli günlük, fotoğrafları toplama, yedek, eşitleme
- **Eşitleme** — iki telefon arasında AirDrop ile; sunucu, hesap ve internet gerekmez

## Fotoğrafları neden kopyalamıyor

iOS, bir web sayfasından çekilen fotoğrafın GPS bilgisini siliyor
([WebKit 257534](https://bugs.webkit.org/show_bug.cgi?id=257534)) ve HEIC→JPEG
çevriminde EXIF'in çoğu kayboluyor. Bu yüzden uygulama fotoğraf makinesi değil:

- Fotoğraflar normal kamerayla, galeriye, tam kalitede çekilir
- Uygulama yalnızca küçük bir önizleme, çekilme saati ve konum tutar
- Konum yoksa fotoğraf **saatine göre ize eşleştirilerek** yerleştirilir

Sıralama: EXIF konumu → iz eşleştirmesi → elle işaretleme.

Aynı sebeple 4K video (dakikada ~400 MB) uygulamanın deposuna taşınmaz; orijinaller
galeride, iCloud yedeğiyle korunur.

## Kurulum

Kullanıcı için adım adım anlatım: [`kurulum.html`](kurulum.html)

## Yapı

```
index.html            uygulama kabuğu, beş sekme
kurulum.html          kullanıcı için kurulum kartı
sw.js                 servis worker — tam offline
js/veri.js            IndexedDB + OPFS depolama
js/iz.js              GPS iz kaydı, mesafe hesabı
js/gerok.js           gerok paketi, gün mantığı, ülke tespiti
js/kayit.js           kayıt türleri, ses kaydı, EXIF okuma
js/harita.js          MapLibre + pmtiles, offline harita
js/gunsonu.js         Gün Sonu akışı, özel kayıtlar
js/esitleme.js        AirDrop paketi, birleştirme, yedek
```

## Gerok paketi

Rota, duraklar ve hatırlatıcılar **bu depoda değil**. Ayrı bir `.gerok` dosyası
olarak uygulamaya yükleniyor. Depo yalnızca uygulama kodunu içerir.

Paket biçimi:

```json
{
  "gerok":   { "id": "...", "ad": "...", "baslangic": "...", "bitis": "..." },
  "gunler":  [ { "no": 1, "baslik": "...", "pencere": ["...", "..."] } ],
  "duraklar":[ { "id": "...", "ad": "...", "lat": 0, "lon": 0,
                 "yaricap": 2000, "gun": 1, "unutma": ["..."] } ]
}
```

Gün pencereleri takvim gününe göre değil, gezinin kendi ritmine göre tanımlanır —
gece yarısından sonra varılan bir uçuş, doğru güne yazılsın diye.

## Offline harita

[Protomaps](https://protomaps.com) temel haritasından bölge çıkarımı:

```bash
pmtiles extract https://build.protomaps.com/<tarih>.pmtiles bolge.pmtiles \
  --bbox=<batı,güney,doğu,kuzey> --maxzoom=14
```

Vektör harita olduğu için zoom 14'ün ötesine de yakınlaşılabilir; yalnızca yeni
detay eklenmez. Dosya, uygulamanın Gerok sekmesinden bir kez indirilip cihazın
dosya sistemine (OPFS) yazılır.

**MapLibre sürüm notu:** v6 özel protokolleri (`addProtocol`) artık çağırmıyor,
bu yüzden pmtiles çalışmıyor. Bu proje **v5** kullanıyor.

## Gizlilik

Kayıtlar cihazın dışına çıkmaz. Sunucu, hesap, telemetri yok. Tek ağ isteği
harita dosyasının ilk indirmesi.

Lisans: MIT
