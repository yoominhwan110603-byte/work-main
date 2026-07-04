<template>
  <section
    class="collection-bookcase"
    role="region"
    aria-label="LP 컬렉션 스와이프 책장"
    tabindex="0"
    @keydown.left.prevent="next"
    @keydown.right.prevent="previous"
    @keydown.enter.prevent="openActive"
    @keydown.space.prevent="openActive"
  >
    <div
      class="collection-bookcase__frame"
      :class="{ 'collection-bookcase__frame--dragging': isDragging }"
      @pointermove="moveDrag"
      @pointerup="finishDrag"
      @pointercancel="cancelDrag"
    >
      <div class="collection-bookcase__back" aria-hidden="true"></div>

      <div class="collection-bookcase__rack" role="listbox" aria-label="세로로 꽂힌 LP 목록" :aria-activedescendant="activeSpineId">
        <button
          v-for="(collection, index) in collections"
          :id="spineId(collection.id)"
          :key="collection.id"
          type="button"
          role="option"
          :aria-selected="index === activeIndex"
          :aria-label="`${collection.title}, ${collection.artist || '아티스트 미상'} 선택`"
          :class="['collection-bookcase__slot', index === activeIndex && 'collection-bookcase__slot--active']"
          :style="slotStyle(index)"
          @pointerdown.stop="startDrag($event, index)"
          @click.stop="handleSlotClick(index)"
        >
          <span class="collection-bookcase__photo" aria-hidden="true">
            <VinylCover :src="coverFor(collection)" :alt="collection.title" class="collection-bookcase__cover" />
          </span>
          <span class="collection-bookcase__lp" aria-hidden="true">
            <span class="collection-bookcase__lp-edge"></span>
          </span>
          <span class="sr-only">{{ collection.title }}</span>
        </button>
      </div>

      <button
        v-if="activeCollection"
        type="button"
        class="collection-bookcase__caption"
        :aria-label="`${activeCollection.title} 컬렉션 상세 보기`"
        @click="openActive"
      >
        <strong>{{ activeCollection.title }}</strong>
        <span>{{ activeCollection.artist || '아티스트 미상' }}</span>
      </button>

      <div class="collection-bookcase__slot-shadow" aria-hidden="true"></div>
      <div class="collection-bookcase__shelf-front" aria-hidden="true"></div>
    </div>

    <div class="collection-bookcase__controls">
      <button type="button" class="collection-bookcase__arrow" :disabled="activeIndex === 0" aria-label="이전 LP" @click="previous">
        <ChevronRight :size="20" />
      </button>
      <div class="collection-bookcase__status" aria-live="polite">
        <strong>{{ activeCollection?.title || 'LP 컬렉션' }}</strong>
        <span>{{ activeIndex + 1 }} / {{ collections.length }}</span>
      </div>
      <button type="button" class="collection-bookcase__arrow" :disabled="activeIndex === collections.length - 1" aria-label="다음 LP" @click="next">
        <ChevronLeft :size="20" />
      </button>
    </div>

  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { ChevronLeft, ChevronRight } from 'lucide-vue-next';
import type { VinylCollection } from '@/shared/models/collection';
import VinylCover from '@/shared/components/VinylCover.vue';

const props = defineProps<{ collections: VinylCollection[] }>();

const router = useRouter();
const activeIndex = ref(0);
const draggingIndex = ref<number | null>(null);
const dragStartX = ref<number | null>(null);
const dragOffset = ref(0);
const isDragging = ref(false);
let didDrag = false;

const PULL_DISTANCE = 124;
const CHANGE_THRESHOLD = 34;
const DRAG_LIMIT = 150;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const clampIndex = (index: number) => clamp(index, 0, props.collections.length - 1);
const activeCollection = computed(() => props.collections[activeIndex.value] || props.collections[0]);
const activeSpineId = computed(() => activeCollection.value ? spineId(activeCollection.value.id) : undefined);

