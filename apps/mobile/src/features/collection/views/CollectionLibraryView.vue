<template>
  <div class="collection-page size-full overflow-y-auto bg-[#f5f0e8] text-gray-950 dark:bg-[#2a1a12] dark:text-neutral-50">
    <header class="sticky top-0 z-10 border-b border-gray-200 bg-white/95 px-4 py-5 backdrop-blur dark:border-[#684831] dark:bg-[#342217]/95">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <h1 class="text-2xl font-semibold">레코드장</h1>
          <p class="mt-1 text-sm text-gray-500 dark:text-neutral-400">책장에서 LP를 한 장씩 꺼내듯 컬렉션을 둘러봅니다.</p>
        </div>
        <button
          type="button"
          class="flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[#704326] px-3 text-sm font-medium text-white active:bg-[#56331d]"
          @click="router.push('/app/collection/new')"
        >
          <Plus :size="18" />
          <span>LP 등록</span>
        </button>
      </div>

      <div class="mt-5 flex items-center gap-2">
        <div class="relative min-w-0 flex-1">
          <Search :size="18" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          <input
            v-model="query"
            type="search"
            class="h-11 w-full rounded-lg border border-[#d5c2aa] bg-white pl-10 pr-10 text-sm outline-none focus:border-[#8a5735] focus:ring-2 focus:ring-[#ead8c2] dark:border-[#684831] dark:bg-[#3a271b] dark:focus:ring-[#5a3d2a]"
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
        <label class="flex h-11 shrink-0 items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 text-xs text-gray-700 dark:border-[#684831] dark:bg-[#3a271b] dark:text-neutral-200">
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
    </header>

    <main class="px-4 py-5 pb-28">
      <section v-if="visibleCollections.length === 0" class="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center dark:border-[#684831] dark:bg-[#342217]">
        <LibraryBig :size="34" class="mx-auto text-gray-300 dark:text-neutral-600" />
        <h2 class="mt-3 text-base font-semibold">등록된 LP가 없습니다</h2>
        <p class="mt-1 text-sm text-gray-500 dark:text-neutral-400">첫 번째 소장 LP를 등록해 보세요.</p>
        <button type="button" class="mt-5 rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white" @click="router.push('/app/collection/new')">
          LP 등록
        </button>
      </section>

      <section v-else-if="filteredCollections.length === 0" class="rounded-lg border border-gray-200 bg-white p-8 text-center dark:border-[#684831] dark:bg-[#342217]">
        <SearchX :size="34" class="mx-auto text-gray-300 dark:text-neutral-600" />
        <h2 class="mt-3 text-base font-semibold">조건에 맞는 LP가 없습니다</h2>
        <p class="mt-1 text-sm text-gray-500 dark:text-neutral-400">검색어를 줄여보세요.</p>
        <button type="button" class="mt-5 rounded-lg border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 dark:border-neutral-700 dark:text-neutral-200" @click="resetBrowse">
          검색 초기화
        </button>
      </section>

      <section v-else class="space-y-4">
        <div class="flex items-end justify-between gap-3">
          <div class="min-w-0">
            <h2 class="text-lg font-semibold text-[#4a2b1b] dark:text-[#f0d2ae]">내 컬렉션</h2>
            <p class="mt-1 text-sm text-[#8a6240] dark:text-[#cba781]">{{ sortLabel }}</p>
            <p class="mt-2 text-sm font-semibold text-[#6f492d] dark:text-[#e5c39b]">총 구매 금액 {{ totalCollectionPrice.toLocaleString() }}원</p>
          </div>
          <span class="shrink-0 text-sm text-gray-500 dark:text-neutral-400">{{ filteredCollections.length }}개</span>
        </div>

        <div class="shelf-stack" role="list" aria-label="레코드장 컬렉션">
          <div
            v-for="row in shelfDisplayRows"
            :key="row.index"
            class="shelf-display-row"
            role="listitem"
          >
            <div
              :class="['shelf-row', { 'has-pulled': row.pulled }]"
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
                  <span class="jacket-edge" aria-hidden="true"></span>
                </button>

                <Transition name="pull-left" mode="out-in">
                  <button
                    v-if="row.pulled"
                    :key="row.pulled.id"
                    type="button"
                    class="pulled-jacket"
                    :style="pulledJacketStyle(row.pulledIndex)"
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

            <div class="lp-position-strip" aria-label="선반 LP 위치">
              <button
                type="button"
                :disabled="!row.previous"
                class="lp-position-item"
                @click="row.previous && pullCollection(row.previous, row.index)"
              >
                <span>전 LP</span>
                <strong>{{ row.previous?.title || '없음' }}</strong>
              </button>
              <button
                type="button"
                :disabled="!row.pulled"
                class="lp-position-item is-current"
                @click="row.pulled && router.push(collectionRoute(row.pulled.id))"
              >
                <span>현재 LP</span>
                <strong>{{ row.pulled?.title || '없음' }}</strong>
              </button>
              <button
                type="button"
                :disabled="!row.next"
                class="lp-position-item"
                @click="row.next && pullCollection(row.next, row.index)"
              >
                <span>다음 LP</span>
                <strong>{{ row.next?.title || '없음' }}</strong>
              </button>
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

