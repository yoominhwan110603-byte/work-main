<template>
  <div class="size-full bg-black text-white flex flex-col">
    <header class="px-4 py-4 flex items-center justify-between z-10">
      <button class="p-2 rounded-full bg-white/10 active:bg-white/20" @click="router.back()">
        <ArrowLeft :size="24" />
      </button>
      <div class="text-right">
        <p class="text-sm font-medium">{{ isVideoMode ? '스크래치 동영상 촬영' : '표면 스캔' }}</p>
        <p class="text-xs text-white/60">LP판 전체를 원 안에 맞춰주세요</p>
      </div>
    </header>

    <main class="flex-1 flex items-center justify-center px-4">
      <div class="relative w-full max-w-md aspect-square overflow-hidden rounded-2xl bg-neutral-950">
        <video ref="videoRef" autoplay muted playsinline class="absolute inset-0 h-full w-full object-cover" />

        <div v-if="cameraMessage" class="absolute inset-0 flex items-center justify-center bg-black/70 px-8 text-center text-sm text-white/80">
          <div class="space-y-4">
            <p>{{ cameraMessage }}</p>
            <div v-if="showPermissionActions" class="space-y-2">
              <button class="w-full rounded-lg bg-white px-4 py-3 text-sm text-black" @click="startCamera">
                다시 권한 요청
              </button>
              <button class="w-full rounded-lg border border-white/40 px-4 py-3 text-sm text-white" @click="openSettings">
                앱 권한 설정 열기
              </button>
            </div>
          </div>
        </div>

        <div class="pointer-events-none absolute inset-0 z-10 bg-black/5"></div>
        <div class="pointer-events-none absolute inset-[7%] z-10 rounded-full border-2 border-white/95 shadow-[0_0_0_999px_rgba(0,0,0,0.3)]"></div>
        <div class="pointer-events-none absolute inset-[16%] z-10 rounded-full border border-dashed border-white/55"></div>
        <div class="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <div class="h-14 w-14 rounded-full border border-white/65 bg-black/15"></div>
        </div>

        <div class="pointer-events-none absolute left-4 top-20 z-10 flex items-center gap-2 rounded-full bg-sky-500/90 px-3 py-2 text-xs font-medium text-white shadow-lg">
          <span class="h-px w-12 bg-white"></span>
          <span class="text-lg leading-none">→</span>
          <span>반사광 방향</span>
        </div>
        <div class="pointer-events-none absolute left-6 top-32 z-10 h-20 w-28 rotate-[-18deg] border-t-2 border-l-2 border-sky-300/90"></div>

        <div class="pointer-events-none absolute left-5 right-5 top-4 z-10 rounded-full bg-black/65 px-4 py-2 text-center text-sm font-medium">
          LP판 전체가 원 안에 들어오게 촬영하세요
        </div>
        <div class="pointer-events-none absolute left-5 right-5 bottom-20 z-10 space-y-2">
          <p class="rounded-full bg-black/70 px-4 py-2 text-center text-xs text-white">
            빛이 정면이 아니라 옆에서 비스듬히 비치게 해주세요
          </p>
          <p class="rounded-full bg-black/70 px-4 py-2 text-center text-xs text-white">
            {{ isRecording ? '카메라를 천천히 움직여 여러 각도를 촬영하세요' : primaryGuide }}
          </p>
        </div>

        <div class="absolute left-3 right-3 bottom-3 z-10 grid grid-cols-3 gap-2 text-[11px]">
          <div :class="metricClass(brightnessState)">
            밝기 {{ Math.round(metrics.brightness) }}
          </div>
          <div :class="metricClass(reflectionState)">
            반사 {{ Math.round(metrics.reflection) }}
          </div>
          <div :class="metricClass(motionState)">
            흔들림 {{ Math.round(metrics.motion) }}
          </div>
        </div>

        <div v-if="warningText" class="absolute left-4 right-4 top-1/2 z-20 -translate-y-1/2 rounded-xl bg-amber-400/95 px-4 py-3 text-center text-sm font-medium text-black shadow-lg">
          {{ warningText }}
        </div>

        <div v-if="isRecording" class="absolute right-4 top-20 z-20 rounded-full bg-red-600 px-3 py-1 text-xs font-medium">
          REC {{ recordingSeconds }}s
        </div>
      </div>
      <canvas ref="analysisCanvasRef" class="hidden"></canvas>
      <canvas ref="captureCanvasRef" class="hidden"></canvas>
    </main>

    <section v-if="qualityResult" class="mx-4 mb-3 rounded-2xl bg-white p-4 text-gray-900">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm font-medium">촬영 품질 점수</p>
          <p class="mt-1 text-xs text-gray-500">{{ qualityResult.summary }}</p>
        </div>
        <p class="text-3xl font-semibold text-blue-600">{{ qualityResult.score }}</p>
      </div>
      <div class="mt-3 grid grid-cols-4 gap-2 text-center text-[11px]">
        <div class="rounded bg-gray-50 p-2">밝기<br />{{ qualityResult.brightness }}</div>
        <div class="rounded bg-gray-50 p-2">반사<br />{{ qualityResult.reflection }}</div>
        <div class="rounded bg-gray-50 p-2">안정<br />{{ qualityResult.stability }}</div>
        <div class="rounded bg-gray-50 p-2">구도<br />{{ qualityResult.fit }}</div>
      </div>
      <button class="mt-3 w-full rounded-lg bg-blue-600 py-3 text-sm text-white disabled:bg-gray-400" :disabled="isApplyingCapture" @click="applyCapture">
        {{ isApplyingCapture ? '적용 중' : '판매 화면에 적용' }}
      </button>
    </section>

    <footer class="p-6 flex items-center justify-center gap-8">
      <label class="p-4 bg-white/15 rounded-full active:bg-white/25">
        <Image :size="24" />
        <input type="file" :accept="isVideoMode ? 'video/*' : 'image/*'" class="hidden" @change="pickFallback" />
      </label>
      <button
        :class="['w-20 h-20 rounded-full flex items-center justify-center active:scale-95 transition disabled:opacity-60', isRecording ? 'bg-red-600 text-white' : 'bg-white text-black']"
        :disabled="isCapturing"
        @click="handleMainAction"
      >
        <Square v-if="isRecording" :size="30" />
        <VideoIcon v-else-if="isVideoMode" :size="32" />
        <CameraIcon v-else :size="32" />
      </button>
      <button class="p-4 bg-white/15 rounded-full active:bg-white/25" @click="restartCamera">
        <RotateCcw :size="24" />
      </button>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Camera as CapacitorCamera } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { ArrowLeft, Camera as CameraIcon, Image, RotateCcw, Square, Video as VideoIcon } from 'lucide-vue-next';
