<template>
  <div class="size-full bg-white flex flex-col">
    <header class="px-4 py-4 flex items-center border-b">
      <button class="p-2 rounded-full active:bg-gray-100" @click="router.push('/auth/login')">
        <ArrowLeft :size="24" />
      </button>
      <h1 class="ml-4 text-lg font-semibold">아이디 찾기</h1>
    </header>

    <main class="flex-1 px-6 py-8 overflow-y-auto">
      <form class="space-y-4" @submit.prevent="requestCode">
        <div>
          <label class="block text-sm mb-2">가입 이메일</label>
          <input v-model.trim="email" type="email" class="w-full border rounded-lg px-4 py-3" placeholder="vinyl@example.com" :disabled="codeSent" required />
        </div>
        <button class="w-full bg-blue-600 text-white py-3 rounded-lg disabled:bg-gray-300" :disabled="isRequesting">
          {{ isRequesting ? '발송 중...' : codeSent ? '인증번호 다시 받기' : '인증번호 받기' }}
        </button>
      </form>

      <form v-if="codeSent && !foundUsername" class="space-y-4 mt-8" @submit.prevent="confirmId">
        <div>
          <label class="block text-sm mb-2">인증번호</label>
          <input v-model.trim="findCode" inputmode="numeric" maxlength="6" class="w-full border rounded-lg px-4 py-3 tracking-widest" placeholder="6자리 입력" required />
        </div>
        <button class="w-full bg-neutral-900 text-white py-3 rounded-lg disabled:bg-gray-300" :disabled="isConfirming">
          {{ isConfirming ? '확인 중...' : '아이디 확인' }}
        </button>
        <button type="button" class="w-full border border-gray-300 py-3 rounded-lg" @click="resetFlow">
          이메일 다시 입력
        </button>
      </form>

      <p v-if="message" :class="['text-sm mt-5', messageType === 'error' ? 'text-red-600' : 'text-blue-600']">{{ message }}</p>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { ArrowLeft } from 'lucide-vue-next';
import { useAppStore } from '@/shared/stores/appStore';

const router = useRouter();
const store = useAppStore();
const email = ref('');
const findCode = ref('');
const codeSent = ref(false);
const foundUsername = ref('');
const message = ref('');
const messageType = ref<'info' | 'error'>('info');
const isRequesting = ref(false);
const isConfirming = ref(false);

const requestCode = async () => {
  if (isRequesting.value) return;
  isRequesting.value = true;
  message.value = '';
  try {
    const result = await store.requestFindId(email.value);
    findCode.value = '';
    foundUsername.value = '';
    codeSent.value = true;
    message.value = result.message || '인증번호를 이메일로 발송했습니다.';
    messageType.value = 'info';
  } catch (error) {
    message.value = error instanceof Error ? error.message : '인증번호 발송에 실패했습니다.';
    messageType.value = 'error';
  } finally {
    isRequesting.value = false;
  }
};

const confirmId = async () => {
  if (isConfirming.value) return;
  isConfirming.value = true;
  message.value = '';
  try {
    const result = await store.confirmFindId(email.value, findCode.value);
    foundUsername.value = result.username || result.maskedUsername || '';
    message.value = `가입 아이디: ${foundUsername.value}`;
    messageType.value = 'info';
  } catch (error) {
    message.value = error instanceof Error ? error.message : '아이디 확인에 실패했습니다.';
    messageType.value = 'error';
  } finally {
    isConfirming.value = false;
  }
};

const resetFlow = () => {
  codeSent.value = false;
  findCode.value = '';
  foundUsername.value = '';
  message.value = '';
};
</script>
