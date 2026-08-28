# MackRun App

React Native app for real-time EMG monitoring, session recording, and coach/athlete communication.

---

## Architecture

```
ESP32-C6 (ankle hub)
    ↓ BLE GATT
Athlete's phone (this app)
    ↓ Firebase Realtime Database (live data)
    ↓ Firebase Firestore (session storage)
Coach's phone (this app)
```

---

## Setup Instructions (Windows)

### Step 1 — Install required tools

1. **Node.js** — download from https://nodejs.org (LTS version)
2. **JDK 17** — download from https://adoptium.net
3. **Android Studio** — download from https://developer.android.com/studio
   - During install, select: Android SDK, Android SDK Platform, Android Virtual Device
4. **VS Code** — download from https://code.visualstudio.com

### Step 2 — Configure Android Studio

1. Open Android Studio → More Actions → SDK Manager
2. Under SDK Platforms: install Android 14 (API 34)
3. Under SDK Tools: install Android SDK Build-Tools 34
4. Note your Android SDK location — you will need it

### Step 3 — Set environment variables (Windows)

Open System Properties → Environment Variables and add:

```
ANDROID_HOME = C:\Users\YOUR_USERNAME\AppData\Local\Android\Sdk
```

Add to PATH:
```
%ANDROID_HOME%\platform-tools
%ANDROID_HOME%\emulator
```

### Step 4 — Install dependencies

```bash
cd MackRunApp
npm install
```

### Step 5 — Set up Firebase

1. Go to https://console.firebase.google.com
2. Create a new project called "mackrun"
3. Add an Android app with package name: com.mackrun.app
4. Download google-services.json and place it in: android/app/
5. Enable these Firebase services:
   - Authentication (Email/Password)
   - Firestore Database
   - Realtime Database
6. Copy your config values into: src/config/firebase.ts

### Step 6 — Run on Android

Connect your Android phone via USB and enable Developer Mode + USB Debugging.

```bash
npx react-native run-android
```

Or start an emulator in Android Studio first, then run the command above.

---

## ESP32-C6 BLE Setup

The app expects the ankle hub ESP32-C6 to advertise a BLE GATT server with these UUIDs:

**Service UUID:**
```
4FAFC201-1FB5-459E-8FCC-C5C9C331914B
```

**Characteristics:**

| Characteristic | UUID | Properties | Description |
|---|---|---|---|
| EMG Data | BEB5483E-... | Notify | 4 bytes: MG_HIGH, MG_LOW, TA_HIGH, TA_LOW |
| IMU Data | BEB5483F-... | Notify | 12 bytes: AccX, AccY, AccZ, GyroX, GyroY, GyroZ (int16 each) |
| Status | BEB54840-... | Read | 1 byte: device status |
| Control | BEB54841-... | Write | 0x01=START, 0x02=STOP, 0x03=CALIBRATE |

**Device name must start with:** `MACKRUN`

Example: `MACKRUN-ANKLE-01`

---

## EMG Data Packet Format

The ESP32 sends 4 bytes per notification at ~20Hz (processed RMS, not raw 1000Hz):

```
Byte 0: MG ADC value high byte
Byte 1: MG ADC value low byte  
Byte 2: TA ADC value high byte
Byte 3: TA ADC value low byte
```

Both values are 12-bit ADC readings (0-4095) from the ESP32-C6 ADC.

---

## App Structure

```
src/
├── config/
│   └── firebase.ts         — Firebase config, BLE UUIDs, theme colours
├── context/
│   └── AppContext.tsx       — Global state management
├── navigation/
│   └── AppNavigator.tsx     — Screen routing (athlete vs coach views)
├── screens/
│   ├── AuthScreen.tsx       — Login / Sign up
│   ├── HomeScreen.tsx       — Athlete home dashboard
│   ├── ConnectScreen.tsx    — BLE device scanning and connection
│   ├── LiveSessionScreen.tsx — Real-time EMG recording
│   ├── SessionHistoryScreen.tsx — Past sessions list
│   ├── CoachDashboardScreen.tsx — Coach live athlete monitoring
│   ├── AthleteDetailScreen.tsx  — Coach view of individual athlete
│   └── SettingsScreen.tsx   — Profile, coach linking, sign out
├── services/
│   ├── BLEService.ts        — BLE connection and data handling
│   └── FirebaseService.ts   — Auth, Firestore, Realtime Database
└── utils/
    └── EMGProcessor.ts      — RMS, fatigue index, co-activation calculations
```

---

## Firebase Database Rules

Add these rules to your Firebase Realtime Database:

```json
{
  "rules": {
    "live_sessions": {
      "$athleteId": {
        ".read": "auth != null",
        ".write": "auth != null && auth.uid == $athleteId"
      }
    }
  }
}
```

And these to Firestore:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      allow read: if request.auth != null;
    }
    match /sessions/{sessionId} {
      allow read, write: if request.auth != null;
    }
    match /alerts/{alertId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

---

## Publishing to Google Play Store

1. Generate a signing keystore:
```bash
keytool -genkeypair -v -storetype PKCS12 -keystore mackrun.keystore -alias mackrun -keyalg RSA -keysize 2048 -validity 10000
```

2. Add to android/gradle.properties:
```
MACKRUN_UPLOAD_STORE_FILE=mackrun.keystore
MACKRUN_UPLOAD_KEY_ALIAS=mackrun
MACKRUN_UPLOAD_STORE_PASSWORD=your_password
MACKRUN_UPLOAD_KEY_PASSWORD=your_password
```

3. Build release APK:
```bash
cd android
./gradlew bundleRelease
```

4. Upload the .aab file to Google Play Console at play.google.com/console

---

## Publishing to Apple App Store (no Mac needed)

1. Install Expo EAS CLI:
```bash
npm install -g eas-cli
eas login
```

2. Configure EAS:
```bash
eas build:configure
```

3. Build for iOS:
```bash
eas build --platform ios
```

4. Submit to App Store:
```bash
eas submit --platform ios
```

---

## Support

hello@mackrun.tech  
mackrun.tech
