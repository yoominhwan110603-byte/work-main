<template>
  <div class="size-full bg-white flex flex-col">
    <header class="px-4 py-4 flex items-center border-b">
      <button class="p-2 rounded-full active:bg-gray-100" @click="router.push('/')">
        <ArrowLeft :size="24" />
      </button>
    </header>

    <main class="flex-1 px-6 py-8 overflow-y-auto">
      <h1 class="text-3xl font-semibold mb-2">로그인</h1>
      <p class="text-gray-600 mb-4">감정 결과, 판매글, 채팅을 계정으로 관리하세요.</p>
      <p :class="['text-xs mb-6', serverOk ? 'text-green-600' : 'text-amber-600']">{{ healthMessage }}</p>

      <form class="space-y-4" @submit.prevent="handleLogin">
        <div>
          <label class="block text-sm mb-2">이메일 또는 아이디</label>
          <input v-model.trim="form.emailOrUsername" type="text" inputmode="email" class="w-full border rounded-lg px-4 py-3" placeholder="vinyl@example.com" autocomplete="username" required />
        </div>
        <div>
          <label class="block text-sm mb-2">비밀번호</label>
          <input v-model="form.password" type="password" class="w-full border rounded-lg px-4 py-3" placeholder="비밀번호 입력" autocomplete="current-password" required />
        </div>
        <label class="flex items-center gap-2 text-sm text-gray-700">
          <input v-model="form.rememberMe" type="checkbox" />
          로그인 유지
        </label>
        <p v-if="message" :class="['text-sm', messageType === 'error' ? 'text-red-600' : 'text-blue-600']">{{ message }}</p>
        <button type="submit" class="w-full bg-blue-600 text-white py-3 rounded-lg disabled:bg-gray-300" :disabled="isSubmitting">
          {{ isSubmitting ? '로그인 중...' : '로그인' }}
        </button>
        <button type="button" class="w-full border border-gray-300 py-3 rounded-lg flex items-center justify-center gap-2" :disabled="isGoogleSubmitting" @click="handleGoogleLogin">
          <Chrome :size="20" /> {{ isGoogleSubmitting ? 'Google 확인 중...' : 'Google로 로그인' }}
        </button>
      </form>

      <div class="flex justify-between mt-6 text-sm">
        <button class="text-gray-600" type="button" @click="router.push('/auth/find-id')">아이디 찾기</button>
        <button class="text-gray-600" type="button" @click="router.push('/auth/reset-password')">비밀번호 찾기</button>
      </div>
      <div class="mt-8 text-center">
        <span class="text-gray-600">계정이 없나요? </span>
        <button class="text-blue-600" @click="router.push('/auth/signup')">회원가입</button>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ArrowLeft, Chrome } from 'lucide-vue-next';
import { Capacitor } from '@capacitor/core';
import { useAppStore } from '@/shared/stores/appStore';

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (options: Record<string, unknown>) => void;
          prompt: (callback?: (notification: { isNotDisplayed?: () => boolean; isSkippedMoment?: () => boolean; getNotDisplayedReason?: () => string; getSkippedReason?: () => string }) => void) => void;
        };
      };
    };
  }
}

const GOOGLE_SCRIPT_ID = 'google-identity-services';
let nativeGoogleInitializedFor = '';

const isLocalWeb = () => {
  if (Capacitor.isNativePlatform()) return false;
  return ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
};

const router = useRouter();
const store = useAppStore();
const form = reactive({ emailOrUsername: '', password: '', rememberMe: true });
const isSubmitting = ref(false);
const isGoogleSubmitting = ref(false);
const message = ref('');
const messageType = ref<'info' | 'error'>('info');
const serverOk = ref(false);
const healthMessage = ref('서버 연결 확인 중...');

onMounted(async () => {
  const health = await store.checkServerHealth();
  serverOk.value = health.ok;
  healthMessage.value = health.ok
    ? `서버 연결됨: ${health.apiBaseUrl}`
    : health.message || `서버 연결 실패: ${health.apiBaseUrl}`;
});

const finishLogin = () => {
  message.value = '로그인되었습니다.';
  messageType.value = 'info';
  router.push('/app');
};

