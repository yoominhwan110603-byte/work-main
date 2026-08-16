export interface KakaoMapPoint {
  lat: number;
  lng: number;
  title: string;
  addressName: string;
}

export interface KakaoMapInstance {
  setCenter(position: KakaoLatLng): void;
  relayout(): void;
}

export interface KakaoMarkerInstance {
  setMap(map: KakaoMapInstance | null): void;
  setPosition(position: KakaoLatLng): void;
}

interface KakaoLatLng {
  getLat(): number;
  getLng(): number;
}

interface KakaoMapMouseEvent {
  latLng: KakaoLatLng;
}

interface KakaoAddressResult {
  address_name?: string;
  road_address_name?: string;
  place_name?: string;
  x: string;
  y: string;
}

interface KakaoRegionResult {
  address_name?: string;
  region_1depth_name?: string;
  region_2depth_name?: string;
  region_3depth_name?: string;
  region_type?: string;
  x?: number | string;
  y?: number | string;
}

interface KakaoGeocoder {
  addressSearch(
    keyword: string,
    callback: (results: KakaoAddressResult[], status: string) => void,
  ): void;
  coord2RegionCode(
    longitude: number,
    latitude: number,
    callback: (results: KakaoRegionResult[], status: string) => void,
  ): void;
}

interface KakaoPlaces {
  keywordSearch(
    keyword: string,
    callback: (results: KakaoAddressResult[], status: string) => void,
    options?: { size?: number },
  ): void;
}

interface KakaoMapsNamespace {
  maps: {
    load(callback: () => void): void;
    LatLng: new (lat: number, lng: number) => KakaoLatLng;
    Map: new (container: HTMLElement, options: { center: KakaoLatLng; level: number }) => KakaoMapInstance;
    Marker: new (options: { position: KakaoLatLng; map: KakaoMapInstance }) => KakaoMarkerInstance;
    services: {
      Geocoder: new () => KakaoGeocoder;
      Places: new () => KakaoPlaces;
      Status: { OK: string };
    };
    event: {
      addListener(target: KakaoMapInstance, eventName: string, handler: (event: KakaoMapMouseEvent) => void): void;
    };
  };
}

declare global {
  interface Window {
    kakao?: KakaoMapsNamespace;
  }
}

const KAKAO_MAP_SDK_ID = 'kakao-map-sdk';
const KAKAO_MAP_LOAD_TIMEOUT_MS = 4000;
let kakaoMapLoadPromise: Promise<KakaoMapsNamespace> | null = null;
const kakaoPointCache = new Map<string, Promise<KakaoMapPoint | null>>();

export function getKakaoMapJavaScriptKey() {
  return String(
    import.meta.env.VITE_KAKAO_MAP_JAVASCRIPT_KEY
      || import.meta.env.VITE_KAKAO_MAP_APP_KEY
      || '',
  ).trim();
}

