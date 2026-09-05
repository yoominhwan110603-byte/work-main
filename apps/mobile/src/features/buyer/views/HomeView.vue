<template>
  <div class="size-full overflow-y-auto bg-gray-50 dark:bg-[#2a1a12]">
    <header class="sticky top-0 z-10 border-b bg-white px-4 py-4 dark:border-slate-800 dark:bg-slate-900">
      <div class="mb-4 flex items-center justify-between">
        <div class="flex items-start gap-2">
          <button type="button" class="p-2" aria-label="주파수 분석" @click="router.push('/frequency')">
            <AudioLines :size="22" />
          </button>
          <div>
            <h1 class="text-2xl font-semibold">Vinyl-Check</h1>
            <p class="text-sm text-gray-500">원하는 판본과 상태를 바로 비교하세요</p>
          </div>
        </div>
        <button class="relative p-2" aria-label="알림" @click="router.push('/app/notifications')">
          <Bell :size="24" />
          <span v-if="store.unreadNotificationCount > 0" class="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] leading-none text-white">
            {{ store.unreadNotificationCount > 99 ? '99+' : store.unreadNotificationCount }}
          </span>
        </button>
      </div>

      <div class="flex w-full items-center gap-3">
        <div class="flex min-h-12 min-w-0 flex-1 items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <Search :size="20" class="shrink-0 text-gray-400" />
          <input
            v-model="query"
            type="text"
            class="min-w-0 flex-1 bg-transparent outline-none"
            placeholder="앨범, 아티스트 검색"
            @keyup.enter="openSearchResults"
          />
          <button v-if="query" class="p-1" aria-label="검색어 지우기" @click="query = ''">
            <X :size="18" class="text-gray-400" />
          </button>
        </div>
        <button
          type="button"
          :class="['relative flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border bg-white shadow-sm dark:bg-slate-900', showHomeFilters || activeFilterCount > 0 ? 'border-blue-600 bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-200' : 'border-gray-200 text-gray-700 dark:border-slate-800 dark:text-slate-200']"
          aria-label="필터"
          @click="toggleFilterPanel"
        >
          <SlidersHorizontal :size="19" />
          <span v-if="activeFilterCount > 0" class="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] text-white">
            {{ activeFilterCount }}
          </span>
        </button>
        <div class="relative shrink-0">
          <button
            type="button"
            class="flex h-12 items-center justify-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-medium text-gray-700 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
            @click="toggleSortMenu"
          >
            <span>{{ currentSortLabel }}</span>
            <ChevronDown :size="14" :class="showSortMenu ? 'rotate-180' : ''" />
          </button>

          <div
            v-if="showSortMenu"
            class="absolute right-0 top-full z-30 mt-3 w-36 overflow-hidden rounded-lg border border-gray-200 bg-white text-sm shadow-lg dark:border-slate-800 dark:bg-slate-900"
          >
            <button
              v-for="option in sortOptions"
              :key="option.key"
              class="flex w-full items-center justify-between gap-2 border-b border-gray-100 px-3 py-3 text-left last:border-b-0 active:bg-gray-50"
              :class="homeSort === option.key ? 'font-semibold text-gray-950 dark:text-slate-100' : 'text-gray-600 dark:text-slate-300'"
              @click="selectHomeSort(option.key)"
            >
              <span>{{ option.label }}</span>
              <Check v-if="homeSort === option.key" :size="15" />
            </button>
          </div>
        </div>
      </div>
    </header>

    <button v-if="showHomeFilters" type="button" class="fixed inset-0 z-20 bg-black/10 sm:hidden" aria-label="필터 닫기" @click="showHomeFilters = false"></button>

    <div v-if="showHomeFilters" class="fixed inset-x-0 bottom-0 z-30 max-h-[84dvh] overflow-y-auto rounded-t-2xl border-t border-[#eadfcd] bg-[#fff8ed] px-4 py-4 shadow-xl dark:border-slate-800 dark:bg-slate-900 sm:static sm:z-auto sm:max-h-[62vh] sm:rounded-none sm:border-t-0 sm:border-b sm:shadow-none">
      <MarketplaceFilterPanel
        :filters="draftFilters"
        :genres="genres"
        :default-location="store.settings.trade.defaultLocation"
        @update:filters="updateDraftFilters"
        @close="showHomeFilters = false"
        @reset="resetAndApplyFilters"
        @apply="applyFilters"
      />
    </div>

    <main class="pb-6">
      <section v-if="query" class="space-y-4 px-4 py-5">
        <div class="flex items-end justify-between gap-3">
          <div>
            <h2 class="text-lg font-semibold">"{{ query }}" 검색 결과</h2>
            <p class="mt-1 text-sm text-gray-500">앨범을 고른 뒤 LP 특징별 매물을 확인하세요.</p>
          </div>
          <span class="shrink-0 text-xs text-gray-500">{{ searchedGroups.length }}개</span>
        </div>

        <AlbumGroupButton
          v-for="group in searchedGroups"
          :key="group.key"
          :group="group"
          action-label="LP 특징 선택"
          @open="openAlbumGroup(group)"
        />

        <div v-if="searchedGroups.length === 0" class="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500 dark:border-slate-800 dark:bg-slate-900">
          <p>검색 결과가 없습니다</p>
          <p class="mt-2 text-sm text-gray-400">앨범 이름이나 아티스트명을 바꿔보세요</p>
        </div>
      </section>

      <template v-else>
        <section class="space-y-5 px-4 py-6">
          <div class="flex items-end justify-between gap-3">
            <div>
              <h2 class="text-lg font-semibold">최근 올라온 LP</h2>
              <p class="mt-1 text-sm text-gray-500">{{ preferenceSummary }}</p>
            </div>
          </div>

          <AlbumGroupButton
            v-for="group in preferenceGroups"
            :key="group.key"
            :group="group"
            action-label="판본 보기"
            @open="openAlbumGroup(group)"
          />

          <div v-if="preferenceGroups.length === 0" class="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500 dark:border-slate-800 dark:bg-slate-900">
            표시할 판매 상품이 아직 없습니다.
          </div>
        </section>

      </template>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, onMounted, reactive, ref, type PropType } from 'vue';
