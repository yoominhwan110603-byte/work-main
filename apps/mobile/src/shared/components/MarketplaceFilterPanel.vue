<template>
  <div class="space-y-5">
    <div class="border-b border-[#eadfcd] pb-3 sm:hidden">
      <div class="mx-auto mb-3 h-1 w-10 rounded-full bg-[#d8c7ad]"></div>
      <div class="flex items-center justify-between">
        <p class="text-base font-semibold text-gray-950 dark:text-slate-100">검색 필터</p>
        <button type="button" class="rounded-lg px-3 py-2 text-xs font-semibold text-gray-700 dark:text-slate-200" @click="emit('close')">닫기</button>
      </div>
    </div>

    <section class="filter-section">
      <p class="filter-section-title">기본 조건</p>
      <div class="mt-4 space-y-4">
        <div class="filter-field">
          <span>장르</span>
          <div class="genre-chip-grid">
            <button
              v-for="genre in visibleGenres"
              :key="genre"
              type="button"
              :class="['genre-chip', filters.genres.includes(genre) ? 'is-active' : '']"
              @click="toggleGenre(genre)"
            >
              {{ genre }}
            </button>
          </div>
          <button v-if="genres.length > genrePreviewCount" type="button" class="genre-expand-button" @click="showAllGenres = !showAllGenres">
            {{ showAllGenres ? '장르 접기' : `장르 더보기 ${hiddenGenreCount}개` }}
          </button>
        </div>

        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label class="filter-range">
            <span>가격대</span>
            <div class="range-value-row">
              <strong>{{ priceFilterLabel(maxPrice) }}</strong>
              <em>1만원 간격</em>
            </div>
            <input v-model.number="maxPrice" type="range" min="0" :max="MARKET_FILTER_MAX_PRICE" step="10000" />
            <div class="range-boundary"><span>0원</span><span>{{ MARKET_FILTER_MAX_PRICE.toLocaleString() }}원</span></div>
          </label>

          <div class="filter-range">
            <div class="range-title-row">
              <span>음반 등급</span>
              <button type="button" class="grade-help-button" aria-label="등급 도움말" @click="showGradeHelp = !showGradeHelp">
                <Info :size="14" />
              </button>
            </div>
            <div class="range-value-row">
              <strong>{{ gradeFilterLabel(minGradeScore) }}</strong>
              <em>1등급 간격</em>
            </div>
            <div v-if="showGradeHelp" class="grade-help-panel">
              <p v-for="item in gradeHelpItems" :key="item.grade" class="grade-help-row">
                <b>{{ item.grade }}</b>
                <span>{{ item.description }}</span>
              </p>
            </div>
            <input v-model.number="minGradeScore" type="range" min="0" max="7" step="1" aria-label="음반 등급" />
            <div class="range-boundary"><span>전체</span><span>M</span></div>
          </div>

          <label class="filter-range">
            <span>판매자 평점</span>
            <div class="range-value-row">
              <strong>{{ ratingFilterLabel(minSellerRating) }}</strong>
              <em>0.5점 간격</em>
            </div>
            <input v-model.number="minSellerRating" type="range" min="0" max="5" step="0.5" />
            <div class="range-boundary"><span>0점</span><span>5점</span></div>
          </label>

          <label class="filter-range">
            <span>발매년도</span>
            <div class="range-value-row">
              <strong>{{ yearFilterLabel(minYear) }}</strong>
              <em>10년 간격</em>
            </div>
            <input v-model.number="minYear" type="range" :min="MARKET_FILTER_MIN_YEAR" :max="MARKET_FILTER_MAX_YEAR" step="10" />
            <div class="range-boundary"><span>{{ MARKET_FILTER_MIN_YEAR }}년</span><span>{{ MARKET_FILTER_MAX_YEAR }}년</span></div>
          </label>
        </div>
      </div>
    </section>

    <section class="filter-section">
      <div class="flex items-center justify-between gap-3">
        <p class="filter-section-title">거래 지역</p>
        <button
          type="button"
          class="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-700 disabled:text-gray-400 dark:border-blue-900 dark:bg-slate-950 dark:text-blue-300"
          :disabled="isLocatingCurrentPosition"
          @click="useCurrentLocation"
        >
          <LocateFixed :size="15" />
          {{ isLocatingCurrentPosition ? '위치 확인 중' : '현재 위치' }}
        </button>
      </div>

      <div
        class="relative mt-3 h-48 touch-none overflow-hidden rounded-lg border border-[#e2d4bf] bg-[#f3eadb] dark:border-slate-800 dark:bg-slate-950"
        @pointerdown="startFallbackMapDrag"
        @pointermove="moveFallbackMapDrag"
        @pointerup="endFallbackMapDrag"
        @pointercancel="endFallbackMapDrag"
        @pointerleave="endFallbackMapDrag"
      >
        <div ref="mapContainer" class="absolute inset-0"></div>
        <div v-if="mapFallbackHtml" class="absolute inset-0" v-html="mapFallbackHtml"></div>
        <button
          v-if="mapPoint && mapFallbackHtml"
          type="button"
          class="absolute right-2 top-2 z-10 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white shadow-sm active:bg-blue-700"
          @pointerdown.stop
          @click.stop="chooseFallbackLocation"
        >
          이 위치 선택
        </button>
        <div v-if="mapMessage" class="absolute inset-x-2 bottom-2 z-10 flex items-center gap-2 rounded-lg bg-white/95 px-3 py-2 text-xs font-semibold text-gray-800 shadow-sm dark:bg-slate-950/95 dark:text-slate-200">
          <MapPin :size="14" class="shrink-0 text-blue-600" />
          <span>{{ mapMessage }}</span>
        </div>
      </div>

      <p class="mt-3 text-xs font-semibold text-gray-700 dark:text-slate-300">핀을 찍은 뒤 아래 지역명 중 원하는 범위를 누르세요.</p>
      <div v-if="hasLocation" class="location-choice-list mt-3" role="radiogroup" aria-label="거래 지역 범위">
        <button
          v-for="option in availableLocationOptions"
          :key="option.value"
          type="button"
          role="radio"
          :aria-checked="locationScope === option.value"
          :class="['location-choice-button', { 'is-active': locationScope === option.value }]"
          @click="locationScope = option.value"
        >
          <span>{{ option.label }}</span>
          <strong>{{ option.region }}</strong>
          <Check v-if="locationScope === option.value" :size="17" />
        </button>
      </div>
      <p v-if="hasLocation" class="mt-2 text-xs font-semibold text-gray-700 dark:text-slate-300">{{ locationFilterPreview }}</p>
      <p v-else class="location-placeholder">지도에서 위치를 선택하면 실제 행정구역명이 여기에 표시됩니다.</p>
    </section>

    <div class="sticky bottom-0 -mx-4 grid grid-cols-2 gap-3 border-t border-[#eadfcd] bg-[#fff8ed] px-4 pb-1 pt-4 dark:border-slate-800 dark:bg-slate-900 sm:static sm:mx-0 sm:border-t-0 sm:p-0">
      <button type="button" class="w-full rounded-lg border border-[#d9c9af] bg-[#fffdf7] py-3 font-semibold text-gray-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200" @click="emit('reset')">초기화</button>
      <button type="button" class="w-full rounded-lg bg-blue-600 py-3 font-semibold text-white" @click="emit('apply')">적용</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { Check, Info, LocateFixed, MapPin } from 'lucide-vue-next';
