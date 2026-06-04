import { Capacitor, CapacitorHttp } from '@capacitor/core';

const DEFAULT_LAN_API_BASE_URL = 'http://172.30.1.67:8000';
const FALLBACK_LAN_API_BASE_URLS = [
  'http://172.30.1.67:8000',
  'http://192.168.219.112:8000',
  'http://192.168.219.113:8000',
  'http://172.30.14.95:8000',
];
const API_OVERRIDE_KEY = 'vinyl-check-api-base-url';

function normalizeBaseUrl(value: string) {
  return value.trim().replace(/\/$/, '');
}

function uniqueUrls(urls: Array<string | undefined>) {
  return Array.from(new Set(urls.filter(Boolean).map(value => normalizeBaseUrl(value!))));
}

export function getApiBaseUrl() {
  return getApiBaseUrlCandidates()[0];
}

export function getApiBaseUrlCandidates() {
  if (typeof window === 'undefined') return ['http://127.0.0.1:8000'];

  const { protocol, hostname } = window.location;
  const localHostnames = new Set(['localhost', '127.0.0.1', '::1']);
  const configured = import.meta.env.VITE_API_BASE_URL;
  const stored = localStorage.getItem(API_OVERRIDE_KEY) || '';

  if (configured) return uniqueUrls([configured, stored, ...FALLBACK_LAN_API_BASE_URLS]);
  if (stored) return uniqueUrls([stored, ...FALLBACK_LAN_API_BASE_URLS]);
  if (protocol.startsWith('http') && localHostnames.has(hostname)) return uniqueUrls(['http://127.0.0.1:8000', ...FALLBACK_LAN_API_BASE_URLS]);
  if (protocol === 'capacitor:') return uniqueUrls([DEFAULT_LAN_API_BASE_URL, ...FALLBACK_LAN_API_BASE_URLS]);
  return uniqueUrls([`${protocol.startsWith('http') ? protocol : 'http:'}//${hostname}:8000`, ...FALLBACK_LAN_API_BASE_URLS]);
}

export function apiConnectionMessage(path = '') {
  const targets = getApiBaseUrlCandidates().map(baseUrl => `${baseUrl}${path}`).join(', ');
  return `서버에 연결할 수 없습니다. PC에서 FastAPI가 실행 중인지, 휴대폰과 PC가 같은 Wi-Fi에 있는지, API 주소(${targets})가 맞는지 확인해 주세요.`;
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

export async function fetchApi(path: string, init: RequestInit = {}, timeoutMs = 8000) {
  const candidates = getApiBaseUrlCandidates();
  let lastError: unknown = null;

  for (const baseUrl of candidates) {
    try {
      if (Capacitor.isNativePlatform()) {
        const nativeResponse = await fetchNativeApi(baseUrl, path, init, timeoutMs);
        if (nativeResponse) return nativeResponse;
      }
      return await fetchBrowserApi(baseUrl, path, init, timeoutMs);
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError instanceof DOMException && lastError.name === 'AbortError') {
    throw new Error(`서버 응답 시간이 초과되었습니다. ${apiConnectionMessage(path)}`);
  }
  throw new Error(apiConnectionMessage(path));
}
