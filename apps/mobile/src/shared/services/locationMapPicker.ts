import { nextTick, ref, type Ref } from 'vue';
import {
  findKakaoMapPoint,
  getKakaoMapJavaScriptKey,
  loadKakaoMaps,
  reverseKakaoMapPoint,
  type KakaoMapInstance,
  type KakaoMapPoint,
  type KakaoMarkerInstance,
} from '@/shared/services/kakaoMap';
import {
  findLocationPointByRest,
  latLngToWorldPixel,
  parseCoordinatePoint,
  renderStaticMapHtml,
  reverseLocationPointByRest,
  worldPixelToLatLng,
} from '@/shared/services/staticMap';

type KakaoMapsRuntime = Awaited<ReturnType<typeof loadKakaoMaps>>;

type LocationMapPickerOptions = {
  fallbackQuery?: string;
  emptyMessage?: string;
};

const DEFAULT_FALLBACK_QUERY = '서울 시청';
const DEFAULT_FALLBACK_POINT: KakaoMapPoint = {
  lat: 37.5665,
  lng: 126.978,
  title: '서울 시청',
  addressName: '서울특별시 중구 태평로1가',
};

export function useLocationMapPicker(location: Ref<string>, options: LocationMapPickerOptions = {}) {
  const mapContainer = ref<HTMLElement | null>(null);
  const mapMessage = ref(options.emptyMessage || '지역명을 입력하거나 지도에서 원하는 위치를 누르세요.');
  const mapPoint = ref<KakaoMapPoint | null>(null);
  const mapFallbackHtml = ref('');
  const mapZoom = ref(15);
  const isLocatingCurrentPosition = ref(false);

  let map: KakaoMapInstance | null = null;
  let marker: KakaoMarkerInstance | null = null;
  let mapClickBound = false;
  let mapRequest = 0;
  let mapTimer: number | undefined;
  let fallbackDrag:
    | { pointerId: number; startX: number; startY: number; startLat: number; startLng: number; moved: boolean }
    | null = null;

  const renderFallbackMap = (point: KakaoMapPoint) => {
    mapFallbackHtml.value = renderStaticMapHtml(point, {
      zoom: mapZoom.value,
      tileRadius: 2,
      markerSize: 26,
      showInfo: false,
      touchAction: 'none',
    });
  };

  const pointFromCoordinates = async (lat: number, lng: number, kakao?: KakaoMapsRuntime): Promise<KakaoMapPoint> => {
    const kakaoPoint = kakao
      ? await reverseKakaoMapPoint(lat, lng, kakao).catch(() => null)
      : null;
    if (kakaoPoint) return kakaoPoint;
    const reversed = await reverseLocationPointByRest(lat, lng).catch(() => null);
    if (reversed) return reversed;
    return {
      lat,
      lng,
      title: '선택한 거래 지역',
      addressName: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
    };
  };

  const setKakaoMarker = (kakao: KakaoMapsRuntime, point: KakaoMapPoint) => {
    if (!map) return;
    const position = new kakao.maps.LatLng(point.lat, point.lng);
    map.setCenter(position);
    map.relayout();
    if (marker) {
      marker.setPosition(position);
      return;
    }
    marker = new kakao.maps.Marker({ position, map });
  };

  const applySelectedPoint = async (kakao: KakaoMapsRuntime, lat: number, lng: number) => {
    const point = await pointFromCoordinates(lat, lng, kakao);
    mapPoint.value = point;
    mapFallbackHtml.value = '';
    setKakaoMarker(kakao, point);
    location.value = point.addressName || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    mapMessage.value = `${point.addressName}의 행정구역을 불러왔습니다.`;
  };

  const bindKakaoPicker = (kakao: KakaoMapsRuntime) => {
    if (!map || mapClickBound) return;
    kakao.maps.event.addListener(map, 'click', event => {
      void applySelectedPoint(kakao, event.latLng.getLat(), event.latLng.getLng());
    });
    mapClickBound = true;
  };

  const findFallbackPoint = async (query: string) => {
    const coordinatePoint = parseCoordinatePoint(query);
    if (coordinatePoint) return coordinatePoint;
    return await findLocationPointByRest(query).catch(() => null);
  };

  const clampLatLng = (lat: number, lng: number) => ({
    lat: Math.max(-85, Math.min(85, lat)),
    lng: ((lng + 180) % 360 + 360) % 360 - 180,
  });

  const updateFallbackCenter = (lat: number, lng: number, message = '지도를 움직인 뒤 이 위치 선택을 누르세요.') => {
    const next = clampLatLng(lat, lng);
    const point = {
      lat: next.lat,
      lng: next.lng,
      title: '선택한 거래 지역',
      addressName: `${next.lat.toFixed(6)}, ${next.lng.toFixed(6)}`,
    };
    mapPoint.value = point;
    renderFallbackMap(point);
    mapMessage.value = message;
  };

  const startFallbackMapDrag = (event: PointerEvent) => {
    if (!mapFallbackHtml.value || !mapPoint.value) return;
    const target = event.currentTarget as HTMLElement;
    target.setPointerCapture?.(event.pointerId);
    fallbackDrag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startLat: mapPoint.value.lat,
      startLng: mapPoint.value.lng,
      moved: false,
    };
  };

  const moveFallbackMapDrag = (event: PointerEvent) => {
    if (!fallbackDrag || fallbackDrag.pointerId !== event.pointerId) return;
    const dx = event.clientX - fallbackDrag.startX;
    const dy = event.clientY - fallbackDrag.startY;
    if (Math.abs(dx) + Math.abs(dy) < 2) return;
    fallbackDrag.moved = true;
    const startPixel = latLngToWorldPixel(fallbackDrag.startLat, fallbackDrag.startLng, mapZoom.value);
    const next = worldPixelToLatLng(startPixel.x - dx, startPixel.y - dy, mapZoom.value);
    updateFallbackCenter(next.lat, next.lng);
  };

  const endFallbackMapDrag = (event: PointerEvent) => {
    const target = event.currentTarget as HTMLElement;
    target.releasePointerCapture?.(event.pointerId);
    if (!fallbackDrag || fallbackDrag.pointerId !== event.pointerId) return;
    if (!fallbackDrag.moved && mapPoint.value) {
      const rect = target.getBoundingClientRect();
      const dx = event.clientX - (rect.left + rect.width / 2);
      const dy = event.clientY - (rect.top + rect.height / 2);
      const centerPixel = latLngToWorldPixel(mapPoint.value.lat, mapPoint.value.lng, mapZoom.value);
      const next = worldPixelToLatLng(centerPixel.x + dx, centerPixel.y + dy, mapZoom.value);
      updateFallbackCenter(next.lat, next.lng, '선택한 지점으로 핀을 옮겼습니다. 이 위치 선택을 누르세요.');
    }
    fallbackDrag = null;
  };

  const chooseFallbackLocation = async () => {
    const point = mapPoint.value;
    if (!point) return;
    const coords = `${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`;
    const selectedPoint = point.addressName && point.addressName !== coords
      ? point
      : await reverseLocationPointByRest(point.lat, point.lng).catch(() => null) || point;
    mapPoint.value = selectedPoint;
    renderFallbackMap(selectedPoint);
    location.value = selectedPoint.addressName && selectedPoint.addressName !== coords
      ? selectedPoint.addressName
      : selectedPoint.title || coords;
    mapMessage.value = `${location.value}의 행정구역을 불러왔습니다.`;
  };

  const getCurrentPosition = () => new Promise<GeolocationPosition>((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('이 기기에서 현재 위치를 사용할 수 없습니다.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 30000,
    });
  });

  const useCurrentLocation = async () => {
    if (isLocatingCurrentPosition.value) return;
    isLocatingCurrentPosition.value = true;
    mapMessage.value = '현재 위치를 확인하는 중입니다.';
    try {
      const position = await getCurrentPosition();
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      const appKey = getKakaoMapJavaScriptKey();
      const kakao = appKey ? await loadKakaoMaps(appKey).catch(() => null) : null;
      const point = await pointFromCoordinates(lat, lng, kakao || undefined);

      mapPoint.value = point;
      location.value = point.addressName || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      if (kakao && mapContainer.value) {
        const center = new kakao.maps.LatLng(point.lat, point.lng);
        if (!map) {
          map = new kakao.maps.Map(mapContainer.value, { center, level: 3 });
          mapClickBound = false;
        }
        mapFallbackHtml.value = '';
        setKakaoMarker(kakao, point);
        bindKakaoPicker(kakao);
      } else {
        renderFallbackMap(point);
      }
      mapMessage.value = `${point.addressName}의 행정구역을 불러왔습니다.`;
    } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error
        ? Number((error as GeolocationPositionError).code)
        : 0;
      mapMessage.value = code === 1
        ? '위치 권한이 거부되었습니다. 앱 설정에서 위치 권한을 허용해 주세요.'
        : error instanceof Error
          ? error.message
          : '현재 위치를 가져오지 못했습니다.';
    } finally {
      isLocatingCurrentPosition.value = false;
    }
  };

  const lookupQuery = () => {
    const query = location.value.trim();
    return query || options.fallbackQuery?.trim() || DEFAULT_FALLBACK_QUERY;
  };

  const renderMap = async () => {
    await nextTick();
    const container = mapContainer.value;
    if (!container) return;

    const requestId = ++mapRequest;
    const query = location.value.trim();
    const targetQuery = lookupQuery();
    const appKey = getKakaoMapJavaScriptKey();

    if (!targetQuery) {
      marker?.setMap(null);
      mapPoint.value = null;
      mapFallbackHtml.value = '';
      mapMessage.value = options.emptyMessage || '지역명을 입력하거나 지도에서 원하는 위치를 누르세요.';
      return;
    }

    const coordinatePoint = parseCoordinatePoint(targetQuery);
    const immediatePoint = coordinatePoint || mapPoint.value || DEFAULT_FALLBACK_POINT;
    const fallbackPointPromise = coordinatePoint
      ? Promise.resolve(coordinatePoint)
      : findFallbackPoint(targetQuery);
    mapPoint.value = immediatePoint;
    renderFallbackMap(immediatePoint);
    mapMessage.value = '기본 지도를 표시하고 있습니다.';

    if (!appKey) {
      const fallbackPoint = await fallbackPointPromise;
      if (requestId !== mapRequest) return;
      marker?.setMap(null);
      if (!fallbackPoint) {
        mapMessage.value = '기본 지도에서 원하는 위치를 누른 뒤 이 위치 선택을 누르세요.';
        return;
      }
      mapPoint.value = fallbackPoint;
      renderFallbackMap(fallbackPoint);
      mapMessage.value = query
        ? `${fallbackPoint.title} 표시 중 · 지도를 움직이거나 누른 뒤 이 위치 선택을 누르세요.`
        : '지도를 움직이거나 누른 뒤 이 위치 선택을 누르세요.';
      return;
    }

    mapMessage.value = '기본 지도 표시 중 · 카카오 지도에 연결하고 있습니다.';
    void fallbackPointPromise.then(point => {
      if (requestId !== mapRequest || !point || !mapFallbackHtml.value) return;
      marker?.setMap(null);
      mapPoint.value = point;
      renderFallbackMap(point);
      mapMessage.value = query
        ? `${point.title} 표시 중 · 카카오 지도에 연결하고 있습니다.`
        : '기본 지도 표시 중 · 카카오 지도에 연결하고 있습니다.';
    });
    try {
      const kakao = await loadKakaoMaps(appKey);
      if (requestId !== mapRequest) return;
      const point = coordinatePoint || await findKakaoMapPoint(targetQuery, kakao);
      if (requestId !== mapRequest) return;
      if (!point) {
        marker?.setMap(null);
        mapMessage.value = '기본 지도에서 원하는 위치를 누른 뒤 이 위치 선택을 누르세요.';
        return;
      }

      const center = new kakao.maps.LatLng(point.lat, point.lng);
      if (!map) {
        map = new kakao.maps.Map(container, { center, level: 3 });
        mapClickBound = false;
      } else {
        map.setCenter(center);
        map.relayout();
      }
      mapFallbackHtml.value = '';
      mapPoint.value = point;
      setKakaoMarker(kakao, point);
      bindKakaoPicker(kakao);
      mapMessage.value = query
        ? `${point.title} 표시 중 · 지도에서 원하는 위치를 누르세요.`
        : '지도에서 원하는 위치를 누르면 거래 지역으로 입력됩니다.';
      window.setTimeout(() => map?.relayout(), 0);
    } catch {
      const fallbackPoint = await fallbackPointPromise;
      if (requestId !== mapRequest) return;
      marker?.setMap(null);
      if (!fallbackPoint) {
        mapPoint.value = immediatePoint;
        renderFallbackMap(immediatePoint);
        mapMessage.value = '기본 지도에서 원하는 위치를 누른 뒤 이 위치 선택을 누르세요.';
        return;
      }
      mapPoint.value = fallbackPoint;
      renderFallbackMap(fallbackPoint);
      mapMessage.value = query
        ? `${fallbackPoint.title} 표시 중 · 지도를 움직이거나 누른 뒤 이 위치 선택을 누르세요.`
        : '지도를 움직이거나 누른 뒤 이 위치 선택을 누르세요.';
    }
  };

  const scheduleMap = (delay = 180) => {
    if (mapTimer) window.clearTimeout(mapTimer);
    mapTimer = window.setTimeout(() => {
      void renderMap();
    }, delay);
  };

  const cleanupMap = () => {
    if (mapTimer) window.clearTimeout(mapTimer);
    marker?.setMap(null);
    marker = null;
  };

  return {
    mapContainer,
    mapMessage,
    mapPoint,
    mapFallbackHtml,
    isLocatingCurrentPosition,
    useCurrentLocation,
    chooseFallbackLocation,
    renderMap,
    scheduleMap,
    startFallbackMapDrag,
    moveFallbackMapDrag,
    endFallbackMapDrag,
    cleanupMap,
  };
}
