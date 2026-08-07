/**
 * Destination photography — sourced from Wikimedia Commons, served locally.
 *
 * Every photo here is cleared for COMMERCIAL use: CC0, Public Domain, CC BY
 * or CC BY-SA only. Nothing carrying an NC (non-commercial) or ND
 * (no-derivatives) term is eligible. CC BY and CC BY-SA additionally oblige
 * us to name the author, which is why `credit` and `license` are required
 * fields rather than optional metadata — <PhotoGallery> renders them.
 *
 * Files live in /public/destinations/<slug>/<n>.jpg, resized to <=1600px wide
 * and kept under 250 KB each.
 *
 * This file is generated — keep it in sync with the files on disk.
 */

export type DestinationPhoto = {
  src: string;
  alt: string;
  /** Author, as required by CC BY / CC BY-SA attribution terms. */
  credit: string;
  license: string;
  /** Commons file page, the canonical proof of licence. */
  sourceUrl: string;
};

export const DESTINATION_PHOTOS: Record<string, DestinationPhoto[]> = {
  'tokyo': [
    {
      src: '/destinations/tokyo/1.jpg',
      alt: 'Visitors walking beneath the red Hozomon gate at Senso-ji temple in Asakusa, Tokyo',
      credit: 'LMP 2001',
      license: 'CC BY-SA 4.0',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Sensoji_Temple_Asakusa_Tokyo_2024-12-02.jpg',
    },
    {
      src: '/destinations/tokyo/2.jpg',
      alt: 'Tokyo\'s skyline stretching to the horizon with Mount Fuji rising behind it',
      credit: 'Syced',
      license: 'CC0',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Shibuya_and_Mount_Fuji_seen_from_Roppongi_Hills.jpg',
    },
    {
      src: '/destinations/tokyo/3.jpg',
      alt: 'Crowds crossing the Shibuya Scramble intersection beneath Tokyo\'s neon billboards',
      credit: 'Yoshikazu TAKADA',
      license: 'CC BY 2.0',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Shibuya_Scramble_Crossing_(31000739560).jpg',
    },
  ],
  'bali': [
    {
      src: '/destinations/bali/1.jpg',
      alt: 'Terraced rice paddies carved into a palm-covered hillside at Tegallalang, Bali',
      credit: 'Philip Nalangan',
      license: 'CC BY 4.0',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Tegallalang_Rice_Terraces_Bali.jpg',
    },
    {
      src: '/destinations/bali/2.jpg',
      alt: 'The sea temple of Tanah Lot on Bali\'s rocky western coast',
      credit: 'Jakub Hałun',
      license: 'CC BY-SA 4.0',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Tanah_Lot,_Bali,_Indonesia,_20220827_1008_1159.jpg',
    },
    {
      src: '/destinations/bali/3.jpg',
      alt: 'The tiered pagoda of Pura Ulun Danu Bratan standing on Lake Bratan, Bali',
      credit: 'CEphoto, Uwe Aranas',
      license: 'CC BY-SA 3.0',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Brantan_Bali_Pura-Ulun-Danu-Bratan-01.jpg',
    },
  ],
  'lisbon': [
    {
      src: '/destinations/lisbon/1.jpg',
      alt: 'A red vintage tram climbing a narrow street in central Lisbon',
      credit: 'wampile',
      license: 'Public domain',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Tram_on_Rua_Paiva_de_Andrade,_Lisbon_Portugal_-_2008.jpg',
    },
    {
      src: '/destinations/lisbon/2.jpg',
      alt: 'Terracotta rooftops of the Alfama district sloping toward the Tagus river in Lisbon',
      credit: 'Dale Cruse',
      license: 'CC BY 4.0',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Alfama_Rooftops_and_Tagus_River_View,_Lisbon_(54733698959).jpg',
    },
    {
      src: '/destinations/lisbon/3.jpg',
      alt: 'Praca do Comercio and Lisbon\'s riverfront seen from above, with the Tagus beyond',
      credit: 'NorbertNagel',
      license: 'CC BY-SA 4.0',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Praca_do_Comercio_-_Lisbon_-_Portugal.jpg',
    },
  ],
  'marrakech': [
    {
      src: '/destinations/marrakech/1.jpg',
      alt: 'The minaret of the Koutoubia Mosque rising above palm gardens in Marrakech',
      credit: 'Jorge Franganillo',
      license: 'CC BY 2.0',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Marrakech_Koutoubia_Mosque_(54273634927).jpg',
    },
    {
      src: '/destinations/marrakech/2.jpg',
      alt: 'The tiled courtyard and central fountain of the Bahia Palace in Marrakech',
      credit: 'Val Traveler',
      license: 'CC BY-SA 4.0',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Bahia_Palace_large_court.jpg',
    },
    {
      src: '/destinations/marrakech/3.jpg',
      alt: 'Carved arches around the courtyard pool of the Ben Youssef Madrasa in Marrakech',
      credit: 'Tom Neys',
      license: 'Public domain',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Marrakech_medersa-ben-youssef.jpg',
    },
  ],
  'istanbul': [
    {
      src: '/destinations/istanbul/1.jpg',
      alt: 'The domes and minarets of Hagia Sophia behind a fountain in Istanbul',
      credit: 'Alvesgaspar',
      license: 'CC BY-SA 4.0',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Hagia_Sophia_Istanbul_July_2022-1.jpg',
    },
    {
      src: '/destinations/istanbul/2.jpg',
      alt: 'A ferry crossing the Bosphorus with the Istanbul skyline and Hagia Sophia behind',
      credit: 'Moonik',
      license: 'CC BY-SA 3.0',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Sultanahmet_ferry_on_the_Bosphorus_in_Istanbul,_Turkey_001.jpg',
    },
    {
      src: '/destinations/istanbul/3.jpg',
      alt: 'The Sultan Ahmed Mosque and its six minarets under a clear sky in Istanbul',
      credit: 'kallerna',
      license: 'CC BY-SA 4.0',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Sultan_Ahmed_Mosque_2022_5.jpg',
    },
  ],
  'mexico-city': [
    {
      src: '/destinations/mexico-city/1.jpg',
      alt: 'The golden dome of the Palacio de Bellas Artes amid the rooftops of Mexico City',
      credit: 'Diego Delso',
      license: 'CC BY-SA 4.0',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Palacio_de_Bellas_Artes,_Ciudad_de_M%C3%A9xico,_M%C3%A9xico,_2015-07-18,_DD_10.JPG',
    },
    {
      src: '/destinations/mexico-city/2.jpg',
      alt: 'The Metropolitan Cathedral on the Zocalo, Mexico City\'s main square',
      credit: 'Jeff Kramer',
      license: 'CC BY 2.0',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Mexico_City_Zocalo_Cathedral.jpg',
    },
    {
      src: '/destinations/mexico-city/3.jpg',
      alt: 'The Angel of Independence monument on Paseo de la Reforma, Mexico City',
      credit: 'Carlos Valenzuela',
      license: 'CC BY-SA 4.0',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Angel_de_la_independencia170409.jpg',
    },
  ],
  'cape-town': [
    {
      src: '/destinations/cape-town/1.jpg',
      alt: 'The cliffs of Table Mountain dropping to the Atlantic coastline at Cape Town',
      credit: 'Dietmar Rabich',
      license: 'CC BY-SA 4.0',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Cape_Town_(ZA),_Table_Mountain_--_2024_--_2762%2B64%2B66%2B68%2B70%2B72.jpg',
    },
    {
      src: '/destinations/cape-town/2.jpg',
      alt: 'Brightly painted houses lining Wale Street in Cape Town\'s Bo-Kaap quarter',
      credit: 'Moheen Reeyad',
      license: 'CC BY-SA 4.0',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Wale_Street,_Bo-Kaap_(01).jpg',
    },
    {
      src: '/destinations/cape-town/3.jpg',
      alt: 'The red Clock Tower and moored boats at Cape Town\'s V&A Waterfront',
      credit: 'Dietmar Rabich',
      license: 'CC BY-SA 4.0',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Cape_Town_(ZA),_Waterfront,_Clock_Tower_--_2024_--_3036.jpg',
    },
  ],
  'buenos-aires': [
    {
      src: '/destinations/buenos-aires/1.jpg',
      alt: 'The neoclassical facade of the Teatro Colon opera house in Buenos Aires',
      credit: 'EEJCC',
      license: 'CC0',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Fachada_del_Teatro_Col%C3%B3n_en_Buenos_Aires,_Argentina.jpg',
    },
    {
      src: '/destinations/buenos-aires/2.jpg',
      alt: 'Vividly painted buildings along Caminito in the La Boca district of Buenos Aires',
      credit: 'DerHexer',
      license: 'CC BY-SA 4.0',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:2018-10-19_La_Boca,_Buenos_Aires,_Argentina_(Martin_Rulsch)_10.jpg',
    },
    {
      src: '/destinations/buenos-aires/3.jpg',
      alt: 'The pink facade of the Casa Rosada presidential palace in Buenos Aires',
      credit: 'Nathália Buzetto',
      license: 'CC BY-SA 4.0',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Casa_Rosada,_Buenos_Aires.JPG',
    },
  ],
  'reykjavik': [
    {
      src: '/destinations/reykjavik/1.jpg',
      alt: 'Aerial view over the colourful rooftops of central Reykjavik',
      credit: 'Andrew Smales bn2b',
      license: 'CC0',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Reykjavik,_Iceland_aerial_cityscape_(Unsplash).jpg',
    },
    {
      src: '/destinations/reykjavik/2.jpg',
      alt: 'Reykjavik\'s houses and bay seen from the tower of Hallgrimskirkja',
      credit: 'Jakub Hałun',
      license: 'CC BY-SA 4.0',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:View_of_Reykjav%C3%ADk_from_Hallgr%C3%ADmskirkja,_20230507_1229_5733.jpg',
    },
    {
      src: '/destinations/reykjavik/3.jpg',
      alt: 'Reykjavik\'s harbour with the Harpa concert hall under a blue sky',
      credit: 'Helgi Halldórsson',
      license: 'CC BY-SA 2.0',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Reykjavik%27s_harbor_(5893660208).jpg',
    },
  ],
  'kyoto': [
    {
      src: '/destinations/kyoto/1.jpg',
      alt: 'A tunnel of vermilion torii gates climbing the hillside at Fushimi Inari shrine, Kyoto',
      credit: 'Balon Greyjoy',
      license: 'CC0',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:20181110_Fushimi_Inari_Torii_9.jpg',
    },
    {
      src: '/destinations/kyoto/2.jpg',
      alt: 'Tall green stalks in the Arashiyama bamboo grove, Kyoto',
      credit: 'Basile Morin',
      license: 'CC BY-SA 4.0',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Bamboo_Forest,_Arashiyama,_Kyoto,_Japan.jpg',
    },
    {
      src: '/destinations/kyoto/3.jpg',
      alt: 'The gold-leafed Kinkaku-ji pavilion above its reflecting pond in Kyoto',
      credit: 'Nacaru',
      license: 'CC BY-SA 4.0',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Golden_Pavilion_Kinkaku-ji_2024.jpg',
    },
  ],
};