import type { LocationFilterScope } from '@/shared/services/locationFilter';
import { locationScopeLabel, locationScopeRegion, parseLocationParts } from '@/shared/services/locationFilter';
import {
  MARKET_FILTER_MAX_PRICE,
  MARKET_FILTER_MAX_YEAR,
  MARKET_FILTER_MIN_YEAR,
  type MarketplaceFilters,
} from '@/shared/services/marketFilters';
import { useLocationMapPicker } from '@/shared/services/locationMapPicker';

const props = withDefaults(defineProps<{
  filters: MarketplaceFilters;
  genres: string[];
  defaultLocation?: string;
}>(), {
  defaultLocation: '',
});

const emit = defineEmits<{
  'update:filters': [value: MarketplaceFilters];
  apply: [];
  reset: [];
  close: [];
}>();

const genrePreviewCount = 6;
const showAllGenres = ref(false);
const showGradeHelp = ref(false);
const grades = ['M', 'NM', 'EX', 'VG+', 'VG', 'G', 'P'];
const gradeHelpItems = [
  { grade: 'M', description: '미개봉에 가깝고 사용 흔적이 거의 없음' },
  { grade: 'NM', description: '새것에 가까운 최상급 상태' },
  { grade: 'EX', description: '가벼운 사용감만 있는 상급 상태' },
  { grade: 'VG+', description: '잔기스는 있지만 감상에 무리 적음' },
  { grade: 'VG', description: '사용감과 잡음이 어느 정도 있음' },
  { grade: 'G', description: '잡음과 흠집이 많아 상태 확인 필요' },
  { grade: 'P', description: '손상이 커서 재생 전 확인이 필요함' },
];
const locationScopeOptions: Array<{ value: LocationFilterScope; label: string }> = [
  { value: 'city', label: '시/도' },
  { value: 'district', label: '시/군/구' },
  { value: 'neighborhood', label: '동/읍/면' },
];

