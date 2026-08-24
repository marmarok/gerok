#!/usr/bin/env python3
"""Durak bilgi paketi — bekçinin "bilgili" yarısı.

Bekçi uygulamayı öğretiyordu; bu dosya ona GEZİYİ öğretiyor. Her durak için
ne görülür, ne yenir, ne alınır, başka gezginler ne söylemiş ve Türkiye'ye
göre fiyat nerede duruyor — hepsi telefonda, internetsiz.

GİZLİLİK — BU DOSYANIN EN ÖNEMLİ KISMI
Durak listesi rotanın kendisidir ve rota asla açık depoya girmez. Ama bilgi
paketinin telefona kendiliğinden ulaşması isteniyor; tek otomatik köprü ise
herkese açık `bekci` dalı.

Çözüm: yayınlanan paket ROTAYI DEĞİL BÖLGEYİ kapsıyor. Altı ülkenin tanınmış
yerleri toplu hâlde duruyor, hangilerinin gezide olduğu bilgisi pakette YOK.
Eşleştirme telefonun içinde, koordinat yakınlığıyla yapılıyor. Dışarıdan
bakan biri sıradan bir Balkan rehberi görüyor.

Bunu söz olarak bırakmıyoruz, `gizlilik_dene()` her yayından önce sınıyor:
  1. Pakette rota işareti olabilecek hiçbir alan yok (gün, sıra, tarih, iz).
  2. Kart sayısı rotanın en az 1,6 katı ve her ülkede rotada olmayan yer var —
     yani liste rotanın bire bir kopyası olamaz.
  3. Kişisel bilgi desenleri (ev yolu, e-posta, ad) hiç geçmiyor.
"""
import json, re, hashlib, unicodedata
from datetime import datetime, timezone
from pathlib import Path

try:
    import akis                  # _git, YASAK, DEPO, DAL, KULLANICI…
except ImportError:
    # BULUT KOPYASI. Bu dosya `bekci` dalına `bilgi-kaynak/kur.py` olarak da
    # gidiyor ve orada Mac'in hiçbir dosyası yok. O hâlde yalnızca paket kurma
    # ve gizlilik sınaması yapılıyor; yayın (git) işi çağıranın.
    akis = None

# Yayınlanan her metinde aranan GENEL desenler. Burada kişiye özel hiçbir
# değer YOK ve olamaz: bu dosyanın kendisi herkese açık dalda duruyor, oraya
# "şu ad, şu şehir" yazmak tam da engellemeye çalıştığı şeyi yapardı.
#
# Kişiye özel değerler (ad, memleket, otel adları) yalnızca Mac'teki
# `akis.YASAK` içinde duruyor ve Mac koştuğunda ek olarak taranıyor.
KISISEL_GENEL = [
    re.compile(r"/Users/[A-Za-z0-9_.-]+"),
    re.compile(r"/home/[A-Za-z0-9_.-]+"),
    re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b"),
    re.compile(r"ghp_|github_pat_|sk-[A-Za-z0-9_-]{20,}|Bearer\s"),
    re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b"),
    re.compile(r"\b[A-Za-z0-9-]+\.local\b"),
    re.compile(r"\+\d{11,}"),
]

BEKCI = Path.home() / "gerok" / "bekci"
RAPOR = BEKCI / "rapor"
PAKET_ADI = "bilgi.json"
KAYNAK_KLASOR = "bilgi-kaynak"

# Kaynak dosyalar `bekci` DALINDA duruyor, Mac'te değil.
#
# Sebebi: rehber içeriği bilerek kişisel değil ve Mac'e muhtaç olmaması
# gerekiyor — MacBook kapalıyken de büyüyebilmeli. Dalda durunca hem buradaki
# bekçi hem buluttaki bir Claude oturumu aynı dosyaları düzenleyebiliyor ve
# tek bir doğru nüsha kalıyor.
#
# Mac'in çalışma kopyası akış yayınıyla ortak: bekci/akis-kopya.

# Rota paketinin bulunduğu YEREL yer. Bu dosya asla yayınlanmıyor; yalnızca
# "hangi durağın kartı eksik" sorusunu cevaplamak için okunuyor.
ROTA = Path.home() / "gerok" / "belge" / "balkanlar.gerok"

# Pakette bulunmasına izin verilen alanlar. Beyaz liste: yeni bir alan
# eklenirse buraya da yazılmadıkça dışarı çıkamıyor.
YER_ALANLARI = {"id", "ad", "ulke", "lat", "lon", "yaricap", "eslesme", "ozet",
                "neden", "tarih", "gez", "ye", "al", "gezgin", "dikkat",
                "turkiye", "terim"}
