import { defineStore } from 'pinia';
import { mockAlbums, type Album } from '../data/mockData';

export interface User {
  id: string;
  username: string;
  email: string;
  rating: number;
  transactionCount: number;
  genres: string[];
  emailVerified?: boolean;
}

export const DRAFT_KEY = 'vinyl-check-listing-draft';
const USER_KEY = 'vinyl-check-user';
const SETTINGS_KEY = 'vinyl-check-settings';
const PENDING_VERIFICATION_KEY = 'vinyl-check-pending-verification';
const MOCK_CODE = '123456';
const DEV_LAN_API_BASE_URL = 'http://172.30.14.95:8000';

function getApiBaseUrl() {
  if (import.meta.env.VITE_API_BASE_URL) return import.meta.env.VITE_API_BASE_URL;
  if (typeof window === 'undefined') return 'http://localhost:8000';

  const { protocol, hostname } = window.location;
  const localHostnames = new Set(['localhost', '127.0.0.1', '::1']);
  if (localHostnames.has(hostname)) return DEV_LAN_API_BASE_URL;

  return `${protocol.startsWith('http') ? protocol : 'http:'}//${hostname}:8000`;
}

const API_BASE_URL = getApiBaseUrl();

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

interface ProfileDraftResponse {
  persisted: boolean;
  profile: (Partial<User> & { id: string; updatedAt?: string | null }) | null;
}

interface ListingDraftResponse {
  persisted: boolean;
  draft: Record<string, unknown> | null;
  updatedAt?: string | null;
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
  genre?: string;
  year?: number;
  location?: string;
  audio_grade?: string;
  audio_score?: number;
  jacket_grade?: string;
  jacket_score?: number;
  is_rare?: boolean;
  is_first_press?: boolean;
  analysis_report?: Record<string, unknown>;
}

interface ListingCreateResponse {
  status: string;
  persisted: boolean;
  listing: Album;
}

