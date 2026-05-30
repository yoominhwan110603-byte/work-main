<template>
  <div class="size-full bg-white flex flex-col">
    <header class="px-4 py-4 flex items-center border-b">
      <button class="p-2 rounded-full active:bg-gray-100" @click="router.push('/auth/login')">
        <ArrowLeft :size="24" />
      </button>
      <h1 class="ml-4 text-lg font-semibold">비밀번호 찾기</h1>
    </header>

    <main class="flex-1 px-6 py-8 overflow-y-auto">
      <form class="space-y-4" @submit.prevent="requestReset">
        <div>
          <label class="block text-sm mb-2">가입 이메일</label>
          <input v-model.trim="loginId" type="email" class="w-full border rounded-lg px-4 py-3" placeholder="vinyl@example.com" :disabled="codeSent" required />
        </div>
        <button class="w-full bg-blue-600 text-white py-3 rounded-lg disabled:bg-gray-300" :disabled="isRequesting">
          {{ isRequesting ? '발송 중...' : codeSent ? '인증번호 다시 받기' : '인증번호 받기' }}
        </button>
      </form>

      <form v-if="codeSent" class="space-y-4 mt-8" @submit.prevent="confirmReset">
        <div>
          <label class="block text-sm mb-2">인증번호</label>
          <input v-model.trim="resetCode" inputmode="numeric" maxlength="6" class="w-full border rounded-lg px-4 py-3 tracking-widest" placeholder="6자리 입력" required />
        </div>
        <div>
          <label class="block text-sm mb-2">새 비밀번호</label>
          <input v-model="password" type="password" minlength="8" class="w-full border rounded-lg px-4 py-3" required />
        </div>
        <button class="w-full bg-neutral-900 text-white py-3 rounded-lg disabled:bg-gray-300" :disabled="isConfirming">
          {{ isConfirming ? '변경 중...' : '비밀번호 변경' }}
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
import { useAppStore } from '../stores/appStore';

const router = useRouter();
const store = useAppStore();
const loginId = ref('');
const resetCode = ref('');
const password = ref('');
const codeSent = ref(false);
const message = ref('');
const messageType = ref<'info' | 'error'>('info');
const isRequesting = ref(false);
const isConfirming = ref(false);

const requestReset = async () => {
  if (isRequesting.value) return;
  isRequesting.value = true;
  message.value = '';
  try {
    const result = await store.requestPasswordReset(loginId.value);
    if (result.devResetCode) resetCode.value = result.devResetCode;
    message.value = result.devResetCode
      ? `${result.message || '인증번호를 이메일로 발송했습니다.'} 개발용 인증번호: ${result.devResetCode}`
      : result.message || '인증번호를 이메일로 발송했습니다.';
    codeSent.value = true;
    messageType.value = 'info';
  } catch (error) {
    message.value = error instanceof Error ? error.message : '재설정 요청에 실패했습니다.';
    messageType.value = 'error';
  } finally {
    isRequesting.value = false;
  }
};

const confirmReset = async () => {
  if (isConfirming.value) return;
  isConfirming.value = true;
  message.value = '';
  try {
    const result = await store.confirmPasswordReset(resetCode.value, password.value);
    message.value = result.message || '비밀번호가 변경되었습니다.';
    messageType.value = 'info';
  } catch (error) {
    message.value = error instanceof Error ? error.message : '비밀번호 변경에 실패했습니다.';
    messageType.value = 'error';
  } finally {
    isConfirming.value = false;
  }
};

const resetFlow = () => {
  codeSent.value = false;
  resetCode.value = '';
  password.value = '';
  message.value = '';
};
</script>
