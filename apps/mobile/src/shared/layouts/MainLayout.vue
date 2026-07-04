<template>
  <div class="size-full flex flex-col bg-background text-foreground">
    <main class="relative flex-1 overflow-hidden bg-background">
      <RouterView v-slot="{ Component, route }">
        <Transition name="page-slide">
          <component :is="Component" :key="route.fullPath" />
        </Transition>
      </RouterView>
    </main>
    <TabBar />
  </div>
</template>

<script setup lang="ts">
import { RouterView } from 'vue-router';
import TabBar from '@/shared/components/TabBar.vue';
</script>
