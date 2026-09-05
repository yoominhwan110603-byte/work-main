<template>
  <div v-if="album" class="size-full bg-white flex flex-col">
    <header class="px-4 py-4 flex items-center border-b sticky top-0 bg-white z-10">
      <button class="p-2" @click="goBackOr(router, '/app')"><ArrowLeft :size="24" /></button>
    </header>

    <div class="flex-1 overflow-y-auto">
      <div class="relative">
        <VinylCover :src="detailImageSrc" :alt="album.title" class="w-full aspect-square object-cover" />
        <div v-if="album.images.length > 1" class="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
          <button
            v-for="(_, index) in album.images"
            :key="index"
            :class="['w-2 h-2 rounded-full', index === currentImageIndex ? 'bg-white' : 'bg-white/50']"
            @click="currentImageIndex = index"
          />
        </div>
      </div>

      <div class="p-4 space-y-4">
        <div class="flex items-start justify-between">
          <div class="flex-1 min-w-0">
            <h1 class="text-2xl mb-1">{{ album.title }}</h1>
            <p class="text-lg text-gray-600">{{ album.artist }}</p>
          </div>
          <button
            v-if="showMarketplaceMetrics"
            :class="['rounded-full p-2', isWishlisted ? 'bg-red-50' : '']"
            aria-label="찜/위시 등록"
            :aria-pressed="isWishlisted"
            :disabled="wishlistSaving"
            @click="toggleWishlist"
          >
            <Heart :size="28" :class="isWishlisted ? 'fill-red-500 text-red-500' : 'text-gray-400'" />
          </button>
        </div>

        <div class="flex items-center gap-2 text-sm text-gray-600">
          <span>{{ album.year }}년</span>
          <span>·</span>
          <span>{{ album.genre }}</span>
          <template v-if="showMarketplaceMetrics">
            <span>·</span>
            <Eye :size="14" />
            <span>{{ album.views }}</span>
          </template>
          <template v-if="isOwnListing && !isCompletedTrade">
            <span>·</span>
            <span class="text-blue-600">판매 중</span>
          </template>
          <template v-if="isCompletedTrade">
            <span>·</span>
            <span class="text-green-600">거래 완료</span>
          </template>
        </div>

        <section class="border-t pt-3">
          <div class="rounded-lg bg-gray-50 p-3">
            <div class="mb-1.5 flex items-center justify-between gap-3">
              <h2 class="text-sm font-medium text-gray-900">상세 설명</h2>
              <button
                v-if="showDescriptionToggle"
                type="button"
                class="shrink-0 text-xs font-medium text-blue-600"
                @click="descriptionExpanded = !descriptionExpanded"
              >
                {{ descriptionExpanded ? '접기' : '더보기' }}
              </button>
            </div>
            <p class="whitespace-pre-line text-sm leading-5 text-gray-600">{{ visibleDescription }}</p>
          </div>
        </section>

        <section class="border-t pt-4">
          <div class="bg-blue-50 p-4 rounded-lg">
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-lg">Vinyl-Check 감정</h2>
            <div class="flex items-center gap-1 text-blue-600"><BadgeCheck :size="18" /><span class="text-sm">인증됨</span></div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div><p class="text-sm text-gray-600 mb-1">음질 등급</p><p class="text-2xl">{{ audioGradeText }}</p></div>
            <div><p class="text-sm text-gray-600 mb-1">음질 점수</p><p class="text-2xl text-blue-600">{{ audioScoreText }}</p></div>
            <div><p class="text-sm text-gray-600 mb-1">스크래치 등급</p><p class="text-lg">{{ surfaceGradeText }}</p></div>
            <div><p class="text-sm text-gray-600 mb-1">스크래치 점수</p><p class="text-lg">{{ surfaceScoreText }}</p></div>
          </div>
          <div v-if="hasScratchInspection" class="mt-4 border-t border-blue-100 pt-4">
            <div class="mb-2 flex items-center justify-between gap-3">
              <h3 class="text-sm font-medium text-blue-950">스크래치 분석 사진</h3>
              <span class="shrink-0 text-xs text-blue-700">후보 {{ scratchCandidateCount }}곳</span>
            </div>
            <div class="relative overflow-hidden rounded-lg bg-black">
              <img :src="scratchImageUrl" alt="스크래치 분석 표면 사진" class="block h-auto w-full" />
              <svg
                v-if="scratchRegions.length"
                viewBox="0 0 1 1"
                preserveAspectRatio="none"
                class="pointer-events-none absolute inset-0 h-full w-full"
                aria-hidden="true"
              >
                <template v-for="(region, index) in scratchRegions" :key="`${region.x1}-${region.y1}-${index}`">
                  <line
                    :x1="region.x1"
                    :y1="region.y1"
                    :x2="region.x2"
                    :y2="region.y2"
                    stroke="rgba(255,255,255,0.78)"
                    stroke-width="10"
                    stroke-linecap="round"
                    vector-effect="non-scaling-stroke"
                  />
                  <line
                    :x1="region.x1"
                    :y1="region.y1"
                    :x2="region.x2"
                    :y2="region.y2"
                    :stroke="scratchColor(region.severity)"
                    stroke-width="4"
                    stroke-linecap="round"
                    vector-effect="non-scaling-stroke"
                  />
                </template>
              </svg>
              <span v-if="!scratchRegions.length" class="absolute bottom-2 left-2 rounded bg-black/70 px-2 py-1 text-xs text-white">
                표시된 스크래치 후보 없음
              </span>
            </div>
            <div v-if="scratchRegions.length" class="mt-2 flex flex-wrap gap-3 text-xs text-gray-700">
              <span class="inline-flex items-center gap-1"><span class="h-2 w-4 rounded-full bg-red-500"></span>강함</span>
              <span class="inline-flex items-center gap-1"><span class="h-2 w-4 rounded-full bg-orange-500"></span>중간</span>
              <span class="inline-flex items-center gap-1"><span class="h-2 w-4 rounded-full bg-yellow-500"></span>약함</span>
            </div>
            <p class="mt-2 text-xs leading-4 text-gray-600">자동 감지된 후보 위치이며, 조명 반사나 먼지가 함께 표시될 수 있습니다.</p>
          </div>
          </div>
        </section>

        <section v-if="isOwnListing" ref="buyOrdersSection" class="border-t pt-4">
          <div class="rounded-lg border border-blue-100 bg-blue-50 p-3">
            <div class="flex items-center justify-between gap-3">
              <h2 class="text-sm font-medium text-blue-950">구매대기</h2>
              <span class="rounded bg-white px-2 py-1 text-xs text-blue-700">
                {{ matchesLoading ? '확인 중' : `${buyOrderCount}명` }}
              </span>
            </div>
          </div>
          <p v-if="buyOrdersError" class="mt-3 text-sm text-red-600">{{ buyOrdersError }}</p>
          <p v-else-if="matchesLoaded && !buyOrderMatches.length" class="py-3 text-sm text-gray-500">등록된 구매 대기가 없습니다.</p>
          <article v-for="order in buyOrderMatches" :key="order.id" class="flex items-center gap-3 border-b py-3">
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm">{{ order.buyerAlias || '구매자' }}</p>
              <p class="mt-1 text-base font-medium">{{ order.maxPrice.toLocaleString() }}원</p>
              <p class="text-xs text-gray-500">{{ new Date(order.createdAt).toLocaleString('ko-KR') }}</p>
            </div>
            <button type="button" class="inline-flex shrink-0 items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-50" :disabled="Boolean(approvingOrderId)" @click="approveBuyOrder(order)">
              <Check :size="16" />{{ approvingOrderId === order.id ? '승인 중' : '승인' }}
            </button>
          </article>
        </section>

        <section class="border-t pt-4">
          <div class="rounded-lg bg-neutral-900 p-3 text-white">
          <div class="mb-2 flex items-center justify-between gap-3">
            <div class="flex items-center gap-3 min-w-0">
              <div class="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0"><Volume2 :size="18" /></div>
              <div class="min-w-0">
                <h2 class="text-base">LP 샘플</h2>
                <p class="text-xs text-white/60 truncate">{{ sampleDescription }}</p>
              </div>
            </div>
          </div>
          <div class="space-y-2">
            <div
              v-for="sample in sampleItems"
              :key="sample.kind"
              class="rounded-lg bg-white/10 p-2"
            >
              <button
                type="button"
                class="w-full text-left active:bg-white/10 disabled:opacity-60"
                :disabled="Boolean(samplePlaying) || !sample.dataUrl"
                @click="playSample(sample.kind)"
              >
                <span class="flex items-center justify-between gap-2">
                  <span class="flex min-w-0 items-center gap-2 text-sm font-medium"><Play :size="15" />{{ sample.label }}</span>
                  <span class="shrink-0 text-xs text-white/60">{{ sampleTimeRange(sample) }}</span>
                </span>
                <span class="block truncate text-xs text-white/50">{{ sample.name }}</span>
              </button>
              <audio
                v-if="sample.dataUrl"
                class="sample-audio mt-2 h-8 w-full"
                controls
                preload="metadata"
                @loadedmetadata="prepareInlineSample(sample, $event)"
                @play="handleInlineSamplePlay(sample, $event)"
                @pause="handleInlineSamplePause(sample)"
                @ended="handleInlineSamplePause(sample)"
                @timeupdate="stopInlineSampleAtEnd(sample, $event)"
              >
                <source :src="sample.primaryUrl" :type="sample.mimeType" />
                <source v-if="sample.fallbackUrl" :src="sample.fallbackUrl" :type="sample.mimeType" />
              </audio>
            </div>
          </div>
          <p v-if="samplePlaying" class="text-xs text-white/60 mt-3">{{ samplePlayingText }}</p>
          </div>
        </section>

        <section class="border-t pt-4">
          <h2 class="text-lg mb-2">판본 정보</h2>
          <div class="space-y-2 text-sm">
            <div class="flex justify-between"><span class="text-gray-600">카탈로그 번호</span><span>{{ album.catalogNumber }}</span></div>
            <div class="flex justify-between"><span class="text-gray-600">발매 연도</span><span>{{ album.year }}년</span></div>
          </div>
        </section>

        <section class="border-t pt-4">
          <div class="bg-gray-50 p-4 rounded-lg">
          <p class="text-3xl mb-2">{{ album.price.toLocaleString() }}원</p>
          </div>
        </section>

        <section class="border-t pt-4">
          <h2 class="text-lg mb-3">판매자 정보</h2>
          <div class="flex items-center gap-3 cursor-pointer" @click="router.push(`/app/profile/${album.seller.id}`)">
            <div class="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center"><span class="text-lg">{{ album.seller.name[0] }}</span></div>
            <div class="flex-1">
              <p>{{ album.seller.name }}</p>
              <div class="flex items-center gap-2 text-sm text-gray-600"><span>평점 {{ album.seller.rating }}</span><span>·</span><span>거래 {{ album.seller.transactionCount }}회</span></div>
            </div>
          </div>
        </section>

        <section class="border-t pt-4 space-y-3">
          <div class="flex items-center gap-2 text-gray-600"><MapPin :size="18" /><span>{{ album.location || '거래 위치 미정' }}</span></div>
          <div v-if="album.location" class="relative h-44 overflow-hidden rounded-lg border bg-gray-100">
            <div ref="listingMapContainer" class="absolute inset-0"></div>
            <div v-if="listingFallbackMapHtml" class="absolute inset-0" v-html="listingFallbackMapHtml"></div>
            <div v-if="listingMapMessage" class="absolute inset-x-3 top-1/2 z-10 -translate-y-1/2 rounded-lg bg-white/95 p-3 text-center text-xs text-gray-600 shadow-sm">
              {{ listingMapMessage }}
            </div>
          </div>
        </section>
      </div>
    </div>

    <div v-if="isOwnListing" class="border-t p-4 grid grid-cols-2 gap-2">
      <button class="py-3 border border-gray-300 text-gray-800 rounded-lg flex items-center justify-center gap-1 text-sm" @click="router.push(`/app/sell/${album.id}/edit`)">
        <Pencil :size="18" />수정
      </button>
      <button class="py-3 border border-blue-600 text-blue-600 rounded-lg flex items-center justify-center gap-1 text-sm" @click="router.push({ path: '/transaction/offers/received', query: { listingId: album.id } })">
        <ClipboardList :size="18" />제안
      </button>
      <button class="col-span-2 py-3 border border-red-300 text-red-600 rounded-lg flex items-center justify-center gap-1 text-sm" :disabled="isHidingListing" @click="hideCurrentListing">
        {{ isHidingListing ? '내리는 중' : '게시글 내리기' }}
      </button>
    </div>
    <div v-else class="border-t p-4">
      <button class="w-full py-3 bg-emerald-600 text-white rounded-lg" @click="router.push(`/market/buy-order/${album.id}`)">구매대기</button>
    </div>
  </div>
  <div v-else>앨범을 찾을 수 없습니다</div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowLeft, BadgeCheck, Check, ClipboardList, Eye, Heart, MapPin, Pencil, Play, Volume2 } from 'lucide-vue-next';