# Rotayı ele verebilecek alanlar. Biri görülürse yayın durur.
YASAK_ALAN = {"gun", "sira", "gunler", "iz", "konaklama", "otel", "tarih_gezi",
              "ziyaret", "gidildi", "kacirildi", "unutma"}


# ------------------------------------------------------------------ kurma --

def _kopya(taze=True):
    """Dalın çalışma kopyası. Ağ yoksa diskteki son hâliyle devam ediyor.

    AKIŞTAN AYRI BİR KOPYA. İkisi aynı klasörü kullanırken şöyle bir tuzak
    vardı: akış her saat başı `reset --hard` çekiyor, kaynak dosyalar üstünde
    yarım kalmış bir düzenleme varsa onu haber vermeden siliyordu. Ayrı kopya
    bu bağı tamamen kesiyor; ikisi yalnızca uzak dalda buluşuyor.
    """
    kopya = BEKCI / "bilgi-kopya"
    if not (kopya / ".git").exists():
        kopya.mkdir(exist_ok=True)
        akis._git(kopya, ["init", "-q"])
        akis._git(kopya, ["remote", "add", "origin", akis.DEPO])
        kod, _ = akis._git(kopya, ["fetch", "-q", "--depth", "1", "origin", akis.DAL])
        akis._git(kopya, ["checkout", "-q", "-B", akis.DAL,
                          "FETCH_HEAD" if kod == 0 else "--orphan"])
    elif taze:
        kod, _ = akis._git(kopya, ["fetch", "-q", "--depth", "1", "origin", akis.DAL])
        if kod == 0:
            akis._git(kopya, ["reset", "-q", "--hard", "FETCH_HEAD"])
    return kopya


def kaynak_yolu(taze=True):
    """Kaynak dosyaların bulunduğu klasör.

    İki yer olabiliyor ve ayırt etmesi kolay: bulutta bu betik zaten
    `bilgi-kaynak/` içinde duruyor, yani kaynaklar YANINDA. Mac'te betik
    `bekci/` içinde, kaynaklar ise dalın çalışma kopyasında.
    """
    yanim = Path(__file__).resolve().parent
    if (yanim / "yerler.json").exists():
        return yanim
    return _kopya(taze) / KAYNAK_KLASOR


def _oku(ad, taze=True):
    return json.loads((kaynak_yolu(taze) / ad).read_text(encoding="utf-8"))


def paket_uret():
    """Kaynak dosyaları tek pakete katıyor."""
    yerler = _oku("yerler.json")            # ilk okuma dalı tazeliyor
    ulkeler = _oku("ulkeler.json", taze=False)
    sozluk = _oku("sozluk.json", taze=False)

    temiz = []
    for y in yerler:
        fazla = set(y) - YER_ALANLARI
        if fazla:
            raise ValueError(f"{y.get('id')}: tanınmayan alan {sorted(fazla)}")
        temiz.append({k: y[k] for k in YER_ALANLARI if k in y})

    govde = {"yerler": temiz, "ulkeler": ulkeler, "sozluk": sozluk,
             "bolge": _bolge(temiz)}
    ozet = hashlib.sha256(
        json.dumps(govde, ensure_ascii=False, sort_keys=True).encode()).hexdigest()[:16]
    return {
        "bicim": 1,
        "surum": ozet,
        "zaman": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "sayilar": {"yer": len(temiz), "ulke": len(ulkeler), "terim": len(sozluk)},
        **govde,
    }


# -------------------------------------------------------------- eşleştirme -

def _sade(m):
    """Türkçe duyarlı sadeleştirme: eşleştirme büyük harfe ve eke takılmasın.

    Harfler tek tek karşılanıyor. NFKD ile ayırmak yetmiyordu: ı ve đ
    ayrışmıyor, silinip boşluk oluyor ve "çarşısı" → "cars s" gibi bir şeye
    dönüşüyordu. Kural `bilgi.js`deki `sade` ile birebir aynı.
    """
    HARF = str.maketrans({
        "ı": "i", "ğ": "g", "ü": "u", "ş": "s", "ö": "o", "ç": "c",
        "â": "a", "î": "i", "û": "u", "đ": "d", "ć": "c", "č": "c",
        "ž": "z", "š": "s", "ë": "e", "á": "a", "é": "e",
    })
    m = str(m or "").replace("İ", "i").replace("I", "ı").lower().translate(HARF)
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]+", " ", m)).strip()


