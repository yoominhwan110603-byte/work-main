import { Capacitor, CapacitorHttp } from '@capacitor/core';

const DEFAULT_LAN_API_BASE_URL = 'http://172.30.1.19:8000';
const FALLBACK_LAN_API_BASE_URLS = [
  'http://172.30.1.19:8000',
  'http://192.168.219.131:8000',
  'http://172.30.13.172:8000',
  'http://192.168.219.119:8000',
  'http://172.30.1.80:8000',
  'http://192.168.219.116:8000',
  'http://192.168.219.177:8000',
  'http://192.168.219.136:8000',
  'http://192.168.0.9:8000',
  'http://192.168.219.101:8000',
  'http://192.168.219.163:8000',
  'http://172.30.14.95:8000',
  'http://172.30.1.56:8000',
  'http://192.168.219.115:8000',
  'http://172.30.1.67:8000',
  'http://192.168.219.112:8000',
  'http://192.168.219.113:8000',
];
const API_OVERRIDE_KEY = 'vinyl-check-api-base-url';
const API_PREFERRED_KEY = 'vinyl-check-api-preferred-base-url';
const AUTH_TOKEN_KEY = 'vinyl-check-auth-token';
const DEFAULT_API_TIMEOUT_MS = 10_000;
const MAX_ATTEMPT_TIMEOUT_MS = 2_500;

function authToken() {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(AUTH_TOKEN_KEY) || sessionStorage.getItem(AUTH_TOKEN_KEY) || '';
}

function withAuthorization(headers?: HeadersInit) {
  const normalized = new Headers(headers || {});
  const token = authToken();
  if (token && !normalized.has('Authorization')) normalized.set('Authorization', `Bearer ${token}`);
  return normalized;
}

function announceExpiredSession(response: Response, path: string) {
  if (response.status === 401 && authToken() && !path.startsWith('/auth/')) {
    window.dispatchEvent(new CustomEvent('vinyl-check-auth-expired'));
  }
  return response;
}

function normalizeBaseUrl(value: string) {
  return value.trim().replace(/\/$/, '');
}

function uniqueUrls(urls: Array<string | undefined>) {
  return Array.from(new Set(urls.filter(Boolean).map(value => normalizeBaseUrl(value!))));
}

export function getApiBaseUrl() {
  return getApiBaseUrlCandidates()[0];
}

export function resolveApiUrl(pathOrUrl: string) {
  if (!pathOrUrl) return '';
  if (/^(https?:|data:|blob:|capacitor:)/i.test(pathOrUrl)) return pathOrUrl;
  if (pathOrUrl.startsWith('/')) return `${getApiBaseUrl()}${pathOrUrl}`;
  return pathOrUrl;
}

export function getApiBaseUrlCandidates() {
  if (typeof window === 'undefined') return ['http://127.0.0.1:8000'];

  const { protocol, hostname } = window.location;
  const localHostnames = new Set(['localhost', '127.0.0.1', '::1']);
  const configured = import.meta.env.VITE_API_BASE_URL;
  const stored = localStorage.getItem(API_OVERRIDE_KEY) || '';
  const preferred = localStorage.getItem(API_PREFERRED_KEY) || '';

  if (configured) return uniqueUrls([preferred, configured, stored, ...FALLBACK_LAN_API_BASE_URLS]);
  if (stored) return uniqueUrls([preferred, stored, ...FALLBACK_LAN_API_BASE_URLS]);
  if (protocol.startsWith('http') && localHostnames.has(hostname)) return uniqueUrls([preferred, 'http://127.0.0.1:8000', DEFAULT_LAN_API_BASE_URL, ...FALLBACK_LAN_API_BASE_URLS]);
  if (protocol === 'capacitor:') return uniqueUrls([preferred, DEFAULT_LAN_API_BASE_URL, ...FALLBACK_LAN_API_BASE_URLS]);
  return uniqueUrls([preferred, `${protocol.startsWith('http') ? protocol : 'http:'}//${hostname}:8000`, DEFAULT_LAN_API_BASE_URL, ...FALLBACK_LAN_API_BASE_URLS]);
}

function rememberApiBaseUrl(baseUrl: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(API_PREFERRED_KEY, normalizeBaseUrl(baseUrl));
}

export function apiConnectionMessage(path = '') {
  const targets = getApiBaseUrlCandidates().slice(0, 4).map(baseUrl => `${baseUrl}${path}`).join(', ');
  return `서버에 연결할 수 없습니다. PC에서 FastAPI가 실행 중인지, 휴대폰과 PC가 같은 Wi-Fi에 있는지, API 주소(${targets})가 맞는지 확인해 주세요.`;
}

function apiFailureMessage(path: string, error: unknown, attempted: string[]) {
  const targets = attempted.length ? attempted.map(baseUrl => `${baseUrl}${path}`).join(', ') : path;
  if (error instanceof DOMException && error.name === 'AbortError') {
    return `서버 응답 시간이 초과되었습니다. 확인한 주소: ${targets}`;
  }
  if (error instanceof TypeError) {
    return `네트워크 연결이 실패했습니다. 서버 실행 상태와 Wi-Fi를 확인해 주세요. 확인한 주소: ${targets}`;
  }
  return apiConnectionMessage(path);
}

function normalizeHeaders(headers?: HeadersInit) {
  if (!headers) return undefined;
  if (headers instanceof Headers) return Object.fromEntries(headers.entries());
  if (Array.isArray(headers)) return Object.fromEntries(headers);
  return headers;
}

async function fetchNativeApi(baseUrl: string, path: string, init: RequestInit = {}, timeoutMs = 8000) {
  const body = init.body;
  const canUseNativeBody =
    body === undefined ||
    body === null ||
    typeof body === 'string' ||
    body instanceof URLSearchParams;

  if (!canUseNativeBody) return null;

  const result = await CapacitorHttp.request({
    url: `${baseUrl}${path}`,
    method: init.method || 'GET',
    headers: normalizeHeaders(init.headers),
    data: body instanceof URLSearchParams ? body.toString() : body,
    connectTimeout: timeoutMs,
    readTimeout: timeoutMs,
  });
  const responseBody = typeof result.data === 'string' ? result.data : JSON.stringify(result.data ?? null);
  return new Response(responseBody, {
    status: result.status,
    headers: result.headers,
  });
}

async function fetchBrowserApi(baseUrl: string, path: string, init: RequestInit = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(`${baseUrl}${path}`, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export async function fetchApi(path: string, init: RequestInit = {}, timeoutMs = DEFAULT_API_TIMEOUT_MS) {
  const candidates = getApiBaseUrlCandidates();
  let lastError: unknown = null;
  const attempted: string[] = [];
  const authenticatedInit: RequestInit = { ...init, headers: withAuthorization(init.headers) };
  const deadline = Date.now() + timeoutMs;

  for (const baseUrl of candidates) {
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) break;
    const attemptTimeoutMs = Math.max(800, Math.min(MAX_ATTEMPT_TIMEOUT_MS, remainingMs));
    attempted.push(baseUrl);
    try {
      if (Capacitor.isNativePlatform()) {
        const nativeResponse = await fetchNativeApi(baseUrl, path, authenticatedInit, attemptTimeoutMs);
        if (nativeResponse) {
          rememberApiBaseUrl(baseUrl);
          return announceExpiredSession(nativeResponse, path);
        }
      }
      const response = await fetchBrowserApi(baseUrl, path, authenticatedInit, attemptTimeoutMs);
      rememberApiBaseUrl(baseUrl);
      return announceExpiredSession(response, path);
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(apiFailureMessage(path, lastError, attempted));
}
