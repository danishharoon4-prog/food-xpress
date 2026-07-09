# Android App Improvements Plan

Sirf Android (Capacitor) app pe kaam hoga. Website ka koi user-facing behavior nahi todega.

## 1. App smoothness (performance)

- `capacitor.config.ts` mein Android WebView tuning add karna: `android.webContentsDebuggingEnabled: false` production ke liye, `allowMixedContent: true` sirf debug, `backgroundColor: '#FFFFFF'` (blank flash rokay).
- `SplashScreen.launchShowDuration` 1500ms → 800ms (fast startup feel).
- `App.tsx` mein already `lazy()` route splitting hai to bas verify karenge — heavy pages (`AdminReports`, `LiveTrackingMap`, `OrderTracking`) already lazy hain, koi extra lazy nahi chahiye agar hain.
- `useMotionPreference` ko default `reduced` bana denge sirf jab `Capacitor.isNativePlatform()` — Android WebView pe framer-motion aur bari transitions jerky lagti hain.
- `PageTransition` component ka opacity fade native pe skip karenge (instant switch).

## 2. GPS "please allow location access in your browser" fix

Root cause: `LocationPicker.tsx` aur kuch dosray jagah abhi bhi `navigator.geolocation` seedha use ho raha hai. Android WebView is prompt ko block karta hai to hamesha "denied" milta hai.

Fix:
- `LocationPicker.tsx` ka `locateMe()` aur initial-load GPS call `useLocation` hook ke `getCurrentLocation()` se replace karenge (wo pehle se Capacitor Geolocation handle karta hai native pe).
- Baaqi jagah bhi (e.g. `hooks/useBrowserNotifications.ts` agar location use karta ho) ek grep chala ke fix karenge.
- Error message improve: agar native permission denied ho to Urdu-friendly toast + "Settings → App → Permissions → Location allow karain" hint.

## 3. Toast / in-app notification UI polish

- Sonner `<Toaster>` config: `richColors`, `position="top-center"` mobile pe (currently likely bottom-right), rounded shadow, thicker text, safe-area padding (Android status bar overlap).
- Toast duration 4s → 3s.
- Success/error/warning ke liye colored border-left accent, icon larger.

## 4. Image uploads enable karna

Buckets already hain: `avatars` (private), `rider-documents` (private). Zaroorat:

- **`support-attachments`** naya private bucket for support chat images.
- **RLS policies** on `storage.objects` for tino buckets:
  - `avatars`: user apni file (`<uid>/…`) upload/read/delete kar sakay; admin sab dekh sakay; authenticated user kisi bhi avatar read kar sakay (profile pics public-ish).
  - `rider-documents`: sirf owning rider + admin upload/read.
  - `support-attachments`: sirf ticket owner + admin.
- **Capacitor Camera plugin** (`@capacitor/camera`) install: native pe camera/gallery se image pick karna smooth ho (browser file input WebView pe flaky).
- `ImageCropInput.tsx` ko update: native pe pehle `Camera.getPhoto()`, fir crop, fir upload; web pe wahi purana flow.
- Ek helper `src/lib/uploadImage.ts` — bucket + path + file → returns signed URL.
- Profile page, Rider docs upload page aur SupportChat mein use.

## 5. Background running

Do alag cheezein:

### 5a. Notifications background (FCM push)

- Firebase project user ke paas hona chahiye. `google-services.json` file android app ke `android/app/` folder mein add karni hogi — yeh sirf user local pe kar sakta hai (GitHub Actions build workflow mein secret ke tor pe add kar sakte hain).
- Workflow (`.github/workflows/main.yml`) mein new step: agar `GOOGLE_SERVICES_JSON` secret set ho to decode karke `android/app/google-services.json` mein likhna. Warna skip (crash na ho).
- `.env` mein `VITE_FCM_ENABLED=true` set karnay ki condition — currently guard laga hai to native crash nahi hoga.
- Registration flow already `src/lib/fcmPush.ts` mein hai — bas guard ko flip karnay ka instruction dena hoga.
- Instructions user ko: Firebase console pe project banayen, `google-services.json` download karen, GitHub repo Settings → Secrets mein `GOOGLE_SERVICES_JSON` (base64) daalen. Main workflow update kar dunga.

### 5b. Rider live location in background

- `@capacitor-community/background-geolocation` plugin install.
- Naya hook `src/hooks/useBackgroundRiderTracking.ts` — sirf jab rider `is_online = true` aur `Capacitor.isNativePlatform()`, background service start kare, har 30 sec pe coords ko `rider_locations` table (ya `riders` row) mein update kare.
- `AndroidManifest` permissions Capacitor plugin auto-merge kar deta hai (`ACCESS_BACKGROUND_LOCATION`, `FOREGROUND_SERVICE`).
- Rider ko warning dialog first-time: "Battery zyada use ho gi. Background location allow karain."
- Off toggle: rider dashboard mein "Go Offline" button service stop kare.

## Technical notes

- New npm packages: `@capacitor/camera`, `@capacitor-community/background-geolocation`.
- Workflow already `npx cap sync android` chalata hai, permissions auto-merge ho jayen gi.
- No web behavior change: har naya plugin `Capacitor.isNativePlatform()` guard ke pichay.
- DB change: sirf `rider_locations` table agar pehle nahi hai (check karna hai). RLS: rider apni row write kare, admin + assigned customer read kar sakay.

## User steps after merge

1. `git pull`
2. GitHub → Settings → Secrets → `GOOGLE_SERVICES_JSON` add karain (base64 of Firebase file). Skip agar push notifications ki abhi zaroorat nahi.
3. GitHub Actions → Build Android APK → Run
4. Naya APK install (purana uninstall karke)
5. Pehli baar permissions prompts (Location, Camera, Notifications, Background) → "Allow all the time" (rider ke liye) select karen

---

Shall I go ahead and implement all 5 sections? Ya kisi ek pe pehle focus karain (e.g. sirf GPS + toast + uploads pehle, background stuff baad mein)?
