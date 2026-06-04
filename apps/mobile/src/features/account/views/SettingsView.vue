<template>
  <div class="size-full bg-gray-50 dark:bg-neutral-950 overflow-y-auto">
    <header class="bg-white dark:bg-neutral-900 px-4 py-4 border-b dark:border-neutral-800 sticky top-0 z-10">
      <div class="flex items-center gap-2">
        <button class="p-2" @click="router.back()">
          <ArrowLeft :size="24" />
        </button>
        <h1 class="text-2xl">설정</h1>
      </div>
    </header>

    <main class="p-4 space-y-4 pb-24">
      <section class="bg-white dark:bg-neutral-900 rounded-lg border dark:border-neutral-800 p-4 space-y-4">
        <div class="flex items-center gap-3">
          <UserRound :size="20" class="text-blue-600" />
          <h2 class="text-lg">프로필</h2>
        </div>
        <div>
          <label class="block text-sm mb-2">닉네임</label>
          <input v-model="profileForm.username" class="w-full px-4 py-3 border dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-950" placeholder="닉네임" />
        </div>
        <div>
          <label class="block text-sm mb-2">선호 장르</label>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="genre in genres"
              :key="genre"
              :class="[
                'px-3 py-2 rounded-full text-sm border',
                profileForm.genres.includes(genre)
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white dark:bg-neutral-950 dark:border-neutral-700 text-gray-700 dark:text-gray-200'
              ]"
              @click="toggleGenre(genre)"
            >
              {{ genre }}
            </button>
          </div>
        </div>
        <button
          class="w-full py-3 bg-blue-600 text-white rounded-lg disabled:bg-gray-300"
          :disabled="profileSaving"
          @click="saveProfile"
        >
          {{ profileSaving ? '저장 중...' : '임시 저장' }}
        </button>
        <p v-if="profileMessage" :class="['text-sm', profileSavedToDb ? 'text-green-600' : 'text-amber-600']">{{ profileMessage }}</p>
      </section>

      <section class="bg-white dark:bg-neutral-900 rounded-lg border dark:border-neutral-800 p-4 space-y-3">
        <div class="flex items-center gap-3">
          <Palette :size="20" class="text-blue-600" />
          <h2 class="text-lg">화면 모드</h2>
        </div>
        <div class="grid grid-cols-3 gap-2">
          <button
            v-for="option in themeOptions"
            :key="option.value"
            :class="[
              'py-3 rounded-lg border text-sm',
              store.settings.theme === option.value ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-neutral-950 dark:border-neutral-700'
            ]"
            @click="store.setTheme(option.value)"
          >
            {{ option.label }}
          </button>
        </div>
      </section>

      <section class="bg-white dark:bg-neutral-900 rounded-lg border dark:border-neutral-800 p-4 space-y-3">
        <div class="flex items-center gap-3">
          <Bell :size="20" class="text-blue-600" />
          <h2 class="text-lg">알림</h2>
        </div>
        <SettingSwitch label="채팅 알림" description="새 메시지가 오면 알려줍니다." :model-value="store.settings.notifications.chat" @update:model-value="value => updateNotifications({ chat: value })" />
        <SettingSwitch label="가격 제안 알림" description="구매자가 가격을 제안하면 알려줍니다." :model-value="store.settings.notifications.offers" @update:model-value="value => updateNotifications({ offers: value })" />
        <SettingSwitch label="희귀반 알림" description="관심 장르의 희귀 LP가 등록되면 알려줍니다." :model-value="store.settings.notifications.rareListing" @update:model-value="value => updateNotifications({ rareListing: value })" />
      </section>

      <section class="bg-white dark:bg-neutral-900 rounded-lg border dark:border-neutral-800 p-4 space-y-4">
        <div class="flex items-center gap-3">
          <Handshake :size="20" class="text-blue-600" />
          <h2 class="text-lg">거래</h2>
        </div>
        <div>
          <label class="block text-sm mb-2">기본 거래 지역</label>
          <input v-model="defaultLocation" class="w-full px-4 py-3 border dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-950" placeholder="예: 서울 강남구" @change="saveTradeSettings" />
        </div>
        <SettingSwitch label="가격 제안 허용" description="구매자가 판매가보다 낮은 가격을 제안할 수 있습니다." :model-value="store.settings.trade.allowOffers" @update:model-value="value => updateTrade({ allowOffers: value })" />
        <div>
          <div class="flex items-center justify-between mb-2">
            <label class="text-sm">최소 제안가</label>
            <span class="text-sm text-blue-600">판매가의 {{ minimumOfferRate }}%</span>
          </div>
          <input v-model.number="minimumOfferRate" type="range" min="50" max="100" step="5" class="w-full" @change="saveTradeSettings" />
        </div>
      </section>

      <section class="bg-white dark:bg-neutral-900 rounded-lg border dark:border-neutral-800 p-4 space-y-3">
        <div class="flex items-center gap-3">
          <BadgeCheck :size="20" class="text-blue-600" />
          <h2 class="text-lg">인증 상태</h2>
        </div>
        <div class="rounded-lg bg-green-50 dark:bg-green-950 p-3">
          <p class="text-xs text-green-700 dark:text-green-300 mb-1">이메일</p>
          <p>{{ store.user.emailVerified ? '인증 완료' : '미인증' }}</p>
        </div>
      </section>

      <button class="w-full py-4 bg-red-600 text-white rounded-xl" @click="logout">로그아웃</button>
    </main>
  </div>
