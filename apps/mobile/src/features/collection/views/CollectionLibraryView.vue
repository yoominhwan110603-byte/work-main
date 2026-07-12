<template>
  <div class="collection-page size-full overflow-y-auto bg-[#f5f0e8] text-gray-950 dark:bg-[#17100c] dark:text-neutral-50">
    <header class="sticky top-0 z-10 border-b border-gray-200 bg-white/95 px-4 py-4 backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/95">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <h1 class="text-2xl font-semibold">레코드장</h1>
          <p class="mt-1 text-sm text-gray-500 dark:text-neutral-400">책장에서 LP를 한 장씩 꺼내듯 컬렉션을 둘러봅니다.</p>
        </div>
        <button
          type="button"
          class="flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[#704326] px-3 text-sm font-medium text-white active:bg-[#56331d]"
          @click="router.push('/collection/new')"
        >
          <Plus :size="18" />
          <span>LP 등록</span>
        </button>
      </div>

      <div class="mt-4 grid grid-cols-3 gap-2">
        <div class="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-neutral-800 dark:bg-neutral-950">
          <p class="text-xs text-gray-500 dark:text-neutral-400">꽂힌 LP</p>
          <p class="mt-1 text-lg font-semibold">{{ visibleCollections.length }}</p>
        </div>
        <div class="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-neutral-800 dark:bg-neutral-950">
          <p class="text-xs text-gray-500 dark:text-neutral-400">내 칸</p>
          <p class="mt-1 text-lg font-semibold">{{ mineCollections.length }}</p>
        </div>
        <div class="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-neutral-800 dark:bg-neutral-950">
          <p class="text-xs text-gray-500 dark:text-neutral-400">꺼내볼 희귀반</p>
          <p class="mt-1 text-lg font-semibold">{{ rareCount }}</p>
        </div>
      </div>

      <div class="mt-4 flex items-center gap-2">
        <div class="relative min-w-0 flex-1">
          <Search :size="18" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          <input
            v-model="query"
            type="search"
            class="h-11 w-full rounded-lg border border-[#d5c2aa] bg-white pl-10 pr-10 text-sm outline-none focus:border-[#8a5735] focus:ring-2 focus:ring-[#ead8c2] dark:border-neutral-800 dark:bg-neutral-950 dark:focus:ring-[#3a2417]"
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
        <p class="mt-1 text-sm text-gray-500 dark:text-neutral-400">검색어를 줄이거나 컬렉션 범위를 바꿔보세요.</p>
        <button type="button" class="mt-5 rounded-lg border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 dark:border-neutral-700 dark:text-neutral-200" @click="resetBrowse">
          전체 보기
        </button>
      </section>

      <section v-else>
        <div class="shelf-stack" role="list" aria-label="레코드장 컬렉션">
          <div
            v-for="row in shelfDisplayRows"
            :key="row.index"
            :class="['shelf-row', { 'has-pulled': row.pulled }]"
            role="listitem"
            @pointerdown="beginRackPullGesture($event, row)"
            @pointermove="moveRackPullGesture($event)"
            @pointerup="finishRackPullGesture($event)"
            @pointercancel="cancelPullGesture"
            @mousedown="beginRackMousePullGesture($event, row)"
            @mousemove="moveRackMousePullGesture($event)"
            @mouseup="finishRackMousePullGesture($event)"
            @touchstart.passive="beginRackTouchPullGesture($event, row)"
            @touchmove.passive="moveRackTouchPullGesture($event)"
            @touchend="finishRackTouchPullGesture($event)"
          >
            <div
              class="spine-rack"
              role="list"
            >
              <button
                v-for="(collection, itemIndex) in row.items"
                :key="collection.id"
                type="button"
                :data-item-index="itemIndex"
                :class="['spine-record', { 'is-pulled': row.pulled?.id === collection.id }]"
                :style="spineStyle(collection, row.index, itemIndex)"
                :aria-label="`${collection.title}, ${collection.artist || '아티스트 미상'} 왼쪽으로 스와이프해서 꺼내기`"
                role="listitem"
                @keydown.left.prevent="pullCollection(collection, row.index)"
              >
                <span class="slot-depth" aria-hidden="true"></span>
                <span class="record-disc-edge" aria-hidden="true"></span>
                <span class="jacket-edge" aria-hidden="true"></span>
                <span class="spine-badges" aria-hidden="true">
                  <span v-if="collection.isRare">희</span>
                  <span v-if="collection.isFirstPress">초</span>
                </span>
              </button>

              <Transition name="pull-left" mode="out-in">
                <button
                  v-if="row.pulled"
                  :key="row.pulled.id"
                  type="button"
                  class="pulled-jacket"
                  :style="pulledJacketStyle()"
                  :aria-label="`${row.pulled.title} 상세 보기`"
                  @pointerdown.stop="beginPulledJacketGesture($event, row)"
                  @pointermove.stop="movePulledJacketGesture($event)"
                  @pointerup.stop="finishPulledJacketGesture($event)"
                  @pointercancel.stop="cancelPulledJacketGesture"
                  @mousedown.stop="beginPulledJacketMouseGesture($event, row)"
                  @mousemove.stop="movePulledJacketMouseGesture($event)"
                  @mouseup.stop="finishPulledJacketMouseGesture($event)"
                  @touchstart.passive.stop="beginPulledJacketTouchGesture($event, row)"
                  @touchmove.passive.stop="movePulledJacketTouchGesture($event)"
                  @touchend.stop="finishPulledJacketTouchGesture($event)"
                  @click="openPulledCollection($event, row.pulled.id)"
                >
                  <span class="pulled-disc" aria-hidden="true"></span>
                  <VinylCover :src="coverImageFor(row.pulled)" :alt="row.pulled.title" class="pulled-cover" />
                  <span class="pulled-caption">
                    <strong>{{ row.pulled.title }}</strong>
                    <span>{{ row.pulled.artist || '아티스트 미상' }}</span>
                    <small>
                      <Disc3 :size="13" />
                      <span>상세</span>
                      <ChevronRight :size="13" />
                    </small>
                  </span>
                </button>
              </Transition>
            </div>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ChevronRight, Disc3, LibraryBig, Plus, Search, SearchX, SlidersHorizontal, X } from 'lucide-vue-next';