import { useRouter } from 'vue-router';
import { AudioLines, Bell, Check, ChevronDown, ChevronRight, Search, SlidersHorizontal, X } from 'lucide-vue-next';
import { groupListingsByAlbum, matchesAlbumTitle, type AlbumProductGroup } from '@/features/buyer/services/pressingCatalog';
import { useAppStore } from '@/shared/stores/appStore';
import VinylCover from '@/shared/components/VinylCover.vue';
import MarketplaceFilterPanel from '@/shared/components/MarketplaceFilterPanel.vue';
import type { Album } from '@/shared/models/market';
import {
  MARKET_GRADE_SCORE,
  cloneMarketplaceFilters,
  countActiveMarketplaceFilters,
  createMarketplaceFilters,
  matchesMarketplaceFilters,
  type MarketplaceFilters,
} from '@/shared/services/marketFilters';

const store = useAppStore();
const router = useRouter();
const query = ref('');
type HomeSortKey = 'recent' | 'recommended' | 'price-low' | 'quality';

const showHomeFilters = ref(false);
const showSortMenu = ref(false);
const homeSort = ref<HomeSortKey>('recent');

const sortOptions: { key: HomeSortKey; label: string }[] = [
  { key: 'recent', label: '최신순' },
  { key: 'recommended', label: '추천순' },
  { key: 'price-low', label: '낮은 가격순' },
  { key: 'quality', label: '상태 좋은순' },
];
const defaultGenres = ['재즈', '록', '팝', '힙합', '클래식', 'R&B/소울', '일렉트로닉', '펑크', '블루스', '소울', '컨트리', '포크', '레게', '메탈', '월드뮤직', '가요', '사운드트랙'];
const draftFilters = reactive<MarketplaceFilters>(createMarketplaceFilters());
const appliedFilters = ref<MarketplaceFilters>(cloneMarketplaceFilters(draftFilters));

onMounted(() => {
  void store.loadListingsFromServer();
});

