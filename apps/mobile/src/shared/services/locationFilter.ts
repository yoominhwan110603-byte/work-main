export type LocationFilterScope = 'contains' | 'city' | 'district' | 'neighborhood';

export type ParsedLocation = {
  raw: string;
  city: string;
  district: string;
  neighborhood: string;
  tokens: string[];
};

const normalizeLocationText = (value: string) => value
  .replace(/[(),]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const compactLocationToken = (value: string) => value.replace(/\s+/g, '').toLocaleLowerCase('ko-KR');
const locationPartKey = (value: string) => compactLocationToken(value)
  .replace(/특별자치도|특별자치시|특별시|광역시/g, '')
  .replace(/도$/, '')
  .replace(/시$/, '');

export const parseLocationParts = (value: string): ParsedLocation => {
  const raw = normalizeLocationText(value);
  const tokens = raw.split(' ').map(token => token.trim()).filter(Boolean);
  const city = tokens.find(token => /(특별시|광역시|특별자치시|특별자치도|도|시)$/.test(token)) || tokens[0] || '';
  const neighborhood = tokens.find(token => /(동|읍|면|가)$/.test(token) && token !== city) || '';
  const cityIndex = Math.max(0, tokens.indexOf(city));
  const district = tokens
    .slice(cityIndex + 1)
    .filter(token => token !== neighborhood && /(시|군|구)$/.test(token))
    .slice(0, 2)
    .join(' ');

  return { raw, city, district, neighborhood, tokens };
};

export const locationScopeLabel = (scope: LocationFilterScope) => {
  if (scope === 'city') return '같은 시/도';
  if (scope === 'district') return '같은 시/군/구';
  if (scope === 'neighborhood') return '같은 동/읍/면';
  return '문자 포함';
};

export const matchesLocationScope = (listingLocation: string, filterLocation: string, scope: LocationFilterScope) => {
  const listing = parseLocationParts(listingLocation);
  const filter = parseLocationParts(filterLocation);
  if (!filter.raw) return true;
  if (!listing.raw) return false;

  if (scope === 'city') {
    return Boolean(filter.city && listing.city && locationPartKey(listing.city) === locationPartKey(filter.city));
  }

  if (scope === 'district') {
    return Boolean(
      filter.city
      && filter.district
      && listing.city
      && listing.district
      && locationPartKey(listing.city) === locationPartKey(filter.city)
      && locationPartKey(listing.district) === locationPartKey(filter.district),
    );
  }

  if (scope === 'neighborhood') {
    return Boolean(
      filter.city
      && filter.district
      && filter.neighborhood
      && listing.city
      && listing.district
      && listing.neighborhood
      && locationPartKey(listing.city) === locationPartKey(filter.city)
      && locationPartKey(listing.district) === locationPartKey(filter.district)
      && locationPartKey(listing.neighborhood) === locationPartKey(filter.neighborhood),
    );
  }

  return compactLocationToken(listing.raw).includes(compactLocationToken(filter.raw));
};
