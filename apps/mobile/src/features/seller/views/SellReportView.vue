<template>
  <div class="size-full bg-gray-50 text-gray-900 flex flex-col">
    <header class="bg-white px-4 py-4 flex items-center border-b">
      <button class="p-2 -ml-2" aria-label="뒤로" @click="router.back()">
        <ArrowLeft :size="24" />
      </button>
      <div class="ml-3 min-w-0">
        <h1 class="text-lg">판매 리포트</h1>
        <p class="text-xs text-gray-500 truncate">{{ listing ? `${listing.title} 등록 결과` : '등록 결과 확인' }}</p>
      </div>
    </header>

    <main v-if="loading" class="flex-1 grid place-items-center px-6 text-center">
      <div>
        <LoaderCircle :size="30" class="mx-auto mb-3 animate-spin text-blue-600" />
        <p class="text-sm text-gray-600">판매 리포트를 불러오는 중입니다.</p>
      </div>
    </main>

    <main v-else-if="!listing" class="flex-1 grid place-items-center px-6 text-center">
      <div class="max-w-xs">
        <CircleAlert :size="34" class="mx-auto mb-3 text-gray-400" />
        <h2 class="text-lg">리포트를 만들 매물이 없습니다</h2>
        <p class="mt-2 text-sm text-gray-500">판매 등록을 완료하면 가격과 감정 결과를 기준으로 리포트가 생성됩니다.</p>
        <button class="mt-5 w-full py-3 rounded-lg bg-blue-600 text-white" @click="router.push('/sell')">판매 등록하기</button>
      </div>
    </main>

    <main v-else class="flex-1 overflow-y-auto px-4 py-4 space-y-4 pb-28">
      <section class="bg-white rounded-lg border p-4">
        <div class="flex gap-3">
          <VinylCover :src="listing.images[0]" :alt="listing.title" class="w-20 h-20 rounded-lg object-cover bg-gray-100 shrink-0" />
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2 mb-1">
              <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-green-100 text-green-700 text-xs">
                <CheckCircle2 :size="13" />
                게시 완료
              </span>
              <span v-if="listing.isRare" class="px-2 py-0.5 rounded bg-amber-100 text-amber-700 text-xs">희귀반</span>
              <span v-if="listing.isFirstPress" class="px-2 py-0.5 rounded bg-violet-100 text-violet-700 text-xs">초반</span>
            </div>
            <h2 class="truncate">{{ listing.title }}</h2>
            <p class="text-sm text-gray-500 truncate">{{ listing.artist }} · {{ listing.catalogNumber || '카탈로그 미입력' }}</p>
            <p class="mt-2 text-2xl">{{ formatWon(listing.price) }}</p>
          </div>
        </div>
      </section>

      <section class="bg-white rounded-lg border p-4 space-y-4">
        <div class="flex items-center justify-between gap-3">
          <div>
            <p class="text-sm text-gray-500">가격 판정</p>
            <h2 class="text-xl">{{ priceVerdict.label }}</h2>
          </div>
          <span :class="['px-2.5 py-1 rounded text-xs', priceVerdict.className]">{{ priceVerdict.tone }}</span>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div class="rounded-lg bg-gray-50 p-3">
            <p class="text-xs text-gray-500">현재가</p>
            <p class="mt-1 text-lg">{{ formatWon(listing.price) }}</p>
          </div>
          <div class="rounded-lg bg-blue-50 p-3">
            <p class="text-xs text-blue-700">추천가</p>
            <p class="mt-1 text-lg text-blue-700">{{ formatWon(recommendedPrice) }}</p>
          </div>
          <div class="rounded-lg bg-gray-50 p-3">
            <p class="text-xs text-gray-500">평균 시세</p>
            <p class="mt-1">{{ formatWon(marketAverage) }}</p>
          </div>
          <div class="rounded-lg bg-gray-50 p-3">
            <p class="text-xs text-gray-500">거래 예상</p>
            <p class="mt-1">{{ expectedPace }}</p>
          </div>
        </div>

        <div>
          <div class="mb-2 flex items-center justify-between text-xs text-gray-500">
            <span>{{ formatWon(marketRange.min) }}</span>
            <span>시세 범위</span>
            <span>{{ formatWon(marketRange.max) }}</span>
          </div>
          <div class="relative h-3 rounded-full bg-gray-100 overflow-hidden">
            <div class="absolute inset-y-0 bg-blue-200" :style="{ left: `${rangeBand.left}%`, width: `${rangeBand.width}%` }"></div>
            <div class="absolute top-0 h-3 w-1.5 rounded-full bg-blue-700" :style="{ left: `${priceMarker}%` }"></div>
          </div>
          <p class="mt-2 text-xs text-gray-600">{{ priceVerdict.description }}</p>
        </div>
      </section>

      <section class="bg-white rounded-lg border p-4 space-y-3" v-if="marketEstimate || marketAdviceError">
        <div class="flex items-center justify-between gap-3">
          <div>
            <p class="text-sm text-gray-500">FC온라인식 시세</p>
            <h2 class="text-xl">가격 제한과 판매 조언</h2>
          </div>
          <span v-if="marketAdviceLoading" class="text-xs text-blue-600">갱신 중</span>
        </div>
        <div v-if="marketEstimate" class="grid grid-cols-2 gap-3">
          <div class="rounded-lg bg-blue-50 p-3">
            <p class="text-xs text-blue-700">기준가</p>
            <p class="mt-1">{{ formatWon(marketEstimate.basePrice) }}</p>
          </div>
          <div class="rounded-lg bg-gray-50 p-3">
            <p class="text-xs text-gray-500">가격 범위</p>
            <p class="mt-1">{{ formatWon(marketEstimate.minPrice) }} ~ {{ formatWon(marketEstimate.maxPrice) }}</p>
          </div>
          <div class="rounded-lg bg-gray-50 p-3">
            <p class="text-xs text-gray-500">추천 판매가</p>
            <p class="mt-1">{{ formatWon(marketEstimate.recommendedPrice) }}</p>
          </div>
          <div class="rounded-lg bg-indigo-50 p-3">
            <p class="text-xs text-indigo-700">위시 대기</p>
            <p class="mt-1">{{ marketEstimate.metrics.wishlistCount || 0 }}명</p>
          </div>
        </div>
        <div v-if="marketAdvice?.advice.length" class="space-y-2">
          <p v-for="item in marketAdvice.advice" :key="item.message" class="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {{ item.message }}
          </p>
        </div>
        <p v-if="marketAdviceError" class="rounded-lg bg-red-50 p-3 text-xs text-red-800">{{ marketAdviceError }}</p>
      </section>

      <section class="bg-white rounded-lg border p-4 space-y-3">
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-2 min-w-0">
            <BadgeDollarSign :size="18" />
            <div class="min-w-0">
              <h2>Discogs 실제가 확인</h2>
              <p class="text-xs text-gray-500 truncate">{{ discogsPriceSubtitle }}</p>
            </div>
          </div>
          <button class="p-2 rounded-lg border" aria-label="Discogs 가격 다시 확인" @click="loadDiscogsPricing">
            <RefreshCw :size="17" :class="pricingLoading ? 'animate-spin' : ''" />
          </button>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div class="rounded-lg bg-gray-50 p-3">
            <p class="text-xs text-gray-500">판매 이력 기준</p>
            <p class="mt-1">{{ discogsSuggestedPriceText }}</p>
          </div>
          <div class="rounded-lg bg-gray-50 p-3">
            <p class="text-xs text-gray-500">현재 최저가</p>
            <p class="mt-1">{{ discogsLowestPriceText }}</p>
          </div>
          <div class="rounded-lg bg-gray-50 p-3">
            <p class="text-xs text-gray-500">판매중</p>
            <p class="mt-1">{{ discogsForSaleText }}</p>
          </div>
          <div class="rounded-lg bg-gray-50 p-3">
            <p class="text-xs text-gray-500">기준 컨디션</p>
            <p class="mt-1">{{ priceRecommendation?.condition || '확인 중' }}</p>
          </div>
        </div>

        <div v-if="conditionPriceRows.length" class="rounded-lg border overflow-hidden">
          <div v-for="row in conditionPriceRows" :key="row.condition" class="flex items-center justify-between gap-3 px-3 py-2 text-sm border-b last:border-b-0">
            <span class="truncate">{{ row.condition }}</span>
            <span>{{ formatWon(row.price) }}</span>
          </div>
        </div>

        <p v-if="pricingLoading" class="rounded-lg bg-blue-50 p-3 text-xs text-blue-800">Discogs 판매 이력 기반 가격을 확인하는 중입니다.</p>
        <p v-else-if="discogsNotice" class="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">{{ discogsNotice }}</p>
        <p v-if="pricingError" class="rounded-lg bg-red-50 p-3 text-xs text-red-800">{{ pricingError }}</p>
        <a
          v-if="discogsReleaseUrl"
          :href="discogsReleaseUrl"
          target="_blank"
          rel="noreferrer"
          class="inline-flex items-center gap-1 text-xs text-blue-600"
        >
          Data provided by Discogs
          <ExternalLink :size="13" />
        </a>
      </section>

      <section class="bg-white rounded-lg border p-4 space-y-3">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <BarChart3 :size="18" />
            <h2>시세 추이</h2>
          </div>
          <span class="text-xs text-gray-500">최근 6개월 추정</span>
        </div>
        <div class="h-44 flex items-end gap-2 rounded-lg bg-gray-50 p-3">
          <div v-for="item in priceTrend" :key="item.label" class="flex-1 min-w-0 flex flex-col items-center gap-2">
            <div class="w-full rounded-t bg-blue-500" :style="{ height: `${item.height}%` }"></div>
            <span class="text-[11px] text-gray-500">{{ item.label }}</span>
          </div>
        </div>
        <p class="text-xs text-gray-500">{{ priceBasisText }}</p>
      </section>

      <section class="bg-white rounded-lg border p-4 space-y-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <ShieldCheck :size="18" />
            <h2>감정 요약</h2>
          </div>
          <span class="text-xs text-gray-500">신뢰도 {{ trustScore }}점</span>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div class="rounded-lg bg-blue-50 p-3">
            <p class="text-xs text-blue-700">음질</p>
            <p class="mt-1 text-lg">{{ audioGradeText }}</p>
            <p class="mt-1 text-xs text-blue-700">{{ audioDetailText }}</p>
          </div>
          <div class="rounded-lg bg-emerald-50 p-3">
            <p class="text-xs text-emerald-700">자켓</p>
            <p class="mt-1 text-lg">{{ jacketGradeText }}</p>
            <p class="mt-1 text-xs text-emerald-700">{{ jacketDetailText }}</p>
          </div>
          <div class="rounded-lg bg-stone-50 p-3">
            <p class="text-xs text-stone-600">판면</p>
            <p class="mt-1 text-lg">{{ surfaceScoreText }}</p>
            <p class="mt-1 text-xs text-stone-600">{{ surfaceDetailText }}</p>
          </div>
          <div class="rounded-lg bg-violet-50 p-3">
            <p class="text-xs text-violet-700">판본</p>
            <p class="mt-1 text-lg">{{ pressingText }}</p>
            <p class="mt-1 text-xs text-violet-700">{{ listing.catalogNumber || '카탈로그 번호 보강 필요' }}</p>
          </div>
        </div>
      </section>

      <section class="bg-white rounded-lg border p-4 space-y-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <Gauge :size="18" />
            <h2>판매 준비도</h2>
          </div>
          <span class="text-lg">{{ readinessScore }}점</span>
        </div>
        <div class="h-2 rounded-full bg-gray-100 overflow-hidden">
          <div class="h-full bg-green-500" :style="{ width: `${readinessScore}%` }"></div>
        </div>
        <div class="space-y-2">
          <div v-for="item in readinessItems" :key="item.label" class="flex items-center justify-between gap-3 text-sm">
            <span class="flex items-center gap-2 min-w-0">
              <CheckCircle2 v-if="item.ok" :size="16" class="text-green-600 shrink-0" />
              <CircleAlert v-else :size="16" class="text-amber-600 shrink-0" />
              <span class="truncate">{{ item.label }}</span>
            </span>
            <span :class="item.ok ? 'text-green-700' : 'text-amber-700'">{{ item.ok ? '완료' : '보강' }}</span>
          </div>
        </div>
      </section>

      <section class="bg-white rounded-lg border p-4 space-y-3">
        <div class="flex items-center gap-2">
          <Sparkles :size="18" />
          <h2>다음 액션</h2>
        </div>
        <div class="space-y-2">
          <p v-for="tip in actionTips" :key="tip" class="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{{ tip }}</p>
        </div>
      </section>
    </main>

    <footer v-if="listing" class="fixed inset-x-0 bottom-0 bg-white border-t p-4">
      <div class="mx-auto max-w-xl grid grid-cols-2 gap-3">
        <button class="py-3 rounded-lg border flex items-center justify-center gap-2" @click="editListing">
          <Pencil :size="18" />
          수정
        </button>
        <button class="py-3 rounded-lg bg-blue-600 text-white flex items-center justify-center gap-2" @click="openListing">
          <Eye :size="18" />
          상품 보기
        </button>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  ArrowLeft,
  BadgeDollarSign,
  BarChart3,
  CheckCircle2,
  CircleAlert,
  Eye,
  ExternalLink,
  Gauge,
  LoaderCircle,
  Pencil,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from 'lucide-vue-next';