const normalize = (value: string) => value.trim().toLocaleLowerCase('ko-KR');
const normalizeTag = (tag: string | null | undefined) => (tag || '').trim().replace(/^#/, '').toLocaleLowerCase('ko-KR');
const hiddenFeatureKeywords = ['희귀', 'rare', '초반', '초판', 'first press', 'firstpress', 'original', 'lp', 'vinyl', 'album'];
const isHiddenFeatureTag = (tag: string) => {
  const normalized = normalizeTag(tag);
  return hiddenFeatureKeywords.some(keyword => normalized.includes(keyword));
};
const albumTags = (album: Album) => Array.isArray(album.tags) ? album.tags.filter(tag => tag && !isHiddenFeatureTag(tag)) : [];
const activeFilterCount = computed(() => countActiveMarketplaceFilters(appliedFilters.value));
const genres = computed(() => {
  const listingGenres = store.listings.map(album => album.genre).filter(Boolean);
  return [...new Set([...defaultGenres, ...listingGenres])];
});
const updateDraftFilters = (filters: MarketplaceFilters) => Object.assign(draftFilters, cloneMarketplaceFilters(filters));
const preferenceGenres = computed(() => (store.user.genres || []).map(normalize).filter(Boolean));
const currentSortLabel = computed(() => sortOptions.find(option => option.key === homeSort.value)?.label || '최신순');
const preferenceSummary = computed(() => preferenceGenres.value.length
  ? `선호 장르: ${store.user.genres.join(', ')}`
  : activeFilterCount.value
    ? `${activeFilterCount.value}개 필터 적용 중`
    : currentSortLabel.value);

const scoreAlbum = (album: Album) => {
  const genres = preferenceGenres.value;
  const tagText = albumTags(album).join(' ').toLocaleLowerCase('ko-KR');
  const genre = normalize(album.genre || '');
  const preferenceScore = genres.reduce((score, item) => {
    if (genre.includes(item)) return score + 45;
    if (tagText.includes(item)) return score + 28;
    return score;
  }, 0);
  return preferenceScore
    + Number(album.audioScore || 0) * 0.5
    + Math.min(12, Number(album.views || 0) / 8);
};

const groupScore = (group: AlbumProductGroup) => Math.max(...group.pressings.flatMap(pressing => pressing.listings).map(scoreAlbum), 0);
const groupLatestTime = (group: AlbumProductGroup) => Math.max(...group.pressings.flatMap(pressing => pressing.listings)
  .map(album => new Date(album.createdAt).getTime())
  .filter(Number.isFinite), 0);
const groupQualityScore = (group: AlbumProductGroup) => Math.max(...group.pressings.flatMap(pressing => pressing.listings)
  .map(album => (MARKET_GRADE_SCORE[album.audioGrade] ?? 0) * 20 + Number(album.audioScore || 0)), 0);
const groupLowestPrice = (group: AlbumProductGroup) => group.lowestPrice > 0 ? group.lowestPrice : Number.MAX_SAFE_INTEGER;

const compareHomeGroups = (left: AlbumProductGroup, right: AlbumProductGroup) => {
  if (homeSort.value === 'recent') {
    return groupLatestTime(right) - groupLatestTime(left)
      || groupScore(right) - groupScore(left)
      || right.listingCount - left.listingCount;
  }
  if (homeSort.value === 'price-low') {
    return groupLowestPrice(left) - groupLowestPrice(right)
      || groupScore(right) - groupScore(left)
      || right.listingCount - left.listingCount;
  }
  if (homeSort.value === 'quality') {
    return groupQualityScore(right) - groupQualityScore(left)
      || groupScore(right) - groupScore(left)
      || right.listingCount - left.listingCount;
  }
  return groupScore(right) - groupScore(left)
    || right.listingCount - left.listingCount
    || groupLatestTime(right) - groupLatestTime(left);
};

const resetFilters = () => {
  Object.assign(draftFilters, createMarketplaceFilters());
};

const applyFilters = () => {
  appliedFilters.value = cloneMarketplaceFilters(draftFilters);
  showHomeFilters.value = false;
};

const resetAndApplyFilters = () => {
  resetFilters();
  applyFilters();
};

const filteredListings = computed(() => store.listings.filter(album => matchesMarketplaceFilters(album, appliedFilters.value)));
const groupedHomeListings = (listings: Album[], limit: number) => groupListingsByAlbum(listings)
  .sort(compareHomeGroups)
  .slice(0, limit);

const searchedGroups = computed(() => {
  const normalized = normalize(query.value);
  if (!normalized) return [];
  return groupedHomeListings(filteredListings.value.filter(album => matchesAlbumTitle(album, normalized)), 12);
});

const preferenceGroups = computed(() => groupedHomeListings(filteredListings.value, 8));

const openAlbumGroup = (group: AlbumProductGroup) => {
  router.push({
    path: '/app/search',
    query: { albumKey: group.key, source: 'home' },
  });
};

const openSearchResults = () => {
  router.push({ path: '/app/search', query: { q: query.value.trim() || undefined } });
};

const toggleFilterPanel = () => {
  showHomeFilters.value = !showHomeFilters.value;
  showSortMenu.value = false;
};

const toggleSortMenu = () => {
  showSortMenu.value = !showSortMenu.value;
  showHomeFilters.value = false;
};

const selectHomeSort = (sort: HomeSortKey) => {
  homeSort.value = sort;
  showSortMenu.value = false;
};

const priceLabel = (price: number) => price > 0 ? `${price.toLocaleString()}원부터` : '가격 확인';

const AlbumGroupButton = defineComponent({
  props: {
    group: { type: Object as PropType<AlbumProductGroup>, required: true },
    actionLabel: { type: String, default: '보기' },
  },
  emits: ['open'],
  setup(props, { emit }) {
    return () => h('button', {
      type: 'button',
      class: 'w-full rounded-lg border border-gray-200 bg-white p-4 text-left shadow-sm active:bg-gray-50 dark:border-slate-800 dark:bg-slate-900',
      onClick: () => emit('open'),
    }, [
      h('div', { class: 'flex items-center gap-4' }, [
        h(VinylCover, {
          src: props.group.coverImage,
          alt: props.group.title,
          class: 'h-24 w-24 shrink-0 rounded-lg bg-gray-100 object-cover',
        }),
        h('div', { class: 'min-w-0 flex-1' }, [
          h('div', { class: 'flex items-start justify-between gap-3' }, [
            h('div', { class: 'min-w-0 flex-1' }, [
              h('p', { class: 'truncate text-sm font-medium text-gray-600 dark:text-slate-300' }, props.group.artist || '아티스트 미상'),
              h('h3', { class: 'mt-1 truncate text-base font-semibold text-gray-950 dark:text-slate-100' }, props.group.title),
            ]),
            h('span', { class: 'shrink-0 rounded-md bg-emerald-600 px-2.5 py-1 text-sm font-bold text-white shadow-sm' }, props.group.bestQualityLabel || '-'),
          ]),
          h('p', { class: 'mt-3 text-lg font-semibold text-gray-950 dark:text-slate-50' }, priceLabel(props.group.lowestPrice)),
        ]),
        h(ChevronRight, { size: 18, class: 'shrink-0 text-gray-400' }),
      ]),
    ]);
  },
});
</script>

<style scoped>
.filter-section {
  border: 1px solid #eadfcd;
  border-radius: 0.75rem;
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

.filter-field span {
  color: #4b5563;
  font-size: 0.72rem;
  font-weight: 700;
}

.filter-field select,
.filter-field input {
  min-width: 0;
  width: 100%;
  height: 2.75rem;
  border: 1px solid #e2d4bf;
  border-radius: 0.5rem;
  background: #fffaf0;
  padding: 0 0.7rem;
  color: #111827;
  font-size: 0.86rem;
  outline: none;
}

.filter-field select:focus,
.filter-field input:focus {
  border-color: #2563eb;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.14);
}

.filter-location-part {
  display: grid;
  min-width: 0;
  gap: 0.35rem;
  min-height: 4.15rem;
  align-content: center;
  border: 1px solid #e2d4bf;
  border-radius: 0.5rem;
  background: #fffaf0;
  padding: 0.6rem;
}

.filter-location-part span {
  color: #4b5563;
  font-size: 0.68rem;
  font-weight: 700;
}

.filter-location-part strong {
  min-width: 0;
  color: #111827;
  font-size: 0.8rem;
  font-weight: 750;
  line-height: 1.25;
  overflow-wrap: anywhere;
}

.location-scope-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(5.5rem, 1fr));
  gap: 0.5rem;
}