def _uzaklik(a_lat, a_lon, b_lat, b_lon):
    """Metre. Balkan enlemlerinde düz yaklaşım yeterli."""
    from math import cos, radians, hypot
    return hypot((a_lat - b_lat) * 111320,
                 (a_lon - b_lon) * 111320 * cos(radians(a_lat))) 


def kart_bul(durak, yerler):
    """Bir durağa en uygun kart. Önce ad, sonra yakınlık.

    Uygulamadaki `bilgi.js` ile AYNI kuralı uyguluyor; ikisi ayrılırsa
    Mac 'kapsandı' derken telefon 'bilgi yok' gösterir.
    """
    ad = _sade(durak.get("ad"))
    en_iyi, en_iyi_puan = None, 0
    for y in yerler:
        adlar = [_sade(y["ad"])] + [_sade(e) for e in y.get("eslesme", [])]
        puan = 0
        for a in adlar:
            if not a:
                continue
            # Uzun eşleşme daha belirgindir: "İskender Bey Meydanı, Tiran"
            # hem "tiran" hem "iskender bey" kartına uyuyor; kazanan uzun olan
            # olmalı, yoksa meydanın kartı yerine bütün şehrin kartı açılır.
            if a == ad:
                puan = max(puan, 100 + len(a))
            elif a in ad or ad in a:
                puan = max(puan, 70 + len(a) / 2)
        u = _uzaklik(durak["lat"], durak["lon"], y["lat"], y["lon"])
        if u <= y.get("yaricap", 5000):
            puan = max(puan, 60 - u / 1000)
        # Eşitlikte dar yarıçap kazanıyor — dar olan daha belirgin yerdir.
        if puan > en_iyi_puan or (puan == en_iyi_puan and en_iyi
                                  and y.get("yaricap", 5000) < en_iyi.get("yaricap", 5000)):
            en_iyi, en_iyi_puan = y, puan
    return (en_iyi, en_iyi_puan) if en_iyi_puan >= 40 else (None, 0)


# BÖLGE KUTUSU — "bilmiyorum" ile "benim işim değil" ayrımı.
#
# Bu rehber altı Balkan ülkesini anlatıyor. Ev, işyeri ya da Türkiye içindeki
# bir havaalanı ise bir EKSİK DEĞİL, kapsam dışı. Ayrım önemli çünkü:
#   · bekçi her açılışta "şunları bilmiyorum" diye aynı yerleri sayıp duruyordu,
#   · ve o listenin cevabı "kart yaz" olamaz: ev koordinatı herkese açık bir
#     dala yazılamaz, tek bir Türkiye kaydı da paketi "işte rotanın başladığı
#     yer" diye ele verirdi.
# Kutu paketteki yerlerden HESAPLANIYOR; elle tutulan bir liste yok, yeni ülke
# eklenince kendiliğinden genişliyor.
PAY = 0.8                                   # ~85 km tampon


def _bolge(yerler):
    if not yerler:
        return None
    la = [y["lat"] for y in yerler]
    lo = [y["lon"] for y in yerler]
    return {"guney": round(min(la) - PAY, 3), "kuzey": round(max(la) + PAY, 3),
            "bati": round(min(lo) - PAY, 3), "dogu": round(max(lo) + PAY, 3)}


def bolge_ici(durak, paket):
    """Bu durak rehberin anlattığı bölgede mi? Kural `bilgi.js` ile aynı."""
    b = (paket or {}).get("bolge")
    if not b:
        return True                         # kutu yoksa kimseyi dışarı atma
    return (b["guney"] <= durak["lat"] <= b["kuzey"]
            and b["bati"] <= durak["lon"] <= b["dogu"])


def kapsam(paket=None):
    """Rotadaki her durak için kart var mı?

    Dönüş: (kapsanan, eksik, disarida). `disarida` bir kusur değil — rehberin
    bölgesi dışındaki duraklar oraya düşüyor ve eksik sayılmıyor.
    """
    if paket is None:
        paket = paket_uret()
    if not ROTA.exists():
        return [], [], []
    duraklar = json.loads(ROTA.read_text(encoding="utf-8")).get("duraklar", [])
    kapsanan, eksik, disarida = [], [], []
    for d in duraklar:
        kart, _ = kart_bul(d, paket["yerler"])
        kayit = {"ad": d["ad"], "ulke": d.get("ulke"),
                 "lat": d["lat"], "lon": d["lon"],
                 "kart": kart["id"] if kart else None}
        if kart:
            kapsanan.append(kayit)
        elif bolge_ici(d, paket):
            eksik.append(kayit)
        else:
            disarida.append(kayit)
    return kapsanan, eksik, disarida


# ---------------------------------------------------------------- gizlilik -