import VinylCover from '@/shared/components/VinylCover.vue';
import { albums, type Album, type MarketAdviceResponse } from '@/shared/models/market';
import { useAppStore } from '@/shared/stores/appStore';
import { fetchMarketAdvice, fetchPriceRecommendation, type PriceRecommendation } from '@/features/seller/services/pricing';

const LAST_REPORT_LISTING_ID_KEY = 'vinyl-check-last-sell-report-listing-id';

type Risk = 'low' | 'medium' | 'high' | string;

interface AudioReport {
  audioGrade?: string;
  audioScore?: number;
  analysisConfidence?: number;
  clickCount?: number;
  dynamicRangeDb?: number;
  adjustedNoiseFloorDb?: number;
  clippingRisk?: Risk;
  channelImbalanceDb?: number;
  source?: string;
}

interface JacketReport {
  jacketGrade?: string;
  jacketScore?: number;
  edgeWearRisk?: Risk;
  cornerWearRisk?: Risk;
  colorFadeRisk?: Risk;
  confidence?: number;
}

interface SurfaceReport {
  surfaceScore?: number;
  confidence?: number;
  scratchCount?: number;
  playbackImpact?: string;
  source?: string;
}

interface AnalysisReport {
  pressing?: string;
  jacket?: JacketReport;
  recordSurface?: SurfaceReport;
  audio?: AudioReport;
}

