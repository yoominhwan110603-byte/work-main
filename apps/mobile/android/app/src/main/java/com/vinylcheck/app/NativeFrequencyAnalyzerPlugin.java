package com.vinylcheck.app;

import android.Manifest;
import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaRecorder;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import org.json.JSONException;

@CapacitorPlugin(
    name = "NativeFrequencyAnalyzer",
    permissions = {
        @Permission(strings = { Manifest.permission.RECORD_AUDIO }, alias = NativeFrequencyAnalyzerPlugin.MICROPHONE)
    }
)
public class NativeFrequencyAnalyzerPlugin extends Plugin {
    static final String MICROPHONE = "microphone";

    private static final int SAMPLE_RATE = 44100;
    private static final int FFT_SIZE = 4096;
    private static final int BAR_COUNT = 56;
    private static final int PEAK_COUNT = 14;

    private AudioRecord recorder;
    private Thread workerThread;
    private volatile boolean running;

    @PluginMethod
    public void start(PluginCall call) {
        if (getPermissionState(MICROPHONE) != PermissionState.GRANTED) {
            requestPermissionForAlias(MICROPHONE, call, "startPermissionCallback");
            return;
        }
        startAnalyzer(call);
    }

    @PermissionCallback
    private void startPermissionCallback(PluginCall call) {
        if (getPermissionState(MICROPHONE) != PermissionState.GRANTED) {
            call.reject("마이크 권한이 필요합니다.");
            return;
        }
        startAnalyzer(call);
    }

    private synchronized void startAnalyzer(PluginCall call) {
        if (running) {
            JSObject result = new JSObject();
            result.put("running", true);
            call.resolve(result);
            return;
        }

        int minimumBufferSize = AudioRecord.getMinBufferSize(
            SAMPLE_RATE,
            AudioFormat.CHANNEL_IN_MONO,
            AudioFormat.ENCODING_PCM_16BIT
        );
        if (minimumBufferSize == AudioRecord.ERROR || minimumBufferSize == AudioRecord.ERROR_BAD_VALUE) {
            call.reject("마이크 입력 버퍼를 만들 수 없습니다.");
            return;
        }

        int bufferSize = Math.max(minimumBufferSize, FFT_SIZE * 2);
        try {
            recorder = new AudioRecord(
                MediaRecorder.AudioSource.MIC,
                SAMPLE_RATE,
                AudioFormat.CHANNEL_IN_MONO,
                AudioFormat.ENCODING_PCM_16BIT,
                bufferSize
            );
        } catch (SecurityException error) {
            call.reject("마이크 권한이 필요합니다.");
            return;
        }

        if (recorder.getState() != AudioRecord.STATE_INITIALIZED) {
            cleanupRecorder();
            call.reject("마이크를 시작할 수 없습니다.");
            return;
        }

        running = true;
        workerThread = new Thread(this::runAnalyzer, "VinylCheckFrequencyAnalyzer");
        workerThread.start();

        JSObject result = new JSObject();
        result.put("running", true);
        call.resolve(result);
    }

    @PluginMethod
    public synchronized void stop(PluginCall call) {
        stopAnalyzer();
        call.resolve();
    }

    private void runAnalyzer() {
        short[] pcm = new short[FFT_SIZE];
        double[] real = new double[FFT_SIZE];
        double[] imag = new double[FFT_SIZE];

        try {
            recorder.startRecording();
            while (running) {
                int offset = 0;
                while (running && offset < FFT_SIZE) {
                    int read = recorder.read(pcm, offset, FFT_SIZE - offset);
                    if (read <= 0) break;
                    offset += read;
                }
                if (!running || offset < FFT_SIZE) continue;

                for (int index = 0; index < FFT_SIZE; index += 1) {
                    double window = 0.5 - 0.5 * Math.cos((2.0 * Math.PI * index) / (FFT_SIZE - 1));
                    real[index] = (pcm[index] / 32768.0) * window;
                    imag[index] = 0.0;
                }

                fft(real, imag);
                publishSpectrum(real, imag);
            }
        } catch (Exception ignored) {
            running = false;
        } finally {
            cleanupRecorder();
        }
    }

    private void publishSpectrum(double[] real, double[] imag) throws JSONException {
        int binCount = FFT_SIZE / 2;
        double[] magnitudes = new double[binCount];
        double maxMagnitude = 0.0000001;

        for (int index = 1; index < binCount; index += 1) {
            double magnitude = Math.hypot(real[index], imag[index]);
            magnitudes[index] = magnitude;
            if (magnitude > maxMagnitude) maxMagnitude = magnitude;
        }

        JSObject event = new JSObject();
        event.put("bars", buildBars(magnitudes, maxMagnitude));
        event.put("peaks", collectPeaks(magnitudes, maxMagnitude));
        notifyListeners("spectrum", event);
    }

