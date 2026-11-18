export interface WorldRegionOption {
  name: string;
  code: string;
  macroRegion: 'Africa' | 'Global';
}

export const AFRICAN_COUNTRIES: WorldRegionOption[] = [
  { name: 'Malawi', code: 'MW', macroRegion: 'Africa' },
  { name: 'Nigeria', code: 'NG', macroRegion: 'Africa' },
  { name: 'South Africa', code: 'ZA', macroRegion: 'Africa' },
  { name: 'Ghana', code: 'GH', macroRegion: 'Africa' },
  { name: 'Kenya', code: 'KE', macroRegion: 'Africa' },
  { name: 'Tanzania', code: 'TZ', macroRegion: 'Africa' },
  { name: 'Uganda', code: 'UG', macroRegion: 'Africa' },
  { name: 'Zambia', code: 'ZM', macroRegion: 'Africa' },
  { name: 'Zimbabwe', code: 'ZW', macroRegion: 'Africa' },
  { name: 'Rwanda', code: 'RW', macroRegion: 'Africa' },
  { name: 'Mozambique', code: 'MZ', macroRegion: 'Africa' },
  { name: 'Botswana', code: 'BW', macroRegion: 'Africa' },
  { name: 'Namibia', code: 'NA', macroRegion: 'Africa' },
  { name: 'Angola', code: 'AO', macroRegion: 'Africa' },
  { name: 'Ethiopia', code: 'ET', macroRegion: 'Africa' },
  { name: 'Senegal', code: 'SN', macroRegion: 'Africa' },
  { name: 'Ivory Coast', code: 'CI', macroRegion: 'Africa' },
  { name: 'Cameroon', code: 'CM', macroRegion: 'Africa' },
  { name: 'DR Congo', code: 'CD', macroRegion: 'Africa' },
  { name: 'Morocco', code: 'MA', macroRegion: 'Africa' },
  { name: 'Egypt', code: 'EG', macroRegion: 'Africa' },
  { name: 'Tunisia', code: 'TN', macroRegion: 'Africa' },
  { name: 'Algeria', code: 'DZ', macroRegion: 'Africa' },
  { name: 'Cape Verde', code: 'CV', macroRegion: 'Africa' },
  { name: 'Mali', code: 'ML', macroRegion: 'Africa' },
  { name: 'Madagascar', code: 'MG', macroRegion: 'Africa' },
  { name: 'Mauritius', code: 'MU', macroRegion: 'Africa' },
  { name: 'Eswatini', code: 'SZ', macroRegion: 'Africa' },
  { name: 'Lesotho', code: 'LS', macroRegion: 'Africa' },
  { name: 'Benin', code: 'BJ', macroRegion: 'Africa' },
  { name: 'Togo', code: 'TG', macroRegion: 'Africa' },
  { name: 'Sierra Leone', code: 'SL', macroRegion: 'Africa' },
  { name: 'Liberia', code: 'LR', macroRegion: 'Africa' },
  { name: 'Gambia', code: 'GM', macroRegion: 'Africa' },
  { name: 'Burundi', code: 'BI', macroRegion: 'Africa' },
  { name: 'Sudan', code: 'SD', macroRegion: 'Africa' },
];

export const WORLD_REGIONS: WorldRegionOption[] = [
  ...AFRICAN_COUNTRIES,
  { name: 'Africa', code: 'AF', macroRegion: 'Global' },
  { name: 'Global', code: 'GL', macroRegion: 'Global' },
];

export const MACRO_REGIONS: Array<WorldRegionOption['macroRegion']> = ['Africa', 'Global'];

export const REGION_LIST: string[] = WORLD_REGIONS.map((r) => r.name);

export const COUNTRIES_LIST: string[] = REGION_LIST;

export function getRegionNames(): string[] {
  return WORLD_REGIONS.map(r => r.name);
}

export function findRegionOption(value?: string | null): WorldRegionOption | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return undefined;
  return WORLD_REGIONS.find(
    r =>
      r.name.toLowerCase() === normalized ||
      r.code.toLowerCase() === normalized ||
      normalized.includes(r.name.toLowerCase())
  );
}

export function getCountryMacroRegion(value?: string | null): WorldRegionOption['macroRegion'] | 'Global' {
  return findRegionOption(value)?.macroRegion || 'Africa';
}

export function matchesLocationFilter(itemLocation?: string | null, selectedCountry?: string | null): boolean {
  if (!selectedCountry || selectedCountry === 'Global' || selectedCountry === 'All Regions') {
    return true;
  }
  if (selectedCountry === 'Africa') {
    if (!itemLocation) return true;
    const hay = itemLocation.trim().toLowerCase();
    return (
      hay === 'africa' ||
      hay === 'global' ||
      AFRICAN_COUNTRIES.some(c => hay.includes(c.name.toLowerCase()) || hay === c.code.toLowerCase())
    );
  }
  if (!itemLocation) return false;
  const target = selectedCountry.trim().toLowerCase();
  const hay = itemLocation.trim().toLowerCase();
  if (hay === target || hay.includes(target) || target.includes(hay)) {
    return true;
  }
  const opt = findRegionOption(selectedCountry);
  if (opt && hay.includes(opt.code.toLowerCase())) {
    return true;
  }
  return false;
}

export function detectDefaultCountry(): string {
  try {
    const saved = localStorage.getItem('lowervibe_user_country');
    if (saved && saved.trim() && saved !== 'United States') {
      return saved;
    }

    if (typeof navigator !== 'undefined') {
      const lang = navigator.language || '';
      const parts = lang.split('-');
      const regionCode = parts.length > 1 ? parts[parts.length - 1].toUpperCase() : '';
      if (regionCode) {
        const match = AFRICAN_COUNTRIES.find(r => r.code === regionCode);
        if (match) return match.name;
      }
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      if (tz.includes('Blantyre') || tz.includes('Lilongwe')) return 'Malawi';
      if (tz.includes('Lagos')) return 'Nigeria';
      if (tz.includes('Johannesburg')) return 'South Africa';
      if (tz.includes('Nairobi')) return 'Kenya';
      if (tz.includes('Accra')) return 'Ghana';
      if (tz.includes('Dar_es_Salaam')) return 'Tanzania';
      if (tz.includes('Kampala')) return 'Uganda';
      if (tz.includes('Lusaka')) return 'Zambia';
      if (tz.includes('Harare')) return 'Zimbabwe';
      if (tz.includes('Kigali')) return 'Rwanda';
      if (tz.includes('Maputo')) return 'Mozambique';
      if (tz.includes('Addis_Ababa')) return 'Ethiopia';
      if (tz.includes('Dakar')) return 'Senegal';
      if (tz.includes('Abidjan')) return 'Ivory Coast';
      if (tz.includes('Cairo')) return 'Egypt';
      if (tz.includes('Casablanca')) return 'Morocco';
    }
  } catch {
    // ignore storage/intl read errors
  }
  return 'Africa';
}
