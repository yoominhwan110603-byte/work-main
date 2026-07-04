<template>
  <nav class="tab-bar shrink-0 safe-area-bottom" aria-label="하단 주요 메뉴">
    <div class="tab-bar__inner">
      <RouterLink
        v-for="tab in tabs"
        :key="tab.path"
        :to="tab.path"
        class="tab-bar__item"
        :aria-current="isActive(tab) ? 'page' : undefined"
      >
        <span :class="['tab-bar__icon', isActive(tab) && 'tab-bar__icon--active']">
          <component :is="tab.icon" :size="22" />
        </span>
        <span :class="['tab-bar__label', isActive(tab) && 'tab-bar__label--active']">{{ tab.label }}</span>
      </RouterLink>
    </div>
  </nav>
</template>

<script setup lang="ts">
import type { Component } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { Home, LibraryBig, PlusCircle, User } from 'lucide-vue-next';

interface TabItem {
  icon: Component;
  label: string;
  path: string;
  match: (path: string) => boolean;
}

const route = useRoute();
const tabs: TabItem[] = [
  { icon: Home, label: '홈', path: '/app', match: path => path === '/app' || path.startsWith('/app/search') || path.startsWith('/app/pressing') },
  { icon: PlusCircle, label: '판매', path: '/sell', match: path => path.startsWith('/sell') },
  { icon: LibraryBig, label: '컬렉션', path: '/app/collection', match: path => path.startsWith('/app/collection') || path.startsWith('/collection') },
  { icon: User, label: '프로필', path: '/app/profile', match: path => path.startsWith('/app/profile') || path.startsWith('/app/settings') },
];

const isActive = (tab: TabItem) => tab.match(route.path);
</script>

<style scoped>
.tab-bar {
  border-top: 1px solid rgba(120, 85, 55, 0.18);
  background: rgba(255, 252, 246, 0.96);
  box-shadow: 0 -10px 22px rgba(61, 35, 19, 0.08);
  backdrop-filter: blur(16px);
}

.tab-bar__inner {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.12rem;
  padding: 0.38rem 0.5rem 0;
}

.tab-bar__item {
  display: flex;
  min-width: 0;
  flex-direction: column;
  align-items: center;
  gap: 0.12rem;
  padding: 0.24rem 0.1rem 0.28rem;
  color: #9a8877;
  text-decoration: none;
}

.tab-bar__icon {
  display: flex;
  width: 2.15rem;
  height: 2rem;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  color: #9a8877;
  transition: background-color 160ms ease, color 160ms ease, transform 160ms ease;
}

.tab-bar__icon--active {
  background: #5b3019;
  color: #fff7e8;
  box-shadow: inset 0 1px rgba(255,255,255,0.14), 0 4px 10px rgba(84, 43, 19, 0.18);
}

.tab-bar__label {
  max-width: 100%;
  overflow: hidden;
  color: #9a8877;
  font-size: 0.68rem;
  font-weight: 680;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tab-bar__label--active {
  color: #5b3019;
}

:global(.dark) .tab-bar {
  border-color: #2d2119;
  background: rgba(17, 24, 39, 0.96);
}

:global(.dark) .tab-bar__item,
:global(.dark) .tab-bar__icon,
:global(.dark) .tab-bar__label {
  color: #9ca3af;
}

:global(.dark) .tab-bar__icon--active {
  background: #8a532f;
  color: #fff7e8;
}

:global(.dark) .tab-bar__label--active {
  color: #f0c99f;
}
</style>
