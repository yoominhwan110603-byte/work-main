<template>
  <div class="size-full flex flex-col bg-white">
    <main class="flex-1 overflow-y-auto">
      <RouterView v-slot="{ Component, route }">
        <Transition name="page-slide" mode="out-in">
          <component :is="Component" :key="route.fullPath" />
        </Transition>
      </RouterView>
    </main>
    <TabBar />
  </div>
</template>

<script setup lang="ts">
import { RouterView } from 'vue-router';
import TabBar from '../components/TabBar.vue';
</script>
