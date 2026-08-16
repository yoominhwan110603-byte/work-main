<template>
  <div class="size-full flex flex-col bg-white text-gray-950 dark:bg-slate-950 dark:text-slate-100">
    <header class="flex items-center border-b px-2 py-2 dark:border-slate-800">
      <button type="button" class="p-2" aria-label="뒤로" @click="router.back()">
        <ArrowLeft :size="24" />
      </button>
      <button type="button" class="ml-auto p-2" aria-label="마이크" @click="toggleAnalyzer">
        <Mic v-if="!isRunning" :size="22" />
        <Square v-else :size="20" />
      </button>
    </header>

    <main class="flex-1 overflow-y-auto p-3">
      <div class="flex h-40 items-end gap-px border-b border-gray-200 dark:border-slate-800">
        <div
          v-for="(bar, index) in bars"
          :key="index"
          class="min-h-px flex-1 bg-gray-950 dark:bg-slate-100"
          :style="{ height: `${Math.max(1, bar)}%` }"
        ></div>
      </div>

      <div v-if="statusMessage" class="mt-3 text-sm text-gray-500 dark:text-slate-400">
        {{ statusMessage }}
      </div>

      <div class="mt-4 space-y-1">
        <div
          v-for="peak in peaks"
          :key="peak.id"
          class="grid grid-cols-[5.5rem_1fr_3.5rem] items-center gap-2 text-sm tabular-nums"
        >
          <span>{{ formatFrequency(peak.frequency) }}</span>
          <span class="h-2 bg-gray-100 dark:bg-slate-800">
            <span class="block h-full bg-gray-950 dark:bg-slate-100" :style="{ width: `${peak.amount}%` }"></span>
          </span>
          <span class="text-right">{{ peak.amount }}%</span>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import type { PluginListenerHandle } from '@capacitor/core';
import { ArrowLeft, Mic, Square } from 'lucide-vue-next';
import {
  addNativeFrequencyAnalyzerListener,
  canUseNativeFrequencyAnalyzer,
  startNativeFrequencyAnalyzer,
  stopNativeFrequencyAnalyzer,
  type NativeSpectrumEvent,
} from '@/features/audio/services/nativeFrequencyAnalyzer';

type AudioContextConstructor = typeof AudioContext;
type FrequencyPeak = {
  id: string;
  frequency: number;
  amount: number;
};

const router = useRouter();
const bars = ref<number[]>(Array.from({ length: 56 }, () => 0));
const peaks = ref<FrequencyPeak[]>([]);
const isRunning = ref(false);
const statusMessage = ref('');

let audioContext: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let microphone: MediaStreamAudioSourceNode | null = null;
let microphoneStream: MediaStream | null = null;
let frequencyData: Uint8Array | null = null;
let animationFrame = 0;
let lastRenderAt = 0;
let nativeSpectrumListener: PluginListenerHandle | null = null;
let usingNativeAnalyzer = false;

