import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.fd539a18451b46e1813e630ffde4a82b',
  appName: 'food-xpress',
  webDir: 'dist',
  backgroundColor: '#FFFFFF',
  android: {
    allowMixedContent: false,
    // captureInput must be false — when true, Android WebView intercepts
    // key events before the soft keyboard delivers text to <input> fields,
    // which blocks typing on the login/signup forms.
    captureInput: false,
    webContentsDebuggingEnabled: false,
  },
  
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    SplashScreen: {
      launchShowDuration: 600,
      launchAutoHide: true,
      backgroundColor: '#FF6F00',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#FF6F00',
    },
  },
};

export default config;
