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
}

interface KakaoLatLng {
  getLat(): number;
  getLng(): number;
}

interface KakaoAddressResult {
  address_name?: string;
  road_address_name?: string;
  place_name?: string;
  x: string;
  y: string;
}

interface KakaoGeocoder {
  addressSearch(
    keyword: string,
    callback: (results: KakaoAddressResult[], status: string) => void,
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
  };
}

declare global {
  interface Window {
    kakao?: KakaoMapsNamespace;
  }
}

const KAKAO_MAP_SDK_ID = 'kakao-map-sdk';
let kakaoMapLoadPromise: Promise<KakaoMapsNamespace> | null = null;

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
    const finishLoad = () => {
      const kakao = window.kakao;
      if (!kakao?.maps?.load) {
        reject(new Error('카카오맵 SDK를 불러오지 못했습니다.'));
        return;
      }
      kakao.maps.load(() => {
        if (!window.kakao?.maps?.Map || !window.kakao.maps.services?.Geocoder) {
          reject(new Error('카카오맵 services 라이브러리를 사용할 수 없습니다.'));
          return;
        }
        resolve(window.kakao);
      });
    };

    const existingScript = document.getElementById(KAKAO_MAP_SDK_ID) as HTMLScriptElement | null;
    if (existingScript) {
      existingScript.addEventListener('load', finishLoad, { once: true });
      existingScript.addEventListener('error', () => reject(new Error('카카오맵 SDK 로드에 실패했습니다.')), { once: true });
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
    script.addEventListener('error', () => reject(new Error('카카오맵 SDK 로드에 실패했습니다.')), { once: true });
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
  const maps = kakao || await loadKakaoMaps();

  const geocoder = new maps.maps.services.Geocoder();
  const addressPoint = await new Promise<KakaoMapPoint | null>(resolve => {
    geocoder.addressSearch(query, (results, status) => {
      if (status === maps.maps.services.Status.OK && results.length > 0) {
        resolve(toMapPoint(results[0], query));
        return;
      }
      resolve(null);
    });
  });
  if (addressPoint) return addressPoint;

  const places = new maps.maps.services.Places();
  return await new Promise<KakaoMapPoint | null>(resolve => {
    places.keywordSearch(query, (results, status) => {
      if (status === maps.maps.services.Status.OK && results.length > 0) {
        resolve(toMapPoint(results[0], query));
        return;
      }
      resolve(null);
    }, { size: 1 });
  });
}
