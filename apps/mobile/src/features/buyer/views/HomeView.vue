<template>
  <div class="size-full bg-gray-50 overflow-y-auto">
    <header class="bg-white px-4 py-4 border-b sticky top-0 z-10">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h1 class="text-2xl">Vinyl-Check</h1>
          <p class="text-sm text-gray-500">LP 감정 결과로 더 믿고 거래하세요</p>
        </div>
        <button class="p-2 relative" aria-label="알림" @click="router.push('/app/notifications')">
          <Bell :size="24" />
          <span class="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
        </button>
      </div>
      <div class="w-full flex items-center gap-2 px-4 py-3 bg-gray-100 rounded-lg">
        <Search :size="20" class="text-gray-400" />
        <input
          v-model="query"
          type="text"
          class="flex-1 bg-transparent outline-none"
          placeholder="앨범명, 아티스트, 카탈로그 번호 검색"
        />
        <button v-if="query" class="p-1" aria-label="검색어 지우기" @click="query = ''">
          <X :size="18" class="text-gray-400" />
        </button>
      </div>
    </header>

    <main class="pb-5">
      <section v-if="query" class="px-4 py-3">
        <p class="text-sm text-gray-600">"{{ query }}" 검색 결과 {{ filteredAlbums.length }}개</p>
      </section>

      <div v-if="query && filteredAlbums.length === 0" class="px-4 py-16 text-center">
        <p class="text-gray-700">검색 결과가 없습니다</p>
        <p class="text-sm text-gray-400 mt-2">카탈로그 번호나 아티스트명으로 다시 검색해 보세요.</p>
      </div>

      <template v-else>
        <ProductRail title="추천 감정 매물" more-to="/app/search/results?sort=recommended" :albums="recommendedAlbums" />
        <ProductRail title="최근 등록" more-to="/app/search/results?sort=recent" :albums="recentAlbums" muted />
        <ProductRail title="희귀반/초반" more-to="/app/search/results?rare=true" :albums="rareAlbums" />
        <ProductRail title="전체 상품" more-to="/app/search/results" :albums="filteredAlbums" muted />
      </template>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, onMounted, ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { BadgeCheck, Bell, Heart, Search, UserRoundCheck, X } from 'lucide-vue-next';
import { useAppStore } from '@/shared/stores/appStore';
import VinylCover from '@/shared/components/VinylCover.vue';
import type { Album } from '@/shared/models/market';

const store = useAppStore();
const router = useRouter();
const query = ref('');

onMounted(() => {
  void store.loadListingsFromServer();
});

const filteredAlbums = computed(() => {
  const normalized = query.value.trim().toLowerCase();
  if (!normalized) return store.listings;
  return store.listings.filter(album =>
    [album.title, album.artist, album.genre, album.catalogNumber, album.location, album.audioGrade]
      .some(value => value.toLowerCase().includes(normalized))
  );
});

const recommendedAlbums = computed(() => filteredAlbums.value.filter(album => album.audioScore >= 85 || album.isFirstPress).slice(0, 6));
const recentAlbums = computed(() => filteredAlbums.value.slice(0, 6));
const rareAlbums = computed(() => filteredAlbums.value.filter(album => album.isRare));

const ProductRail = defineComponent({
  props: {
    title: { type: String, required: true },
    moreTo: { type: String, required: true },
    albums: { type: Array as () => Album[], required: true },
    muted: { type: Boolean, default: false },
  },
  setup(props) {
    const openAlbum = (id: string) => router.push(`/app/album/${id}`);
    const isOwnListing = (album: Album) => album.ownedByMe || album.seller.id === store.user.id;
    const toggleFavorite = (event: MouseEvent, id: string) => {
      event.stopPropagation();
      store.toggleFavorite(id);
    };

    return () => h('section', { class: ['py-4', props.muted ? 'bg-white' : ''] }, [
      h('div', { class: 'px-4 mb-3 flex items-center justify-between' }, [
        h('h2', { class: 'text-lg' }, props.title),
        h(RouterLink, { to: props.moreTo, class: 'text-sm text-blue-600' }, () => '더보기'),
      ]),
      h('div', { class: 'overflow-x-auto px-4' }, [
        h('div', { class: 'flex gap-3 pb-2' }, props.albums.map(album =>
          h('article', {
            key: album.id,
            class: 'flex-shrink-0 w-40 cursor-pointer',
            onClick: () => openAlbum(album.id),
          }, [
            h('div', { class: 'relative mb-2' }, [
              h(VinylCover, {
                src: album.images[0],
                alt: album.title,
                class: 'w-full aspect-square object-cover rounded-lg bg-gray-100',
              }),
              album.isRare
                ? h('span', { class: 'absolute top-2 left-2 px-2 py-1 bg-amber-500 text-white text-xs rounded' }, '희귀')
                : null,
              isOwnListing(album)
                ? h('span', { class: 'absolute bottom-2 left-2 inline-flex items-center gap-1 px-2 py-1 bg-blue-600 text-white text-xs rounded shadow-sm' }, [
                  h(UserRoundCheck, { size: 12 }),
                  '내 상품',
                ])
                : null,
              h('button', {
                class: 'absolute top-2 right-2 p-1.5 bg-white/90 rounded-full',
                'aria-label': '찜하기',
                onClick: (event: MouseEvent) => toggleFavorite(event, album.id),
              }, [
                h(Heart, {
                  size: 16,
                  class: store.favorites.includes(album.id) ? 'fill-red-500 text-red-500' : 'text-gray-600',
                }),
              ]),
            ]),
            h('p', { class: 'text-sm truncate' }, album.title),
            h('p', { class: 'text-xs text-gray-500 truncate' }, album.artist),
            h('p', { class: 'text-sm mt-1' }, `${album.price.toLocaleString()}원`),
            h('div', { class: 'flex items-center gap-1 mt-1' }, [
              h('span', { class: 'inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded' }, [
                h(BadgeCheck, { size: 12 }),
                `${album.audioGrade} ${album.audioScore}점`,
              ]),
            ]),
          ])
        )),
      ]),
    ]);
  },
});
</script>
