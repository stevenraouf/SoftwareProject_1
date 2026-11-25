export const places = [
  ["CDG", "France", "Paris", "Bonjour", "fr", "Charles de Gaulle"],
  ["HND", "Japan", "Tokyo", "こんにちは", "ja", "Haneda"],
  ["CAI", "Egypt", "Cairo", "أهلًا", "ar", "Cairo International"],
  ["LHR", "UK", "London", "Hello", "en", "Heathrow"],
  ["DXB", "UAE", "Dubai", "مرحبًا", "ar", "Dubai International"],
  ["JFK", "USA", "New York", "Hi there", "en", "John F. Kennedy"],
  ["RUH", "Saudi Arabia", "Riyadh", "يا هلا", "ar", "King Khalid"],
  ["FRA", "Germany", "Frankfurt", "Hallo", "de", "Frankfurt Airport"],
] as const;

export type AirportCode = (typeof places)[number][0];
export type Place = (typeof places)[number];

export const cityGuides: Record<
  AirportCode,
  {
    country: string;
    landscape: string;
    story: string;
    zone: string;
    airport: string;
  }
> = {
  CDG: {
    country: "France",
    landscape: "Paris",
    zone: "Europe/Paris",
    airport: "Charles de Gaulle Airport",
    story:
      "Follow the Seine from the Eiffel Tower to the cafés of Saint-Germain.",
  },
  HND: {
    country: "Japan",
    landscape: "Mount Fuji",
    zone: "Asia/Tokyo",
    airport: "Haneda Airport",
    story:
      "Look toward Mount Fuji, then explore Tokyo’s temple courtyards and lantern-lit streets.",
  },
  CAI: {
    country: "Egypt",
    landscape: "Giza",
    zone: "Africa/Cairo",
    airport: "Cairo International Airport",
    story:
      "See the pyramids rise above Giza before following the Nile into Cairo.",
  },
  LHR: {
    country: "United Kingdom",
    landscape: "London",
    zone: "Europe/London",
    airport: "Heathrow Airport",
    story:
      "Trace the Thames through London’s riverside neighborhoods, markets and museums.",
  },
  DXB: {
    country: "United Arab Emirates",
    landscape: "Dubai",
    zone: "Asia/Dubai",
    airport: "Dubai International Airport",
    story:
      "Trade the views from Downtown Dubai for an abra crossing on Dubai Creek.",
  },
  JFK: {
    country: "United States",
    landscape: "New York",
    zone: "America/New_York",
    airport: "John F. Kennedy International Airport",
    story: "Cross the East River for a wide-angle view of Manhattan’s skyline.",
  },
  RUH: {
    country: "Saudi Arabia",
    landscape: "Riyadh",
    zone: "Asia/Riyadh",
    airport: "King Khalid International Airport",
    story:
      "Discover central Riyadh’s modern skyline and the adobe lanes of nearby Diriyah.",
  },
  FRA: {
    country: "Germany",
    landscape: "Frankfurt",
    zone: "Europe/Berlin",
    airport: "Frankfurt Airport",
    story:
      "Walk along the Main from Frankfurt’s high-rise skyline to the old town.",
  },
};

export function findPlace(value: string) {
  return places.find(([code]) => code === value.toUpperCase());
}
