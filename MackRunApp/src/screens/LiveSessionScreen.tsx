// src/screens/LiveSessionScreen.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  SafeAreaView, ScrollView, Alert, Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LineChart } from 'react-native-chart-kit';
import { useApp } from '../context/AppContext';
import { firebaseService } from '../services/FirebaseService';
import { bleService } from '../services/BLEService';
import { EMGData } from '../services/BLEService';
import { THEME, EMG_CONFIG } from '../config/firebase';
import {
  getFatigueColour,
  formatSessionTime,
  EMGProcessor,
} from '../utils/EMGProcessor';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_POINTS = 50;

export default function LiveSessionScreen() {
  const { state, dispatch } = useApp();
  const navigation = useNavigation();

  const [isRecording, setIsRecording] = useState(false);
  const [sessionTime, setSessionTime] = useState(0);
  const [mgData, setMGData] = useState<number[]>(new Array(CHART_POINTS).fill(0));
  const [taData, setTAData] = useState<number[]>(new Array(CHART_POINTS).fill(0));
  const [currentMGRMS, setCurrentMGRMS] = useState(0);
  const [currentTARMS, setCurrentTARMS] = useState(0);
  const [mgFatigue, setMGFatigue] = useState(0);
  const [taFatigue, setTAFatigue] = useState(0);
  const [alertSent, setAlertSent] = useState(false);

  const sessionStartRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionDataRef = useRef({
    peakMGRMS: 0,
    peakTARMS: 0,
    mgFatigueHistory: [] as number[],
    taFatigueHistory: [] as number[],
  });

  // Handle incoming EMG data
  const handleEMGData = useCallback((data: EMGData) => {
    if (!isRecording) return;

    setCurrentMGRMS(data.mgRMS);
    setCurrentTARMS(data.taRMS);
    setMGFatigue(data.mgFatigue);
    setTAFatigue(data.taFatigue);

    // Update rolling chart data
    setMGData(prev => [...prev.slice(1), data.mgRMS]);
    setTAData(prev => [...prev.slice(1), data.taRMS]);

    // Track session metrics
    sessionDataRef.current.peakMGRMS = Math.max(
      sessionDataRef.current.peakMGRMS,
      data.mgRMS
    );
    sessionDataRef.current.peakTARMS = Math.max(
      sessionDataRef.current.peakTARMS,
      data.taRMS
    );
    sessionDataRef.current.mgFatigueHistory.push(data.mgFatigue);
    sessionDataRef.current.taFatigueHistory.push(data.taFatigue);

    // Push to Firebase for coach visibility
    if (state.user) {
      const elapsed = Date.now() - sessionStartRef.current;
      firebaseService.pushLiveData(state.user.uid, data, elapsed);
    }

    // Send fatigue alert to coach if threshold exceeded
    if (
      !alertSent &&
      state.user?.coachId &&
      (data.mgFatigue > EMG_CONFIG.FATIGUE_THRESHOLD ||
        data.taFatigue > EMG_CONFIG.FATIGUE_THRESHOLD)
    ) {
      const muscle = data.mgFatigue > data.taFatigue ? 'MG' : 'TA';
      const fatigue = Math.max(data.mgFatigue, data.taFatigue);
      firebaseService.sendFatigueAlert(
        state.user.uid,
        state.user.name,
        state.user.coachId,
        fatigue,
        muscle
      );
      setAlertSent(true);
    }
  }, [isRecording, state.user, alertSent]);

  useEffect(() => {
    bleService.onData(handleEMGData);
  }, [handleEMGData]);

  const startSession = async () => {
    try {
      await bleService.sendCommand('START');
      bleService.resetProcessors();
      sessionStartRef.current = Date.now();
      sessionDataRef.current = {
        peakMGRMS: 0,
        peakTARMS: 0,
        mgFatigueHistory: [],
        taFatigueHistory: [],
      };
      setAlertSent(false);
      setIsRecording(true);

      timerRef.current = setInterval(() => {
        setSessionTime(Date.now() - sessionStartRef.current);
      }, 1000);
    } catch (error) {
      Alert.alert('Error', 'Failed to start session');
    }
  };

  const stopSession = async () => {
    if (!isRecording) return;

    Alert.alert('Stop Session', 'End this session?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Stop',
        style: 'destructive',
        onPress: async () => {
          setIsRecording(false);
          if (timerRef.current) clearInterval(timerRef.current);
          await bleService.sendCommand('STOP');

          // Calculate averages
          const sd = sessionDataRef.current;
          const avgMGFatigue = sd.mgFatigueHistory.length > 0
            ? sd.mgFatigueHistory.reduce((a, b) => a + b, 0) / sd.mgFatigueHistory.length
            : 0;
          const avgTAFatigue = sd.taFatigueHistory.length > 0
            ? sd.taFatigueHistory.reduce((a, b) => a + b, 0) / sd.taFatigueHistory.length
            : 0;

          // Save session
          if (state.user) {
            await firebaseService.saveSession({
              athleteId: state.user.uid,
              athleteName: state.user.name,
              startTime: sessionStartRef.current,
              endTime: Date.now(),
              duration: sessionTime,
              peakMGRMS: sd.peakMGRMS,
              peakTARMS: sd.peakTARMS,
              avgMGFatigue,
              avgTAFatigue,
              fatigueOnsetTime: null,
              coActivationRatio: EMGProcessor.calculateCoActivation(
                sd.peakMGRMS,
                sd.peakTARMS
              ),
              notes: '',
            });

            await firebaseService.clearLiveData(state.user.uid);
          }

          navigation.goBack();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView bounces={false} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.timerLabel}>SESSION TIME</Text>
            <Text style={styles.timer}>{formatSessionTime(sessionTime)}</Text>
          </View>
          <View style={[
            styles.recordingPill,
            { backgroundColor: isRecording ? '#FF174420' : '#1A1A1A' }
          ]}>
            <View style={[
              styles.recordingDot,
              { backgroundColor: isRecording ? THEME.danger : THEME.textSecondary }
            ]} />
            <Text style={[
              styles.recordingText,
              { color: isRecording ? THEME.danger : THEME.textSecondary }
            ]}>
              {isRecording ? 'RECORDING' : 'STOPPED'}
            </Text>
          </View>
        </View>

        {/* MG Chart */}
        <View style={styles.chartSection}>
          <View style={styles.chartHeader}>
            <Text style={styles.chartTitle}>Medial Gastrocnemius</Text>
            <View style={[
              styles.fatiguePill,
              { backgroundColor: getFatigueColour(mgFatigue) + '30' }
            ]}>
              <Text style={[styles.fatigueText, { color: getFatigueColour(mgFatigue) }]}>
                {Math.round(mgFatigue * 100)}% fatigue
              </Text>
            </View>
          </View>
          <LineChart
            data={{
              labels: [],
              datasets: [{ data: mgData.map(v => Math.max(v, 0.001)) }],
            }}
            width={SCREEN_WIDTH - 32}
            height={120}
            chartConfig={{
              backgroundColor: THEME.surface,
              backgroundGradientFrom: THEME.surface,
              backgroundGradientTo: THEME.surface,
              decimalPlaces: 0,
              color: () => THEME.primary,
              labelColor: () => THEME.textSecondary,
              propsForDots: { r: '0' },
            }}
            bezier
            withDots={false}
            withInnerLines={false}
            withOuterLines={false}
            withXLabels={false}
            style={styles.chart}
          />
        </View>

        {/* TA Chart */}
        <View style={styles.chartSection}>
          <View style={styles.chartHeader}>
            <Text style={styles.chartTitle}>Tibialis Anterior</Text>
            <View style={[
              styles.fatiguePill,
              { backgroundColor: getFatigueColour(taFatigue) + '30' }
            ]}>
              <Text style={[styles.fatigueText, { color: getFatigueColour(taFatigue) }]}>
                {Math.round(taFatigue * 100)}% fatigue
              </Text>
            </View>
          </View>
          <LineChart
            data={{
              labels: [],
              datasets: [{ data: taData.map(v => Math.max(v, 0.001)) }],
            }}
            width={SCREEN_WIDTH - 32}
            height={120}
            chartConfig={{
              backgroundColor: THEME.surface,
              backgroundGradientFrom: THEME.surface,
              backgroundGradientTo: THEME.surface,
              decimalPlaces: 0,
              color: () => '#00BFFF',
              labelColor: () => THEME.textSecondary,
              propsForDots: { r: '0' },
            }}
            bezier
            withDots={false}
            withInnerLines={false}
            withOuterLines={false}
            withXLabels={false}
            style={styles.chart}
          />
        </View>

        {/* Live metrics */}
        <View style={styles.metricsGrid}>
          <MetricCard label="MG RMS" value={currentMGRMS.toFixed(1)} unit="µV" />
          <MetricCard label="TA RMS" value={currentTARMS.toFixed(1)} unit="µV" />
          <MetricCard
            label="Co-Activation"
            value={`${Math.round(EMGProcessor.calculateCoActivation(currentMGRMS, currentTARMS) * 100)}`}
            unit="%"
          />
          <MetricCard
            label="MG Fatigue"
            value={`${Math.round(mgFatigue * 100)}`}
            unit="%"
            colour={getFatigueColour(mgFatigue)}
          />
        </View>

        {/* Controls */}
        <View style={styles.controls}>
          {!isRecording ? (
            <TouchableOpacity style={styles.startBtn} onPress={startSession}>
              <Text style={styles.startBtnText}>START RECORDING</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.stopBtn} onPress={stopSession}>
              <Text style={styles.stopBtnText}>STOP SESSION</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={() => navigation.goBack()}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

function MetricCard({
  label, value, unit, colour
}: { label: string; value: string; unit: string; colour?: string }) {
  return (
    <View style={styles.metricCard}>
      <Text style={[styles.metricValue, colour ? { color: colour } : {}]}>
        {value}<Text style={styles.metricUnit}>{unit}</Text>
      </Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
  },
  timerLabel: { fontSize: 10, color: THEME.textSecondary, letterSpacing: 3 },
  timer: { fontSize: 36, fontWeight: '900', color: THEME.text, letterSpacing: -1 },
  recordingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  recordingDot: { width: 6, height: 6, borderRadius: 3 },
  recordingText: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  chartSection: {
    marginHorizontal: 16,
    backgroundColor: THEME.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  chartTitle: { fontSize: 13, fontWeight: '700', color: THEME.text },
  fatiguePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  fatigueText: { fontSize: 11, fontWeight: '700' },
  chart: { borderRadius: 8 },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: 16,
    gap: 8,
    marginBottom: 24,
  },
  metricCard: {
    backgroundColor: THEME.surface,
    borderRadius: 10,
    padding: 14,
    width: '48%',
    borderWidth: 1,
    borderColor: THEME.border,
  },
  metricValue: { fontSize: 24, fontWeight: '900', color: THEME.text },
  metricUnit: { fontSize: 12, fontWeight: '400' },
  metricLabel: { fontSize: 11, color: THEME.textSecondary, marginTop: 2 },
  controls: { marginHorizontal: 16, gap: 10, marginBottom: 32 },
  startBtn: {
    backgroundColor: THEME.primary,
    borderRadius: 10,
    padding: 18,
    alignItems: 'center',
  },
  startBtnText: { fontSize: 16, fontWeight: '900', color: '#000', letterSpacing: 1 },
  stopBtn: {
    backgroundColor: THEME.danger,
    borderRadius: 10,
    padding: 18,
    alignItems: 'center',
  },
  stopBtnText: { fontSize: 16, fontWeight: '900', color: '#fff', letterSpacing: 1 },
  cancelBtn: {
    padding: 14,
    alignItems: 'center',
  },
  cancelBtnText: { fontSize: 14, color: THEME.textSecondary },
});
