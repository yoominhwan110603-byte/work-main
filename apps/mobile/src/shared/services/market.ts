import type { Album, BuyOrder, MarketAdviceResponse, MarketPriceEstimate, WishlistItem } from '@/shared/models/market';
import { fetchApi } from '@/shared/services/api';

type JsonRecord = Record<string, unknown>;

const asNumber = (value: unknown, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

export function normalizeMarketEstimate(raw: JsonRecord): MarketPriceEstimate {
  const metrics = (raw.metrics || {}) as JsonRecord;
  return {
    marketKey: String(raw.marketKey || raw.market_key || ''),
    basePrice: asNumber(raw.basePrice ?? raw.base_price),
    minPrice: asNumber(raw.minPrice ?? raw.min_price),
    maxPrice: asNumber(raw.maxPrice ?? raw.max_price),
    recommendedPrice: asNumber(raw.recommendedPrice ?? raw.recommended_price),
    instantSalePrice: asNumber(raw.instantSalePrice ?? raw.instant_sale_price),
    instantSaleAvailable: Boolean(raw.instantSaleAvailable ?? raw.instant_sale_available),
    sellerPrice: asNumber(raw.sellerPrice ?? raw.seller_price),
    isValidPrice: Boolean(raw.isValidPrice ?? raw.is_valid_price ?? true),
    priceStatus: String(raw.priceStatus || raw.price_status || 'within_range'),
    metrics: {
      listingCount: asNumber(metrics.listingCount),
      buyOrderCount: asNumber(metrics.buyOrderCount),
      favoriteCount: asNumber(metrics.favoriteCount),
      wishlistCount: asNumber(metrics.wishlistCount ?? raw.wishlistCount ?? raw.wishlist_count),
      viewCount: asNumber(metrics.viewCount),
      recentTradeCount: asNumber(metrics.recentTradeCount),
    },
    reason: typeof raw.reason === 'string' ? raw.reason : undefined,
  };
}

async function readJson<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = (payload as JsonRecord).detail as string | JsonRecord | undefined;
    const message = typeof detail === 'string'
      ? detail
      : typeof detail?.message === 'string'
        ? detail.message
        : '요청을 처리하지 못했습니다.';
    throw new Error(message);
  }
  return payload as T;
}

export interface MarketEstimateParams {
  listing_id?: string;
  title?: string;
  artist?: string;
  catalog_number?: string;
  price?: number;
  year?: number;
  audio_grade?: string;
  jacket_grade?: string;
  pressing_condition?: string;
  is_first_press?: boolean;
  is_rare?: boolean;
  location?: string;
}

export async function fetchMarketPriceEstimate(params: MarketEstimateParams) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
  });
  const response = await fetchApi(`/market/price-estimate?${query.toString()}`);
  return normalizeMarketEstimate(await readJson<JsonRecord>(response));
}

export interface BuyOrderCreatePayload {
  buyer_id: string;
  listing_id?: string;
  market_key?: string;
  max_price: number;
  min_media_grade: string;
  min_sleeve_grade: string;
  pressing_condition?: string;
  is_first_press_only?: boolean;
  region_preference?: string;
  status?: string;
}

export async function createBuyOrder(payload: BuyOrderCreatePayload) {
  const response = await fetchApi('/market/buy-orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return readJson<{ status: string; buyOrder: BuyOrder; matches: BuyOrder[]; listing?: Album }>(response);
}

export async function fetchBuyOrderMatches(listingId: string) {
  const response = await fetchApi(`/market/buy-orders/matches?listing_id=${encodeURIComponent(listingId)}`);
  return readJson<{ listingId: string; marketKey: string; matches: BuyOrder[]; instantSalePrice: number }>(response);
}

export async function instantSellListing(listingId: string, sellerId?: string) {
  const response = await fetchApi(`/market/listings/${encodeURIComponent(listingId)}/instant-sell`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ seller_id: sellerId }),
  });
  return readJson<{ status: string; listing: Album; buyOrder: BuyOrder; transaction: JsonRecord }>(response);
}

export async function fetchMarketAdvice(listingId: string): Promise<MarketAdviceResponse> {
  const response = await fetchApi(`/market/listings/${encodeURIComponent(listingId)}/market-advice`);
  const data = await readJson<JsonRecord>(response);
  return {
    listingId: String(data.listingId || listingId),
    estimate: normalizeMarketEstimate((data.estimate || {}) as JsonRecord),
    advice: Array.isArray(data.advice) ? data.advice as MarketAdviceResponse['advice'] : [],
  };
}

export async function recordListingView(listingId: string) {
  const response = await fetchApi(`/market/listings/${encodeURIComponent(listingId)}/view`, { method: 'POST' });
  return readJson<{ status: string; listing: Album }>(response);
}

export async function recordListingFavorite(listingId: string, delta = 1) {
  const response = await fetchApi(`/market/listings/${encodeURIComponent(listingId)}/favorite?delta=${delta}`, { method: 'POST' });
  return readJson<{ status: string; listing: Album }>(response);
}

export interface WishlistCreatePayload {
  listing_id?: string;
  market_key?: string;
  title?: string;
  artist?: string;
  catalog_number?: string;
  discogs_release_id?: number;
  cover_image_url?: string;
  release_label?: string;
  release_country?: string;
  year?: number;
  pressing_condition?: string;
  visibility?: 'private' | 'public';
}

export type WishlistUpdatePayload = Omit<WishlistCreatePayload, 'listing_id' | 'market_key'>;

export async function fetchWishlist() {
  const response = await fetchApi('/market/wishlist');
  return readJson<{ wishlist: WishlistItem[] }>(response);
}

export async function fetchPublicWishlist(userId: string) {
  const response = await fetchApi(`/users/${encodeURIComponent(userId)}/wishlist/public`);
  return readJson<{ wishlist: WishlistItem[] }>(response);
}

export async function addWishlistItem(payload: WishlistCreatePayload) {
  const response = await fetchApi('/market/wishlist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return readJson<{ status: string; wishlistItem: WishlistItem; listing?: Album | null }>(response);
}

export async function updateWishlistItem(wishlistId: string, payload: WishlistUpdatePayload) {
  const response = await fetchApi(`/market/wishlist/${encodeURIComponent(wishlistId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return readJson<{ status: string; wishlistItem: WishlistItem }>(response);
}

export async function fetchWishlistMatches(wishlistId: string) {
  const response = await fetchApi(`/market/wishlist/${encodeURIComponent(wishlistId)}/matches`);
  return readJson<{ wishlistId: string; matches: Album[] }>(response);
}

export async function removeWishlistItem(wishlistId: string) {
  const response = await fetchApi(`/market/wishlist/${encodeURIComponent(wishlistId)}`, { method: 'DELETE' });
  return readJson<{ status: string; wishlistItem: WishlistItem }>(response);
}
