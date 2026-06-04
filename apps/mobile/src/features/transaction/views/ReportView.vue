<template>
  <div class="size-full bg-white flex flex-col">
    <header class="px-4 py-4 flex items-center border-b"><button class="p-2" @click="router.back()"><ArrowLeft :size="24" /></button><h1 class="ml-4 text-lg">신고하기</h1></header>
    <div class="flex-1 overflow-y-auto p-4">
      <div class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6"><p class="text-sm text-red-900">허위 신고 시 서비스 이용이 제한될 수 있습니다.<br />신중하게 선택해주세요.</p></div>
      <form class="space-y-4" @submit.prevent="submit"><div><h3 class="mb-3">신고 사유를 선택해주세요</h3><div class="space-y-2"><label v-for="reason in reasons" :key="reason" class="flex items-center gap-3 p-4 border rounded-lg cursor-pointer hover:bg-gray-50"><input v-model="selectedReason" type="radio" name="reason" :value="reason" class="w-4 h-4" /><span>{{ reason }}</span></label></div></div><div><label class="block text-sm mb-2">상세 내용</label><textarea v-model="details" class="w-full px-4 py-3 border rounded-lg min-h-32" placeholder="신고 사유를 구체적으로 작성해주세요" required /></div></form>
    </div>
    <div class="p-4 border-t"><button class="w-full py-4 bg-red-600 text-white rounded-xl disabled:bg-gray-300" :disabled="!selectedReason || !details.trim()" @click="submit">신고 제출</button></div>
  </div>
</template>
<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { ArrowLeft } from 'lucide-vue-next';
const router = useRouter();
const selectedReason = ref('');
const details = ref('');
const reasons = ['사기/허위 매물', '중복 게시물', '거래 금지 물품', '가격 허위 기재', '욕설/비방', '개인정보 노출', '기타'];
const submit = () => { if (selectedReason.value && details.value.trim()) { alert('신고가 접수되었습니다'); router.back(); } };
</script>