const router = useRouter();
const route = useRoute();
const store = useAppStore();
const loading = ref(false);
const pricingLoading = ref(false);
const pricingError = ref('');
const priceRecommendation = ref<PriceRecommendation | null>(null);
const marketAdvice = ref<MarketAdviceResponse | null>(null);
const marketAdviceLoading = ref(false);
const marketAdviceError = ref('');
const savedListingId = ref(localStorage.getItem(LAST_REPORT_LISTING_ID_KEY) || '');

const routeListingId = computed(() => String(route.query.id || route.query.listingId || savedListingId.value || ''));
const ownListings = computed(() => store.listings.filter(album => album.ownedByMe || album.seller.id === store.user.id));
const listing = computed(() => {
  const id = routeListingId.value;
  return store.listings.find(album => String(album.id) === id)
    || (id ? albums.find(album => String(album.id) === id) : undefined)
    || ownListings.value.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
    || null;
});
const marketEstimate = computed(() => marketAdvice.value?.estimate || listing.value?.market || null);

const analysis = computed<AnalysisReport>(() => (listing.value?.analysisReport || {}) as AnalysisReport);
const audio = computed(() => analysis.value.audio || {
  audioGrade: listing.value?.audioGrade,
  audioScore: listing.value?.audioScore,
});
const jacket = computed(() => analysis.value.jacket || {
  jacketGrade: listing.value?.jacketGrade,
  jacketScore: listing.value?.jacketScore,
});
const surface = computed(() => analysis.value.recordSurface || {});

