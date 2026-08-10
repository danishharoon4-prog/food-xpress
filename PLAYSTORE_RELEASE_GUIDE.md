# Food Xpress — Play Store Upload Guide

Play Store sirf **signed AAB** (`.aab`) accept karta hai — debug APK nahi chalta.
Sab kuch GitHub Actions se ban jayega, apke laptop par Android Studio zaroori nahi.

---

## Step 1 — Upload keystore banayein (sirf 1 baar)

Apne computer par (JDK installed hona chahiye):

```bash
keytool -genkey -v -keystore food-xpress-release.keystore \
  -alias food-xpress -keyalg RSA -keysize 2048 -validity 10000
```

- Password yaad rakhein aur keystore file **kabhi delete na karein** (isi se future updates sign hongi).
- Base64 me convert karein:

```bash
# macOS / Linux
base64 -i food-xpress-release.keystore | tr -d '\n' > keystore.b64.txt

# Windows PowerShell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("food-xpress-release.keystore")) | Set-Content keystore.b64.txt
```

---

## Step 2 — GitHub secrets add karein

GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret name | Value |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | `keystore.b64.txt` ka poora content |
| `ANDROID_KEYSTORE_PASSWORD` | keystore password |
| `ANDROID_KEY_ALIAS` | `food-xpress` |
| `ANDROID_KEY_PASSWORD` | key password (aksar wahi store password) |

Optional: `GOOGLE_SERVICES_JSON` (Firebase push ke liye, base64 me).

---

## Step 3 — AAB build karein

GitHub repo → **Actions → "Build Play Store AAB" → Run workflow**:

- **versionName**: `1.0.0`
- **versionCode**: `1` (har naye upload par **badhana zaroori** hai: 2, 3, 4 …)

Build ke baad **Artifacts** se `food-xpress-release-aab` download karein → andar `app-release.aab`.

---

## Step 4 — Play Console par upload

1. [play.google.com/console](https://play.google.com/console) → developer account ($25 one-time).
2. **Create app** → name: `Food Xpress`, language: English/Urdu, type: **App**, Free.
3. **Production → Create new release** → `app-release.aab` upload karein.
4. **Play App Signing** on rakhein (default) — recommended.

### Store listing ke liye zaroori cheezein
| Item | Detail |
| --- | --- |
| App name | Food Xpress |
| Short description | 80 characters tak |
| Full description | 4000 characters tak |
| App icon | 512×512 PNG |
| Feature graphic | 1024×500 PNG/JPG |
| Screenshots | kam se kam 2 phone screenshots (16:9 / 9:16) |
| Privacy Policy URL | `https://food-xpress.lovable.app/legal` |
| Category | Food & Drink |
| Contact email | apka support email |

### Content sections (sab complete karna zaroori)
- **App content**: privacy policy, ads declaration, data safety form, target audience, content rating questionnaire.
- **Data safety**: batayein ke app naam, email, phone, location aur order data collect karta hai (auth + delivery ke liye), encrypted in transit.
- **Permissions**: location (delivery tracking), notifications (order updates), camera/photos (profile & documents) — sab ka justification likhein.

---

## Zaroori warning — "Minimum Functionality" policy

Abhi app `capacitor.config.ts` me `server.url` se live website load karti hai (live updates ke liye).
Google isko kabhi-kabhi "sirf website ka wrapper" keh kar reject kar deta hai.

Reject hone ki surat me safe tareeqa:

1. `capacitor.config.ts` me `server` block comment/remove kar dein (app bundled `dist` chalayegi).
2. Native features highlight karein: push notifications, GPS live tracking, camera — ye already app me hain, review notes me mention karein.
3. Dobara AAB build kar ke upload karein.

Trade-off: `server` hatane par har UI update ke liye naya AAB upload karna hoga.

---

## Updates bhejne ka tareeqa

1. Workflow dobara chalayein, **versionCode +1** aur naya versionName.
2. Play Console → Production → Create new release → naya AAB upload → Rollout.

Pehla review aam taur par **1–7 din** leta hai.
