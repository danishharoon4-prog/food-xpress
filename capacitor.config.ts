import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.fd539a18451b46e1813e630ffde4a82b',
  appName: 'food-xpress',
  webDir: 'dist',
  backgroundColor: '#FFFFFF',
  // Live updates: app loads the published website directly.
  // Any change published to Lovable will reflect in the app after refresh —
  // no rebuild needed for JS/UI/CSS changes.
  server: {
    url: 'https://food-xpress.lovable.app',
    cleartext: false,
    androidScheme: 'https',
  },
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
    LocalNotifications: {
      iconColor: '#FF6F00',
    },
    // Keyboard resizes the WebView so inputs/buttons never sit behind the
    // soft keyboard on Android. `resize: 'native'` shrinks the web view.
    Keyboard: {
      resize: 'native',
      resizeOnFullScreen: true,
    },
  },
};

export default config;
