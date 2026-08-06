// Gerok — harita stilleri.
//
// Üç kip var:
//   gunduz — açık renkli, gün ışığında araç camından okunacak şekilde kontrastlı
//   gece   — koyu, gece yolculuğunda göz almasın diye
//   uydu   — gerçek uydu görüntüsü (İNTERNET İSTER, offline çalışmaz)
//
// Yazı tipleri uygulamanın içinde: yazi/<takım>/<aralık>.pbf. Latin, Latin
// genişletilmiş (č ć š ž đ ğ ş), Yunan ve Kiril aralıkları var — Balkanlar'da
// tabelalar hem Latin hem Kiril.

const YAZI = 'yazi/{fontstack}/{range}.pbf';

// Tabelada ne yazıyorsa haritada da o yazsın. Ama "Скопје" tek başına bir şey
// söylemiyor — Kiril/Yunan yazılı adların ALTINA okunabilir karşılığı düşüyor.
//
// İkinci satır yalnızca yazı Latin DEĞİLKEN ekleniyor. Latin adlarda eklenseydi
// OSM'deki tuhaf çeviriler de gelirdi (Podgorica'nın Türkçesi "Böğürtlen"
// yazıyor) — okunabilen bir adı bozmanın anlamı yok.
const YER_ADI = [
  'case',
  ['all',
    ['has', 'script'], ['!=', ['get', 'script'], 'Latin'],
    ['any', ['has', 'name:tr'], ['has', 'name:en']]],
  ['concat', ['get', 'name'], '\n', ['coalesce', ['get', 'name:tr'], ['get', 'name:en']]],
  ['coalesce', ['get', 'name'], ['get', 'name:en'], '']
];

// Ülke adlarında Türkçesi her zaman yazılıyor: altı ülke, altısı da bilinen ad.
const ULKE_ADI = [
  'case',
  ['all', ['has', 'name:tr'], ['!=', ['get', 'name:tr'], ['get', 'name']]],
  ['concat', ['get', 'name'], '\n', ['get', 'name:tr']],
  ['coalesce', ['get', 'name'], '']
];

const YOL_ADI = ['coalesce', ['get', 'name'], ''];

const RENKLER = {
  gunduz: {
    zemin: '#e8e2d6', toprak: '#f7f4ed',
    yesil: '#cfe0bd', tarim: '#eef0da', kent: '#ece6db', park: '#d6e7c4',
    su: '#9ec9e2', suKenar: '#7fb3d1',
    yapi: '#ded6c8', yapiKenar: '#cec4b3',
    // Otoyol sarı, ana yol krem: gün ışığında beyaz yol beyaz zeminde kayboluyor.
    yolAna: '#ffcc70', yolAnaKenar: '#b9701c',
    yolOrta: '#fff6e2', yolOrtaKenar: '#a89179',
    yolKucuk: '#ffffff', yolKucukKenar: '#c4b8a3',
    sinir: '#9b7d5e',
    yazi: '#2f2a24', yaziHale: '#ffffff',
    suYazi: '#2c5f80', yolYazi: '#5a5044'
  },
  gece: {
    zemin: '#14120f', toprak: '#1e1b17',
    yesil: '#1f2a1c', tarim: '#232019', kent: '#232019', park: '#1f2a1c',
    su: '#16283a', suKenar: '#1d3550',
    yapi: '#312b25', yapiKenar: '#3a332b',
    yolAna: '#9a8468', yolAnaKenar: '#5e4f3c',
    yolOrta: '#7a6b57', yolOrtaKenar: '#4a4033',
    yolKucuk: '#635648', yolKucukKenar: '#3a332b',
    sinir: '#8a7259',
    yazi: '#f0ebe5', yaziHale: '#12100e',
    suYazi: '#8fb8d6', yolYazi: '#b8ac9c'
  }
};

// Uydu görüntüsünün üstünde yazılar her zaman beyaz-siyah kontrastıyla okunur.
const UYDU_YAZI = { yazi: '#ffffff', yaziHale: '#000000', suYazi: '#cfe8ff', yolYazi: '#f0e6d8' };

export const UYDU_KAYNAK = {
  type: 'raster',
  tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
  tileSize: 256,
  maxzoom: 18,
  attribution: 'Esri, Maxar, Earthstar Geographics'
};

// ---- Etiket katmanları ----------------------------------------------------
// Zemin ne olursa olsun (vektör ya da uydu) aynı yazılar kullanılıyor.

