<template>
  <div class="size-full bg-white flex flex-col">
    <header class="px-4 py-4 flex items-center border-b">
      <button class="p-2 rounded-full active:bg-gray-100" @click="router.push('/auth/login')">
        <ArrowLeft :size="24" />
      </button>
      <h2 class="ml-4 font-semibold">회원가입</h2>
    </header>

    <main class="flex-1 px-6 py-8 overflow-y-auto">
      <h1 class="text-2xl font-semibold mb-2">계정 정보를 입력해 주세요</h1>
      <p class="text-gray-600 mb-8">이메일 인증을 완료하면 판매글, 채팅, 감정 기능을 사용할 수 있습니다.</p>

      <form class="space-y-4" @submit.prevent="goPreference">
        <div>
          <label class="block text-sm mb-2">아이디</label>
          <div class="flex gap-2">
            <input v-model.trim="form.username" type="text" class="flex-1 min-w-0 border rounded-lg px-4 py-3" placeholder="VinylLover" required @input="resetCheck" />
            <button type="button" class="px-4 py-3 border rounded-lg whitespace-nowrap disabled:bg-gray-100" :disabled="isChecking" @click="checkUsername">
              {{ isChecking ? '확인 중' : '중복 확인' }}
            </button>
          </div>
          <p v-if="usernameChecked" class="text-sm text-green-600 mt-1">사용 가능한 아이디입니다.</p>
        </div>

        <div>
          <label class="block text-sm mb-2">이메일</label>
          <div class="flex gap-2">
            <input v-model.trim="form.email" type="email" class="flex-1 min-w-0 border rounded-lg px-4 py-3" placeholder="example@email.com" autocomplete="email" required @input="resetEmailVerification" />
            <button type="button" class="px-4 py-3 border rounded-lg whitespace-nowrap disabled:bg-gray-100" :disabled="!canRequestCode || isSendingCode" @click="sendEmailCode">
              {{ isSendingCode ? '발송 중' : '인증번호' }}
            </button>
          </div>
          <p v-if="emailCodeSent && !emailVerified" class="text-sm text-blue-600 mt-1">이메일로 받은 6자리 인증번호를 입력해 주세요.</p>
          <p v-if="emailVerified" class="text-sm text-green-600 mt-1">이메일 인증이 완료되었습니다.</p>
        </div>

        <div v-if="emailCodeSent && !emailVerified">
          <label class="block text-sm mb-2">인증번호</label>
          <div class="flex gap-2">
            <input ref="emailCodeInput" v-model.trim="emailCode" inputmode="numeric" maxlength="6" class="flex-1 min-w-0 border rounded-lg px-4 py-3 tracking-widest" placeholder="6자리 입력" />
            <button type="button" class="px-4 py-3 bg-blue-600 text-white rounded-lg whitespace-nowrap disabled:bg-gray-300" :disabled="emailCode.length !== 6 || isVerifyingCode" @click="verifyEmailCode">
              {{ isVerifyingCode ? '확인 중' : '확인' }}
            </button>
          </div>
        </div>

        <div>
          <label class="block text-sm mb-2">비밀번호</label>
          <input v-model="form.password" type="password" class="w-full border rounded-lg px-4 py-3" placeholder="8자 이상 입력" minlength="8" autocomplete="new-password" required />
        </div>

        <div>
          <label class="block text-sm mb-2">비밀번호 확인</label>
          <input v-model="form.passwordConfirm" type="password" class="w-full border rounded-lg px-4 py-3" placeholder="비밀번호 재입력" autocomplete="new-password" required />
          <p v-if="passwordMismatch" class="text-sm text-red-600 mt-1">비밀번호가 일치하지 않습니다.</p>
        </div>

        <p v-if="message" :class="['text-sm', messageTone === 'success' ? 'text-green-600' : messageTone === 'info' ? 'text-blue-600' : 'text-red-600']">{{ message }}</p>
        <button type="submit" :disabled="!canContinue" class="w-full bg-blue-600 text-white py-3 rounded-lg disabled:bg-gray-300">
          다음
        </button>
      </form>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ArrowLeft } from 'lucide-vue-next';