type CollectionSort = 'recent' | 'artist' | 'year' | 'title';
type ShelfDisplayRow = {
  index: number;
  items: VinylCollection[];
  pulledIndex: number;
  pulled: VinylCollection | null;
  previous: VinylCollection | null;
  next: VinylCollection | null;
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
const shelfPullGapRem = 0.65;
const shelfPullStartInsetRem = 0.16;
const shelfPullShiftRem = shelfSlotHeightRem + shelfPullGapRem;

const store = useAppStore();
const router = useRouter();
const query = ref('');
const sort = ref<CollectionSort>('recent');

onMounted(() => {
  void store.loadCollectionsFromServer();
});

const isMine = (collection: VinylCollection) => collection.owner.id === store.user.id;
const ownedCollections = computed(() => store.collections.filter(collection => (collection.ownershipStatus || 'owned') === 'owned'));
const visibleCollections = computed(() => ownedCollections.value.filter(isMine));
const baseCollections = computed(() => visibleCollections.value);

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

const sortLabel = computed(() => ({
  recent: '최근 등록순',
  artist: '아티스트순',
  year: '발매 연도순',
  title: '앨범명순',
}[sort.value]));
const totalCollectionPrice = computed(() => visibleCollections.value.reduce((total, collection) => total + (Number(collection.purchasePrice) || 0), 0));
const coverImageFor = (collection: VinylCollection) => collection.coverImageDataUrl || collection.discogsCoverImageUrl || collection.images[0] || '';
const collectionRoute = (id: string) => `/app/collection/${id}`;
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
  const displayPulledIndex = pulledIndex >= 0 ? pulledIndex : (items.length > 0 ? 0 : -1);
  return {
    index,
    items,
    pulledIndex: displayPulledIndex,
    pulled: displayPulledIndex >= 0 ? items[displayPulledIndex] : null,
    previous: displayPulledIndex > 0 ? items[displayPulledIndex - 1] : null,
    next: displayPulledIndex >= 0 && displayPulledIndex < items.length - 1 ? items[displayPulledIndex + 1] : null,
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
  '--slot-shift': shouldShiftSpineForPulled(rowIndex, itemIndex) ? `-${shelfPullShiftRem}rem` : '0rem',
  zIndex: itemIndex + 1,
});
const pulledJacketStyle = (pulledIndex: number) => ({
  '--pull-left': `${shelfPullStartInsetRem + Math.max(0, pulledIndex) * shelfSlotStepRem}rem`,
});
const pulledIndexForRow = (rowIndex: number) => {
  const items = shelfRows.value[rowIndex] || [];
  const storedIndex = items.findIndex(collection => collection.id === pulledByRow.value[rowIndex]);
  return storedIndex >= 0 ? storedIndex : (items.length > 0 ? 0 : -1);
};
const shouldShiftSpineForPulled = (rowIndex: number, itemIndex: number) => {
  const pulledIndex = pulledIndexForRow(rowIndex);
  return pulledIndex > 0 && itemIndex < pulledIndex;
};
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
const resetBrowse = () => {
  query.value = '';
  sort.value = 'recent';
};
</script>