const updateFilters = (updates: Partial<MarketplaceFilters>) => {
  emit('update:filters', {
    ...props.filters,
    ...updates,
    genres: [...(updates.genres || props.filters.genres)],
  });
};

const numericFilter = (key: 'maxPrice' | 'minGradeScore' | 'minSellerRating' | 'minYear') => computed<number>({
  get: () => props.filters[key],
  set: value => updateFilters({ [key]: Number(value) }),
});
const maxPrice = numericFilter('maxPrice');
const minGradeScore = numericFilter('minGradeScore');
const minSellerRating = numericFilter('minSellerRating');
const minYear = numericFilter('minYear');
const location = computed({
  get: () => props.filters.location,
  set: value => updateFilters({ location: value }),
});
const locationScope = computed({
  get: () => props.filters.locationScope,
  set: value => updateFilters({ locationScope: value }),
});

const visibleGenres = computed(() => {
  if (showAllGenres.value) return props.genres;
  const preview = props.genres.slice(0, genrePreviewCount);
  return [...new Set([...preview, ...props.filters.genres.filter(genre => !preview.includes(genre))])];
});
const hiddenGenreCount = computed(() => Math.max(0, props.genres.length - genrePreviewCount));
const toggleGenre = (genre: string) => updateFilters({
  genres: props.filters.genres.includes(genre)
    ? props.filters.genres.filter(item => item !== genre)
    : [...props.filters.genres, genre],
});

const locationParts = computed(() => parseLocationParts(props.filters.location));
const hasLocation = computed(() => Boolean(props.filters.location.trim() && locationParts.value.city));
const locationScopeAvailable = (scope: LocationFilterScope) => {
  const parts = locationParts.value;
  if (scope === 'city') return Boolean(parts.city);
  if (scope === 'district') return Boolean(parts.city && parts.district);
  if (scope === 'neighborhood') return Boolean(parts.city && parts.district && parts.neighborhood);
  return false;
};
const availableLocationOptions = computed(() => locationScopeOptions
  .filter(option => locationScopeAvailable(option.value))
  .map(option => ({ ...option, region: locationScopeRegion(option.value, locationParts.value) })));
const normalizeLocationScope = () => {
  if (!hasLocation.value || availableLocationOptions.value.some(option => option.value === props.filters.locationScope)) return;
  updateFilters({ locationScope: locationParts.value.district ? 'district' : 'city' });
};
const locationFilterPreview = computed(() => {
  const region = locationScopeRegion(props.filters.locationScope, locationParts.value);
  return region ? `선택됨: ${region} · ${locationScopeLabel(props.filters.locationScope)} 매물` : '';
});

const priceFilterLabel = (price: number) => price >= MARKET_FILTER_MAX_PRICE ? '전체' : `${price.toLocaleString()}원 이하`;
const gradeFilterLabel = (score: number) => score <= 0 ? '전체' : `${grades[Math.max(0, grades.length - score)] || 'P'} 이상`;
const ratingFilterLabel = (rating: number) => rating <= 0 ? '전체' : `${rating.toFixed(1)} 이상`;
const yearFilterLabel = (year: number) => year <= MARKET_FILTER_MIN_YEAR ? '전체' : `${year}년 이후`;

const {
  mapContainer,
  mapMessage,
  mapPoint,
  mapFallbackHtml,
  isLocatingCurrentPosition,
  useCurrentLocation,
  chooseFallbackLocation,
  scheduleMap,
  startFallbackMapDrag,
  moveFallbackMapDrag,
  endFallbackMapDrag,
  cleanupMap,
} = useLocationMapPicker(location, {
  fallbackQuery: props.defaultLocation || '서울 시청',
});

watch(() => props.filters.location, () => {
  normalizeLocationScope();
  scheduleMap();
});

onMounted(() => {
  normalizeLocationScope();
  scheduleMap(0);
});

onBeforeUnmount(cleanupMap);
</script>

<style scoped>
.filter-section {
  border: 1px solid #eadfcd;
  border-radius: 0.7rem;
  background: #fffdf7;
  padding: 1rem;
}

.filter-section-title {
  color: #111827;
  font-size: 0.9rem;
  font-weight: 750;
}

.filter-field {
  display: grid;
  gap: 0.45rem;
  min-width: 0;
}

.filter-field > span,
.filter-range > span,
.range-title-row > span {
  color: #374151;
  font-size: 0.72rem;
  font-weight: 750;
}

.genre-chip-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.genre-chip {
  border: 1px solid #e2d4bf;
  border-radius: 999px;
  background: #fffaf0;
  padding: 0.45rem 0.75rem;
  color: #374151;
  font-size: 0.8rem;
  font-weight: 650;
}

