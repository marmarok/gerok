// Gerok — Kurmancî.
//
// Anahtar: Türkçe kaynak metnin kendisi. {0}, {1} değişkenlerin yeri;
// Kurmancîde sözcük sırası farklı olduğu için yerleri değişebiliyor.
//
// YAZIM KARARLARI
//
// · Yazı dili tercih edildi: türetilmiş karşılık varken Türkçe/Arapça
//   ödünç sözcük kullanılmadı. "Arı Kurmancî" kararı 29 Ağustos 2026.
// · Ay adları Çile–Berfanbar takımı (bkz. js/dil.js), Rêbendan–Reşemî
//   takımı değil: Türkiye'de yazılan Kurmancîde yerleşmiş olan bu.
// · Hitap "tu" — Türkçesi de senli benli, arada fark olmasın.
// · iPhone'un kendi düğme adları ÇEVRİLMEDİ: telefonun dili Türkçe
//   olduğu için "Ayarlar → Safari → Konum" olduğu gibi bırakıldı.
//   Ekranda ne yazıyorsa metinde de o yazmalı, yoksa kullanıcı aradığını
//   bulamıyor.
// · Kurmancîde "ı" harfi yoktur; i ile î ayrı seslerdir. Türkçeden
//   çeviride en sık yapılan hata budur.

