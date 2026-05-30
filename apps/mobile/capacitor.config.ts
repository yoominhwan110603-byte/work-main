import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.vinylcheck.app',
  appName: 'Vinyl-Check',
  webDir: 'dist',
  plugins: {
    SocialLogin: {
      providers: {
        google: true,
        facebook: false,
        apple: false,
        twitter: false,
      },
    },
    CapacitorHttp: {
      enabled: true,
    },
    Camera: {
      permissions: ['camera', 'photos'],
    },
  },
};

export default config;