function etiketler(r) {
  return [
    { id: 'su-yazi', type: 'symbol', source: 'temel', 'source-layer': 'water',
      minzoom: 8,
      filter: ['all', ['has', 'name'], ['in', ['get', 'kind'], ['literal', ['lake', 'sea', 'ocean', 'water', 'river']]]],
      layout: {
        'text-field': YER_ADI, 'text-font': ['noto-regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 8, 11, 14, 14],
        'text-max-width': 8, 'text-letter-spacing': 0.08
      },
      paint: { 'text-color': r.suYazi, 'text-halo-color': r.yaziHale, 'text-halo-width': 1.2 } },

    { id: 'yol-yazi', type: 'symbol', source: 'temel', 'source-layer': 'roads',
      minzoom: 13,
      filter: ['has', 'name'],
      layout: {
        'text-field': YOL_ADI, 'text-font': ['noto-regular'],
        'text-size': 11.5, 'symbol-placement': 'line', 'text-max-angle': 30,
        'symbol-spacing': 260
      },
      paint: { 'text-color': r.yolYazi, 'text-halo-color': r.yaziHale, 'text-halo-width': 1.6 } },

    // Köy, mahalle — yalnızca iyice yaklaşınca.
    { id: 'yer-kucuk', type: 'symbol', source: 'temel', 'source-layer': 'places',
      minzoom: 11,
      filter: ['in', ['get', 'kind_detail'], ['literal', ['village', 'hamlet', 'suburb', 'quarter', 'neighbourhood', 'isolated_dwelling']]],
      layout: {
        'text-field': YER_ADI, 'text-font': ['noto-regular'], 'text-size': 11.5,
        'text-max-width': 9, 'text-padding': 4
      },
      paint: { 'text-color': r.yazi, 'text-halo-color': r.yaziHale, 'text-halo-width': 1.8 } },

    { id: 'yer-orta', type: 'symbol', source: 'temel', 'source-layer': 'places',
      minzoom: 8,
      filter: ['==', ['get', 'kind_detail'], 'town'],
      layout: {
        'text-field': YER_ADI, 'text-font': ['noto-medium'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 8, 12, 13, 15],
        'text-max-width': 9, 'text-padding': 6,
        'symbol-sort-key': ['-', 30, ['coalesce', ['get', 'population_rank'], 0]]
      },
      paint: { 'text-color': r.yazi, 'text-halo-color': r.yaziHale, 'text-halo-width': 1.8 } },

    // Şehirler: küçük bir nokta + iki satır ad. Yolda en çok bakılan katman bu.
    { id: 'yer-buyuk-nokta', type: 'circle', source: 'temel', 'source-layer': 'places',
      minzoom: 4, maxzoom: 12,
      filter: ['==', ['get', 'kind_detail'], 'city'],
      paint: {
        'circle-radius': 3, 'circle-color': r.yazi,
        'circle-stroke-width': 1.5, 'circle-stroke-color': r.yaziHale
      } },

    { id: 'yer-buyuk', type: 'symbol', source: 'temel', 'source-layer': 'places',
      minzoom: 4,
      filter: ['==', ['get', 'kind_detail'], 'city'],
      layout: {
        'text-field': YER_ADI, 'text-font': ['noto-medium'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 4, 12, 8, 15, 13, 19],
        'text-max-width': 9, 'text-padding': 8,
        'text-offset': [0, 0.9], 'text-anchor': 'top',
        'symbol-sort-key': ['-', 30, ['coalesce', ['get', 'population_rank'], 0]]
      },
      paint: { 'text-color': r.yazi, 'text-halo-color': r.yaziHale, 'text-halo-width': 2 } },

    // Ülke adları yalnızca uzaktan bakarken.
    { id: 'ulke-yazi', type: 'symbol', source: 'temel', 'source-layer': 'places',
      minzoom: 3, maxzoom: 8,
      filter: ['==', ['get', 'kind'], 'country'],
      layout: {
        'text-field': ULKE_ADI, 'text-font': ['noto-medium'], 'text-size': 13,
        'text-letter-spacing': 0.18, 'text-transform': 'uppercase', 'text-max-width': 8
      },
      paint: { 'text-color': r.yazi, 'text-halo-color': r.yaziHale, 'text-halo-width': 2, 'text-opacity': 0.85 } }
  ];
}

// ---- Vektör zemin ---------------------------------------------------------

function zeminKatmanlari(r) {
  return [
    { id: 'zemin', type: 'background', paint: { 'background-color': r.zemin } },

    { id: 'toprak', type: 'fill', source: 'temel', 'source-layer': 'earth',
      paint: { 'fill-color': r.toprak } },

    { id: 'ortu', type: 'fill', source: 'temel', 'source-layer': 'landcover',
      paint: {
        'fill-color': ['match', ['get', 'kind'],
          'forest', r.yesil, 'scrub', r.yesil, 'grassland', r.yesil,
          'farmland', r.tarim, 'urban_area', r.kent,
          r.tarim],
        'fill-opacity': 0.75
      } },

    { id: 'arazi', type: 'fill', source: 'temel', 'source-layer': 'landuse',
      paint: {
        'fill-color': ['match', ['get', 'kind'],
          'park', r.park, 'forest', r.park, 'nature_reserve', r.park,
          'garden', r.park, 'grass', r.park, 'pitch', r.park,
          'cemetery', r.park, 'golf_course', r.park,
          'beach', r.tarim, 'farmland', r.tarim,
          r.kent],
        'fill-opacity': 0.7
      } },

    { id: 'su', type: 'fill', source: 'temel', 'source-layer': 'water',
      paint: { 'fill-color': r.su } },

    { id: 'yapilar', type: 'fill', source: 'temel', 'source-layer': 'buildings',
      minzoom: 13,
      paint: { 'fill-color': r.yapi, 'fill-outline-color': r.yapiKenar } },

    // Yollar iki katmanlı çiziliyor: altta kılıf, üstte gövde. Tek çizgi olunca
    // açık zeminde kayboluyor, kılıf onu zeminden ayırıyor.
    { id: 'yol-kucuk-kilif', type: 'line', source: 'temel', 'source-layer': 'roads',
      minzoom: 12,
      filter: ['in', ['get', 'kind'], ['literal', ['minor_road', 'other', 'path']]],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': r.yolKucukKenar,
               'line-width': ['interpolate', ['linear'], ['zoom'], 12, 1.6, 17, 8] } },
    { id: 'yol-kucuk', type: 'line', source: 'temel', 'source-layer': 'roads',
      minzoom: 12,
      filter: ['in', ['get', 'kind'], ['literal', ['minor_road', 'other', 'path']]],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': r.yolKucuk,
               'line-width': ['interpolate', ['linear'], ['zoom'], 12, 0.7, 17, 6] } },

    { id: 'yol-orta-kilif', type: 'line', source: 'temel', 'source-layer': 'roads',
      minzoom: 8,
      filter: ['in', ['get', 'kind'], ['literal', ['medium_road', 'major_road']]],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': r.yolOrtaKenar,
               'line-width': ['interpolate', ['linear'], ['zoom'], 8, 2, 16, 11] } },
    { id: 'yol-orta', type: 'line', source: 'temel', 'source-layer': 'roads',
      minzoom: 8,
      filter: ['in', ['get', 'kind'], ['literal', ['medium_road', 'major_road']]],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': r.yolOrta,
               'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1, 16, 8] } },

    { id: 'yol-ana-kilif', type: 'line', source: 'temel', 'source-layer': 'roads',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      filter: ['==', ['get', 'kind'], 'highway'],
      paint: { 'line-color': r.yolAnaKenar,
               'line-width': ['interpolate', ['linear'], ['zoom'], 5, 2.2, 16, 14] } },
    { id: 'yol-ana', type: 'line', source: 'temel', 'source-layer': 'roads',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      filter: ['==', ['get', 'kind'], 'highway'],
      paint: { 'line-color': r.yolAna,
               'line-width': ['interpolate', ['linear'], ['zoom'], 5, 1, 16, 10] } },

    { id: 'sinirlar', type: 'line', source: 'temel', 'source-layer': 'boundaries',
      paint: {
        'line-color': r.sinir,
        'line-width': ['case', ['==', ['get', 'kind'], 'country'], 1.8, 1],
        'line-dasharray': [3, 2],
        'line-opacity': 0.8
      } }
  ];
}

