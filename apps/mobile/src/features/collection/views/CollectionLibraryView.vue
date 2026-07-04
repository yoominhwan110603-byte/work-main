<template>
  <div class="collection-page size-full overflow-y-auto bg-[#f5f0e8] text-gray-950 dark:bg-[#17100c] dark:text-neutral-50">
    <header class="sticky top-0 z-10 border-b border-gray-200 bg-white/95 px-4 py-4 backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/95">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <h1 class="text-2xl font-semibold">컬렉션</h1>
          <p class="mt-1 text-sm text-gray-500 dark:text-neutral-400">소장 LP와 공개 LP를 한곳에서 확인합니다.</p>
        </div>
        <button
          type="button"
          class="flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 text-sm font-medium text-white active:bg-blue-700"
          @click="router.push('/collection/new')"
        >
          <Plus :size="18" />
          <span>LP 등록</span>
        </button>
      </div>

      <div class="mt-4 grid grid-cols-3 gap-2">
        <div class="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-neutral-800 dark:bg-neutral-950">
          <p class="text-xs text-gray-500 dark:text-neutral-400">전체</p>
          <p class="mt-1 text-lg font-semibold">{{ visibleCollections.length }}</p>
        </div>
        <div class="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-neutral-800 dark:bg-neutral-950">
          <p class="text-xs text-gray-500 dark:text-neutral-400">내 LP</p>
          <p class="mt-1 text-lg font-semibold">{{ mineCollections.length }}</p>
        </div>
        <div class="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-neutral-800 dark:bg-neutral-950">
          <p class="text-xs text-gray-500 dark:text-neutral-400">희귀반</p>
          <p class="mt-1 text-lg font-semibold">{{ rareCount }}</p>
        </div>
      </div>

      <div class="mt-4 flex items-center gap-2">
        <div class="relative min-w-0 flex-1">
          <Search :size="18" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          <input
            v-model="query"
            type="search"
            class="h-11 w-full rounded-lg border border-gray-200 bg-white pl-10 pr-10 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-neutral-800 dark:bg-neutral-950 dark:focus:ring-blue-950"
            placeholder="앨범, 아티스트, 카탈로그 번호"
            aria-label="컬렉션 검색"
          />
          <button
            v-if="query"
            type="button"
            class="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-gray-400"
            aria-label="검색어 지우기"
            @click="query = ''"
          >
            <X :size="16" />
          </button>
        </div>
        <label class="flex h-11 shrink-0 items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 text-xs text-gray-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200">
          <SlidersHorizontal :size="15" aria-hidden="true" />
          <span class="sr-only">컬렉션 정렬</span>
          <select v-model="sort" class="max-w-[5.8rem] bg-transparent outline-none" aria-label="컬렉션 정렬">
            <option value="recent">최근 등록순</option>
            <option value="artist">아티스트순</option>
            <option value="year">발매 연도순</option>
            <option value="title">앨범명순</option>
          </select>
        </label>
      </div>

      <div class="mt-3 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group" aria-label="컬렉션 범위">
        <button
          v-for="item in scopeOptions"
          :key="item.value"
          type="button"
          :class="chipClass(scope === item.value)"
          :aria-pressed="scope === item.value"
          @click="scope = item.value"
        >
          {{ item.label }} <span>{{ item.count }}</span>
        </button>
      </div>

      <div class="mt-2 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group" aria-label="컬렉션 필터">
        <button
          v-for="item in filterOptions"
          :key="item.value"
          type="button"
          :class="chipClass(filter === item.value)"
          :aria-pressed="filter === item.value"
          @click="filter = item.value"
        >
          {{ item.label }} <span>{{ item.count }}</span>
        </button>
      </div>
    </header>

    <main class="px-4 py-4 pb-24">
      <section v-if="visibleCollections.length === 0" class="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center dark:border-neutral-700 dark:bg-neutral-900">
        <LibraryBig :size="34" class="mx-auto text-gray-300 dark:text-neutral-600" />
        <h2 class="mt-3 text-base font-semibold">등록된 LP가 없습니다</h2>
        <p class="mt-1 text-sm text-gray-500 dark:text-neutral-400">첫 번째 소장 LP를 등록해 보세요.</p>
        <button type="button" class="mt-5 rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white" @click="router.push('/collection/new')">
          LP 등록
        </button>
      </section>

      <section v-else-if="filteredCollections.length === 0" class="rounded-lg border border-gray-200 bg-white p-8 text-center dark:border-neutral-800 dark:bg-neutral-900">
        <SearchX :size="34" class="mx-auto text-gray-300 dark:text-neutral-600" />
        <h2 class="mt-3 text-base font-semibold">조건에 맞는 LP가 없습니다</h2>
        <p class="mt-1 text-sm text-gray-500 dark:text-neutral-400">검색어를 줄이거나 필터를 전체로 바꿔보세요.</p>
        <button type="button" class="mt-5 rounded-lg border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 dark:border-neutral-700 dark:text-neutral-200" @click="resetBrowse">
          전체 보기
        </button>
      </section>

      <section v-else>
        <div class="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 class="text-lg font-semibold">{{ shelfTitle }}</h2>
            <p class="mt-1 text-sm text-gray-500 dark:text-neutral-400">{{ sortLabel }}</p>
          </div>
          <span class="shrink-0 text-sm text-gray-500 dark:text-neutral-400">{{ filteredCollections.length }}개</span>
        </div>

        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <CollectionCard
            v-for="collection in filteredCollections"
            :key="collection.id"
            :collection="collection"
          />
        </div>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { LibraryBig, Plus, Search, SearchX, SlidersHorizontal, X } from 'lucide-vue-next';
