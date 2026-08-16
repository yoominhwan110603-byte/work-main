<template>
  <div class="size-full bg-white text-gray-900 flex flex-col">
    <header class="shrink-0 px-4 py-4 flex items-center border-b bg-white z-10">
      <button class="p-2 rounded-full active:bg-gray-100" @click="router.back()">
        <ArrowLeft :size="24" />
      </button>
      <h1 class="ml-4 text-lg font-semibold">거래 장소</h1>
    </header>

    <main class="flex-1 relative min-h-0 bg-gray-100">
      <div ref="mapContainer" class="absolute inset-0"></div>
      <div v-if="fallbackMapHtml" class="absolute inset-0" v-html="fallbackMapHtml"></div>

      <section class="absolute left-4 right-4 top-4 z-10 rounded-lg border bg-white/95 p-3 shadow-sm backdrop-blur">
        <p class="text-xs text-gray-500">약속 장소</p>
        <h2 class="mt-1 truncate text-base font-semibold">{{ placeTitle }}</h2>
        <p class="mt-1 truncate text-sm text-gray-600">{{ displayAddress }}</p>
      </section>

      <div v-if="mapMessage" class="absolute inset-x-4 top-1/2 z-10 -translate-y-1/2 rounded-lg border bg-white p-4 text-center shadow-sm">
        <MapPin :size="24" class="mx-auto mb-2 text-blue-600" />
        <p class="text-sm text-gray-700">{{ mapMessage }}</p>
      </div>
    </main>

    <footer class="shrink-0 bg-white p-4 border-t safe-area-bottom">
      <div class="mb-4">
        <h2 class="mb-1 text-base font-semibold">{{ placeTitle }}</h2>
        <p class="text-sm text-gray-600">{{ displayAddress }}</p>
      </div>
      <div class="flex gap-2">
        <button class="flex-1 py-3 bg-blue-600 text-white rounded-lg flex items-center justify-center gap-2 disabled:bg-gray-300" :disabled="!directionUrl" @click="openDirections">
          <Navigation :size="20" />길찾기
        </button>
        <button class="flex-1 py-3 border border-gray-300 rounded-lg" @click="router.back()">확인</button>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowLeft, MapPin, Navigation } from 'lucide-vue-next';
import { fallbackAlbum } from '@/features/buyer/services/albumLookup';
import {
  findKakaoMapPoint,
  getKakaoMapJavaScriptKey,
  loadKakaoMaps,
  type KakaoMapInstance,
  type KakaoMapPoint,
  type KakaoMarkerInstance,
} from '@/shared/services/kakaoMap';
import { useAppStore } from '@/shared/stores/appStore';
import { findLocationPointByRest, parseCoordinatePoint, renderStaticMapHtml } from '@/shared/services/staticMap';

const DEFAULT_POINT: KakaoMapPoint = {
  lat: 37.497952,
  lng: 127.027619,
  title: '강남역 2번 출구',
  addressName: '서울특별시 강남구 강남대로 396',
};

const route = useRoute();
const router = useRouter();
const store = useAppStore();
const mapContainer = ref<HTMLElement | null>(null);
const mapMessage = ref('지도를 불러오는 중입니다.');
const selectedPoint = ref<KakaoMapPoint | null>(null);
const fallbackMapHtml = ref('');
let map: KakaoMapInstance | null = null;
let marker: KakaoMarkerInstance | null = null;
let disposed = false;

const transactionId = computed(() => String(route.params.transactionId || ''));
const album = computed(() => fallbackAlbum(store, route.query.albumId || transactionId.value));
const listingLocation = computed(() => album.value.location.trim());
const mapQuery = computed(() => listingLocation.value || DEFAULT_POINT.addressName);
const placeTitle = computed(() => selectedPoint.value?.title || (listingLocation.value ? '거래 장소' : DEFAULT_POINT.title));
const displayAddress = computed(() => selectedPoint.value?.addressName || mapQuery.value || '거래 장소가 아직 정해지지 않았습니다.');
const directionUrl = computed(() => {
  const point = selectedPoint.value;
  if (!point) return mapQuery.value ? `https://map.kakao.com/link/search/${encodeURIComponent(mapQuery.value)}` : '';
  return `https://map.kakao.com/link/to/${encodeURIComponent(placeTitle.value)},${point.lat},${point.lng}`;
});

