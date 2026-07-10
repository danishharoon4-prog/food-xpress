# Android App Links Setup — food-xpress.lovable.app

Jab koi user apne mobile browser / WhatsApp / SMS me `https://food-xpress.lovable.app` link kholega, wo seedha Food Express Android app me khulega (agar app installed hai).

---

## Step 1 — SHA256 fingerprints nikaalein

### Debug key (testing)
```powershell
keytool -list -v -keystore "$env:USERPROFILE\.android\debug.keystore" -alias androiddebugkey -storepass android -keypass android
```
`SHA256:` wali line copy karein (colons ke saath, e.g. `AB:CD:EF:...`).

### Release key (Play Store ke liye)
Google Play Console → apni app → **Setup → App Integrity → App signing** → **SHA-256 certificate fingerprint** copy karein.

---

## Step 2 — `public/.well-known/assetlinks.json` update karein

File pehle se bani hai. Do placeholders replace karein:
- `REPLACE_WITH_DEBUG_SHA256_FINGERPRINT`
- `REPLACE_WITH_RELEASE_SHA256_FINGERPRINT`

Deploy ke baad file yahaan accessible honi chahiye:
`https://food-xpress.lovable.app/.well-known/assetlinks.json`

Verify:
```
curl https://food-xpress.lovable.app/.well-known/assetlinks.json
```

---

## Step 3 — AndroidManifest.xml me intent filter add karein

`android/app/src/main/AndroidManifest.xml` kholein. `MainActivity` `<activity>` ke andar ye intent-filter add karein (existing `LAUNCHER` intent-filter ke baad):

```xml
<intent-filter android:autoVerify="true">
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="https" />
    <data android:host="food-xpress.lovable.app" />
</intent-filter>
```

---

## Step 4 — Rebuild aur test

```bash
npm run build
npx cap sync android
npx cap run android
```

App install hone ke baad, phone me kisi bhi jagah (WhatsApp / Chrome / SMS) `https://food-xpress.lovable.app` link tap karein — app khulni chahiye, browser me nahi jaana chahiye.

### Verification check (installed device pe)
```bash
adb shell pm get-app-links app.lovable.fd539a18451b46e1813e630ffde4a82b
```
Expected: `food-xpress.lovable.app: verified`

Agar `verified` nahi aata:
- Confirm karein `https://food-xpress.lovable.app/.well-known/assetlinks.json` publicly accessible hai (200 OK, `application/json`).
- Fingerprint bilkul match karta ho (koi extra space / typo nahi).
- App reinstall karein (`autoVerify` sirf install/update pe run hota hai).

---

## Notes
- Publish karne ke baad hi assetlinks.json live hoga. Isliye pehle **Publish** karein, phir Step 4.
- Agar Play Console **Play App Signing** use ho raha hai (default), release SHA-256 wahin se lena — apki local keystore se nahi.