def gizlilik_dene(paket):
    """Yayından önceki son kapı. Dönüş: bulgu listesi (boşsa temiz)."""
    bulgu = []
    metin = json.dumps(paket, ensure_ascii=False)

    desenler = list(KISISEL_GENEL)
    if akis is not None:
        desenler += akis.YASAK          # kişiye özel değerler, yalnızca Mac'te
    for d in desenler:
        if d.search(metin):
            bulgu.append(f"kişisel desen: {d.pattern[:50]}")

    for y in paket["yerler"]:
        kotu = set(y) & YASAK_ALAN
        if kotu:
            bulgu.append(f"{y['id']}: rotayı ele verebilecek alan {sorted(kotu)}")

    # ROTASIZ TABAN. Bulutta koşan bir Claude oturumunda rota dosyası YOK —
    # oradaki paket "rotaya göre yeterince geniş mi" diye sınanamaz. O yüzden
    # rotadan bağımsız bir alt sınır var: liste her hâlükârda bir BÖLGE
    # rehberi büyüklüğünde kalmalı, yoksa dar bir liste rotaya benzemeye
    # başlar. Mac'te ayrıca aşağıdaki rotaya göreli kural da koşuyor.
    if len(paket["yerler"]) < 40:
        bulgu.append(f"paket çok dar: {len(paket['yerler'])} kart, en az 40 olmalı")
    from collections import Counter
    ulke_sayim = Counter(y["ulke"] for y in paket["yerler"])
    for u, n in ulke_sayim.items():
        if n < 5:
            bulgu.append(f"{u}: yalnızca {n} kart — bir ülke en az 5 yerle temsil edilmeli")

    # Liste rotanın kopyası olmasın: hem toplamda hem HER ÜLKEDE fazlalık ara.
    if ROTA.exists():
        rota = json.loads(ROTA.read_text(encoding="utf-8")).get("duraklar", [])
        kapsanan, _, _ = kapsam(paket)
        eslesen = {k["kart"] for k in kapsanan if k["kart"]}
        if len(paket["yerler"]) < len(rota) * 1.6:
            bulgu.append(f"paket rotaya fazla yakın: {len(paket['yerler'])} kart, "
                         f"{len(rota)} durak — en az {int(len(rota) * 1.6)} kart gerekli")
        for u in {y["ulke"] for y in paket["yerler"]}:
            fazla = [y for y in paket["yerler"] if y["ulke"] == u and y["id"] not in eslesen]
            if not fazla:
                bulgu.append(f"{u}: rotada olmayan tek bir yer bile yok — "
                             f"bu ülkenin listesi rotayı ele veriyor")
    return bulgu


# ------------------------------------------------------------------ yayın --

