import { defineStore } from 'pinia';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { mockAlbums, type Album, type MarketPriceEstimate, type WishlistItem } from '@/shared/models/market';
import { mockCollections, type CollectionCreatePayload, type VinylCollection } from '@/shared/models/collection';
import { fetchApi, getApiBaseUrl } from '@/shared/services/api';
import { addWishlistItem, fetchWishlist, normalizeMarketEstimate, recordListingFavorite, removeWishlistItem } from '@/shared/services/market';

export interface User {
  id: string;
  username: string;
  email: string;
  rating: number;
  transactionCount: number;
  genres: string[];
  emailVerified?: boolean;
}

export interface SellerReview {
  id: string;
  revieweeId: string;
  reviewerId: string;
  reviewerName: string;
  rating: number;
  comment: string;
  tags: string[];
  albumId?: string;
  albumTitle?: string;
  transactionId?: string;
  createdAt: string;
}

export interface ReviewSummary {
  average: number;
  count: number;
}

export const DRAFT_KEY = 'vinyl-check-listing-draft';
const DRAFTS_KEY = 'vinyl-check-listing-drafts';
const ACTIVE_DRAFT_ID_KEY = 'vinyl-check-active-listing-draft-id';
const USER_KEY = 'vinyl-check-user';
const AUTH_TOKEN_KEY = 'vinyl-check-auth-token';
const SETTINGS_KEY = 'vinyl-check-settings';
const PENDING_VERIFICATION_KEY = 'vinyl-check-pending-verification';
const FAVORITES_KEY = 'vinyl-check-favorites';
const COLLECTIONS_KEY = 'vinyl-check-collections';
const LISTINGS_KEY = 'vinyl-check-listings';
const MOCK_CODE = '123456';
const currentApiBaseUrl = () => getApiBaseUrl();
const AUTH_TIMEOUT_MS = 8000;

interface NativeAppSettingsPlugin {
  setSystemBars(options: { dark: boolean }): Promise<{ applied: boolean; dark: boolean }>;
}

const NativeAppSettings = registerPlugin<NativeAppSettingsPlugin>('AppSettings');

export type ThemeMode = 'light' | 'dark' | 'system';

export interface AppSettings {
  theme: ThemeMode;
  rememberLogin: boolean;
  appLock: boolean;
  notifications: {
    chat: boolean;
    offers: boolean;
    favoritePrice: boolean;
    preferredGenre: boolean;
    rareListing: boolean;
    nightQuiet: boolean;
  };
  trade: {
    defaultLocation: string;
    allowOffers: boolean;
    minimumOfferRate: number;
  };
}

type AppSettingsUpdate = Partial<Omit<AppSettings, 'notifications' | 'trade'>> & {
  notifications?: Partial<AppSettings['notifications']>;
  trade?: Partial<AppSettings['trade']>;
};

interface PendingVerification {
  type: 'email';
  value: string;
  code: string;
}

interface ListingCreatePayload {
  title: string;
  artist?: string;
  catalog_number?: string;
  discogs_release_id?: number;
  discogs_cover_image_url?: string;
  release_label?: string;
  release_country?: string;
  pressing_condition?: string;
  price: number;
  description?: string;
  tags?: string[];
  user_id?: string;
  images?: string[];
  cover_image_data_url?: string;
  record_image_data_url?: string;
  record_video_data_url?: string;
  genre?: string;
  year?: number;
  location?: string;
  audio_grade?: string;
  audio_score?: number;
  audio_samples?: {
    sample?: { name: string; durationSeconds: number; dataUrl?: string; startSeconds?: number; endSeconds?: number; recordedAt?: string };
    good?: { name: string; durationSeconds: number; dataUrl?: string; startSeconds?: number; endSeconds?: number; recordedAt?: string };
    noisy?: { name: string; durationSeconds: number; dataUrl?: string; startSeconds?: number; endSeconds?: number; recordedAt?: string };
  };
  jacket_grade?: string;
  jacket_score?: number;
  is_rare?: boolean;
  is_first_press?: boolean;
  analysis_report?: Record<string, unknown>;
}

export interface ListingDraftEntry {
  id: string;
  title: string;
  draft: Record<string, unknown>;
  updatedAt: string;
}

function draftTimestamp(entry: ListingDraftEntry) {
  const timestamp = new Date(entry.updatedAt || 0).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function mergeDraftEntries(...groups: ListingDraftEntry[][]) {
  const merged = new Map<string, ListingDraftEntry>();
  groups.flat().forEach(entry => {
    if (!entry?.id) return;
    const previous = merged.get(entry.id);
    if (!previous || draftTimestamp(entry) >= draftTimestamp(previous)) merged.set(entry.id, entry);
  });
  return [...merged.values()]
    .sort((left, right) => draftTimestamp(right) - draftTimestamp(left))
    .slice(0, 20);
}

const defaultUser: User = {
  id: 'guest',
  username: '게스트',
  email: 'guest@vinyl-check.local',
  rating: 0,
  transactionCount: 0,
  genres: [],
  emailVerified: false,
};

const defaultSettings: AppSettings = {
  theme: 'system',
  rememberLogin: true,
  appLock: false,
  notifications: {
    chat: true,
    offers: true,
    favoritePrice: true,
    preferredGenre: true,
    rareListing: true,
    nightQuiet: false,
  },
  trade: {
    defaultLocation: '서울',
    allowOffers: true,
    minimumOfferRate: 80,
  },
};

const STORAGE_BACKUP_SUFFIX = ':backup';
const MAX_STORAGE_BACKUP_BYTES = 100_000;
const storageBackupKey = (key: string) => `${key}${STORAGE_BACKUP_SUFFIX}`;

function parseStoredJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  const parsed = JSON.parse(value);
  return parsed ?? fallback;
}

function readJsonFromStorage<T>(storage: Storage, key: string, fallback: T): T {
  try {
    return parseStoredJson(storage.getItem(key), fallback);
  } catch {
    try {
      return parseStoredJson(storage.getItem(storageBackupKey(key)), fallback);
    } catch {
      return fallback;
    }
  }
}

function readJson<T>(key: string, fallback: T): T {
  return readJsonFromStorage(localStorage, key, fallback);
}

function writeJsonToStorage(storage: Storage, key: string, value: unknown) {
  const serialized = JSON.stringify(value);
  const backupKey = storageBackupKey(key);
  const previous = storage.getItem(key);
  storage.removeItem(backupKey);
  if (previous && previous.length <= MAX_STORAGE_BACKUP_BYTES) {
    try {
      storage.setItem(backupKey, previous);
    } catch {
      storage.removeItem(backupKey);
    }
  }
  try {
    storage.setItem(key, serialized);
  } catch (error) {
    storage.removeItem(backupKey);
    storage.setItem(key, serialized);
    if (!storage.getItem(key)) throw error;
  }
}

function writeJson(key: string, value: unknown) {
  writeJsonToStorage(localStorage, key, value);
}