import { openAppPermissionSettings } from '@/shared/services/appSettings';
import { setPendingCapture } from '@/features/seller/services/captureTransfer';

type QualityResult = {
  score: number;
  summary: string;
  brightness: number;
  reflection: number;
  stability: number;
  fit: number;
};

const router = useRouter();
const route = useRoute();
const isVideoMode = computed(() => route.query.mode === 'video');
const videoRef = ref<HTMLVideoElement | null>(null);
const analysisCanvasRef = ref<HTMLCanvasElement | null>(null);
const captureCanvasRef = ref<HTMLCanvasElement | null>(null);
const cameraMessage = ref('카메라 권한을 확인하는 중입니다.');
const showPermissionActions = ref(false);
const recordingSeconds = ref(0);
const isRecording = ref(false);
const isCapturing = ref(false);
const isApplyingCapture = ref(false);
const pendingDataUrl = ref('');
const qualityResult = ref<QualityResult | null>(null);
const metrics = ref({ brightness: 0, reflection: 0, motion: 0, fit: 0 });

let cameraStream: MediaStream | null = null;
let mediaRecorder: MediaRecorder | null = null;
let recordedChunks: Blob[] = [];
let analysisTimer: number | null = null;
let recordingTimer: number | null = null;
let previousLuma: Uint8ClampedArray | null = null;
const samples: Array<typeof metrics.value> = [];
const MAX_CAPTURE_DIMENSION = 1280;
const CAPTURE_JPEG_QUALITY = 0.86;
const MAX_RECORDING_SECONDS = 12;