import { getActiveTrade, saveActiveTrade } from '@/features/transaction/services/tradeState';
import { useAppStore } from '@/shared/stores/appStore';
import { findAlbumById } from '@/features/buyer/services/albumLookup';
import { goBackOr } from '@/shared/services/navigation';
import { resolveApiUrl } from '@/shared/services/api';
import { fetchBuyOrderMatches, instantSellListing, recordListingView } from '@/shared/services/market';
import { useForegroundRefresh } from '@/shared/composables/useForegroundRefresh';
import type { BuyOrder } from '@/shared/models/market';
import VinylCover from '@/shared/components/VinylCover.vue';
import {
  findKakaoMapPoint,
  getKakaoMapJavaScriptKey,
  loadKakaoMaps,
  type KakaoMapInstance,
  type KakaoMarkerInstance,
} from '@/shared/services/kakaoMap';
import { findLocationPointByRest, parseCoordinatePoint, renderStaticMapHtml } from '@/shared/services/staticMap';
import { resolveUploadedImageUrl } from '@/shared/services/mediaUpload';

const route = useRoute();
const router = useRouter();
const store = useAppStore();
const album = computed(() => findAlbumById(store, route.params.id));
const currentImageIndex = ref(0);
const descriptionExpanded = ref(false);
const samplePlaying = ref<'sample' | 'good' | 'noisy' | null>(null);
const isHidingListing = ref(false);
const buyOrderMatches = ref<BuyOrder[]>([]);
const matchesLoading = ref(false);
const matchesLoaded = ref(false);
const buyOrdersSection = ref<HTMLElement | null>(null);
const buyOrdersError = ref('');
const approvingOrderId = ref('');
let scrolledToBuyOrders = false;
const wishlistSaving = ref(false);
const listingMapContainer = ref<HTMLElement | null>(null);
const listingFallbackMapHtml = ref('');
const listingMapMessage = ref('');
let listingMap: KakaoMapInstance | null = null;
let listingMarker: KakaoMarkerInstance | null = null;
let listingMapRequest = 0;
let sampleAudio: HTMLAudioElement | null = null;
const AUDIO_SAMPLE_PATH_PREFIX = '/audio-samples/';
const resolveSampleUrl = (pathOrUrl: string) => pathOrUrl.startsWith(AUDIO_SAMPLE_PATH_PREFIX) ? pathOrUrl : resolveApiUrl(pathOrUrl);
const resolveSampleFallbackUrl = (pathOrUrl: string) => {
  const primaryUrl = resolveSampleUrl(pathOrUrl);
  const apiUrl = resolveApiUrl(pathOrUrl);
  return primaryUrl !== apiUrl ? apiUrl : '';
};
const sampleMimeType = (pathOrUrl = '') => pathOrUrl.toLowerCase().endsWith('.m4a') ? 'audio/mp4' : 'audio/mpeg';
type SampleItem = {
  kind: 'sample' | 'good' | 'noisy';
  label: string;
  name: string;
  dataUrl?: string;
  primaryUrl: string;
  fallbackUrl: string;
  mimeType: string;
  startSeconds: number;
  endSeconds: number;
  durationSeconds: number;
  recordedAt?: string;
};
type ScratchRegion = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  severity?: 'low' | 'medium' | 'high';
};
type RecordSurfaceAnalysis = {
  analysisAvailable?: boolean;
  source?: string;
  surfaceScore?: number;
  surfaceGrade?: string;
  scratchCount?: number;
  scratchRegions?: ScratchRegion[];
};
const isOwnListing = computed(() => Boolean(album.value && store.isLoggedIn && album.value.seller.id === store.user.id));
const activeTrade = computed(() => album.value ? getActiveTrade(album.value.id) : undefined);
const isCompletedTrade = computed(() => activeTrade.value?.status === 'completed');
const showMarketplaceMetrics = computed(() => !isOwnListing.value && !isCompletedTrade.value);
const buyOrderCount = computed(() => isOwnListing.value && matchesLoaded.value ? buyOrderMatches.value.length : album.value?.buyOrderCount ?? 0);
const isWishlisted = computed(() => Boolean(album.value && store.isFavoriteAlbum(album.value)));
const analysisReport = computed(() => album.value?.analysisReport as Record<string, unknown> | undefined);
const recordSurface = computed(() => analysisReport.value?.recordSurface as RecordSurfaceAnalysis | undefined);
const detailImageSrc = computed(() => resolveUploadedImageUrl(album.value?.images[currentImageIndex.value] || ''));
const scratchImageUrl = computed(() => {
  const reportImage = analysisReport.value?.recordImageDataUrl;
  const source = album.value?.recordImageDataUrl
    ?? (typeof reportImage === 'string' ? reportImage : album.value?.images[1] || '');
  return resolveUploadedImageUrl(source);
});
const scratchRegions = computed(() => {
  const regions = recordSurface.value?.scratchRegions;
  if (!Array.isArray(regions)) return [];
  return regions.filter(region => [region.x1, region.y1, region.x2, region.y2].every(Number.isFinite));
});
const scratchCandidateCount = computed(() => {
  const count = recordSurface.value?.scratchCount;
  return typeof count === 'number' && Number.isFinite(count) ? Math.max(0, count) : scratchRegions.value.length;
});
const hasScratchInspection = computed(() => Boolean(scratchImageUrl.value && recordSurface.value));
const scratchColor = (severity?: ScratchRegion['severity']) => severity === 'high' ? '#ef4444' : severity === 'medium' ? '#f97316' : '#eab308';
const isAudioUnavailable = computed(() => album.value?.audioScore == null || !album.value?.audioGrade || album.value.audioGrade === '분석 불가');
const audioGradeText = computed(() => isAudioUnavailable.value ? '분석 불가' : album.value?.audioGrade || '분석 불가');
const audioScoreText = computed(() => isAudioUnavailable.value ? '분석 불가' : `${album.value?.audioScore || 0}점`);
const surfaceScore = computed(() => recordSurface.value?.surfaceScore || 0);
const surfaceGradeText = computed(() => recordSurface.value?.surfaceGrade || (surfaceScore.value ? gradeFromScore(surfaceScore.value) : '확인 필요'));
const surfaceScoreText = computed(() => surfaceScore.value ? `${surfaceScore.value}점` : '확인 필요');
const DESCRIPTION_PREVIEW_LENGTH = 92;
const descriptionText = computed(() => album.value?.description?.trim() || '등록된 상세 설명이 없습니다.');
const showDescriptionToggle = computed(() => descriptionText.value.length > DESCRIPTION_PREVIEW_LENGTH || descriptionText.value.includes('\n'));
const visibleDescription = computed(() => {
  if (!showDescriptionToggle.value || descriptionExpanded.value) return descriptionText.value;
  return `${descriptionText.value.replace(/\s+/g, ' ').slice(0, DESCRIPTION_PREVIEW_LENGTH).trim()}...`;
});
const hideCurrentListing = async () => {
  if (!album.value || isHidingListing.value) return;
  if (!confirm('이 판매글을 목록에서 내릴까요?')) return;
  isHidingListing.value = true;
  const result = await store.hideListing(album.value.id);
  isHidingListing.value = false;
  alert(result.message);
  if (result.ok) router.push('/app/profile');
};
const loadBuyOrderMatches = async () => {
  if (!album.value || !isOwnListing.value || matchesLoading.value || approvingOrderId.value) return;
  const requestedListingId = album.value.id;
  const requestedToken = store.token;
  matchesLoading.value = true;
  try {
    const result = await fetchBuyOrderMatches(requestedListingId);
    if (requestedToken !== store.token || requestedListingId !== album.value?.id || approvingOrderId.value) return;
    buyOrderMatches.value = result.matches || [];
    buyOrdersError.value = '';
    matchesLoaded.value = true;
    if (route.query.buyOrders === '1' && !scrolledToBuyOrders) {
      await nextTick();
      buyOrdersSection.value?.scrollIntoView({ block: 'start' });
      scrolledToBuyOrders = true;
    }
  } catch (error) {
    buyOrdersError.value = error instanceof Error ? error.message : '구매 대기를 불러오지 못했습니다.';
  } finally {
    matchesLoading.value = false;
  }
};
useForegroundRefresh(loadBuyOrderMatches, () => isOwnListing.value);

