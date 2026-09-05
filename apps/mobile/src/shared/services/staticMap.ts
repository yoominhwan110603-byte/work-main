import { fetchApi } from '@/shared/services/api';
import type { KakaoMapPoint } from '@/shared/services/kakaoMap';

type StaticMapOptions = {
  zoom?: number;
  tileRadius?: number;
  markerSize?: number;
  showInfo?: boolean;
  touchAction?: string;
};

const locationSearchCache = new Map<string, Promise<KakaoMapPoint | null>>();
const reverseLocationCache = new Map<string, Promise<KakaoMapPoint | null>>();

export const clampMapZoom = (zoom: number) => Math.max(12, Math.min(18, zoom));

export const latLngToWorldPixel = (lat: number, lng: number, zoom: number) => {
  const scale = 256 * 2 ** zoom;
  const sinLat = Math.sin(lat * Math.PI / 180);
  return {
    x: ((lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale,
  };
};

export const worldPixelToLatLng = (x: number, y: number, zoom: number) => {
  const scale = 256 * 2 ** zoom;
  const lng = x / scale * 360 - 180;
  const n = Math.PI - 2 * Math.PI * y / scale;
  const lat = 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return { lat, lng };
};

const escapeMapText = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const wrapTileX = (x: number, zoom: number) => {
  const max = 2 ** zoom;
  return ((x % max) + max) % max;
};

export const parseCoordinatePoint = (value: string): KakaoMapPoint | null => {
  const match = value.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    lat,
    lng,
    title: '선택한 거래 위치',
    addressName: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
  };
};

export const renderStaticMapHtml = (point: KakaoMapPoint, options: StaticMapOptions = {}) => {
  const zoom = clampMapZoom(options.zoom ?? 15);
  const tileRadius = options.tileRadius ?? 2;
  const markerSize = options.markerSize ?? 26;
  const centerPixel = latLngToWorldPixel(point.lat, point.lng, zoom);
  const centerTileX = Math.floor(centerPixel.x / 256);
  const centerTileY = Math.floor(centerPixel.y / 256);
  const maxTileY = 2 ** zoom - 1;
  const tiles: string[] = [];

  for (let yOffset = -tileRadius; yOffset <= tileRadius; yOffset += 1) {
    for (let xOffset = -tileRadius; xOffset <= tileRadius; xOffset += 1) {
      const rawX = centerTileX + xOffset;
      const rawY = centerTileY + yOffset;
      if (rawY < 0 || rawY > maxTileY) continue;
      const x = wrapTileX(rawX, zoom);
      const y = rawY;
      const left = rawX * 256 - centerPixel.x;
      const top = rawY * 256 - centerPixel.y;
      tiles.push(`<img src="https://tile.openstreetmap.org/${zoom}/${x}/${y}.png" draggable="false" style="position:absolute;left:calc(50% + ${left}px);top:calc(50% + ${top}px);width:256px;height:256px;max-width:none;pointer-events:none;user-select:none;" alt="">`);
    }
  }

  const title = escapeMapText(point.title);
  const address = escapeMapText(point.addressName);
  const info = options.showInfo === false ? '' : `
      <div style="position:absolute;left:12px;right:12px;bottom:12px;border-radius:8px;background:rgba(255,255,255,.94);padding:8px 10px;font-size:12px;color:#1f2937;box-shadow:0 3px 10px rgba(0,0,0,.12);">
        ${title}<br><span style="color:#6b7280;">${address}</span>
      </div>
  `;

  return `
    <div style="position:absolute;inset:0;overflow:hidden;background:#e5e7eb;touch-action:${options.touchAction ?? 'pan-x pan-y'};">
      ${tiles.join('')}
      <div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-100%);width:${markerSize}px;height:${markerSize}px;border-radius:999px;background:#2563eb;border:${Math.max(4, Math.round(markerSize / 6))}px solid white;box-shadow:0 8px 22px rgba(0,0,0,.28);"></div>
      <div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:8px;height:8px;border-radius:999px;background:#1d4ed8;"></div>
      ${info}
    </div>
  `;
};

export const findLocationPointByRest = async (keyword: string): Promise<KakaoMapPoint | null> => {
  const key = keyword.trim().toLocaleLowerCase('ko-KR');
  if (!key) return null;
  const cached = locationSearchCache.get(key);
  if (cached) return cached;

  const request = (async () => {
    const query = new URLSearchParams({ keyword, count: '1' });
    const response = await fetchApi(`/address/search?${query.toString()}`, {}, 9000);
    if (!response.ok) return null;
    const payload = await response.json() as {
      candidates?: Array<{
        latitude?: string;
        longitude?: string;
        placeName?: string;
        roadAddress?: string;
        jibunAddress?: string;
        address?: string;
      }>;
    };
    const candidate = payload.candidates?.[0];
    const lat = Number(candidate?.latitude);
    const lng = Number(candidate?.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return {
      lat,
      lng,
      title: candidate?.placeName || keyword,
      addressName: candidate?.jibunAddress || candidate?.address || candidate?.roadAddress || keyword,
    };
  })();

  locationSearchCache.set(key, request);
  try {
    return await request;
  } catch (error) {
    locationSearchCache.delete(key);
    throw error;
  }
};

export const reverseLocationPointByRest = async (lat: number, lng: number): Promise<KakaoMapPoint | null> => {
  const key = `${lat.toFixed(6)},${lng.toFixed(6)}`;
  const cached = reverseLocationCache.get(key);
  if (cached) return cached;

  const request = (async () => {
    const query = new URLSearchParams({ lat: String(lat), lng: String(lng) });
    const response = await fetchApi(`/address/reverse?${query.toString()}`, {}, 9000);
    if (!response.ok) return null;
    const payload = await response.json() as {
      candidate?: {
        placeName?: string;
        roadAddress?: string;
        jibunAddress?: string;
        address?: string;
        latitude?: string;
        longitude?: string;
      } | null;
    };
    const candidate = payload.candidate;
    const nextLat = Number(candidate?.latitude ?? lat);
    const nextLng = Number(candidate?.longitude ?? lng);
    if (!Number.isFinite(nextLat) || !Number.isFinite(nextLng)) return null;
    return {
      lat: nextLat,
      lng: nextLng,
      title: candidate?.placeName || '현재 위치',
      addressName: candidate?.jibunAddress || candidate?.roadAddress || candidate?.address || `${nextLat.toFixed(6)}, ${nextLng.toFixed(6)}`,
    };
  })();

  reverseLocationCache.set(key, request);
  try {
    return await request;
  } catch (error) {
    reverseLocationCache.delete(key);
    throw error;
  }
};