const brightnessState = computed(() => metrics.value.brightness < 35 || metrics.value.brightness > 218 ? 'bad' : 'good');
const reflectionState = computed(() => metrics.value.reflection < 14 ? 'warn' : metrics.value.reflection > 42 ? 'bad' : 'good');
const motionState = computed(() => metrics.value.motion > 22 ? 'bad' : metrics.value.motion > 12 ? 'warn' : 'good');
const primaryGuide = computed(() => {
  if (metrics.value.fit < 35) return 'LP판이 잘리고 있어요. 원 안에 다시 맞춰주세요';
  if (metrics.value.brightness < 35) return '화면이 너무 어두워요';
  if (metrics.value.brightness > 218) return '화면이 너무 밝아요';
  if (metrics.value.reflection < 14) return '반사가 부족해요. 조명 각도를 조정해주세요';
  if (metrics.value.motion > 22) return '너무 빠르게 움직이고 있어요';
  return '좋아요. 이 각도를 유지하세요';
});
const warningText = computed(() => {
  if (!cameraStream || cameraMessage.value) return '';
  if (metrics.value.fit < 35) return 'LP판 전체가 원 안에 들어오게 다시 맞춰주세요';
  if (metrics.value.motion > 22) return '너무 빠르게 움직이고 있어요';
  if (metrics.value.brightness < 35) return '화면이 너무 어두워요';
  if (metrics.value.brightness > 218) return '화면이 너무 밝아요';
  if (metrics.value.reflection < 14) return '반사가 부족해요. 조명 각도를 조정해주세요';
  return '';
});

const metricClass = (state: string) => [
  'rounded-full px-2 py-1 text-center font-medium',
  state === 'bad' ? 'bg-red-500 text-white' : state === 'warn' ? 'bg-amber-300 text-black' : 'bg-emerald-500 text-white',
];

const readFileAsDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

const canvasToDataUrl = (canvas: HTMLCanvasElement, type = 'image/jpeg', quality = CAPTURE_JPEG_QUALITY) => new Promise<string>((resolve, reject) => {
  if (!canvas.toBlob) {
    resolve(canvas.toDataURL(type, quality));
    return;
  }
  canvas.toBlob(blob => {
    if (!blob) {
      reject(new Error('capture encoding failed'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  }, type, quality);
});

const fitWithinCaptureLimit = (width: number, height: number) => {
  const scale = Math.min(1, MAX_CAPTURE_DIMENSION / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
};

const resizeImageFileAsDataUrl = async (file: File) => {
  const rawDataUrl = await readFileAsDataUrl(file);
  const image = new window.Image();
  image.src = rawDataUrl;
  if (typeof image.decode === 'function') {
    await image.decode().catch(() => undefined);
  } else if (!image.complete) {
    await new Promise(resolve => {
      image.onload = resolve;
      image.onerror = resolve;
    });
  }
  if (!image.naturalWidth || !image.naturalHeight) return rawDataUrl;
  const canvas = captureCanvasRef.value || document.createElement('canvas');
  const size = fitWithinCaptureLimit(image.naturalWidth, image.naturalHeight);
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext('2d');
  if (!context) return rawDataUrl;
  context.drawImage(image, 0, 0, size.width, size.height);
  return await canvasToDataUrl(canvas);
};

const stopCamera = () => {
  cameraStream?.getTracks().forEach(track => track.stop());
  cameraStream = null;
};

const clearTimers = () => {
  if (analysisTimer !== null) window.clearInterval(analysisTimer);
  if (recordingTimer !== null) window.clearInterval(recordingTimer);
  analysisTimer = null;
  recordingTimer = null;
};

const requestCameraPermission = async () => {
  if (!Capacitor.isNativePlatform()) return true;
  try {
    const current = await CapacitorCamera.checkPermissions();
    if (current.camera === 'granted') return true;
    const requested = await CapacitorCamera.requestPermissions({ permissions: ['camera'] });
    return requested.camera === 'granted';
  } catch {
    return false;
  }
};

const startCamera = async () => {
  showPermissionActions.value = false;
  cameraMessage.value = '카메라 권한을 확인하는 중입니다.';
  const permissionGranted = await requestCameraPermission();
  if (!permissionGranted) {
    showPermissionActions.value = true;
    cameraMessage.value = '카메라 권한이 꺼져 있습니다. 권한을 허용해야 촬영 가이드를 사용할 수 있어요.';
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    showPermissionActions.value = true;
    cameraMessage.value = '이 기기에서는 앱 내부 카메라를 사용할 수 없습니다. 왼쪽 버튼으로 파일을 선택해 주세요.';
    return;
  }
  try {
    stopCamera();
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 1280 },
        frameRate: { ideal: 30, max: 30 },
      },
      audio: false,
    });
    if (videoRef.value) {
      videoRef.value.srcObject = cameraStream;
      await videoRef.value.play();
    }
    cameraMessage.value = '';
    showPermissionActions.value = false;
    startFrameAnalysis();
  } catch {
    showPermissionActions.value = true;
    cameraMessage.value = '카메라를 열지 못했습니다. Android 설정에서 Vinyl-Check의 카메라 권한을 허용해 주세요.';
  }
};