const comparableListings = computed(() => {
  if (!listing.value) return [] as Album[];
  const seen = new Set<string>();
  return [...store.listings, ...albums]
    .filter(album => {
      if (!album.price || album.id === listing.value!.id || seen.has(album.id)) return false;
      seen.add(album.id);
      return comparableWeight(album, listing.value!) > 0;
    })
    .sort((a, b) => comparableWeight(b, listing.value!) - comparableWeight(a, listing.value!))
    .slice(0, 8);
});

const marketPrices = computed(() => {
  if (!listing.value) return [] as number[];
  const peerPrices = comparableListings.value.map(album => album.price).filter(Boolean);
  if (peerPrices.length >= 2) return peerPrices;
  const range = listing.value.priceRange;
  return [range?.min || Math.round(listing.value.price * 0.9), range?.max || Math.round(listing.value.price * 1.12)].filter(Boolean);
});

const localMarketAverage = computed(() => {
  if (!listing.value) return 0;
  const prices = marketPrices.value.length ? marketPrices.value : [listing.value.price];
  return roundPrice(prices.reduce((sum, price) => sum + price, 0) / prices.length);
});

const localMarketRange = computed(() => {
  if (!listing.value) return { min: 0, max: 0 };
  const prices = [...marketPrices.value, listing.value.price].filter(Boolean);
  const min = Math.min(...prices, listing.value.price);
  const max = Math.max(...prices, listing.value.price);
  return {
    min: roundPrice(Math.min(min, listing.value.priceRange?.min || min)),
    max: roundPrice(Math.max(max, listing.value.priceRange?.max || max)),
  };
});