function readStoredAuth<T>(key: string, fallback: T): T {
  const localValue = localStorage.getItem(key);
  const sessionValue = sessionStorage.getItem(key);
  if (!localValue && sessionValue) {
    return readJsonFromStorage(sessionStorage, key, fallback);
  }
  return readJson<T>(key, fallback);
}

function readStoredToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY) || sessionStorage.getItem(AUTH_TOKEN_KEY) || '';
}

async function authFetch(path: string, body: Record<string, unknown>, timeoutMs = AUTH_TIMEOUT_MS) {
  return fetchApi(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }, timeoutMs);
}

function sanitizeSettings(settings: Partial<AppSettings>): AppSettings {
  return {
    ...defaultSettings,
    ...settings,
    notifications: { ...defaultSettings.notifications, ...(settings.notifications || {}) },
    trade: { ...defaultSettings.trade, ...(settings.trade || {}) },
  };
}

function sanitizeUser(user: Partial<User>): User {
  const genres = Array.isArray(user.genres) ? user.genres.filter(Boolean).slice(0, 5) : [];
  return {
    ...defaultUser,
    ...user,
    id: user.id || defaultUser.id,
    username: user.username || defaultUser.username,
    email: user.email || defaultUser.email,
    rating: Number(user.rating ?? defaultUser.rating),
    transactionCount: Number(user.transactionCount ?? defaultUser.transactionCount),
    genres,
    emailVerified: user.emailVerified ?? false,
  };
}

function applyTheme(theme: ThemeMode) {
  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  const shouldDark = theme === 'dark' || (theme === 'system' && prefersDark);
  const themeColor = shouldDark ? '#2a1a12' : '#ffffff';
  document.documentElement.classList.toggle('dark', shouldDark);
  document.documentElement.style.backgroundColor = themeColor;
  document.body.style.backgroundColor = themeColor;
  let themeMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!themeMeta) {
    themeMeta = document.createElement('meta');
    themeMeta.name = 'theme-color';
    document.head.appendChild(themeMeta);
  }
  themeMeta.content = themeColor;
  if (Capacitor.isNativePlatform()) {
    void NativeAppSettings.setSystemBars({ dark: shouldDark }).catch(() => undefined);
  }
}

const unavailableListingStatuses = new Set(['hidden', 'reserved', 'sold', 'deleted']);
const isMarketVisibleAlbum = (album: Album) => !unavailableListingStatuses.has(String(album.status || 'published').toLowerCase());
const mockAlbumIds = new Set(mockAlbums.map(album => String(album.id)));
const isRealAlbum = (album: Album) => Boolean(album?.id) && !mockAlbumIds.has(String(album.id));

function dedupeAlbums(listings: Album[]) {
  const merged = new Map<string, Album>();
  listings.forEach(album => {
    const id = String(album?.id || '');
    if (!id || merged.has(id)) return;
    merged.set(id, album);
  });
  return [...merged.values()];
}

function compactDataUrl(value?: string) {
  if (!value) return '';
  if (value.startsWith('data:') && value.length > 120_000) return '';
  return value;
}

function compactAudioSamples(samples: Album['audioSamples']) {
  if (!samples) return undefined;
  return Object.fromEntries(Object.entries(samples).map(([key, sample]) => [
    key,
    { ...sample, dataUrl: compactDataUrl(sample.dataUrl) },
  ])) as Album['audioSamples'];
}

function compactAnalysisReport(analysisReport?: Record<string, unknown>) {
  const compacted = { ...(analysisReport || {}) };
  delete compacted.coverImageDataUrl;
  delete compacted.recordImageDataUrl;
  delete compacted.recordVideoDataUrl;
  delete compacted.audioSamples;
  return compacted;
}

function compactAlbumForStorage(album: Album) {
  const analysisReport = compactAnalysisReport(album.analysisReport);

  return {
    ...album,
    images: (album.images || []).map(image => compactDataUrl(image)).filter(Boolean).slice(0, 5),
    coverImageDataUrl: compactDataUrl(album.coverImageDataUrl),
    recordImageDataUrl: compactDataUrl(album.recordImageDataUrl),
    recordVideoDataUrl: '',
    audioSamples: compactAudioSamples(album.audioSamples),
    analysisReport,
  };
}

function compactListingPayloadForServer(payload: ListingCreatePayload): ListingCreatePayload {
  const analysisReport = compactAnalysisReport(payload.analysis_report);

  return {
    ...payload,
    images: (payload.images || []).map(image => compactDataUrl(image)).filter(Boolean).slice(0, 5),
    cover_image_data_url: compactDataUrl(payload.cover_image_data_url),
    record_image_data_url: compactDataUrl(payload.record_image_data_url),
    record_video_data_url: compactDataUrl(payload.record_video_data_url),
    audio_samples: compactAudioSamples(payload.audio_samples),
    analysis_report: analysisReport,
  };
}

function compactDraftForServer(draft: Record<string, unknown>) {
  const compacted = JSON.parse(JSON.stringify(draft)) as Record<string, unknown>;
  const compactMedia = (value: unknown) => typeof value === 'string' ? compactDataUrl(value) : '';
  for (const key of ['images', 'extraImages', 'coverImageDataUrl', 'recordImageDataUrl', 'recordVideoDataUrl', 'audioDataUrl']) {
    if (key === 'extraImages' && !(key in compacted)) continue;
    if (key === 'images' || key === 'extraImages') {
      compacted[key] = Array.isArray(compacted[key])
        ? (compacted[key] as unknown[]).map(compactMedia).filter(Boolean).slice(0, 5)
        : [];
    } else if (key in compacted) {
      compacted[key] = compactMedia(compacted[key]);
    }
  }
  const audioAnalysis = compacted.audioAnalysis;
  if (audioAnalysis && typeof audioAnalysis === 'object') {
    const compactedAnalysis = { ...(audioAnalysis as Record<string, unknown>) };
    delete compactedAnalysis.rawAudioDataUrl;
    delete compactedAnalysis.dataUrl;
    compacted.audioAnalysis = compactedAnalysis;
  }
  return compacted;
}

function readCachedListings() {
  return dedupeAlbums(readJson<Album[]>(LISTINGS_KEY, []).filter(isRealAlbum));
}

function persistCachedListings(listings: Album[]) {
  try {
    writeJson(LISTINGS_KEY, dedupeAlbums(listings.filter(isRealAlbum)).map(compactAlbumForStorage));
  } catch {
    // Keep runtime state even if WebView localStorage rejects large media payloads.
  }
}

function mergeWithMockAlbums(listings: Album[]) {
  const realListings = dedupeAlbums(listings.filter(isRealAlbum).filter(isMarketVisibleAlbum));
  return realListings.length ? realListings : [...mockAlbums];
}

function upsertListing(listings: Album[], listing: Album) {
  return mergeWithMockAlbums([listing, ...listings.filter(album => String(album.id) !== String(listing.id))]);
}