const openSettings = async () => {
  try {
    await openAppPermissionSettings();
  } catch (error) {
    cameraMessage.value = error instanceof Error ? error.message : '앱 설정을 열지 못했습니다.';
  }
};

const restartCamera = () => {
  qualityResult.value = null;
  pendingDataUrl.value = '';
  void startCamera();
};

const startFrameAnalysis = () => {
  if (analysisTimer !== null) window.clearInterval(analysisTimer);
  analysisTimer = window.setInterval(analyzeFrame, 550);
};

const analyzeFrame = () => {
  const video = videoRef.value;
  const canvas = analysisCanvasRef.value;
  if (!video || !canvas || !video.videoWidth || !video.videoHeight) return;
  const size = 96;
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return;
  context.drawImage(video, 0, 0, size, size);
  const { data } = context.getImageData(0, 0, size, size);
  const luma = new Uint8ClampedArray(size * size);
  let total = 0;
  let brightPixels = 0;
  let leftBright = 0;
  let rightBright = 0;
  let ringContrast = 0;
  let ringSamples = 0;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = y * size + x;
      const offset = index * 4;
      const value = data[offset] * 0.299 + data[offset + 1] * 0.587 + data[offset + 2] * 0.114;
      luma[index] = value;
      total += value;
      if (value > 215) {
        brightPixels += 1;
        if (x < size / 2) leftBright += 1;
        else rightBright += 1;
      }
      const dx = x - size / 2;
      const dy = y - size / 2;
      const radius = Math.sqrt(dx * dx + dy * dy) / (size / 2);
      if (radius > 0.72 && radius < 0.9) {
        ringContrast += Math.abs(value - 120);
        ringSamples += 1;
      }
    }
  }

  let motion = 0;
  if (previousLuma) {
    let diff = 0;
    for (let i = 0; i < luma.length; i += 6) diff += Math.abs(luma[i] - previousLuma[i]);
    motion = diff / (luma.length / 6);
  }
  previousLuma = luma;

  const brightness = total / (size * size);
  const reflection = Math.min(100, (brightPixels / (size * size)) * 1000 + Math.abs(leftBright - rightBright) / 12);
  const fit = Math.max(0, Math.min(100, (ringContrast / Math.max(1, ringSamples)) * 1.8));
  metrics.value = { brightness, reflection, motion, fit };
  if (isRecording.value) samples.push(metrics.value);
};

const scoreFromSamples = () => {
  const source = samples.length ? samples : [metrics.value];
  const average = (key: keyof typeof metrics.value) => source.reduce((sum, item) => sum + item[key], 0) / source.length;
  const brightness = average('brightness');
  const reflection = average('reflection');
  const motion = average('motion');
  const fit = average('fit');
  const brightnessScore = Math.max(0, 100 - Math.abs(brightness - 128) * 0.75);
  const reflectionScore = Math.max(0, Math.min(100, reflection * 3.2));
  const stabilityScore = Math.max(0, 100 - motion * 3.4);
  const fitScore = Math.max(0, Math.min(100, fit));
  const score = Math.round(brightnessScore * 0.28 + reflectionScore * 0.26 + stabilityScore * 0.24 + fitScore * 0.22);
  const summary = score >= 82 ? '좋아요. 서버 분석에 쓰기 좋은 촬영입니다.' : score >= 65 ? '사용 가능하지만 조명 각도나 움직임을 조금 더 맞추면 좋아요.' : '다시 촬영을 권장합니다. 원형 구도, 옆 반사광, 천천한 움직임을 확인해 주세요.';
  return {
    score,
    summary,
    brightness: Math.round(brightnessScore),
    reflection: Math.round(reflectionScore),
    stability: Math.round(stabilityScore),
    fit: Math.round(fitScore),
  };
};