const lonLatToTile = (lat: number, lng: number, zoom: number) => {
  const scale = 2 ** zoom;
  const x = Math.floor(((lng + 180) / 360) * scale);
  const latRad = lat * Math.PI / 180;
  const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * scale);
  return { x, y };
};

const escapeMapText = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const renderFallbackMap = (point: KakaoMapPoint) => {
  fallbackMapHtml.value = renderStaticMapHtml(point, {
    zoom: 15,
    tileRadius: 2,
    markerSize: 30,
    showInfo: true,
  });
};

const relayoutMap = () => {
  map?.relayout();
};

const renderMap = async () => {
  await nextTick();
  if (!mapContainer.value || disposed) return;

  const coordinatePoint = parseCoordinatePoint(mapQuery.value);
  if (coordinatePoint) {
    marker?.setMap(null);
    selectedPoint.value = coordinatePoint;
    renderFallbackMap(coordinatePoint);
    mapMessage.value = '';
    return;
  }

  const restPoint = await findLocationPointByRest(mapQuery.value).catch(() => null);
  if (disposed) return;
  if (restPoint) {
    marker?.setMap(null);
    selectedPoint.value = restPoint;
    renderFallbackMap(restPoint);
    mapMessage.value = '';
    return;
  }

  if (!getKakaoMapJavaScriptKey()) {
    mapMessage.value = 'VITE_KAKAO_MAP_JAVASCRIPT_KEY가 없어 지도를 표시할 수 없습니다.';
    return;
  }

  mapMessage.value = '지도를 불러오는 중입니다.';
  try {
    fallbackMapHtml.value = '';
    const kakao = await loadKakaoMaps();
    if (disposed || !mapContainer.value) return;

    const point = listingLocation.value
      ? await findKakaoMapPoint(mapQuery.value, kakao)
      : DEFAULT_POINT;

    if (!point) {
      selectedPoint.value = null;
      mapMessage.value = `"${mapQuery.value}" 위치를 찾지 못했습니다.`;
      return;
    }

    const center = new kakao.maps.LatLng(point.lat, point.lng);
    if (!map) {
      map = new kakao.maps.Map(mapContainer.value, { center, level: 3 });
    } else {
      map.setCenter(center);
    }

    marker?.setMap(null);
    marker = new kakao.maps.Marker({ position: center, map });
    selectedPoint.value = point;
    mapMessage.value = '';
    window.setTimeout(relayoutMap, 0);
  } catch (error) {
    const point = await findLocationPointByRest(mapQuery.value).catch(() => null);
    if (disposed) return;
    if (point) {
      marker?.setMap(null);
      selectedPoint.value = point;
      renderFallbackMap(point);
      mapMessage.value = '';
      return;
    }
    selectedPoint.value = null;
    fallbackMapHtml.value = '';
    mapMessage.value = error instanceof Error ? error.message : '카카오맵을 표시하지 못했습니다.';
  }
};

const openDirections = () => {
  if (!directionUrl.value) return;
  window.open(directionUrl.value, '_blank', 'noopener,noreferrer');
};

onMounted(async () => {
  window.addEventListener('resize', relayoutMap);
  void renderMap();
  if (store.listings.length === 0) {
    const initialQuery = mapQuery.value;
    await store.loadListingsFromServer();
    if (!disposed && mapQuery.value !== initialQuery) void renderMap();
  }
});

onBeforeUnmount(() => {
  disposed = true;
  window.removeEventListener('resize', relayoutMap);
  marker?.setMap(null);
});
</script>