import type { VinylCollection } from '@/shared/models/collection';
import VinylCover from '@/shared/components/VinylCover.vue';
import { useAppStore } from '@/shared/stores/appStore';

type CollectionScope = 'all' | 'mine' | 'public';
type CollectionSort = 'recent' | 'artist' | 'year' | 'title';
type ShelfDisplayRow = {
  index: number;
  items: VinylCollection[];
  pulledIndex: number;
  pulled: VinylCollection | null;
};
type ShelfSwipeStart = {
  rowIndex: number;
  itemIndex: number;
  id: string;
  x: number;
  y: number;
};
type PulledJacketSwipeStart = {
  rowIndex: number;
  itemIndex: number;
  x: number;
  y: number;
};

const shelfSlotStepRem = 1.12;
const shelfSlotWidthRem = 0.76;
const shelfSlotHeightRem = 9.65;
const shelfPullReserveGapRem = 0.2;

const store = useAppStore();
const router = useRouter();
const query = ref('');
const scope = ref<CollectionScope>('all');
const sort = ref<CollectionSort>('recent');

onMounted(() => {
  void store.loadCollectionsFromServer();
});

const isMine = (collection: VinylCollection) => collection.owner.id === store.user.id;
const ownedCollections = computed(() => store.collections.filter(collection => (collection.ownershipStatus || 'owned') === 'owned'));
const visibleCollections = computed(() => ownedCollections.value.filter(collection => isMine(collection) || collection.visibility === 'public'));
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

const filteredCollections = computed(() => {
  const normalizedQuery = query.value.trim().toLocaleLowerCase('ko-KR');
  return baseCollections.value
    .filter(collection => matchesQuery(collection, normalizedQuery))
    .sort((left, right) => {
      if (sort.value === 'artist') return (left.artist || left.title).localeCompare(right.artist || right.title, 'ko-KR');
      if (sort.value === 'year') return Number(right.year || 0) - Number(left.year || 0);
      if (sort.value === 'title') return left.title.localeCompare(right.title, 'ko-KR');
      return new Date(right.updatedAt || right.createdAt).getTime() - new Date(left.updatedAt || left.createdAt).getTime();
    });
});

