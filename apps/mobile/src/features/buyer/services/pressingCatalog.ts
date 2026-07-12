import type { Album } from '@/shared/models/market';

export interface PressingGroup {
  key: string;
  catalogNumber: string;
  displayName: string;
  title: string;
  artist: string;
  year: number;
  releaseLabel: string;
  releaseCountry: string;
  featureDescription: string;
  featureTags: string[];
  coverImage: string;
  listingCount: number;
  lowestPrice: number;
  highestPrice: number;
  bestQualityLabel: string;
  qualityBuckets: QualityBucket[];
  listings: Album[];
}

export type QualityBucketKey = 'near-mint' | 'excellent' | 'good' | 'listenable';

export interface QualityBucket {
  key: QualityBucketKey;
  label: string;
  description: string;
  listingCount: number;
  lowestPrice: number;
  highestPrice: number;
  listings: Album[];
}

export interface AlbumProductGroup {
  key: string;
  title: string;
  artist: string;
  coverImage: string;
  listingCount: number;
  catalogCount: number;
  lowestPrice: number;
  highestPrice: number;
  bestQualityLabel: string;
  pressings: PressingGroup[];
  qualityBuckets: QualityBucket[];
}

export const normalizeCatalogValue = (value: unknown) => String(value || '')
  .trim()
  .replace(/\s+/g, ' ')
  .toLocaleLowerCase();

