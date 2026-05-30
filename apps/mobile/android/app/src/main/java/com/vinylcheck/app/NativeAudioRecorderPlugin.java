package com.vinylcheck.app;

import android.Manifest;
import android.media.MediaRecorder;
import android.os.Build;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;

@CapacitorPlugin(
    name = "NativeAudioRecorder",
    permissions = {
        @Permission(strings = { Manifest.permission.RECORD_AUDIO }, alias = NativeAudioRecorderPlugin.MICROPHONE)
    }
)
public class NativeAudioRecorderPlugin extends Plugin {
    static final String MICROPHONE = "microphone";

    private MediaRecorder recorder;
    private File outputFile;
    private long startedAt;

    @PluginMethod
    public void start(PluginCall call) {
        if (getPermissionState(MICROPHONE) != PermissionState.GRANTED) {
            requestPermissionForAlias(MICROPHONE, call, "startPermissionCallback");
            return;
        }
        startRecording(call);
    }

    @PermissionCallback
    private void startPermissionCallback(PluginCall call) {
        if (getPermissionState(MICROPHONE) != PermissionState.GRANTED) {
            call.reject("마이크 권한이 필요합니다.");
            return;
        }
        startRecording(call);
    }

    private void startRecording(PluginCall call) {
        if (recorder != null) {
            call.reject("이미 녹음 중입니다.");
            return;
        }
        try {
            outputFile = File.createTempFile("vinyl-check-audio-", ".m4a", getContext().getCacheDir());
            recorder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
                ? new MediaRecorder(getContext())
                : new MediaRecorder();
            recorder.setAudioSource(MediaRecorder.AudioSource.MIC);
            recorder.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4);
            recorder.setAudioEncoder(MediaRecorder.AudioEncoder.AAC);
            recorder.setAudioSamplingRate(44100);
            recorder.setAudioEncodingBitRate(128000);
            recorder.setOutputFile(outputFile.getAbsolutePath());
            recorder.prepare();
            recorder.start();
            startedAt = System.currentTimeMillis();
            JSObject result = new JSObject();
            result.put("recording", true);
            call.resolve(result);
        } catch (Exception error) {
            cleanup();
            call.reject("녹음을 시작하지 못했습니다: " + error.getMessage());
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        if (recorder == null || outputFile == null) {
            call.reject("진행 중인 녹음이 없습니다.");
            return;
        }
        try {
            recorder.stop();
            recorder.release();
            recorder = null;

            byte[] bytes = readAllBytes(outputFile);
            String base64 = Base64.encodeToString(bytes, Base64.NO_WRAP);
            JSObject result = new JSObject();
            result.put("mimeType", "audio/mp4");
            result.put("extension", "m4a");
            result.put("durationMs", Math.max(0, System.currentTimeMillis() - startedAt));
            result.put("dataUrl", "data:audio/mp4;base64," + base64);
            result.put("size", bytes.length);
            outputFile.delete();
            outputFile = null;
            call.resolve(result);
        } catch (Exception error) {
            cleanup();
            call.reject("녹음을 저장하지 못했습니다: " + error.getMessage());
        }
    }

    private byte[] readAllBytes(File file) throws IOException {
        try (FileInputStream input = new FileInputStream(file)) {
            byte[] bytes = new byte[(int) file.length()];
            int offset = 0;
            while (offset < bytes.length) {
                int read = input.read(bytes, offset, bytes.length - offset);
                if (read < 0) break;
                offset += read;
            }
            return bytes;
        }
    }

    private void cleanup() {
        if (recorder != null) {
            try {
                recorder.release();
            } catch (Exception ignored) {}
            recorder = null;
        }
        if (outputFile != null) {
            outputFile.delete();
            outputFile = null;
        }
    }
}