const marketAverage = computed(() => {
  if (marketEstimate.value?.basePrice) return marketEstimate.value.basePrice;
  const external = priceRecommendation.value;
  if (external?.source === 'discogs') {
    return roundPrice(external.discogs?.suggestedPrice || external.recommended_price || external.discogs?.marketplaceLow || localMarketAverage.value);
  }
  return localMarketAverage.value;
});

const marketRange = computed(() => {
  if (marketEstimate.value) return { min: marketEstimate.value.minPrice, max: marketEstimate.value.maxPrice };
  const external = priceRecommendation.value?.price_range;
  if (external?.min && external?.max) return external;
  return localMarketRange.value;
});

const localRecommendedPrice = computed(() => {
  if (!listing.value) return 0;
  const audioScore = numberOr(audio.value.audioScore, listing.value.audioScore || 78);
  const jacketScore = numberOr(jacket.value.jacketScore, listing.value.jacketScore || 76);
  const surfaceScore = numberOr(surface.value.surfaceScore, surface.value.confidence || 76);
  const qualityBoost = clamp((audioScore - 80) * 0.004, -0.08, 0.08)
    + clamp((jacketScore - 78) * 0.003, -0.05, 0.04)
    + clamp((surfaceScore - 78) * 0.003, -0.05, 0.04);
  const rarityBoost = (listing.value.isRare ? 0.08 : 0) + (listing.value.isFirstPress ? 0.06 : 0);
  const rawPrice = localMarketAverage.value * (1 + qualityBoost + rarityBoost);
  return roundPrice(clamp(rawPrice, localMarketRange.value.min * 0.9, localMarketRange.value.max * 1.05));
});

const recommendedPrice = computed(() => {
  if (marketEstimate.value?.recommendedPrice) return marketEstimate.value.recommendedPrice;
  return priceRecommendation.value?.recommended_price || localRecommendedPrice.value;
});

const discogsReleaseUrl = computed(() => priceRecommendation.value?.discogs?.releaseUrl || (priceRecommendation.value?.release_id ? `https://www.discogs.com/release/${priceRecommendation.value.release_id}` : ''));
const conditionPriceRows = computed(() => (priceRecommendation.value?.discogs?.conditionPrices || []).slice(0, 5));
const discogsSuggestedPriceText = computed(() => {
  const price = priceRecommendation.value?.discogs?.suggestedPrice;
  if (price) return formatWon(price);
  if (pricingLoading.value) return '확인 중';
  return priceRecommendation.value?.discogs?.salesHistoryAvailable ? '조건 확인 필요' : '인증 필요';
});
const discogsLowestPriceText = computed(() => {
  const price = priceRecommendation.value?.discogs?.marketplaceLow;
  return price ? formatWon(price) : pricingLoading.value ? '확인 중' : '없음';
});
const discogsForSaleText = computed(() => {
  const count = priceRecommendation.value?.discogs?.numForSale;
  return typeof count === 'number' ? `${count}개` : pricingLoading.value ? '확인 중' : '-';
});
const discogsPriceSubtitle = computed(() => {
  if (pricingLoading.value) return 'Discogs 거래 이력과 현재 판매가를 조회 중';
  const external = priceRecommendation.value;
  if (!external) return '조회 전';
  if (external.discogs?.salesHistoryAvailable) return `판매 이력 기반 · ${external.release_title || external.discogs.conditionUsed || 'Discogs release'}`;
  if (external.source === 'discogs') return `현재 판매 최저가 기반 · ${external.release_title || 'Discogs release'}`;
  return '로컬 비교가 기반';
});
const discogsNotice = computed(() => {
  const discogs = priceRecommendation.value?.discogs;
  if (!priceRecommendation.value) return 'Discogs 가격 확인을 아직 실행하지 않았습니다.';
  if (discogs?.salesHistoryAvailable) return '';
  if (discogs?.priceSuggestionError) return `${discogs.priceSuggestionError} 현재 판매 최저가와 로컬 비교가를 함께 사용했습니다.`;
  if (priceRecommendation.value.source !== 'discogs') return 'Discogs 가격 데이터를 가져오지 못해 앱 내 비교 매물 기준으로 계산했습니다.';
  return 'Discogs 판매 이력 가격표가 없어 현재 판매 최저가를 우선 반영했습니다.';
});
const priceBasisText = computed(() => {
  if (priceRecommendation.value?.discogs?.salesHistoryAvailable) return 'Discogs 판매 이력 기반 가격표와 등록 품질 점수를 함께 반영했습니다.';
  if (priceRecommendation.value?.source === 'discogs') return 'Discogs 현재 판매 최저가와 앱 내 비교 매물을 함께 반영했습니다.';
  return `${comparableListings.value.length}개 비교 매물과 등록 품질 점수를 함께 반영했습니다.`;
});

