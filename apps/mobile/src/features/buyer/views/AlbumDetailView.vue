<template>
  <div v-if="album" class="size-full bg-white flex flex-col">
    <header class="px-4 py-4 flex items-center justify-between border-b sticky top-0 bg-white z-10">
      <button class="p-2" @click="goBackOr(router, '/app')"><ArrowLeft :size="24" /></button>
      <div class="flex gap-2">
        <button class="p-2" aria-label="신고" @click="router.push(`/report/album/${album.id}`)"><Flag :size="22" /></button>
      </div>
    </header>

    <div class="flex-1 overflow-y-auto">
      <div class="relative">
        <VinylCover :src="album.images[currentImageIndex]" :alt="album.title" class="w-full aspect-square object-cover" />
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
          <button v-if="showMarketplaceMetrics" class="p-2" aria-label="찜하기" @click="store.toggleFavorite(album.id)">
            <Heart :size="28" :class="store.favorites.includes(album.id) ? 'fill-red-500 text-red-500' : 'text-gray-400'" />
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

        <div v-if="album.isRare" class="flex gap-2">
          <span v-if="album.isFirstPress" class="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm">초반 추정</span>
          <span class="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm">희귀반</span>
        </div>

        <section class="border-t pt-4">
          <h2 class="text-lg mb-2">상세 설명</h2>
          <p class="text-gray-700 whitespace-pre-line">{{ album.description }}</p>
        </section>

        <section class="border-t pt-4">
          <div class="bg-blue-50 p-4 rounded-lg">
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-lg">Vinyl-Check 감정</h2>
            <div class="flex items-center gap-1 text-blue-600"><BadgeCheck :size="18" /><span class="text-sm">인증됨</span></div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div><p class="text-sm text-gray-600 mb-1">음질 등급</p><p class="text-2xl">{{ album.audioGrade }}</p></div>
            <div><p class="text-sm text-gray-600 mb-1">음질 점수</p><p class="text-2xl text-blue-600">{{ album.audioScore }}점</p></div>
            <div><p class="text-sm text-gray-600 mb-1">판본</p><p class="text-lg">{{ album.isFirstPress ? '초반 추정' : '확인 필요' }}</p></div>
            <div><p class="text-sm text-gray-600 mb-1">자켓 상태</p><p class="text-lg">{{ jacketGrade }}</p></div>
            <div><p class="text-sm text-gray-600 mb-1">판면 점수</p><p class="text-lg">{{ surfaceScore ? `${surfaceScore}점` : '확인 필요' }}</p></div>
            <div><p class="text-sm text-gray-600 mb-1">스크래치 후보</p><p class="text-lg">{{ scratchCountText }}</p></div>
          </div>
          </div>
        </section>

        <section class="border-t pt-4">
          <div class="bg-neutral-900 text-white p-4 rounded-lg">
          <div class="flex items-center justify-between gap-3 mb-3">
            <div class="flex items-center gap-3 min-w-0">
              <div class="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0"><Volume2 :size="20" /></div>
              <div class="min-w-0">
                <h2 class="text-lg">LP 샘플</h2>
                <p class="text-sm text-white/70 truncate">{{ sampleDescription }}</p>
              </div>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <button
              v-for="sample in sampleItems"
              :key="sample.kind"
              class="rounded-lg bg-white/10 px-3 py-3 text-left active:bg-white/20 disabled:opacity-60"
              :disabled="Boolean(samplePlaying)"
              @click="playSample(sample.kind)"
            >
              <span class="flex items-center gap-2 text-sm font-medium"><Play :size="15" />{{ sample.label }}</span>
              <span class="block text-xs text-white/60 mt-1 truncate">{{ sample.name }} · {{ sample.durationSeconds }}초</span>
            </button>
          </div>
          <p v-if="samplePlaying" class="text-xs text-white/60 mt-3">{{ samplePlaying === 'good' ? '좋은 구간 샘플 재생 중' : '안 좋은 구간 샘플 재생 중' }}</p>
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
          <p class="text-sm text-gray-600">시세: {{ album.priceRange.min.toLocaleString() }}원 ~ {{ album.priceRange.max.toLocaleString() }}원</p>
          <p v-if="album.price < album.priceRange.min" class="text-sm text-green-600 mt-1">시세보다 낮습니다</p>
          <p v-if="album.price > album.priceRange.max" class="text-sm text-orange-600 mt-1">시세보다 높습니다</p>
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

        <div class="border-t pt-4 flex items-center gap-2 text-gray-600"><MapPin :size="18" /><span>{{ album.location }}</span></div>
      </div>
    </div>

    <div v-if="isOwnListing" class="border-t p-4 grid grid-cols-2 gap-2">
      <button class="py-3 border border-gray-300 text-gray-800 rounded-lg flex items-center justify-center gap-1 text-sm" @click="router.push(`/sell/${album.id}/edit`)">
        <Pencil :size="18" />수정
      </button>
      <button class="py-3 border border-blue-600 text-blue-600 rounded-lg flex items-center justify-center gap-1 text-sm" @click="router.push('/transaction/offers/received')">
        <ClipboardList :size="18" />제안
      </button>
      <button class="py-3 border border-blue-600 text-blue-600 rounded-lg flex items-center justify-center gap-1 text-sm" @click="router.push(`/transaction/comments/${album.id}`)">
        <MessageCircle :size="18" />답변
      </button>
      <button class="py-3 bg-blue-600 text-white rounded-lg flex items-center justify-center gap-1 text-sm" @click="router.push('/transaction/offers/received')">
        <MessageCircle :size="18" />채팅
      </button>
      <button class="col-span-2 py-3 border border-red-300 text-red-600 rounded-lg flex items-center justify-center gap-1 text-sm" :disabled="isHidingListing" @click="hideCurrentListing">
        {{ isHidingListing ? '내리는 중' : '게시글 내리기' }}
      </button>
    </div>
    <div v-else class="border-t p-4 flex gap-3">
      <button class="flex-1 py-3 border border-blue-600 text-blue-600 rounded-lg" @click="router.push(`/transaction/comments/${album.id}`)">문의하기</button>
      <button class="flex-1 py-3 bg-blue-600 text-white rounded-lg flex items-center justify-center gap-2" @click="openSellerChat">
        <MessageCircle :size="20" />채팅하기
      </button>
    </div>
  </div>
  <div v-else>앨범을 찾을 수 없습니다</div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowLeft, BadgeCheck, ClipboardList, Eye, Flag, Heart, MapPin, MessageCircle, Pencil, Play, Volume2 } from 'lucide-vue-next';
