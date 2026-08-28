// src/screens/SessionHistoryScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  SafeAreaView, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useApp } from '../context/AppContext';
import { firebaseService, Session } from '../services/FirebaseService';
import { THEME } from '../config/firebase';
import { formatSessionTime, getFatigueColour } from '../utils/EMGProcessor';

export default function SessionHistoryScreen() {
  const { state } = useApp();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadSessions = async () => {
    if (!state.user) return;
    const data = await firebaseService.getSessions(state.user.uid, 30);
    setSessions(data);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { loadSessions(); }, [state.user]);

  const onRefresh = () => {
    setRefreshing(true);
    loadSessions();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color={THEME.primary} size="large" style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Sessions</Text>
        <Text style={styles.subtitle}>{sessions.length} recorded</Text>
      </View>

      <FlatList
        data={sessions}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={THEME.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No sessions yet</Text>
            <Text style={styles.emptySubtitle}>Connect your device and start your first session</Text>
          </View>
        }
        renderItem={({ item }) => <SessionCard session={item} />}
      />
    </SafeAreaView>
  );
}

function SessionCard({ session }: { session: Session }) {
  const date = new Date(session.startTime);
  const dateStr = date.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric'
  });
  const timeStr = date.toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit'
  });

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.cardDate}>{dateStr}</Text>
          <Text style={styles.cardTime}>{timeStr}</Text>
        </View>
        <Text style={styles.cardDuration}>{formatSessionTime(session.duration)}</Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.cardMetrics}>
        <FatigueBar
          label="Gastrocnemius"
          value={session.avgMGFatigue}
        />
        <FatigueBar
          label="Tibialis Anterior"
          value={session.avgTAFatigue}
        />
      </View>

      <View style={styles.cardFooter}>
        <MetricPill
          label="Co-Act"
          value={`${Math.round(session.coActivationRatio * 100)}%`}
        />
        {session.fatigueOnsetTime && (
          <MetricPill
            label="Fatigue onset"
            value={formatSessionTime(session.fatigueOnsetTime)}
          />
        )}
        {session.notes ? (
          <MetricPill label="Notes" value="✓" />
        ) : null}
      </View>
    </View>
  );
}

function FatigueBar({ label, value }: { label: string; value: number }) {
  const colour = getFatigueColour(value);
  return (
    <View style={styles.fatigueRow}>
      <Text style={styles.fatigueLabel}>{label}</Text>
      <View style={styles.fatigueBarBg}>
        <View style={[
          styles.fatigueBarFill,
          { width: `${Math.round(value * 100)}%`, backgroundColor: colour }
        ]} />
      </View>
      <Text style={[styles.fatigueValue, { color: colour }]}>
        {Math.round(value * 100)}%
      </Text>
    </View>
  );
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.pill}>
      <Text style={styles.pillLabel}>{label}: </Text>
      <Text style={styles.pillValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.background },
  header: { padding: 20, paddingBottom: 8 },
  title: { fontSize: 28, fontWeight: '900', color: THEME.text, marginTop: 8 },
  subtitle: { fontSize: 13, color: THEME.textSecondary, marginTop: 2 },
  list: { padding: 16, gap: 10 },
  card: {
    backgroundColor: THEME.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  cardDate: { fontSize: 15, fontWeight: '700', color: THEME.text },
  cardTime: { fontSize: 12, color: THEME.textSecondary, marginTop: 2 },
  cardDuration: { fontSize: 18, fontWeight: '900', color: THEME.primary },
  divider: { height: 1, backgroundColor: THEME.border, marginBottom: 12 },
  cardMetrics: { gap: 8, marginBottom: 12 },
  fatigueRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  fatigueLabel: { fontSize: 11, color: THEME.textSecondary, width: 110 },
  fatigueBarBg: {
    flex: 1,
    height: 6,
    backgroundColor: THEME.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  fatigueBarFill: { height: '100%', borderRadius: 3 },
  fatigueValue: { fontSize: 11, fontWeight: '700', width: 32, textAlign: 'right' },
  cardFooter: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  pill: {
    flexDirection: 'row',
    backgroundColor: THEME.background,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  pillLabel: { fontSize: 11, color: THEME.textSecondary },
  pillValue: { fontSize: 11, color: THEME.text, fontWeight: '600' },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: THEME.text, marginBottom: 8 },
  emptySubtitle: { fontSize: 13, color: THEME.textSecondary, textAlign: 'center', paddingHorizontal: 40 },
});
