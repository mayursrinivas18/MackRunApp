// src/utils/EMGProcessor.ts
// Processes raw EMG data from the ESP32-C6 into useful metrics

import { EMG_CONFIG } from '../config/firebase';

export interface EMGSample {
  timestamp: number;
  rawValue: number;
  rmsValue: number;
  fatigueIndex: number;
  muscleId: 'MG' | 'TA'; // Medial Gastrocnemius or Tibialis Anterior
}

export interface SessionMetrics {
  peakRMS: number;
  averageRMS: number;
  fatigueOnsetTime: number | null;
  totalActivationTime: number;
  coActivationRatio: number;
}

export class EMGProcessor {
  private rmsBuffer: number[] = [];
  private baselineRMS: number = 0;
  private sessionStartTime: number = Date.now();
  private fatigueOnsetTime: number | null = null;
  private mvc: number = EMG_CONFIG.MVC_DEFAULT;

  constructor(mvc?: number) {
    if (mvc) this.mvc = mvc;
  }

  // Parse raw BLE bytes from ESP32 into EMG value
  // ESP32 sends 4 bytes: 2 bytes timestamp offset + 2 bytes ADC value
  parseBytes(bytes: number[]): number {
    if (bytes.length < 2) return 0;
    const high = bytes[bytes.length - 2];
    const low = bytes[bytes.length - 1];
    return (high << 8) | low;
  }

  // Calculate Root Mean Square over window
  calculateRMS(value: number): number {
    this.rmsBuffer.push(value * value);
    if (this.rmsBuffer.length > EMG_CONFIG.RMS_WINDOW_SIZE) {
      this.rmsBuffer.shift();
    }
    const mean = this.rmsBuffer.reduce((a, b) => a + b, 0) / this.rmsBuffer.length;
    return Math.sqrt(mean);
  }

  // Calculate fatigue index using median frequency shift approximation
  // Returns 0-1 scale where 1 = maximum fatigue
  calculateFatigueIndex(rmsHistory: number[]): number {
    if (rmsHistory.length < 10) return 0;

    // Simplified fatigue estimate: ratio of recent RMS to peak RMS
    const recentRMS = rmsHistory.slice(-10).reduce((a, b) => a + b, 0) / 10;
    const peakRMS = Math.max(...rmsHistory);

    if (peakRMS === 0) return 0;

    // As fatigue increases, RMS typically decreases while frequency drops
    const ratio = recentRMS / peakRMS;
    const fatigueIndex = 1 - ratio;

    // Track when fatigue onset occurs
    if (fatigueIndex > EMG_CONFIG.FATIGUE_THRESHOLD && !this.fatigueOnsetTime) {
      this.fatigueOnsetTime = Date.now() - this.sessionStartTime;
    }

    return Math.min(Math.max(fatigueIndex, 0), 1);
  }

  // Normalise value to 0-100% of MVC
  normaliseToMVC(rmsValue: number): number {
    return Math.min((rmsValue / this.mvc) * 100, 100);
  }

  // Set baseline from resting muscle
  setBaseline(samples: number[]): void {
    this.baselineRMS = samples.reduce((a, b) => a + b, 0) / samples.length;
  }

  // Remove baseline DC offset
  removeBaseline(value: number): number {
    return Math.abs(value - this.baselineRMS);
  }

  // Calculate co-activation ratio between MG and TA
  // Returns 0-1 where 1 = perfect co-activation
  static calculateCoActivation(mgRMS: number, taRMS: number): number {
    if (mgRMS === 0 && taRMS === 0) return 0;
    const min = Math.min(mgRMS, taRMS);
    const max = Math.max(mgRMS, taRMS);
    return max > 0 ? min / max : 0;
  }

  // Detect muscle activation above threshold
  isActive(rmsValue: number, threshold: number = 0.1): boolean {
    return rmsValue > threshold * this.mvc;
  }

  reset(): void {
    this.rmsBuffer = [];
    this.fatigueOnsetTime = null;
    this.sessionStartTime = Date.now();
  }

  getFatigueOnsetTime(): number | null {
    return this.fatigueOnsetTime;
  }
}

// Convert RMS value to fatigue colour
export function getFatigueColour(fatigueIndex: number): string {
  if (fatigueIndex < 0.4) return '#00C853'; // green — fresh
  if (fatigueIndex < 0.65) return '#FFD600'; // yellow — moderate
  if (fatigueIndex < 0.8) return '#FF6D00'; // orange — high
  return '#FF1744'; // red — critical
}

// Format milliseconds to MM:SS
export function formatSessionTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