const approveBuyOrder = async (order: BuyOrder) => {
  if (!album.value || !isOwnListing.value || approvingOrderId.value) return;
  if (!confirm(`${order.buyerAlias || '구매자'}님의 ${order.maxPrice.toLocaleString()}원 구매 대기를 승인할까요?`)) return;
  const listingId = album.value.id;
  approvingOrderId.value = order.id;
  buyOrdersError.value = '';
  try {
    const result = await instantSellListing(listingId, store.user.id, order.id);
    if (result.listing) store.listings = [result.listing, ...store.listings.filter(item => item.id !== listingId)];
    saveActiveTrade({ albumId: listingId, buyerName: order.buyerAlias || '구매자', offerPrice: order.maxPrice, acceptedAt: new Date().toISOString(), status: 'selling' });
    buyOrderMatches.value = [];
    void store.loadUnreadNotificationCount();
    const chatId = result.chatId || result.transaction?.chatId;
    if (chatId) await router.push({ path: `/transaction/chat/${chatId}`, query: { listingId, recipientId: order.buyerId, recipientName: order.buyerAlias || '구매자' } });
  } catch (error) {
    buyOrdersError.value = error instanceof Error ? error.message : '구매 대기를 승인하지 못했습니다.';
  } finally {
    approvingOrderId.value = '';
  }
};
const toggleWishlist = async () => {
  if (!album.value || wishlistSaving.value) return;
  if (!store.isLoggedIn) {
    alert('로그인 후 찜/위시를 사용할 수 있습니다.');
    return;
  }
  wishlistSaving.value = true;
  try {
    store.toggleFavorite(album.value);
  } catch (error) {
    alert(error instanceof Error ? error.message : '찜/위시 처리에 실패했습니다.');
  } finally {
    wishlistSaving.value = false;
  }
};

