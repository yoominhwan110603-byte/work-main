export type LocationFilterScope = 'contains' | 'city' | 'district' | 'neighborhood';

export type ParsedLocation = {
  raw: string;
  city: string;
  district: string;
  neighborhood: string;
  tokens: string[];
};

const normalizeLocationText = (value: string) => value
  .replace(/^대한민국\s*/, '')
  .replace(/[(),]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const compactLocationToken = (value: string) => value.replace(/\s+/g, '').toLocaleLowerCase('ko-KR');
const metropolitanNames = new Set(['서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종']);
const provincePattern = /(특별시|광역시|특별자치시|특별자치도|도)$/;
const districtPattern = /(시|군|구)$/;
const neighborhoodPattern = /(동|읍|면|리|가)$/;
const locationPartKey = (value: string) => compactLocationToken(value)
  .replace(/특별자치도|특별자치시|특별시|광역시/g, '')
  .replace(/도$/, '')
  .replace(/[시군구읍면동리가]$/, '');

const isCityToken = (token: string, index: number) => {
  const compact = compactLocationToken(token);
  return provincePattern.test(token) || metropolitanNames.has(compact) || (index === 0 && /시$/.test(token));
};

const sameLocationPart = (left: string, right: string) => {
  const leftKey = locationPartKey(left);
  const rightKey = locationPartKey(right);
  if (!leftKey || !rightKey) return false;
  return leftKey === rightKey
    || (leftKey.length > 1 && rightKey.length > 1 && (leftKey.includes(rightKey) || rightKey.includes(leftKey)));
};

export const parseLocationParts = (value: string): ParsedLocation => {
  const raw = normalizeLocationText(value);
  const tokens = raw.split(' ').map(token => token.trim()).filter(Boolean);
  const cityIndex = Math.max(0, tokens.findIndex(isCityToken));
  const city = tokens[cityIndex] || tokens[0] || '';
  const districtParts: string[] = [];
  let districtEndIndex = city ? cityIndex + 1 : 0;

  for (let index = districtEndIndex; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!districtPattern.test(token) || neighborhoodPattern.test(token)) continue;
    districtParts.push(token);
    districtEndIndex = index + 1;
    if (/구$|군$/.test(token) || districtParts.length >= 2) break;
  }

  const neighborhood = tokens
    .slice(districtEndIndex)
    .find(token => neighborhoodPattern.test(token) && token !== city && !districtParts.includes(token)) || '';
  const district = districtParts.join(' ');

  return { raw, city, district, neighborhood, tokens };
};

export const locationScopeLabel = (scope: LocationFilterScope) => {
  if (scope === 'city') return '같은 시/도';
  if (scope === 'district') return '같은 시/군/구';
  if (scope === 'neighborhood') return '같은 동/읍/면';
  return '문자 포함';
};

export const locationScopeRegion = (scope: LocationFilterScope, parts: ParsedLocation) => {
  if (scope === 'city') return parts.city;
  if (scope === 'district') return [parts.city, parts.district].filter(Boolean).join(' ');
  if (scope === 'neighborhood') return [parts.city, parts.district, parts.neighborhood].filter(Boolean).join(' ');
  return parts.raw;
};

export const matchesLocationScope = (listingLocation: string, filterLocation: string, scope: LocationFilterScope) => {
  const listing = parseLocationParts(listingLocation);
  const filter = parseLocationParts(filterLocation);
  if (!filter.raw) return true;
  if (!listing.raw) return false;

  if (scope === 'city') {
    return Boolean(filter.city && listing.city && sameLocationPart(listing.city, filter.city));
  }

  if (scope === 'district') {
    return Boolean(
      filter.city
      && filter.district
      && listing.city
      && listing.district
      && sameLocationPart(listing.city, filter.city)
      && sameLocationPart(listing.district, filter.district),
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
      && sameLocationPart(listing.city, filter.city)
      && sameLocationPart(listing.district, filter.district)
      && sameLocationPart(listing.neighborhood, filter.neighborhood),
    );
  }

  return compactLocationToken(listing.raw).includes(compactLocationToken(filter.raw));
};