export function loadKakaoMaps(appKey = getKakaoMapJavaScriptKey()) {
  if (!appKey) {
    return Promise.reject(new Error('VITE_KAKAO_MAP_JAVASCRIPT_KEY를 설정해 주세요.'));
  }
  if (window.kakao?.maps?.Map && window.kakao.maps.services?.Geocoder) {
    return Promise.resolve(window.kakao);
  }
  if (kakaoMapLoadPromise) return kakaoMapLoadPromise;

  kakaoMapLoadPromise = new Promise<KakaoMapsNamespace>((resolve, reject) => {
    let settled = false;
    const finish = (kakao: KakaoMapsNamespace) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      resolve(kakao);
    };
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      reject(error);
    };
    const timeoutId = window.setTimeout(() => {
      fail(new Error('카카오맵 연결 시간이 초과되었습니다.'));
    }, KAKAO_MAP_LOAD_TIMEOUT_MS);
    const finishLoad = () => {
      const kakao = window.kakao;
      if (!kakao?.maps?.load) {
        fail(new Error('카카오맵 SDK를 불러오지 못했습니다.'));
        return;
      }
      kakao.maps.load(() => {
        if (!window.kakao?.maps?.Map || !window.kakao.maps.services?.Geocoder) {
          fail(new Error('카카오맵 services 라이브러리를 사용할 수 없습니다.'));
          return;
        }
        finish(window.kakao);
      });
    };

    const existingScript = document.getElementById(KAKAO_MAP_SDK_ID) as HTMLScriptElement | null;
    if (existingScript) {
      existingScript.addEventListener('load', finishLoad, { once: true });
      existingScript.addEventListener('error', () => fail(new Error('카카오맵 SDK 로드에 실패했습니다.')), { once: true });
      if (window.kakao?.maps?.load) finishLoad();
      return;
    }

    const params = new URLSearchParams({
      appkey: appKey,
      libraries: 'services',
      autoload: 'false',
    });
    const script = document.createElement('script');
    script.id = KAKAO_MAP_SDK_ID;
    script.async = true;
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?${params.toString()}`;
    script.addEventListener('load', finishLoad, { once: true });
    script.addEventListener('error', () => fail(new Error('카카오맵 SDK 로드에 실패했습니다.')), { once: true });
    document.head.appendChild(script);
  }).catch(error => {
    kakaoMapLoadPromise = null;
    throw error;
  });

  return kakaoMapLoadPromise;
}

function toMapPoint(result: KakaoAddressResult, fallbackTitle: string): KakaoMapPoint {
  return {
    lat: Number(result.y),
    lng: Number(result.x),
    title: result.place_name || fallbackTitle,
    addressName: result.road_address_name || result.address_name || fallbackTitle,
  };
}

export async function findKakaoMapPoint(keyword: string, kakao?: KakaoMapsNamespace) {
  const query = keyword.trim();
  if (!query) return null;
  const cacheKey = query.toLocaleLowerCase('ko-KR');
  const cachedPoint = kakaoPointCache.get(cacheKey);
  if (cachedPoint) return cachedPoint;

  const request = (async () => {
    const maps = kakao || await loadKakaoMaps();
    const geocoder = new maps.maps.services.Geocoder();
    const places = new maps.maps.services.Places();
    const addressPoint = new Promise<KakaoMapPoint | null>(resolve => {
      geocoder.addressSearch(query, (results, status) => {
        if (status === maps.maps.services.Status.OK && results.length > 0) {
          resolve(toMapPoint(results[0], query));
          return;
        }
        resolve(null);
      });
    });
    const placePoint = new Promise<KakaoMapPoint | null>(resolve => {
      places.keywordSearch(query, (results, status) => {
        if (status === maps.maps.services.Status.OK && results.length > 0) {
          resolve(toMapPoint(results[0], query));
          return;
        }
        resolve(null);
      }, { size: 1 });
    });

    return await new Promise<KakaoMapPoint | null>(resolve => {
      let pending = 2;
      let settled = false;
      const finish = (point: KakaoMapPoint | null) => {
        if (settled) return;
        if (point) {
          settled = true;
          resolve(point);
          return;
        }
        pending -= 1;
        if (pending <= 0) {
          settled = true;
          resolve(null);
        }
      };
      addressPoint.then(finish).catch(() => finish(null));
      placePoint.then(finish).catch(() => finish(null));
    });
  })();

  kakaoPointCache.set(cacheKey, request);
  try {
    return await request;
  } catch (error) {
    kakaoPointCache.delete(cacheKey);
    throw error;
  }
}

export async function reverseKakaoMapPoint(lat: number, lng: number, kakao?: KakaoMapsNamespace) {
  const maps = kakao || await loadKakaoMaps();
  const geocoder = new maps.maps.services.Geocoder();

  return await new Promise<KakaoMapPoint | null>(resolve => {
    geocoder.coord2RegionCode(lng, lat, (results, status) => {
      if (status !== maps.maps.services.Status.OK || results.length === 0) {
        resolve(null);
        return;
      }

      const region = results.find(result => result.region_type === 'H') || results[0];
      const addressName = region.address_name
        || [region.region_1depth_name, region.region_2depth_name, region.region_3depth_name]
          .filter(Boolean)
          .join(' ');
      resolve({
        lat: Number(region.y) || lat,
        lng: Number(region.x) || lng,
        title: addressName || '선택한 지역',
        addressName: addressName || `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
      });
    });
  });
}
