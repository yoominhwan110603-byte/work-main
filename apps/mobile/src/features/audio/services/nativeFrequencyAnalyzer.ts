import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';

export type NativeFrequencyPeak = {
  frequency: number;
  amount: number;
};

export type NativeSpectrumEvent = {
  bars: number[];
  peaks: NativeFrequencyPeak[];
};

interface NativeFrequencyAnalyzerPlugin {
  start(): Promise<{ running: boolean }>;
  stop(): Promise<void>;
  addListener(
    eventName: 'spectrum',
    listenerFunc: (event: NativeSpectrumEvent) => void,
  ): Promise<PluginListenerHandle>;
}

const NativeFrequencyAnalyzer = registerPlugin<NativeFrequencyAnalyzerPlugin>('NativeFrequencyAnalyzer');

export const canUseNativeFrequencyAnalyzer = () => Capacitor.isNativePlatform();

export const startNativeFrequencyAnalyzer = () => NativeFrequencyAnalyzer.start();
export const stopNativeFrequencyAnalyzer = () => NativeFrequencyAnalyzer.stop();
export const addNativeFrequencyAnalyzerListener = (listener: (event: NativeSpectrumEvent) => void) =>
  NativeFrequencyAnalyzer.addListener('spectrum', listener);