import type { VinylCollection } from '@/shared/models/collection';
import CollectionCard from '@/shared/components/CollectionCard.vue';
import { useAppStore } from '@/shared/stores/appStore';

type CollectionScope = 'all' | 'mine' | 'public';
type CollectionFilter = 'all' | 'owned' | 'rare' | 'first' | 'reserved';
type CollectionSort = 'recent' | 'artist' | 'year' | 'title';

const store = useAppStore();
const router = useRouter();
const query = ref('');
const scope = ref<CollectionScope>('all');
const filter = ref<CollectionFilter>('all');
const sort = ref<CollectionSort>('recent');

onMounted(() => {
  void store.loadCollectionsFromServer();
});

const isMine = (collection: VinylCollection) => collection.owner.id === store.user.id;
const visibleCollections = computed(() => store.collections.filter(collection => isMine(collection) || collection.visibility === 'public'));
const mineCollections = computed(() => visibleCollections.value.filter(isMine));
const publicCollections = computed(() => visibleCollections.value.filter(collection => collection.visibility === 'public'));
const rareCount = computed(() => visibleCollections.value.filter(collection => collection.isRare).length);

const scopeOptions = computed(() => [
  { value: 'all' as const, label: '전체', count: visibleCollections.value.length },
  { value: 'mine' as const, label: '내 LP', count: mineCollections.value.length },
  { value: 'public' as const, label: '공개', count: publicCollections.value.length },
]);

const baseCollections = computed(() => {
  if (scope.value === 'mine') return mineCollections.value;
  if (scope.value === 'public') return publicCollections.value;
  return visibleCollections.value;
});

const filterOptions = computed(() => [
  { value: 'all' as const, label: '전체', count: baseCollections.value.length },
  { value: 'owned' as const, label: '보유 중', count: baseCollections.value.filter(item => (item.ownershipStatus || 'owned') === 'owned').length },
  { value: 'rare' as const, label: '희귀반', count: baseCollections.value.filter(item => item.isRare).length },
  { value: 'first' as const, label: '초반', count: baseCollections.value.filter(item => item.isFirstPress).length },
  { value: 'reserved' as const, label: '예약', count: baseCollections.value.filter(item => item.ownershipStatus === 'reserved').length },
]);

const matchesQuery = (collection: VinylCollection, normalizedQuery: string) => {
  if (!normalizedQuery) return true;
  return [
    collection.title,
    collection.artist,
    collection.catalogNumber,
    collection.releaseLabel,
    collection.releaseCountry,
    collection.pressingInfo,
    collection.owner.name,
    ...collection.tags,
  ].filter(Boolean).join(' ').toLocaleLowerCase('ko-KR').includes(normalizedQuery);
};

const matchesFilter = (collection: VinylCollection) => {
  if (filter.value === 'owned') return (collection.ownershipStatus || 'owned') === 'owned';
  if (filter.value === 'rare') return collection.isRare;
  if (filter.value === 'first') return collection.isFirstPress;
  if (filter.value === 'reserved') return collection.ownershipStatus === 'reserved';
  return true;
};

const filteredCollections = computed(() => {
  const normalizedQuery = query.value.trim().toLocaleLowerCase('ko-KR');
  return baseCollections.value
    .filter(collection => matchesFilter(collection) && matchesQuery(collection, normalizedQuery))
    .sort((left, right) => {
      if (sort.value === 'artist') return (left.artist || left.title).localeCompare(right.artist || right.title, 'ko-KR');
      if (sort.value === 'year') return Number(right.year || 0) - Number(left.year || 0);
      if (sort.value === 'title') return left.title.localeCompare(right.title, 'ko-KR');
      return new Date(right.updatedAt || right.createdAt).getTime() - new Date(left.updatedAt || left.createdAt).getTime();
    });
});

const shelfTitle = computed(() => {
  if (scope.value === 'mine') return '내 컬렉션';
  if (scope.value === 'public') return '공개 컬렉션';
  return '전체 컬렉션';
});
const sortLabel = computed(() => ({
  recent: '최근 등록순',
  artist: '아티스트순',
  year: '발매 연도순',
  title: '앨범명순',
}[sort.value]));
const chipClass = (active: boolean) => [
  'inline-flex h-9 shrink-0 items-center gap-1 rounded-full border px-3 text-xs',
  active
    ? 'border-blue-600 bg-blue-600 text-white'
    : 'border-gray-200 bg-white text-gray-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200',
];

const resetBrowse = () => {
  query.value = '';
  scope.value = 'all';
  filter.value = 'all';
  sort.value = 'recent';
};
</script>