.location-scope-button {
  min-width: 0;
  min-height: 2.75rem;
  border: 1px solid #e2d4bf;
  border-radius: 0.5rem;
  background: #fffaf0;
  padding: 0.55rem 0.35rem;
  color: #374151;
  font-size: 0.76rem;
  font-weight: 750;
  line-height: 1.2;
}

.location-scope-button.is-active {
  border-color: #2563eb;
  background: #dbeafe;
  color: #1e40af;
}

.location-scope-placeholder {
  margin-top: 0.75rem;
  border: 1px dashed #e2d4bf;
  border-radius: 0.5rem;
  background: #fffaf0;
  padding: 0.75rem;
  color: #4b5563;
  font-size: 0.78rem;
  font-weight: 650;
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
  border: 1px dashed #bfdbfe;
  border-radius: 0.5rem;
  background: #eff6ff;
  padding: 0.55rem 0.75rem;
  color: #2563eb;
  font-size: 0.78rem;
  font-weight: 700;
}

.filter-range {
  display: grid;
  gap: 0.45rem;
  border: 1px solid #eadfcd;
  border-radius: 0.65rem;
  background: #fffaf0;
  padding: 0.75rem;
}

.range-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.grade-help-button {
  display: inline-flex;
  width: 1.75rem;
  height: 1.75rem;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border: 1px solid #bfdbfe;
  border-radius: 999px;
  background: #eff6ff;
  color: #2563eb;
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
  line-height: 1.35;
}