const priceVerdict = computed(() => {
  if (!listing.value || !recommendedPrice.value) {
    return { label: '확인 필요', tone: '대기', className: 'bg-gray-100 text-gray-700', description: '가격 비교 기준을 만들 수 없습니다.' };
  }
  const ratio = listing.value.price / recommendedPrice.value;
  if (ratio > 1.08) {
    return {
      label: '협상 여지 큼',
      tone: '높음',
      className: 'bg-amber-100 text-amber-800',
      description: `${formatWon(recommendedPrice.value)} 근처로 낮추면 문의 전환 가능성이 더 높습니다.`,
    };
  }
  if (ratio < 0.94) {
    if (readinessScore.value < 60) {
      return {
        label: '가격은 매력적',
        tone: '보강 필요',
        className: 'bg-green-100 text-green-800',
        description: '가격 경쟁력은 좋지만 사진과 분석 항목을 보강해야 문의 전환이 빨라집니다.',
      };
    }
    return {
      label: '빠른 거래가 예상',
      tone: '낮음',
      className: 'bg-green-100 text-green-800',
      description: '추천가보다 낮게 등록되어 저장과 채팅 전환에 유리합니다.',
    };
  }
  return {
    label: '적정가',
    tone: '균형',
    className: 'bg-blue-100 text-blue-800',
    description: '현재 가격은 감정 지표와 비교 시세 기준에서 무리 없는 범위입니다.',
  };
});

const priceMarker = computed(() => {
  if (!listing.value || marketRange.value.max <= marketRange.value.min) return 50;
  return clamp(((listing.value.price - marketRange.value.min) / (marketRange.value.max - marketRange.value.min)) * 100, 0, 100);
});

const rangeBand = computed(() => {
  if (!recommendedPrice.value || marketRange.value.max <= marketRange.value.min) return { left: 35, width: 30 };
  const low = recommendedPrice.value * 0.94;
  const high = recommendedPrice.value * 1.06;
  const left = clamp(((low - marketRange.value.min) / (marketRange.value.max - marketRange.value.min)) * 100, 0, 100);
  const right = clamp(((high - marketRange.value.min) / (marketRange.value.max - marketRange.value.min)) * 100, 0, 100);
  return { left, width: Math.max(4, right - left) };
});

const priceTrend = computed(() => {
  const labels = ['1월', '2월', '3월', '4월', '5월', '이번달'];
  const base = marketAverage.value || listing.value?.price || 100000;
  const factors = [0.92, 0.96, 1.01, 0.98, 1.03, listing.value?.price ? listing.value.price / base : 1];
  const values = labels.map((label, index) => ({ label, price: roundPrice(base * factors[index]) }));
  const max = Math.max(...values.map(item => item.price), 1);
  return values.map(item => ({ ...item, height: clamp((item.price / max) * 100, 16, 100) }));
});