const getAudioContextClass = () => (
  window.AudioContext
  || (window as Window & { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext
);

const formatFrequency = (frequency: number) => {
  if (frequency >= 1000) return `${(frequency / 1000).toFixed(frequency >= 10000 ? 1 : 2)} kHz`;
  return `${Math.round(frequency)} Hz`;
};

const buildBars = (data: Uint8Array, sampleRate: number, fftSize: number) => {
  const nextBars: number[] = [];
  const minHz = 20;
  const maxHz = Math.min(16000, sampleRate / 2);
  const binHz = sampleRate / fftSize;
  const bucketCount = 56;

  for (let bucket = 0; bucket < bucketCount; bucket += 1) {
    const startHz = minHz * ((maxHz / minHz) ** (bucket / bucketCount));
    const endHz = minHz * ((maxHz / minHz) ** ((bucket + 1) / bucketCount));
    const startBin = Math.max(1, Math.floor(startHz / binHz));
    const endBin = Math.min(data.length - 1, Math.ceil(endHz / binHz));
    let peak = 0;

    for (let index = startBin; index <= endBin; index += 1) {
      peak = Math.max(peak, data[index]);
    }

    nextBars.push(Math.round((peak / 255) * 100));
  }

  return nextBars;
};

const collectPeaks = (data: Uint8Array, sampleRate: number, fftSize: number) => {
  const candidates: { index: number; amount: number; frequency: number }[] = [];
  const binHz = sampleRate / fftSize;
  const maxIndex = Math.min(data.length - 2, Math.floor(Math.min(16000, sampleRate / 2) / binHz));

  for (let index = Math.max(2, Math.ceil(20 / binHz)); index <= maxIndex; index += 1) {
    const amount = data[index];
    if (amount < 4) continue;
    if (amount < data[index - 1] || amount < data[index + 1]) continue;
    candidates.push({
      index,
      amount,
      frequency: index * binHz,
    });
  }

  candidates.sort((left, right) => right.amount - left.amount);

  const selected: FrequencyPeak[] = [];
  for (const candidate of candidates) {
    const tooClose = selected.some(peak => {
      const minimumDistance = Math.max(30, peak.frequency * 0.035);
      return Math.abs(peak.frequency - candidate.frequency) < minimumDistance;
    });
    if (tooClose) continue;

    selected.push({
      id: `${candidate.index}-${Math.round(candidate.frequency)}`,
      frequency: candidate.frequency,
      amount: Math.round((candidate.amount / 255) * 100),
    });

    if (selected.length >= 14) break;
  }

  return selected;
};

const applyNativeSpectrum = (event: NativeSpectrumEvent) => {
  bars.value = event.bars.map(value => Math.max(0, Math.min(100, Math.round(value))));
  peaks.value = event.peaks.map((peak, index) => ({
    id: `${index}-${Math.round(peak.frequency)}`,
    frequency: peak.frequency,
    amount: Math.max(0, Math.min(100, Math.round(peak.amount))),
  }));
};

const renderSpectrum = (time: number) => {
  animationFrame = window.requestAnimationFrame(renderSpectrum);
  if (!analyser || !audioContext || !frequencyData || time - lastRenderAt < 80) return;
  lastRenderAt = time;

  analyser.getByteFrequencyData(frequencyData);
  bars.value = buildBars(frequencyData, audioContext.sampleRate, analyser.fftSize);
  peaks.value = collectPeaks(frequencyData, audioContext.sampleRate, analyser.fftSize);
};

const stopAnalyzer = async () => {
  if (animationFrame) window.cancelAnimationFrame(animationFrame);
  animationFrame = 0;
  lastRenderAt = 0;
  if (nativeSpectrumListener) {
    await nativeSpectrumListener.remove();
    nativeSpectrumListener = null;
  }
  if (usingNativeAnalyzer) {
    await stopNativeFrequencyAnalyzer().catch(() => undefined);
    usingNativeAnalyzer = false;
  }
  microphone?.disconnect();
  microphone = null;
  microphoneStream?.getTracks().forEach(track => track.stop());
  microphoneStream = null;
  void audioContext?.close().catch(() => undefined);
  audioContext = null;
  analyser = null;
  frequencyData = null;
  isRunning.value = false;
};

const startAnalyzer = async () => {
  await stopAnalyzer();
  statusMessage.value = '';

  if (canUseNativeFrequencyAnalyzer()) {
    try {
      nativeSpectrumListener = await addNativeFrequencyAnalyzerListener(applyNativeSpectrum);
      await startNativeFrequencyAnalyzer();
      usingNativeAnalyzer = true;
      isRunning.value = true;
      return;
    } catch {
      if (nativeSpectrumListener) {
        await nativeSpectrumListener.remove();
        nativeSpectrumListener = null;
      }
      usingNativeAnalyzer = false;
      statusMessage.value = '마이크를 시작할 수 없습니다.';
      return;
    }
  }

  const AudioContextClass = getAudioContextClass();
  if (!AudioContextClass || !navigator.mediaDevices?.getUserMedia) {
    statusMessage.value = '마이크를 사용할 수 없습니다.';
    return;
  }

  try {
    microphoneStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        channelCount: 1,
      } as MediaTrackConstraints,
      video: false,
    });

    audioContext = new AudioContextClass();
    await audioContext.resume();
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 4096;
    analyser.minDecibels = -95;
    analyser.maxDecibels = -15;
    analyser.smoothingTimeConstant = 0.7;
    microphone = audioContext.createMediaStreamSource(microphoneStream);
    microphone.connect(analyser);
    frequencyData = new Uint8Array(analyser.frequencyBinCount);
    isRunning.value = true;
    animationFrame = window.requestAnimationFrame(renderSpectrum);
  } catch {
    stopAnalyzer();
    statusMessage.value = '마이크 권한이 필요합니다.';
  }
};

const toggleAnalyzer = () => {
  if (isRunning.value) {
    void stopAnalyzer();
    return;
  }
  void startAnalyzer();
};

onMounted(() => {
  void startAnalyzer();
});

onUnmounted(() => {
  void stopAnalyzer();
});
</script>
