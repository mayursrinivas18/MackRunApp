// src/screens/HomeScreen.tsx
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useApp } from '../context/AppContext';
import { firebaseService, Session } from '../services/FirebaseService';
import { THEME } from '../config/firebase';
import { formatSessionTime, getFatigueColour } from '../utils/EMGProcessor';
import { RootStackParamList } from '../navigation/AppNavigator';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

export default function HomeScreen() {
  const { state } = useApp();
  const navigation = useNavigation<NavProp>();
  const [recentSession, setRecentSession] = useState<Session | null>(null);

  useEffect(() => {
    if (state.user) {
      firebaseService.getSessions(state.user.uid, 1).then(sessions => {
        if (sessions.length > 0) setRecentSession(sessions[0]);
      });
    }
  }, [state.user]);

  const isConnected = state.connectionStatus === 'connected';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>
              {getGreeting()}, {state.user?.name?.split(' ')[0]}
            </Text>
            <Text style={styles.subtitle}>Ready to train?</Text>
          </View>
          <View style={[
            styles.connectionPill,
            { backgroundColor: isConnected ? '#00C85320' : '#FF174420' }
          ]}>
            <View style={[
              styles.connectionDot,
              { backgroundColor: isConnected ? THEME.success : THEME.danger }
            ]} />
            <Text style={[
              styles.connectionText,
              { color: isConnected ? THEME.success : THEME.danger }
            ]}>
              {isConnected ? 'Connected' : 'Disconnected'}
            </Text>
          </View>
        </View>

        {/* Start Session CTA */}
        <TouchableOpacity
          style={[styles.startCard, !isConnected && styles.startCardDisabled]}
          onPress={() => isConnected && navigation.navigate('LiveSession')}
          activeOpacity={isConnected ? 0.8 : 1}>
          <View style={styles.startCardAccent} />
          <Text style={styles.startCardLabel}>START SESSION</Text>
          <Text style={styles.startCardTitle}>Begin Recording</Text>
          <Text style={styles.startCardSub}>
            {isConnected
              ? 'Device ready — tap to start'
              : 'Connect your device first'}
          </Text>
        </TouchableOpacity>

        {/* Last session summary */}
        {recentSession && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Last Session</Text>
            <View style={styles.sessionCard}>
              <View style={styles.sessionRow}>
                <Text style={styles.sessionDate}>
                  {new Date(recentSession.startTime).toLocaleDateString('en-US', {
                    weekday: 'short', month: 'short', day: 'numeric'
                  })}
                </Text>
                <Text style={styles.sessionDuration}>
                  {formatSessionTime(recentSession.duration)}
                </Text>
              </View>
              <View style={styles.metricsRow}>
                <MetricItem
                  label="MG Fatigue"
                  value={`${Math.round(recentSession.avgMGFatigue * 100)}%`}
                  colour={getFatigueColour(recentSession.avgMGFatigue)}
                />
                <MetricItem
                  label="TA Fatigue"
                  value={`${Math.round(recentSession.avgTAFatigue * 100)}%`}
                  colour={getFatigueColour(recentSession.avgTAFatigue)}
                />
                <MetricItem
                  label="Co-Activation"
                  value={`${Math.round(recentSession.coActivationRatio * 100)}%`}
                  colour={THEME.primary}
                />
              </View>
            </View>
          </View>
        )}

        {/* Quick tips */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tips</Text>
          <View style={styles.tipCard}>
            <Text style={styles.tipText}>
              Attach the calf strap with both electrode pods pressed firmly against the skin before starting.
            </Text>
          </View>
          <View style={styles.tipCard}>
            <Text style={styles.tipText}>
              Hold still for 5 seconds at session start to allow electrode calibration.
            </Text>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

function MetricItem({ label, value, colour }: { label: string; value: string; colour: string }) {
  return (
    <View style={styles.metricItem}>
      <Text style={[styles.metricValue, { color: colour }]}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.background },
  scroll: { flex: 1, padding: 20 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
    marginTop: 8,
  },
  greeting: { fontSize: 22, fontWeight: '900', color: THEME.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: THEME.textSecondary, marginTop: 2 },
  connectionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  connectionDot: { width: 6, height: 6, borderRadius: 3 },
  connectionText: { fontSize: 12, fontWeight: '600' },
  startCard: {
    backgroundColor: THEME.primary,
    borderRadius: 12,
    padding: 24,
    marginBottom: 28,
    overflow: 'hidden',
  },
  startCardDisabled: { opacity: 0.4 },
  startCardAccent: {
    position: 'absolute',
    right: -20,
    top: -20,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#FFFFFF20',
  },
  startCardLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#00000088',
    letterSpacing: 3,
    marginBottom: 6,
  },
  startCardTitle: { fontSize: 28, fontWeight: '900', color: '#000', letterSpacing: -0.5 },
  startCardSub: { fontSize: 13, color: '#00000088', marginTop: 4 },
  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.textSecondary,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  sessionCard: {
    backgroundColor: THEME.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  sessionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sessionDate: { fontSize: 14, color: THEME.text, fontWeight: '600' },
  sessionDuration: { fontSize: 14, color: THEME.textSecondary },
  metricsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  metricItem: { alignItems: 'center', flex: 1 },
  metricValue: { fontSize: 20, fontWeight: '900' },
  metricLabel: { fontSize: 10, color: THEME.textSecondary, marginTop: 2, textAlign: 'center' },
  tipCard: {
    backgroundColor: THEME.surface,
    borderRadius: 8,
    padding: 14,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: THEME.primary,
  },
  tipText: { fontSize: 13, color: THEME.textSecondary, lineHeight: 20 },
});