const readinessItems = computed(() => {
  if (!listing.value) return [];
  return [
    { label: '대표 이미지 등록', ok: Boolean(listing.value.images[0]) },
    { label: '자켓 상태 분석', ok: Boolean(jacket.value.jacketScore || jacket.value.jacketGrade) },
    { label: '판면 이미지 또는 영상', ok: Boolean(listing.value.recordImageDataUrl || listing.value.recordVideoDataUrl || surface.value.surfaceScore) },
    { label: '음질 샘플 분석', ok: Boolean(audio.value.audioScore || listing.value.audioScore) },
    { label: '판본/카탈로그 정보', ok: Boolean(listing.value.catalogNumber || analysis.value.pressing) },
    { label: '상세 설명', ok: (listing.value.description || '').trim().length >= 80 },
  ];
});

const readinessScore = computed(() => {
  const items = readinessItems.value;
  if (!items.length) return 0;
  return Math.round((items.filter(item => item.ok).length / items.length) * 100);
});

const trustScore = computed(() => {
  const audioScore = numberOr(audio.value.analysisConfidence, audio.value.audioScore || listing.value?.audioScore || 0);
  const jacketScore = numberOr(jacket.value.confidence, jacket.value.jacketScore || 0);
  const surfaceScore = numberOr(surface.value.confidence, surface.value.surfaceScore || 0);
  const base = [audioScore, jacketScore, surfaceScore].filter(score => score > 0);
  const analysisScore = base.length ? base.reduce((sum, score) => sum + score, 0) / base.length : 55;
  return Math.round(clamp(analysisScore * 0.7 + readinessScore.value * 0.3, 0, 100));
});

const expectedPace = computed(() => {
  if (!listing.value || !recommendedPrice.value) return '확인 필요';
  const ratio = listing.value.price / recommendedPrice.value;
  if (ratio <= 0.96 && readinessScore.value >= 80) return '빠름';
  if (ratio <= 0.96 && readinessScore.value < 60) return '보강 후 빠름';
  if (ratio <= 1.06 && readinessScore.value >= 65) return '보통';
  return '느림';
});

const actionTips = computed(() => {
  if (!listing.value) return [];
  const tips: string[] = [];
  if (listing.value.price > recommendedPrice.value * 1.08) tips.push(`문의 전환을 높이려면 ${formatWon(recommendedPrice.value)} 안팎으로 조정하는 편이 좋습니다.`);
  if (!audio.value.audioScore) tips.push('음질 샘플을 추가하면 감정 인증 영역이 채워지고 구매자 신뢰가 올라갑니다.');
  if (!jacket.value.jacketScore && !jacket.value.jacketGrade) tips.push('자켓 사진을 다시 등록하면 테두리/모서리 상태가 리포트에 반영됩니다.');
  if (!surface.value.surfaceScore && !listing.value.recordImageDataUrl && !listing.value.recordVideoDataUrl) tips.push('판면 이미지나 반사 영상이 있으면 스크래치 후보와 재생 영향 설명이 강화됩니다.');
  if (!listing.value.catalogNumber) tips.push('카탈로그 번호를 입력하면 같은 판본 기준으로 더 정확한 시세 비교가 가능합니다.');
  if ((listing.value.description || '').trim().length < 80) tips.push('설명에 재생 확인 구간과 자켓 특이사항을 한 줄씩 보강해 주세요.');
  return tips.length ? tips : ['현재 등록 품질이 좋습니다. 상품 상세에서 노출 상태를 확인해 보세요.'];
});

const audioGradeText = computed(() => audio.value.audioGrade || listing.value?.audioGrade || '미분석');
const audioDetailText = computed(() => {
  const score = numberOr(audio.value.audioScore, listing.value?.audioScore || 0);
  if (!score) return '샘플 필요';
  const parts = [`${score}점`];
  if (typeof audio.value.clickCount === 'number') parts.push(`클릭 ${audio.value.clickCount}개`);
  if (typeof audio.value.dynamicRangeDb === 'number') parts.push(`다이내믹 ${audio.value.dynamicRangeDb.toFixed(1)}dB`);
  return parts.join(' · ');
});
const jacketGradeText = computed(() => jacket.value.jacketGrade || listing.value?.jacketGrade || '미분석');
const jacketDetailText = computed(() => {
  const score = numberOr(jacket.value.jacketScore, listing.value?.jacketScore || 0);
  if (!score) return '자켓 사진 필요';
  return `${score}점 · 모서리 ${riskLabel(jacket.value.cornerWearRisk || 'low')}`;
});
const surfaceScoreText = computed(() => {
  const score = numberOr(surface.value.surfaceScore, surface.value.confidence || 0);
  return score ? `${score}점` : '미분석';
});
const surfaceDetailText = computed(() => {
  if (!surface.value.surfaceScore && !surface.value.confidence) return '판면 촬영 필요';
  const scratch = typeof surface.value.scratchCount === 'number' ? `스크래치 후보 ${surface.value.scratchCount}개` : '스크래치 후보 확인';
  return `${scratch} · ${surface.value.playbackImpact || '재생 영향 확인'}`;
});
const pressingText = computed(() => analysis.value.pressing || (listing.value?.isFirstPress ? '초반 추정' : '일반반'));