function gradeFromScore(score: number) {
  if (score >= 96) return 'M';
  if (score >= 88) return 'NM';
  if (score >= 80) return 'EX';
  if (score >= 70) return 'VG+';
  if (score >= 58) return 'VG';
  if (score >= 45) return 'G';
  return 'P';
}
const formatSampleTime = (seconds?: number) => {
  const safeSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainingSeconds = safeSeconds % 60;
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
};
const sampleTimeRange = (sample: SampleItem) => `${formatSampleTime(sample.startSeconds)}-${formatSampleTime(sample.endSeconds)}`;
const sampleItems = computed<SampleItem[]>(() => {
  const samples = album.value?.audioSamples || {};
  if (samples.sample) {
    const sampleStart = Number(samples.sample.startSeconds ?? 0);
    const sampleDuration = Number(samples.sample.durationSeconds || 60);
    const sampleEnd = Number(samples.sample.endSeconds ?? sampleStart + sampleDuration);
    const sampleDataUrl = samples.sample.dataUrl;
    return [{
      kind: 'sample' as const,
      label: '음질 샘플',
      name: samples.sample.name || `${album.value?.title || 'LP'} 음질 샘플`,
      dataUrl: sampleDataUrl,
      primaryUrl: sampleDataUrl ? resolveSampleUrl(sampleDataUrl) : '',
      fallbackUrl: sampleDataUrl ? resolveSampleFallbackUrl(sampleDataUrl) : '',
      mimeType: sampleMimeType(sampleDataUrl),
      startSeconds: sampleStart,
      endSeconds: sampleEnd,
      durationSeconds: Math.max(1, sampleEnd - sampleStart),
      recordedAt: samples.sample.recordedAt,
    }];
  }
  const goodStart = Number(samples.good?.startSeconds ?? 0);
  const goodDuration = Number(samples.good?.durationSeconds || 20);
  const goodEnd = Number(samples.good?.endSeconds ?? goodStart + goodDuration);
  const noisyStart = Number(samples.noisy?.startSeconds ?? 0);
  const noisyDuration = Number(samples.noisy?.durationSeconds || 15);
  const noisyEnd = Number(samples.noisy?.endSeconds ?? noisyStart + noisyDuration);
  const goodDataUrl = samples.good?.dataUrl;
  const noisyDataUrl = samples.noisy?.dataUrl;
  return [
    {
      kind: 'good' as const,
      label: '좋은 구간',
      name: samples.good ? '좋은 구간 녹음' : `${album.value?.title || 'LP'} 안정 구간`,
      dataUrl: goodDataUrl,
      primaryUrl: goodDataUrl ? resolveSampleUrl(goodDataUrl) : '',
      fallbackUrl: goodDataUrl ? resolveSampleFallbackUrl(goodDataUrl) : '',
      mimeType: sampleMimeType(goodDataUrl),
      startSeconds: goodStart,
      endSeconds: goodEnd,
      durationSeconds: Math.max(1, goodEnd - goodStart),
      recordedAt: samples.good?.recordedAt,
    },
    {
      kind: 'noisy' as const,
      label: '안 좋은 구간',
      name: samples.noisy ? '안 좋은 구간 녹음' : `${album.value?.title || 'LP'} 도입부`,
      dataUrl: noisyDataUrl,
      primaryUrl: noisyDataUrl ? resolveSampleUrl(noisyDataUrl) : '',
      fallbackUrl: noisyDataUrl ? resolveSampleFallbackUrl(noisyDataUrl) : '',
      mimeType: sampleMimeType(noisyDataUrl),
      startSeconds: noisyStart,
      endSeconds: noisyEnd,
      durationSeconds: Math.max(1, noisyEnd - noisyStart),
      recordedAt: samples.noisy?.recordedAt,
    },
  ];
});
const sampleDescription = computed(() => album.value?.audioSamples?.sample || album.value?.audioSamples?.good || album.value?.audioSamples?.noisy
  ? '판매자가 등록한 음질 샘플'
  : `${album.value?.title || 'LP'} 미리듣기 샘플`);