    private JSArray buildBars(double[] magnitudes, double maxMagnitude) {
        JSArray bars = new JSArray();
        double minHz = 20.0;
        double maxHz = Math.min(16000.0, SAMPLE_RATE / 2.0);
        double binHz = SAMPLE_RATE / (double) FFT_SIZE;

        for (int bucket = 0; bucket < BAR_COUNT; bucket += 1) {
            double startHz = minHz * Math.pow(maxHz / minHz, bucket / (double) BAR_COUNT);
            double endHz = minHz * Math.pow(maxHz / minHz, (bucket + 1) / (double) BAR_COUNT);
            int startBin = Math.max(1, (int) Math.floor(startHz / binHz));
            int endBin = Math.min(magnitudes.length - 1, (int) Math.ceil(endHz / binHz));
            double bucketMax = 0.0;

            for (int index = startBin; index <= endBin; index += 1) {
                bucketMax = Math.max(bucketMax, magnitudes[index]);
            }

            bars.put(Math.max(0, Math.min(100, (int) Math.round((bucketMax / maxMagnitude) * 100.0))));
        }

        return bars;
    }

    private JSArray collectPeaks(double[] magnitudes, double maxMagnitude) throws JSONException {
        JSArray peaks = new JSArray();
        boolean[] used = new boolean[magnitudes.length];
        double binHz = SAMPLE_RATE / (double) FFT_SIZE;
        int minIndex = Math.max(2, (int) Math.ceil(20.0 / binHz));
        int maxIndex = Math.min(magnitudes.length - 2, (int) Math.floor(16000.0 / binHz));

        for (int peakIndex = 0; peakIndex < PEAK_COUNT; peakIndex += 1) {
            int bestIndex = -1;
            double bestMagnitude = 0.0;

            for (int index = minIndex; index <= maxIndex; index += 1) {
                if (used[index]) continue;
                double magnitude = magnitudes[index];
                if (magnitude < magnitudes[index - 1] || magnitude < magnitudes[index + 1]) continue;
                if (magnitude > bestMagnitude) {
                    bestMagnitude = magnitude;
                    bestIndex = index;
                }
            }

            if (bestIndex < 0) break;

            double frequency = bestIndex * binHz;
            int amount = Math.max(0, Math.min(100, (int) Math.round((bestMagnitude / maxMagnitude) * 100.0)));
            if (amount < 2) break;

            JSObject peak = new JSObject();
            peak.put("frequency", frequency);
            peak.put("amount", amount);
            peaks.put(peak);

            int guardBins = Math.max(3, (int) Math.ceil(Math.max(30.0, frequency * 0.035) / binHz));
            for (int index = Math.max(minIndex, bestIndex - guardBins); index <= Math.min(maxIndex, bestIndex + guardBins); index += 1) {
                used[index] = true;
            }
        }

        return peaks;
    }

    private void fft(double[] real, double[] imag) {
        int length = real.length;
        int shift = 1 + Integer.numberOfLeadingZeros(length);

        for (int index = 0; index < length; index += 1) {
            int target = Integer.reverse(index) >>> shift;
            if (target <= index) continue;
            double tempReal = real[index];
            real[index] = real[target];
            real[target] = tempReal;
            double tempImag = imag[index];
            imag[index] = imag[target];
            imag[target] = tempImag;
        }

        for (int size = 2; size <= length; size <<= 1) {
            int halfSize = size >> 1;
            double theta = -2.0 * Math.PI / size;
            double phaseStepReal = Math.cos(theta);
            double phaseStepImag = Math.sin(theta);

            for (int start = 0; start < length; start += size) {
                double phaseReal = 1.0;
                double phaseImag = 0.0;

                for (int offset = 0; offset < halfSize; offset += 1) {
                    int even = start + offset;
                    int odd = even + halfSize;
                    double oddReal = phaseReal * real[odd] - phaseImag * imag[odd];
                    double oddImag = phaseReal * imag[odd] + phaseImag * real[odd];

                    real[odd] = real[even] - oddReal;
                    imag[odd] = imag[even] - oddImag;
                    real[even] += oddReal;
                    imag[even] += oddImag;

                    double nextPhaseReal = phaseReal * phaseStepReal - phaseImag * phaseStepImag;
                    phaseImag = phaseReal * phaseStepImag + phaseImag * phaseStepReal;
                    phaseReal = nextPhaseReal;
                }
            }
        }
    }

    private synchronized void stopAnalyzer() {
        running = false;
        if (recorder != null) {
            try {
                recorder.stop();
            } catch (Exception ignored) {}
        }
        if (workerThread != null) {
            try {
                workerThread.join(500);
            } catch (InterruptedException error) {
                Thread.currentThread().interrupt();
            }
            workerThread = null;
        }
        cleanupRecorder();
    }

    private void cleanupRecorder() {
        if (recorder != null) {
            try {
                recorder.release();
            } catch (Exception ignored) {}
            recorder = null;
        }
    }

    @Override
    protected void handleOnDestroy() {
        stopAnalyzer();
        super.handleOnDestroy();
    }
}
