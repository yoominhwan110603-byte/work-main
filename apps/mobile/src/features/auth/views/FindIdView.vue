<template>
  <div class="size-full bg-white flex flex-col">
    <header class="px-4 py-4 flex items-center border-b">
      <button class="p-2 rounded-full active:bg-gray-100" @click="router.push('/auth/login')">
        <ArrowLeft :size="24" />
      </button>
      <h1 class="ml-4 text-lg font-semibold">아이디 찾기</h1>
    </header>

    <main class="flex-1 px-6 py-8">
      <form class="space-y-4" @submit.prevent="submit">
        <div>
          <label class="block text-sm mb-2">가입 이메일</label>
          <input v-model.trim="email" type="email" class="w-full border rounded-lg px-4 py-3" placeholder="vinyl@example.com" required />
        </div>
        <p v-if="message" :class="['text-sm', messageType === 'error' ? 'text-red-600' : 'text-blue-600']">{{ message }}</p>
        <button class="w-full bg-blue-600 text-white py-3 rounded-lg disabled:bg-gray-300" :disabled="isSubmitting">
          {{ buttonLabel }}
        </button>
      </form>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ArrowLeft } from 'lucide-vue-next';
import { useAppStore } from '@/shared/stores/appStore';

const router = useRouter();
const store = useAppStore();
const email = ref('');
const isSubmitting = ref(false);
const message = ref('');
const messageType = ref<'info' | 'error'>('info');
const buttonLabel = computed(() => isSubmitting.value ? '확인 중...' : '아이디 찾기');

const submit = async () => {
  if (isSubmitting.value) return;
  isSubmitting.value = true;
  message.value = '';
  try {
    const result = await store.requestFindId(email.value);
    message.value = `가입 아이디: ${result.username || result.maskedUsername || ''}`;
    messageType.value = 'info';
  } catch (error) {
    message.value = error instanceof Error ? error.message : '아이디 찾기에 실패했습니다.';
    messageType.value = 'error';
  } finally {
    isSubmitting.value = false;
  }
};
</script>
