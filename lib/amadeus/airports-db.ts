// Comprehensive airport & airline database for realistic flight generation

export interface Airport {
  iata: string;
  name: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
}

export const AIRPORTS: Airport[] = [
  // France
  { iata: 'CDG', name: 'Charles de Gaulle Airport', city: 'Paris', country: 'France', lat: 49.01, lng: 2.55 },
  { iata: 'ORY', name: 'Paris Orly Airport', city: 'Paris', country: 'France', lat: 48.72, lng: 2.38 },
  { iata: 'NCE', name: 'Nice Cote d\'Azur Airport', city: 'Nice', country: 'France', lat: 43.66, lng: 7.22 },
  { iata: 'MRS', name: 'Marseille Provence Airport', city: 'Marseille', country: 'France', lat: 43.44, lng: 5.22 },
  { iata: 'LYS', name: 'Lyon-Saint Exupery Airport', city: 'Lyon', country: 'France', lat: 45.73, lng: 5.08 },
  { iata: 'TLS', name: 'Toulouse-Blagnac Airport', city: 'Toulouse', country: 'France', lat: 43.63, lng: 1.36 },
  { iata: 'BOD', name: 'Bordeaux-Merignac Airport', city: 'Bordeaux', country: 'France', lat: 44.83, lng: -0.72 },
  { iata: 'NTE', name: 'Nantes Atlantique Airport', city: 'Nantes', country: 'France', lat: 47.15, lng: -1.61 },
  // UK
  { iata: 'LHR', name: 'Heathrow Airport', city: 'London', country: 'United Kingdom', lat: 51.47, lng: -0.45 },
  { iata: 'LGW', name: 'Gatwick Airport', city: 'London', country: 'United Kingdom', lat: 51.15, lng: -0.18 },
  { iata: 'STN', name: 'Stansted Airport', city: 'London', country: 'United Kingdom', lat: 51.89, lng: 0.24 },
  { iata: 'MAN', name: 'Manchester Airport', city: 'Manchester', country: 'United Kingdom', lat: 53.35, lng: -2.27 },
  { iata: 'EDI', name: 'Edinburgh Airport', city: 'Edinburgh', country: 'United Kingdom', lat: 55.95, lng: -3.37 },
  // Germany
  { iata: 'FRA', name: 'Frankfurt Airport', city: 'Frankfurt', country: 'Germany', lat: 50.04, lng: 8.56 },
  { iata: 'MUC', name: 'Munich Airport', city: 'Munich', country: 'Germany', lat: 48.35, lng: 11.79 },
  { iata: 'BER', name: 'Berlin Brandenburg Airport', city: 'Berlin', country: 'Germany', lat: 52.37, lng: 13.50 },
  { iata: 'DUS', name: 'Dusseldorf Airport', city: 'Dusseldorf', country: 'Germany', lat: 51.28, lng: 6.77 },
  { iata: 'HAM', name: 'Hamburg Airport', city: 'Hamburg', country: 'Germany', lat: 53.63, lng: 9.99 },
  // Spain
  { iata: 'MAD', name: 'Adolfo Suarez Madrid-Barajas', city: 'Madrid', country: 'Spain', lat: 40.50, lng: -3.57 },
  { iata: 'BCN', name: 'Barcelona El Prat Airport', city: 'Barcelona', country: 'Spain', lat: 41.30, lng: 2.08 },
  { iata: 'PMI', name: 'Palma de Mallorca Airport', city: 'Palma de Mallorca', country: 'Spain', lat: 39.55, lng: 2.74 },
  { iata: 'AGP', name: 'Malaga Airport', city: 'Malaga', country: 'Spain', lat: 36.67, lng: -4.49 },
  // Italy
  { iata: 'FCO', name: 'Leonardo da Vinci Airport', city: 'Rome', country: 'Italy', lat: 41.80, lng: 12.24 },
  { iata: 'MXP', name: 'Milan Malpensa Airport', city: 'Milan', country: 'Italy', lat: 45.63, lng: 8.73 },
  { iata: 'VCE', name: 'Venice Marco Polo Airport', city: 'Venice', country: 'Italy', lat: 45.51, lng: 12.35 },
  { iata: 'NAP', name: 'Naples International Airport', city: 'Naples', country: 'Italy', lat: 40.88, lng: 14.29 },
  // Netherlands, Belgium, Switzerland, Austria
  { iata: 'AMS', name: 'Amsterdam Schiphol Airport', city: 'Amsterdam', country: 'Netherlands', lat: 52.31, lng: 4.77 },
  { iata: 'BRU', name: 'Brussels Airport', city: 'Brussels', country: 'Belgium', lat: 50.90, lng: 4.48 },
  { iata: 'ZRH', name: 'Zurich Airport', city: 'Zurich', country: 'Switzerland', lat: 47.46, lng: 8.55 },
  { iata: 'GVA', name: 'Geneva Airport', city: 'Geneva', country: 'Switzerland', lat: 46.24, lng: 6.11 },
  { iata: 'VIE', name: 'Vienna International Airport', city: 'Vienna', country: 'Austria', lat: 48.11, lng: 16.57 },
  // Scandinavia
  { iata: 'CPH', name: 'Copenhagen Airport', city: 'Copenhagen', country: 'Denmark', lat: 55.62, lng: 12.65 },
  { iata: 'OSL', name: 'Oslo Gardermoen Airport', city: 'Oslo', country: 'Norway', lat: 60.19, lng: 11.10 },
  { iata: 'ARN', name: 'Stockholm Arlanda Airport', city: 'Stockholm', country: 'Sweden', lat: 59.65, lng: 17.92 },
  { iata: 'HEL', name: 'Helsinki-Vantaa Airport', city: 'Helsinki', country: 'Finland', lat: 60.32, lng: 24.96 },
  // Portugal
  { iata: 'LIS', name: 'Lisbon Portela Airport', city: 'Lisbon', country: 'Portugal', lat: 38.78, lng: -9.14 },
  { iata: 'OPO', name: 'Francisco Sa Carneiro Airport', city: 'Porto', country: 'Portugal', lat: 41.24, lng: -8.68 },
  { iata: 'FAO', name: 'Faro Airport', city: 'Faro', country: 'Portugal', lat: 37.01, lng: -7.97 },
  { iata: 'FNC', name: 'Madeira Airport', city: 'Funchal', country: 'Portugal', lat: 32.69, lng: -16.77 },
  // Greece
  { iata: 'ATH', name: 'Athens International Airport', city: 'Athens', country: 'Greece', lat: 37.94, lng: 23.94 },
  { iata: 'SKG', name: 'Thessaloniki Airport', city: 'Thessaloniki', country: 'Greece', lat: 40.52, lng: 22.97 },
  { iata: 'HER', name: 'Heraklion Airport', city: 'Heraklion', country: 'Greece', lat: 35.34, lng: 25.18 },
  { iata: 'JTR', name: 'Santorini Airport', city: 'Santorini', country: 'Greece', lat: 36.40, lng: 25.48 },
  { iata: 'JMK', name: 'Mykonos Airport', city: 'Mykonos', country: 'Greece', lat: 37.44, lng: 25.35 },
  { iata: 'RHO', name: 'Rhodes Airport', city: 'Rhodes', country: 'Greece', lat: 36.41, lng: 28.09 },
  { iata: 'CFU', name: 'Corfu International Airport', city: 'Corfu', country: 'Greece', lat: 39.60, lng: 19.91 },
  // Turkey
  { iata: 'IST', name: 'Istanbul Airport', city: 'Istanbul', country: 'Turkey', lat: 41.28, lng: 28.75 },
  { iata: 'SAW', name: 'Sabiha Gokcen International', city: 'Istanbul', country: 'Turkey', lat: 40.90, lng: 29.31 },
  { iata: 'AYT', name: 'Antalya Airport', city: 'Antalya', country: 'Turkey', lat: 36.90, lng: 30.80 },
  { iata: 'ESB', name: 'Ankara Esenboga Airport', city: 'Ankara', country: 'Turkey', lat: 40.12, lng: 32.99 },
  { iata: 'ADB', name: 'Adnan Menderes Airport', city: 'Izmir', country: 'Turkey', lat: 38.29, lng: 27.15 },
  { iata: 'BJV', name: 'Milas-Bodrum Airport', city: 'Bodrum', country: 'Turkey', lat: 37.25, lng: 27.66 },
  // Ireland & UK secondary
  { iata: 'DUB', name: 'Dublin Airport', city: 'Dublin', country: 'Ireland', lat: 53.42, lng: -6.27 },
  { iata: 'ORK', name: 'Cork Airport', city: 'Cork', country: 'Ireland', lat: 51.84, lng: -8.49 },
  // Central & Eastern Europe
  { iata: 'WAW', name: 'Warsaw Chopin Airport', city: 'Warsaw', country: 'Poland', lat: 52.17, lng: 20.97 },
  { iata: 'KRK', name: 'John Paul II International', city: 'Krakow', country: 'Poland', lat: 50.08, lng: 19.79 },
  { iata: 'GDN', name: 'Gdansk Lech Walesa Airport', city: 'Gdansk', country: 'Poland', lat: 54.38, lng: 18.47 },
  { iata: 'PRG', name: 'Vaclav Havel Airport', city: 'Prague', country: 'Czech Republic', lat: 50.10, lng: 14.26 },
  { iata: 'BUD', name: 'Budapest Ferenc Liszt Airport', city: 'Budapest', country: 'Hungary', lat: 47.44, lng: 19.26 },
  { iata: 'OTP', name: 'Henri Coanda International', city: 'Bucharest', country: 'Romania', lat: 44.57, lng: 26.08 },
  { iata: 'SOF', name: 'Sofia Airport', city: 'Sofia', country: 'Bulgaria', lat: 42.69, lng: 23.41 },
  { iata: 'BEG', name: 'Belgrade Nikola Tesla Airport', city: 'Belgrade', country: 'Serbia', lat: 44.82, lng: 20.31 },
  { iata: 'ZAG', name: 'Zagreb Franjo Tudman Airport', city: 'Zagreb', country: 'Croatia', lat: 45.74, lng: 16.07 },
  { iata: 'SPU', name: 'Split Airport', city: 'Split', country: 'Croatia', lat: 43.54, lng: 16.30 },
  { iata: 'DBV', name: 'Dubrovnik Airport', city: 'Dubrovnik', country: 'Croatia', lat: 42.56, lng: 18.27 },
  { iata: 'LJU', name: 'Ljubljana Jose Pucnik Airport', city: 'Ljubljana', country: 'Slovenia', lat: 46.22, lng: 14.46 },
  { iata: 'TIA', name: 'Tirana International Airport', city: 'Tirana', country: 'Albania', lat: 41.42, lng: 19.72 },
  { iata: 'KEF', name: 'Keflavik International Airport', city: 'Reykjavik', country: 'Iceland', lat: 63.99, lng: -22.61 },
  { iata: 'RIX', name: 'Riga International Airport', city: 'Riga', country: 'Latvia', lat: 56.92, lng: 23.97 },
  { iata: 'TLL', name: 'Tallinn Airport', city: 'Tallinn', country: 'Estonia', lat: 59.41, lng: 24.83 },
  { iata: 'VNO', name: 'Vilnius Airport', city: 'Vilnius', country: 'Lithuania', lat: 54.64, lng: 25.29 },
  { iata: 'SVO', name: 'Sheremetyevo International', city: 'Moscow', country: 'Russia', lat: 55.97, lng: 37.41 },
  { iata: 'LED', name: 'Pulkovo Airport', city: 'Saint Petersburg', country: 'Russia', lat: 59.80, lng: 30.26 },
  { iata: 'KBP', name: 'Boryspil International', city: 'Kyiv', country: 'Ukraine', lat: 50.35, lng: 30.89 },
  // Spain secondary
  { iata: 'SVQ', name: 'Seville Airport', city: 'Seville', country: 'Spain', lat: 37.42, lng: -5.90 },
  { iata: 'VLC', name: 'Valencia Airport', city: 'Valencia', country: 'Spain', lat: 39.49, lng: -0.48 },
  { iata: 'BIO', name: 'Bilbao Airport', city: 'Bilbao', country: 'Spain', lat: 43.30, lng: -2.91 },
  { iata: 'ALC', name: 'Alicante Airport', city: 'Alicante', country: 'Spain', lat: 38.28, lng: -0.56 },
  { iata: 'IBZ', name: 'Ibiza Airport', city: 'Ibiza', country: 'Spain', lat: 38.87, lng: 1.37 },
  { iata: 'LPA', name: 'Gran Canaria Airport', city: 'Las Palmas', country: 'Spain', lat: 27.93, lng: -15.39 },
  { iata: 'TFS', name: 'Tenerife South Airport', city: 'Tenerife', country: 'Spain', lat: 28.04, lng: -16.57 },
  // Italy secondary
  { iata: 'BLQ', name: 'Bologna Guglielmo Marconi', city: 'Bologna', country: 'Italy', lat: 44.53, lng: 11.29 },
  { iata: 'FLR', name: 'Florence Peretola Airport', city: 'Florence', country: 'Italy', lat: 43.81, lng: 11.20 },
  { iata: 'PSA', name: 'Pisa International Airport', city: 'Pisa', country: 'Italy', lat: 43.68, lng: 10.39 },
  { iata: 'LIN', name: 'Milan Linate Airport', city: 'Milan', country: 'Italy', lat: 45.44, lng: 9.27 },
  { iata: 'BGY', name: 'Milan Bergamo Airport', city: 'Milan', country: 'Italy', lat: 45.66, lng: 9.70 },
  { iata: 'CTA', name: 'Catania-Fontanarossa Airport', city: 'Catania', country: 'Italy', lat: 37.47, lng: 15.06 },
  { iata: 'PMO', name: 'Palermo Airport', city: 'Palermo', country: 'Italy', lat: 38.18, lng: 13.10 },
  { iata: 'BRI', name: 'Bari Airport', city: 'Bari', country: 'Italy', lat: 41.14, lng: 16.76 },
  // France secondary
  { iata: 'BVA', name: 'Beauvais-Tille Airport', city: 'Paris', country: 'France', lat: 49.45, lng: 2.11 },
  { iata: 'BIQ', name: 'Biarritz Pays Basque Airport', city: 'Biarritz', country: 'France', lat: 43.47, lng: -1.53 },
  { iata: 'MPL', name: 'Montpellier Mediterranee', city: 'Montpellier', country: 'France', lat: 43.58, lng: 3.96 },
  { iata: 'SXB', name: 'Strasbourg Airport', city: 'Strasbourg', country: 'France', lat: 48.54, lng: 7.63 },
  { iata: 'AJA', name: 'Ajaccio Napoleon Bonaparte', city: 'Ajaccio', country: 'France', lat: 41.92, lng: 8.80 },
  // Germany secondary
  { iata: 'STR', name: 'Stuttgart Airport', city: 'Stuttgart', country: 'Germany', lat: 48.69, lng: 9.22 },
  { iata: 'CGN', name: 'Cologne Bonn Airport', city: 'Cologne', country: 'Germany', lat: 50.87, lng: 7.14 },
  { iata: 'HAJ', name: 'Hannover Airport', city: 'Hannover', country: 'Germany', lat: 52.46, lng: 9.68 },
  { iata: 'NUE', name: 'Nuremberg Airport', city: 'Nuremberg', country: 'Germany', lat: 49.50, lng: 11.08 },
  // UK secondary
  { iata: 'LTN', name: 'London Luton Airport', city: 'London', country: 'United Kingdom', lat: 51.87, lng: -0.37 },
  { iata: 'LCY', name: 'London City Airport', city: 'London', country: 'United Kingdom', lat: 51.50, lng: 0.05 },
  { iata: 'BHX', name: 'Birmingham Airport', city: 'Birmingham', country: 'United Kingdom', lat: 52.45, lng: -1.75 },
  { iata: 'BRS', name: 'Bristol Airport', city: 'Bristol', country: 'United Kingdom', lat: 51.38, lng: -2.72 },
  { iata: 'GLA', name: 'Glasgow Airport', city: 'Glasgow', country: 'United Kingdom', lat: 55.87, lng: -4.43 },
  { iata: 'LPL', name: 'Liverpool John Lennon Airport', city: 'Liverpool', country: 'United Kingdom', lat: 53.33, lng: -2.85 },
  // United States
  { iata: 'JFK', name: 'John F. Kennedy International', city: 'New York', country: 'United States', lat: 40.64, lng: -73.78 },
  { iata: 'LGA', name: 'LaGuardia Airport', city: 'New York', country: 'United States', lat: 40.78, lng: -73.87 },
  { iata: 'EWR', name: 'Newark Liberty International', city: 'Newark', country: 'United States', lat: 40.69, lng: -74.17 },
  { iata: 'LAX', name: 'Los Angeles International', city: 'Los Angeles', country: 'United States', lat: 33.94, lng: -118.41 },
  { iata: 'ORD', name: 'O\'Hare International Airport', city: 'Chicago', country: 'United States', lat: 41.97, lng: -87.91 },
  { iata: 'MDW', name: 'Chicago Midway International', city: 'Chicago', country: 'United States', lat: 41.79, lng: -87.75 },
  { iata: 'SFO', name: 'San Francisco International', city: 'San Francisco', country: 'United States', lat: 37.62, lng: -122.38 },
  { iata: 'OAK', name: 'Oakland International Airport', city: 'Oakland', country: 'United States', lat: 37.72, lng: -122.22 },
  { iata: 'SJC', name: 'San Jose International Airport', city: 'San Jose', country: 'United States', lat: 37.36, lng: -121.93 },
  { iata: 'MIA', name: 'Miami International Airport', city: 'Miami', country: 'United States', lat: 25.80, lng: -80.29 },
  { iata: 'FLL', name: 'Fort Lauderdale-Hollywood International', city: 'Fort Lauderdale', country: 'United States', lat: 26.07, lng: -80.15 },
  { iata: 'MCO', name: 'Orlando International Airport', city: 'Orlando', country: 'United States', lat: 28.43, lng: -81.31 },
  { iata: 'TPA', name: 'Tampa International Airport', city: 'Tampa', country: 'United States', lat: 27.98, lng: -82.53 },
  { iata: 'ATL', name: 'Hartsfield-Jackson Atlanta', city: 'Atlanta', country: 'United States', lat: 33.64, lng: -84.43 },
  { iata: 'DFW', name: 'Dallas/Fort Worth International', city: 'Dallas', country: 'United States', lat: 32.90, lng: -97.04 },
  { iata: 'DAL', name: 'Dallas Love Field', city: 'Dallas', country: 'United States', lat: 32.85, lng: -96.85 },
  { iata: 'IAH', name: 'George Bush Intercontinental', city: 'Houston', country: 'United States', lat: 29.98, lng: -95.34 },
  { iata: 'AUS', name: 'Austin-Bergstrom International', city: 'Austin', country: 'United States', lat: 30.19, lng: -97.67 },
  { iata: 'SAT', name: 'San Antonio International', city: 'San Antonio', country: 'United States', lat: 29.53, lng: -98.47 },
  { iata: 'BOS', name: 'Boston Logan International', city: 'Boston', country: 'United States', lat: 42.37, lng: -71.01 },
  { iata: 'SEA', name: 'Seattle-Tacoma International', city: 'Seattle', country: 'United States', lat: 47.45, lng: -122.31 },
  { iata: 'PDX', name: 'Portland International Airport', city: 'Portland', country: 'United States', lat: 45.59, lng: -122.60 },
  { iata: 'DEN', name: 'Denver International Airport', city: 'Denver', country: 'United States', lat: 39.86, lng: -104.67 },
  { iata: 'PHX', name: 'Phoenix Sky Harbor International', city: 'Phoenix', country: 'United States', lat: 33.43, lng: -112.01 },
  { iata: 'LAS', name: 'Harry Reid International Airport', city: 'Las Vegas', country: 'United States', lat: 36.08, lng: -115.15 },
  { iata: 'SLC', name: 'Salt Lake City International', city: 'Salt Lake City', country: 'United States', lat: 40.79, lng: -111.98 },
  { iata: 'SAN', name: 'San Diego International', city: 'San Diego', country: 'United States', lat: 32.73, lng: -117.19 },
  { iata: 'IAD', name: 'Washington Dulles International', city: 'Washington D.C.', country: 'United States', lat: 38.94, lng: -77.46 },
  { iata: 'DCA', name: 'Ronald Reagan Washington National', city: 'Washington D.C.', country: 'United States', lat: 38.85, lng: -77.04 },
  { iata: 'BWI', name: 'Baltimore/Washington International', city: 'Baltimore', country: 'United States', lat: 39.18, lng: -76.67 },
  { iata: 'PHL', name: 'Philadelphia International', city: 'Philadelphia', country: 'United States', lat: 39.87, lng: -75.24 },
  { iata: 'CLT', name: 'Charlotte Douglas International', city: 'Charlotte', country: 'United States', lat: 35.21, lng: -80.94 },
  { iata: 'DTW', name: 'Detroit Metropolitan Airport', city: 'Detroit', country: 'United States', lat: 42.21, lng: -83.35 },
  { iata: 'MSP', name: 'Minneapolis-Saint Paul International', city: 'Minneapolis', country: 'United States', lat: 44.88, lng: -93.22 },
  { iata: 'MSY', name: 'Louis Armstrong New Orleans', city: 'New Orleans', country: 'United States', lat: 29.99, lng: -90.26 },
  { iata: 'HNL', name: 'Daniel K. Inouye International', city: 'Honolulu', country: 'United States', lat: 21.32, lng: -157.92 },
  { iata: 'ANC', name: 'Ted Stevens Anchorage International', city: 'Anchorage', country: 'United States', lat: 61.17, lng: -149.99 },
  // Canada
  { iata: 'YUL', name: 'Montreal-Trudeau International', city: 'Montreal', country: 'Canada', lat: 45.47, lng: -73.74 },
  { iata: 'YYZ', name: 'Toronto Pearson International', city: 'Toronto', country: 'Canada', lat: 43.68, lng: -79.62 },
  { iata: 'YVR', name: 'Vancouver International Airport', city: 'Vancouver', country: 'Canada', lat: 49.20, lng: -123.18 },
  { iata: 'YYC', name: 'Calgary International Airport', city: 'Calgary', country: 'Canada', lat: 51.12, lng: -114.01 },
  { iata: 'YEG', name: 'Edmonton International Airport', city: 'Edmonton', country: 'Canada', lat: 53.31, lng: -113.58 },
  { iata: 'YOW', name: 'Ottawa Macdonald-Cartier', city: 'Ottawa', country: 'Canada', lat: 45.32, lng: -75.67 },
  { iata: 'YHZ', name: 'Halifax Stanfield International', city: 'Halifax', country: 'Canada', lat: 44.88, lng: -63.51 },
  { iata: 'YWG', name: 'Winnipeg Richardson International', city: 'Winnipeg', country: 'Canada', lat: 49.91, lng: -97.24 },
  // Mexico & Caribbean
  { iata: 'MEX', name: 'Mexico City International', city: 'Mexico City', country: 'Mexico', lat: 19.44, lng: -99.07 },
  { iata: 'CUN', name: 'Cancun International Airport', city: 'Cancun', country: 'Mexico', lat: 21.04, lng: -86.88 },
  { iata: 'GDL', name: 'Guadalajara International', city: 'Guadalajara', country: 'Mexico', lat: 20.52, lng: -103.31 },
  { iata: 'PVR', name: 'Puerto Vallarta International', city: 'Puerto Vallarta', country: 'Mexico', lat: 20.68, lng: -105.25 },
  { iata: 'SJD', name: 'Los Cabos International', city: 'Los Cabos', country: 'Mexico', lat: 23.15, lng: -109.72 },
  { iata: 'HAV', name: 'Jose Marti International Airport', city: 'Havana', country: 'Cuba', lat: 22.99, lng: -82.41 },
  { iata: 'NAS', name: 'Lynden Pindling International', city: 'Nassau', country: 'Bahamas', lat: 25.04, lng: -77.47 },
  { iata: 'SJU', name: 'Luis Munoz Marin International', city: 'San Juan', country: 'Puerto Rico', lat: 18.44, lng: -66.00 },
  { iata: 'PUJ', name: 'Punta Cana International', city: 'Punta Cana', country: 'Dominican Republic', lat: 18.57, lng: -68.36 },
  { iata: 'SDQ', name: 'Las Americas International', city: 'Santo Domingo', country: 'Dominican Republic', lat: 18.43, lng: -69.66 },
  { iata: 'MBJ', name: 'Sangster International Airport', city: 'Montego Bay', country: 'Jamaica', lat: 18.50, lng: -77.91 },
  { iata: 'KIN', name: 'Norman Manley International', city: 'Kingston', country: 'Jamaica', lat: 17.94, lng: -76.78 },
  // Central America
  { iata: 'PTY', name: 'Tocumen International Airport', city: 'Panama City', country: 'Panama', lat: 9.07, lng: -79.38 },
  { iata: 'SJO', name: 'Juan Santamaria International', city: 'San Jose', country: 'Costa Rica', lat: 9.99, lng: -84.20 },
  { iata: 'GUA', name: 'La Aurora International Airport', city: 'Guatemala City', country: 'Guatemala', lat: 14.58, lng: -90.53 },
  // East Asia
  { iata: 'NRT', name: 'Narita International Airport', city: 'Tokyo', country: 'Japan', lat: 35.76, lng: 140.39 },
  { iata: 'HND', name: 'Tokyo Haneda Airport', city: 'Tokyo', country: 'Japan', lat: 35.55, lng: 139.78 },
  { iata: 'KIX', name: 'Kansai International Airport', city: 'Osaka', country: 'Japan', lat: 34.43, lng: 135.24 },
  { iata: 'ITM', name: 'Osaka Itami Airport', city: 'Osaka', country: 'Japan', lat: 34.78, lng: 135.44 },
  { iata: 'NGO', name: 'Chubu Centrair International', city: 'Nagoya', country: 'Japan', lat: 34.86, lng: 136.81 },
  { iata: 'FUK', name: 'Fukuoka Airport', city: 'Fukuoka', country: 'Japan', lat: 33.58, lng: 130.45 },
  { iata: 'CTS', name: 'New Chitose Airport', city: 'Sapporo', country: 'Japan', lat: 42.77, lng: 141.69 },
  { iata: 'OKA', name: 'Naha Airport', city: 'Okinawa', country: 'Japan', lat: 26.20, lng: 127.65 },
  { iata: 'ICN', name: 'Incheon International Airport', city: 'Seoul', country: 'South Korea', lat: 37.46, lng: 126.44 },
  { iata: 'GMP', name: 'Gimpo International Airport', city: 'Seoul', country: 'South Korea', lat: 37.56, lng: 126.80 },
  { iata: 'PUS', name: 'Gimhae International Airport', city: 'Busan', country: 'South Korea', lat: 35.18, lng: 128.94 },
  { iata: 'TPE', name: 'Taoyuan International Airport', city: 'Taipei', country: 'Taiwan', lat: 25.08, lng: 121.23 },
  // China
  { iata: 'PEK', name: 'Beijing Capital International', city: 'Beijing', country: 'China', lat: 40.08, lng: 116.60 },
  { iata: 'PKX', name: 'Beijing Daxing International', city: 'Beijing', country: 'China', lat: 39.51, lng: 116.41 },
  { iata: 'PVG', name: 'Shanghai Pudong International', city: 'Shanghai', country: 'China', lat: 31.14, lng: 121.81 },
  { iata: 'SHA', name: 'Shanghai Hongqiao International', city: 'Shanghai', country: 'China', lat: 31.20, lng: 121.34 },
  { iata: 'HKG', name: 'Hong Kong International Airport', city: 'Hong Kong', country: 'China', lat: 22.31, lng: 113.92 },
  { iata: 'CAN', name: 'Guangzhou Baiyun International', city: 'Guangzhou', country: 'China', lat: 23.39, lng: 113.30 },
  { iata: 'SZX', name: 'Shenzhen Baoan International', city: 'Shenzhen', country: 'China', lat: 22.64, lng: 113.81 },
  { iata: 'CTU', name: 'Chengdu Shuangliu International', city: 'Chengdu', country: 'China', lat: 30.58, lng: 103.95 },
  { iata: 'XIY', name: 'Xian Xianyang International', city: 'Xian', country: 'China', lat: 34.45, lng: 108.75 },
  { iata: 'MFM', name: 'Macau International Airport', city: 'Macau', country: 'China', lat: 22.15, lng: 113.59 },
  // Southeast Asia
  { iata: 'SIN', name: 'Singapore Changi Airport', city: 'Singapore', country: 'Singapore', lat: 1.36, lng: 103.99 },
  { iata: 'BKK', name: 'Suvarnabhumi Airport', city: 'Bangkok', country: 'Thailand', lat: 13.69, lng: 100.75 },
  { iata: 'DMK', name: 'Don Mueang International', city: 'Bangkok', country: 'Thailand', lat: 13.91, lng: 100.61 },
  { iata: 'HKT', name: 'Phuket International Airport', city: 'Phuket', country: 'Thailand', lat: 8.11, lng: 98.31 },
  { iata: 'CNX', name: 'Chiang Mai International', city: 'Chiang Mai', country: 'Thailand', lat: 18.77, lng: 98.96 },
  { iata: 'KBV', name: 'Krabi International Airport', city: 'Krabi', country: 'Thailand', lat: 8.10, lng: 98.99 },
  { iata: 'USM', name: 'Koh Samui Airport', city: 'Koh Samui', country: 'Thailand', lat: 9.55, lng: 100.06 },
  { iata: 'KUL', name: 'Kuala Lumpur International', city: 'Kuala Lumpur', country: 'Malaysia', lat: 2.75, lng: 101.71 },
  { iata: 'PEN', name: 'Penang International Airport', city: 'Penang', country: 'Malaysia', lat: 5.30, lng: 100.27 },
  { iata: 'CGK', name: 'Soekarno-Hatta International', city: 'Jakarta', country: 'Indonesia', lat: -6.13, lng: 106.66 },
  { iata: 'DPS', name: 'Ngurah Rai International', city: 'Bali', country: 'Indonesia', lat: -8.75, lng: 115.17 },
  { iata: 'MNL', name: 'Ninoy Aquino International', city: 'Manila', country: 'Philippines', lat: 14.51, lng: 121.02 },
  { iata: 'CEB', name: 'Mactan-Cebu International', city: 'Cebu', country: 'Philippines', lat: 10.31, lng: 123.98 },
  { iata: 'HAN', name: 'Noi Bai International Airport', city: 'Hanoi', country: 'Vietnam', lat: 21.22, lng: 105.81 },
  { iata: 'SGN', name: 'Tan Son Nhat International', city: 'Ho Chi Minh City', country: 'Vietnam', lat: 10.82, lng: 106.65 },
  { iata: 'DAD', name: 'Da Nang International Airport', city: 'Da Nang', country: 'Vietnam', lat: 16.04, lng: 108.20 },
  { iata: 'PNH', name: 'Phnom Penh International', city: 'Phnom Penh', country: 'Cambodia', lat: 11.55, lng: 104.84 },
  { iata: 'REP', name: 'Siem Reap International', city: 'Siem Reap', country: 'Cambodia', lat: 13.41, lng: 103.81 },
  { iata: 'RGN', name: 'Yangon International Airport', city: 'Yangon', country: 'Myanmar', lat: 16.91, lng: 96.13 },
  // South Asia
  { iata: 'DEL', name: 'Indira Gandhi International', city: 'New Delhi', country: 'India', lat: 28.56, lng: 77.10 },
  { iata: 'BOM', name: 'Chhatrapati Shivaji Maharaj', city: 'Mumbai', country: 'India', lat: 19.09, lng: 72.87 },
  { iata: 'BLR', name: 'Kempegowda International', city: 'Bangalore', country: 'India', lat: 13.20, lng: 77.71 },
  { iata: 'MAA', name: 'Chennai International Airport', city: 'Chennai', country: 'India', lat: 12.99, lng: 80.17 },
  { iata: 'HYD', name: 'Rajiv Gandhi International', city: 'Hyderabad', country: 'India', lat: 17.23, lng: 78.43 },
  { iata: 'CCU', name: 'Netaji Subhas Chandra Bose', city: 'Kolkata', country: 'India', lat: 22.65, lng: 88.45 },
  { iata: 'COK', name: 'Cochin International Airport', city: 'Kochi', country: 'India', lat: 10.15, lng: 76.40 },
  { iata: 'GOI', name: 'Goa International Airport', city: 'Goa', country: 'India', lat: 15.38, lng: 73.83 },
  { iata: 'CMB', name: 'Bandaranaike International', city: 'Colombo', country: 'Sri Lanka', lat: 7.18, lng: 79.88 },
  { iata: 'KTM', name: 'Tribhuvan International', city: 'Kathmandu', country: 'Nepal', lat: 27.70, lng: 85.36 },
  { iata: 'MLE', name: 'Male Velana International', city: 'Male', country: 'Maldives', lat: 4.19, lng: 73.53 },
  { iata: 'ISB', name: 'Islamabad International Airport', city: 'Islamabad', country: 'Pakistan', lat: 33.56, lng: 72.83 },
  { iata: 'KHI', name: 'Jinnah International Airport', city: 'Karachi', country: 'Pakistan', lat: 24.91, lng: 67.16 },
  { iata: 'LHE', name: 'Allama Iqbal International', city: 'Lahore', country: 'Pakistan', lat: 31.52, lng: 74.40 },
  { iata: 'DAC', name: 'Hazrat Shahjalal International', city: 'Dhaka', country: 'Bangladesh', lat: 23.84, lng: 90.40 },
  // Middle East
  { iata: 'DXB', name: 'Dubai International Airport', city: 'Dubai', country: 'UAE', lat: 25.25, lng: 55.37 },
  { iata: 'DWC', name: 'Al Maktoum International Airport', city: 'Dubai', country: 'UAE', lat: 24.89, lng: 55.16 },
  { iata: 'SHJ', name: 'Sharjah International Airport', city: 'Sharjah', country: 'UAE', lat: 25.33, lng: 55.52 },
  { iata: 'AUH', name: 'Abu Dhabi International Airport', city: 'Abu Dhabi', country: 'UAE', lat: 24.43, lng: 54.65 },
  { iata: 'DOH', name: 'Hamad International Airport', city: 'Doha', country: 'Qatar', lat: 25.27, lng: 51.61 },
  { iata: 'RUH', name: 'King Khalid International', city: 'Riyadh', country: 'Saudi Arabia', lat: 24.96, lng: 46.70 },
  { iata: 'JED', name: 'King Abdulaziz International', city: 'Jeddah', country: 'Saudi Arabia', lat: 21.68, lng: 39.15 },
  { iata: 'MED', name: 'Prince Mohammad bin Abdulaziz', city: 'Medina', country: 'Saudi Arabia', lat: 24.55, lng: 39.70 },
  { iata: 'KWI', name: 'Kuwait International Airport', city: 'Kuwait City', country: 'Kuwait', lat: 29.23, lng: 47.97 },
  { iata: 'BAH', name: 'Bahrain International Airport', city: 'Manama', country: 'Bahrain', lat: 26.27, lng: 50.63 },
  { iata: 'MCT', name: 'Muscat International Airport', city: 'Muscat', country: 'Oman', lat: 23.59, lng: 58.28 },
  { iata: 'BEY', name: 'Beirut-Rafic Hariri International', city: 'Beirut', country: 'Lebanon', lat: 33.82, lng: 35.49 },
  { iata: 'AMM', name: 'Queen Alia International', city: 'Amman', country: 'Jordan', lat: 31.72, lng: 35.99 },
  { iata: 'TLV', name: 'Ben Gurion Airport', city: 'Tel Aviv', country: 'Israel', lat: 32.01, lng: 34.89 },
  // Africa
  { iata: 'CAI', name: 'Cairo International Airport', city: 'Cairo', country: 'Egypt', lat: 30.12, lng: 31.41 },
  { iata: 'HRG', name: 'Hurghada International Airport', city: 'Hurghada', country: 'Egypt', lat: 27.18, lng: 33.80 },
  { iata: 'SSH', name: 'Sharm El Sheikh International', city: 'Sharm El Sheikh', country: 'Egypt', lat: 27.98, lng: 34.39 },
  { iata: 'JNB', name: 'O.R. Tambo International', city: 'Johannesburg', country: 'South Africa', lat: -26.14, lng: 28.25 },
  { iata: 'CPT', name: 'Cape Town International', city: 'Cape Town', country: 'South Africa', lat: -33.97, lng: 18.60 },
  // Morocco
  { iata: 'CMN', name: 'Mohammed V International', city: 'Casablanca', country: 'Morocco', lat: 33.37, lng: -7.59 },
  { iata: 'RAK', name: 'Marrakech Menara Airport', city: 'Marrakech', country: 'Morocco', lat: 31.61, lng: -8.04 },
  { iata: 'AGA', name: 'Agadir Al Massira Airport', city: 'Agadir', country: 'Morocco', lat: 30.38, lng: -9.55 },
  { iata: 'FEZ', name: 'Fes-Saiss Airport', city: 'Fes', country: 'Morocco', lat: 33.93, lng: -4.97 },
  { iata: 'TNG', name: 'Tangier Ibn Battouta Airport', city: 'Tangier', country: 'Morocco', lat: 35.72, lng: -5.91 },
  { iata: 'RBA', name: 'Rabat-Sale Airport', city: 'Rabat', country: 'Morocco', lat: 34.05, lng: -6.75 },
  // Tunisia & Algeria
  { iata: 'TUN', name: 'Tunis-Carthage International', city: 'Tunis', country: 'Tunisia', lat: 36.85, lng: 10.23 },
  { iata: 'DJE', name: 'Djerba-Zarzis International', city: 'Djerba', country: 'Tunisia', lat: 33.87, lng: 10.77 },
  { iata: 'MIR', name: 'Monastir Habib Bourguiba', city: 'Monastir', country: 'Tunisia', lat: 35.76, lng: 10.75 },
  { iata: 'NBE', name: 'Enfidha-Hammamet International', city: 'Enfidha', country: 'Tunisia', lat: 36.08, lng: 10.44 },
  { iata: 'ALG', name: 'Houari Boumediene Airport', city: 'Algiers', country: 'Algeria', lat: 36.69, lng: 3.22 },
  { iata: 'ORN', name: 'Es Senia Airport', city: 'Oran', country: 'Algeria', lat: 35.62, lng: -0.62 },
  // West & East Africa
  { iata: 'DKR', name: 'Blaise Diagne International', city: 'Dakar', country: 'Senegal', lat: 14.67, lng: -17.07 },
  { iata: 'LOS', name: 'Murtala Muhammed International', city: 'Lagos', country: 'Nigeria', lat: 6.58, lng: 3.32 },
  { iata: 'ACC', name: 'Kotoka International Airport', city: 'Accra', country: 'Ghana', lat: 5.61, lng: -0.17 },
  { iata: 'ADD', name: 'Addis Ababa Bole International', city: 'Addis Ababa', country: 'Ethiopia', lat: 8.98, lng: 38.80 },
  { iata: 'NBO', name: 'Jomo Kenyatta International', city: 'Nairobi', country: 'Kenya', lat: -1.32, lng: 36.93 },
  { iata: 'ZNZ', name: 'Abeid Amani Karume International', city: 'Zanzibar', country: 'Tanzania', lat: -6.22, lng: 39.22 },
  // Oceania
  { iata: 'SYD', name: 'Sydney Kingsford Smith', city: 'Sydney', country: 'Australia', lat: -33.95, lng: 151.18 },
  { iata: 'MEL', name: 'Melbourne Airport', city: 'Melbourne', country: 'Australia', lat: -37.67, lng: 144.84 },
  { iata: 'BNE', name: 'Brisbane Airport', city: 'Brisbane', country: 'Australia', lat: -27.38, lng: 153.12 },
  { iata: 'PER', name: 'Perth Airport', city: 'Perth', country: 'Australia', lat: -31.94, lng: 115.97 },
  { iata: 'ADL', name: 'Adelaide Airport', city: 'Adelaide', country: 'Australia', lat: -34.95, lng: 138.53 },
  { iata: 'CNS', name: 'Cairns Airport', city: 'Cairns', country: 'Australia', lat: -16.89, lng: 145.75 },
  { iata: 'OOL', name: 'Gold Coast Airport', city: 'Gold Coast', country: 'Australia', lat: -28.16, lng: 153.50 },
  { iata: 'AKL', name: 'Auckland Airport', city: 'Auckland', country: 'New Zealand', lat: -37.01, lng: 174.79 },
  { iata: 'CHC', name: 'Christchurch Airport', city: 'Christchurch', country: 'New Zealand', lat: -43.49, lng: 172.53 },
  { iata: 'WLG', name: 'Wellington International', city: 'Wellington', country: 'New Zealand', lat: -41.33, lng: 174.80 },
  { iata: 'NAN', name: 'Nadi International Airport', city: 'Nadi', country: 'Fiji', lat: -17.76, lng: 177.44 },
  { iata: 'PPT', name: 'Faaa International Airport', city: 'Papeete', country: 'French Polynesia', lat: -17.55, lng: -149.61 },
  // South America
  { iata: 'GRU', name: 'Sao Paulo-Guarulhos International', city: 'Sao Paulo', country: 'Brazil', lat: -23.44, lng: -46.47 },
  { iata: 'GIG', name: 'Rio de Janeiro-Galeao International', city: 'Rio de Janeiro', country: 'Brazil', lat: -22.81, lng: -43.25 },
  { iata: 'BSB', name: 'Brasilia International Airport', city: 'Brasilia', country: 'Brazil', lat: -15.87, lng: -47.92 },
  { iata: 'SSA', name: 'Salvador International Airport', city: 'Salvador', country: 'Brazil', lat: -12.91, lng: -38.33 },
  { iata: 'FOR', name: 'Fortaleza International Airport', city: 'Fortaleza', country: 'Brazil', lat: -3.78, lng: -38.53 },
  { iata: 'REC', name: 'Recife International Airport', city: 'Recife', country: 'Brazil', lat: -8.13, lng: -34.92 },
  { iata: 'EZE', name: 'Ministro Pistarini International', city: 'Buenos Aires', country: 'Argentina', lat: -34.82, lng: -58.54 },
  { iata: 'AEP', name: 'Jorge Newbery Airfield', city: 'Buenos Aires', country: 'Argentina', lat: -34.56, lng: -58.42 },
  { iata: 'MVD', name: 'Carrasco International Airport', city: 'Montevideo', country: 'Uruguay', lat: -34.84, lng: -56.03 },
  { iata: 'BOG', name: 'El Dorado International Airport', city: 'Bogota', country: 'Colombia', lat: 4.70, lng: -74.15 },
  { iata: 'CTG', name: 'Rafael Nunez International', city: 'Cartagena', country: 'Colombia', lat: 10.44, lng: -75.51 },
  { iata: 'MDE', name: 'Jose Maria Cordova International', city: 'Medellin', country: 'Colombia', lat: 6.17, lng: -75.42 },
  { iata: 'SCL', name: 'Santiago International Airport', city: 'Santiago', country: 'Chile', lat: -33.39, lng: -70.79 },
  { iata: 'LIM', name: 'Jorge Chavez International', city: 'Lima', country: 'Peru', lat: -12.02, lng: -77.11 },
  { iata: 'CUZ', name: 'Alejandro Velasco Astete', city: 'Cusco', country: 'Peru', lat: -13.54, lng: -71.94 },
  { iata: 'UIO', name: 'Mariscal Sucre International', city: 'Quito', country: 'Ecuador', lat: -0.13, lng: -78.36 },
  { iata: 'GYE', name: 'Jose Joaquin de Olmedo', city: 'Guayaquil', country: 'Ecuador', lat: -2.16, lng: -79.88 },
  { iata: 'CCS', name: 'Simon Bolivar International', city: 'Caracas', country: 'Venezuela', lat: 10.60, lng: -66.99 },
  { iata: 'LPB', name: 'El Alto International Airport', city: 'La Paz', country: 'Bolivia', lat: -16.51, lng: -68.19 },
];