function comparableWeight(candidate: Album, target: Album) {
  let score = 0;
  if (candidate.catalogNumber && target.catalogNumber && candidate.catalogNumber.toLowerCase() === target.catalogNumber.toLowerCase()) score += 5;
  if (candidate.artist && target.artist && candidate.artist.toLowerCase() === target.artist.toLowerCase()) score += 2;
  if (candidate.genre && target.genre && candidate.genre === target.genre) score += 1;
  if (candidate.isFirstPress === target.isFirstPress) score += 0.6;
  if (candidate.isRare === target.isRare) score += 0.4;
  if (candidate.audioGrade === target.audioGrade) score += 0.3;
  return score;
}

function numberOr(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundPrice(value: number) {
  return Math.round(value / 1000) * 1000;
}

function formatWon(value: number) {
  return `${Math.max(0, Math.round(value)).toLocaleString()}원`;
}

function riskLabel(risk: Risk) {
  if (risk === 'high') return '높음';
  if (risk === 'medium') return '중간';
  if (risk === 'low') return '낮음';
  return String(risk || '확인');
}

function openListing() {
  if (!listing.value) return;
  router.push({ path: `/app/album/${listing.value.id}`, query: { mine: 'true' } });
}

function editListing() {
  if (!listing.value) return;
  router.push(`/sell/${listing.value.id}/edit`);
}

async function loadDiscogsPricing() {
  if (!listing.value || pricingLoading.value) return;
  pricingLoading.value = true;
  pricingError.value = '';
  try {
    const result = await fetchPriceRecommendation({
      catalogNumber: listing.value.catalogNumber,
      title: listing.value.title,
      artist: listing.value.artist,
      releaseId: typeof priceRecommendation.value?.release_id === 'number' ? priceRecommendation.value.release_id : undefined,
      surfaceScore: numberOr(surface.value.surfaceScore, surface.value.confidence || 0) || undefined,
      audioScore: numberOr(audio.value.audioScore, listing.value.audioScore || 0) || undefined,
      jacketScore: numberOr(jacket.value.jacketScore, listing.value.jacketScore || 0) || undefined,
      scratchRisk: surface.value.scratchCount && surface.value.scratchCount > 4 ? 'medium' : 'low',
      playbackRisk: audio.value.clippingRisk === 'high' ? 'high' : 'low',
      jacketRisk: jacket.value.edgeWearRisk || jacket.value.cornerWearRisk,
    });
    priceRecommendation.value = result;
  } catch (error) {
    pricingError.value = error instanceof Error ? error.message : 'Discogs 가격 확인에 실패했습니다.';
  } finally {
    pricingLoading.value = false;
  }
}

async function loadMarketAdvice() {
  if (!listing.value || marketAdviceLoading.value) return;
  marketAdviceLoading.value = true;
  marketAdviceError.value = '';
  try {
    marketAdvice.value = await fetchMarketAdvice(listing.value.id);
  } catch (error) {
    marketAdviceError.value = error instanceof Error ? error.message : '시세 조언을 불러오지 못했습니다.';
  } finally {
    marketAdviceLoading.value = false;
  }
}

onMounted(async () => {
  const id = routeListingId.value;
  if (id) {
    savedListingId.value = id;
    localStorage.setItem(LAST_REPORT_LISTING_ID_KEY, id);
  }
  if (!store.listings.length || (id && !store.listings.some(album => album.id === id))) {
    loading.value = true;
    await Promise.race([
      store.loadListingsFromServer(),
      new Promise(resolve => window.setTimeout(resolve, 3500)),
    ]);
    loading.value = false;
  }
  await loadDiscogsPricing();
  await loadMarketAdvice();
});
</script>
