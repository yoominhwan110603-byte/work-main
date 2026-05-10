<template>
  <div class="size-full bg-white flex flex-col">
    <header class="px-4 py-4 flex items-center border-b">
      <button class="p-2" @click="router.push('/')">
        <ArrowLeft :size="24" />
      </button>
    </header>

    <div class="flex-1 px-6 py-8 overflow-y-auto">
      <h1 class="text-3xl mb-2">로그인</h1>
      <p class="text-gray-600 mb-8">Vinyl-Check에 오신 것을 환영합니다.</p>

      <form class="space-y-4" @submit.prevent="handleLogin">
        <div>
          <label class="block text-sm mb-2">아이디 또는 이메일</label>
          <input v-model="form.username" type="text" class="w-full border rounded-lg px-4 py-3" placeholder="아이디 또는 이메일 입력" required />
        </div>
        <div>
          <label class="block text-sm mb-2">비밀번호</label>
          <input v-model="form.password" type="password" class="w-full border rounded-lg px-4 py-3" placeholder="비밀번호 입력" required />
        </div>
        <div class="flex items-center">
          <input id="rememberMe" v-model="form.rememberMe" type="checkbox" class="mr-2" />
          <label for="rememberMe" class="text-sm">로그인 유지</label>
        </div>
        <button type="submit" class="w-full bg-blue-600 text-white py-3 rounded-lg">로그인</button>
        <button type="button" class="w-full border border-gray-300 py-3 rounded-lg flex items-center justify-center gap-2" @click="handleGoogleLogin">
          <Mail :size="20" /> Google로 로그인
        </button>
      </form>

      <div class="flex justify-between mt-6 text-sm">
        <button class="text-gray-600">아이디 찾기</button>
        <button class="text-gray-600">비밀번호 찾기</button>
      </div>
      <div class="mt-8 text-center">
        <span class="text-gray-600">계정이 없으신가요? </span>
        <button class="text-blue-600" @click="router.push('/auth/signup')">회원가입</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive } from 'vue';
import { useRouter } from 'vue-router';
import { ArrowLeft, Mail } from 'lucide-vue-next';
import { useAppStore } from '../stores/appStore';

const router = useRouter();
const store = useAppStore();
const form = reactive({ username: '', password: '', rememberMe: false });

const loginAs = (username: string) => {
  store.login({ id: 'seller1', username, email: 'user@example.com', rating: 4.8, transactionCount: 24, genres: ['재즈', '록'] });
  router.push('/app');
};

const handleLogin = () => loginAs(form.username || 'VinylLover');
const handleGoogleLogin = () => loginAs('Google User');
</script>