const samplePlayingText = computed(() => {
  const playing = sampleItems.value.find(sample => sample.kind === samplePlaying.value);
  return playing ? `${playing.label} 재생 중` : '';
});

const renderListingFallbackMap = (point: { lat: number; lng: number; title: string; addressName: string }) => {
  listingFallbackMapHtml.value = renderStaticMapHtml(point, {
    zoom: 15,
    tileRadius: 2,
    markerSize: 26,
    showInfo: true,
  });
};

const relayoutListingMap = () => {
  listingMap?.relayout();
};

const renderListingMap = async () => {
  await nextTick();
  const container = listingMapContainer.value;
  const query = album.value?.location?.trim() || '';
  const requestId = ++listingMapRequest;
  if (!container || !query) return;

  listingMapMessage.value = '지도를 불러오는 중입니다.';
  const coordinatePoint = parseCoordinatePoint(query);
  if (coordinatePoint) {
    listingMarker?.setMap(null);
    renderListingFallbackMap(coordinatePoint);
    listingMapMessage.value = '';
    return;
  }

  const restPoint = await findLocationPointByRest(query).catch(() => null);
  if (requestId !== listingMapRequest) return;
  if (restPoint) {
    listingMarker?.setMap(null);
    renderListingFallbackMap(restPoint);
    listingMapMessage.value = '';
    return;
  }

  if (!getKakaoMapJavaScriptKey()) {
    listingMapMessage.value = '지도 위치를 찾지 못했습니다.';
    return;
  }

  try {
    listingFallbackMapHtml.value = '';
    const kakao = await loadKakaoMaps();
    if (requestId !== listingMapRequest || !listingMapContainer.value) return;
    const point = await findKakaoMapPoint(query, kakao);
    if (requestId !== listingMapRequest || !point) {
      listingMapMessage.value = '지도 위치를 찾지 못했습니다.';
      return;
    }
    const center = new kakao.maps.LatLng(point.lat, point.lng);
    if (!listingMap) {
      listingMap = new kakao.maps.Map(listingMapContainer.value, { center, level: 3 });
    } else {
      listingMap.setCenter(center);
      listingMap.relayout();
    }
    listingMarker?.setMap(null);
    listingMarker = new kakao.maps.Marker({ position: center, map: listingMap });
    listingMapMessage.value = '';
    window.setTimeout(relayoutListingMap, 0);
  } catch {
    listingMapMessage.value = '지도 위치를 찾지 못했습니다.';
  }
};

