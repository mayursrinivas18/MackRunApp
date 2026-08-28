// src/screens/ConnectScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  SafeAreaView, ActivityIndicator, Alert,
} from 'react-native';
import { Device } from 'react-native-ble-plx';
import { bleService, ConnectionStatus } from '../services/BLEService';
import { useApp } from '../context/AppContext';
import { THEME } from '../config/firebase';

export default function ConnectScreen() {
  const { state, dispatch } = useApp();
  const [devices, setDevices] = useState<Device[]>([]);
  const [scanning, setScanning] = useState(false);
  const [connecting, setConnecting] = useState<string | null>(null);

  const startScan = async () => {
    setDevices([]);
    setScanning(true);

    try {
      await bleService.scanForDevices(
        device => {
          setDevices(prev => {
            const exists = prev.find(d => d.id === device.id);
            if (exists) return prev;
            return [...prev, device];
          });
        },
        10000
      );
    } catch (error: any) {
      Alert.alert('Scan Error', error.message || 'Failed to scan for devices');
    } finally {
      setScanning(false);
    }
  };

  const connectToDevice = async (device: Device) => {
    setConnecting(device.id);
    try {
      await bleService.connectToDevice(device);
      dispatch({ type: 'SET_CONNECTED_DEVICE', payload: device });
      Alert.alert('Connected', `Successfully connected to ${device.name}`);
    } catch (error: any) {
      Alert.alert('Connection Failed', error.message || 'Could not connect to device');
    } finally {
      setConnecting(null);
    }
  };

  const disconnect = async () => {
    await bleService.disconnect();
    dispatch({ type: 'SET_CONNECTED_DEVICE', payload: null });
  };

  const isConnected = state.connectionStatus === 'connected';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>

        {/* Header */}
        <Text style={styles.title}>Device</Text>
        <Text style={styles.subtitle}>Connect your MackRun ankle hub</Text>

        {/* Status card */}
        <View style={[
          styles.statusCard,
          { borderColor: isConnected ? THEME.success : THEME.border }
        ]}>
          <View style={[
            styles.statusDot,
            { backgroundColor: isConnected ? THEME.success : THEME.danger }
          ]} />
          <View style={styles.statusInfo}>
            <Text style={styles.statusTitle}>
              {isConnected
                ? state.connectedDevice?.name || 'MackRun Device'
                : 'No device connected'}
            </Text>
            <Text style={styles.statusSub}>
              {getStatusText(state.connectionStatus)}
            </Text>
          </View>
          {isConnected && (
            <TouchableOpacity style={styles.disconnectBtn} onPress={disconnect}>
              <Text style={styles.disconnectText}>Disconnect</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Scan button */}
        {!isConnected && (
          <TouchableOpacity
            style={[styles.scanBtn, scanning && styles.scanBtnActive]}
            onPress={scanning ? () => bleService.stopScan() : startScan}>
            {scanning ? (
              <View style={styles.scanningRow}>
                <ActivityIndicator color={THEME.primary} size="small" />
                <Text style={styles.scanBtnText}>Scanning...</Text>
              </View>
            ) : (
              <Text style={styles.scanBtnText}>Scan for Devices</Text>
            )}
          </TouchableOpacity>
        )}

        {/* Device list */}
        {devices.length > 0 && (
          <>
            <Text style={styles.listTitle}>FOUND DEVICES</Text>
            <FlatList
              data={devices}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.deviceCard}
                  onPress={() => connectToDevice(item)}
                  disabled={connecting === item.id}>
                  <View style={styles.deviceInfo}>
                    <Text style={styles.deviceName}>{item.name || 'Unknown Device'}</Text>
                    <Text style={styles.deviceId}>{item.id}</Text>
                    <Text style={styles.deviceRSSI}>Signal: {item.rssi} dBm</Text>
                  </View>
                  {connecting === item.id ? (
                    <ActivityIndicator color={THEME.primary} />
                  ) : (
                    <Text style={styles.connectText}>Connect →</Text>
                  )}
                </TouchableOpacity>
              )}
            />
          </>
        )}

        {/* Instructions */}
        {!scanning && devices.length === 0 && !isConnected && (
          <View style={styles.instructions}>
            <Text style={styles.instructionTitle}>Before scanning:</Text>
            <Text style={styles.instructionItem}>1. Ensure ankle hub is powered on</Text>
            <Text style={styles.instructionItem}>2. Keep device within 5 metres</Text>
            <Text style={styles.instructionItem}>3. Enable Bluetooth on your phone</Text>
          </View>
        )}

      </View>
    </SafeAreaView>
  );
}

function getStatusText(status: ConnectionStatus): string {
  switch (status) {
    case 'connected': return 'Ready to record';
    case 'connecting': return 'Connecting...';
    case 'scanning': return 'Scanning...';
    case 'error': return 'Connection error';
    default: return 'Tap Scan to find your device';
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.background },
  content: { flex: 1, padding: 20 },
  title: { fontSize: 28, fontWeight: '900', color: THEME.text, marginTop: 8, marginBottom: 4 },
  subtitle: { fontSize: 14, color: THEME.textSecondary, marginBottom: 24 },
  statusCard: {
    backgroundColor: THEME.surface,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    marginBottom: 20,
    gap: 12,
  },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusInfo: { flex: 1 },
  statusTitle: { fontSize: 15, fontWeight: '700', color: THEME.text },
  statusSub: { fontSize: 12, color: THEME.textSecondary, marginTop: 2 },
  disconnectBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: THEME.danger,
  },
  disconnectText: { fontSize: 12, color: THEME.danger, fontWeight: '600' },
  scanBtn: {
    backgroundColor: THEME.primary,
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  scanBtnActive: { backgroundColor: THEME.surface, borderWidth: 1, borderColor: THEME.primary },
  scanningRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  scanBtnText: { fontSize: 16, fontWeight: '900', color: '#000', letterSpacing: 0.5 },
  listTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.textSecondary,
    letterSpacing: 2,
    marginBottom: 10,
  },
  deviceCard: {
    backgroundColor: THEME.surface,
    borderRadius: 10,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  deviceInfo: { flex: 1 },
  deviceName: { fontSize: 15, fontWeight: '700', color: THEME.text },
  deviceId: { fontSize: 11, color: THEME.textSecondary, marginTop: 2 },
  deviceRSSI: { fontSize: 11, color: THEME.textSecondary },
  connectText: { fontSize: 13, color: THEME.primary, fontWeight: '700' },
  instructions: {
    backgroundColor: THEME.surface,
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  instructionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.text,
    marginBottom: 10,
  },
  instructionItem: {
    fontSize: 13,
    color: THEME.textSecondary,
    lineHeight: 24,
  },
});
