// src/screens/AthleteDetailScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, SafeAreaView,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { firebaseService, Session } from '../services/FirebaseService';
import { THEME } from '../config/firebase';
import { getFatigueColour, formatSessionTime } from '../utils/EMGProcessor';

export default function AthleteDetailScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation();
  const { athleteId, athleteName } = route.params;

  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    firebaseService.getSessions(athleteId, 20).then(data => {
      setSessions(data);
      setLoading(false);
    });
  }, [athleteId]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{athleteName}</Text>
        <Text style={styles.subtitle}>{sessions.length} sessions</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={THEME.primary} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>

          {/* Summary stats */}
          {sessions.length > 0 && (
            <View style={styles.statsGrid}>
              <StatCard
                label="Avg MG Fatigue"
                value={`${Math.round(
                  sessions.reduce((s, sess) => s + sess.avgMGFatigue, 0) /
                  sessions.length * 100
                )}%`}
                colour={getFatigueColour(
                  sessions.reduce((s, sess) => s + sess.avgMGFatigue, 0) / sessions.length
                )}
              />
              <StatCard
                label="Avg TA Fatigue"
                value={`${Math.round(
                  sessions.reduce((s, sess) => s + sess.avgTAFatigue, 0) /
                  sessions.length * 100
                )}%`}
                colour={getFatigueColour(
                  sessions.reduce((s, sess) => s + sess.avgTAFatigue, 0) / sessions.length
                )}
              />
              <StatCard
                label="Total Sessions"
                value={`${sessions.length}`}
                colour={THEME.primary}
              />
              <StatCard
                label="Avg Duration"
                value={formatSessionTime(
                  sessions.reduce((s, sess) => s + sess.duration, 0) / sessions.length
                )}
                colour={THEME.text}
              />
            </View>
          )}

          <Text style={styles.sectionTitle}>SESSION HISTORY</Text>
          {sessions.map(session => (
            <SessionRow key={session.id} session={session} />
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function StatCard({ label, value, colour }: { label: string; value: string; colour: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, { color: colour }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function SessionRow({ session }: { session: Session }) {
  const date = new Date(session.startTime).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric'
  });

  return (
    <View style={styles.sessionRow}>
      <View>
        <Text style={styles.sessionDate}>{date}</Text>
        <Text style={styles.sessionDuration}>{formatSessionTime(session.duration)}</Text>
      </View>
      <View style={styles.sessionFatigue}>
        <Text style={[styles.fatigueVal, { color: getFatigueColour(session.avgMGFatigue) }]}>
          MG {Math.round(session.avgMGFatigue * 100)}%
        </Text>
        <Text style={[styles.fatigueVal, { color: getFatigueColour(session.avgTAFatigue) }]}>
          TA {Math.round(session.avgTAFatigue * 100)}%
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.background },
  header: { padding: 20, paddingTop: 12 },
  back: { fontSize: 14, color: THEME.primary, marginBottom: 12 },
  title: { fontSize: 26, fontWeight: '900', color: THEME.text },
  subtitle: { fontSize: 13, color: THEME.textSecondary, marginTop: 2 },
  content: { padding: 16, gap: 10 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  statCard: {
    backgroundColor: THEME.surface,
    borderRadius: 10,
    padding: 14,
    width: '48%',
    borderWidth: 1,
    borderColor: THEME.border,
  },
  statValue: { fontSize: 22, fontWeight: '900' },
  statLabel: { fontSize: 11, color: THEME.textSecondary, marginTop: 2 },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.textSecondary,
    letterSpacing: 2,
    marginBottom: 8,
  },
  sessionRow: {
    backgroundColor: THEME.surface,
    borderRadius: 10,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.border,
  },
  sessionDate: { fontSize: 14, fontWeight: '700', color: THEME.text },
  sessionDuration: { fontSize: 12, color: THEME.textSecondary, marginTop: 2 },
  sessionFatigue: { alignItems: 'flex-end', gap: 4 },
  fatigueVal: { fontSize: 13, fontWeight: '700' },
});