def yayinla(paket=None, kuru=False):
    if akis is None:
        return False, "bu kopyada yayın yok — paketi kur, git işini çağıran yapsın"
    if paket is None:
        paket = paket_uret()

    bulgu = gizlilik_dene(paket)
    if bulgu:
        return False, "YAYINLANMADI — " + " · ".join(bulgu[:3])

    metin = json.dumps(paket, ensure_ascii=False, indent=1)
    RAPOR.mkdir(exist_ok=True)
    (RAPOR / PAKET_ADI).write_text(metin)
    if kuru:
        return True, f"kuru koşu — {len(metin)} bayt, {paket['sayilar']['yer']} yer, taramadan geçti"

    # Kaynak zaten dalda; yerel düzenlemeler kaybolmasın diye tazelemiyoruz.
    kopya = _kopya(taze=False)
    # Uzakta yeni bir şey varsa (akış az önce ittiyse ya da bulutta bir
    # oturum kaynağı düzenlediyse) önce onun üstüne biniyoruz. Kaynak
    # dosyalarda yerel değişiklik varsa DOKUNMUYORUZ — onlar asıl iş.
    kod, durum = akis._git(kopya, ["status", "--porcelain"])
    if not durum.strip():
        kod, _ = akis._git(kopya, ["fetch", "-q", "--depth", "1", "origin", akis.DAL])
        if kod == 0:
            akis._git(kopya, ["reset", "-q", "--hard", "FETCH_HEAD"])

    # Kurucunun kendisi de dalda duruyor: buluttaki bir Claude oturumu
    # Mac'e hiç dokunmadan paketi kurup aynı gizlilik sınamalarından
    # geçirebilsin diye. İki nüsha ayrışmasın diye her yayında kopyalanıyor
    # ve bir kontrol ikisini karşılaştırıyor.
    (kopya / KAYNAK_KLASOR).mkdir(exist_ok=True)
    (kopya / KAYNAK_KLASOR / "kur.py").write_text(
        Path(__file__).read_text(encoding="utf-8"), encoding="utf-8")

    yol = kopya / PAKET_ADI
    kod, durum = akis._git(kopya, ["status", "--porcelain"])
    if yol.exists() and yol.read_text() == metin and not durum.strip():
        return True, "değişmedi"
    yol.write_text(metin)
    akis._git(kopya, ["add", "-A"])
    akis._git(kopya, ["-c", f"user.name={akis.KULLANICI}", "-c", f"user.email={akis.POSTA}",
                      "commit", "-q", "-m", f"bilgi paketi {paket['surum']}"])
    kod, cikti = akis._git(kopya, ["push", "-q", "origin", f"HEAD:{akis.DAL}"])
    if kod != 0:
        # Aynı dala akış da yazıyor; arada kalırsak itme reddediliyor.
        # Bir kez yeniden deniyoruz: uzağın üstüne bin, paketi tekrar yaz.
        # Paket kaynaktan üretildiği için bu kayıpsız bir işlem.
        akis._git(kopya, ["fetch", "-q", "--depth", "1", "origin", akis.DAL])
        akis._git(kopya, ["reset", "-q", "--hard", "FETCH_HEAD"])
        (kopya / KAYNAK_KLASOR).mkdir(exist_ok=True)
        (kopya / KAYNAK_KLASOR / "kur.py").write_text(
            Path(__file__).read_text(encoding="utf-8"), encoding="utf-8")
        yol.write_text(metin)
        akis._git(kopya, ["add", "-A"])
        akis._git(kopya, ["-c", f"user.name={akis.KULLANICI}", "-c", f"user.email={akis.POSTA}",
                          "commit", "-q", "-m", f"bilgi paketi {paket['surum']}"])
        kod, cikti = akis._git(kopya, ["push", "-q", "origin", f"HEAD:{akis.DAL}"])
    return kod == 0, ("itildi" if kod == 0 else cikti[-160:])


# Modül seviyesinde akis'e dokunmuyoruz: bulut kopyasında yok.
ADRES = ("https://raw.githubusercontent.com/"
         f"{akis.KULLANICI if akis else 'marmarok'}/gerok/"
         f"{akis.DAL if akis else 'bekci'}/{PAKET_ADI}")


if __name__ == "__main__":
    import sys

    if "--kur" in sys.argv:
        # BULUT KİPİ: kaynaktan paketi kur, gizlilikten geçir, dosyaya yaz.
        # Git işi yok — çağıran commit'liyor. Bulgu varsa 1 ile çıkıyor ki
        # bir sonraki adım (commit) hiç çalışmasın.
        try:
            p = paket_uret()
        except Exception as h:
            # Bulutta bunu okuyan bir Claude oturumu; yığın izi değil, ne
            # yapması gerektiğini söyleyen bir cümle görmeli.
            print(f"KAYNAK HATALI: {h}")
            print("Beyaz liste dışında alan ekleme; izin verilenler: "
                  + ", ".join(sorted(YER_ALANLARI)))
            sys.exit(1)
        b = gizlilik_dene(p)
        hedef = Path(sys.argv[sys.argv.index("--kur") + 1]) \
            if len(sys.argv) > sys.argv.index("--kur") + 1 \
            and not sys.argv[sys.argv.index("--kur") + 1].startswith("-") \
            else Path(PAKET_ADI)
        if b:
            print("GİZLİLİK DURDURDU:")
            for x in b:
                print("  -", x)
            sys.exit(1)
        hedef.write_text(json.dumps(p, ensure_ascii=False, indent=1), encoding="utf-8")
        print(f"kuruldu: {hedef} · {p['sayilar']['yer']} yer · "
              f"{p['sayilar']['ulke']} ülke · {p['sayilar']['terim']} terim · sürüm {p['surum']}")
        sys.exit(0)

    p = paket_uret()
    kapsanan, eksik, disarida = kapsam(p)
    print(f"paket: {p['sayilar']['yer']} yer · {p['sayilar']['ulke']} ülke · "
          f"{p['sayilar']['terim']} terim · sürüm {p['surum']}")
    print(f"kapsam: {len(kapsanan)} durak kapsandı, {len(eksik)} eksik")
    for e in eksik:
        print(f"  EKSİK  {e['ad']}  ({e['ulke']}  {e['lat']:.4f},{e['lon']:.4f})")
    b = gizlilik_dene(p)
    print("gizlilik:", "temiz" if not b else " · ".join(b))
    if "--yayinla" in sys.argv:
        print(yayinla(p, kuru="--kuru" in sys.argv))