.genre-chip.is-active {
  border-color: #2563eb;
  background: #dbeafe;
  color: #1d4ed8;
}

.genre-expand-button {
  width: 100%;
  border: 1px dashed #93c5fd;
  border-radius: 0.5rem;
  background: #eff6ff;
  padding: 0.55rem 0.75rem;
  color: #1d4ed8;
  font-size: 0.78rem;
  font-weight: 700;
}

.filter-range {
  display: grid;
  gap: 0.45rem;
  border: 1px solid #eadfcd;
  border-radius: 0.6rem;
  background: #fffaf0;
  padding: 0.75rem;
}

.range-title-row,
.range-value-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.range-value-row strong {
  min-width: 0;
  color: #111827;
  font-size: 0.92rem;
}

.range-value-row em {
  flex-shrink: 0;
  border-radius: 0.3rem;
  background: #eee2cf;
  padding: 0.2rem 0.4rem;
  color: #4b5563;
  font-size: 0.67rem;
  font-style: normal;
  font-weight: 700;
}

.filter-range input {
  width: 100%;
  accent-color: #2563eb;
}

.range-boundary {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
}

.range-boundary span {
  color: #374151;
  font-size: 0.68rem;
  font-weight: 700;
}

.grade-help-button {
  display: inline-flex;
  width: 1.75rem;
  height: 1.75rem;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border: 1px solid #93c5fd;
  border-radius: 999px;
  background: #eff6ff;
  color: #1d4ed8;
}

.grade-help-panel {
  display: grid;
  gap: 0.35rem;
  border: 1px solid #e2d4bf;
  border-radius: 0.5rem;
  background: #fff8ed;
  padding: 0.55rem;
}

.grade-help-row {
  display: grid;
  grid-template-columns: 2.25rem minmax(0, 1fr);
  gap: 0.45rem;
  align-items: start;
  margin: 0;
}

.grade-help-row b {
  color: #111827;
  font-size: 0.72rem;
}

.grade-help-row span {
  color: #374151;
  font-size: 0.72rem;
  font-weight: 600;
}

.location-choice-list {
  display: grid;
  gap: 0.5rem;
}

.location-choice-button {
  display: grid;
  grid-template-columns: 4.5rem minmax(0, 1fr) 1.1rem;
  min-width: 0;
  min-height: 3.25rem;
  align-items: center;
  gap: 0.65rem;
  border: 1px solid #e2d4bf;
  border-radius: 0.5rem;
  background: #fffaf0;
  padding: 0.65rem 0.75rem;
  text-align: left;
}

.location-choice-button span {
  color: #4b5563;
  font-size: 0.7rem;
  font-weight: 750;
}

.location-choice-button strong {
  min-width: 0;
  color: #111827;
  font-size: 0.82rem;
  line-height: 1.3;
  overflow-wrap: anywhere;
}

.location-choice-button.is-active {
  border-color: #2563eb;
  background: #dbeafe;
  color: #1d4ed8;
}

.location-choice-button.is-active span,
.location-choice-button.is-active strong {
  color: #1e40af;
}

.location-placeholder {
  margin-top: 0.75rem;
  border: 1px dashed #d9c9af;
  border-radius: 0.5rem;
  background: #fffaf0;
  padding: 0.75rem;
  color: #4b5563;
  font-size: 0.78rem;
  font-weight: 650;
}

:global(.dark) .filter-section,
:global(.dark) .filter-range,
:global(.dark) .genre-chip,
:global(.dark) .location-choice-button,
:global(.dark) .location-placeholder {
  border-color: #684831;
  background: #3a271b;
}

:global(.dark) .filter-section-title,
:global(.dark) .range-value-row strong,
:global(.dark) .grade-help-row b,
:global(.dark) .location-choice-button strong {
  color: #f8fafc;
}

:global(.dark) .filter-field > span,
:global(.dark) .filter-range > span,
:global(.dark) .range-title-row > span,
:global(.dark) .range-boundary span,
:global(.dark) .grade-help-row span,
:global(.dark) .location-choice-button span,
:global(.dark) .location-placeholder {
  color: #cbd5e1;
}

:global(.dark) .range-value-row em {
  background: #4b3425;
  color: #e2e8f0;
}

:global(.dark) .genre-chip.is-active,
:global(.dark) .location-choice-button.is-active {
  border-color: #93c5fd;
  background: #1e3a5f;
}

:global(.dark) .location-choice-button.is-active span,
:global(.dark) .location-choice-button.is-active strong {
  color: #eff6ff;
}
</style>
