// src/config/firebase.ts
// Replace these values with your actual Firebase project config
// from Firebase Console > Project Settings > Your Apps

export const FIREBASE_CONFIG = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_AUTH_DOMAIN',
  databaseURL: 'YOUR_DATABASE_URL',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_STORAGE_BUCKET',
  messagingSenderId: 'YOUR_MESSAGING_SENDER_ID',
  appId: 'YOUR_APP_ID',
};

// BLE UUIDs — must match your ESP32-C6 GATT server definitions
export const BLE_CONFIG = {
  SERVICE_UUID: '4FAFC201-1FB5-459E-8FCC-C5C9C331914B',
  EMG_CHARACTERISTIC_UUID: 'BEB5483E-36E1-4688-B7F5-EA07361B26A8',
  IMU_CHARACTERISTIC_UUID: 'BEB5483F-36E1-4688-B7F5-EA07361B26A8',
  STATUS_CHARACTERISTIC_UUID: 'BEB54840-36E1-4688-B7F5-EA07361B26A8',
  CONTROL_CHARACTERISTIC_UUID: 'BEB54841-36E1-4688-B7F5-EA07361B26A8',
  DEVICE_NAME_PREFIX: 'MACKRUN',
};

// EMG processing constants
export const EMG_CONFIG = {
  SAMPLE_RATE: 1000,        // Hz — matches your ESP32 ADC sample rate
  DISPLAY_UPDATE_RATE: 20,  // Hz — chart update rate
  RMS_WINDOW_SIZE: 50,      // samples for RMS calculation
  WARNING_THRESHOLD: 0.5,   // 0-1 scale, above this = yellow (precursors flagged)
  FATIGUE_THRESHOLD: 0.75,  // 0-1 scale, above this = red (triggers fatigue alert)
  MVC_DEFAULT: 1000,        // default max voluntary contraction reference
};

// App theme
export const THEME = {
  background: '#000000',
  surface: '#111111',
  primary: '#FF4D00',
  text: '#FFFFFF',
  textSecondary: '#888888',
  border: '#1A1A1A',
  success: '#00C853',
  warning: '#FFD600',
  danger: '#FF1744',
};
