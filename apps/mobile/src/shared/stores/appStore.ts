import { defineStore } from 'pinia';
import { mockAlbums, type Album } from '@/shared/models/market';
import { fetchApi, getApiBaseUrl } from '@/shared/services/api';

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
const MOCK_CODE = '123456';
const currentApiBaseUrl = () => getApiBaseUrl();
const AUTH_TIMEOUT_MS = 8000;

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
    good?: { name: string; durationSeconds: number; dataUrl?: string; startSeconds?: number; endSeconds?: number };
    noisy?: { name: string; durationSeconds: number; dataUrl?: string; startSeconds?: number; endSeconds?: number };
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

function readJson<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null') || fallback;
  } catch {
    localStorage.removeItem(key);
    return fallback;
  }
}

function readStoredAuth<T>(key: string, fallback: T): T {
  const localValue = localStorage.getItem(key);
  const sessionValue = sessionStorage.getItem(key);
  if (!localValue && sessionValue) {
    try {
      return JSON.parse(sessionValue) || fallback;
    } catch {
      sessionStorage.removeItem(key);
      return fallback;
    }
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
  document.documentElement.classList.toggle('dark', shouldDark);
}

function mergeWithMockAlbums(listings: Album[]) {
  const hiddenIds = new Set(listings.filter(album => album.status === 'hidden').map(album => String(album.id)));
  const merged = new Map<string, Album>();
  mockAlbums.forEach(album => {
    if (!hiddenIds.has(String(album.id))) merged.set(String(album.id), album);
  });
  listings
    .filter(album => album.status !== 'hidden')
    .forEach(album => merged.set(String(album.id), album));
  return [...merged.values()];
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

async function readAuthResponse(response: Response) {
  const payload = await response.json() as { token?: string; user?: User; detail?: string };
  if (!response.ok || !payload.user) throw new Error(payload.detail || '로그인에 실패했습니다.');
  return payload;
}

export const useAppStore = defineStore('app', {
  state: () => ({
    user: sanitizeUser(readStoredAuth<User>(USER_KEY, defaultUser)),
    token: readStoredToken(),
    favorites: readJson<string[]>(FAVORITES_KEY, []),
    listings: mergeWithMockAlbums([]) as Album[],
    settings: sanitizeSettings(readJson<Partial<AppSettings>>(SETTINGS_KEY, defaultSettings)),
    pendingVerification: readJson<PendingVerification | null>(PENDING_VERIFICATION_KEY, null),
  }),
  getters: {
    isLoggedIn: state => Boolean(state.token && state.user.id !== 'guest'),
  },
  actions: {
    persistAuth(user: User, token = 'local-dev-token', rememberMe = true) {
      this.user = sanitizeUser(user);
      this.token = token;
      const primaryStorage = rememberMe ? localStorage : sessionStorage;
      const secondaryStorage = rememberMe ? sessionStorage : localStorage;
      secondaryStorage.removeItem(USER_KEY);
      secondaryStorage.removeItem(AUTH_TOKEN_KEY);
      primaryStorage.setItem(USER_KEY, JSON.stringify(this.user));
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
      this.user = defaultUser;
      this.token = '';
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(AUTH_TOKEN_KEY);
      sessionStorage.removeItem(USER_KEY);
      sessionStorage.removeItem(AUTH_TOKEN_KEY);
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
      storage.setItem(USER_KEY, JSON.stringify(this.user));
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
      localStorage.setItem(PENDING_VERIFICATION_KEY, JSON.stringify(this.pendingVerification));
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
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
      applyTheme(theme);
    },
    updateSettings(updates: AppSettingsUpdate) {
      this.settings = sanitizeSettings({
        ...this.settings,
        ...updates,
        notifications: { ...this.settings.notifications, ...(updates.notifications || {}) },
        trade: { ...this.settings.trade, ...(updates.trade || {}) },
      });
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
      applyTheme(this.settings.theme);
    },
    toggleFavorite(albumId: string) {
      const normalizedId = String(albumId);
      this.favorites = this.favorites.includes(normalizedId)
        ? this.favorites.filter(id => id !== normalizedId)
        : [...this.favorites, normalizedId];
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(this.favorites));
    },
    async loadListingsFromServer() {
      try {
        const response = await fetchApi('/listings');
        if (!response.ok) {
          this.listings = mergeWithMockAlbums(this.listings);
          return { ok: false, persisted: false };
        }
        const listings = await response.json() as Album[];
        if (Array.isArray(listings)) this.listings = mergeWithMockAlbums(listings);
        return { ok: true, persisted: true };
      } catch {
        this.listings = mergeWithMockAlbums(this.listings);
        return { ok: false, persisted: false };
      }
    },
    async publishListing(payload: ListingCreatePayload) {
      try {
        const response = await fetchApi('/listings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, user_id: payload.user_id || this.user.id }),
        });
        if (!response.ok) return { ok: false, message: '게시글 저장에 실패했습니다. 서버 응답을 확인해 주세요.' };
        const data = await response.json() as { listing?: Album };
        if (data.listing) this.listings = [data.listing, ...this.listings.filter(album => album.id !== data.listing!.id)];
        return { ok: true, listing: data.listing, message: '게시글을 서버에 저장했습니다.' };
      } catch {
        return { ok: false, message: '서버 연결 실패로 게시글 저장에 실패했습니다.' };
      }
    },
    async updateListing(albumId: string, payload: ListingCreatePayload) {
      const previous = this.listings;
      try {
        const response = await fetchApi(`/listings/${encodeURIComponent(albumId)}?user_id=${encodeURIComponent(this.user.id)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, user_id: payload.user_id || this.user.id }),
        });
        const data = await response.json().catch(() => ({})) as { listing?: Album; detail?: string };
        if (!response.ok || !data.listing) throw new Error(data.detail || '게시글 수정에 실패했습니다.');
        this.listings = [data.listing, ...this.listings.filter(album => album.id !== albumId)];
        return { ok: true, listing: data.listing, message: '게시글을 수정했습니다.' };
      } catch (error) {
        this.listings = previous;
        return { ok: false, message: error instanceof Error ? error.message : '게시글 수정에 실패했습니다.' };
      }
    },
    async hideListing(albumId: string) {
      const previous = this.listings;
      this.listings = this.listings.filter(album => album.id !== albumId);
      try {
        const response = await fetchApi(`/listings/${encodeURIComponent(albumId)}?user_id=${encodeURIComponent(this.user.id)}`, { method: 'DELETE' });
        const data = await response.json().catch(() => ({})) as { detail?: string };
        if (!response.ok) throw new Error(data.detail || '판매글을 내리지 못했습니다.');
        return { ok: true, message: '판매글을 내렸습니다.' };
      } catch (error) {
        this.listings = previous;
        return { ok: false, message: error instanceof Error ? error.message : '판매글을 내리지 못했습니다.' };
      }
    },
    readDrafts(): ListingDraftEntry[] {
      try {
        return JSON.parse(localStorage.getItem(DRAFTS_KEY) || '[]') as ListingDraftEntry[];
      } catch {
        localStorage.removeItem(DRAFTS_KEY);
        return [];
      }
    },
    writeDrafts(drafts: ListingDraftEntry[]) {
      localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
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
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      } catch {
        // Large image/video data URLs can exceed WebView storage. Keep the in-memory/server flow alive.
      }
      try {
        this.writeDrafts([entry, ...this.readDrafts().filter(item => item.id !== draftId)].slice(0, 20));
      } catch {
        // Ignore local draft-list quota failures; server persistence still runs.
      }
    },
    async saveDraftToServer(draft: Record<string, unknown>, draftId = '') {
      this.saveDraft(draft);
      const activeId = this.activeDraftId() || draftId;
      try {
        const response = await fetchApi(`/users/${encodeURIComponent(this.user.id)}/listing-draft`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            draft,
            draftId: activeId,
            title: String((draft.formData as Record<string, unknown> | undefined)?.title || '제목 없는 판매글'),
          }),
        });
        if (!response.ok) return { ok: false, persisted: false, message: '로컬에 임시 저장했습니다.' };
        const data = await response.json() as { persisted: boolean; draft?: Record<string, unknown>; draftEntry?: ListingDraftEntry; drafts?: ListingDraftEntry[] };
        if (data.draft) this.saveDraft(data.draft);
        if (data.draftEntry) this.setActiveDraftId(data.draftEntry.id);
        if (data.drafts) {
          try {
            this.writeDrafts(data.drafts);
          } catch {
            // Keep publishing flow working even when local draft history is too large.
          }
        }
        return { ok: true, persisted: data.persisted, message: '판매글 임시 저장을 완료했습니다.' };
      } catch {
        return { ok: false, persisted: false, message: '서버 연결 실패로 로컬에 임시 저장했습니다.' };
      }
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
        if (data.drafts) this.writeDrafts(data.drafts);
        return { ok: true, drafts: data.drafts || [] };
      } catch {
        return { ok: false, drafts: this.readDrafts() };
      }
    },
    activateDraft(entry: ListingDraftEntry) {
      this.setActiveDraftId(entry.id);
      localStorage.setItem(DRAFT_KEY, JSON.stringify(entry.draft));
    },
    async deleteDraft(draftId: string) {
      const drafts = this.readDrafts().filter(item => item.id !== draftId);
      this.writeDrafts(drafts);
      if (this.activeDraftId() === draftId) {
        localStorage.removeItem(ACTIVE_DRAFT_ID_KEY);
        localStorage.removeItem(DRAFT_KEY);
      }
      void fetchApi(`/users/${encodeURIComponent(this.user.id)}/listing-drafts/${encodeURIComponent(draftId)}`, { method: 'DELETE' }).catch(() => undefined);
    },
    readDraft() {
      try {
        return JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null') as Record<string, unknown> | null;
      } catch {
        localStorage.removeItem(DRAFT_KEY);
        return null;
      }
    },
    clearDraft() {
      const activeId = this.activeDraftId();
      localStorage.removeItem(DRAFT_KEY);
      if (activeId) {
        this.writeDrafts(this.readDrafts().filter(item => item.id !== activeId));
        localStorage.removeItem(ACTIVE_DRAFT_ID_KEY);
      }
      void fetchApi(`/users/${encodeURIComponent(this.user.id)}/listing-draft`, { method: 'DELETE' }).catch(() => undefined);
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
      const response = await authFetch('/auth/find-id', { email });
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