function localListingFromPayload(payload: ListingCreatePayload, user: User, existing?: Album): Album {
  const now = new Date().toISOString();
  const price = Number(payload.price || existing?.price || 0);
  const minPrice = existing?.minPrice || Math.max(0, Math.round(price * 0.9));
  const maxPrice = existing?.maxPrice || Math.round(price * 1.12);
  const images = Array.from(new Set([
    ...(payload.images ?? existing?.images ?? []),
    payload.cover_image_data_url,
    payload.discogs_cover_image_url,
    payload.record_image_data_url,
  ].filter(Boolean) as string[]));
  const marketKey = existing?.marketKey || [
    payload.discogs_release_id || '',
    payload.catalog_number || '',
    payload.title || '',
    payload.artist || '',
    payload.year || '',
  ].join(':').toLocaleLowerCase('ko-KR');

  return {
    ...(existing || {}),
    id: existing?.id || `local-listing-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: payload.title || existing?.title || 'Untitled',
    artist: payload.artist || existing?.artist || '',
    year: Number(payload.year || existing?.year || 0),
    genre: payload.genre || existing?.genre || '',
    catalogNumber: payload.catalog_number || existing?.catalogNumber || '',
    discogsReleaseId: payload.discogs_release_id ?? existing?.discogsReleaseId,
    discogsCoverImageUrl: payload.discogs_cover_image_url || existing?.discogsCoverImageUrl || '',
    releaseLabel: payload.release_label || existing?.releaseLabel || '',
    releaseCountry: payload.release_country || existing?.releaseCountry || '',
    pressingCondition: payload.pressing_condition || existing?.pressingCondition || '',
    price,
    priceRange: { min: minPrice, max: maxPrice },
    audioGrade: payload.audio_grade || existing?.audioGrade || '',
    audioScore: Number(payload.audio_score ?? existing?.audioScore ?? 0),
    jacketGrade: payload.jacket_grade || existing?.jacketGrade || '',
    jacketScore: Number(payload.jacket_score ?? existing?.jacketScore ?? 0),
    isRare: Boolean(payload.is_rare ?? existing?.isRare ?? false),
    isFirstPress: Boolean(payload.is_first_press ?? existing?.isFirstPress ?? false),
    ownedByMe: true,
    audioSamples: payload.audio_samples || existing?.audioSamples || {},
    images,
    coverImageDataUrl: payload.cover_image_data_url ?? existing?.coverImageDataUrl ?? payload.discogs_cover_image_url ?? '',
    recordImageDataUrl: payload.record_image_data_url ?? existing?.recordImageDataUrl ?? '',
    recordVideoDataUrl: payload.record_video_data_url || existing?.recordVideoDataUrl || '',
    analysisReport: payload.analysis_report || existing?.analysisReport || {},
    description: payload.description || existing?.description || '',
    tags: payload.tags || existing?.tags || [],
    seller: {
      id: payload.user_id || existing?.seller?.id || user.id,
      name: existing?.seller?.name || user.username || 'seller',
      rating: Number(existing?.seller?.rating ?? user.rating ?? 0),
      transactionCount: Number(existing?.seller?.transactionCount ?? user.transactionCount ?? 0),
    },
    location: payload.location || existing?.location || '',
    views: Number(existing?.views || 0),
    createdAt: existing?.createdAt || now,
    status: existing?.status || 'published',
    viewCount: Number(existing?.viewCount || existing?.views || 0),
    favoriteCount: Number(existing?.favoriteCount || 0),
    buyOrderCount: Number(existing?.buyOrderCount || 0),
    wishlistCount: Number(existing?.wishlistCount || 0),
    marketKey,
    minPrice,
    maxPrice,
    sellerPrice: price,
  };
}

const mockCollectionIds = new Set(mockCollections.map(collection => collection.id));

function mergeWithMockCollections(collections: VinylCollection[]) {
  const merged = new Map<string, VinylCollection>();
  mockCollections.forEach(collection => merged.set(collection.id, collection));
  collections.forEach(collection => merged.set(collection.id, collection));
  return [...merged.values()];
}

function sampleRecordedDates(collection: VinylCollection) {
  const dates = [collection.audioSamples?.good?.recordedAt, collection.audioSamples?.noisy?.recordedAt]
    .filter(Boolean)
    .map(date => new Date(String(date)).toLocaleDateString('ko-KR'));
  return [...new Set(dates)].join(', ');
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

async function readAuthResponse(response: Response) {
  const payload = await response.json() as { token?: string; user?: User; detail?: string };
  if (!response.ok || !payload.user) throw new Error(payload.detail || '로그인에 실패했습니다.');
  return payload;
}

async function readListingFailure(response: Response) {
  const payload = await response.json().catch(() => ({})) as { detail?: string | Record<string, unknown>; message?: string };
  const detail = payload.detail;
  if (detail && typeof detail === 'object') {
    return {
      message: String(detail.message || '가격 범위를 확인해 주세요.'),
      priceEstimate: detail.priceEstimate ? normalizeMarketEstimate(detail.priceEstimate as Record<string, unknown>) : undefined,
    };
  }
  return { message: String(detail || payload.message || '게시글 저장에 실패했습니다.'), priceEstimate: undefined as MarketPriceEstimate | undefined };
}

function wishlistMatchesAlbum(item: WishlistItem, album: Album) {
  if (item.listingId && String(item.listingId) === String(album.id)) return true;
  if (item.discogsReleaseId && album.discogsReleaseId && Number(item.discogsReleaseId) === Number(album.discogsReleaseId)) return true;

  const albumMarketKeys = [album.marketKey, album.market?.marketKey].filter(Boolean).map(String);
  if (item.marketKey && albumMarketKeys.includes(String(item.marketKey))) return true;

  const itemCatalog = item.catalogNumber?.trim().toLocaleLowerCase('ko-KR');
  const albumCatalog = album.catalogNumber?.trim().toLocaleLowerCase('ko-KR');
  if (itemCatalog && albumCatalog && itemCatalog === albumCatalog) {
    const itemTitle = item.title?.trim().toLocaleLowerCase('ko-KR');
    const albumTitle = album.title?.trim().toLocaleLowerCase('ko-KR');
    return !itemTitle || !albumTitle || itemTitle === albumTitle;
  }

  return false;
}

function wishlistPayloadFromAlbum(album: Album) {
  return {
    listing_id: album.id,
    market_key: album.marketKey || album.market?.marketKey,
    title: album.title,
    artist: album.artist,
    catalog_number: album.catalogNumber,
    discogs_release_id: album.discogsReleaseId || undefined,
    cover_image_url: album.discogsCoverImageUrl || album.images[0],
    release_label: album.releaseLabel,
    release_country: album.releaseCountry,
    year: album.year,
    visibility: 'private' as const,
  };
}

export const useAppStore = defineStore('app', {
  state: () => ({
    user: sanitizeUser(readStoredAuth<User>(USER_KEY, defaultUser)),
    token: readStoredToken(),
    favorites: readJson<string[]>(FAVORITES_KEY, []),
    wishlistItems: [] as WishlistItem[],
    wishlistLoaded: false,
    wishlistLoading: false,
    listings: mergeWithMockAlbums(readCachedListings()) as Album[],
    unreadNotificationCount: 0,
    collections: mergeWithMockCollections(readJson<VinylCollection[]>(COLLECTIONS_KEY, [])) as VinylCollection[],
    settings: sanitizeSettings(readJson<Partial<AppSettings>>(SETTINGS_KEY, defaultSettings)),
    pendingVerification: readJson<PendingVerification | null>(PENDING_VERIFICATION_KEY, null),
  }),
  getters: {
    isLoggedIn: state => Boolean(state.token && state.user.id !== 'guest'),
    isFavoriteAlbum: state => (albumOrId: Album | string) => {
      const album = typeof albumOrId === 'string'
        ? state.listings.find(item => String(item.id) === String(albumOrId))
        : albumOrId;
      const albumId = typeof albumOrId === 'string' ? String(albumOrId) : String(albumOrId.id);
      return state.favorites.includes(albumId) || Boolean(album && state.wishlistItems.some(item => wishlistMatchesAlbum(item, album)));
    },
  },
  actions: {
    persistAuth(user: User, token = 'local-dev-token', rememberMe = true) {
      this.user = sanitizeUser(user);
      this.token = token;
      this.wishlistItems = [];
      this.wishlistLoaded = false;
      const primaryStorage = rememberMe ? localStorage : sessionStorage;
      const secondaryStorage = rememberMe ? sessionStorage : localStorage;
      secondaryStorage.removeItem(USER_KEY);
      secondaryStorage.removeItem(AUTH_TOKEN_KEY);
      writeJsonToStorage(primaryStorage, USER_KEY, this.user);
      primaryStorage.setItem(AUTH_TOKEN_KEY, token);
    },
    login(user: User) {
      this.persistAuth(user);
    },
    async loginWithPassword(emailOrUsername: string, password: string, rememberMe = true) {
      const response = await authFetch('/auth/login', { username: emailOrUsername, password, rememberMe });
      const payload = await readAuthResponse(response);
      this.persistAuth(payload.user!, payload.token, rememberMe);
      return this.user;
    },
    async checkSignupAvailability(username: string, email = '') {
      const response = await fetchApi('/auth/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email }),
      }, 6000);
      const payload = await response.json().catch(() => ({})) as { usernameTaken?: boolean; emailTaken?: boolean; available?: boolean; detail?: string };
      if (!response.ok) throw new Error(payload.detail || '중복 확인에 실패했습니다.');
      return {
        usernameTaken: Boolean(payload.usernameTaken),
        emailTaken: Boolean(payload.emailTaken),
        available: Boolean(payload.available),
      };
    },
    async requestEmailVerification(email: string) {
      const response = await authFetch('/auth/email-verification/request', { email });
      const data = await response.json().catch(() => ({})) as { message?: string; devVerificationCode?: string; sent?: boolean; detail?: string };
      if (!response.ok) throw new Error(data.detail || '이메일 인증번호 발송에 실패했습니다.');
      return data;
    },
    async confirmEmailVerification(email: string, code: string) {
      const response = await authFetch('/auth/email-verification/confirm', { email, code });
      const data = await response.json().catch(() => ({})) as { message?: string; verificationToken?: string; detail?: string };
      if (!response.ok || !data.verificationToken) throw new Error(data.detail || '이메일 인증에 실패했습니다.');
      return data;
    },
    async signupWithPassword(username: string, email: string, password: string, genres: string[] = [], emailVerificationToken = '') {
      const response = await authFetch('/auth/signup', { username, email, password, genres, emailVerificationToken });
      const payload = await readAuthResponse(response);
      this.persistAuth(payload.user!, payload.token, true);
      return this.user;
    },
    async loginWithGoogle(profile?: { email?: string; name?: string; credential?: string }, rememberMe = true) {
      const response = await authFetch('/auth/google', profile || {});
      const payload = await readAuthResponse(response);
      this.persistAuth(payload.user!, payload.token, rememberMe);
      return this.user;
    },
    logout() {
      void fetchApi('/auth/logout', { method: 'POST' }).catch(() => undefined);
      this.user = defaultUser;
      this.token = '';
      this.unreadNotificationCount = 0;
      this.wishlistItems = [];
      this.wishlistLoaded = false;
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(AUTH_TOKEN_KEY);
      sessionStorage.removeItem(USER_KEY);
      sessionStorage.removeItem(AUTH_TOKEN_KEY);
    },
    async loadUnreadNotificationCount() {
      if (!this.isLoggedIn) {
        this.unreadNotificationCount = 0;
        return 0;
      }
      const requestedToken = this.token;
      try {
        const response = await fetchApi('/notifications/unread-count');
        const data = await response.json().catch(() => ({})) as { unreadCount?: number };
        if (this.token === requestedToken && response.ok) this.unreadNotificationCount = Number(data.unreadCount || 0);
      } catch {
        // Keep the last count when the connection is temporarily unavailable.
      }
      return this.unreadNotificationCount;
    },
    loadPersistedPreferences() {
      this.user = sanitizeUser(readStoredAuth<User>(USER_KEY, this.user || defaultUser));
      this.token = readStoredToken();
      this.settings = sanitizeSettings(readJson<Partial<AppSettings>>(SETTINGS_KEY, this.settings));
      this.pendingVerification = readJson<PendingVerification | null>(PENDING_VERIFICATION_KEY, null);
      applyTheme(this.settings.theme);
    },
    updateUserProfile(updates: Partial<User>) {
      this.user = sanitizeUser({ ...this.user, ...updates });
      const storage = sessionStorage.getItem(AUTH_TOKEN_KEY) ? sessionStorage : localStorage;
      writeJsonToStorage(storage, USER_KEY, this.user);
    },
    async loadUserProfileFromServer() {
      try {
        if (!this.isLoggedIn) return { ok: false, persisted: false };
        const response = await fetchApi(`/users/${encodeURIComponent(this.user.id)}/profile-draft`);
        if (!response.ok) return { ok: false, persisted: false };
        const data = await response.json() as { persisted: boolean; profile: Partial<User> | null };
        if (data.persisted && data.profile) this.updateUserProfile(data.profile);
        return { ok: true, persisted: data.persisted };
      } catch {
        return { ok: false, persisted: false };
      }
    },
    async saveUserProfileToServer(updates: Partial<User>) {
      this.updateUserProfile(updates);
      try {
        const response = await fetchApi(`/users/${encodeURIComponent(this.user.id)}/profile-draft`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: this.user.username,
            email: this.user.email,
            rating: this.user.rating,
            transactionCount: this.user.transactionCount,
            genres: this.user.genres,
            emailVerified: this.user.emailVerified ?? true,
          }),
        });
        if (!response.ok) return { ok: false, persisted: false, message: '로컬에만 저장했습니다. 서버 연결을 확인해 주세요.' };
        const data = await response.json() as { persisted: boolean; profile?: Partial<User> };
        if (data.profile) this.updateUserProfile(data.profile);
        return { ok: true, persisted: data.persisted, message: data.persisted ? '프로필을 서버에 저장했습니다.' : '로컬에만 저장했습니다.' };
      } catch {
        return { ok: false, persisted: false, message: '서버 연결 실패로 로컬에만 저장했습니다.' };
      }
    },
    beginEmailChange(email: string) {
      const nextEmail = email.trim();
      if (!isValidEmail(nextEmail)) return { ok: false, message: '올바른 이메일 형식이 아닙니다.' };
      if (nextEmail.toLowerCase() === this.user.email.toLowerCase()) return { ok: false, message: '현재 사용 중인 이메일과 같습니다.' };
      this.pendingVerification = { type: 'email', value: nextEmail, code: MOCK_CODE };
      writeJson(PENDING_VERIFICATION_KEY, this.pendingVerification);
      return { ok: true, message: '인증 코드가 발송되었습니다. 개발용 인증번호는 123456입니다.' };
    },
    confirmEmailChange(code: string) {
      if (!this.pendingVerification) return { ok: false, message: '진행 중인 이메일 인증이 없습니다.' };
      if (code !== this.pendingVerification.code) return { ok: false, message: '인증번호가 일치하지 않습니다.' };
      this.updateUserProfile({ email: this.pendingVerification.value, emailVerified: true });
      this.pendingVerification = null;
      localStorage.removeItem(PENDING_VERIFICATION_KEY);
      return { ok: true, message: '이메일이 변경되었습니다.' };
    },
    setTheme(theme: ThemeMode) {
      this.settings.theme = theme;
      writeJson(SETTINGS_KEY, this.settings);
      applyTheme(theme);
    },
    updateSettings(updates: AppSettingsUpdate) {
      this.settings = sanitizeSettings({
        ...this.settings,
        ...updates,
        notifications: { ...this.settings.notifications, ...(updates.notifications || {}) },
        trade: { ...this.settings.trade, ...(updates.trade || {}) },
      });
      writeJson(SETTINGS_KEY, this.settings);
      applyTheme(this.settings.theme);
    },
    persistFavorites() {
      writeJson(FAVORITES_KEY, this.favorites);
    },
    findWishlistItemForAlbum(album: Album) {
      return this.wishlistItems.find(item => wishlistMatchesAlbum(item, album)) || null;
    },
    async loadWishlistFavorites(force = false) {
      if (!this.isLoggedIn) {
        this.wishlistItems = [];
        this.wishlistLoaded = true;
        return this.wishlistItems;
      }
      if (this.wishlistLoading || (this.wishlistLoaded && !force)) return this.wishlistItems;

      this.wishlistLoading = true;
      try {
        const result = await fetchWishlist();
        this.wishlistItems = result.wishlist || [];
        const wishlistListingIds = this.wishlistItems
          .map(item => item.listingId ? String(item.listingId) : '')
          .filter(Boolean);
        if (wishlistListingIds.length) {
          this.favorites = Array.from(new Set([...this.favorites, ...wishlistListingIds]));
          this.persistFavorites();
        }
      } catch {
        // Keep the local favorite list usable while offline or when the API is unavailable.
      } finally {
        this.wishlistLoaded = true;
        this.wishlistLoading = false;
      }
      return this.wishlistItems;
    },
    toggleFavorite(albumOrId: Album | string) {
      const album = typeof albumOrId === 'string'
        ? this.listings.find(item => String(item.id) === String(albumOrId))
        : albumOrId;
      const normalizedId = typeof albumOrId === 'string' ? String(albumOrId) : String(albumOrId.id);
      const existingWishlistItem = album ? this.findWishlistItemForAlbum(album) : null;
      const isAdding = !this.favorites.includes(normalizedId) && !existingWishlistItem;

      this.favorites = isAdding
        ? [...this.favorites, normalizedId]
        : this.favorites.filter(id => id !== normalizedId);
      this.persistFavorites();
      void recordListingFavorite(normalizedId, isAdding ? 1 : -1)
        .then(result => {
          if (result.listing) this.listings = [result.listing, ...this.listings.filter(album => album.id !== result.listing.id)];
        })
        .catch(() => undefined);

      if (!album || !this.isLoggedIn) return;
      void (async () => {
        if (!this.wishlistLoaded) await this.loadWishlistFavorites();
        const serverWishlistItem = this.findWishlistItemForAlbum(album);
        if (isAdding && !serverWishlistItem) {
          const result = await addWishlistItem(wishlistPayloadFromAlbum(album));
          this.wishlistItems = [result.wishlistItem, ...this.wishlistItems.filter(item => item.id !== result.wishlistItem.id)];
          if (result.listing) this.listings = [result.listing, ...this.listings.filter(item => item.id !== result.listing!.id)];
          return;
        }
        if (!isAdding && serverWishlistItem) {
          await removeWishlistItem(serverWishlistItem.id);
          this.wishlistItems = this.wishlistItems.filter(item => item.id !== serverWishlistItem.id);
        }
      })().catch(() => undefined);
    },
    persistCollections() {
      const localCollections = this.collections.filter(collection => !mockCollectionIds.has(collection.id));
      writeJson(COLLECTIONS_KEY, localCollections);
    },
    async loadCollectionsFromServer(ownerId = '') {
      try {
        const query = ownerId ? `?owner_id=${encodeURIComponent(ownerId)}` : '';
        const response = await fetchApi(`/collections${query}`);
        const data = await response.json().catch(() => ({})) as { collections?: VinylCollection[] };
        if (!response.ok) return { ok: false, collections: this.collections };
        const serverCollections = (data.collections || []).map(collection => ({
          ...collection,
          ownershipStatus: 'owned' as const,
        }));
        const local = this.collections.filter(collection => !mockCollectionIds.has(collection.id));
        this.collections = mergeWithMockCollections([...local, ...serverCollections]);
        this.persistCollections();
        return { ok: true, collections: serverCollections };
      } catch {
        return { ok: false, collections: this.collections };
      }
    },
    createCollection(payload: CollectionCreatePayload) {
      const now = new Date().toISOString();
      const collection: VinylCollection = {
        ...payload,
        ownershipStatus: 'owned',
        id: `collection-${Date.now()}`,
        owner: {
          id: this.user.id,
          name: this.user.username || '사용자',
          rating: Number(this.user.rating || 0),
          transactionCount: Number(this.user.transactionCount || 0),
        },
        contactCount: 0,
        createdAt: now,
        updatedAt: now,
      };
      this.collections = [collection, ...this.collections.filter(item => item.id !== collection.id)];
      this.persistCollections();
      return collection;
    },
    async saveCollection(payload: CollectionCreatePayload, collectionId = '') {
      if (collectionId) {
        const localResult = this.updateCollection(collectionId, payload);
        if (!localResult.ok) return localResult;
        if (!this.isLoggedIn || collectionId.startsWith('collection-mock-')) return localResult;
        try {
          const response = await fetchApi(`/collections/${encodeURIComponent(collectionId)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          const data = await response.json().catch(() => ({})) as { collection?: VinylCollection; detail?: string };
          if (!response.ok || !data.collection) throw new Error(data.detail || '서버 저장에 실패했습니다.');
          this.collections = this.collections.map(item => item.id === collectionId ? data.collection! : item);
          this.persistCollections();
          return { ok: true, collection: data.collection, message: '컬렉션이 저장되었습니다.' };
        } catch {
          return { ...localResult, message: '기기에 저장했습니다. 서버 연결 후 다시 동기화해 주세요.' };
        }
      }

      const localCollection = this.createCollection(payload);
      if (!this.isLoggedIn) return { ok: true, collection: localCollection, message: '기기에 컬렉션을 저장했습니다.' };
      try {
        const response = await fetchApi('/collections', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await response.json().catch(() => ({})) as { collection?: VinylCollection; detail?: string };
        if (!response.ok || !data.collection) throw new Error(data.detail || '서버 저장에 실패했습니다.');
        this.collections = [data.collection, ...this.collections.filter(item => item.id !== localCollection.id && item.id !== data.collection!.id)];
        this.persistCollections();
        return { ok: true, collection: data.collection, message: '컬렉션을 등록했습니다.' };
      } catch {
        return { ok: true, collection: localCollection, message: '기기에 저장했습니다. 서버 연결 후 다시 동기화해 주세요.' };
      }
    },
    updateCollection(collectionId: string, updates: Partial<CollectionCreatePayload>) {
      const collection = this.collections.find(item => item.id === collectionId);
      if (!collection || collection.owner.id !== this.user.id) return { ok: false, message: '수정할 컬렉션을 찾을 수 없습니다.' };
      const nextCollection = { ...collection, ...updates, ownershipStatus: 'owned' as const, updatedAt: new Date().toISOString() };
      this.collections = this.collections.map(item => item.id === collectionId ? nextCollection : item);
      this.persistCollections();
      return { ok: true, collection: nextCollection, message: '컬렉션이 저장되었습니다.' };
    },
    prepareListingDraftFromCollection(collectionId: string) {
      const collection = this.collections.find(item => item.id === collectionId);
      if (!collection) return { ok: false, message: '컬렉션을 찾을 수 없습니다.' };
      const defaultLocation = this.settings.trade.defaultLocation || '';
      const recordedDates = sampleRecordedDates(collection);
      const tags = [...collection.tags, '컬렉션전환'].filter(Boolean);
      const draft = {
        images: [collection.discogsCoverImageUrl || collection.images[0], collection.recordImageDataUrl]
          .filter(Boolean),
        coverImageDataUrl: collection.discogsCoverImageUrl || collection.images[0] || '',
        recordImageDataUrl: collection.recordImageDataUrl || '',
        recordVideoDataUrl: collection.recordVideoDataUrl || '',
        goodAudioFileName: collection.audioSamples?.good?.name || '',
        noisyAudioFileName: collection.audioSamples?.noisy?.name || '',
        goodAudioDataUrl: collection.audioSamples?.good?.dataUrl || '',
        noisyAudioDataUrl: collection.audioSamples?.noisy?.dataUrl || '',
        goodAudioRecordedAt: collection.audioSamples?.good?.recordedAt || '',
        noisyAudioRecordedAt: collection.audioSamples?.noisy?.recordedAt || '',
        goodSampleStart: collection.audioSamples?.good?.startSeconds || 0,
        goodSampleEnd: collection.audioSamples?.good?.endSeconds || collection.audioSamples?.good?.durationSeconds || 20,
        noisySampleStart: collection.audioSamples?.noisy?.startSeconds || 0,
        noisySampleEnd: collection.audioSamples?.noisy?.endSeconds || collection.audioSamples?.noisy?.durationSeconds || 15,
        audioAnalysis: collection.audioScore
          ? {
              source: 'collection',
              summary: '컬렉션에 저장된 샘플 녹음과 상태 메모를 판매글 전환에 사용합니다.',
              audioGrade: collection.audioGrade || 'VG+',
              audioScore: collection.audioScore,
              playbackRisk: null,
              analysisConfidence: 70,
            }
          : null,
        formData: {
          title: collection.title,
          artist: collection.artist,
          catalogNumber: collection.catalogNumber,
          price: '',
          location: defaultLocation,
          description: [
            collection.notes,
            '컬렉션에서 판매글로 전환한 항목입니다.',
            recordedDates ? `샘플 녹음일: ${recordedDates}` : '',
            defaultLocation ? `거래 위치는 ${defaultLocation} 기준으로 입력했습니다. 실제 거래 장소는 판매글에서 조정하세요.` : '판매글 전환 시 거래 위치를 추가해 주세요.',
          ].filter(Boolean).join('\n'),
          tags: tags.join(' '),
          pressing: '',
          analysisConfirmed: 'true',
        },
      };
      this.setActiveDraftId(`collection-${collection.id}-${Date.now()}`);
      this.saveDraft(draft);
      return { ok: true, draft, collection };
    },
    markCollectionConverted(collectionId: string, listingId: string) {
      const collection = this.collections.find(item => item.id === collectionId);
      if (!collection || collection.owner.id !== this.user.id) return;
      this.collections = this.collections.map(item => item.id === collectionId
        ? { ...item, convertedListingId: listingId, updatedAt: new Date().toISOString() }
        : item);
      this.persistCollections();
    },
    async loadListingsFromServer() {
      try {
        const response = await fetchApi('/listings');
        if (!response.ok) {
          this.listings = mergeWithMockAlbums([...this.listings, ...readCachedListings()]);
          return { ok: false, persisted: false };
        }
        const listings = await response.json() as Album[];
        if (Array.isArray(listings)) {
          this.listings = mergeWithMockAlbums([...listings, ...this.listings, ...readCachedListings()]);
          persistCachedListings(this.listings);
        }
        return { ok: true, persisted: true };
      } catch {
        this.listings = mergeWithMockAlbums([...this.listings, ...readCachedListings()]);
        return { ok: false, persisted: false };
      }
    },
    async publishListing(payload: ListingCreatePayload) {
      const normalizedPayload = { ...payload, user_id: payload.user_id || this.user.id };
      try {
        const serverPayload = compactListingPayloadForServer(normalizedPayload);
        const response = await fetchApi('/listings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(serverPayload),
        }, 8000);
        if (!response.ok) return { ok: false, ...(await readListingFailure(response)) };
        const data = await response.json() as { listing?: Album };
        if (!data.listing?.id) return { ok: false, message: '서버에서 게시물 저장 결과를 받지 못했습니다.' };
        this.listings = upsertListing(this.listings, data.listing);
        persistCachedListings(this.listings);
        return { ok: true, persisted: true, listing: data.listing, message: '게시글을 DB에 저장했습니다.' };
      } catch (error) {
        return {
          ok: false,
          persisted: false,
          message: error instanceof Error ? `게시가 취소되었습니다. ${error.message}` : '게시가 취소되었습니다. 서버에 연결하지 못해 게시글을 저장하지 못했습니다.',
        };
      }
    },
    async updateListing(albumId: string, payload: ListingCreatePayload) {
      const previous = this.listings;
      const existing = this.listings.find(album => String(album.id) === String(albumId));
      try {
        const serverPayload = compactListingPayloadForServer({ ...payload, user_id: payload.user_id || this.user.id });
        const response = await fetchApi(`/listings/${encodeURIComponent(albumId)}?user_id=${encodeURIComponent(this.user.id)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(serverPayload),
        }, 20000);
        const data = await response.json().catch(() => ({})) as { listing?: Album; detail?: string };
        if (!response.ok) return { ok: false, ...(await readListingFailure(new Response(JSON.stringify(data), { status: response.status }))) };
        if (!response.ok || !data.listing) throw new Error(data.detail || '게시글 수정에 실패했습니다.');
        this.listings = upsertListing(this.listings, data.listing);
        persistCachedListings(this.listings);
        return { ok: true, listing: data.listing, message: '게시글을 수정했습니다.' };
      } catch (error) {
        if (existing) {
          const localListing = localListingFromPayload({ ...payload, user_id: payload.user_id || this.user.id }, this.user, existing);
          this.listings = upsertListing(previous, localListing);
          persistCachedListings(this.listings);
          return { ok: true, persisted: false, listing: localListing, message: '기기에 수정 내용을 저장했습니다. 서버 연결이 복구되면 다시 동기화해 주세요.' };
        }
        this.listings = mergeWithMockAlbums(previous);
        return { ok: false, message: error instanceof Error ? error.message : '게시글 수정에 실패했습니다.' };
      }
    },
    async hideListing(albumId: string) {
      const previous = this.listings;
      this.listings = this.listings.filter(album => album.id !== albumId);
      persistCachedListings(this.listings);
      try {
        const response = await fetchApi(`/listings/${encodeURIComponent(albumId)}?user_id=${encodeURIComponent(this.user.id)}`, { method: 'DELETE' });
        const data = await response.json().catch(() => ({})) as { detail?: string };
        if (!response.ok) throw new Error(data.detail || '판매글을 내리지 못했습니다.');
        return { ok: true, message: '판매글을 내렸습니다.' };
      } catch (error) {
        if (previous.some(album => String(album.id) === String(albumId) && String(album.id).startsWith('local-listing-'))) {
          return { ok: true, persisted: false, message: '기기에서 판매글을 내렸습니다. 서버 연결이 복구되면 다시 동기화해 주세요.' };
        }
        this.listings = mergeWithMockAlbums(previous);
        persistCachedListings(this.listings);
        return { ok: false, message: error instanceof Error ? error.message : '판매글을 내리지 못했습니다.' };
      }
    },
    readDrafts(): ListingDraftEntry[] {
      return readJson<ListingDraftEntry[]>(DRAFTS_KEY, []);
    },
    writeDrafts(drafts: ListingDraftEntry[]) {
      const compactDrafts = drafts.slice(0, 10).map(entry => ({
        ...entry,
        draft: compactDraftForServer(entry.draft),
      }));
      writeJson(DRAFTS_KEY, compactDrafts);
    },
    activeDraftId() {
      return localStorage.getItem(ACTIVE_DRAFT_ID_KEY) || '';
    },
    setActiveDraftId(draftId: string) {
      localStorage.setItem(ACTIVE_DRAFT_ID_KEY, draftId);
    },
    saveDraft(draft: Record<string, unknown>) {
      const draftId = this.activeDraftId() || `local-${Date.now()}`;
      this.setActiveDraftId(draftId);
      const title = String((draft.formData as Record<string, unknown> | undefined)?.title || '제목 없는 판매글');
      const entry = { id: draftId, title, draft, updatedAt: new Date().toISOString() };
      let currentDraftStored = false;
      let draftListStored = false;
      try {
        writeJson(DRAFT_KEY, draft);
        currentDraftStored = Boolean(this.readDraft());
      } catch {
        try {
          writeJson(DRAFT_KEY, compactDraftForServer(draft));
          currentDraftStored = Boolean(this.readDraft());
        } catch {
          // Keep the server flow alive when device storage is unavailable.
        }
      }
      try {
        this.writeDrafts(mergeDraftEntries([entry], this.readDrafts()));
        draftListStored = this.readDrafts().some(item => item.id === draftId);
      } catch {
        try {
          const compactEntry = { ...entry, draft: compactDraftForServer(draft) };
          this.writeDrafts(mergeDraftEntries([compactEntry], this.readDrafts()));
          draftListStored = this.readDrafts().some(item => item.id === draftId);
        } catch {
          // Ignore local draft-list quota failures; server persistence still runs.
        }
      }
      return { ok: currentDraftStored || draftListStored, draftId, entry };
    },
    async saveDraftToServer(draft: Record<string, unknown>, draftId = '') {
      const localResult = this.saveDraft(draft);
      const activeId = this.activeDraftId() || draftId;
      void (async () => {
        try {
          const serverDraft = compactDraftForServer(draft);
          const response = await fetchApi(`/users/${encodeURIComponent(this.user.id)}/listing-draft`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              draft: serverDraft,
              draftId: activeId,
              title: String((draft.formData as Record<string, unknown> | undefined)?.title || '제목 없는 판매글'),
            }),
          });
          if (!response.ok) return;
          const data = await response.json() as { draftEntry?: ListingDraftEntry; drafts?: ListingDraftEntry[] };
          if (data.draftEntry) this.setActiveDraftId(data.draftEntry.id);
          if (data.drafts) {
            try {
              this.writeDrafts(mergeDraftEntries(data.drafts, this.readDrafts()));
            } catch {
              // Keep the local draft when the server history exceeds device storage.
            }
          }
        } catch {
          // The local draft is already available; retry on the next save.
        }
      })();
      return localResult.ok
        ? { ok: true, persisted: false, message: '임시저장했습니다.' }
        : { ok: false, persisted: false, message: '기기 저장 공간이 부족해 임시저장하지 못했습니다.' };
    },
    async loadDraftFromServer() {
      try {
        const response = await fetchApi(`/users/${encodeURIComponent(this.user.id)}/listing-draft`);
        if (!response.ok) return { ok: false, persisted: false, draft: null as Record<string, unknown> | null };
        const data = await response.json() as { persisted: boolean; draft: Record<string, unknown> | null };
        if (data.persisted && data.draft) this.saveDraft(data.draft);
        return { ok: true, persisted: data.persisted, draft: data.draft };
      } catch {
        return { ok: false, persisted: false, draft: null as Record<string, unknown> | null };
      }
    },
    async loadDraftsFromServer() {
      try {
        const response = await fetchApi(`/users/${encodeURIComponent(this.user.id)}/listing-drafts`);
        if (!response.ok) return { ok: false, drafts: this.readDrafts() };
        const data = await response.json() as { drafts?: ListingDraftEntry[] };
        const drafts = mergeDraftEntries(data.drafts || [], this.readDrafts());
        this.writeDrafts(drafts);
        return { ok: true, drafts };
      } catch {
        return { ok: false, drafts: this.readDrafts() };
      }
    },
    activateDraft(entry: ListingDraftEntry) {
      this.setActiveDraftId(entry.id);
      writeJson(DRAFT_KEY, entry.draft);
    },
    startFreshDraft() {
      const draftId = `local-${Date.now()}`;
      this.setActiveDraftId(draftId);
      localStorage.removeItem(DRAFT_KEY);
      localStorage.removeItem(storageBackupKey(DRAFT_KEY));
      return draftId;
    },
    async deleteDraft(draftId: string) {
      const drafts = this.readDrafts().filter(item => item.id !== draftId);
      this.writeDrafts(drafts);
      if (this.activeDraftId() === draftId) {
        localStorage.removeItem(ACTIVE_DRAFT_ID_KEY);
        localStorage.removeItem(DRAFT_KEY);
      }
      if (!this.isLoggedIn) {
        return { ok: true, persisted: false, message: '기기에서 임시글을 삭제했습니다.' };
      }
      try {
        const response = await fetchApi(`/users/${encodeURIComponent(this.user.id)}/listing-drafts/${encodeURIComponent(draftId)}`, { method: 'DELETE' });
        const data = await response.json().catch(() => ({})) as { deleted?: boolean; detail?: string };
        if (!response.ok) throw new Error(data.detail || '서버 임시글 삭제에 실패했습니다.');
        if (data.deleted === false && draftId === 'legacy') {
          const legacyResponse = await fetchApi(`/users/${encodeURIComponent(this.user.id)}/listing-draft`, { method: 'DELETE' });
          const legacyData = await legacyResponse.json().catch(() => ({})) as { deleted?: boolean; detail?: string };
          if (!legacyResponse.ok) throw new Error(legacyData.detail || '서버 임시글 삭제에 실패했습니다.');
        }
        return { ok: true, persisted: true, message: '임시글을 삭제했습니다.' };
      } catch (error) {
        return {
          ok: false,
          persisted: false,
          message: error instanceof Error ? `${error.message} 기기에서는 삭제했습니다.` : '기기에서는 삭제했지만 서버 삭제에 실패했습니다.',
        };
      }
    },
    readDraft() {
      return readJson<Record<string, unknown> | null>(DRAFT_KEY, null);
    },
    clearDraft() {
      const activeId = this.activeDraftId();
      localStorage.removeItem(DRAFT_KEY);
      localStorage.removeItem(storageBackupKey(DRAFT_KEY));
      if (activeId) {
        this.writeDrafts(this.readDrafts().filter(item => item.id !== activeId));
        localStorage.removeItem(ACTIVE_DRAFT_ID_KEY);
        void fetchApi(`/users/${encodeURIComponent(this.user.id)}/listing-drafts/${encodeURIComponent(activeId)}`, { method: 'DELETE' }).catch(() => undefined);
      } else {
        void fetchApi(`/users/${encodeURIComponent(this.user.id)}/listing-draft`, { method: 'DELETE' }).catch(() => undefined);
      }
    },
    async checkServerHealth() {
      try {
        const response = await fetchApi('/health', {}, 4000);
        return { ok: response.ok, apiBaseUrl: currentApiBaseUrl() };
      } catch (error) {
        return { ok: false, apiBaseUrl: currentApiBaseUrl(), message: error instanceof Error ? error.message : 'Server connection failed' };
      }
    },
    async submitReview(payload: {
      revieweeId: string;
      reviewerId?: string;
      reviewerName?: string;
      rating: number;
      comment?: string;
      tags?: string[];
      albumId?: string;
      albumTitle?: string;
      transactionId?: string;
    }) {
      const response = await fetchApi('/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewerId: payload.reviewerId || this.user.id,
          reviewerName: payload.reviewerName || this.user.username,
          ...payload,
        }),
      });
      const data = await response.json().catch(() => ({})) as { review?: SellerReview; summary?: ReviewSummary; user?: User; detail?: string };
      if (!response.ok || !data.review) throw new Error(data.detail || '리뷰 등록에 실패했습니다.');
      if (data.user && data.user.id === this.user.id) this.updateUserProfile(data.user);
      return data;
    },
    async loadUserReviews(userId: string) {
      const response = await fetchApi(`/users/${encodeURIComponent(userId)}/reviews`);
      const data = await response.json().catch(() => ({})) as { reviews?: SellerReview[]; detail?: string };
      if (!response.ok) throw new Error(data.detail || '리뷰를 불러오지 못했습니다.');
      return data.reviews || [];
    },
    async loadReviewSummary(userId: string) {
      const response = await fetchApi(`/users/${encodeURIComponent(userId)}/review-summary`);
      const data = await response.json().catch(() => ({})) as ReviewSummary & { user?: User; detail?: string };
      if (!response.ok) throw new Error(data.detail || '리뷰 요약을 불러오지 못했습니다.');
      if (data.user && data.user.id === this.user.id) this.updateUserProfile(data.user);
      return { average: Number(data.average || 0), count: Number(data.count || 0) };
    },
    async updateReview(reviewId: string, payload: { rating: number; comment?: string; tags?: string[] }) {
      const response = await fetchApi(`/reviews/${encodeURIComponent(reviewId)}?reviewer_id=${encodeURIComponent(this.user.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({})) as { review?: SellerReview; summary?: ReviewSummary; user?: User; detail?: string };
      if (!response.ok || !data.review) throw new Error(data.detail || '리뷰 수정에 실패했습니다.');
      if (data.user && data.user.id === this.user.id) this.updateUserProfile(data.user);
      return data;
    },
    async deleteReview(reviewId: string) {
      const response = await fetchApi(`/reviews/${encodeURIComponent(reviewId)}?reviewer_id=${encodeURIComponent(this.user.id)}`, { method: 'DELETE' });
      const data = await response.json().catch(() => ({})) as { deleted?: boolean; detail?: string };
      if (!response.ok) throw new Error(data.detail || '리뷰 삭제에 실패했습니다.');
      return data;
    },
    async requestFindId(email: string) {
      const response = await authFetch('/auth/find-id/request', { email });
      const data = await response.json().catch(() => ({})) as { message?: string; devFindIdCode?: string; sent?: boolean; detail?: string };
      if (!response.ok) throw new Error(data.detail || '아이디 찾기 인증번호 발송에 실패했습니다.');
      return data;
    },
    async confirmFindId(email: string, code: string) {
      const response = await authFetch('/auth/find-id/confirm', { email, code });
      const data = await response.json().catch(() => ({})) as { message?: string; username?: string; maskedUsername?: string; detail?: string };
      if (!response.ok) throw new Error(data.detail || '아이디 찾기에 실패했습니다.');
      return data;
    },
    async requestPasswordReset(loginId: string) {
      const response = await authFetch('/auth/password-reset/request', { loginId });
      const data = await response.json().catch(() => ({})) as { message?: string; devResetCode?: string; detail?: string };
      if (!response.ok) throw new Error(data.detail || '비밀번호 재설정 요청에 실패했습니다.');
      return data;
    },
    async confirmPasswordReset(resetCode: string, password: string) {
      const response = await authFetch('/auth/password-reset/confirm', { resetCode, password });
      const data = await response.json().catch(() => ({})) as { message?: string; detail?: string };
      if (!response.ok) throw new Error(data.detail || '비밀번호 재설정에 실패했습니다.');
      return data;
    },
  },
});