</template>

<script setup lang="ts">
import { defineComponent, h, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ArrowLeft, BadgeCheck, Bell, Handshake, Palette, UserRound } from 'lucide-vue-next';
import { useAppStore, type AppSettings, type ThemeMode } from '@/shared/stores/appStore';

const SettingSwitch = defineComponent({
  props: {
    label: { type: String, required: true },
    description: { type: String, required: true },
    modelValue: { type: Boolean, required: true },
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    return () => h('div', { class: 'flex items-center justify-between gap-3 rounded-lg bg-gray-50 dark:bg-neutral-800 p-3' }, [
      h('div', { class: 'min-w-0' }, [
        h('p', { class: 'text-sm' }, props.label),
        h('p', { class: 'text-xs text-gray-500 dark:text-gray-400 mt-0.5' }, props.description),
      ]),
      h('button', {
        class: ['relative w-12 h-7 rounded-full transition-colors flex-shrink-0', props.modelValue ? 'bg-blue-600' : 'bg-gray-300 dark:bg-neutral-700'],
        onClick: () => emit('update:modelValue', !props.modelValue),
        'aria-label': props.label,
      }, [
        h('span', { class: ['absolute left-1 top-1 w-5 h-5 bg-white rounded-full transition-transform shadow-sm', props.modelValue ? 'translate-x-5' : 'translate-x-0'] }),
      ]),
    ]);
  },
});

const router = useRouter();
const store = useAppStore();
const genres = ['재즈', '록', '팝', '힙합', '클래식', 'R&B/소울', '일렉트로닉', '펑크'];
const themeOptions: { label: string; value: ThemeMode }[] = [
  { label: '라이트', value: 'light' },
  { label: '다크', value: 'dark' },
  { label: '시스템', value: 'system' },
];

const profileForm = reactive({
  username: store.user.username,
  genres: [...store.user.genres],
});
const profileMessage = ref('');
const profileSaving = ref(false);
const profileSavedToDb = ref(false);
const defaultLocation = ref(store.settings.trade.defaultLocation);
const minimumOfferRate = ref(store.settings.trade.minimumOfferRate);

const toggleGenre = (genre: string) => {
  if (profileForm.genres.includes(genre)) {
    profileForm.genres = profileForm.genres.filter(item => item !== genre);
    return;
  }
  if (profileForm.genres.length < 5) profileForm.genres = [...profileForm.genres, genre];
};

const saveProfile = async () => {
  if (profileSaving.value) return;
  profileSaving.value = true;
  const result = await store.saveUserProfileToServer({
    username: profileForm.username.trim() || store.user.username,
    genres: profileForm.genres,
  });
  profileSavedToDb.value = result.persisted;
  profileMessage.value = result.message;
  profileSaving.value = false;
  setTimeout(() => { profileMessage.value = ''; }, 2200);
};

const updateNotifications = (notifications: Partial<AppSettings['notifications']>) => store.updateSettings({ notifications });
const updateTrade = (trade: Partial<AppSettings['trade']>) => store.updateSettings({ trade });
const saveTradeSettings = () => updateTrade({ defaultLocation: defaultLocation.value, minimumOfferRate: minimumOfferRate.value });
const logout = () => {
  store.logout();
  router.push('/auth/login');
};
</script>