const normalizeSearchValue = (value: unknown) => normalizeCatalogValue(value)
  .replace(/[^\p{L}\p{N}+\-\s]/gu, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const qualityOrder: QualityBucketKey[] = ['near-mint', 'excellent', 'good', 'listenable'];
const qualityMeta: Record<QualityBucketKey, { label: string; description: string; rank: number }> = {
  'near-mint': { label: '최상급', description: 'NM 또는 90점 이상', rank: 4 },
  excellent: { label: '상급', description: 'VG+ 또는 85점 이상', rank: 3 },
  good: { label: '일반', description: 'VG 또는 75점 이상', rank: 2 },
  listenable: { label: '감상용', description: 'G+/G, 상태 확인 필요', rank: 1 },
};

const gradeRank: Record<string, number> = { NM: 5, 'VG+': 4, VG: 3, 'G+': 2, G: 1 };

const countryName = (value: unknown) => {
  const text = compactText(value);
  const normalized = text.toUpperCase();
  const map: Record<string, string> = {
    US: '미국반',
    USA: '미국반',
    UK: '영국반',
    GB: '영국반',
    JP: '일본반',
    JAPAN: '일본반',
    KR: '국내반',
    KOREA: '국내반',
    'SOUTH KOREA': '국내반',
    DE: '독일반',
    GERMANY: '독일반',
    FR: '프랑스반',
    FRANCE: '프랑스반',
    EU: 'EU반',
  };
  return map[normalized] || (text ? `${text}반` : '');
};

const compactText = (value: unknown) => String(value || '').trim().replace(/\s+/g, ' ');
const uniqueParts = (parts: string[]) => {
  const seen = new Set<string>();
  return parts.filter(part => {
    const normalized = normalizeSearchValue(part);
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
};

const pressingTextForAlbum = (album: Album) => {
  const analysis = album.analysisReport || {};
  const analysisPressing = typeof analysis.pressing === 'string' ? analysis.pressing : '';
  return compactText(album.pressingCondition || analysisPressing);
};

const featureTagsForAlbum = (album: Album) => {
  const source = [
    pressingTextForAlbum(album),
    album.genre,
    ...(album.tags || []),
  ].join(' ').toLocaleLowerCase('ko-KR');
  const tags: string[] = [];
  if (album.isFirstPress || /초반|first\s*press|firstpress|original/.test(source)) tags.push('초반');
  if (album.isRare || /희귀|rare|limited|한정/.test(source)) tags.push('희귀');
  if (/obi/.test(source)) tags.push('OBI 포함');
  if (/promo|프로모|비매품/.test(source)) tags.push('프로모');
  if (/mono|모노/.test(source)) tags.push('모노');
  if (/reissue|리이슈|재발매/.test(source)) tags.push('리이슈');
  if (/test pressing|테스트/.test(source)) tags.push('테스트 프레싱');
  return tags;
};

const pressingFeatureParts = (representative: Album, listings: Album[]) => {
  const country = countryName(representative.releaseCountry);
  const label = compactText(representative.releaseLabel);
  const year = representative.year ? `${representative.year}년` : '';
  const pressingText = pressingTextForAlbum(representative);
  const featureTags = uniqueParts(listings.flatMap(featureTagsForAlbum));
  return uniqueParts([
    country,
    label,
    year,
    ...featureTags,
    pressingText,
  ]);
};

const pressingDisplayName = (representative: Album, listings: Album[]) => {
  const coreParts = pressingFeatureParts(representative, listings).slice(0, 4);
  if (coreParts.length) return coreParts.join(' · ');
  return representative.isFirstPress ? '초반 추정 LP' : '일반 LP 판본';
};

export const pressingKeyForAlbum = (album: Album): string => {
  const catalog = normalizeCatalogValue(album.catalogNumber);
  const albumKey = albumKeyForAlbum(album);
  if (catalog) return `${albumKey}|catalog:${catalog}`;
  if (album.discogsReleaseId) return `${albumKey}|discogs:${album.discogsReleaseId}`;
  return `${albumKey}|listing:${album.id}`;
};

export const albumKeyForAlbum = (album: Album): string => {
  const title = normalizeSearchValue(album.title);
  const artist = normalizeSearchValue(album.artist);
  if (title || artist) return `album:${title}|artist:${artist}`;
  return pressingKeyForAlbum(album);
};

export const matchesAlbumTitle = (album: Album, query: string) => {
  const normalizedQuery = normalizeSearchValue(query);
  if (!normalizedQuery) return true;
  return [
    album.title,
    album.artist,
    album.catalogNumber,
    album.releaseLabel,
    album.releaseCountry,
    album.genre,
    album.audioGrade,
    ...(album.tags || []),
  ].some(value => normalizeSearchValue(value).includes(normalizedQuery));
};

export const qualityBucketForAlbum = (album: Album): QualityBucketKey => {
  const grade = String(album.audioGrade || '').toUpperCase();
  const score = Number(album.audioScore || 0);
  if (grade === 'NM' || score >= 90) return 'near-mint';
  if (grade === 'VG+' || score >= 85) return 'excellent';
  if (grade === 'VG' || score >= 75) return 'good';
  return 'listenable';
};

const compareListingsByQuality = (left: Album, right: Album) => {
  const leftBucket = qualityMeta[qualityBucketForAlbum(left)].rank;
  const rightBucket = qualityMeta[qualityBucketForAlbum(right)].rank;
  return rightBucket - leftBucket
    || (gradeRank[right.audioGrade] ?? 0) - (gradeRank[left.audioGrade] ?? 0)
    || Number(right.audioScore || 0) - Number(left.audioScore || 0)
    || Number(left.price || 0) - Number(right.price || 0);
};

const priceRange = (listings: Album[]) => {
  const prices = listings.map(item => item.price).filter(price => price > 0);
  return {
    lowestPrice: prices.length ? Math.min(...prices) : 0,
    highestPrice: prices.length ? Math.max(...prices) : 0,
  };
};

export function qualityBucketsForListings(listings: Album[]): QualityBucket[] {
  const grouped = new Map<QualityBucketKey, Album[]>();
  listings.forEach(listing => {
    const key = qualityBucketForAlbum(listing);
    grouped.set(key, [...(grouped.get(key) || []), listing]);
  });

  return qualityOrder
    .map(key => {
      const bucketListings = [...(grouped.get(key) || [])].sort(compareListingsByQuality);
      const prices = priceRange(bucketListings);
      return {
        key,
        label: qualityMeta[key].label,
        description: qualityMeta[key].description,
        listingCount: bucketListings.length,
        lowestPrice: prices.lowestPrice,
        highestPrice: prices.highestPrice,
        listings: bucketListings,
      };
    })
    .filter(bucket => bucket.listingCount > 0);
};

export function groupListingsByPressing(listings: Album[]): PressingGroup[] {
  const grouped = new Map<string, Album[]>();
  listings.forEach(listing => {
    const key = pressingKeyForAlbum(listing);
    grouped.set(key, [...(grouped.get(key) || []), listing]);
  });

  return [...grouped.entries()].map(([key, groupListings]) => {
    const sortedListings = [...groupListings].sort(compareListingsByQuality);
    const representative = sortedListings.find(item => item.discogsCoverImageUrl || item.images[0]) || sortedListings[0];
    const prices = priceRange(sortedListings);
    const qualityBuckets = qualityBucketsForListings(sortedListings);
    const featureTags = pressingFeatureParts(representative, sortedListings);
    const featureDescription = uniqueParts([
      ...featureTags,
      qualityBuckets[0]?.label || '',
    ]).slice(0, 5).join(' · ');
    return {
      key,
      catalogNumber: representative.catalogNumber.trim(),
      displayName: pressingDisplayName(representative, sortedListings),
      title: representative.title,
      artist: representative.artist,
      year: representative.year,
      releaseLabel: representative.releaseLabel || '',
      releaseCountry: representative.releaseCountry || '',
      featureDescription: featureDescription || 'LP 특징 정보 확인',
      featureTags,
      coverImage: representative.discogsCoverImageUrl || representative.images[0] || '',
      listingCount: sortedListings.length,
      lowestPrice: prices.lowestPrice,
      highestPrice: prices.highestPrice,
      bestQualityLabel: qualityBuckets[0]?.label || '품질 확인',
      qualityBuckets,
      listings: sortedListings,
    };
  });
}

export function groupListingsByAlbum(listings: Album[]): AlbumProductGroup[] {
  const grouped = new Map<string, Album[]>();
  listings.forEach(listing => {
    const key = albumKeyForAlbum(listing);
    grouped.set(key, [...(grouped.get(key) || []), listing]);
  });

  return [...grouped.entries()].map(([key, albumListings]) => {
    const sortedListings = [...albumListings].sort(compareListingsByQuality);
    const representative = sortedListings.find(item => item.discogsCoverImageUrl || item.images[0]) || sortedListings[0];
    const pressings = groupListingsByPressing(sortedListings);
    const qualityBuckets = qualityBucketsForListings(sortedListings);
    const prices = priceRange(sortedListings);
    return {
      key,
      title: representative.title,
      artist: representative.artist,
      coverImage: representative.discogsCoverImageUrl || representative.images[0] || '',
      listingCount: sortedListings.length,
      catalogCount: pressings.length,
      lowestPrice: prices.lowestPrice,
      highestPrice: prices.highestPrice,
      bestQualityLabel: qualityBuckets[0]?.label || '품질 확인',
      pressings,
      qualityBuckets,
    };
  });
}