onMounted(async () => {
  if (!album.value) await store.loadListingsFromServer();
  if (album.value) {
    void recordListingView(album.value.id)
      .then(result => {
        if (result.listing) store.listings = [result.listing, ...store.listings.filter(item => item.id !== result.listing.id)];
      })
      .catch(() => undefined);
    void store.loadWishlistFavorites();
    void renderListingMap();
  }
});

const stopSample = () => {
  if (sampleAudio) {
    sampleAudio.pause();
    sampleAudio.ontimeupdate = null;
    sampleAudio.onended = null;
    sampleAudio.onerror = null;
    sampleAudio = null;
  }
  samplePlaying.value = null;
};

const inlineSampleAudios = () => Array.from(document.querySelectorAll<HTMLAudioElement>('.sample-audio'));

const prepareInlineSample = (sample: SampleItem, event: Event) => {
  const audio = event.target as HTMLAudioElement;
  if (sample.startSeconds > 0 && audio.currentTime < sample.startSeconds) audio.currentTime = sample.startSeconds;
};

const handleInlineSamplePlay = (sample: SampleItem, event: Event) => {
  stopSample();
  const currentAudio = event.target as HTMLAudioElement;
  inlineSampleAudios().forEach(audio => {
    if (audio !== currentAudio) audio.pause();
  });
  if (sample.startSeconds > 0 && currentAudio.currentTime < sample.startSeconds) currentAudio.currentTime = sample.startSeconds;
  samplePlaying.value = sample.kind;
};

