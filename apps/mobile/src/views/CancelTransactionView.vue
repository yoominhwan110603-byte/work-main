<template>
  <div class="size-full bg-white flex flex-col">
    <header class="px-4 py-4 flex items-center border-b"><button class="p-2" @click="router.back()"><ArrowLeft :size="24" /></button><h1 class="ml-4 text-lg">거래 취소</h1></header>
    <div class="flex-1 overflow-y-auto p-4">
      <div class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6"><p class="text-sm text-red-900">거래를 취소하시겠습니까?<br />취소 사유는 상대방에게 전달됩니다.</p></div>
      <form class="space-y-4" @submit.prevent="submit"><div><h3 class="mb-3">취소 사유를 선택해주세요</h3><div class="space-y-2"><label v-for="reason in reasons" :key="reason" class="flex items-center gap-3 p-4 border rounded-lg cursor-pointer hover:bg-gray-50"><input v-model="selectedReason" type="radio" name="reason" :value="reason" class="w-4 h-4" /><span>{{ reason }}</span></label></div></div><div v-if="selectedReason === '기타'"><label class="block text-sm mb-2">상세 사유</label><textarea v-model="otherReason" class="w-full px-4 py-3 border rounded-lg min-h-32" placeholder="취소 사유를 입력해주세요" required /></div></form>
    </div>
    <div class="p-4 border-t flex gap-2"><button class="flex-1 py-4 border border-gray-300 rounded-xl" @click="router.back()">돌아가기</button><button class="flex-1 py-4 bg-red-600 text-white rounded-xl disabled:bg-gray-300" :disabled="!selectedReason || (selectedReason === '기타' && !otherReason)" @click="submit">거래 취소</button></div>
  </div>
</template>
<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { ArrowLeft } from 'lucide-vue-next';
const router = useRouter();
const selectedReason = ref('');
const otherReason = ref('');
const reasons = ['판매자/구매자와 연락이 안됨', '약속 시간/장소 조율 실패', '상품 상태가 설명과 다름', '더 좋은 조건의 거래를 찾음', '개인 사정으로 거래 불가', '기타'];
const submit = () => { if (selectedReason.value) { alert('거래가 취소되었습니다'); router.push('/app'); } };
</script>
