# Gerok bekçisi — telefona giden iki dosya

Bu dalda kod yok, kişisel veri yok. İki JSON var:

- `akis.json` — bekçinin durum özeti. Uygulamanın Gerok sekmesindeki
  bekçi paneli bunu okuyor.
- `bilgi.json` — Balkan gezi rehberi: altı ülkenin tanınmış yerleri için
  ne görülür, ne yenir, ne alınır, nelere dikkat edilir; ülke başına para,
  dil ve fiyat bilgisi; bir de terim sözlüğü. Uygulama bunu indirip
  çevrimdışı kullanıyor.

`bilgi.json` bir BÖLGE rehberidir, bir gezi planı değil: kimin nereye
gittiğine dair hiçbir şey içermez. Hangi yerin kullanıcıya denk düştüğü
yalnızca cihazın içinde hesaplanıyor.

Ayrı dalda olmasının sebebi: main'deki commit sayısı uygulamanın
güncelleme numarasını üretiyor, bunlar oraya yazılsa numara boşuna artardı.