export const TRAVEL_STYLE_PHOTOS: Record<string, DestinationPhoto> = {
  'backpacker': {
    src: '/travel-styles/backpacker.jpg',
    alt: 'A hiker with a backpack walking a trail through green mountains',
    credit: 'Hermann',
    license: 'CC0',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Mountaineering_Man_Trail_Path_Mountains.jpg',
  },
  'business': {
    src: '/travel-styles/business.jpg',
    alt: 'The wing of an airliner above a bank of sunlit clouds',
    credit: 'U.S. Department of Agriculture',
    license: 'Public domain',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:A_wing_tip_of_an_airplane_(40118125441).jpg',
  },
  'family': {
    src: '/travel-styles/family.jpg',
    alt: 'A turquoise bay framed by tropical palms and greenery',
    credit: 'Government of the U.S. Virgin Islands',
    license: 'Public domain',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:USVI_IMG_5166_-_Tropical_foliage_frames_a_serene_beach_and_turquoise_water_with_palm_trees_swaying_gently_in_the_breeze.jpg',
  },
  'luxury': {
    src: '/travel-styles/luxury.jpg',
    alt: 'A large resort swimming pool lined with palm trees and sun loungers',
    credit: 'Steffen Mokosch',
    license: 'CC BY-SA 4.0',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Swimming_pool_at_Cala_Millor_Park_Hotel.jpg',
  },
};

/**
 * Look up a city's photos. Tolerant of casing and spacing, so callers can
 * pass a display name ("Mexico City") or a slug ("mexico-city").
 */
export function getPhotos(city: string): DestinationPhoto[] {
  if (!city) return [];
  const slug = city
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');
  return DESTINATION_PHOTOS[slug] ?? [];
}