// ---- Dışa açılan ----------------------------------------------------------

export const KIPLER = [
  { id: 'gunduz', ad: 'Gündüz', internet: false },
  { id: 'gece', ad: 'Gece', internet: false },
  { id: 'uydu', ad: 'Uydu', internet: true }
];

// Harita indirilmeden önce gösterilen boş zemin.
// Yazı tipi burada da tanımlı: harita paketi olmayan biri de kendi duraklarını
// koyup adlarını görebilsin — glyphs olmadan MapLibre tek bir harf çizmiyor,
// iğneler numarasız kalırdı.
export const BOS_STIL = {
  version: 8,
  glyphs: YAZI,
  sources: {},
  layers: [{ id: 'zemin', type: 'background', paint: { 'background-color': '#1c1917' } }]
};

export function stilUret(kip = 'gunduz') {
  const pmtilesKaynak = { temel: { type: 'vector', url: 'pmtiles://harita' } };

  if (kip === 'uydu') {
    return {
      version: 8,
      glyphs: YAZI,
      sources: { ...pmtilesKaynak, uydu: UYDU_KAYNAK },
      layers: [
        { id: 'zemin', type: 'background', paint: { 'background-color': '#0d0f12' } },
        { id: 'uydu-goruntu', type: 'raster', source: 'uydu', paint: { 'raster-opacity': 1 } },
        // Uydu görüntüsünde yol ağı seçilmiyor; ana yollar üstüne ince çiziliyor.
        { id: 'yol-ana', type: 'line', source: 'temel', 'source-layer': 'roads',
          filter: ['==', ['get', 'kind'], 'highway'],
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#ffd9a0', 'line-opacity': 0.7,
                   'line-width': ['interpolate', ['linear'], ['zoom'], 6, 1, 16, 5] } },
        { id: 'sinirlar', type: 'line', source: 'temel', 'source-layer': 'boundaries',
          filter: ['==', ['get', 'kind'], 'country'],
          paint: { 'line-color': '#ffffff', 'line-width': 1.4, 'line-dasharray': [3, 2], 'line-opacity': 0.6 } },
        ...etiketler(UYDU_YAZI)
      ]
    };
  }

  const r = RENKLER[kip] || RENKLER.gunduz;
  return {
    version: 8,
    glyphs: YAZI,
    sources: pmtilesKaynak,
    layers: [...zeminKatmanlari(r), ...etiketler(r)]
  };
}
