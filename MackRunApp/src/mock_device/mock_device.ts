// src/mock_device/mock_device.ts
//
// Dev-only fake BLE device. Feeds synthetic EMG data through the exact same
// pipeline a real ESP32 sensor uses (bleService.simulateData / simulateStatus),
// so every screen that consumes bleService — HomeScreen's connection pill,
// LiveSessionScreen's charts and FatigueGauges, session saving — behaves
// exactly as it would with real hardware attached. Not wired into any UI;
// trigger it from the JS debugger console (Cmd+D or Shake -> Debug) via:
//
//   mockDevice.start(30)        // quality 0-100, defaults to a 7 min session
//   mockDevice.start(80, 10)    // quality 80, 10 minute session
//   mockDevice.stop()
//
// quality: 0 = terrible (precursors fire early, ends deep in the red)
//          100 = great (stays green the whole session)

import { bleService, EMGData } from '../services/BLEService';
import { EMG_CONFIG } from '../config/firebase';

const SAMPLE_INTERVAL_MS = 1000 / EMG_CONFIG.DISPLAY_UPDATE_RATE; // 20Hz
const DEFAULT_DURATION_MIN = 7;
const MIN_DURATION_MIN = 5;
const MAX_DURATION_MIN = 10;
const BASE_RMS = 500;

let intervalHandle: ReturnType<typeof setInterval> | null = null;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function stopMockSession(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    console.log('[mock_device] session stopped');
  }
}

export function startMockSession(
  qualityScore: number,
  durationMinutes: number = DEFAULT_DURATION_MIN
): void {
  stopMockSession();

  const quality = clamp(qualityScore, 0, 100);
  const badness = (100 - quality) / 100; // 0 = great, 1 = terrible
  const durationMs =
    clamp(durationMinutes, MIN_DURATION_MIN, MAX_DURATION_MIN) * 60 * 1000;

  // Slight per-channel variation so MG and TA don't move in lockstep.
  const mgBias = 0.9 + Math.random() * 0.2;
  const taBias = 0.9 + Math.random() * 0.2;

  const startTime = Date.now();

  bleService.setMockMode(true);
  bleService.simulateStatus('connected');
  // So tapping "Stop Session" in the real UI actually stops this timer,
  // instead of the mock just running for its full configured duration.
  bleService.onMockCommand(command => {
    if (command === 'STOP') stopMockSession();
  });

  console.log(
    `[mock_device] session started — quality=${quality} duration=${(durationMs / 60000).toFixed(1)}min`
  );

  intervalHandle = setInterval(() => {
    const elapsed = Date.now() - startTime;
    const progress = clamp(elapsed / durationMs, 0, 1);

    // Ease-in fatigue ramp toward a ceiling set by how bad this session is.
    const fatigueBase = badness * Math.pow(progress, 0.7);
    const noise = () => (Math.random() - 0.5) * 0.06;

    const mgFatigue = clamp(fatigueBase * mgBias + noise(), 0, 1);
    const taFatigue = clamp(fatigueBase * taBias + noise(), 0, 1);

    // RMS drifts down as fatigue rises, with a slow oscillation so the
    // live chart looks like muscle activity instead of a flat line.
    const activity = 0.85 + 0.15 * Math.sin(elapsed / 600);
    const mgRMS = Math.max(BASE_RMS * (1 - 0.4 * mgFatigue) * activity + noise() * 30, 0);
    const taRMS = Math.max(BASE_RMS * (1 - 0.4 * taFatigue) * activity + noise() * 30, 0);

    const data: EMGData = {
      timestamp: Date.now(),
      mgRMS,
      taRMS,
      mgFatigue,
      taFatigue,
      imuAccX: 0,
      imuAccY: 0,
      imuAccZ: 0,
      imuGyroX: 0,
      imuGyroY: 0,
      imuGyroZ: 0,
    };

    bleService.simulateData(data);

    if (progress >= 1) {
      stopMockSession();
      // Session ran its full course without anyone tapping "Stop" — make
      // sure it still gets saved to History instead of just vanishing.
      bleService.simulateSessionComplete();
    }
  }, SAMPLE_INTERVAL_MS);
}

if (__DEV__) {
  // @ts-ignore — dev-only console hook, not part of the app's real surface
  global.mockDevice = { start: startMockSession, stop: stopMockSession };

  // Uncomment to auto-start a mock session on app launch instead of using
  // the debugger console. First number is quality 0-100, second is minutes.
  // Delayed so the app's own connection-status listener is mounted first —
  // firing this at module-load time is too early and the event is lost.
  setTimeout(() => startMockSession(57, 3), 1000);
}