import { getActiveTrade } from '@/features/transaction/services/tradeState';
import { useAppStore } from '@/shared/stores/appStore';
import { findAlbumById } from '@/features/buyer/services/albumLookup';
import { makeOneToOneChatId } from '@/features/transaction/services/chatClient';
import { goBackOr } from '@/shared/services/navigation';
import VinylCover from '@/shared/components/VinylCover.vue';

const route = useRoute();
const router = useRouter();
const store = useAppStore();
const album = computed(() => findAlbumById(store, route.params.id));
const currentImageIndex = ref(0);
const samplePlaying = ref<'good' | 'noisy' | null>(null);
const isHidingListing = ref(false);
let sampleAudio: HTMLAudioElement | null = null;
const isOwnListing = computed(() => Boolean(album.value && (route.query.mine === 'true' || album.value.seller.id === store.user.id)));
const activeTrade = computed(() => album.value ? getActiveTrade(album.value.id) : undefined);
const isCompletedTrade = computed(() => activeTrade.value?.status === 'completed');
const showMarketplaceMetrics = computed(() => !isOwnListing.value && !isCompletedTrade.value);
const analysisReport = computed(() => album.value?.analysisReport as Record<string, unknown> | undefined);
const recordSurface = computed(() => analysisReport.value?.recordSurface as { surfaceScore?: number; scratchCount?: number } | undefined);
const jacketReport = computed(() => analysisReport.value?.jacket as { jacketGrade?: string; jacketScore?: number } | undefined);
const jacketGrade = computed(() => jacketReport.value?.jacketGrade || album.value?.jacketGrade || (jacketReport.value?.jacketScore ? `${jacketReport.value.jacketScore}점` : '확인 필요'));
const surfaceScore = computed(() => recordSurface.value?.surfaceScore || 0);
const scratchCountText = computed(() => typeof recordSurface.value?.scratchCount === 'number' ? `${recordSurface.value.scratchCount}개` : '확인 필요');
const openSellerChat = () => {
  if (!album.value) return;
  const chatId = makeOneToOneChatId(album.value.id, store.user.id, album.value.seller.id);
  router.push({
    path: `/transaction/chat/${chatId}`,
    query: {
      listingId: album.value.id,
      recipientId: album.value.seller.id,
      recipientName: album.value.seller.name,
    },
  });
};
const hideCurrentListing = async () => {
  if (!album.value || isHidingListing.value) return;
  if (!confirm('이 판매글을 목록에서 내릴까요?')) return;
  isHidingListing.value = true;
  const result = await store.hideListing(album.value.id);
  isHidingListing.value = false;
  alert(result.message);
  if (result.ok) router.push('/app/profile');
};
const sampleItems = computed(() => {
  const samples = album.value?.audioSamples || {};
  const goodStart = Number(samples.good?.startSeconds || 0);
  const goodEnd = Number(samples.good?.endSeconds || samples.good?.durationSeconds || 20);
  const noisyStart = Number(samples.noisy?.startSeconds || 0);
  const noisyEnd = Number(samples.noisy?.endSeconds || samples.noisy?.durationSeconds || 15);
  return [
    {
      kind: 'good' as const,
      label: '좋은 구간',
      name: samples.good ? '좋은 구간 녹음' : `${album.value?.title || 'LP'} 안정 구간`,
      dataUrl: samples.good?.dataUrl,
      startSeconds: goodStart,
      endSeconds: goodEnd,
      durationSeconds: Math.max(1, goodEnd - goodStart),
    },
    {
      kind: 'noisy' as const,
      label: '안 좋은 구간',
      name: samples.noisy ? '안 좋은 구간 녹음' : `${album.value?.title || 'LP'} 도입부`,
      dataUrl: samples.noisy?.dataUrl,
      startSeconds: noisyStart,
      endSeconds: noisyEnd,
      durationSeconds: Math.max(1, noisyEnd - noisyStart),
    },
  ];
});
const sampleDescription = computed(() => album.value?.audioSamples?.good || album.value?.audioSamples?.noisy
  ? '판매자가 등록한 음질 샘플'
  : `${album.value?.title || 'LP'} 미리듣기 샘플`);

