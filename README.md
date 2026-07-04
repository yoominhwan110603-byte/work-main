# Vinyl-Check

Vinyl-Check is now maintained around the Android APK in `apps/mobile`.
The old root React/Vite web prototype has been removed from the active project
surface.

## Active project layout

- `apps/mobile`: Vue 3 + Capacitor Android app.
- `apps/mobile/android`: Android APK project.
- `backend`: FastAPI API used by the APK.
- `backend/data`: local JSON runtime storage for the current FastAPI server.

## Mobile source layout

- `apps/mobile/src/features/auth`: splash, login, signup, ID/password recovery, preferences.
- `apps/mobile/src/features/buyer`: home, search, album detail, favorites, comments, price offers.
- `apps/mobile/src/features/seller`: sell flow, camera capture, LP analysis, pricing, received offers.
- `apps/mobile/src/features/transaction`: chat, active transactions, location, cancellation, reviews, reports.
- `apps/mobile/src/features/account`: profile, notifications, settings.
- `apps/mobile/src/shared`: common components, layouts, models, stores, and API utilities.

## Auth setup

- Email/password login works through the local FastAPI backend at `/auth/login`.
- Google login uses Google Identity Services when `VITE_GOOGLE_CLIENT_ID` is set for the mobile Vite app.
- Set the same Google OAuth client id as `GOOGLE_CLIENT_ID` for the backend if you want the server to enforce the token audience.
- Without `VITE_GOOGLE_CLIENT_ID`, the app keeps a local development Google login fallback enabled through `ALLOW_DEV_GOOGLE_LOGIN=true`.

### Google login for APK submission

Create both OAuth clients in Google Cloud:

- Web application client: used by the Vue app and native Android plugin as `VITE_GOOGLE_CLIENT_ID`.
- Android client: used by Google to recognize the installed APK package and SHA-1.

Current Android values:

```text
Package name: com.vinylcheck.app
SHA-1: 9C:31:C7:70:93:AB:A1:FD:22:14:92:6B:46:D6:10:EE:23:C4:AD:CB
```

Then create `apps/mobile/.env.local`:

```env
VITE_GOOGLE_CLIENT_ID=your_web_application_client_id.apps.googleusercontent.com
VITE_GOOGLE_ANDROID_CLIENT_ID=your_android_client_id.apps.googleusercontent.com
```

## Kakao Map setup

Create or open an app at [Kakao Developers](https://developers.kakao.com), then enable Kakao Map in the app settings. For the mobile Vite app, copy the JavaScript key from `[App] > [Platform key]` and register the JavaScript SDK domain for the dev/prod origin you use.

Add the JavaScript key to `apps/mobile/.env.local`:

```env
VITE_KAKAO_MAP_JAVASCRIPT_KEY=your_kakao_javascript_key
```

For backend token audience checking, start the backend with the web client id:

```powershell
$env:GOOGLE_CLIENT_ID="your_web_application_client_id.apps.googleusercontent.com"
```

After changing `.env.local`, rebuild and sync the APK:

```powershell
cd apps/mobile
npm.cmd run build
npm.cmd run cap:sync
cd android
.\gradlew.bat assembleDebug
```

## Common commands

From the repository root:

```powershell
npm.cmd run mobile:build
npm.cmd run mobile:check
npm.cmd run mobile:sync
npm.cmd run android:debug
```

Current LAN API default for APK builds:

```text
http://172.30.1.67:8000
```
