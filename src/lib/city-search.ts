import "server-only";
import countries from "@/data/countries.json";
import citiesByCountry from "@/data/cities-by-country.json";
import majorCitiesByCountry from "@/data/major-cities-by-country.json";

const countryCodes = new Set(countries.map((country) => country.code));
const cities = citiesByCountry as Record<string, string[] | undefined>;
const majorCities = majorCitiesByCountry as Record<string, string[] | undefined>;

export function isKnownCountryCode(code: string): boolean {
  return countryCodes.has(code);
}

function normalized(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase();
}

export function findCities(countryCode: string, query: string, limit = 12): string[] {
  const list = cities[countryCode] ?? [];
  const needle = normalized(query.trim());
  if (!needle) return (majorCities[countryCode] ?? []).slice(0, limit);

  const starts: string[] = [];
  const contains: string[] = [];
  for (const city of list) {
    const name = normalized(city);
    if (name.startsWith(needle)) starts.push(city);
    else if (name.includes(needle)) contains.push(city);
    if (starts.length >= limit) break;
  }
  return starts.concat(contains).slice(0, limit);
}