onMounted(() => {
  if (!album.value) void store.loadListingsFromServer();
});

const stopSample = () => {
  if (sampleAudio) {
    sampleAudio.pause();
    sampleAudio.ontimeupdate = null;
    sampleAudio.onended = null;
    sampleAudio = null;
  }
  samplePlaying.value = null;
};

const playSample = (kind: 'good' | 'noisy') => {
  if (samplePlaying.value || !album.value) return;
  const savedSample = sampleItems.value.find(item => item.kind === kind);
  if (savedSample?.dataUrl) {
    stopSample();
    sampleAudio = new Audio(savedSample.dataUrl);
    sampleAudio.currentTime = savedSample.startSeconds;
    samplePlaying.value = kind;
    sampleAudio.ontimeupdate = () => {
      if (sampleAudio && sampleAudio.currentTime >= savedSample.endSeconds) stopSample();
    };
    sampleAudio.onended = stopSample;
    void sampleAudio.play().catch(stopSample);
    return;
  }

  const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) return;
  const context = new AudioContextCtor();
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.08);
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 4);
  gain.connect(context.destination);

  const oscillator = context.createOscillator();
  oscillator.type = kind === 'good' ? 'sine' : 'triangle';
  oscillator.frequency.setValueAtTime(album.value.genre === '재즈' ? 392 : 330, context.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(kind === 'good' ? 523 : 262, context.currentTime + 3.6);
  oscillator.connect(gain);
  oscillator.start();
  oscillator.stop(context.currentTime + 4);

  if (kind === 'noisy') {
    const buffer = context.createBuffer(1, context.sampleRate * 4, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (i % 9000 < 80 ? 0.2 : 0.018);
    }
    const noise = context.createBufferSource();
    const noiseGain = context.createGain();
    noiseGain.gain.value = 0.18;
    noise.buffer = buffer;
    noise.connect(noiseGain);
    noiseGain.connect(gain);
    noise.start();
    noise.stop(context.currentTime + 4);
  }

  samplePlaying.value = kind;
  oscillator.onended = () => {
    samplePlaying.value = null;
    context.close();
  };
};

onBeforeUnmount(stopSample);
</script>