export interface Airline {
  code: string;
  name: string;
  hubs: string[];
  type: 'full-service' | 'low-cost';
  priceMultiplier: number;
}

export const AIRLINES: Airline[] = [
  // European full-service
  { code: 'AF', name: 'Air France', hubs: ['CDG', 'ORY'], type: 'full-service', priceMultiplier: 1.0 },
  { code: 'BA', name: 'British Airways', hubs: ['LHR', 'LGW'], type: 'full-service', priceMultiplier: 1.1 },
  { code: 'LH', name: 'Lufthansa', hubs: ['FRA', 'MUC'], type: 'full-service', priceMultiplier: 1.05 },
  { code: 'KL', name: 'KLM', hubs: ['AMS'], type: 'full-service', priceMultiplier: 1.0 },
  { code: 'IB', name: 'Iberia', hubs: ['MAD'], type: 'full-service', priceMultiplier: 0.9 },
  { code: 'AZ', name: 'ITA Airways', hubs: ['FCO'], type: 'full-service', priceMultiplier: 0.95 },
  { code: 'LX', name: 'SWISS', hubs: ['ZRH', 'GVA'], type: 'full-service', priceMultiplier: 1.15 },
  { code: 'SK', name: 'SAS', hubs: ['ARN', 'CPH', 'OSL'], type: 'full-service', priceMultiplier: 1.05 },
  { code: 'TK', name: 'Turkish Airlines', hubs: ['IST'], type: 'full-service', priceMultiplier: 0.85 },
  { code: 'TP', name: 'TAP Air Portugal', hubs: ['LIS'], type: 'full-service', priceMultiplier: 0.85 },
  // Gulf carriers
  { code: 'EK', name: 'Emirates', hubs: ['DXB'], type: 'full-service', priceMultiplier: 1.2 },
  { code: 'QR', name: 'Qatar Airways', hubs: ['DOH'], type: 'full-service', priceMultiplier: 1.15 },
  { code: 'EY', name: 'Etihad Airways', hubs: ['AUH'], type: 'full-service', priceMultiplier: 1.1 },
  // US carriers
  { code: 'AA', name: 'American Airlines', hubs: ['JFK', 'DFW', 'MIA', 'ORD'], type: 'full-service', priceMultiplier: 1.0 },
  { code: 'DL', name: 'Delta Air Lines', hubs: ['JFK', 'ATL', 'LAX', 'SEA'], type: 'full-service', priceMultiplier: 1.05 },
  { code: 'UA', name: 'United Airlines', hubs: ['EWR', 'ORD', 'SFO', 'IAD'], type: 'full-service', priceMultiplier: 1.0 },
  { code: 'AC', name: 'Air Canada', hubs: ['YYZ', 'YUL', 'YVR'], type: 'full-service', priceMultiplier: 0.95 },
  // Asian carriers
  { code: 'SQ', name: 'Singapore Airlines', hubs: ['SIN'], type: 'full-service', priceMultiplier: 1.2 },
  { code: 'CX', name: 'Cathay Pacific', hubs: ['HKG'], type: 'full-service', priceMultiplier: 1.1 },
  { code: 'NH', name: 'ANA', hubs: ['NRT', 'HND'], type: 'full-service', priceMultiplier: 1.1 },
  { code: 'JL', name: 'Japan Airlines', hubs: ['NRT', 'HND'], type: 'full-service', priceMultiplier: 1.1 },
  { code: 'QF', name: 'Qantas', hubs: ['SYD', 'MEL'], type: 'full-service', priceMultiplier: 1.15 },
  // Low-cost
  { code: 'FR', name: 'Ryanair', hubs: ['STN', 'DUB'], type: 'low-cost', priceMultiplier: 0.45 },
  { code: 'U2', name: 'easyJet', hubs: ['LGW', 'CDG', 'GVA'], type: 'low-cost', priceMultiplier: 0.5 },
  { code: 'VY', name: 'Vueling', hubs: ['BCN', 'FCO'], type: 'low-cost', priceMultiplier: 0.5 },
  { code: 'W6', name: 'Wizz Air', hubs: ['BUD', 'WAW', 'VIE'], type: 'low-cost', priceMultiplier: 0.45 },
  { code: 'TO', name: 'Transavia', hubs: ['ORY', 'AMS'], type: 'low-cost', priceMultiplier: 0.5 },
  { code: 'NK', name: 'Spirit Airlines', hubs: ['MIA', 'ATL', 'LAX'], type: 'low-cost', priceMultiplier: 0.4 },
  { code: 'PC', name: 'Pegasus Airlines', hubs: ['IST'], type: 'low-cost', priceMultiplier: 0.45 },
];