const coverImageFor = (collection: VinylCollection) => collection.coverImageDataUrl || collection.discogsCoverImageUrl || collection.images[0] || '';
const collectionRoute = (id: string) => `/collection/${id}`;
const pulledByRow = ref<Record<number, string>>({});
const swipeStart = ref<ShelfSwipeStart | null>(null);
const pulledJacketSwipeStart = ref<PulledJacketSwipeStart | null>(null);
const suppressPulledJacketClick = ref(false);
const shelfRows = computed<VinylCollection[][]>(() => {
  const rowSize = 7;
  return filteredCollections.value.reduce<VinylCollection[][]>((rows, collection, index) => {
    const rowIndex = Math.floor(index / rowSize);
    if (!rows[rowIndex]) rows[rowIndex] = [];
    rows[rowIndex].push(collection);
    return rows;
  }, []);
});
const shelfDisplayRows = computed<ShelfDisplayRow[]>(() => shelfRows.value.map((items, index) => {
  const pulledIndex = items.findIndex(collection => collection.id === pulledByRow.value[index]);
  const displayPulledIndex = pulledIndex >= 0 ? pulledIndex : (index === 0 ? 0 : -1);
  return {
    index,
    items,
    pulledIndex: displayPulledIndex,
    pulled: displayPulledIndex >= 0 ? items[displayPulledIndex] : null,
  };
}));
const spineAccent = (rowIndex: number, itemIndex: number) => {
  const colors = ['#26364f', '#5b2d25', '#2c4a3f', '#4f3b62'];
  return colors[(rowIndex * 2 + itemIndex) % colors.length];
};
const coverBackgroundFor = (collection: VinylCollection) => {
  const image = coverImageFor(collection).replace(/"/g, '\\"');
  return image ? `url("${image}")` : 'linear-gradient(160deg, #1f2937, #0f172a)';
};
const spineStyle = (collection: VinylCollection, rowIndex: number, itemIndex: number) => ({
  '--accent': spineAccent(rowIndex, itemIndex),
  '--cover': coverBackgroundFor(collection),
  zIndex: itemIndex + 1,
});
const pulledJacketStyle = () => ({
  '--pull-left': `${shelfPullReserveGapRem}rem`,
});
const pullCollection = (collection: VinylCollection, rowIndex: number) => {
  pulledByRow.value = { ...pulledByRow.value, [rowIndex]: collection.id };
};
const pullCollectionAt = (rowIndex: number, itemIndex: number) => {
  const collection = shelfRows.value[rowIndex]?.[itemIndex];
  if (!collection) return false;
  pullCollection(collection, rowIndex);
  return true;
};
const openPulledCollection = (event: MouseEvent, id: string) => {
  if (suppressPulledJacketClick.value) {
    event.preventDefault();
    event.stopPropagation();
    suppressPulledJacketClick.value = false;
    return;
  }
  router.push(collectionRoute(id));
};
const resolveRackCollection = (rack: HTMLElement, eventTarget: EventTarget | null, row: ShelfDisplayRow, clientX: number) => {
  const target = eventTarget instanceof HTMLElement ? eventTarget : null;
  const directRecord = target?.closest<HTMLButtonElement>('.spine-record');
  if (directRecord && rack.contains(directRecord)) {
    const directIndex = Number(directRecord.dataset.itemIndex);
    if (Number.isInteger(directIndex) && row.items[directIndex]) {
      return { collection: row.items[directIndex], itemIndex: directIndex };
    }
  }

  const records = Array.from(rack.querySelectorAll<HTMLButtonElement>('.spine-record'));
  let nearestIndex = -1;
  let nearestDistance = Number.POSITIVE_INFINITY;
  records.forEach((record, index) => {
    const rect = record.getBoundingClientRect();
    const center = rect.left + rect.width / 2;
    const distance = Math.abs(clientX - center);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = index;
    }
  });

  if (nearestIndex < 0 || !row.items[nearestIndex]) return null;
  return { collection: row.items[nearestIndex], itemIndex: nearestIndex };
};
const startPullAt = (row: ShelfDisplayRow, itemIndex: number, x: number, y: number) => {
  const collection = row.items[itemIndex];
  if (!collection) return;
  swipeStart.value = { rowIndex: row.index, itemIndex, id: collection.id, x, y };
};
const pullIfSwipedLeft = (x: number, y: number) => {
  const start = swipeStart.value;
  if (!start) return false;

  const deltaX = x - start.x;
  const deltaY = y - start.y;
  const isLeftSwipe = deltaX < -8 && Math.abs(deltaX) > Math.abs(deltaY) * 0.45;
  if (!isLeftSwipe) return false;

  const collection = shelfRows.value[start.rowIndex]?.[start.itemIndex];
  if (!collection || collection.id !== start.id) return false;

  pullCollection(collection, start.rowIndex);
  swipeStart.value = null;
  return true;
};
const beginRackPullGesture = (event: PointerEvent, row: ShelfDisplayRow) => {
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  const rack = event.currentTarget as HTMLElement | null;
  if (!rack) return;
  const resolved = resolveRackCollection(rack, event.target, row, event.clientX);
  if (!resolved) return;
  rack.setPointerCapture?.(event.pointerId);
  startPullAt(row, resolved.itemIndex, event.clientX, event.clientY);
};
const moveRackPullGesture = (event: PointerEvent) => {
  if (pullIfSwipedLeft(event.clientX, event.clientY)) {
    const rack = event.currentTarget as HTMLElement | null;
    if (rack?.hasPointerCapture?.(event.pointerId)) rack.releasePointerCapture(event.pointerId);
  }
};
const finishRackPullGesture = (event: PointerEvent) => {
  const rack = event.currentTarget as HTMLElement | null;
  if (rack?.hasPointerCapture?.(event.pointerId)) rack.releasePointerCapture(event.pointerId);
  pullIfSwipedLeft(event.clientX, event.clientY);
  swipeStart.value = null;
};
const beginRackMousePullGesture = (event: MouseEvent, row: ShelfDisplayRow) => {
  if (event.button !== 0) return;
  const rack = event.currentTarget as HTMLElement | null;
  if (!rack) return;
  const resolved = resolveRackCollection(rack, event.target, row, event.clientX);
  if (!resolved) return;
  startPullAt(row, resolved.itemIndex, event.clientX, event.clientY);
};
const moveRackMousePullGesture = (event: MouseEvent) => {
  pullIfSwipedLeft(event.clientX, event.clientY);
};
const finishRackMousePullGesture = (event: MouseEvent) => {
  pullIfSwipedLeft(event.clientX, event.clientY);
  swipeStart.value = null;
};
const beginRackTouchPullGesture = (event: TouchEvent, row: ShelfDisplayRow) => {
  const touch = event.touches[0];
  if (!touch) return;
  const rack = event.currentTarget as HTMLElement | null;
  if (!rack) return;
  const resolved = resolveRackCollection(rack, event.target, row, touch.clientX);
  if (!resolved) return;
  startPullAt(row, resolved.itemIndex, touch.clientX, touch.clientY);
};
const moveRackTouchPullGesture = (event: TouchEvent) => {
  const touch = event.touches[0];
  if (!touch) return;
  pullIfSwipedLeft(touch.clientX, touch.clientY);
};
const finishRackTouchPullGesture = (event: TouchEvent) => {
  const touch = event.changedTouches[0];
  if (touch) pullIfSwipedLeft(touch.clientX, touch.clientY);
  swipeStart.value = null;
};
const cancelPullGesture = () => {
  swipeStart.value = null;
};
const startPulledJacketAt = (row: ShelfDisplayRow, x: number, y: number) => {
  if (!row.pulled) return;
  pulledJacketSwipeStart.value = { rowIndex: row.index, itemIndex: row.pulledIndex, x, y };
};
const switchPulledJacketIfSwiped = (x: number, y: number) => {
  const start = pulledJacketSwipeStart.value;
  if (!start) return false;

  const deltaX = x - start.x;
  const deltaY = y - start.y;
  const isHorizontalSwipe = Math.abs(deltaX) > 8 && Math.abs(deltaX) > Math.abs(deltaY) * 0.45;
  if (!isHorizontalSwipe) return false;

  const rowItems = shelfRows.value[start.rowIndex] || [];
  const nextIndex = deltaX < 0
    ? Math.min(rowItems.length - 1, start.itemIndex + 1)
    : Math.max(0, start.itemIndex - 1);

  suppressPulledJacketClick.value = true;
  pulledJacketSwipeStart.value = null;
  if (nextIndex === start.itemIndex) return true;
  return pullCollectionAt(start.rowIndex, nextIndex);
};
const beginPulledJacketGesture = (event: PointerEvent, row: ShelfDisplayRow) => {
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  (event.currentTarget as HTMLElement | null)?.setPointerCapture?.(event.pointerId);
  startPulledJacketAt(row, event.clientX, event.clientY);
};
const movePulledJacketGesture = (event: PointerEvent) => {
  if (switchPulledJacketIfSwiped(event.clientX, event.clientY)) {
    const target = event.currentTarget as HTMLElement | null;
    if (target?.hasPointerCapture?.(event.pointerId)) target.releasePointerCapture(event.pointerId);
  }
};
const finishPulledJacketGesture = (event: PointerEvent) => {
  const target = event.currentTarget as HTMLElement | null;
  if (target?.hasPointerCapture?.(event.pointerId)) target.releasePointerCapture(event.pointerId);
  switchPulledJacketIfSwiped(event.clientX, event.clientY);
  pulledJacketSwipeStart.value = null;
};
const beginPulledJacketMouseGesture = (event: MouseEvent, row: ShelfDisplayRow) => {
  if (event.button !== 0) return;
  startPulledJacketAt(row, event.clientX, event.clientY);
};
const movePulledJacketMouseGesture = (event: MouseEvent) => {
  switchPulledJacketIfSwiped(event.clientX, event.clientY);
};
const finishPulledJacketMouseGesture = (event: MouseEvent) => {
  switchPulledJacketIfSwiped(event.clientX, event.clientY);
  pulledJacketSwipeStart.value = null;
};
const beginPulledJacketTouchGesture = (event: TouchEvent, row: ShelfDisplayRow) => {
  const touch = event.touches[0];
  if (!touch) return;
  startPulledJacketAt(row, touch.clientX, touch.clientY);
};
const movePulledJacketTouchGesture = (event: TouchEvent) => {
  const touch = event.touches[0];
  if (!touch) return;
  switchPulledJacketIfSwiped(touch.clientX, touch.clientY);
};
const finishPulledJacketTouchGesture = (event: TouchEvent) => {
  const touch = event.changedTouches[0];
  if (touch) switchPulledJacketIfSwiped(touch.clientX, touch.clientY);
  pulledJacketSwipeStart.value = null;
};
const cancelPulledJacketGesture = () => {
  pulledJacketSwipeStart.value = null;
};
const chipClass = (active: boolean) => [
  'inline-flex h-9 shrink-0 items-center gap-1 rounded-full border px-3 text-xs',
  active
    ? 'border-[#704326] bg-[#704326] text-white'
    : 'border-gray-200 bg-white text-gray-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200',
];

