<template>
  <div class="size-full bg-white flex flex-col">
    <header class="px-4 py-4 flex items-center border-b">
      <button class="p-2" @click="router.push('/auth/login')">
        <ArrowLeft :size="24" />
      </button>
      <h2 class="ml-4">회원가입</h2>
    </header>

    <div class="flex-1 px-6 py-8 overflow-y-auto">
      <h1 class="text-2xl mb-2">계정 정보를 입력해주세요</h1>
      <p class="text-gray-600 mb-8">이메일과 비밀번호로 Vinyl-Check를 시작합니다.</p>

      <form class="space-y-4" @submit.prevent="router.push('/auth/preference')">
        <div>
          <label class="block text-sm mb-2">아이디</label>
          <div class="flex gap-2">
            <input v-model="form.username" type="text" class="flex-1 min-w-0 border rounded-lg px-4 py-3" placeholder="아이디 입력" required @input="usernameChecked = false" />
            <button type="button" class="px-4 py-3 border rounded-lg whitespace-nowrap" @click="usernameChecked = true">중복 확인</button>
          </div>
          <p v-if="usernameChecked" class="text-sm text-green-600 mt-1">사용 가능한 아이디입니다.</p>
        </div>

        <div>
          <label class="block text-sm mb-2">이메일</label>
          <input v-model="form.email" type="email" class="w-full border rounded-lg px-4 py-3" placeholder="example@email.com" required />
        </div>

        <div>
          <label class="block text-sm mb-2">비밀번호</label>
          <input v-model="form.password" type="password" class="w-full border rounded-lg px-4 py-3" placeholder="8자 이상 입력" minlength="8" required />
        </div>

        <div>
          <label class="block text-sm mb-2">비밀번호 확인</label>
          <input v-model="form.passwordConfirm" type="password" class="w-full border rounded-lg px-4 py-3" placeholder="비밀번호 재입력" required />
          <p v-if="form.password && form.passwordConfirm && form.password !== form.passwordConfirm" class="text-sm text-red-600 mt-1">비밀번호가 일치하지 않습니다.</p>
        </div>

        <button
          type="submit"
          :disabled="!usernameChecked || form.password !== form.passwordConfirm"
          class="w-full bg-blue-600 text-white py-3 rounded-lg disabled:bg-gray-300"
        >
          회원가입
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ArrowLeft } from 'lucide-vue-next';

const router = useRouter();
const usernameChecked = ref(false);
const form = reactive({ username: '', email: '', password: '', passwordConfirm: '' });
</script>