<style scoped>
.collection-page {
  background:
    radial-gradient(circle at 10% 0%, rgba(132, 82, 42, 0.16), transparent 22rem),
    linear-gradient(180deg, #f7f1e8 0%, #eee4d8 54%, #f6f1ea 100%);
}

:global(.dark) .collection-page {
  background:
    radial-gradient(circle at 10% 0%, rgba(166, 111, 63, 0.16), transparent 22rem),
    linear-gradient(180deg, #2a1a12 0%, #342217 58%, #2d1d14 100%);
}

.shelf-stack {
  display: grid;
  gap: 1rem;
}

.shelf-display-row {
  display: grid;
  gap: 0.55rem;
}

.lp-position-strip {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.45rem;
}

.lp-position-item {
  min-width: 0;
  border: 1px solid rgba(132, 99, 63, 0.24);
  border-radius: 0.55rem;
  background: rgba(255, 250, 242, 0.82);
  padding: 0.55rem 0.6rem;
  text-align: left;
  box-shadow: 0 7px 14px rgba(93, 61, 34, 0.06);
}

.lp-position-item span,
.lp-position-item strong {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lp-position-item span {
  color: #8a6240;
  font-size: 0.66rem;
  font-weight: 750;
}

.lp-position-item strong {
  margin-top: 0.16rem;
  color: #3f2617;
  font-size: 0.76rem;
  font-weight: 760;
}

.lp-position-item.is-current {
  border-color: rgba(112, 67, 38, 0.56);
  background: #704326;
}

.lp-position-item.is-current span,
.lp-position-item.is-current strong {
  color: #fff7ed;
}

.lp-position-item:disabled {
  opacity: 0.48;
}

:global(.dark) .lp-position-item {
  border-color: #684831;
  background: rgba(58, 39, 27, 0.92);
}

:global(.dark) .lp-position-item span {
  color: #d9c0a7;
}

:global(.dark) .lp-position-item strong {
  color: #fff1dc;
}

:global(.dark) .lp-position-item.is-current {
  border-color: #d09a66;
  background: #5a3d2a;
}

.shelf-row {
  --slot-step: 1.12rem;
  --slot-width: 0.76rem;
  --slot-height: 9.65rem;
  --pull-gap: 0.65rem;
  --pull-start: 0.16rem;
  --pull-reserve: calc(var(--slot-height) + var(--pull-gap) + var(--pull-start));
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
  top: 0.58rem;
  left: var(--pull-left);
  z-index: 80;
  width: var(--slot-height);
  aspect-ratio: 1;
  border-radius: 0.36rem;
  border: 1px solid rgba(255, 255, 255, 0.82);
  background: rgba(255, 255, 255, 0.78);
  box-shadow: 0 18px 24px rgba(72, 48, 28, 0.28), 12px 0 18px rgba(62, 39, 23, 0.14);
  overflow: hidden;
  text-align: left;
  clip-path: inset(0 0 0 0 round 0.36rem);
  transform: translateX(0);
  transform-origin: 100% 50%;
  will-change: opacity, transform, clip-path;
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
  overflow: hidden;
  min-height: 10.8rem;
  padding: 0.58rem 0.25rem 1.15rem var(--pull-reserve);
  touch-action: pan-y;
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
  transform: translateX(var(--slot-shift, 0rem)) translateY(0);
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
  opacity: 0;
  pointer-events: none;
  transform: translateX(var(--slot-shift, 0rem)) translateY(-0.12rem);
}

.spine-record.is-pulled > * {
  opacity: 0;
}

.spine-record.is-pulled .jacket-edge {
  box-shadow: 0 0 0 2px rgba(227, 173, 101, 0.55), 0 13px 16px rgba(54, 34, 20, 0.22);
}

.pull-left-enter-active,
.pull-left-leave-active {
  transition: opacity 150ms ease, transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1), clip-path 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.pull-left-enter-from {
  opacity: 0;
  clip-path: inset(0 0 0 92% round 0.36rem);
  transform: scaleX(0.08);
}

.pull-left-leave-to {
  opacity: 0;
  clip-path: inset(0 0 0 92% round 0.36rem);
  transform: scaleX(0.08);
}

@media (hover: hover) {
  .spine-record:hover {
    transform: translateX(var(--slot-shift, 0rem)) translateY(-0.18rem);
  }

  .spine-record.is-pulled:hover {
    transform: translateX(var(--slot-shift, 0rem)) translateY(-0.12rem);
  }
}

@media (max-width: 420px) {
  .shelf-row {
    min-height: 12.35rem;
    padding-inline: 0.62rem;
  }

  .pulled-jacket {
    top: 0.58rem;
  }

  .spine-rack {
    min-height: 10.7rem;
    padding-right: 0.1rem;
    padding-left: var(--pull-reserve);
  }

}
</style>