.filter-range span {
  color: #4b5563;
  font-size: 0.72rem;
  font-weight: 700;
}

.filter-range strong {
  color: #111827;
  font-size: 0.92rem;
}

.filter-range em {
  color: #6b7280;
  font-size: 0.7rem;
  font-style: normal;
  font-weight: 600;
}

.range-boundary {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  align-items: center;
  gap: 0.5rem;
}

.range-boundary span {
  min-width: 0;
  color: #374151;
  font-size: 0.68rem;
  font-weight: 700;
}

.range-boundary span:last-child {
  text-align: right;
}

.filter-range input {
  width: 100%;
  accent-color: #2563eb;
}

:global(.dark) .filter-section {
  border-color: #684831;
  background: #342217;
}

:global(.dark) .filter-section-title {
  color: #f8fafc;
}

:global(.dark) .filter-field span {
  color: #cbd5e1;
}

:global(.dark) .filter-field select,
:global(.dark) .filter-field input {
  border-color: #684831;
  background: #3a271b;
  color: #f8fafc;
}

:global(.dark) .filter-location-part span {
  color: #cbd5e1;
}

:global(.dark) .filter-location-part {
  border-color: #684831;
  background: #3a271b;
}

:global(.dark) .filter-location-part strong {
  color: #f8fafc;
}

:global(.dark) .location-scope-button {
  border-color: #684831;
  background: #3a271b;
  color: #e2e8f0;
}

:global(.dark) .location-scope-button.is-active {
  border-color: #93c5fd;
  background: #1e3a5f;
  color: #eff6ff;
}

:global(.dark) .location-scope-placeholder {
  border-color: #684831;
  background: #342217;
  color: #cbd5e1;
}

:global(.dark) .genre-chip {
  border-color: #684831;
  background: #3a271b;
  color: #f8fafc;
}

:global(.dark) .grade-help-button {
  border-color: #2563eb;
  background: #172554;
  color: #bfdbfe;
}

:global(.dark) .grade-help-panel {
  border-color: #684831;
  background: #342217;
}

:global(.dark) .grade-help-row b {
  color: #f8fafc;
}

:global(.dark) .genre-chip.is-active {
  border-color: #60a5fa;
  background: #1e3a5f;
  color: #bfdbfe;
}

:global(.dark) .genre-expand-button {
  border-color: #2563eb;
  background: #172554;
  color: #bfdbfe;
}

:global(.dark) .filter-range {
  border-color: #684831;
  background: #3a271b;
}

:global(.dark) .filter-range span {
  color: #cbd5e1;
}

:global(.dark) .filter-range strong {
  color: #f8fafc;
}

:global(.dark) .filter-range em {
  color: #cbd5e1;
}
</style>
