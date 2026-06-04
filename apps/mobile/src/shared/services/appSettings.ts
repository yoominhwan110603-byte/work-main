import { Capacitor, registerPlugin } from '@capacitor/core';

interface AppSettingsPlugin {
  open(): Promise<{ opened: boolean }>;
}

const AppSettings = registerPlugin<AppSettingsPlugin>('AppSettings');

export async function openAppPermissionSettings() {
  if (!Capacitor.isNativePlatform()) {
    throw new Error('앱 권한 설정은 Android APK에서 사용할 수 있습니다.');
  }
  await AppSettings.open();
}
