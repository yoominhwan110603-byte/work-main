<template>
  <div class="size-full overflow-y-auto bg-gray-50 dark:bg-slate-950">
    <header class="sticky top-0 z-10 border-b bg-white px-4 py-4 dark:bg-slate-900">
      <div class="mb-4 flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-semibold">Vinyl-Check</h1>
          <p class="text-sm text-gray-500">원하는 판본과 상태를 바로 비교하세요</p>
        </div>
        <button class="relative p-2" aria-label="알림" @click="router.push('/app/notifications')">
          <Bell :size="24" />
          <span v-if="store.unreadNotificationCount > 0" class="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] leading-none text-white">
            {{ store.unreadNotificationCount > 99 ? '99+' : store.unreadNotificationCount }}
          </span>
        </button>
      </div>

      <div class="flex w-full items-center gap-2">
        <div class="flex min-h-12 min-w-0 flex-1 items-center gap-2 rounded-lg bg-gray-100 px-4">
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
        <button class="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700" aria-label="필터" @click="openSearchFilters">
          <SlidersHorizontal :size="19" />
        </button>
        <button class="flex h-12 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-medium text-gray-700" @click="openRecentSearch">
          최신순
        </button>
      </div>
    </header>

    <main class="pb-5">
      <section v-if="query" class="space-y-3 px-4 py-4">
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

        <div v-if="searchedGroups.length === 0" class="rounded-lg border bg-white p-8 text-center text-gray-500 dark:border-slate-800 dark:bg-slate-900">
          <p>검색 결과가 없습니다</p>
          <p class="mt-2 text-sm text-gray-400">앨범 이름이나 아티스트명을 바꿔보세요</p>
        </div>
      </section>

      <template v-else>
        <section class="space-y-3 px-4 py-5">
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
            :reason="recommendReason(group)"
            action-label="판본 보기"
            @open="openAlbumGroup(group)"
          />

          <div v-if="preferenceGroups.length === 0" class="rounded-lg border bg-white p-8 text-center text-gray-500 dark:border-slate-800 dark:bg-slate-900">
            표시할 판매 상품이 아직 없습니다.
          </div>
        </section>

      </template>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, onMounted, ref, type PropType } from 'vue';
import { useRouter } from 'vue-router';
import { Bell, ChevronRight, Search, SlidersHorizontal, X } from 'lucide-vue-next';
import { groupListingsByAlbum, matchesAlbumTitle, type AlbumProductGroup } from '@/features/buyer/services/pressingCatalog';
import { useAppStore } from '@/shared/stores/appStore';
import VinylCover from '@/shared/components/VinylCover.vue';
import type { Album } from '@/shared/models/market';

const store = useAppStore();
const router = useRouter();
const query = ref('');

onMounted(() => {
  void store.loadListingsFromServer();
  void store.loadUnreadNotificationCount();
});

const normalize = (value: string) => value.trim().toLocaleLowerCase('ko-KR');
const albumTags = (album: Album) => Array.isArray(album.tags) ? album.tags.filter(Boolean) : [];
const preferenceGenres = computed(() => (store.user.genres || []).map(normalize).filter(Boolean));
const preferenceSummary = computed(() => preferenceGenres.value.length
  ? `선호 장르: ${store.user.genres.join(', ')}`
  : '상태가 좋은 매물을 먼저 정렬했습니다.');

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
    + (album.isFirstPress ? 16 : 0)
    + (album.isRare ? 12 : 0)
    + Math.min(12, Number(album.views || 0) / 8);
};

const groupScore = (group: AlbumProductGroup) => Math.max(...group.pressings.flatMap(pressing => pressing.listings).map(scoreAlbum), 0);

const searchedGroups = computed(() => {
  const normalized = normalize(query.value);
  if (!normalized) return [];
  return groupListingsByAlbum(store.listings.filter(album => matchesAlbumTitle(album, normalized)))
    .sort((left, right) => groupScore(right) - groupScore(left) || right.listingCount - left.listingCount)
    .slice(0, 12);
});

const preferenceGroups = computed(() => groupListingsByAlbum(store.listings)
  .sort((left, right) => groupScore(right) - groupScore(left) || right.listingCount - left.listingCount)
  .slice(0, 8));

const openAlbumGroup = (group: AlbumProductGroup) => {
  router.push({
    path: '/app/search/results',
    query: { q: group.title, albumKey: group.key },
  });
};

const openSearchResults = () => {
  router.push({ path: '/app/search', query: { q: query.value.trim() || undefined } });
};

const openSearchFilters = () => {
  router.push({ path: '/app/search', query: { q: query.value.trim() || undefined, filters: '1' } });
};

const openRecentSearch = () => {
  router.push({ path: '/app/search', query: { q: query.value.trim() || undefined, sort: 'recent' } });
};

const recommendReason = (group: AlbumProductGroup) => {
  const listings = group.pressings.flatMap(pressing => pressing.listings);
  const matchingGenre = listings.find(album => preferenceGenres.value.includes(normalize(album.genre || '')))?.genre;
  if (matchingGenre) return matchingGenre;
  if (listings.some(album => album.isFirstPress)) return '초반 추정 포함';
  if (listings.some(album => album.isRare)) return '희귀반 포함';
  return group.bestQualityLabel;
};

const priceLabel = (price: number) => price > 0 ? `${price.toLocaleString()}원부터` : '가격 확인';

const AlbumGroupButton = defineComponent({
  props: {
    group: { type: Object as PropType<AlbumProductGroup>, required: true },
    reason: { type: String, default: '' },
    actionLabel: { type: String, default: '보기' },
  },
  emits: ['open'],
  setup(props, { emit }) {
    return () => h('button', {
      type: 'button',
      class: 'w-full rounded-lg border border-gray-200 bg-white p-3 text-left shadow-sm active:bg-gray-50 dark:border-slate-800 dark:bg-slate-900',
      onClick: () => emit('open'),
    }, [
      h('div', { class: 'flex gap-3' }, [
        h(VinylCover, {
          src: props.group.coverImage,
          alt: props.group.title,
          class: 'h-24 w-24 shrink-0 rounded-lg bg-gray-100 object-cover',
        }),
        h('div', { class: 'min-w-0 flex-1' }, [
          h('div', { class: 'flex items-start justify-between gap-2' }, [
            h('div', { class: 'min-w-0' }, [
              h('h3', { class: 'truncate text-base font-semibold text-gray-950 dark:text-slate-100' }, props.group.title),
              h('p', { class: 'mt-1 truncate text-sm text-gray-500' }, props.group.artist),
            ]),
            h(ChevronRight, { size: 18, class: 'shrink-0 text-gray-400' }),
          ]),
          h('div', { class: 'mt-2 flex flex-wrap gap-1.5 text-xs' }, [
            props.reason ? h('span', { class: 'rounded bg-slate-100 px-2 py-1 text-slate-700' }, props.reason) : null,
            h('span', { class: 'rounded bg-blue-50 px-2 py-1 text-blue-700' }, `LP 판본 ${props.group.catalogCount}개`),
            h('span', { class: 'rounded bg-emerald-50 px-2 py-1 text-emerald-700' }, props.group.bestQualityLabel),
            h('span', { class: 'rounded bg-gray-100 px-2 py-1 text-gray-700' }, priceLabel(props.group.lowestPrice)),
          ]),
          h('p', { class: 'mt-2 truncate text-xs text-gray-500' }, `${props.actionLabel} · ${props.group.pressings.slice(0, 3).map(pressing => pressing.displayName).join(' · ') || 'LP 판본 정보 미상'}`),
        ]),
      ]),
    ]);
  },
});
</script>