// Haversine distance in km
export function distanceKm(a: Airport, b: Airport): number {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLon = (b.lng - a.lng) * Math.PI / 180;
  const lat1 = a.lat * Math.PI / 180;
  const lat2 = b.lat * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

// Search airports by query
export function searchAirports(query: string): Airport[] {
  const q = query.toLowerCase().trim();
  if (q.length < 2) return [];
  return AIRPORTS.filter(a =>
    a.iata.toLowerCase().includes(q) ||
    a.city.toLowerCase().includes(q) ||
    a.name.toLowerCase().includes(q) ||
    a.country.toLowerCase().includes(q)
  ).slice(0, 10);
}

// Find airport by IATA or city
export function findAirport(query: string): Airport | undefined {
  const q = query.toUpperCase().trim();
  const exact = AIRPORTS.find(a => a.iata === q);
  if (exact) return exact;
  const ql = query.toLowerCase().trim();
  return AIRPORTS.find(a => a.city.toLowerCase() === ql) ||
    AIRPORTS.find(a => a.city.toLowerCase().includes(ql) || a.iata.toLowerCase().includes(ql));
}

// Dead code from the legacy mock flight generator — real flight data
// now comes from Sky-Scrapper and Kiwi.com. Kept as a no-op for type-safety
// until the next cleanup pass.
