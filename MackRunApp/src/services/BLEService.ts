// src/services/BLEService.ts
// Handles all BLE communication with the MackRun ankle hub (ESP32-C6)

import { BleManager, Device, Characteristic, BleError } from 'react-native-ble-plx';
import { Platform, PermissionsAndroid } from 'react-native';
import { BLE_CONFIG } from '../config/firebase';
import { EMGProcessor } from '../utils/EMGProcessor';
import base64 from 'react-native-base64';

export interface EMGData {
  timestamp: number;
  mgRMS: number;       // Medial Gastrocnemius RMS
  taRMS: number;       // Tibialis Anterior RMS
  mgFatigue: number;   // MG fatigue index 0-1
  taFatigue: number;   // TA fatigue index 0-1
  imuAccX: number;
  imuAccY: number;
  imuAccZ: number;
  imuGyroX: number;
  imuGyroY: number;
  imuGyroZ: number;
}

export type ConnectionStatus =
  | 'disconnected'
  | 'scanning'
  | 'connecting'
  | 'connected'
  | 'error';

type EMGDataCallback = (data: EMGData) => void;
type StatusCallback = (status: ConnectionStatus) => void;

class BLEService {
  private manager: BleManager;
  private connectedDevice: Device | null = null;
  private mgProcessor: EMGProcessor;
  private taProcessor: EMGProcessor;
  private emgHistory: { mg: number[]; ta: number[] } = { mg: [], ta: [] };
  private onDataCallback: EMGDataCallback | null = null;
  private onStatusCallback: StatusCallback | null = null;
  private scanTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.manager = new BleManager();
    this.mgProcessor = new EMGProcessor();
    this.taProcessor = new EMGProcessor();
  }

  // Request BLE permissions on Android
  async requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'android') {
      if (Platform.Version >= 31) {
        const results = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ]);
        return Object.values(results).every(
          result => result === PermissionsAndroid.RESULTS.GRANTED
        );
      } else {
        const result = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
        return result === PermissionsAndroid.RESULTS.GRANTED;
      }
    }
    return true; // iOS handles permissions via Info.plist
  }

  // Scan for MackRun devices
  async scanForDevices(
    onDeviceFound: (device: Device) => void,
    timeoutMs: number = 10000
  ): Promise<void> {
    this.updateStatus('scanning');

    const hasPermission = await this.requestPermissions();
    if (!hasPermission) {
      this.updateStatus('error');
      throw new Error('Bluetooth permissions denied');
    }

    // Clear any previous scan
    this.manager.stopDeviceScan();

    this.manager.startDeviceScan(
      [BLE_CONFIG.SERVICE_UUID],
      { allowDuplicates: false },
      (error: BleError | null, device: Device | null) => {
        if (error) {
          console.error('Scan error:', error);
          this.updateStatus('error');
          return;
        }

        if (device && device.name?.startsWith(BLE_CONFIG.DEVICE_NAME_PREFIX)) {
          onDeviceFound(device);
        }
      }
    );

    // Auto-stop scan after timeout
    this.scanTimeout = setTimeout(() => {
      this.manager.stopDeviceScan();
      if (!this.connectedDevice) {
        this.updateStatus('disconnected');
      }
    }, timeoutMs);
  }

  stopScan(): void {
    if (this.scanTimeout) clearTimeout(this.scanTimeout);
    this.manager.stopDeviceScan();
  }

  // Connect to a specific device
  async connectToDevice(device: Device): Promise<void> {
    try {
      this.updateStatus('connecting');
      this.stopScan();

      const connected = await device.connect({
        timeout: 10000,
        autoConnect: false,
      });

      await connected.discoverAllServicesAndCharacteristics();
      this.connectedDevice = connected;
      this.updateStatus('connected');

      // Handle disconnection
      device.onDisconnected((error, disconnectedDevice) => {
        console.log('Device disconnected:', disconnectedDevice?.name);
        this.connectedDevice = null;
        this.updateStatus('disconnected');
      });

      // Subscribe to EMG data
      await this.subscribeToEMG(connected);

      // Subscribe to IMU data
      await this.subscribeToIMU(connected);
    } catch (error) {
      console.error('Connection error:', error);
      this.updateStatus('error');
      throw error;
    }
  }

  // Subscribe to EMG characteristic notifications
  private async subscribeToEMG(device: Device): Promise<void> {
    device.monitorCharacteristicForService(
      BLE_CONFIG.SERVICE_UUID,
      BLE_CONFIG.EMG_CHARACTERISTIC_UUID,
      (error: BleError | null, characteristic: Characteristic | null) => {
        if (error || !characteristic?.value) return;

        const bytes = Array.from(
          Buffer.from(characteristic.value, 'base64')
        );

        // Parse ESP32 packet format:
        // Bytes 0-1: MG raw ADC value
        // Bytes 2-3: TA raw ADC value
        // Bytes 4-5: packet timestamp (ms offset)
        if (bytes.length >= 4) {
          const mgRaw = (bytes[0] << 8) | bytes[1];
          const taRaw = (bytes[2] << 8) | bytes[3];

          const mgRMS = this.mgProcessor.calculateRMS(
            this.mgProcessor.removeBaseline(mgRaw)
          );
          const taRMS = this.taProcessor.calculateRMS(
            this.taProcessor.removeBaseline(taRaw)
          );

          this.emgHistory.mg.push(mgRMS);
          this.emgHistory.ta.push(taRMS);

          // Keep history to last 500 samples
          if (this.emgHistory.mg.length > 500) {
            this.emgHistory.mg.shift();
            this.emgHistory.ta.shift();
          }

          const mgFatigue = this.mgProcessor.calculateFatigueIndex(
            this.emgHistory.mg
          );
          const taFatigue = this.taProcessor.calculateFatigueIndex(
            this.emgHistory.ta
          );

          this.emitData({
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
          });
        }
      }
    );
  }

  // Subscribe to IMU characteristic notifications
  private async subscribeToIMU(device: Device): Promise<void> {
    device.monitorCharacteristicForService(
      BLE_CONFIG.SERVICE_UUID,
      BLE_CONFIG.IMU_CHARACTERISTIC_UUID,
      (error: BleError | null, characteristic: Characteristic | null) => {
        if (error || !characteristic?.value) return;

        const bytes = Array.from(
          Buffer.from(characteristic.value, 'base64')
        );

        // Parse IMU packet: 6x 2-byte int16 values
        // AccX, AccY, AccZ, GyroX, GyroY, GyroZ
        if (bytes.length >= 12) {
          const parseInt16 = (hi: number, lo: number): number => {
            const val = (hi << 8) | lo;
            return val > 32767 ? val - 65536 : val;
          };

          // Merge IMU into last EMG data via callback
          // IMU arrives less frequently than EMG
        }
      }
    );
  }

  // Send control command to device (start/stop session)
  async sendCommand(command: 'START' | 'STOP' | 'CALIBRATE'): Promise<void> {
    if (!this.connectedDevice) throw new Error('No device connected');

    const commandMap: Record<string, number> = {
      START: 0x01,
      STOP: 0x02,
      CALIBRATE: 0x03,
    };

    const byte = commandMap[command];
    const encoded = Buffer.from([byte]).toString('base64');

    await this.connectedDevice.writeCharacteristicWithResponseForService(
      BLE_CONFIG.SERVICE_UUID,
      BLE_CONFIG.CONTROL_CHARACTERISTIC_UUID,
      encoded
    );
  }

  // Disconnect from device
  async disconnect(): Promise<void> {
    if (this.connectedDevice) {
      await this.connectedDevice.cancelConnection();
      this.connectedDevice = null;
      this.updateStatus('disconnected');
    }
  }

  // Event callbacks
  onData(callback: EMGDataCallback): void {
    this.onDataCallback = callback;
  }

  onStatus(callback: StatusCallback): void {
    this.onStatusCallback = callback;
  }

  private emitData(data: EMGData): void {
    this.onDataCallback?.(data);
  }

  private updateStatus(status: ConnectionStatus): void {
    this.onStatusCallback?.(status);
  }

  isConnected(): boolean {
    return this.connectedDevice !== null;
  }

  getConnectedDevice(): Device | null {
    return this.connectedDevice;
  }

  resetProcessors(): void {
    this.mgProcessor.reset();
    this.taProcessor.reset();
    this.emgHistory = { mg: [], ta: [] };
  }

  destroy(): void {
    this.disconnect();
    this.manager.destroy();
  }
}

// Singleton instance
export const bleService = new BLEService();
