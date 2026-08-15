# Yazı tipleri

Bu klasördeki dosyalar uygulamanın içine gömülü. Sebep: yolda internet yok.
Google Fonts'tan çalışma anında indirilseydi, uçak modunda ya da sinyalsiz bir
dağ yolunda uygulama sistem yazı tipine düşerdi — arayüzün bütün karakteri o an
kaybolurdu. Gerok'un tamamı çevrimdışı çalışacak biçimde kuruldu; yazı tipi de
buna dahil.

| Dosya | Nedir |
|---|---|
| `dmsans-latin.woff2`, `dmsans-latin-ext.woff2` | DM Sans — arayüz, düğmeler, rakamlar |
| `lora-latin.woff2`, `lora-latin-ext.woff2` | Lora — başlıklar, anı metinleri |

**latin-ext neden ayrı:** Türkçe'nin ğ, ş, İ harfleri `latin` altkümesinde yok,
`latin-ext`te. İkisi de olmadan "Üsküp"ün ü'sü gelir ama "Kalkandelen"in
hiçbir şeyi eksik kalmazken "İşkodra"nın İ'si sistem yazı tipine düşer.

**Değişken (variable) yazı tipi:** her kalınlık için ayrı dosya yok; tek dosya
400–700 arasını veriyor. Yedi ayrı dosya yerine iki dosya — hem daha az yer,
hem servis worker'da daha az satır.

## Lisans

İkisi de **SIL Open Font License 1.1** ile geliyor; gömmek, dağıtmak ve
ticari kullanmak serbest. Lisans metinleri yanlarında duruyor:
`OFL-Lora.txt` ve `OFL-DMSans.txt`. Bu dosyalar silinmemeli — OFL, yazı tipi
dağıtılırken lisansın da birlikte gitmesini şart koşuyor.

Kaynak: fonts.google.com (Lora v37, DM Sans v17), 15 Ağustos 2026'da alındı.
