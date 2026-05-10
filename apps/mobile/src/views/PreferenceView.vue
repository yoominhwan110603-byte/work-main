<template>
  <div class="size-full bg-white flex flex-col">
    <div class="flex-1 px-6 py-8 overflow-y-auto">
      <div class="mb-8">
        <h1 class="text-3xl mb-2">선호하는 장르를 선택해주세요</h1>
        <p class="text-gray-600">맞춤 추천에 사용합니다. 최대 5개까지 선택할 수 있습니다.</p>
      </div>
      <div class="grid grid-cols-2 gap-3 mb-8">
        <button
          v-for="genre in genres"
          :key="genre"
          :disabled="!selectedGenres.includes(genre) && selectedGenres.length >= 5"
          :class="[
            'p-4 rounded-lg border-2 flex items-center justify-between transition-all',
            selectedGenres.includes(genre) ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300',
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
    </div>
    <div class="px-6 pb-8 space-y-3">
      <button class="w-full bg-blue-600 text-white py-4 rounded-xl disabled:bg-gray-300" :disabled="selectedGenres.length === 0" @click="complete()">완료</button>
      <button class="w-full text-gray-600 py-2" @click="complete(true)">건너뛰기</button>
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
const genres = ['재즈', '록', '힙합', '클래식', 'R&B/소울', '일렉트로닉', '펑크/컨트리', '레게', '포크', '메탈', '블루스', '월드뮤직'];

const toggleGenre = (genre: string) => {
  selectedGenres.value = selectedGenres.value.includes(genre)
    ? selectedGenres.value.filter(item => item !== genre)
    : [...selectedGenres.value, genre];
};

const complete = (skip = false) => {
  store.login({ id: 'seller1', username: 'VinylLover', email: 'user@example.com', rating: 5, transactionCount: 0, genres: skip ? [] : selectedGenres.value });
  router.push('/app');
};
</script>