const defaultUser: User = {
  id: 'seller1',
  username: '재즈매니아',
  email: 'user@example.com',
  rating: 4.9,
  transactionCount: 127,
  genres: ['재즈'],
  emailVerified: true,
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
    defaultLocation: '서울 강남구',
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

function sanitizeSettings(settings: Partial<AppSettings>): AppSettings {
  return {
    ...defaultSettings,
    ...settings,
    notifications: { ...defaultSettings.notifications, ...(settings.notifications || {}) },
    trade: { ...defaultSettings.trade, ...(settings.trade || {}) },
  };
}

function sanitizeUser(user: User): User {
  const safeUser = user as Partial<User>;
  const safeGenres = Array.isArray(safeUser.genres)
    ? safeUser.genres.filter((genre): genre is string => typeof genre === 'string' && genre.trim().length > 0)
    : defaultUser.genres;
  return {
    ...defaultUser,
    id: safeUser.id || defaultUser.id,
    username: safeUser.username || defaultUser.username,
    email: safeUser.email || defaultUser.email,
    rating: safeUser.rating ?? defaultUser.rating,
    transactionCount: safeUser.transactionCount ?? defaultUser.transactionCount,
    genres: safeGenres,
    emailVerified: safeUser.emailVerified ?? true,
  };
}

function applyTheme(theme: ThemeMode) {
  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  const shouldDark = theme === 'dark' || (theme === 'system' && prefersDark);
  document.documentElement.classList.toggle('dark', shouldDark);
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export const useAppStore = defineStore('app', {
  state: () => ({
    user: sanitizeUser(readJson<User>(USER_KEY, defaultUser)),
    favorites: [] as string[],
    listings: mockAlbums as Album[],
    settings: sanitizeSettings(readJson<Partial<AppSettings>>(SETTINGS_KEY, defaultSettings)),
    pendingVerification: readJson<PendingVerification | null>(PENDING_VERIFICATION_KEY, null),
  }),
  actions: {
    login(user: User) {
      this.user = sanitizeUser(user);
      localStorage.setItem(USER_KEY, JSON.stringify(this.user));
    },
    logout() {
      this.user = defaultUser;
      localStorage.removeItem(USER_KEY);
    },
    loadPersistedPreferences() {
      this.user = sanitizeUser(readJson<User>(USER_KEY, this.user || defaultUser));
      this.settings = sanitizeSettings(readJson<Partial<AppSettings>>(SETTINGS_KEY, this.settings));
      this.pendingVerification = readJson<PendingVerification | null>(PENDING_VERIFICATION_KEY, null);
      applyTheme(this.settings.theme);
    },
    updateUserProfile(updates: Partial<User>) {
      this.user = sanitizeUser({ ...this.user, ...updates });
      localStorage.setItem(USER_KEY, JSON.stringify(this.user));
    },
    async loadUserProfileFromServer() {
      try {
        const response = await fetch(`${API_BASE_URL}/users/${encodeURIComponent(this.user.id)}/profile-draft`);
        if (!response.ok) return { ok: false, persisted: false };

        const data = await response.json() as ProfileDraftResponse;
        if (data.persisted && data.profile) {
          this.updateUserProfile(data.profile);
        }
        return { ok: true, persisted: data.persisted };
      } catch {
        return { ok: false, persisted: false };
      }
    },
    async saveUserProfileToServer(updates: Partial<User>) {
      this.updateUserProfile(updates);

      try {
        const response = await fetch(`${API_BASE_URL}/users/${encodeURIComponent(this.user.id)}/profile-draft`, {
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
        if (!response.ok) {
          return { ok: false, persisted: false, message: '로컬에만 임시 저장되었습니다. 서버 응답을 확인해 주세요.' };
        }

        const data = await response.json() as ProfileDraftResponse;
        if (data.profile) this.updateUserProfile(data.profile);
        return {
          ok: true,
          persisted: data.persisted,
          message: data.persisted ? 'DB에 임시 저장되었습니다.' : '로컬에만 임시 저장되었습니다. DB 연결을 확인해 주세요.',
        };
      } catch {
        return { ok: false, persisted: false, message: '로컬에만 임시 저장되었습니다. 백엔드 서버 연결을 확인해 주세요.' };
      }
    },
    beginEmailChange(email: string) {
      const nextEmail = email.trim();
      if (!isValidEmail(nextEmail)) {
        return { ok: false, message: '올바른 이메일 형식이 아닙니다.' };
      }
      if (nextEmail.toLowerCase() === this.user.email.toLowerCase()) {
        return { ok: false, message: '현재 사용 중인 이메일과 같습니다.' };
      }
      if (nextEmail.toLowerCase() === 'used@example.com') {
        return { ok: false, message: '이미 사용 중인 이메일입니다.' };
      }
      this.pendingVerification = { type: 'email', value: nextEmail, code: MOCK_CODE };
      localStorage.setItem(PENDING_VERIFICATION_KEY, JSON.stringify(this.pendingVerification));
      return { ok: true, message: '인증 코드가 발송되었습니다. 개발용 인증번호는 123456입니다.' };
    },
    confirmEmailChange(code: string) {
      if (!this.pendingVerification) {
        return { ok: false, message: '진행 중인 이메일 인증이 없습니다.' };
      }
      if (code !== this.pendingVerification.code) {
        return { ok: false, message: '인증번호가 일치하지 않습니다.' };
      }
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
      this.favorites = this.favorites.includes(albumId)
        ? this.favorites.filter(id => id !== albumId)
        : [...this.favorites, albumId];
    },
    async loadListingsFromServer() {
      try {
        const response = await fetch(`${API_BASE_URL}/listings`);
        if (!response.ok) return { ok: false, persisted: false };
        const listings = await response.json() as Album[];
        if (Array.isArray(listings) && listings.length > 0) {
          this.listings = listings;
        }
        return { ok: true, persisted: true };
      } catch {
        return { ok: false, persisted: false };
      }
    },
    async publishListing(payload: ListingCreatePayload) {
      try {
        const response = await fetch(`${API_BASE_URL}/listings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, user_id: payload.user_id || this.user.id }),
        });
        if (!response.ok) {
          return { ok: false, message: '게시글 저장에 실패했습니다. 서버 응답을 확인해 주세요.' };
        }

        const data = await response.json() as ListingCreateResponse;
        if (data.listing) {
          this.listings = [
            data.listing,
            ...this.listings.filter(album => album.id !== data.listing.id),
          ];
        }
        return { ok: true, listing: data.listing, message: '게시글이 서버에 저장되었습니다.' };
      } catch {
        return { ok: false, message: '게시글 저장에 실패했습니다. 백엔드 서버 연결을 확인해 주세요.' };
      }
    },
    saveDraft(draft: Record<string, unknown>) {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    },
    async saveDraftToServer(draft: Record<string, unknown>) {
      this.saveDraft(draft);

      try {
        const response = await fetch(`${API_BASE_URL}/users/${encodeURIComponent(this.user.id)}/listing-draft`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ draft }),
        });

        if (!response.ok) {
          return { ok: false, persisted: false, message: '로컬에만 임시 저장되었습니다. 서버 응답을 확인해 주세요.' };
        }

        const data = await response.json() as ListingDraftResponse;
        if (data.draft) this.saveDraft(data.draft);
        return {
          ok: true,
          persisted: data.persisted,
          message: data.persisted ? '판매글이 DB에 임시 저장되었습니다.' : '로컬에만 임시 저장되었습니다. DB 연결을 확인해 주세요.',
        };
      } catch {
        return { ok: false, persisted: false, message: '로컬에만 임시 저장되었습니다. 백엔드 서버 연결을 확인해 주세요.' };
      }
    },
    async loadDraftFromServer() {
      try {
        const response = await fetch(`${API_BASE_URL}/users/${encodeURIComponent(this.user.id)}/listing-draft`);
        if (!response.ok) return { ok: false, persisted: false, draft: null as Record<string, unknown> | null };

        const data = await response.json() as ListingDraftResponse;
        if (data.persisted && data.draft) {
          this.saveDraft(data.draft);
        }
        return { ok: true, persisted: data.persisted, draft: data.draft };
      } catch {
        return { ok: false, persisted: false, draft: null as Record<string, unknown> | null };
      }
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
      localStorage.removeItem(DRAFT_KEY);
      void fetch(`${API_BASE_URL}/users/${encodeURIComponent(this.user.id)}/listing-draft`, {
        method: 'DELETE',
      }).catch(() => undefined);
    },
  },
});
