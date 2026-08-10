// Injects a release signing config into android/app/build.gradle after
// `npx cap add android`. Values come from keystore.properties (local) or
// environment variables (CI).
import fs from "node:fs";
import path from "node:path";

const gradlePath = path.resolve("android/app/build.gradle");
if (!fs.existsSync(gradlePath)) {
  console.error("android/app/build.gradle not found. Run `npx cap add android` first.");
  process.exit(1);
}

let gradle = fs.readFileSync(gradlePath, "utf8");

if (gradle.includes("RELEASE_SIGNING_INJECTED")) {
  console.log("Signing config already injected.");
  process.exit(0);
}

const signingBlock = `
    // RELEASE_SIGNING_INJECTED
    signingConfigs {
        release {
            def props = new Properties()
            def propFile = rootProject.file("keystore.properties")
            if (propFile.exists()) {
                propFile.withInputStream { props.load(it) }
            }
            def storePath = props['storeFile'] ?: System.getenv("ANDROID_KEYSTORE_PATH")
            if (storePath != null) {
                storeFile file(storePath)
                storePassword props['storePassword'] ?: System.getenv("ANDROID_KEYSTORE_PASSWORD")
                keyAlias props['keyAlias'] ?: System.getenv("ANDROID_KEY_ALIAS")
                keyPassword props['keyPassword'] ?: System.getenv("ANDROID_KEY_PASSWORD")
            }
        }
    }
`;

// Insert signingConfigs right after `android {`
gradle = gradle.replace(/android\s*\{/, (m) => `${m}\n${signingBlock}`);

// Attach the signing config to the release build type
gradle = gradle.replace(
  /buildTypes\s*\{\s*release\s*\{/,
  (m) => `${m}\n            signingConfig signingConfigs.release`,
);

fs.writeFileSync(gradlePath, gradle);
console.log("Release signing config injected into android/app/build.gradle");
