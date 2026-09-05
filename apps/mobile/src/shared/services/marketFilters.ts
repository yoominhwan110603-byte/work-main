import type { Album } from '@/shared/models/market';
import { matchesLocationScope, type LocationFilterScope } from '@/shared/services/locationFilter';

export type MarketplaceFilters = {
  genres: string[];
  maxPrice: number;
  minGradeScore: number;
  minSellerRating: number;
  minYear: number;
  location: string;
  locationScope: LocationFilterScope;
};

export const MARKET_FILTER_MAX_PRICE = 500000;
export const MARKET_FILTER_MIN_YEAR = 1950;
export const MARKET_FILTER_MAX_YEAR = Math.floor(new Date().getFullYear() / 10) * 10;
export const MARKET_GRADE_SCORE: Record<string, number> = { M: 7, NM: 6, EX: 5, 'VG+': 4, VG: 3, G: 2, P: 1 };

export const normalizeMarketFilterYear = (year: number) => {
  if (!Number.isFinite(year) || year <= MARKET_FILTER_MIN_YEAR) return MARKET_FILTER_MIN_YEAR;
  return Math.min(MARKET_FILTER_MAX_YEAR, Math.max(MARKET_FILTER_MIN_YEAR, Math.floor(year / 10) * 10));
};

export const createMarketplaceFilters = (overrides: Partial<MarketplaceFilters> = {}): MarketplaceFilters => {
  const { genres = [], ...rest } = overrides;
  return {
    maxPrice: MARKET_FILTER_MAX_PRICE,
    minGradeScore: 0,
    minSellerRating: 0,
    minYear: MARKET_FILTER_MIN_YEAR,
    location: '',
    locationScope: 'district',
    ...rest,
    genres: [...genres],
  };
};

export const cloneMarketplaceFilters = (filters: MarketplaceFilters): MarketplaceFilters => ({
  ...filters,
  genres: [...filters.genres],
});

export const countActiveMarketplaceFilters = (filters: MarketplaceFilters) => (
  Number(filters.genres.length > 0)
  + Number(filters.maxPrice < MARKET_FILTER_MAX_PRICE)
  + Number(filters.minGradeScore > 0)
  + Number(filters.minSellerRating > 0)
  + Number(filters.minYear > MARKET_FILTER_MIN_YEAR)
  + Number(Boolean(filters.location.trim()))
);

export const matchesMarketplaceFilters = (album: Album, filters: MarketplaceFilters) => (
  (!filters.genres.length || filters.genres.includes(album.genre))
  && matchesLocationScope(album.location, filters.location, filters.locationScope)
  && (filters.maxPrice >= MARKET_FILTER_MAX_PRICE || album.price <= filters.maxPrice)
  && (!filters.minGradeScore || (MARKET_GRADE_SCORE[album.audioGrade] ?? 0) >= filters.minGradeScore)
  && (!filters.minSellerRating || album.seller.rating >= filters.minSellerRating)
  && (!filters.minYear || album.year >= filters.minYear)
);