const handleLogin = async () => {
  if (isSubmitting.value) return;
  isSubmitting.value = true;
  message.value = '';
  try {
    await store.loginWithPassword(form.emailOrUsername, form.password, form.rememberMe);
    finishLogin();
  } catch (error) {
    message.value = error instanceof Error ? error.message : '로그인에 실패했습니다.';
    messageType.value = 'error';
  } finally {
    isSubmitting.value = false;
  }
};

const loadGoogleScript = () => new Promise<void>((resolve, reject) => {
  if (window.google?.accounts?.id) {
    resolve();
    return;
  }
  const existingScript = document.getElementById(GOOGLE_SCRIPT_ID) as HTMLScriptElement | null;
  if (existingScript) {
    existingScript.addEventListener('load', () => resolve(), { once: true });
    existingScript.addEventListener('error', () => reject(new Error('Google 로그인 스크립트를 불러오지 못했습니다.')), { once: true });
    return;
  }
  const script = document.createElement('script');
  script.id = GOOGLE_SCRIPT_ID;
  script.src = 'https://accounts.google.com/gsi/client';
  script.async = true;
  script.defer = true;
  script.onload = () => resolve();
  script.onerror = () => reject(new Error('Google 로그인 스크립트를 불러오지 못했습니다.'));
  document.head.appendChild(script);
});

const requestGoogleCredential = async (googleClientId: string) => {
  await loadGoogleScript();
  if (!window.google?.accounts?.id) throw new Error('Google 로그인 초기화에 실패했습니다.');
  return await new Promise<string>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => reject(new Error('Google 로그인 응답 시간이 초과되었습니다.')), 45000);
    window.google!.accounts!.id!.initialize({
      client_id: googleClientId,
      callback: (response: { credential?: string }) => {
        window.clearTimeout(timeoutId);
        if (response.credential) resolve(response.credential);
        else reject(new Error('Google 인증 정보를 받지 못했습니다.'));
      },
    });
    window.google!.accounts!.id!.prompt(notification => {
      if (notification.isNotDisplayed?.() || notification.isSkippedMoment?.()) {
        window.clearTimeout(timeoutId);
        reject(new Error(notification.getNotDisplayedReason?.() || notification.getSkippedReason?.() || 'Google 로그인 창을 표시하지 못했습니다.'));
      }
    });
  });
};

const requestNativeGoogleCredential = async (googleClientId: string) => {
  const { SocialLogin } = await import('@capgo/capacitor-social-login');
  if (nativeGoogleInitializedFor !== googleClientId) {
    await SocialLogin.initialize({
      google: {
        webClientId: googleClientId,
        mode: 'online',
      },
    });
    nativeGoogleInitializedFor = googleClientId;
  }
  const response = await SocialLogin.login({
    provider: 'google',
    options: {
      scopes: ['email', 'profile'],
      forceRefreshToken: true,
      filterByAuthorizedAccounts: false,
    },
  });
  if (response.provider !== 'google' || response.result.responseType !== 'online' || !response.result.idToken) {
    throw new Error('Google 인증 정보를 받지 못했습니다.');
  }
  return response.result.idToken;
};

const handleGoogleLogin = async () => {
  if (isGoogleSubmitting.value) return;
  isGoogleSubmitting.value = true;
  message.value = '';
  messageType.value = 'info';
  try {
    const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (isLocalWeb()) {
      const typedEmail = form.emailOrUsername.includes('@') ? form.emailOrUsername : undefined;
      await store.loginWithGoogle({ email: typedEmail || 'google-user@vinyl-check.local', name: typedEmail ? typedEmail.split('@')[0] : 'Google User' }, form.rememberMe);
    } else if (googleClientId) {
      const credential = Capacitor.isNativePlatform()
        ? await requestNativeGoogleCredential(googleClientId)
        : await requestGoogleCredential(googleClientId);
      await store.loginWithGoogle({ credential }, form.rememberMe);
    } else {
      const typedEmail = form.emailOrUsername.includes('@') ? form.emailOrUsername : undefined;
      await store.loginWithGoogle({ email: typedEmail || 'google-user@vinyl-check.local', name: typedEmail ? typedEmail.split('@')[0] : 'Google User' }, form.rememberMe);
    }
    finishLogin();
  } catch (error) {
    message.value = error instanceof Error ? error.message : 'Google 로그인에 실패했습니다.';
    messageType.value = 'error';
  } finally {
    isGoogleSubmitting.value = false;
  }
};
</script>
