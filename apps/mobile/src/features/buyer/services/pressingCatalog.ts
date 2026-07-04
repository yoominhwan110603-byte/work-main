import type { Album } from '@/shared/models/market';

export interface PressingGroup {
  key: string;
  catalogNumber: string;
  title: string;
  artist: string;
  year: number;
  releaseLabel: string;
  releaseCountry: string;
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
    return {
      key,
      catalogNumber: representative.catalogNumber.trim() || '카탈로그 번호 미상',
      title: representative.title,
      artist: representative.artist,
      year: representative.year,
      releaseLabel: representative.releaseLabel || '',
      releaseCountry: representative.releaseCountry || '',
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
