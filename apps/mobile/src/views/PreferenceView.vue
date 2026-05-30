<template>
  <div class="size-full bg-white flex flex-col">
    <main class="flex-1 px-6 py-8 overflow-y-auto">
      <div class="mb-8">
        <h1 class="text-3xl font-semibold mb-2">선호 장르를 골라 주세요</h1>
        <p class="text-gray-600">추천 매물과 알림에 사용합니다. 최대 5개까지 선택할 수 있습니다.</p>
      </div>
      <div class="grid grid-cols-2 gap-3 mb-8">
        <button
          v-for="genre in genres"
          :key="genre"
          :disabled="!selectedGenres.includes(genre) && selectedGenres.length >= 5"
          :class="[
            'p-4 rounded-lg border-2 flex items-center justify-between transition-all',
            selectedGenres.includes(genre) ? 'border-blue-600 bg-blue-50' : 'border-gray-200 active:border-gray-300',
            !selectedGenres.includes(genre) && selectedGenres.length >= 5 ? 'opacity-50' : '',
          ]"
          @click="toggleGenre(genre)"
        >
          <span :class="selectedGenres.includes(genre) ? 'text-blue-600' : 'text-gray-700'">{{ genre }}</span>
          <CheckCircle2 v-if="selectedGenres.includes(genre)" :size="20" class="text-blue-600" />
          <Circle v-else :size="20" class="text-gray-300" />
        </button>
      </div>
      <p class="text-sm text-gray-500 text-center mb-4">{{ selectedGenres.length }}/5 선택됨</p>
      <p v-if="message" class="text-sm text-red-600 text-center">{{ message }}</p>
    </main>
    <div class="px-6 pb-8 space-y-3">
      <button class="w-full bg-blue-600 text-white py-4 rounded-xl disabled:bg-gray-300" :disabled="selectedGenres.length === 0 || isSubmitting" @click="complete()">
        {{ isSubmitting ? '계정 생성 중' : '완료' }}
      </button>
      <button class="w-full text-gray-600 py-2" :disabled="isSubmitting" @click="complete(true)">건너뛰기</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { CheckCircle2, Circle } from 'lucide-vue-next';
import { useAppStore } from '../stores/appStore';

const router = useRouter();
const store = useAppStore();
const selectedGenres = ref<string[]>([]);
const message = ref('');
const isSubmitting = ref(false);
const genres = ['재즈', '록', '팝', '힙합', '클래식', 'R&B/소울', '일렉트로닉', '펑크/컨트리', '레게', '메탈', '블루스', '월드뮤직'];

const toggleGenre = (genre: string) => {
  selectedGenres.value = selectedGenres.value.includes(genre)
    ? selectedGenres.value.filter(item => item !== genre)
    : [...selectedGenres.value, genre];
};

const complete = async (skip = false) => {
  if (isSubmitting.value) return;
  isSubmitting.value = true;
  message.value = '';
  const draft = JSON.parse(sessionStorage.getItem('vinyl-check-signup-draft') || 'null') as null | { username: string; email: string; password: string; emailVerificationToken?: string };
  try {
    if (!draft) {
      message.value = '회원가입 정보가 없습니다. 처음부터 다시 진행해 주세요.';
      router.push('/auth/signup');
      return;
    }
    await store.signupWithPassword(draft.username, draft.email, draft.password, skip ? [] : selectedGenres.value, draft.emailVerificationToken || '');
    sessionStorage.removeItem('vinyl-check-signup-draft');
    router.push('/app');
  } catch (error) {
    message.value = error instanceof Error ? error.message : '회원가입에 실패했습니다.';
  } finally {
    isSubmitting.value = false;
  }
};
</script>
