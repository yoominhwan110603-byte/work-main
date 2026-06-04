import { Capacitor, registerPlugin } from '@capacitor/core';

interface NativeAudioRecorderStartResult {
  recording: boolean;
}

interface NativeAudioRecorderStopResult {
  dataUrl: string;
  mimeType: string;
  extension: string;
  durationMs: number;
  size: number;
}

interface NativeAudioRecorderPlugin {
  start(): Promise<NativeAudioRecorderStartResult>;
  stop(): Promise<NativeAudioRecorderStopResult>;
}

const NativeAudioRecorder = registerPlugin<NativeAudioRecorderPlugin>('NativeAudioRecorder');

export function canUseNativeAudioRecorder() {
  return Capacitor.isNativePlatform();
}

export const startNativeAudioRecording = () => NativeAudioRecorder.start();
export const stopNativeAudioRecording = () => NativeAudioRecorder.stop();