const resetBrowse = () => {
  query.value = '';
  scope.value = 'all';
  sort.value = 'recent';
};
</script>

<style scoped>
.collection-page {
  background:
    radial-gradient(circle at 10% 0%, rgba(132, 82, 42, 0.16), transparent 22rem),
    linear-gradient(180deg, #f7f1e8 0%, #eee4d8 54%, #f6f1ea 100%);
}

.dark .collection-page {
  background:
    radial-gradient(circle at 10% 0%, rgba(166, 111, 63, 0.16), transparent 22rem),
    linear-gradient(180deg, #17100c 0%, #211712 62%, #14100e 100%);
}

.shelf-stack {
  display: grid;
  gap: 1rem;
}

.shelf-row {
  --slot-step: 1.12rem;
  --slot-width: 0.76rem;
  --slot-height: 9.65rem;
  position: relative;
  min-height: 12.45rem;
  overflow: hidden;
  padding: 0.95rem 0.9rem 1.5rem;
  border: 1px solid rgba(132, 99, 63, 0.24);
  border-radius: 0.9rem;
  isolation: isolate;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.46), rgba(224, 202, 177, 0.5)),
    repeating-linear-gradient(90deg, rgba(126, 86, 45, 0.11) 0 1px, transparent 1px 18px);
  box-shadow: inset 0 12px 26px rgba(112, 74, 38, 0.13), 0 12px 22px rgba(93, 61, 34, 0.08);
  touch-action: pan-y;
}

