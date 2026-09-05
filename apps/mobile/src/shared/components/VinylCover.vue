<template>
  <img v-if="resolvedSrc" :src="resolvedSrc" :alt="alt" :class="props.class" />
  <div
    v-else
    role="img"
    :aria-label="alt"
    :class="`bg-neutral-900 text-white flex items-center justify-center overflow-hidden ${props.class || ''}`"
  >
    <div class="relative w-3/4 aspect-square rounded-full bg-zinc-800 shadow-inner">
      <div class="absolute inset-2 rounded-full border border-white/10"></div>
      <div class="absolute inset-6 rounded-full border border-white/10"></div>
      <div class="absolute inset-[36%] rounded-full bg-rose-600 flex items-center justify-center">
        <Disc3 :size="18" class="text-white/85" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Disc3 } from 'lucide-vue-next';
import { resolveUploadedImageUrl } from '@/shared/services/mediaUpload';

const props = withDefaults(defineProps<{ src?: string; alt?: string; class?: string }>(), {
  alt: 'LP image',
  class: '',
});
const resolvedSrc = computed(() => resolveUploadedImageUrl(props.src));
</script>
