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
          <MapPin :size="20" class="text-blue-600" />
          <h2 class="text-lg">거주지역</h2>
        </div>
        <div>
          <label class="block text-sm mb-2">집주소</label>
          <div class="flex flex-col gap-2 sm:flex-row">
            <input v-model="homeAddress" class="min-w-0 flex-1 px-4 py-3 border dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-950" placeholder="예: 서울시 마포구 서교동" />
            <button
              type="button"
              class="rounded-lg border px-4 py-3 text-sm text-blue-600 disabled:text-gray-300 dark:border-neutral-700"
              :disabled="regionLocating"
              @click="applyCurrentLocationRegion"
            >
              {{ regionLocating ? '확인 중' : '현재 위치' }}
            </button>
          </div>
        </div>
        <div>
          <label class="block text-sm mb-2">기본 거래 지역</label>
          <input v-model="defaultLocation" class="w-full px-4 py-3 border dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-950" placeholder="예: 서울 마포구 서교동" @change="saveResidenceRegion" />
        </div>
        <p v-if="regionMessage" class="text-sm text-blue-600">{{ regionMessage }}</p>
      </section>

      <section class="bg-white dark:bg-neutral-900 rounded-lg border dark:border-neutral-800 p-4 space-y-3">
        <div class="flex items-center gap-3">
          <Bell :size="20" class="text-blue-600" />
          <h2 class="text-lg">알림</h2>
        </div>
        <SettingSwitch label="채팅 알림" description="새 메시지가 오면 알려줍니다." :model-value="store.settings.notifications.chat" @update:model-value="value => updateNotifications({ chat: value })" />
        <SettingSwitch label="가격 제안 알림" description="구매자가 가격을 제안하면 알려줍니다." :model-value="store.settings.notifications.offers" @update:model-value="value => updateNotifications({ offers: value })" />
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
import { ArrowLeft, BadgeCheck, Bell, MapPin, Palette, UserRound } from 'lucide-vue-next';
import { useAppStore, type AppSettings, type ThemeMode } from '@/shared/stores/appStore';
import { reverseLocationPointByRest } from '@/shared/services/staticMap';

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
const homeAddress = ref('');
const defaultLocation = ref(store.settings.trade.defaultLocation || '');
const regionMessage = ref('');
const regionLocating = ref(false);
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
const extractNeighborhood = (address: string) => {
  const tokens = address.replace(/[(),]/g, ' ').split(/\s+/).map(token => token.trim()).filter(Boolean);
  if (!tokens.length) return '';
  const city = tokens.find(token => /(특별시|광역시|시|도)$/.test(token)) || tokens[0];
  const district = tokens.find(token => /(구|군)$/.test(token)) || '';
  const neighborhood = tokens.find(token => /(동|읍|면|가)$/.test(token)) || '';
  return [city, district, neighborhood].filter(Boolean).join(' ');
};
const saveResidenceRegion = () => {
  store.updateSettings({ trade: { defaultLocation: defaultLocation.value.trim() } });
  regionMessage.value = defaultLocation.value.trim() ? `${defaultLocation.value.trim()}으로 설정했습니다.` : '기본 거래 지역을 비웠습니다.';
  setTimeout(() => { regionMessage.value = ''; }, 2200);
};
const applyHomeAddressRegion = () => {
  const region = extractResidenceRegion(homeAddress.value);
  if (!region) {
    regionMessage.value = '주소에서 시/동 정보를 찾지 못했습니다.';
    return;
  }
  defaultLocation.value = region;
  saveResidenceRegion();
};
const extractResidenceRegion = (address: string) => {
  const tokens = address.replace(/[(),]/g, ' ').split(/\s+/).map(token => token.trim()).filter(Boolean);
  if (!tokens.length) return '';
  const city = tokens.find(token => /(시|도|특별시|광역시)$/.test(token)) || tokens[0];
  const district = tokens.find(token => /(구|군|시)$/.test(token) && token !== city) || '';
  const neighborhood = tokens.find(token => /(동|읍|면|가|로)$/.test(token) && token !== city && token !== district) || '';
  return [city, district, neighborhood].filter(Boolean).join(' ');
};
const getCurrentPosition = () => new Promise<GeolocationPosition>((resolve, reject) => {
  if (!navigator.geolocation) {
    reject(new Error('이 기기에서 현재 위치를 사용할 수 없습니다.'));
    return;
  }
  navigator.geolocation.getCurrentPosition(resolve, reject, {
    enableHighAccuracy: true,
    timeout: 12000,
    maximumAge: 30000,
  });
});
const applyCurrentLocationRegion = async () => {
  if (regionLocating.value) return;
  regionLocating.value = true;
  regionMessage.value = '현재 위치를 확인하는 중입니다.';
  try {
    const position = await getCurrentPosition();
    const point = await reverseLocationPointByRest(position.coords.latitude, position.coords.longitude);
    const address = point?.addressName || `${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`;
    const region = extractResidenceRegion(address) || address;
    homeAddress.value = address;
    defaultLocation.value = region;
    saveResidenceRegion();
    regionMessage.value = `${region}으로 설정했습니다.`;
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? Number((error as GeolocationPositionError).code) : 0;
    regionMessage.value = code === 1
      ? '위치 권한이 거부되었습니다. 앱 설정에서 위치 권한을 허용해 주세요.'
      : error instanceof Error
        ? error.message
        : '현재 위치를 가져오지 못했습니다.';
  } finally {
    regionLocating.value = false;
  }
};
const logout = () => {
  store.logout();
  router.push('/auth/login');
};
</script>