const capturePhoto = async () => {
  if (isCapturing.value) return;
  const video = videoRef.value;
  const canvas = captureCanvasRef.value;
  if (!video || !canvas || !video.videoWidth || !video.videoHeight) {
    cameraMessage.value = '카메라 화면이 아직 준비되지 않았습니다.';
    return;
  }
  isCapturing.value = true;
  try {
    const size = fitWithinCaptureLimit(video.videoWidth, video.videoHeight);
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.drawImage(video, 0, 0, size.width, size.height);
    pendingDataUrl.value = await canvasToDataUrl(canvas);
    qualityResult.value = scoreFromSamples();
  } catch {
    cameraMessage.value = '촬영 이미지를 저장하지 못했습니다. 다시 촬영해 주세요.';
  } finally {
    isCapturing.value = false;
  }
};

const supportedVideoMimeType = () => {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = [
    'video/webm;codecs=vp8',
    'video/webm',
    'video/mp4',
  ];
  return candidates.find(type => MediaRecorder.isTypeSupported(type)) || '';
};

const startRecording = () => {
  if (!cameraStream || typeof MediaRecorder === 'undefined') {
    cameraMessage.value = '이 기기에서는 동영상 녹화를 사용할 수 없습니다. 왼쪽 버튼으로 동영상을 선택해 주세요.';
    return;
  }
  recordedChunks = [];
  samples.length = 0;
  qualityResult.value = null;
  pendingDataUrl.value = '';
  const mimeType = supportedVideoMimeType();
  try {
    mediaRecorder = new MediaRecorder(cameraStream, mimeType ? { mimeType } : undefined);
  } catch {
    cameraMessage.value = '이 기기에서는 동영상 녹화를 사용할 수 없습니다. 왼쪽 버튼으로 동영상을 선택해 주세요.';
    return;
  }
  mediaRecorder.ondataavailable = event => {
    if (event.data.size > 0) recordedChunks.push(event.data);
  };
  mediaRecorder.onstop = async () => {
    const blob = new Blob(recordedChunks, { type: mediaRecorder?.mimeType || 'video/webm' });
    pendingDataUrl.value = await readFileAsDataUrl(new File([blob], `lp-scratch-guide-${Date.now()}.webm`, { type: blob.type }));
    qualityResult.value = scoreFromSamples();
  };
  mediaRecorder.start(500);
  isRecording.value = true;
  recordingSeconds.value = 0;
  recordingTimer = window.setInterval(() => {
    recordingSeconds.value += 1;
    if (recordingSeconds.value >= MAX_RECORDING_SECONDS) stopRecording();
  }, 1000);
};

const stopRecording = () => {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
  isRecording.value = false;
  if (recordingTimer !== null) window.clearInterval(recordingTimer);
  recordingTimer = null;
};

const handleMainAction = () => {
  if (isVideoMode.value) {
    if (isRecording.value) stopRecording();
    else startRecording();
  } else {
    void capturePhoto();
  }
};

const applyCapture = async () => {
  if (!pendingDataUrl.value || isApplyingCapture.value) return;
  isApplyingCapture.value = true;
  const storageKey = isVideoMode.value ? 'vinyl-check-scanned-record-video' : 'vinyl-check-scanned-record-image';
  await setPendingCapture(isVideoMode.value ? 'video' : 'image', pendingDataUrl.value);
  if (isVideoMode.value) {
    localStorage.removeItem(storageKey);
  } else {
    try {
      localStorage.setItem(storageKey, pendingDataUrl.value);
    } catch {
      localStorage.removeItem(storageKey);
    }
  }
  clearTimers();
  stopCamera();
  await router.push('/app/sell');
};

const pickFallback = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  pendingDataUrl.value = isVideoMode.value ? await readFileAsDataUrl(file) : await resizeImageFileAsDataUrl(file);
  qualityResult.value = {
    score: 70,
    summary: '파일을 직접 선택했습니다. 자세한 품질 분석은 서버 분석에서 확인합니다.',
    brightness: 70,
    reflection: 70,
    stability: 70,
    fit: 70,
  };
};

onMounted(() => {
  void startCamera();
});

onBeforeUnmount(() => {
  if (isRecording.value) stopRecording();
  clearTimers();
  stopCamera();
});
</script>