const spineId = (id: string) => `collection-bookcase-spine-${id.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
const coverFor = (collection: VinylCollection) => collection.discogsCoverImageUrl || collection.coverImageDataUrl || collection.images[0] || '';

const revealFor = (index: number) => {
  const isDraggedSlot = draggingIndex.value === index;
  if (isDraggedSlot) {
    const opened = index === activeIndex.value ? 1 : 0;
    return clamp(opened + (-dragOffset.value / PULL_DISTANCE), 0, 1);
  }
  if (draggingIndex.value !== null) return index === activeIndex.value ? 0.2 : 0;
  return index === activeIndex.value ? 1 : 0;
};

const goTo = (index: number) => {
  activeIndex.value = clampIndex(index);
  dragOffset.value = 0;
};

const previous = () => goTo(activeIndex.value - 1);
const next = () => goTo(activeIndex.value + 1);

const openActive = () => {
  if (activeCollection.value) router.push(`/collection/${activeCollection.value.id}`);
};

const handleSlotClick = (index: number) => {
  if (didDrag) return;
  if (index === activeIndex.value) openActive();
  else goTo(index);
};

const startDrag = (event: PointerEvent, index: number) => {
  if (!event.isPrimary || props.collections.length < 1) return;
  draggingIndex.value = index;
  dragStartX.value = event.clientX;
  dragOffset.value = 0;
  isDragging.value = true;
  didDrag = false;
  (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
};

const moveDrag = (event: PointerEvent) => {
  if (dragStartX.value === null || draggingIndex.value === null || !event.isPrimary) return;
  const offset = clamp(event.clientX - dragStartX.value, -DRAG_LIMIT, DRAG_LIMIT);
  dragOffset.value = offset;
  if (Math.abs(offset) > 7) didDrag = true;
};

const finishDrag = (event: PointerEvent) => {
  if (dragStartX.value === null || draggingIndex.value === null) return;
  const distance = event.clientX - dragStartX.value;
  const swipedLeftEnough = distance <= -CHANGE_THRESHOLD;
  const swipedRightEnough = distance >= CHANGE_THRESHOLD;

  if (swipedLeftEnough || !swipedRightEnough) {
    goTo(draggingIndex.value);
  } else if (draggingIndex.value === activeIndex.value && activeIndex.value > 0) {
    previous();
  } else {
    goTo(draggingIndex.value);
  }

  draggingIndex.value = null;
  dragStartX.value = null;
  dragOffset.value = 0;
  isDragging.value = false;
  window.setTimeout(() => { didDrag = false; }, 120);
};

const cancelDrag = () => {
  draggingIndex.value = null;
  dragStartX.value = null;
  dragOffset.value = 0;
  isDragging.value = false;
  window.setTimeout(() => { didDrag = false; }, 120);
};

const slotStyle = (index: number) => {
  const reveal = revealFor(index);
  const active = index === activeIndex.value || index === draggingIndex.value;
  const distance = index - activeIndex.value;
  const pull = draggingIndex.value === index ? clamp(-dragOffset.value, 0, DRAG_LIMIT) : 0;
  const height = 12.9 - (index % 4) * 0.36 + (active ? reveal * 0.18 : 0);
  const shade = index % 4 === 0 ? '#11100e' : index % 4 === 1 ? '#221b16' : index % 4 === 2 ? '#171a1a' : '#2b211a';

  return {
    '--reveal': String(reveal),
    '--slot-width': active ? `${1.24 + reveal * 0.08}rem` : `${0.66 + (index % 3) * 0.08}rem`,
    '--slot-height': `${height}rem`,
    '--slot-shade': active ? '#16110e' : shade,
    transform: `translate3d(${-pull * 0.1}px, ${active ? -reveal * 4 : 0}px, 0) rotate(${clamp(distance * 0.24, -1.6, 1.6)}deg)`,
    zIndex: String(active ? 30 : 10 + index),
  };
};

watch(() => props.collections.map(collection => collection.id).join('|'), () => goTo(0));
</script>

<style scoped>
.collection-bookcase {
  margin: 0.85rem 0.7rem 0;
  overflow: hidden;
  border: 1px solid #80664d;
  border-radius: 0.72rem;
  background: #5a3d29;
  box-shadow: 0 10px 18px rgba(48, 35, 23, 0.14), inset 0 1px rgba(255,255,255,0.35);
  outline: none;
}

.collection-bookcase:focus-visible {
  outline: 3px solid #a66f3f;
  outline-offset: 3px;
}

.collection-bookcase__frame {
  position: relative;
  height: 20.8rem;
  overflow: hidden;
  touch-action: pan-y;
  user-select: none;
  cursor: grab;
  background:
    linear-gradient(90deg, rgba(0,0,0,0.22), transparent 30%, rgba(0,0,0,0.28)),
    linear-gradient(180deg, #60432e, #2d1d13);
}

.collection-bookcase__frame--dragging {
  cursor: grabbing;
  touch-action: none;
}

.collection-bookcase__back {
  position: absolute;
  inset: 0.9rem 0.6rem 2.95rem;
  border: 1px solid rgba(255, 226, 184, 0.08);
  border-radius: 0.5rem;
  background:
    linear-gradient(90deg, rgba(0,0,0,0.42), rgba(71, 45, 29, 0.38) 42%, rgba(0,0,0,0.3)),
    linear-gradient(180deg, #412818, #1f140c);
  box-shadow: inset 0 14px 22px rgba(0,0,0,0.3);
}

.collection-bookcase__rack {
  position: absolute;
  right: 1rem;
  bottom: 3.05rem;
  left: 1rem;
  z-index: 6;
  display: flex;
  height: 15.7rem;
  align-items: flex-end;
  justify-content: flex-end;
  gap: 0.18rem;
  padding: 0.72rem 0.74rem 1.1rem;
  border: 1px solid rgba(255, 226, 178, 0.11);
  border-radius: 0.46rem;
  background:
    linear-gradient(90deg, rgba(0,0,0,0.34), rgba(52, 33, 22, 0.58) 50%, rgba(0,0,0,0.48)),
    #2d1c12;
  box-shadow: inset 8px 0 12px rgba(255,255,255,0.025), inset -12px 0 16px rgba(0,0,0,0.36), 0 9px 18px rgba(21, 9, 3, 0.26);
}

.collection-bookcase__slot {
  position: relative;
  display: block;
  width: var(--slot-width);
  height: var(--slot-height);
  flex: none;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  transform-origin: bottom center;
  transition: width 180ms ease, transform 210ms cubic-bezier(.2,.82,.2,1), filter 180ms ease;
  will-change: transform, width;
  overflow: visible;
}

.collection-bookcase__frame--dragging .collection-bookcase__slot,
.collection-bookcase__frame--dragging .collection-bookcase__photo {
  transition: none;
}

.collection-bookcase__slot:focus-visible {
  outline: 3px solid rgba(242, 202, 145, 0.86);
  outline-offset: 4px;
}

.collection-bookcase__slot--active {
  filter: brightness(1.06);
}

.collection-bookcase__photo {
  position: absolute;
  right: 0.52rem;
  bottom: 1.86rem;
  z-index: 1;
  display: block;
  width: min(43vw, 9.5rem);
  aspect-ratio: 1;
  border-radius: 0.28rem;
  opacity: var(--reveal);
  transform: translate3d(calc((1 - var(--reveal)) * 7.15rem), calc((1 - var(--reveal)) * 0.36rem), 0) scale(calc(0.96 + var(--reveal) * 0.04));
  transform-origin: right center;
  transition: transform 220ms cubic-bezier(.2,.82,.2,1), opacity 160ms ease;
  will-change: transform, opacity;
  pointer-events: none;
}

.collection-bookcase__photo::before {
  content: '';
  position: absolute;
  inset: -0.18rem -0.28rem -0.32rem 0.2rem;
  z-index: -1;
  border-radius: 0.32rem;
  background:
    linear-gradient(90deg, rgba(255,255,255,0.14), rgba(255,255,255,0.03)),
    #3a2416;
  box-shadow: 0 12px 18px rgba(20, 12, 7, 0.34);
}

.collection-bookcase__cover {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: 0.24rem;
  background: #f3f4f6;
  object-fit: cover;
  box-shadow: 0 12px 18px rgba(20, 12, 7, 0.34), 0 0 0 1px rgba(255,255,255,0.12);
}

.collection-bookcase__lp {
  position: absolute;
  right: 0;
  bottom: 0;
  z-index: 3;
  display: block;
  width: 100%;
  height: 100%;
  min-width: 0.68rem;
  overflow: hidden;
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 0.1rem 0.1rem 0.06rem 0.06rem;
  background:
    linear-gradient(90deg, rgba(255,255,255,0.1), transparent 34%, rgba(0,0,0,0.28)),
    var(--slot-shade);
  background-position: center;
  background-size: cover;
  box-shadow: inset 1px 0 rgba(255,255,255,0.07), 2px 4px 6px rgba(0,0,0,0.26);
}

.collection-bookcase__lp::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, rgba(255,255,255,0.1), transparent 20%, rgba(0,0,0,0.18) 72%);
  pointer-events: none;
}

.collection-bookcase__slot--active .collection-bookcase__lp {
  box-shadow: inset 1px 0 rgba(255,255,255,0.12), 0 0 0 1px rgba(236, 198, 143, 0.16), 3px 6px 8px rgba(0,0,0,0.3);
}

.collection-bookcase__lp-edge {
  position: absolute;
  top: 0.62rem;
  bottom: 0.8rem;
  left: 50%;
  z-index: 2;
  width: 1px;
  background: linear-gradient(180deg, transparent, rgba(255,255,255,0.14), transparent);
  transform: translateX(-50%);
}

.collection-bookcase__caption {
  position: absolute;
  right: 1rem;
  bottom: 0.68rem;
  left: 1rem;
  z-index: 12;
  display: block;
  min-height: 3.05rem;
  padding: 0.46rem 0.64rem;
  border: 1px solid rgba(255,255,255,0.18);
  border-radius: 0.36rem;
  background: rgba(31, 20, 13, 0.9);
  color: #fff4df;
  text-align: left;
}

.collection-bookcase__caption strong,
.collection-bookcase__caption span {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.collection-bookcase__caption strong {
  font-size: 0.84rem;
  line-height: 1.25;
}

.collection-bookcase__caption span {
  margin-top: 0.13rem;
  color: #d6b99a;
  font-size: 0.69rem;
}

.collection-bookcase__slot-shadow {
  position: absolute;
  right: 1rem;
  bottom: 3.02rem;
  left: 1rem;
  z-index: 5;
  height: 1.4rem;
  border-radius: 999px;
  background: radial-gradient(ellipse at center, rgba(0,0,0,0.34), transparent 72%);
  filter: blur(6px);
  pointer-events: none;
}

.collection-bookcase__shelf-front {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 10;
  height: 3.05rem;
  border-top: 1px solid rgba(255,231,197,0.2);
  background:
    linear-gradient(180deg, rgba(113, 78, 52, 0.98), #2b170c);
  box-shadow: inset 0 -8px 10px rgba(0,0,0,0.28), 0 -7px 12px rgba(0,0,0,0.17);
  pointer-events: none;
}

.collection-bookcase__controls {
  display: flex;
  min-height: 4.15rem;
  align-items: center;
  gap: 0.7rem;
  padding: 0.4rem 0.9rem 0.25rem;
  background: linear-gradient(180deg, #302017, #21140d);
  color: #fff3dc;
}

.collection-bookcase__arrow {
  display: flex;
  width: 44px;
  height: 44px;
  flex: none;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(255, 225, 179, 0.25);
  border-radius: 999px;
  background: rgba(255,255,255,0.07);
  color: #ffe8c7;
}

.collection-bookcase__arrow:disabled { opacity: 0.25; }

.collection-bookcase__status {
  min-width: 0;
  flex: 1;
  text-align: center;
}

.collection-bookcase__status strong,
.collection-bookcase__status span {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.collection-bookcase__status strong {
  color: #fff5df;
  font-size: 0.82rem;
}

.collection-bookcase__status span {
  margin-top: 0.12rem;
  color: #c9ad8a;
  font-size: 0.68rem;
}

:global(.dark) .collection-bookcase {
  border-color: #4f3b2c;
  background: #20140d;
}

:global(.dark) .collection-bookcase__frame {
  background:
    linear-gradient(90deg, rgba(0,0,0,0.2), transparent 30%, rgba(0,0,0,0.38)),
    linear-gradient(180deg, #2c1b12, #160e09);
}

@media (max-width: 370px) {
  .collection-bookcase__frame {
    height: 20.2rem;
  }

  .collection-bookcase__rack {
    height: 15.15rem;
    gap: 0.15rem;
    padding-right: 0.62rem;
    padding-left: 0.62rem;
  }

  .collection-bookcase__photo {
    width: min(42vw, 8.75rem);
    transform: translate3d(calc((1 - var(--reveal)) * 6.55rem), calc((1 - var(--reveal)) * 0.36rem), 0) scale(calc(0.96 + var(--reveal) * 0.04));
  }
}

@media (prefers-reduced-motion: reduce) {
  .collection-bookcase__slot,
  .collection-bookcase__photo {
    transition: none;
  }
}
</style>