import { useAppStore } from '@/shared/stores/appStore';

const router = useRouter();
const store = useAppStore();
const usernameChecked = ref(false);
const emailCodeSent = ref(false);
const emailVerified = ref(false);
const isChecking = ref(false);
const isSendingCode = ref(false);
const isVerifyingCode = ref(false);
const message = ref('');
const messageTone = ref<'error' | 'info' | 'success'>('error');
const emailCode = ref('');
const emailVerificationToken = ref('');
const emailCodeInput = ref<HTMLInputElement | null>(null);
const form = reactive({ username: '', email: '', password: '', passwordConfirm: '' });

const passwordMismatch = computed(() => Boolean(form.password && form.passwordConfirm && form.password !== form.passwordConfirm));
const canRequestCode = computed(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email));
const canContinue = computed(() => Boolean(usernameChecked.value && emailVerified.value && form.username && form.email && form.password.length >= 8 && !passwordMismatch.value));

const setMessage = (text: string, tone: 'error' | 'info' | 'success' = 'error') => {
  message.value = text;
  messageTone.value = tone;
};

const resetCheck = () => {
  usernameChecked.value = false;
  message.value = '';
};

const resetEmailVerification = () => {
  resetCheck();
  emailCodeSent.value = false;
  emailVerified.value = false;
  emailCode.value = '';
  emailVerificationToken.value = '';
};

const checkUsername = async () => {
  if (!form.username.trim()) {
    setMessage('아이디를 입력해 주세요.');
    return;
  }
  isChecking.value = true;
  message.value = '';
  usernameChecked.value = false;
  try {
    const result = await store.checkSignupAvailability(form.username, form.email);
    if (result.usernameTaken) {
      setMessage('이미 사용 중인 아이디입니다.');
      return;
    }
    if (result.emailTaken) {
      setMessage('이미 사용 중인 이메일입니다.');
      return;
    }
    usernameChecked.value = true;
    setMessage('아이디와 이메일을 사용할 수 있습니다.', 'success');
  } catch (error) {
    setMessage(error instanceof Error ? error.message : '중복 확인에 실패했습니다.');
  } finally {
    isChecking.value = false;
  }
};

const sendEmailCode = async () => {
  if (!canRequestCode.value) {
    setMessage('올바른 이메일을 입력해 주세요.');
    return;
  }
  isSendingCode.value = true;
  emailVerified.value = false;
  emailVerificationToken.value = '';
  try {
    const result = await store.requestEmailVerification(form.email);
    emailCodeSent.value = true;
    if (result.devVerificationCode) emailCode.value = result.devVerificationCode;
    await nextTick();
    emailCodeInput.value?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    emailCodeInput.value?.focus();
    setMessage(result.devVerificationCode
      ? `${result.message || '인증번호를 발송했습니다.'} 개발용 인증번호: ${result.devVerificationCode}`
      : result.message || '인증번호를 이메일로 발송했습니다.', 'info');
  } catch (error) {
    setMessage(error instanceof Error ? error.message : '인증번호 발송에 실패했습니다.');
  } finally {
    isSendingCode.value = false;
  }
};

const verifyEmailCode = async () => {
  if (emailCode.value.length !== 6) return;
  isVerifyingCode.value = true;
  try {
    const result = await store.confirmEmailVerification(form.email, emailCode.value);
    emailVerificationToken.value = result.verificationToken || '';
    emailVerified.value = true;
    setMessage(result.message || '이메일 인증이 완료되었습니다.', 'success');
  } catch (error) {
    setMessage(error instanceof Error ? error.message : '이메일 인증에 실패했습니다.');
  } finally {
    isVerifyingCode.value = false;
  }
};

const goPreference = () => {
  if (!canContinue.value) {
    setMessage('아이디 중복 확인, 이메일 인증, 비밀번호 확인을 완료해 주세요.');
    return;
  }
  sessionStorage.setItem('vinyl-check-signup-draft', JSON.stringify({
    username: form.username,
    email: form.email,
    password: form.password,
    emailVerificationToken: emailVerificationToken.value,
  }));
  router.push('/auth/preference');
};
</script>