.shelf-row::before {
  position: absolute;
  top: 0.7rem;
  right: 0.7rem;
  left: 0.7rem;
  z-index: -1;
  height: var(--slot-height);
  content: "";
  border-radius: 0.55rem;
  background:
    linear-gradient(180deg, rgba(66, 42, 24, 0.18), transparent 42%),
    linear-gradient(90deg, rgba(104, 67, 37, 0.16), transparent 18%, transparent 82%, rgba(78, 45, 22, 0.16));
}

.shelf-row::after {
  position: absolute;
  right: 0;
  bottom: 0.32rem;
  left: 0;
  z-index: -1;
  height: 1.45rem;
  content: "";
  border-radius: 0.42rem;
  background: linear-gradient(180deg, #b88456 0%, #825333 52%, #5f3a21 100%);
  box-shadow: 0 9px 18px rgba(82, 53, 30, 0.22);
}

.dark .shelf-row {
  border-color: rgba(255, 255, 255, 0.1);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(64, 48, 37, 0.45)),
    repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.05) 0 1px, transparent 1px 16px);
  box-shadow: inset 0 10px 24px rgba(0, 0, 0, 0.35);
}

.dark .shelf-row::after {
  background: linear-gradient(180deg, #7a563d 0%, #563824 55%, #332116 100%);
  box-shadow: 0 9px 18px rgba(0, 0, 0, 0.36);
}

.pulled-jacket {
  position: absolute;
  top: 0.95rem;
  left: var(--pull-left);
  z-index: 80;
  width: var(--slot-height);
  aspect-ratio: 1;
  border-radius: 0.36rem;
  border: 1px solid rgba(255, 255, 255, 0.82);
  background: rgba(255, 255, 255, 0.78);
  box-shadow: 0 18px 24px rgba(72, 48, 28, 0.28), 12px 0 18px rgba(62, 39, 23, 0.14);
  text-align: left;
  transform: translateX(0);
  transform-origin: 100% 50%;
}

.pulled-jacket:focus-visible,
.spine-record:focus-visible {
  outline: 3px solid rgba(177, 111, 54, 0.45);
  outline-offset: 3px;
}

.pulled-disc {
  position: absolute;
  top: 0.95rem;
  right: auto;
  left: -0.65rem;
  z-index: -1;
  width: 5.7rem;
  aspect-ratio: 1;
  border-radius: 9999px;
  background:
    radial-gradient(circle, #d6c69b 0 8%, #101010 9% 18%, #2d2d2d 19% 40%, #0b0b0b 41% 100%);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.14), 0 10px 14px rgba(0, 0, 0, 0.28);
}

.pulled-cover {
  position: absolute;
  inset: 0;
  height: 100%;
  width: 100%;
  border-radius: 0.25rem;
  object-fit: cover;
}

.pulled-caption {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  display: grid;
  gap: 0.1rem;
  padding: 1.7rem 0.55rem 0.5rem;
  border-radius: 0 0 0.25rem 0.25rem;
  background:
    linear-gradient(180deg, transparent, rgba(0, 0, 0, 0.82));
  color: white;
}

.pulled-caption strong,
.pulled-caption span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pulled-caption strong {
  font-size: 0.78rem;
  line-height: 1.1;
}

.pulled-caption span {
  font-size: 0.68rem;
  opacity: 0.82;
}

.pulled-caption small {
  display: inline-flex;
  width: max-content;
  align-items: center;
  gap: 0.15rem;
  margin-top: 0.25rem;
  border-radius: 9999px;
  background: rgba(227, 173, 101, 0.92);
  padding: 0.2rem 0.4rem;
  font-size: 0.66rem;
  font-weight: 700;
  color: #2b170c;
}

.spine-rack {
  position: relative;
  display: flex;
  min-width: 0;
  align-items: flex-end;
  justify-content: flex-start;
  overflow: visible;
  min-height: 10.8rem;
  padding: 0.58rem 0.25rem 1.15rem;
  touch-action: pan-y;
}

.shelf-row.has-pulled .spine-rack {
  padding-left: calc(var(--slot-height) + 0.65rem);
}

.spine-rack::before {
  position: absolute;
  right: 0;
  bottom: 0.95rem;
  left: 0;
  height: 0.55rem;
  content: "";
  border-radius: 9999px;
  background: linear-gradient(90deg, transparent, rgba(58, 36, 20, 0.24), transparent);
}

.spine-record {
  position: relative;
  display: block;
  flex: 0 0 var(--slot-width);
  width: var(--slot-width);
  height: var(--slot-height);
  margin-left: calc(var(--slot-step) - var(--slot-width));
  overflow: visible;
  border: 0;
  border-radius: 0.24rem;
  background: transparent;
  padding: 0;
  color: white;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
  touch-action: pan-y;
  transform: translateY(0);
  transition: transform 170ms ease, opacity 170ms ease;
}

.spine-record:first-child {
  margin-left: 0;
}

.slot-depth {
  position: absolute;
  inset: 0.16rem -0.18rem -0.16rem 0.18rem;
  z-index: 0;
  content: "";
  border-radius: 0.24rem;
  background:
    linear-gradient(135deg, var(--accent), #17110c);
  box-shadow: 0 12px 16px rgba(50, 31, 18, 0.22);
}

.record-disc-edge {
  position: absolute;
  top: 0.6rem;
  right: -0.34rem;
  z-index: 1;
  width: 2.15rem;
  aspect-ratio: 1;
  border-radius: 9999px;
  background:
    radial-gradient(circle, #d4b36d 0 8%, #141414 9% 20%, #2b2b2b 21% 44%, #080808 45% 100%);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.12), 0 8px 12px rgba(0, 0, 0, 0.25);
}

.jacket-edge {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: block;
  border: 1px solid rgba(255, 255, 255, 0.64);
  border-radius: 0.24rem;
  background:
    linear-gradient(180deg, rgba(0, 0, 0, 0.16), rgba(0, 0, 0, 0.42)),
    var(--cover);
  background-position: center;
  background-size: cover;
  box-shadow: 0 13px 16px rgba(54, 34, 20, 0.22);
}

.spine-record.is-pulled {
  transform: translateY(-0.12rem);
}

.spine-record.is-pulled > * {
  opacity: 1;
}

.spine-record.is-pulled .jacket-edge {
  box-shadow: 0 0 0 2px rgba(227, 173, 101, 0.55), 0 13px 16px rgba(54, 34, 20, 0.22);
}

.spine-badges {
  position: absolute;
  top: 0.34rem;
  left: 50%;
  z-index: 4;
  display: flex;
  flex-direction: column;
  gap: 0.12rem;
  transform: translateX(-50%);
}

.spine-badges span {
  display: grid;
  height: 0.9rem;
  width: 0.9rem;
  place-items: center;
  border-radius: 9999px;
  background: rgba(245, 158, 11, 0.92);
  font-size: 0.56rem;
  font-weight: 800;
  line-height: 1;
}

.spine-badges span + span {
  background: rgba(79, 70, 229, 0.9);
}

.pull-left-enter-active,
.pull-left-leave-active {
  transition: opacity 170ms ease, transform 240ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.pull-left-enter-from {
  opacity: 0;
  transform: translateX(2.8rem) scale(0.97);
}

.pull-left-leave-to {
  opacity: 0;
  transform: translateX(-1.2rem) scale(0.97);
}

@media (hover: hover) {
  .spine-record:hover {
    transform: translateY(-0.18rem);
  }

  .spine-record.is-pulled:hover {
    transform: translateY(0);
  }
}

@media (max-width: 420px) {
  .shelf-row {
    min-height: 12.35rem;
    padding-inline: 0.62rem;
  }

  .pulled-jacket {
    top: 1.05rem;
  }

  .spine-rack {
    min-height: 10.7rem;
    padding-inline: 0.1rem;
  }

  .record-disc-edge {
    width: 2rem;
    right: -0.34rem;
  }
}
</style>