export const KU = {

  // ------------------------------------------------------------ ülkeler ---
  // Kürtçe Vikipedi'nin kullandığı adlar.
  'Sırbistan': 'Serbistan',
  'Bosna-Hersek': 'Bosniya û Herzegovîna',
  'Karadağ': 'Montenegro',
  'Arnavutluk': 'Albanya',
  'Kosova': 'Kosova',
  'K. Makedonya': 'Makedonyaya Bakur',
  'Kuzey Makedonya': 'Makedonyaya Bakur',
  'Hırvatistan': 'Xirwatistan',
  'Türkiye': 'Tirkiye',
  'Bulgaristan': 'Bulgaristan',
  'Yunanistan': 'Yewnanistan',

  // -------------------------------------------------------- gerok paketi ---
  'Dosya okunamadı — geçerli bir Gerok paketi değil.':
    'Pel nehate xwendin — ne pakêteke Gerokê ya derbasdar e.',
  'Bu dosya bir Gerok paketine benzemiyor.':
    'Ev pel naşibe pakêteke Gerokê.',
  'Adsız durak': 'Rawestgeha bênav',
  'Gün {0} · {1}': 'Roja {0} · {1}',
  'Gerok dışı': 'Derveyî Gerokê',

  // ----------------------------------------------------------------- iz ---
  'Konum izni verilmemiş. Ayarlar → Safari → Konum bölümünden izin ver.':
    'Destûra cih nehatiye dayîn. Ji Ayarlar → Safari → Konum destûrê bide.',
  'Konum alınamıyor. Açık havada birkaç saniye bekle.':
    'Cih nayê girtin. Li hewaya vekirî çend çirkeyan bisekine.',
  'Konum zaman aşımına uğradı.': 'Dema cihdîtinê derbas bû.',
  'Bu cihazda konum desteği yok.': 'Di vê amûrê de piştgiriya cih tune.',

  // ------------------------------------------------------------- harita ---
  'Harita için internet ya da indirilmiş bir alan gerekiyor.<br>':
    'Ji bo nexşeyê înternet an jî deverek daxistî divê.<br>',
  '<b>Gerok</b> sekmesinden <b>Harita alanı indir</b> ile gideceğin yeri seç — ':
    'Ji beşa <b>Gerok</b>, bi <b>Devera nexşeyê daxîne</b> cihê ku tê de diçî hilbijêre — ',
  'yolda internet olmayabilir.': 'dibe ku di rê de înternet tune be.',
  'çevrimdışı pmtiles': 'pmtiles a bêînternet',
  'İnternet yok — harita alanı internetliyken indirilir.':
    'Înternet tune — devera nexşeyê bi înternetê tê daxistin.',
  'Alan çok büyük ({0} karo). Daha küçük bir alan seç.':
    'Dever pir mezin e ({0} parçe). Deverek biçûktir hilbijêre.',

  // --------------------------------------------- rehber (tanıtım turu) ---
  'Gerok’a hoş geldin': 'Bi xêr hatî Gerokê',
  'Bu bir gezi defteri. İnternetsiz çalışır — yurtdışında şebeke yokken de yazar, ses kaydeder, haritayı gösterir. Sana en çok işe yarayacak üç şeyi göstereyim.':
    'Ev rojnivîska geştê ye. Bêînternet dixebite — li derveyî welat jî, gava tora telefonê tune be, dinivîse, deng tomar dike, nexşeyê nîşan dide. Bila ez sê tiştên ku wê herî zêde bi kêrî te bên nîşanî te bidim.',
  'Konuş, yazma': 'Biaxive, nenivîse',
  'Yolda yazmak zor, konuşmak kolay. Dokun, anlat, bitir. Kaydın saatiyle birlikte haritadaki yerine kendiliğinden oturur.':
    'Di rê de nivîsîn zehmet e, axaftin hêsan e. Bitikîne, bêje, biqedîne. Tomar bi saeta xwe re bi xwe li cihê xwe yê ser nexşeyê rûdine.',
  'Bir de sesi kaydet': 'Dengê wî cihî jî tomar bike',
  'Çarşı, yağmur, ezan, tren. Fotoğraf herkeste var, o yerin nasıl duyulduğu kimsede yok. Yıllar sonra en çok bu vuruyor.':
    'Sûk, baran, bang, trên. Wêne li ba her kesî heye, lê dengê wî cihî li ba tu kesî tune. Piştî salan yê ku herî zêde dikeve dilê mirov ev e.',
  'Haritayı yola çıkmadan indir': 'Nexşeyê berî ku bikevî rê daxîne',
  'İnternet varken harita her yerde çalışır. Ama yurtdışında şebeke yoksa yalnızca ÖNCEDEN indirdiğin alanlar açılır. Gerok → Harita alanı indir, şehri ekrana getir, indir. Bir şehir birkaç MB ve birkaç saniye.':
    'Gava înternet hebe nexşe li her derê dixebite. Lê li derveyî welat, gava tor tune be, tenê deverên ku te BERÊ daxistine vedibin. Gerok → Devera nexşeyê daxîne, bajêr bîne ser ekranê, daxîne. Bajarek çend MB e û çend çirke ye.',
  'Yol Modu ve gidilen iz': 'Moda Rê û şopa rê',
  'Gittiğin yol ancak uygulama AÇIKKEN kaydedilir — telefon kilitliyken iOS buna izin vermiyor. Araçta telefonu şarja takıp Yol Modu’nu aç: ekran açık kalır, durağa yaklaşınca uyarır.':
    'Riya ku tu diçî tenê gava sepan VEKIRÎ be tê tomarkirin — gava telefon kilît be iOS destûrê nade. Di erebeyê de telefonê bixe şarjê û Moda Rê veke: ekran vekirî dimîne, gava nêzîkî rawestgehê bibî te hişyar dike.',
  'Akşamları buraya uğra': 'Êvaran li vir binêre',
  'Gün Sonu bütün günü 90 saniyede toparlar ve yedeğini alır. Bir şey ters giderse ya da bir fikrin olursa, aynı ekrandaki “Gerok’u yapana yaz” ile doğrudan bana ulaşırsın.':
    'Dawiya Rojê hemû rojê di 90 çirkeyan de berhev dike û kopiya wê ya ewle digire. Heke tiştek şaş biçe an jî ramanek te hebe, li heman ekranê bi “Ji yê ku Gerok çêkiriye re binivîse” rasterast digihîjî min.',
  'Geç': 'Derbas bike',
  'İleri': 'Pêş',
  'Başla': 'Dest pê bike',

  // ----------------------------------------- index.html — sabit arayüz ---
  'açılıyor…': 'vedibe…',
  'kapalı': 'girtî',
  'Zaman': 'Dem',
  'Harita': 'Nexşe',
  'Kayıt': 'Tomar',
  'Duraklar': 'Rawestgeh',
  'Süzgeç': 'Parzûn',
  'Süzgeçler': 'Parzûn',
  'kayıtlarda ara': 'di tomaran de bigere',
  'İşaretlediklerin': 'Yên te nîşankirî',
  'İz kaydı': 'Tomara şopê',
  'Gündüz': 'Roj',
  'Gece': 'Şev',
  'Uydu': 'Peyk',
  '© OpenStreetMap · çevrimdışı pmtiles': '© OpenStreetMap · pmtiles a bêînternet',
  'Haritayı kaydır — durak ortadaki artının olduğu yere konacak.':
    'Nexşeyê bikişîne — rawestgeh wê li cihê xaça navîn were danîn.',
  'Vazgeç': 'Betal bike',
  'Buraya durak ekle': 'Li vir rawestgehekê zêde bike',
  'Haritayı kaydır ve yakınlaştır —': 'Nexşeyê bikişîne û nêzîk bike —',
  'ekranda gördüğün alan': 'devera ku li ser ekranê dibînî',
  'inecek.': 'wê were daxistin.',
  'hesaplanıyor…': 'tê hesibandin…',
  'Sokak': 'Kolan',
  'Bu alanı indir': 'Vê deverê daxîne',
  'Yer ara — Struga, Kotor, Prizren…': 'Li cih bigere — Struga, Kotor, Prizren…',
  'Kapat': 'Bigire',
  'Yer ara': 'Li cih bigere',
  'Durak ekle': 'Rawestgeh zêde bike',
  'Konumuma git': 'Here cihê min',
  'Tüm rotayı göster': 'Hemû rê nîşan bide',
  'Google Haritalar\'da aç': 'Di Nexşeyên Google de veke',
  'Sesli not': 'Nota dengî',
  'Dokun ve konuş · bitince Durdur\'a bas':
    'Bitikîne û biaxive · gava qediya Biqedîne bitikîne',
  'Ortam sesi': 'Dengê derdorê',
  'Süresini sen seç · konuşma, sadece dinlet':
    'Dema wê tu hilbijêre · neaxive, tenê bide guhdarkirin',
  'Yazı': 'Nivîs',
  'Burayı işaretle': 'Li vir nîşan bike',
  'Tanıştık': 'Em hev nas kirin',
  'Harcama': 'Xerc',
  'Fotoğraf ekle': 'Wêne zêde bike',
  'Yol Modu': 'Moda Rê',
  'Ekran açık kalır, durağa yaklaşınca uyarır':
    'Ekran vekirî dimîne, gava nêzîkî rawestgehê bibî hişyar dike',
  'Durdur': 'Rawestîne',
  'Kaydediliyor…': 'Tê tomarkirin…',
  '■ Durdur ve kaydet': '■ Biqedîne û tomar bike',
  '⏸ Duraklat': '⏸ Bisekinîne',
  'Dil': 'Ziman',
  'Renk': 'Reng',

  // ------------------------------------------- gezi bilgisi (bilgi.js) ---
  'Ne görülür': 'Çi tê dîtin',
  'Ne yenir': 'Çi tê xwarin',
  'Ne alınır': 'Çi tê kirîn',
  'Gezginler ne diyor': 'Geştiyar çi dibêjin',
  'Dikkat': 'Hay ji xwe hebe',
  'Tarihi': 'Dîroka wê',
  'Türkiye’ye göre': 'Li gorî Tirkiyeyê',
  'Para': 'Pere',
  'Birkaç kelime': 'Çend peyv',
  'Ne kaça': 'Bi çiqasî ye',
  'Tuvalet': 'Avdestxane',
  'İnternet': 'Înternet',

  // ----------------------------------- program sihirbazı (sihirbaz.js) ---
  'Hangi dosyayı okuyayım?': 'Ez kîjan pelî bixwînim?',
  'Satırları parmakla işaretle': 'Rêzikan bi tiliya xwe nîşan bike',
  'Günler doğru mu?': 'Roj rast in?',
  'Hangi duraklar alınsın?': 'Kîjan rawestgeh werin girtin?',
  'Paket hazır': 'Pakêt amade ye',
  'Yeni gezi olarak aç': 'Wek geşteke nû veke',
  'Dosyada durak yok. Gezi yine de açılır; durakları haritadan elle koyabilirsin.':
    'Di pelî de rawestgeh tune. Geşt dîsa jî vedibe; tu dikarî rawestgehan bi destê xwe ji nexşeyê deynî.',
  '{0}. gün': 'roja {0}an',
  'Programda durağa bağlı not yok.': 'Di bernameyê de nota bi rawestgehê ve girêdayî tune.',
  'Önce bir dosya seç': 'Pêşî pelekî hilbijêre',
  'Bu PDF’in içinde yazı yok — sayfalar taranmış resim olabilir. Metni kopyalayıp düz metin olarak verebilirsin.':
    'Di vê PDFê de nivîs tune — dibe ku rûpel bi tenê wêne bin. Tu dikarî nivîsê kopî bikî û wek nivîsa sade bidî.',
  'PDF okunamadı: {0}': 'PDF nehate xwendin: {0}',
  'Yeni gezi açıldı · {0}': 'Geşteke nû vebû · {0}',
  'Alınamadı: {0}': 'Nehate girtin: {0}',

  // ----------------------------------- eşitleme ve yedek (esitleme.js) ---
  'Bu dosya bir Gerok paketi değil.': 'Ev pel ne pakêteke Gerokê ye.',
  'Paket hazırlanıyor…': 'Pakêt tê amadekirin…',
  'Paket hazırlanıyor… {0}/{1}': 'Pakêt tê amadekirin… {0}/{1}',
  'Gönderildi. Karşı taraf "Gelen paketi al" desin.':
    'Hate şandin. Bila aliyê hember "Pakêta hatî bigire" bibêje.',
  'Gün paketi hazır · arkadaşın yakınken AirDrop ile gidecek':
    'Pakêta rojê amade ye · gava hevalê te nêzîk be wê bi AirDropê here',
  'Bu dosya yarım — gönderen yeniden göndersin.':
    'Ev pel nîvcî ye — bila yê ku şandiye ji nû ve bişîne.',
  'Dosyalar alınıyor… %{0}': 'Pel tên girtin… %{0}',
  '{0} kayıt da silinmiş, burada da silindi.':
    '{0} tomar jî hatibûn jêbirin, li vir jî hatin jêbirin.',
  '{0} kayıtta iki sürüm vardı — seninki tutuldu, diğeri kaydın içinde duruyor.':
    'Di {0} tomaran de du guherto hebûn — ya te hate hiştin, ya din di nav tomarê de dimîne.',
  '{0} yeni durak rotaya eklendi.': '{0} rawestgehên nû li rê hatin zêdekirin.',
  '{0} durak notu geldi.': '{0} notên rawestgehê hatin.',
  'Bu paket "{0}" turuna ait — Gerok → Turları yönet\'ten o tura geçebilirsin.':
    'Ev pakêt aîdî geşta "{0}" e — ji Gerok → Geştan bi rê ve bibe tu dikarî derbasî wê geştê bibî.',
  'Arkadaşın': 'Hevalê te',
  '{0} eklendi: {1} kayıt, {2} iz noktası.': '{0} hate zêdekirin: {1} tomar, {2} xalên şopê.',
  'Bu paket zaten alınmış — hiçbir şey yinelenmedi.':
    'Ev pakêt berê hatiye girtin — tu tişt dubare nebû.',
  'Yedek hazırlanıyor…': 'Kopiya ewle tê amadekirin…',
  'Yedek hazırlanıyor… {0}/{1}': 'Kopiya ewle tê amadekirin… {0}/{1}',
  'Yedek kaydedildi. "Dosyalar\'a Kaydet" seçtiysen iCloud\'a da gider.':
    'Kopiya ewle hate tomarkirin. Ger te "Dosyalar\'a Kaydet" hilbijartibe wê here iCloudê jî.',
  'Yedek alınamadı: {0}': 'Kopiya ewle nehate girtin: {0}',
  'Bu bir Gerok yedeği değil ya da dosya yarım.':
    'Ev ne kopiyeke ewle ya Gerokê ye an jî pel nîvcî ye.',
  'Bu bir Gerok yedeği değil.': 'Ev ne kopiyeke ewle ya Gerokê ye.',
  'Yedek okunamadı: {0}': 'Kopiya ewle nehate xwendin: {0}',
  'Bulut yedeği hazırlanıyor…': 'Kopiya ewle ya ewrê tê amadekirin…',
  'Yüklendi · “Dosyalar’a Kaydet” ya da Drive seçtiysen bulutta':
    'Hate barkirin · ger te “Dosyalar’a Kaydet” an jî Drive hilbijartibe li ewrê ye',
  'Bu dosya yarım — yazma tamamlanmamış.': 'Ev pel nîvcî ye — nivîsandin neqediyaye.',
  'Bu dosya bir Gerok yedeği değil.': 'Ev pel ne kopiyeke ewle ya Gerokê ye.',
  'Bu dosyada kayıt yok — hiçbir şey değiştirilmedi.':
    'Di vî pelî de tomar tune — tu tişt nehate guhertin.',
  'Vazgeçildi — hiçbir şey değişmedi.': 'Hate betalkirin — tu tişt neguherî.',
  'Dosyalar yazılıyor… %{0}': 'Pel tên nivîsandin… %{0}',
  'Geri yüklendi · {0} kayıt · {1} fazla kayıt silindi':
    'Hate vegerandin · {0} tomar · {1} tomarên zêde hatin jêbirin',
  ' · {0} silinmiş kayıt geri geldi': ' · {0} tomarên jêbirî vegeriyan',
  '{0} yeni kayıt': '{0} tomarên nû',
  '{0} sesin yazısı': 'nivîsa {0} dengan',
  '{0} iz noktası': '{0} xalên şopê',
  'Birleştirildi · {0} eklendi': 'Hate yekkirin · {0} hate zêdekirin',
  'Paket alındı · eklenecek yeni bir şey yoktu':
    'Pakêt hate girtin · tiştekî nû yê ku were zêdekirin tune bû',
  'Geri yüklenemedi: {0}': 'Nehate vegerandin: {0}',

  // ------------------------------------- bağlantı işleri (baglanti.js) ---
  'Bütün harcamaların kuru zaten yazılı.': 'Rêjeya diravî ya hemû xercan jixwe nivîsandî ye.',
  '{0} harcamanın kuru düzeldi': 'Rêjeya diravî ya {0} xercan hate rastkirin',
  ' · {0} tanesi çevrilemedi{1}': ' · {0} jê nehatin wergerandin{1}',
  'Kur listesi indirilemedi — internet yok ya da servise ulaşılamıyor. Sonra tekrar dene.':
    'Lîsteya rêjeyan nehate daxistin — înternet tune an jî nagihîje xizmetê. Paşê dîsa biceribîne.',
  'Hiçbiri çevrilemedi — şu para birimlerini tanımadım: {0}':
    'Yek jî nehate wergerandin — min ev yekeyên diravî nas nekirin: {0}',
  'Hiçbiri çevrilemedi — tutarlar okunamadı.':
    'Yek jî nehate wergerandin — hejmar nehatin xwendin.',
  'Konumu olan bütün kayıtların yer adı zaten yazılı.':
    'Navê cihê hemû tomarên bi cih jixwe nivîsandî ye.',
  '{0} kayda yer adı yazıldı': 'Navê cih li {0} tomaran hate nivîsandin',
  ' · {0} tanesi çözülemedi': ' · {0} jê nehatin çareserkirin',
  'Hiçbir yer adı çözülemedi — bağlantı zayıf olabilir, sonra tekrar dene':
    'Tu navê cih nehate çareserkirin — dibe ku girêdan qels be, paşê dîsa biceribîne',
  'manastır': 'keşîşxane',
  'ibadet yeri': 'cihê îbadetê',
  'müze': 'mûze',
  'galeri': 'galerî',
  'gezilecek yer': 'cihê gerê',
  'seyir noktası': 'xala temaşeyê',
  'kale': 'kelhe',
  'hisar': 'birc',
  'şehir kapısı': 'deriyê bajêr',
  'kalıntı': 'kavil',
  'antik yer': 'cihê kevnar',
  'anıt': 'peyker',
  'kilise': 'dêr',
  'cami': 'mizgeft',
  'şapel': 'dêrok',
  'türbe': 'tirb',
  'tiyatro': 'şano',
  'lokanta': 'xwaringeh',
  'kahve': 'qehwexane',
  'otel': 'otêl',
  'danışma': 'agahdarî',
  'eser': 'berhem',
  'iskele': 'bender',
  'kamp alanı': 'cihê kampê',
  'kaynak': 'kanî',
  'şelale': 'şirşir',
  'Bütün durakların bilgisi zaten getirilmiş.': 'Agahiya hemû rawestgehan jixwe hatiye anîn.',
  '{0} durak güncellendi': '{0} rawestgeh hatin rojanekirin',
  ' · {0} durak için kayıt yok': ' · ji bo {0} rawestgehan tomar tune',
  'Bu duraklar için OpenStreetMap\'te açılış/ücret bilgisi yok. Uydurmuyoruz.':
    'Ji bo van rawestgehan di OpenStreetMapê de agahiya vebûn/heqî tune. Em ji ber xwe ve nabêjin.',
  'Kurları düzelt': 'Rêjeyên diravî rast bike',
  '{0} harcama · her biri kendi günündeki kurla': '{0} xerc · her yek bi rêjeya roja xwe',
  'Konumsuz kayıtlara yer adı ver': 'Li tomarên bêcih navê cih binivîse',
  '{0} kayıt · koordinat var, ad yok': '{0} tomar · koordînat hene, nav tune',
  'Duraklara açılış ve ücret bilgisi': 'Ji bo rawestgehan agahiya vebûn û heqî',
  '{0} durak · saat, ücret, kapalı gün': '{0} rawestgeh · saet, heqî, roja girtî',
  'Rotanın önündeki haritayı indir': 'Nexşeya pêşiya rê daxîne',
  'Rotanın kalanı · wi-fi bekler': 'Ya mayî ya rê · li benda wi-fiyê ye',
  'Harita paketi': 'Pakêta nexşeyê',

  // -------------------------------- Gün Sonu ve Gezi Sonu (gunsonu.js) ---
  'Günün özeti': 'Kurteya rojê',
  'Bugün ne oldu, sayılarla.': 'Îro çi bû, bi hejmaran.',
  'km yol': 'km rê',
  'fotoğraf': 'wêne',
  'ses kaydı': 'tomara dengî',
  'toplam kayıt': 'hemû tomar',
  'Bugün geçtiğin sınır: {0}': 'Sînorê ku îro tê re derbas bûyî: {0}',
  'Buradaki hiçbir adım kayıt silmez, günü kapatmaz, hiçbir şeyi kesinleştirmez. İstediğin yerde çıkabilirsin; bugüne sonra da kayıt ekleyebilir, bu akışı tekrar açabilirsin.':
    'Li vir tu gav tomarekê jê nabe, rojê nagire, tu tiştî bi dawî nake. Tu li ku derê bixwazî dikarî derkevî; tu dikarî paşê jî li îro tomaran zêde bikî û vî herikînî ji nû ve vekî.',
  'Şimdi değil': 'Niha na',
  'Bugünden aklında ne kaldı?': 'Ji îro çi di bîra te de ma?',
  'Sesli günlük. Bir dakika yeter.': 'Rojnivîska dengî. Deqeyek bes e.',
  'Dokun ve konuş. Bitince "Durdur ve kaydet".':
    'Bitikîne û biaxive. Gava qediya "Biqedîne û tomar bike".',
  'Konuşmaya başla': 'Dest bi axaftinê bike',
  'Atla': 'Derbas bike',
  'Devam': 'Berdewam',
  'Geri': 'Paş',
  'Bitir': 'Biqedîne',
  'Bugünden aklında ne kaldı? Bitince "Durdur ve kaydet".':
    'Ji îro çi di bîra te de ma? Gava qediya "Biqedîne û tomar bike".',
  'Kaydedildi · {0} saniye. İstersen bir tane daha.':
    'Hate tomarkirin · {0} çirke. Ger bixwazî yek din jî.',
  'Çok kısaydı.': 'Pir kurt bû.',
  'Kaydedildi · {0} saniye.': 'Hate tomarkirin · {0} çirke.',
  'Bugünden fotoğraf ekle': 'Ji îro wêne zêde bike',
  'Galeriden seç, deftere eklensin. Manzara şart değil: oda, kahvaltı masası, otobüsün içi. Seçmediklerin galerinde olduğu gibi kalır — burada yapılan tek şey EKLEMEK.':
    'Ji galeriyê hilbijêre, bila li rojnivîskê were zêdekirin. Ne şert e ku dîmen be: ode, maseya taştê, hundirê otobusê. Yên ku te hilnebijartine wek xwe di galeriya te de dimînin — tiştê ku li vir tê kirin tenê ZÊDEKIRIN e.',
  'Galeriden seç': 'Ji galeriyê hilbijêre',
  '{0} eklendi': '{0} hatin zêdekirin',
  '. {0} tanesinin yeri bulunamadı — o saatlerde iz kapalıymış.':
    '. Cihê {0} ji wan nehate dîtin — wê demê şop girtî bûye.',
  ', hepsi haritaya yerleşti.': ', hemû li ser nexşeyê rûniştin.',
  ' {0} dosya alınamadı.': ' {0} pel nehatin girtin.',
  'Eklenemedi: {0}': 'Nehate zêdekirin: {0}',
  'Son iki adım': 'Du gavên dawî',
  'Yedek al, sonra günü arkadaşına gönder.':
    'Kopiya ewle bigire, paşê rojê ji hevalê xwe re bişîne.',
  'Son yedek {0} alındı.': 'Kopiya ewle ya dawî {0} hate girtin.',
  'az önce': 'hinekî berê',
  '{0} saat önce': '{0} saet berê',
  'Henüz hiç yedek alınmadı.': 'Hîn tu kopiya ewle nehatiye girtin.',
  'Yedek al': 'Kopiya ewle bigire',
  'Günümü arkadaşıma gönder': 'Roja min ji hevalê min re bişîne',
  'Bitti · bugünün kayıtları yerinde': 'Qediya · tomarên îro li cihê xwe ne',
  'Başlangıç kaydı': 'Tomara destpêkê',
  'Yola çıkmadan: kaç yaşındasın, hayatında ne var, bu geziden ne bekliyorsun? On yıl sonra anıları bir döneme oturtacak olan şey bu.':
    'Berî ku bikevî rê: tu çend salî yî, di jiyana te de çi heye, tu ji vê geştê çi hêvî dikî? Tiştê ku wê piştî deh salan bîranînan li serdemekê rûne ev e.',
  'Bitiş kaydı': 'Tomara dawiyê',
  'Ne oldu, ne değişti, ne beklemiyordun?': 'Çi bû, çi guherî, tu li benda çi nebûyî?',
  'Gezinin özeti': 'Kurteya geştê',
  'Sayılarla.': 'Bi hejmaran.',
  'gün': 'roj',
  'kayıt · {0} ses': 'tomar · {0} deng',
  'tanıştığın kişi': 'kesên ku te nas kirin',
  'Son sesli not. Hâlâ oradayken, dönüş yolunu beklerken: ne oldu, ne değişti, ne beklemiyordun?':
    'Nota dengî ya dawî. Hîn li wir î, li benda riya vegerê yî: çi bû, çi guherî, tu li benda çi nebûyî?',
  'Bitiş kaydı zaten alınmış. İstersen bir tane daha bırakabilirsin.':
    'Tomara dawiyê jixwe hatiye girtin. Ger bixwazî tu dikarî yek din jî bihêlî.',
  'Bitiş kaydını al': 'Tomara dawiyê bigire',
  'Bitiş kaydı · bitince "Durdur ve kaydet"':
    'Tomara dawiyê · gava qediya "Biqedîne û tomar bike"',
  'Bütün duraklara gidilmiş. Nadir olur.': 'Çûyîne hemû rawestgehan. Kêm caran dibe.',
  'Bu gezide durak listesi yok — kaçırılan bir şey de yok.':
    'Di vê geştê de lîsteya rawestgehan tune — tiştek jî ji dest neçûye.',
  'Gidilmeyen duraklar': 'Rawestgehên ku nehatine çûyîn',
  'Kaçırdıklarını bir yere yazalım — sonraki gezinin başlangıcı bu liste olur.':
    'Bila em yên ku te ji dest dane li cihekî binivîsin — destpêka geşta bê ev lîste be.',
  'günsüz': 'bêroj',
  '“Bir sonraki gezi” listesine yaz': 'Li lîsteya “geşta bê” binivîse',
  'Bir sonraki gezi — gidilmeyen duraklar:': 'Geşta bê — rawestgehên ku nehatine çûyîn:',
  '{0} durak zaman çizgisine yazıldı.': '{0} rawestgeh li xeta demê hatin nivîsandin.',
  'Kaçırdıkların “bir sonraki gezi” listesine yazıldı':
    'Yên ku te ji dest dane li lîsteya “geşta bê” hatin nivîsandin',
  'Mühürlü mektup': 'Nameya mohrkirî',
  'Kendine yaz, yıllar sonra açılsın. Şifre yok — o kadar yıl sonra kaybolacak tek şey parola olurdu. Kilit değil, söz.':
    'Ji xwe re binivîse, bila piştî salan veke. Şîfre tune — piştî ewqas salan tiştê ku wê winda bibe tenê şîfre bû. Ne kilît e, soz e.',
  'Yazılmış: {0}': 'Hatine nivîsandin: {0}',
  'Mektubu yaz': 'Nameyê binivîse',
  'Geziyi kapat': 'Geştê bigire',
  'Önce son yedeği al, sonra arşive geçir. Kayıtlar telefonda kalır, hiçbir yere gönderilmez.':
    'Pêşî kopiya ewle ya dawî bigire, paşê derbasî arşîvê bike. Tomar di telefonê de dimînin, li tu derê nayên şandin.',
  'Henüz hiç yedek alınmadı. Kapatmadan önce al.':
    'Hîn tu kopiya ewle nehatiye girtin. Berî ku bigirî bigire.',
  'Son yedeği al': 'Kopiya ewle ya dawî bigire',
  'Bütün geziyi arkadaşıma gönder': 'Tevahiya geştê ji hevalê min re bişîne',
  'Kapatınca gezi arşive geçer: yeni kayıt eklenmez, her şey okunur kalır. Gerok → gezi → Bütün geziler\'den geri açılabilir.':
    'Gava bigirî geşt derbasî arşîvê dibe: tomarên nû nayên zêdekirin, her tişt xwendinbar dimîne. Ji Gerok → geşt → Hemû geşt dikare ji nû ve were vekirin.',
  'Gezi kapandı · arşive geçti': 'Geşt hate girtin · derbasî arşîvê bû',
  'beş yıl sonra': 'piştî pênc salan',
  'on yıl sonra': 'piştî deh salan',
  'yirmi yıl sonra': 'piştî bîst salan',
  '{0} — o yıl 50 yaşına giriyorsun': '{0} — wê salê tu dikevî 50 saliya xwe',
  'doğum yılını sorar': 'sala jidayikbûnê dipirse',
  'Hangi yıla yazıyorsun?': 'Tu ji bo kîjan salê dinivîsî?',
  'O yıl gelene kadar mektup arşivde kapalı durur. Şifre yok — kilit değil, söz.':
    'Heta ku ew sal bê name di arşîvê de girtî dimîne. Şîfre tune — ne kilît e, soz e.',
  '50. yaşım': '50 saliya min',
  'Ya da bir yıl yaz': 'An jî salekê binivîse',
  'örn. {0}': 'mînak {0}',
  'Bu yıla yaz': 'Ji bo vê salê binivîse',
  '{0}{1} mektup': 'nameya sala {0}{1}',
  'Konuşarak ya da yazarak. İkisi de olur.': 'Bi axaftinê an bi nivîsandinê. Herdu jî dibin.',
  'Ya da yaz': 'An jî binivîse',
  'O gün bunu okuyan kişiye…': 'Ji kesê ku wê rojê vê dixwîne re…',
  'Mühürle': 'Mohr bike',
  'Yazıyı kaydet': 'Nivîsê tomar bike',
  '{0} · bitince "Durdur ve kaydet"': '{0} · gava qediya "Biqedîne û tomar bike"',
  'Mühürlendi.': 'Hate mohrkirin.',
  'Yazı kaydedildi.': 'Nivîs hate tomarkirin.',
  'Mühürlendi · {0} yılına': 'Hate mohrkirin · ji bo sala {0}an',

  // ------------------------------------------------------ uygulama — A ---
  ' ({0} kayıt)': ' ({0} tomar)',
  ' · doğrulandı{0}': ' · hate piştrastkirin{0}',
  ' · {0} zaten vardı': ' · {0} jixwe hebûn',
  '"{0}" turundasın.': 'Tu di geşta "{0}" de yî.',
  '"{0}" yüklendi · {1} gün, {2} durak': '"{0}" hate barkirin · {1} roj, {2} rawestgeh',
  '(yalnızca rapor)': '(tenê rapor)',
  ', durağa yaklaşınca sesle uyaracak': ', gava nêzîkî rawestgehê bibî wê bi deng hişyar bike',
  ', uyarı ekranda çıkacak (ses açılamadı)':
    ', hişyarî wê li ser ekranê derkeve (deng venebû)',
  '1 dakika': 'Deqeyek',
  '15 saniye': '15 çirke',
  '2 dakika': '2 deqe',
  '30 saniye': '30 çirke',
  '7 günlük': '7 rojî',
  '<b>Bu dosya yarım.</b> Yazma tamamlanmamış — kaydetme sırasında iptal edilmiş ya da yer bitmiş olabilir. Yeniden yedek al.':
    '<b>Ev pel nîvcî ye.</b> Nivîsandin neqediyaye — dibe ku di dema tomarkirinê de hatibe betalkirin an jî cih qediyabe. Ji nû ve kopiyeke ewle bigire.',
  '<b>Dikkat:</b> {0} kaydın sesi ya da görseli yedeğe girmemiş. Bu yedek eksik — yer açıp yeniden dene.':
    '<b>Hay ji xwe hebe:</b> dengê an wêneyê {0} tomaran neketiye kopiyê. Ev kopî kêm e — cih veke û ji nû ve biceribîne.',
  '<b>henüz gitmedi</b>': '<b>hîn neçûye</b>',
  '<b>hiç alan inmemiş</b>': '<b>tu dever nehatiye daxistin</b>',
  '<b>{0}</b> arşivde. {1} kayıt telefonunda duruyor — hiçbiri silinmedi.':
    '<b>{0}</b> di arşîvê de ye. {1} tomar di telefona te de ne — yek jî nehate jêbirin.',
  'Adı': 'Nav',
  'Adı değiştir': 'Navî biguhêre',
  'Adını değiştir': 'Navê wê biguhêre',
  'AirDrop · uzaktan': 'AirDrop · ji dûr',
  'AirDrop · yan yana': 'AirDrop · rex hev',
  'Aktif tur yok.': 'Geşta çalak tune.',
  'Alan indi ✓ · {0} · {1} karo': 'Dever daket ✓ · {0} · {1} parçe',
  'Alan iniyor… %{0} · {1}/{2} karo · {3}': 'Dever tê daxistin… %{0} · {1}/{2} parçe · {3}',
  'Alan silindi · {0} yer açıldı.': 'Dever hate jêbirin · {0} cih vebû.',
  'Alan çok büyük ({0} karo). Yakınlaş ya da ayrıntıyı "Yol" yap.':
    'Dever pir mezin e ({0} parçe). Nêzîk bibe an jî hûrgiliyê bike "Rê".',
  'Alan çok büyük — {0} karo. Yakınlaş.': 'Dever pir mezin e — {0} parçe. Nêzîk bibe.',
  'Alınamayan': 'Yên nehatî girtin',
  'Arkadaşının kayıtları': 'Tomarên hevalê te',
  'Arşivle': 'Arşîv bike',
  'Ayarlar → Gerok → Konum → Uygulamayı kullanırken':
    'Ayarlar → Gerok → Konum → Uygulamayı kullanırken',
  'Ayrıntılı kurulum: ': 'Sazkirina hûrgilî: ',
  'Açık': 'Vekirî',
  'Açık — ekran sönmeyecek': 'Vekirî — ekran wê venemire',
  'Açık — kapatmak için dokun': 'Vekirî — ji bo girtinê bitikîne',
  'Aşağı': 'Jêr',
  'Yukarı': 'Jor',
  'BUGÜN': 'ÎRO',
  'Bakılamadı ({0}). İnternet varken dene.':
    'Nehate nêrîn ({0}). Gava înternet hebe biceribîne.',
  'Bakılıyor…': 'Tê nêrîn…',
  'Bağlantı kopyalandı — yapıştırıp gönder.': 'Girêdan hate kopîkirin — bipelçiqîne û bişîne.',
  'Bağlıyken gün paketi uzaktan da gidebilir — yine dosya olarak, hesapsız.':
    'Gava girêdayî be pakêta rojê ji dûr jî dikare here — dîsa wek pel, bêhesab.',
  'Başka fotoğraf seç': 'Wêneyekî din hilbijêre',
  'Başlık silindi.': 'Sernav hate jêbirin.',
  'Başlık yaz': 'Sernavekî binivîse',
  'Başlık yazıldı.': 'Sernav hate nivîsandin.',
  'Bekleyen bir şey yok.': 'Tiştekî li benda tune.',
  'Bilgi': 'Agahî',
  'Bir kayda <b>çift dokun</b> — yıldız çıkar, kayıt buraya düşer.':
    'Li tomarekê <b>du caran bitikîne</b> — stêrk derdikeve, tomar tê vir.',
  'Bir şey ters giderse': 'Heke tiştek şaş biçe',
  'Bitince Durdur ve kaydet.': 'Gava qediya Biqedîne û tomar bike.',
  'Boş not kaydedilmiyor · silmek için “Sil”':
    'Nota vala nayê tomarkirin · ji bo jêbirinê “Jê bibe”',
  'Bu bağlantıyı SAFARİ\\u2019de aç, sonra alttaki paylaş düğmesinden \\u201CAna Ekrana Ekle\\u201D de. Başka tarayıcıda kurulmuyor.':
    'Vê girêdanê di SAFARİ\\u2019yê de veke, paşê ji bişkoka parvekirinê ya jêr \\u201CAna Ekrana Ekle\\u201D bibêje. Di geroka din de nayê sazkirin.',
  'Bu güncellemede görünür bir değişiklik yok — içeride iyileştirme var.':
    'Di vê rojanekirinê de guhertineke xuyayî tune — di hundir de başkirin heye.',
  'Bu iş': 'Ev kar',
  'Bu kayıtta ne söylendi?': 'Di vê tomarê de çi hate gotin?',
  'Bu ses henüz çevrilmedi. <b>Çevirme Mac\'te yapılıyor</b> — bedava, internetsiz, ses telefondan çıkmıyor. Bir sonraki arşivlemede kendiliğinden çevrilecek. Beklemek istemiyorsan aşağıya kendin yazabilirsin.':
    'Ev deng hîn nehatiye veguhastin. <b>Veguhastin li ser Macê tê kirin</b> — belaş, bêînternet, deng ji telefonê dernakeve. Di arşîvkirina bê de bi xwe wê were veguhastin. Ger tu naxwazî bisekinî tu dikarî bi xwe li jêr binivîsî.',
  'Bu sürümün notu yok.': 'Nota vê guhertoyê tune.',
  'Bu süzgeçle kayıt yok.': 'Bi vê parzûnê tomar tune.',
  'Bu telefon': 'Ev telefon',
  'Bu tura geç': 'Derbasî vê geştê bibe',
  'Bu yedek <b>eski</b>: içinde {0} kayıt var, telefonunda {1}. Yeni bir yedek al.':
    'Ev kopî <b>kevn</b> e: di nav de {0} tomar hene, di telefona te de {1}. Kopiyeke nû bigire.',
  'Bugün henüz sesli günlük yok': 'Îro hîn rojnivîska dengî tune',
  'Bugünden aklında ne kaldı? 90 saniye.': 'Ji îro çi di bîra te de ma? 90 çirke.',
  'Bulunamadı.': 'Nehate dîtin.',
  'Bulunduğun yer durak yapıldı': 'Cihê ku tu lê yî bû rawestgeh',
  'Burayı durak yap': 'Vir bike rawestgeh',
  'Burayı işaretle · konum bulunamadı': 'Li vir nîşan bike · cih nehate dîtin',
  'Burayı işaretle · {0}, {1}': 'Li vir nîşan bike · {0}, {1}',
  'Bütün geziler': 'Hemû geşt',
  'DOĞRULANMADI': 'NEHATE PIŞTRASTKIRIN',
  'Daha önce yazdıkların ({0})': 'Yên ku te berê nivîsandine ({0})',
  'Devam edince aynı dosyanın içinden sürer.': 'Gava berdewam bike di heman pelî de didome.',
  'Dikkat: kalıcı depolama açılmadı. Uygulamayı ANA EKRANDAKİ simgeden aç — Safari sekmesinden açarsan iOS verileri silebilir.':
    'Hay ji xwe hebe: cihgirtina mayînde venebû. Sepanê ji nîşana LI SER EKRANA SEREKE veke — ger ji beşa Safariyê vekî iOS dikare daneyan jê bibe.',
  'Dikkat: {0} kaydın ses/görsel dosyası okunamıyor. Yer açıp tekrar dene; olmuyorsa tamir kılavuzuna bak.':
    'Hay ji xwe hebe: pelê deng/wêne yê {0} tomaran nayê xwendin. Cih veke û dîsa biceribîne; ger nebe li rêbera tamîrê binêre.',
  'Dosyalar indi bile. Tek yapılacak uygulamayı yenilemek — birkaç saniye.':
    'Pel jixwe daketine. Tiştê ku divê were kirin tenê nûkirina sepanê ye — çend çirke.',
  'Doğrulanamadı. Doğru dosyayı seçtiğinden emin ol.':
    'Nehate piştrastkirin. Bawer be ku te pelê rast hilbijartiye.',
  'Durak': 'Rawestgeh',
  'Durak eklendi · {0}. sıra': 'Rawestgeh hate zêdekirin · rêza {0}an',
  'Durak güncellendi.': 'Rawestgeh hate rojanekirin.',
  'Duraklatılamadı.': 'Nehate sekinandin.',
  'Durağı düzenle': 'Rawestgehê biguhêre',
  'Durağı ekle': 'Rawestgehê zêde bike',
  'Durduruldu, hiçbir şey eklenmedi.': 'Hate rawestandin, tu tişt nehate zêdekirin.',
  'Döküm': 'Hûrgilî',
  'Döküm açılıyor · gün gün, tür tür': 'Hûrgilî vedibe · roj bi roj, cure bi cure',
  'Düzelenler': 'Yên hatine rastkirin',
  'Düzenle': 'Biguhêre',
  'Düğmeler': 'Bişkok',
  'Düğmeler, seçili sekme, bağlantılar. Kâğıdın rengi değişmez. Bunu boş bırakırsan renk haftanın gününe göre kendiliğinden döner.':
    'Bişkok, beşa hilbijartî, girêdan. Rengê kaxizê naguhere. Ger tu vê vala bihêlî reng li gorî roja hefteyê bi xwe digere.',
  'Eklenenler': 'Yên hatine zêdekirin',
  'Çıkarılanlar': 'Yên hatine derxistin',
  'Ekranı kapatma — kayıt kesilir.': 'Ekranê negire — tomar tê birîn.',
  'Elle durduracağım': 'Ez ê bi destê xwe rawestînim',
  'Eski tam haritayı sil': 'Nexşeya kevn a tevahî jê bibe',
  'Fotoğraf küçültülüyor…': 'Wêne tê biçûkkirin…',
  'Fotoğraf seç': 'Wêne hilbijêre',
  'Fotoğraf ve video': 'Wêne û vîdyo',
  'Fotoğraf çek': 'Wêne bikişîne',
  'Su al': 'Av bikire',
  'Fotoğraflar açılıyor · aslı {0} {1} hizasında': 'Wêne vedibin · ya resen li hizaya {0} {1}',
  'Fotoğrafları aç': 'Wêneyan veke',
  'Fotoğrafı büyüt': 'Wêneyê mezin bike',
  'Fotoğrafı küçült': 'Wêneyê biçûk bike',
  'Gelen paketi al': 'Pakêta hatî bigire',
  'Geri alındı': 'Hate vegerandin',
  'Gerok henüz başlamadı': 'Gerok hîn dest pê nekiriye',
  'Gerok internetsiz tam çalışır. Bağlantı yalnızca yukarıdaki işleri düzeltmek için kullanılır. Dışarı giden tek şey: para birimi kodları, kayıtların ve durakların koordinatları. Metin, ses, fotoğraf, isim — hiçbiri gitmiyor, hiçbir kaydın buluta yüklenmiyor.':
    'Gerok bêînternet bi temamî dixebite. Girêdan tenê ji bo rastkirina karên jorîn tê bikaranîn. Tiştê ku derdikeve derve tenê ev e: kodên yekeyên diravî, koordînatên tomar û rawestgehan. Nivîs, deng, wêne, nav — yek jî naçe, tu tomara te li ewrê nayê barkirin.',
  'Gerok paketi yüklenmedi': 'Pakêta Gerokê nehate barkirin',
  'Gerok paketi yüklenmedi.': 'Pakêta Gerokê nehate barkirin.',
  'Gerok tamamlandı': 'Gerok qediya',
  'Gerok — internetsiz çalışan gezi defteri.':
    'Gerok — rojnivîska geştê ya ku bêînternet dixebite.',
  'Gerok\'a ayrılan yer azaldı · harita paketini silebilirsin, videolar zaten galeride':
    'Cihê ku ji Gerokê re hatiye veqetandin kêm bû · tu dikarî pakêta nexşeyê jê bibî, vîdyo jixwe di galeriyê de ne',
  'Gerok\'a ayrılan yer azalıyor: {0} kaldı. Yedek al ve galeriden yer aç.':
    'Cihê ku ji Gerokê re hatiye veqetandin kêm dibe: {0} ma. Kopiyeke ewle bigire û ji galeriyê cih veke.',
  'Gerok\'a kalan yer': 'Cihê ku ji Gerokê re maye',
  'Gerok’u yapana yaz': 'Ji yê ku Gerok çêkiriye re binivîse',
  'Gezi Sonu’nu başlat': 'Dawiya Geştê dest pê bike',
  'Gezinin başı ve sonu, bütün geziler, program dosyası.':
    'Destpêk û dawiya geştê, hemû geşt, pelê bernameyê.',
  'Geziye geri dön': 'Vegere geştê',
  'Geçen sefer bir şey ters gitti. Aşağıdakini gönderirsen düzeltilebilir.':
    'Cara borî tiştek şaş çû. Ger tu ya jêrîn bişînî dikare were rastkirin.',
  'Giden şeyin tamamı': 'Tevahiya tiştê ku diçe',
  'Giriş ücreti var mı?': 'Heqê ketinê heye?',
  'Gittik': 'Em çûn',
  'Kaçırdık': 'Me ji dest da',
  'gittik': 'em çûn',
  'kaçırdık': 'me ji dest da',
  'Google Haritalar’da açılıyor': 'Di Nexşeyên Google de vedibe',
  'Gönderildi ✓ Kopyası Gerok’ta duruyor.': 'Hate şandin ✓ Kopiya wê di Gerokê de dimîne.',
  'Gönderilecek şeyin tamamı aşağıda.': 'Tevahiya tiştê ku wê were şandin li jêr e.',
  'Görseller': 'Wêne',
  'Görseller alınamadı: {0}': 'Wêne nehatin girtin: {0}',
  'Görünüm, ad, indirilmiş harita ve yer.': 'Dîmen, nav, nexşeya daxistî û cih.',
  'Gün Sonu': 'Dawiya Rojê',
  'Gün Sonu\'nu başlat': 'Dawiya Rojê dest pê bike',
  'Gün sayısını sonra değiştiremezsin ama sorun değil — süre bitse de kayıt almaya devam edebilirsin, "Gerok dışı" olarak yazılır.':
    'Tu nikarî hejmara rojan paşê biguherînî lê ne pirsgirêk e — heke dem biqede jî tu dikarî tomarkirinê bidomînî, wek "Derveyî Gerokê" tê nivîsandin.',
  'Gün {0}': 'Roja {0}an',
  'Güncellenemedi ({0}). İnternet varken tekrar dene.':
    'Nehate rojanekirin ({0}). Gava înternet hebe dîsa biceribîne.',
  'Günsüz': 'Bêroj',
  'Günü yol arkadaşına gönder': 'Rojê ji hevrêyê xwe re bişîne',
  'Haftanın gününe dön': 'Vegere roja hefteyê',
  'Ham hali (gönderilecek dosyanın aynısı)': 'Rewşa xam (heman pelê ku wê were şandin)',
  'Hangi gün?': 'Kîjan roj?',
  'Harcama ve tanıştıklarımız': 'Xerc û yên ku me nas kirin',
  'Harita alanı indir': 'Devera nexşeyê daxîne',
  'Harita henüz hazır değil.': 'Nexşe hîn amade nîne.',
  'Haritada rotaya eklenecek ve sıradaki yerini alacak. Akşam paket gönderdiğinde arkadaşının telefonuna da geçer.':
    'Wê li ser nexşeyê li rê were zêdekirin û cihê xwe yê rêzê bigire. Gava êvarê pakêtê bişînî wê derbasî telefona hevalê te jî bibe.',
  'Haritadan durak ekle': 'Ji nexşeyê rawestgeh zêde bike',
  'Haritadan durak koy': 'Ji nexşeyê rawestgehekê deyne',
  'Haritalar\'da aç': 'Di Nexşeyan de veke',
  'Haritayı kaydır, sonra "Buraya durak ekle" de.':
    'Nexşeyê bikişîne, paşê "Li vir rawestgehekê zêde bike" bibêje.',
  'Henüz alan inmedi. İnternetsizken harita boş kalır.':
    'Hîn dever nehatiye daxistin. Bêînternet nexşe vala dimîne.',
  'Henüz bir gerok yüklenmedi — aşağıdaki kayıtlar duruyor. Paketi yükleyince ya da yeni tur başlatınca Gerok → Turlar\'dan tek düğmeyle o tura taşınırlar.':
    'Hîn tu gerok nehatiye barkirin — tomarên jêrîn dimînin. Gava pakêtê bar bikî an geşteke nû dest pê bikî, ji Gerok → Geşt bi bişkokekê tenê derbasî wê geştê dibin.',
  'Henüz bir gerok yüklenmedi.<br>Gerok sekmesinden paketi yükle.':
    'Hîn tu gerok nehatiye barkirin.<br>Ji beşa Gerokê pakêtê bar bike.',
  'Henüz durak yok.<br>Haritadaki iğne düğmesine basıp kendi duraklarını koyabilirsin —<br>gerok paketi olmadan da çalışır.':
    'Hîn rawestgeh tune.<br>Tu dikarî bişkoka derzî ya li ser nexşeyê bitikînî û rawestgehên xwe deynî —<br>bêyî pakêta gerokê jî dixebite.',
  'Henüz hiç yedek yok': 'Hîn tu kopiya ewle tune',
  'Hepsi': 'Hemû',
  'Hepsini şimdi hallet': 'Hemûyan niha çareser bike',
  'Her harcama kendi günündeki kurla hesaplandı.':
    'Her xerc bi rêjeya roja xwe hate hesibandin.',
  'Hiçbir görsel eklenemedi ({0} dosya denendi).':
    'Tu wêne nehate zêdekirin ({0} pel hatin ceribandin).',

  // ------------------------------------------------------ uygulama — B ---
  'KAYIT EDİLEMEDİ: ekran kapalıyken iOS kaydı kesmiş. Kayıt sırasında ekranı açık tut ya da Yol Modu\'nu aç — o ekranı söndürmüyor.':
    'NEHATE TOMARKIRIN: gava ekran girtî bû iOSê tomar birî. Di dema tomarkirinê de ekranê vekirî bihêle an jî Moda Rê veke — ew ekranê venamirîne.',
  'KAYIT EDİLEMEDİ: {0}. Telefonda yer kalmamış olabilir — Gerok sekmesinden yer durumuna bak, yedek al ve eski kayıtları temizle.':
    'NEHATE TOMARKIRIN: {0}. Dibe ku di telefonê de cih nemabe — ji beşa Gerokê li rewşa cih binêre, kopiyeke ewle bigire û tomarên kevn paqij bike.',
  'KAYIT EDİLEMEDİ: {0}. Telefonda yer kalmamış olabilir.':
    'NEHATE TOMARKIRIN: {0}. Dibe ku di telefonê de cih nemabe.',
  'Kalıcı depolama açıldı.': 'Cihgirtina mayînde vebû.',
  'Kalıcı depolama iste': 'Cihgirtina mayînde bixwaze',
  'Kapalı — açmak için dokun': 'Girtî — ji bo vekirinê bitikîne',
  'Kara kutu henüz açılmadı.': 'Sindoqa reş hîn venebûye.',
  'Kaydedildi · başlıksız': 'Hate tomarkirin · bêsernav',
  'Kaydedildi · zaman çizgisine düştü': 'Hate tomarkirin · ket xeta demê',
  'Kaydedildi · {0} {1}': 'Hate tomarkirin · {0} {1}',
  'Kaydet': 'Tomar bike',
  'Kayıt silindi': 'Tomar hate jêbirin',
  'Kayıtlı hata yok. Yine de sayıları gönderebilirsin.':
    'Çewtiya tomarkirî tune. Dîsa jî tu dikarî hejmaran bişînî.',
  'Kaç gün sürecek?': 'Wê çend rojan bidome?',
  'Konum alınamadı. Haritadan elle koyabilirsin.':
    'Cih nehate girtin. Tu dikarî ji nexşeyê bi destê xwe deynî.',
  'Konum alınıyor…': 'Cih tê girtin…',
  'Konum: {0}, {1}': 'Cih: {0}, {1}',
  'Konuş — bitince "Durdur ve kaydet"': 'Biaxive — gava qediya "Biqedîne û tomar bike"',
  'Konuş. Ekranı kapatma.': 'Biaxive. Ekranê negire.',
  'Konuşma, sadece dinlet.': 'Neaxive, tenê bide guhdarkirin.',
  'Kullanım sayıları': 'Hejmarên bikaranînê',
  'Kâğıdın rengi': 'Rengê kaxizê',
  'Makinenin duyduğu — yanlış duymuş olabilir':
    'Ya ku makîneyê bihîstiye — dibe ku şaş bihîstibe',
  'Mikrofon açılamadı: {0}': 'Mîkrofon venebû: {0}',
  'Mikrofon açılıyor…': 'Mîkrofon vedibe…',
  'Mobil veriye izin verildi · bu bağlantı boyunca':
    'Destûr ji daneya mobîl re hate dayîn · bi qasî vê girêdanê',
  'Mühürlü mektup yaz': 'Nameyeke mohrkirî binivîse',
  'Nasıl kullanılır': 'Çawa tê bikaranîn',
  'Neler değişti': 'Çi guherî',
  'Not güncellendi': 'Not hate rojanekirin',
  'Not yaz': 'Notekê binivîse',
  'Notların, seslerin ve fotoğrafların gönderilmiyor. <b>Ama bir hata mesajı, o an elindeki bir yazıyı alıntılamış olabilir.</b> Aşağıyı oku; göndermek istemediğin bir şey varsa gönderme.':
    'Not, deng û wêneyên te nayên şandin. <b>Lê dibe ku peyameke çewtiyê nivîsek ku wê gavê di destê te de bû jê girtibe.</b> Ya jêr bixwîne; heke tiştek hebe ku tu naxwazî bişînî, neşîne.',
  'OpenStreetMap\'ten geldi': 'Ji OpenStreetMapê hatiye',
  'Ortam sesi 2 dakikada ~24 MB · önce yer aç':
    'Dengê derdorê di 2 deqeyan de ~24 MB e · pêşî cih veke',
  'Paketi dışa ver': 'Pakêtê derxe',
  'Para birimleri ayrı toplanıyor. Tek toplam için Bağlantı → “Harcamaların kurunu düzelt”.':
    'Yekeyên diravî cuda cuda tên berhevkirin. Ji bo yek giştiyê Girêdan → “Rêjeya xercan rast bike”.',
  'Para birimlerine göre: {0}': 'Li gorî yekeyên diravî: {0}',
  'Paylaşılamadı: {0}': 'Nehate parvekirin: {0}',
  'Paylaşılan dosya okunamadı': 'Pelê parvekirî nehate xwendin',
  'Program dosyası yükle': 'Pelê bernameyê bar bike',
  'Rapor gönderildi ✓': 'Rapor hate şandin ✓',
  'Renk değişti': 'Reng guherî',
  'Renk eski hâline döndü': 'Reng vegeriya rewşa xwe ya berê',
  'Sayı gönderimi açıldı.': 'Şandina hejmaran vebû.',
  'Sayı gönderimi kapatıldı.': 'Şandina hejmaran hate girtin.',
  'Sen durdurdun — {0} dosyadan {1} tanesi alındı.':
    'Te rawestand — ji {0} pelan {1} hatin girtin.',
  'Senin düzelttiğin metin': 'Nivîsa ku te rast kiriye',
  'Ses dosyası bulunamadı.': 'Pelê dengî nehate dîtin.',
  'Ses kaydı sürüyor — önce onu bitir, sonra güncelle.':
    'Tomara dengî berdewam e — pêşî wê biqedîne, paşê rojane bike.',
  'Ses çalınamadı: {0}': 'Deng nehate lêxistin: {0}',
  'Ses çözülerek çalınıyor · {0}': 'Deng bi veqetandinê tê lêxistin · {0}',
  'Sesin yazısı': 'Nivîsa dengî',
  'Sesler': 'Deng',
  'Sil': 'Jê bibe',
  'Sil ve {0} yer aç': 'Jê bibe û {0} cih veke',
  'Sildikten sonra <b>internetsizken</b> yalnızca indirdiğin alanlar açılır. Şu an {0}. İnternet varken harita her yerde çalışmaya devam eder.':
    'Piştî jêbirinê <b>gava înternet tune be</b> tenê deverên ku te daxistine vedibin. Niha {0}. Gava înternet hebe nexşe li her derê dixebite.',
  'Son bilinen kurla: {0}. İnternete bağlanınca günlük kurlarla yeniden hesaplanır.':
    'Bi rêjeya dawî ya naskirî: {0}. Gava bi înternetê ve girêdayî bibî bi rêjeyên rojane ji nû ve tê hesibandin.',
  'Son yedekten beri': 'Ji kopiya ewle ya dawî ve',
  'Sonra': 'Paşê',
  'Sorun bildir': 'Pirsgirêkekê ragihîne',
  'Sunucu yok, hesap yok. Şu an iki telefon yan yana olmalı; internet varsa uzaktan da gönderilebilir.':
    'Rajekar tune, hesab tune. Niha divê her du telefon rex hev bin; heke înternet hebe ji dûr jî dikare were şandin.',
  'Sürüm bilgisi, sınama ve tamir kılavuzu.': 'Agahiya guhertoyê, ceribandin û rêbera tamîrê.',
  'Sınır geçişleri': 'Derbasbûnên sînor',
  'Sınırlar': 'Sînor',
  'Sıraya alındı — bir sonraki arşivlemede çevrilecek':
    'Ket rêzê — di arşîvkirina bê de wê were veguhastin',
  'Tanıtım turunu göster': 'Gera nasandinê nîşan bide',
  'Telefonda kullanılan': 'Ya ku di telefonê de tê bikaranîn',
  'Telefondaki sürüm': 'Guhertoya di telefonê de',
  'Telefonu sesin geldiği yöne çevir.': 'Telefonê bizivirîne aliyê ku deng jê tê.',
  'Telefonu sına': 'Telefonê biceribîne',
  'Telefonun ayarına dön': 'Vegere mîhenga telefonê',
  'Telefonun boş alanı değil — tarayıcının Gerok\'a ayırdığı pay. Telefon dolarsa iOS bunu küçültür; gerçek boş alan Ayarlar → Genel → iPhone Saklama Alanı’nda yazıyor.':
    'Ne cihê vala yê telefonê ye — para ku geroka têvegerê ji Gerokê re veqetandiye. Ger telefon tije bibe iOS vê biçûk dike; cihê vala yê rastîn di Ayarlar → Genel → iPhone Saklama Alanı de nivîsandî ye.',
  'Telefonunda altı ülkenin tamamı duruyor: {0}. Artık yalnızca ihtiyaç duyduğun alanlar iniyor, bu dosyaya gerek kalmadı.':
    'Di telefona te de tevahiya şeş welatan heye: {0}. Niha tenê deverên ku hewceyî te ne tên daxistin, êdî hewcedariya vî pelî nema.',
  'Tur başlamadan önce': 'Berî ku geşt dest pê bike',
  'Tur beş saniye içinde silinecek': 'Geşt wê di nav pênc çirkeyan de were jêbirin',
  'Tur silindi · {0} kayıt, {1} iz noktası.': 'Geşt hate jêbirin · {0} tomar, {1} xalên şopê.',
  'Turlar': 'Geşt',
  'Turun günlerinin dışında': 'Derveyî rojên geştê',
  'Unutma listesi — her satıra bir şey': 'Lîsteya bîranînê — li her rêzikê tiştek',
  'Uydu görüntüsü internetten iniyor.': 'Dîmena peykê ji înternetê tê daxistin.',
  'Uydu için internet gerekiyor — şu an bağlantı yok, görüntü gelmez.':
    'Ji bo peykê înternet divê — niha girêdan tune, dîmen nayê.',
  'Uygulamayı paylaş': 'Sepanê parve bike',
  'Varsayılana dönüldü · renk haftanın gününe göre dönüyor':
    'Vegeriya ya bingehîn · reng li gorî roja hefteyê digere',
  'Veri kalıcı korunuyor': 'Dane bi awayekî mayînde tê parastin',
  'Video': 'Vîdyo',
  'Wi-fi bulundu': 'Wi-fi hate dîtin',
  'Yalnızca küçük işler · harita ve yedek wi-fi bekliyor':
    'Tenê karên biçûk · nexşe û kopiya ewle li benda wi-fiyê ne',
  'Yarım dosya boş çıktı, kaydedilecek ses yoktu.':
    'Pelê nîvcî vala derket, dengê ku were tomarkirin tune bû.',
  'Yarım dosya okunamadı.': 'Pelê nîvcî nehate xwendin.',
  'Yarım kayıt silindi': 'Tomara nîvcî hate jêbirin',
  'Yarım kayıt siliniyor': 'Tomara nîvcî tê jêbirin',
  'Yarım kayıt {0}\'e yerleştirildi.': 'Tomara nîvcî li {0}an hate danîn.',
  'Yarım kayıt çalınamadı — yine de saklanabilir.':
    'Tomara nîvcî nehate lêxistin — dîsa jî dikare were parastin.',
  'Yazı kaydedildi · artık aranabilir': 'Nivîs hate tomarkirin · êdî lê tê gerîn',
  'Yazı silindi': 'Nivîs hate jêbirin',
  'Yazılar': 'Nivîs',
  'Yazılar ve buradayım işaretleri': 'Nivîs û nîşanên “ez li vir im”',
  'Yazıya çevir': 'Bike nivîs',
  'Yazıyı düzelt': 'Nivîsê rast bike',
  'Yazıyı sil': 'Nivîsê jê bibe',
  'Yedek': 'Kopiya ewle',
  'Yedek doğrulandı · {0} kayıt, {1} dosya':
    'Kopiya ewle hate piştrastkirin · {0} tomar, {1} pel',
  'Yedek sınanamadı: {0}': 'Kopiya ewle nehate ceribandin: {0}',
  'Yedek sınandı ✓ · {0} · {1} kayıt okunabiliyor':
    'Kopiya ewle hate ceribandin ✓ · {0} · {1} tomar têne xwendin',
  'Yedek sınanıyor…': 'Kopiya ewle tê ceribandin…',
  'Yedek sınanıyor… {0}/{1} dosya': 'Kopiya ewle tê ceribandin… {0}/{1} pel',
  'Yedeği geri yükle': 'Kopiya ewle vegerîne',
  'Yedeği sına': 'Kopiya ewle biceribîne',
  'Yeni durak': 'Rawestgeheke nû',
  'Yeni gezi başlat': 'Geşteke nû dest pê bike',
  'Yeni sürüm var mı?': 'Guhertoyeke nû heye?',
  'Yeni ülkeye girdin — zaman çizgisine işlendi.':
    'Tu ketî welatekî nû — li xeta demê hate nivîsandin.',
  'Yeri bulunamayan': 'Yên cihê wan nehate dîtin',
  'Yeri bulunan': 'Yên cihê wan hate dîtin',
  'Yol': 'Rê',
  'Yol Modu açık ama ses açılamadı: uyarı yalnızca ekranda çıkar.':
    'Moda Rê vekirî ye lê deng venebû: hişyarî tenê li ser ekranê derdikeve.',
  'Yol Modu açık · ekran sönmeyecek': 'Moda Rê vekirî ye · ekran wê venemire',
  'Zaman çizgisi boş.<br>Kayıt sekmesinden ilk sesli notunu bırak,<br>ya da bir fotoğraf ekle.':
    'Xeta demê vala ye.<br>Ji beşa Tomarê nota xwe ya dengî ya yekem bihêle,<br>an jî wêneyekê zêde bike.',
  'Zaman çizgisinde': 'Li xeta demê',
  'Zaten en son sürümdesin.': 'Tu jixwe di guhertoya dawî de yî.',
  'Zaten varsayılan · renk haftanın gününe göre dönüyor':
    'Jixwe ya bingehîn e · reng li gorî roja hefteyê digere',
  'Zemin': 'Bingeh',
  'Zeminin rengi. Açık bir renk seçersen gündüz kipi, koyu bir renk seçersen gece kipi kendiliğinden açılır — yazılar ve çizgiler bu renkten türetilir.':
    'Rengê bingehê. Ger tu rengekî vekirî hilbijêrî moda rojê, ger rengekî tarî hilbijêrî moda şevê bi xwe vedibe — nivîs û xêz ji vî rengî tên çêkirin.',

  // -------------------- uygulama — C (küçük yazılar ve sayı kalıpları) ---
  'alındı': 'hate girtin',
  'arkadaşına gönder': 'ji hevalê xwe re bişîne',
  'arkadaşının': 'yê hevalê te',
  'arşiv': 'arşîv',
  'az': 'kêm',
  'açık': 'vekirî',
  'bakılıyor…': 'tê nêrîn…',
  'bağlantı': 'girêdan',
  'başka güne taşındı': 'derbasî rojeke din bû',
  'baştan gezdir': 'ji destpêkê bigerîne',
  'bekliyor': 'li bendê ye',
  'bilinmeyen sebep': 'sedemeke nenas',
  'bir şey sor ya da söyle': 'tiştekî bipirse an bibêje',
  'birkaç saniye': 'çend çirke',
  'birleştir · değiştir': 'yek bike · biguherîne',
  'bitti': 'qediya',
  'boş': 'vala',
  'bu gezi': 'ev geşt',
  'bu telefon': 'ev telefon',
  'eksik var': 'kêmasî heye',
  'evet': 'erê',
  'hayır': 'na',
  'ezan, müzik': 'bang, mûzîk',
  'eşitleme': 'hevberkirin',
  'fotoğraf ve video': 'wêne û vîdyo',
  'gezi': 'geşt',
  'gönderildi': 'hate şandin',
  'haftada bir gönderiliyor': 'hefteyê carekê tê şandin',
  'haftada bir · son {0}': 'hefteyê carekê · ya dawî {0}',
  'hallet': 'çareser bike',
  'hata yok · sayılar hazır': 'çewtî tune · hejmar amade ne',
  'henüz alan inmedi': 'hîn dever nehatiye daxistin',
  'her şey yolunda': 'her tişt li rê ye',
  'hiç alınmadı': 'qet nehatiye girtin',
  'hiç yüklenmedi': 'qet nehatiye barkirin',
  'iCloud ve Drive’ı güncelle': 'iCloud û Drive rojane bike',
  'iOS şimdilik vermedi — yedek almayı ihmal etme.':
    'iOSê ji bo niha neda — kopiya ewle girtinê paşguh neke.',
  'indirme tamamlanmadı': 'daxistin neqediya',
  'internet yok': 'înternet tune',
  'işaretlediklerin': 'yên te nîşankirî',
  'işaretli': 'nîşankirî',
  'kendi durağın': 'rawestgeha te ya xwe',
  'konum: bulunamadı': 'cih: nehate dîtin',
  'konum: elle işaretlendi': 'cih: bi destan hate nîşankirin',
  'konum: fotoğrafın içinden': 'cih: ji nav wêneyê',
  'konum: iz kaydından': 'cih: ji tomara şopê',
  'konum: uydudan': 'cih: ji peykê',
  'kısa bir an': 'kêliyek kurt',
  'mobil veri': 'daneya mobîl',
  'mobil veri var · izin bekliyor': 'daneya mobîl heye · li benda destûrê ye',
  'mobil veri · izin verildi': 'daneya mobîl · destûr hate dayîn',
  'mobil veri · yalnızca küçük işler': 'daneya mobîl · tenê karên biçûk',
  'ne kadar sürerse': 'çiqas bidome',
  'okunabilir ✓': 'tê xwendin ✓',
  'paketten': 'ji pakêtê',
  'puanın': 'puanê te',
  'ses kayıtları': 'tomarên dengî',
  'sesli not, ortam sesi, günlük': 'nota dengî, dengê derdorê, rojnivîsk',
  'sürüm ve yardım': 'guherto û alîkarî',
  'sınanmadı': 'nehatiye ceribandin',
  'sıradan kareler dahil': 'kareyên asayî jî tê de',
  'tamir kılavuzu': 'rêbera tamîrê',
  'tanıştığınız kişiler': 'kesên ku we nas kirin',
  'tasarruf · {0}': 'aborî · {0}',
  'video · {0} · önizleme, orijinali galeride':
    'vîdyo · {0} · pêşdîtin, ya resen di galeriyê de',
  'wi-fi': 'wi-fi',
  'wi-fi bekler': 'li benda wi-fiyê',
  'wi-fi · bağlı': 'wi-fi · girêdayî',
  'yaklaşık {0} dakika kaldı': 'nêzîkî {0} deqeyan ma',
  'yaklaşık {0} saniye kaldı': 'nêzîkî {0} çirkeyan ma',
  'yazı, işaret, sınır': 'nivîs, nîşan, sînor',
  'yağmur, dalga, tren': 'baran, pêl, trên',
  'yer bilinmiyor': 'cih nayê zanîn',
  'yok': 'tune',
  'yükleniyor…': 'tê barkirin…',
  'zaman çizgisinin başında · {0}': 'li destpêka xeta demê · {0}',
  '{0} dosya yenilendi': '{0} pel hatin nûkirin',
  '{0} görsel eklendi': '{0} wêne hatin zêdekirin',
  '{0} gün': '{0} roj',
  '{0} gün · {1} açılış': '{0} roj · {1} vebûn',
  '{0} hizasına yerleşti': 'li hizaya {0} rûnişt',
  '{0} iş halledildi': '{0} kar hatin çareserkirin',
  '{0} kaldı': '{0} ma',
  '{0} karo ({1}) inmiş durumda': '{0} parçe ({1}) daketine',
  '{0} kayıt': '{0} tomar',
  '{0} kayıt bu tura taşındı.': '{0} tomar derbasî vê geştê bûn.',
  '{0} kez': '{0} caran',
  '{0} km uçuş': '{0} km firîn',
  '{0} km · {1} nokta': '{0} km · {1} xal',
  '{0} mektup · {1}': '{0} name · {1}',
  '{0} olmadı: {1}': '{0} nebû: {1}',
  '{0} sürümü': 'guhertoya {0}',
  '{0} tane': '{0} heb',
  '{0} uzakta': '{0} dûr',
  '{0} yeni hata': '{0} çewtiyên nû',
  '{0} yeni kayıt · tek dosya, telefonda kalır':
    '{0} tomarên nû · pelek tenê, di telefonê de dimîne',
  '{0} yeniden açıldı.': '{0} ji nû ve vebû.',
  '{0} yer açıldı.': '{0} cih vebû.',
  '{0} · bekleyen bir şey yok.': '{0} · tiştekî li benda tune.',
  '{0} · mobil veride indirilmiyor, wi-fi bekliyor':
    '{0} · bi daneya mobîl nayê daxistin, li benda wi-fiyê ye',
  '{0} · {1} gün': '{0} · {1} roj',
  '{0} şey bekliyor — şimdi hallolabilir.':
    '{0} tişt li bendê ne — niha dikarin çareser bibin.',
  '{0} şey internet bekliyor. Otelde wi-fi bulunca tek dokunuşla hallolur; o zamana kadar her şey çevrimdışı çalışmaya devam eder.':
    '{0} tişt li benda înternetê ne. Gava li otêlê wi-fi bibînî bi tikandinekê tenê çareser dibin; heta wê demê her tişt bêînternet dixebite.',
  '{0} — haritayı ince ayarla, sonra "Buraya durak ekle".':
    '{0} — nexşeyê hûr saz bike, paşê "Li vir rawestgehekê zêde bike".',
  '{0} → Gün {1}': '{0} → Roja {1}an',
  'Çevrimdışı harita': 'Nexşeya bêînternet',
  'Çift dokun · listenin başına dön': 'Du caran bitikîne · vegere serê lîsteyê',
  'Çift dokun · sayfanın başına dön': 'Du caran bitikîne · vegere serê rûpelê',
  'Çift dokun · sesli not başlat': 'Du caran bitikîne · nota dengî dest pê bike',
  'Çift dokun · tümünü göster': 'Du caran bitikîne · hemûyan nîşan bide',
  'Çok kısaydı, kaydedilmedi.': 'Pir kurt bû, nehate tomarkirin.',
  'Önce bir tur başlat.': 'Pêşî geştekê dest pê bike.',
  'Önce bir şeyler yaz.': 'Pêşî tiştekî binivîse.',
  'Önizlemesi çıkmayan': 'Yên pêşdîtina wan derneket',
  'Üzerine basılabilecek şeylerin rengi': 'Rengê tiştên ku dikarin werin tikandin',
  'çarşı, sokak': 'sûk, kolan',
  'çevrimdışı alan yok': 'devera bêînternet tune',
  'çevrimdışı kurulum yok': 'sazkirina bêînternet tune',
  'İndir ve güncelle': 'Daxîne û rojane bike',
  'İnmedi: {0}': 'Nedaket: {0}',
  'İnternet bulununca hallolacak': 'Gava înternet were dîtin wê çareser bibe',
  'İnternet kesildi · her şey çevrimdışı sürüyor':
    'Înternet qut bû · her tişt bêînternet didome',
  'İnternet yok · bağlanınca hepsi kendiliğinden hallolur':
    'Înternet tune · gava girêdayî bibî hemû bi xwe çareser dibin',
  'İnternet yok · bağlanınca kendiliğinden hallolur':
    'Înternet tune · gava girêdayî bibî bi xwe çareser dibe',
  'İnternet yok — alan indirmek için internet gerekiyor.':
    'Înternet tune — ji bo daxistina deverê înternet divê.',
  'İnternet yok — bakılamadı.': 'Înternet tune — nehate nêrîn.',
  'İnternet yok — mesajın kuyrukta, bağlanınca gidecek.':
    'Înternet tune — peyama te di rêzê de ye, gava girêdayî bibî wê here.',
  'İnternet yok — rapor kuyruğa alındı, bağlanınca kendiliğinden gidecek.':
    'Înternet tune — rapor ket rêzê, gava girêdayî bibî bi xwe wê here.',
  'İnternette aranıyor…': 'Li înternetê tê gerîn…',
  'İnternetten inecek, sonra uygulama kendi kendine yenilenecek.':
    'Wê ji înternetê were daxistin, paşê sepan bi xwe nû dibe.',
  'İz kaydı açıldı': 'Tomara şopê vebû',
  'İz kaydı kapatıldı': 'Tomara şopê hate girtin',
  'Şelale, kahvaltı yeri, köprü…': 'Şirşir, cihê taştê, pir…',
  'Şimdi güncelle': 'Niha rojane bike',
  'Şimdiki hâl yedeklendi · sonra geri yükleyebilirsin':
    'Rewşa niha hate parastin · tu dikarî paşê vegerînî',
  'Şu anki gezi': 'Geşta niha',
  'şu anki': 'ya niha',
  '≈ {0} dakika': '≈ {0} deqe',
  '≈ {0} saniye': '≈ {0} çirke',
  'Bulut yedeği hazırlanıyor… {0}/{1}': 'Kopiya ewle ya ewrê tê amadekirin… {0}/{1}',
  'Ekran kapalıyken kayıt kesilmiş, ses elde edilemedi':
    'Gava ekran girtî bû tomar hate birîn, deng nehate girtin',
  'Ses dosyaya yazılamadı ({0})': 'Deng nehate nivîsandina pelî ({0})',
  'adsız dosya': 'pelê bênav',
  'depolama yanıt vermedi': 'cihgirtinê bersiv neda',
  '{0} girdik': 'Em ketin {0}',

  // --------------------------------------------------------------- son ---
  'Fotoğraf': 'Wêne',

  // ------------------------------------------------------ uygulama — D ---
  ' ve {0} tane daha': ' û {0} heb din',
  '"{0}" silinsin mi?': '"{0}" were jêbirin?',
  '(wifi gerekir).': '(wi-fi divê).',
  '+ not yaz': '+ notekê binivîse',
  ', {0} tanesi hariç': ', ji bilî {0} jê',
  '<b>"{0}"</b> arşive kaldırılacak. Kayıtları silinmiyor, istediğin an geri dönersin.':
    '<b>"{0}"</b> wê here arşîvê. Tomarên wê nayên jêbirin, tu kengî bixwazî vedigerî.',
  '<b>Bu son turun.</b> Arşivleyince zaman çizgisi, harita ve duraklar boşalacak — kayıtların yerinde duracak ve ekranda <b>Geziye geri dön</b> düğmesi çıkacak.':
    '<b>Ev geşta te ya dawî ye.</b> Gava arşîv bikî xeta demê, nexşe û rawestgeh wê vala bibin — tomarên te li cihê xwe dimînin û li ser ekranê bişkoka <b>Vegere geştê</b> derdikeve.',
  '<b>{0} kayıt hiçbir tura bağlı değil.</b> Eski bir turdan kalmış olabilir. Şu anki tura taşıyabilirsin.':
    '<b>{0} tomar bi tu geştê ve girêdayî nînin.</b> Dibe ku ji geşteke kevn mabin. Tu dikarî wan derbasî geşta niha bikî.',
  '<b>{0} mesajın</b> internet bekliyor. Bağlanınca kendiliğinden gidecek.':
    '<b>{0} peyamên te</b> li benda înternetê ne. Gava girêdayî bibî bi xwe wê herin.',
  'Adın': 'Navê te',
  'Adın (istersen — boş bırakabilirsin)': 'Navê te (ger bixwazî — dikarî vala bihêlî)',
  'Adın ne?': 'Navê te çi ye?',
  'Alan iniyor…': 'Dever tê daxistin…',
  'Alınamayanlar:': 'Yên nehatin girtin:',
  'Ana ekrandaki simgeden açtıysan:<br><b>Ayarlar → Gerok → Mikrofon → İzin ver</b><br><br>Safari sekmesinden açtıysan:<br><b>Ayarlar → Safari → Mikrofon → İzin ver</b><br><br>İzni verdikten sonra uygulamayı tamamen kapat (kartı yukarı kaydır) ve yeniden aç. İzin, uygulama açıkken değişmiyor.':
    'Ger te ji nîşana li ser ekrana sereke vekiribe:<br><b>Ayarlar → Gerok → Mikrofon → İzin ver</b><br><br>Ger te ji beşa Safariyê vekiribe:<br><b>Ayarlar → Safari → Mikrofon → İzin ver</b><br><br>Piştî ku te destûr da, sepanê bi temamî bigire (kartê ber bi jor ve bikişîne) û ji nû ve veke. Destûr, gava sepan vekirî be, naguhere.',
  'Anladım': 'Fêm kir',
  'Anladım, sil': 'Fêm kir, jê bibe',
  'Anlat': 'Bêje',
  'Aradığın burada yoksa': 'Ger ya ku tu lê digerî li vir tune be',
  'Bekçi': 'Nobedar',
  'Beş saniye "Geri al" düğmesi duracak. O geçtikten sonra dönüşü yok: ses dosyası da siliniyor ve arkadaşına paket gönderdiğinde onun telefonundan da silinir.':
    'Pênc çirkeyan bişkoka "Vegerîne" wê bimîne. Piştî wê vegerandin tune: pelê dengî jî tê jêbirin û gava pakêtê ji hevalê xwe re bişînî ji telefona wî jî tê jêbirin.',
  'Bir satırla ne oldu?': 'Bi rêzikekê, çi bû?',
  'Bir şey çalışmıyorsa, bir şey eksikse ya da bir fikrin varsa buraya yaz. Doğrudan bana gelir.':
    'Ger tiştek nexebite, tiştek kêm be an jî ramanek te hebe li vir binivîse. Rasterast tê ba min.',
  'Birleştir': 'Yek bike',
  'Boş bir defter açılır. Duraklarını haritadan kendin koyarsın; hazır bir rota dosyan varsa onu da yükleyebilirsin.':
    'Rojnivîskeke vala vedibe. Tu rawestgehên xwe bi xwe ji nexşeyê datînî; ger pelê rêyeke amade hebe tu dikarî wê jî bar bikî.',
  'Bu durakla ilgili detay ister misin?': 'Tu li ser vê rawestgehê hûrgilî dixwazî?',
  'Bu gerokta henüz kayıt yok.<br>Alt şeritteki <span style="color:var(--vurgu)">Kayıt</span>\'a bas, bir sesli not bırak.<br>Yolda tek dokunuş yeter.':
    'Di vê gerokê de hîn tomar tune.<br>Li <span style="color:var(--vurgu)">Tomar</span>a şerîta jêr bitikîne, notek dengî bihêle.<br>Di rê de tikandinek bes e.',
  'Bu kayıt silinsin mi?': 'Ev tomar were jêbirin?',
  'Bu tur tamamen silinsin mi?': 'Ev geşt bi temamî were jêbirin?',
  'Bugün olmaz': 'Îro na',
  'Burası hakkında bilgi': 'Agahî li ser vir',
  'Buraya gelince ne yapmalı? Kendi notun — akşam eşitlemesinde arkadaşının telefonuna da geçer.':
    'Gava bigihîjî vir divê çi bikî? Nota te ya xwe — di hevberkirina êvarê de derbasî telefona hevalê te jî dibe.',
  'Defterin sayfasına bir satır.': 'Rêzikek li rûpela rojnivîskê.',
  'Devam ettirilemedi.': 'Nehate berdewamkirin.',
  'Değiştir': 'Biguherîne',
  'Dinle': 'Guhdarî bike',
  'Dosyada <b>{0}</b> kayıt var. Telefonda şu an <b>{1}</b> kayıt duruyor.':
    'Di pelî de <b>{0}</b> tomar hene. Di telefonê de niha <b>{1}</b> tomar hene.',
  'Dosyayı seç': 'Pelî hilbijêre',
  'Durak geri geldi': 'Rawestgeh vegeriya',
  'Durak silindi': 'Rawestgeh hate jêbirin',
  'Dökümü gör': 'Hûrgiliyê bibîne',
  'Eski tam harita': 'Nexşeya kevn a tevahî',
  'Evet, sil ve yedeği yükle': 'Erê, jê bibe û kopiyê bar bike',
  'Fotoğraf (isteğe bağlı)': 'Wêne (bi dilê te)',
  'Gerek yok': 'Ne hewce ye',
  'Geri al': 'Vegerîne',
  'Geri yükleme birleştirme değil, değiştirme. Telefonda yedekte olmayan ne varsa silinir — yani yedek alındıktan sonra girdiğin her şey. Geriye tam olarak yedekteki <b>{0}</b> kayıt kalır. <b>Geri dönüşü yok.</b>':
    'Vegerandin ne yekkirin e, guherandin e. Di telefonê de çi tune be di kopiyê de tê jêbirin — yanî her tiştê ku te piştî girtina kopiyê nivîsandiye. Bi tam <b>{0}</b> tomarên di kopiyê de dimînin. <b>Vegerandin tune.</b>',
  'Gerok’u yapana haftada bir kez birkaç sayı gidiyor: kaç kez açıldı, kaç kayıt var, hata çıktı mı, hangi sürüm ve hangi telefon. Hataların düzelmesi buna bakılarak oluyor.':
    'Hefteyê carekê çend hejmar ji yê ku Gerok çêkiriye re diçin: çend caran vebû, çend tomar hene, çewtî derket an na, kîjan guherto û kîjan telefon. Rastkirina çewtiyan bi nêrîna van dibe.',
  'Giden şey: yazdığın metin, yazdıysan adın, bir de sürüm ve telefon türü. <b>Notların, seslerin, fotoğrafların ve gezin gitmiyor.</b>':
    'Tiştê ku diçe: nivîsa ku te nivîsandiye, ger te nivîsandibe navê te, û guherto û cureyê telefonê. <b>Not, deng, wêne û geşta te naçin.</b>',
  'Gitmedik': 'Em neçûn',
  'Gönder': 'Bişîne',
  'Gönderildi.': 'Hate şandin.',
  'Gönderilemedi: {0}': 'Nehate şandin: {0}',
  'Görseller alınıyor': 'Wêne tên girtin',
  'Güne göre': 'Li gorî rojê',
  'Kategoriye göre': 'Li gorî beşê',
  'Harcama ekle': 'Xerc zêde bike',
  'Harcamalar': 'Xerc',
  'Henüz harcama yok. Kayıt sekmesinden <b>Harcama</b> ile ekle — her biri saatiyle zaman çizgisine de düşer.':
    'Hîn xerc tune. Ji beşa Tomarê bi <b>Xerc</b> zêde bike — her yek bi saeta xwe re dikeve xeta demê jî.',
  'Hepsini sil': 'Hemûyan jê bibe',
  'Her kaydın kime ait olduğu bununla yazılacak. İki telefonun kayıtları birleşince kimin ne söylediği belli olsun diye.':
    'Bi vî awayî tê nivîsandin ku her tomar ya kê ye. Ji bo ku gava tomarên du telefonan werin yekkirin diyar be kê çi gotiye.',
  'Kaldır': 'Rake',
  'Karadeniz turu, Ege 2027…': 'Geşta Deryaya Reş, Ege 2027…',
  'Kayıtlar tutulur, yerleri boş kalır. Sonradan haritada elle işaretleyebilirsin.':
    'Tomar tên girtin, cihên wan vala dimînin. Tu dikarî paşê li ser nexşeyê bi destan nîşan bikî.',
  'Kayıtların, sesli notların, fotoğrafların ve izin <b>silinmez</b> — telefonda durur. Sadece ekranlardan çekilir, yeni turla karışmaz. İstediğin an geri dönebilirsin.':
    'Tomar, notên dengî, wêne û şopa te <b>nayên jêbirin</b> — di telefonê de dimînin. Tenê ji ekranan tên vekişandin, bi geşta nû re tevlihev nabin. Tu kengî bixwazî dikarî vegerî.',
  'Konum izni yok': 'Destûra cih tune',
  'Konuşmayacaksın — o yerin nasıl duyulduğunu kaydediyorsun.':
    'Tu nayê axaftin — tu tomar dikî ku ew cih çawa tê bihîstin.',
  'Listenin ucu — daha ileri gitmiyor.': 'Serê lîsteyê — pêştir naçe.',
  'Mikrofon izni': 'Destûra mîkrofonê',
  'Mikrofon izni yok': 'Destûra mîkrofonê tune',
  'Mikrofon izni yok · Ayarlar → Gerok → Mikrofon':
    'Destûra mîkrofonê tune · Ayarlar → Gerok → Mikrofon',
  'Nasıl yer açarım?': 'Ez çawa cih vekim?',
  'Ne kadar sürsün?': 'Çiqasî bidome?',
  'Ne oldu?': 'Çi bû?',
  'Ne oldu? Ne olsun isterdin?': 'Çi bû? Te dixwest çi bibûya?',
  'Ne zaman başlıyor?': 'Kengî dest pê dike?',
  'Not eklendi.': 'Not hate zêdekirin.',
  'Not silindi': 'Not hate jêbirin',
  'Not yok.': 'Not tune.',
  'Notların, seslerin, fotoğrafların, konumun ve adın <b>gitmiyor</b>. Hata yazıları da bu yoldan gitmiyor — onlar yalnızca sen “Sorun bildir” deyip okuduğunda gidiyor.':
    'Not, deng, wêne, cih û navê te <b>naçin</b>. Nivîsên çewtiyê jî bi vê rê naçin — ew tenê gava tu “Pirsgirêkekê ragihîne” bibêjî û bixwînî diçin.',
  'Notu düzenle': 'Notê biguhêre',
  'Notu sil': 'Notê jê bibe',
  'Ohrid\'de rehberin anlattığı…': 'Ya ku rêbir li Ohridê got…',
  'Ohrid, göl kıyısı': 'Ohrid, kêleka golê',
  'On yıl sonra adını hatırlamayacaksın.': 'Piştî deh salan tu navê wî nayê bîra te.',
  'Rotadan çıkar. Bu durakta yaptığın kayıtlar (ses, fotoğraf, not) silinmez — onlar yerinde kalır. Listenin en altındaki “Silinen duraklar”dan geri getirebilirsin.':
    'Ji rê derdikeve. Tomarên ku te li vê rawestgehê kirine (deng, wêne, not) nayên jêbirin — ew li cihê xwe dimînin. Tu dikarî ji “Rawestgehên jêbirî” yên li binê lîsteyê wan vegerînî.',
  'Sakla · {0}\'e koy': 'Biparêze · deyne {0}an',
  'Ses kaydı yapılamıyor. Yazı, fotoğraf ve harcama çalışmaya devam ediyor.':
    'Tomara dengî nayê kirin. Nivîs, wêne û xerc dixebitin.',
  'Ses konumu': 'Cihê dengî',
  'Silinemedi: {0}': 'Nehate jêbirin: {0}',
  'Silinen duraklar ({0})': 'Rawestgehên jêbirî ({0})',
  'Siliniyor…': 'Tê jêbirin…',
  'siliniyor…': 'tê jêbirin…',
  'Sıradaki · {0}': 'Ya bê · {0}',
  'Sırayla:<br><br>1 · Önce <b>yedek al</b> (Gerok → eşitleme). Silmeden önce her zaman yedek.<br>2 · Harita paketini sil (Gerok → bu telefon). Sonra yeniden indirilebilir.<br>3 · Videolar uygulamada değil <b>galeride</b> duruyor. Yeri onlar kaplıyorsa Fotoğraflar uygulamasından temizle.':
    'Bi rêz:<br><br>1 · Pêşî <b>kopiya ewle bigire</b> (Gerok → hevberkirin). Berî jêbirinê her tim kopî.<br>2 · Pakêta nexşeyê jê bibe (Gerok → ev telefon). Paşê dîsa tê daxistin.<br>3 · Vîdyo ne di sepanê de, <b>di galeriyê de</b> ne. Ger ew cih digirin ji sepana Wêneyan paqij bike.',
  'Tamam': 'Baş e',
  'Tek satır not': 'Notek rêzikek',
  'Tek satır yeter — sonradan açmadan ne olduğunu anlamak için.':
    'Rêzikek bes e — ji bo ku bêyî vekirinê fêm bikî çi bû.',
  'Tek satır yeter. Sonra açmadan ne olduğunu bilirsin.':
    'Rêzikek bes e. Paşê bêyî vekirinê tu dizanî çi bû.',
  'Tek tek ({0})': 'Yek bi yek ({0})',
  'Tekne sahibi, sabah 7 tavsiyesi': 'Xwediyê keştiyê, şîreta saet 7ê sibê',
  'Telefon, dosyanın nereye kaydedildiğini göremiyor — o yüzden "kaydedildi" yazısı bir <b>varsayım</b>. Az önce kaydettiğin dosyayı seç, açıp sayayım. Böylece yedeğin olduğunu <b>bilelim</b>.':
    'Telefon nabîne ku pel li ku hatiye tomarkirin — loma nivîsa "hate tomarkirin" <b>texmînek</b> e. Pelê ku te hinekî berê tomar kir hilbijêre, bila ez vekim û bijmêrim. Bi vî awayî bila em <b>bizanin</b> ku kopiya te heye.',
  'Toplam': 'Giştî',
  'Toplam {0} karo · {1}': 'Bi giştî {0} parçe · {1}',
  'Toplam: <b>{0}</b> · {1}<br>Her harcama kendi günündeki gerçek kurla çevrildi{2}.':
    'Giştî: <b>{0}</b> · {1}<br>Her xerc bi rêjeya rastîn a roja xwe hate wergerandin{2}.',
  'Toplam: <b>{0}</b><br>Para birimleri ayrı toplanıyor — tek toplam için Bağlantı → “Harcamaların kurunu düzelt”.':
    'Giştî: <b>{0}</b><br>Yekeyên diravî cuda tên berhevkirin — ji bo yek giştiyê Girêdan → “Rêjeya xercan rast bike”.',

  // ------------------------------------------------------ uygulama — E ---
  'Tur arşivlensin mi?': 'Geşt were arşîvkirin?',
  'Turu başlat': 'Geştê dest pê bike',
  'Turun <b>bütün kayıtları, sesli notları, fotoğraf önizlemeleri ve izi</b> telefondan gider.<br><br>Beş saniye "Geri al" düğmesi duracak; o geçtikten sonra <b>dönüşü yok</b>.<br><br>Yalnızca yer açmak istiyorsan <b>arşivle</b> yeter — o hiçbir şeyi silmiyor.':
    '<b>Hemû tomar, notên dengî, pêşdîtinên wêneyan û şopa</b> geştê ji telefonê diçin.<br><br>Pênc çirkeyan bişkoka "Vegerîne" wê bimîne; piştî wê <b>vegerandin tune</b>.<br><br>Ger tu tenê dixwazî cih vekî <b>arşîvkirin</b> bes e — ew tu tiştî jê nabe.',
  'Turun adı': 'Navê geştê',
  'Yaklaşıyorsun · {0}': 'Tu nêzîk dibî · {0}',
  'Yakında böyle bir yer yok.': 'Li nêzîk cihekî wisa tune.',
  'Yalnızca işaretlediklerin': 'Tenê yên te nîşankirî',
  'Yarım bir kayıt bulundu': 'Tomareke nîvcî hate dîtin',
  'Yazılı not': 'Nota nivîskî',
  'Yedek okundu': 'Kopiya ewle hate xwendin',
  'Yedekte olmayan kayıtlar — sesleriyle birlikte — silinecek. Geriye yedekteki {0} kayıt kalacak. Bu işlem geri alınamaz. Emin misin?':
    'Tomarên ku di kopiyê de nînin — bi dengên xwe re — wê werin jêbirin. {0} tomarên di kopiyê de wê bimînin. Ev kar nayê vegerandin. Tu bawer î?',
  'Yedektekiler eklenir. Telefondaki hiçbir şey silinmez — aynı kayıt iki kez eklenmez.':
    'Yên di kopiyê de tên zêdekirin. Di telefonê de tu tişt nayê jêbirin — heman tomar du caran nayê zêdekirin.',
  'Yedeği doğrulayalım': 'Bila em kopiya ewle piştrast bikin',
  'Yeni alan indir': 'Devereke nû daxîne',
  'Yeni güncelleme var': 'Rojanekirineke nû heye',
  'Yeni tur': 'Geşteke nû',
  'Yeni tur başlat': 'Geşteke nû dest pê bike',
  'Yer (isteğe bağlı)': 'Cih (bi dilê te)',
  'Yer azalıyor': 'Cih kêm dibe',
  'Yer açmak': 'Cih vekirin',
  'Yine de önce yedek almak en doğrusu: yedek dosyası telefondan bağımsız durur.':
    'Dîsa jî ya herî rast ew e ku pêşî kopiyeke ewle bigirî: pelê kopiyê ji telefonê serbixwe dimîne.',
  'Zaman çizgisinde göster': 'Li xeta demê nîşan bide',
  'başlıyor…': 'dest pê dike…',
  'birazdan biter': 'nêzîk e ku biqede',
  'bu dosya bitince duracak…': 'gava ev pel biqede wê raweste…',
  'dosya yok': 'pel tune',
  'geri getir': 'vegerîne',
  'internette ara': 'li înternetê bigere',
  'İnternette ara': 'Li înternetê bigere',
  'izin yok': 'destûr tune',
  'kayıt yarıda kalmış': 'tomar nîvcî maye',
  'makineden': 'ji makîneyê',
  'sokak': 'kolan',
  'yol': 'rê',
  'yukarıdakiyle birlikte çalışır': 'bi ya jorîn re bi hev re dixebite',
  '{0} boş yer kaldı. Uzun kayıt ve yedek için harita paketini silebilirsin — sonra yeniden indirilir.':
    '{0} cihê vala ma. Ji bo tomara dirêj û kopiya ewle tu dikarî pakêta nexşeyê jê bibî — paşê dîsa tê daxistin.',
  '{0} harcama': '{0} xerc',
  '{0} kaydı bu tura taşı': '{0} tomaran derbasî vê geştê bike',
  '{0} kayıt silinecek': '{0} tomar wê werin jêbirin',
  '{0} {1}\'de başlayan ses kaydı bitmeden uygulama kapanmış. Kaydedilen kısım duruyor.':
    'Tomara dengî ya ku {0} di {1}an de dest pê kir neqediya, sepan hate girtin. Beşa ku hate tomarkirin dimîne.',
  '{0} · bilgisini isteyeyim mi?': '{0} · ez agahiya wê bixwazim?',
  '{0} · yer aç': '{0} · cih veke',
  '{0} · {1} — saat değişmiyor.': '{0} · {1} — saet naguhere.',
  'Çevrimdışı harita alanları': 'Deverên nexşeyê yên bêînternet',
  'Önce yedek al': 'Pêşî kopiyeke ewle bigire',
  'Önce şimdiki hâli yedekle': 'Pêşî rewşa niha biparêze',
  'Örn. Tarçınlı tatlıyı saat kulesinin yanındaki dükkândan al.':
    'Mînak: şîraniya bi darçîn ji dikana li kêleka birca saetê bikire.',
  'önizlemesi çıkmadı — zaman çizgisinde resimsiz görünecekler. Saatleri ve yerleri duruyor, "Fotoğrafları aç" düğmesi galeride o ana götürüyor.':
    'pêşdîtina wan derneket — li xeta demê wê bêwêne xuya bikin. Saet û cihên wan dimînin, bişkoka "Wêneyan veke" te di galeriyê de dibe wê kêliyê.',
  'ör. Ohrid gölünde akşam': 'mînak: êvar li gola Ohridê',
  'İnternet geri geldi': 'Înternet vegeriya',
  'İnternet yokken yalnızca buradaki alanlar açılır. İnternet varken harita her yerde çalışır.':
    'Gava înternet tune be tenê deverên li vir vedibin. Gava înternet hebe nexşe li her derê dixebite.',
  'İste': 'Bixwaze',
  'İstersen ne olduğunu kendi cümlenle yaz (isteğe bağlı)':
    'Ger bixwazî bi hevoka xwe binivîse ka çi bû (bi dilê te)',
  'İzin ver': 'Destûrê bide',
  'İşaret kaydedilemedi': 'Nîşan nehate tomarkirin',
  'Şu anki turun kayıtları ekranlarda görünür. Arşivdekiler telefonda durur, karışmaz; istediğin an geri dönebilirsin.':
    'Tomarên geşta niha li ser ekranan xuya dibin. Yên di arşîvê de di telefonê de dimînin, tevlihev nabin; tu kengî bixwazî dikarî vegerî.',
  '≈ {0} · {1} karo · {2}': '≈ {0} · {1} parçe · {2}',
  '▶ Devam et': '▶ Berdewam bike',
  'Not': 'Not',
  'Overpass sunucularının hiçbiri cevap vermedi': 'Tu ji rajekarên Overpassê bersiv neda',
  'kur tablosu boş geldi': 'tabloya rêjeyan vala hat',
  'Kaç yılında doğdun?': 'Tu di kîjan salê de ji dayik bûyî?',
  'Yalnızca "50. yaşım" seçeneğinin hangi yıla denk geldiğini hesaplamak için. Telefonda kalır, hiçbir pakete girmez.':
    'Tenê ji bo hesabkirina ku vebijarka "50 saliya min" li kîjan salê tê. Di telefonê de dimîne, nakeve tu pakêtê.',
  'Parça listesi hiçbir adresten alınamadı': 'Lîsteya parçeyan ji tu navnîşanê nehate girtin',
  'harita parçaları okunamadı': 'parçeyên nexşeyê nehatin xwendin',
  'Haftanın günü': 'Roja hefteyê',
  'Aşağıdaki gezi açılacak. Şu ana kadar telefonda hiçbir şey değişmedi — değişiklik bu düğmeyle oluyor.':
    'Geşta jêrîn wê vebe. Heta niha di telefonê de tu tişt neguherî — guhertin bi vê bişkokê dibe.',
  'Başlıkları düzeltebilirsin. Bunlar zaman çizgisinde gün ayraçlarının üstünde yazacak.':
    'Tu dikarî sernavan rast bikî. Ev ê li xeta demê li ser veqetandekên rojan binivîsin.',
  'Bu JSON bir Gerok paketine benzemiyor.': 'Ev JSON naşibe pakêteke Gerokê.',
  'Bu düz bir metin. Hangi satır ne, uygulamanın bilmesi mümkün değil — sen söyle. Satıra her dokunuşta sırayla değişir: <b>gün başlığı</b> → <b>durak</b> → <b>not</b> → boş.':
    'Ev nivîseke sade ye. Ne mimkin e ku sepan bizanibe kîjan rêzik çi ye — tu bibêje. Her tikandina li rêzikê bi rêz diguhere: <b>sernavê rojê</b> → <b>rawestgeh</b> → <b>not</b> → vala.',
  'DURAK': 'RAWESTGEH',
  'GÜN': 'ROJ',
  'NOT': 'NOT',
  'Dosya': 'Pel',
  'Tür': 'Cure',
  'Gezi': 'Geşt',
  'Gün': 'Roj',
  'Dosyada gün bulunamadı. Sorun değil — duraklar günsüz de alınabilir, sonra tek tek güne taşırsın.':
    'Di pelî de roj nehate dîtin. Ne pirsgirêk e — rawestgeh bêroj jî tên girtin, tu paşê yek bi yek diguhezînî rojan.',
  'Doğu–batı': 'Rojhilat–rojava',
  'Kuzey–güney': 'Bakur–başûr',
  'Duraklara bağlı "unutma" notları. Durağa varınca ekrana bunlar düşecek.':
    'Notên "jibîrneke" yên bi rawestgehan ve girêdayî. Gava bigihîjî rawestgehê ev ê li ser ekranê derkevin.',
  'Gerok paketi': 'Pakêta Gerokê',
  'düz metin': 'nivîsa sade',
  'Gezi açılınca harita indirmeyi hatırlat': 'Gava geşt vebe daxistina nexşeyê bîne bîra min',
  'Hepsini seç': 'Hemûyan hilbijêre',
  'Hiçbirini seçme': 'Yekê jî hilnebijêre',
  'Koordinatlı durak': 'Rawestgeha bi koordînat',
  'Seçtiğin durakların kapladığı alan. Harita paketi ev wi-fi\'sinde bir kez inip telefonda kalıyor — yolda internet gerekmiyor.':
    'Devera ku rawestgehên te hilbijartî digirin. Pakêta nexşeyê carekê bi wi-fiya malê dadikeve û di telefonê de dimîne — di rê de înternet ne hewce ye.',
  'Tur programının <b>PDF</b>’i, bilgisayardan gelen gezi paketi (.gerok) ya da düz metin. PDF ise yazısı kendiliğinden okunuyor. Dosya yalnızca OKUNUYOR — bu adımda telefona hiçbir şey yazılmıyor.':
    '<b>PDF</b>a bernameya geştê, pakêta geştê ya ji komputerê (.gerok) an jî nivîsa sade. Ger PDF be nivîsa wê bi xwe tê xwendin. Pel tenê TÊ XWENDIN — di vê gavê de tu tişt li telefonê nayê nivîsandin.',
  'Vazgeç, hiçbir şey eklemeden çık': 'Betal bike, bêyî ku tiştekî zêde bikî derkeve',
  'istenmedi': 'nehate xwestin',
  'sonra indirilecek': 'paşê wê were daxistin',
  'Örn. sabah şehirden ayrılış': 'Mînak: sibê ji bajêr derketin',
  'İndirme burada başlamıyor: paket birkaç yüz megabayt olabiliyor ve mobil veriyle inmesi doğru olmaz. Gezi açıldıktan sonra Gerok → “Harita paketi indir”den, wi-fi\'deyken.':
    'Daxistin li vir dest pê nake: pakêt dikare çend sed megabayt be û bi daneya mobîl daxistina wê ne rast e. Piştî ku geşt vebû, ji Gerok → “Pakêta nexşeyê daxîne”, gava li ser wi-fiyê bî.',
  'İşaretli olanlar alınacak. İstemediğin durağı şimdi çıkarmak, sonra tek tek silmekten kolay.':
    'Yên nîşankirî wê werin girtin. Derxistina rawestgeha ku tu naxwazî niha, ji jêbirina yek bi yek a paşê hêsantir e.',
  'Şu anki gezin arşive geçmiyor, duruyor — Gerok → “Bütün geziler”den aralarında geçebilirsin.':
    'Geşta te ya niha naçe arşîvê, dimîne — ji Gerok → “Hemû geşt” tu dikarî di navbera wan de derbas bibî.',

  // ------------------------------------------------------ sihirbaz son ---
  'Programdaki notlar': 'Notên di bernameyê de',
  'İndirilecek harita paketleri': 'Pakêtên nexşeyê yên ku wê werin daxistin',

  // ------------------------------------------------- kılavuz sayfaları ---
  'şimdilik Türkçe': 'hê bi tirkî',
  'tamir kılavuzu · şimdilik Türkçe': 'rêbera tamîrê · hê bi tirkî',

  // ------------------------------------ kayıt türleri (veri.js TURLER) ---
  'Buradayım': 'Ez li vir im',
  'Tanıştığımız kişi': 'Kesê ku me nas kir',
  'Akşam günlüğü': 'Rojnivîska êvarê',
  'Sıradan kare': 'Kareya asayî',
  'Sınır geçişi': 'Derbasbûna sînor',

};