const handleInlineSamplePause = (sample: SampleItem) => {
  if (samplePlaying.value === sample.kind) samplePlaying.value = null;
};

const stopInlineSampleAtEnd = (sample: SampleItem, event: Event) => {
  const audio = event.target as HTMLAudioElement;
  if (audio.currentTime < sample.endSeconds) return;
  audio.pause();
  audio.currentTime = sample.startSeconds;
  handleInlineSamplePause(sample);
};

const playSample = (kind: 'sample' | 'good' | 'noisy') => {
  if (samplePlaying.value || !album.value) return;
  const savedSample = sampleItems.value.find(item => item.kind === kind);
  if (savedSample?.dataUrl) {
    stopSample();
    samplePlaying.value = kind;
    const shouldSeekInsideSource = savedSample.startSeconds > 0;
    const shouldStopAtEnd = savedSample.endSeconds > savedSample.startSeconds;
    const fallbackUrl = resolveSampleFallbackUrl(savedSample.dataUrl);
    let retriedFallback = false;
    const startAudio = (sourceUrl: string) => {
      sampleAudio = new Audio(sourceUrl);
      sampleAudio.preload = 'auto';
      sampleAudio.onloadedmetadata = () => {
        if (sampleAudio && shouldSeekInsideSource) sampleAudio.currentTime = savedSample.startSeconds;
      };
      sampleAudio.ontimeupdate = shouldStopAtEnd
        ? () => {
          if (sampleAudio && sampleAudio.currentTime >= savedSample.endSeconds) stopSample();
        }
        : null;
      sampleAudio.onended = stopSample;
      const retryOrStop = () => {
        if (!retriedFallback && fallbackUrl) {
          retriedFallback = true;
          if (sampleAudio) {
            sampleAudio.pause();
            sampleAudio.onloadedmetadata = null;
            sampleAudio.ontimeupdate = null;
            sampleAudio.onended = null;
            sampleAudio.onerror = null;
            sampleAudio = null;
          }
          startAudio(fallbackUrl);
          return;
        }
        stopSample();
      };
      sampleAudio.onerror = retryOrStop;
      void sampleAudio.play().catch(retryOrStop);
    };
    startAudio(resolveSampleUrl(savedSample.dataUrl));
    return;
  }

};

onBeforeUnmount(() => {
  stopSample();
  listingMarker?.setMap(null);
});
</script>
