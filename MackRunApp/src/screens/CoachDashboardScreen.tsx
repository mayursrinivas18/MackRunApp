// src/screens/CoachDashboardScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  SafeAreaView, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useApp } from '../context/AppContext';
import { firebaseService, UserProfile, LiveSessionData } from '../services/FirebaseService';
import { THEME } from '../config/firebase';
import { getFatigueColour, formatSessionTime } from '../utils/EMGProcessor';
import { RootStackParamList } from '../navigation/AppNavigator';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

interface AthleteCard {
  profile: UserProfile;
  liveData: LiveSessionData | null;
  unsubscribe: (() => void) | null;
}

export default function CoachDashboardScreen() {
  const { state } = useApp();
  const navigation = useNavigation<NavProp>();
  const [athletes, setAthletes] = useState<AthleteCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [alerts, setAlerts] = useState<any[]>([]);
  const unsubscribeRefs = React.useRef<Map<string, () => void>>(new Map());

  const loadAthletes = async () => {
    if (!state.user) return;

    const profiles = await firebaseService.getCoachAthletes(state.user.uid);
    const unreadAlerts = await firebaseService.getUnreadAlerts(state.user.uid);
    setAlerts(unreadAlerts);

    // Set up real-time subscriptions for each athlete
    const athleteCards: AthleteCard[] = profiles.map(profile => ({
      profile,
      liveData: null,
      unsubscribe: null,
    }));

    setAthletes(athleteCards);

    // Subscribe to live data for each athlete
    profiles.forEach(profile => {
      const unsubscribe = firebaseService.subscribeLiveData(
        profile.uid,
        (liveData) => {
          setAthletes(prev =>
            prev.map(a =>
              a.profile.uid === profile.uid
                ? { ...a, liveData }
                : a
            )
          );
        }
      );
      unsubscribeRefs.current.set(profile.uid, unsubscribe);
    });

    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    loadAthletes();
    return () => {
      // Cleanup subscriptions
      unsubscribeRefs.current.forEach(unsub => unsub());
    };
  }, [state.user]);

  const onRefresh = () => {
    setRefreshing(true);
    loadAthletes();
  };

  const dismissAlert = async (alertId: string) => {
    await firebaseService.markAlertRead(alertId);
    setAlerts(prev => prev.filter(a => a.id !== alertId));
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
      <FlatList
        data={athletes}
        keyExtractor={item => item.profile.uid}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={THEME.primary}
          />
        }
        ListHeaderComponent={
          <>
            <View style={styles.header}>
              <Text style={styles.title}>Athletes</Text>
              <Text style={styles.subtitle}>
                {athletes.filter(a => a.liveData?.isRecording).length} active
              </Text>
            </View>

            {/* Fatigue alerts */}
            {alerts.length > 0 && (
              <View style={styles.alertsSection}>
                <Text style={styles.sectionTitle}>ALERTS</Text>
                {alerts.map(alert => (
                  <TouchableOpacity
                    key={alert.id}
                    style={styles.alertCard}
                    onPress={() => dismissAlert(alert.id)}>
                    <View style={styles.alertDot} />
                    <Text style={styles.alertText}>{alert.message}</Text>
                    <Text style={styles.alertDismiss}>✕</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <Text style={styles.sectionTitle}>YOUR ATHLETES</Text>
          </>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No athletes yet</Text>
            <Text style={styles.emptySubtitle}>
              Share your coach ID with athletes to connect
            </Text>
            <View style={styles.coachIdCard}>
              <Text style={styles.coachIdLabel}>Your Coach ID</Text>
              <Text style={styles.coachIdValue}>{state.user?.uid?.slice(0, 8).toUpperCase()}</Text>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => navigation.navigate('AthleteDetail', {
              athleteId: item.profile.uid,
              athleteName: item.profile.name,
            })}>
            <AthleteCardComponent athlete={item} />
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

function AthleteCardComponent({ athlete }: { athlete: AthleteCard }) {
  const { profile, liveData } = athlete;
  const isLive = liveData?.isRecording === true;

  return (
    <View style={[styles.athleteCard, isLive && styles.athleteCardLive]}>
      <View style={styles.athleteHeader}>
        <View style={styles.athleteAvatar}>
          <Text style={styles.avatarText}>
            {profile.name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.athleteInfo}>
          <Text style={styles.athleteName}>{profile.name}</Text>
          <Text style={styles.athleteEmail}>{profile.email}</Text>
        </View>
        {isLive && (
          <View style={styles.livePill}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        )}
      </View>

      {isLive && liveData && (
        <>
          <View style={styles.divider} />
          <View style={styles.liveMetrics}>
            <LiveMetric
              label="MG Fatigue"
              value={`${Math.round(liveData.mgFatigue * 100)}%`}
              colour={getFatigueColour(liveData.mgFatigue)}
            />
            <LiveMetric
              label="TA Fatigue"
              value={`${Math.round(liveData.taFatigue * 100)}%`}
              colour={getFatigueColour(liveData.taFatigue)}
            />
            <LiveMetric
              label="Session"
              value={formatSessionTime(liveData.sessionDuration)}
              colour={THEME.text}
            />
          </View>
        </>
      )}
    </View>
  );
}

function LiveMetric({ label, value, colour }: { label: string; value: string; colour: string }) {
  return (
    <View style={styles.liveMetricItem}>
      <Text style={[styles.liveMetricValue, { color: colour }]}>{value}</Text>
      <Text style={styles.liveMetricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.background },
  list: { padding: 16, gap: 10 },
  header: { marginBottom: 8, paddingTop: 8 },
  title: { fontSize: 28, fontWeight: '900', color: THEME.text },
  subtitle: { fontSize: 13, color: THEME.textSecondary, marginTop: 2 },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.textSecondary,
    letterSpacing: 2,
    marginBottom: 10,
    marginTop: 8,
  },
  alertsSection: { marginBottom: 8 },
  alertCard: {
    backgroundColor: '#FF174415',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#FF174430',
  },
  alertDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: THEME.danger },
  alertText: { flex: 1, fontSize: 13, color: THEME.text },
  alertDismiss: { fontSize: 13, color: THEME.textSecondary },
  athleteCard: {
    backgroundColor: THEME.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  athleteCardLive: { borderColor: THEME.primary },
  athleteHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  athleteAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: THEME.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '900', color: '#000' },
  athleteInfo: { flex: 1 },
  athleteName: { fontSize: 15, fontWeight: '700', color: THEME.text },
  athleteEmail: { fontSize: 12, color: THEME.textSecondary, marginTop: 2 },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF4D0020',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    gap: 5,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: THEME.primary },
  liveText: { fontSize: 10, fontWeight: '900', color: THEME.primary, letterSpacing: 1 },
  divider: { height: 1, backgroundColor: THEME.border, marginVertical: 12 },
  liveMetrics: { flexDirection: 'row', justifyContent: 'space-around' },
  liveMetricItem: { alignItems: 'center' },
  liveMetricValue: { fontSize: 20, fontWeight: '900' },
  liveMetricLabel: { fontSize: 10, color: THEME.textSecondary, marginTop: 2 },
  empty: { alignItems: 'center', paddingTop: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: THEME.text, marginBottom: 8 },
  emptySubtitle: { fontSize: 13, color: THEME.textSecondary, textAlign: 'center', paddingHorizontal: 40, marginBottom: 24 },
  coachIdCard: {
    backgroundColor: THEME.surface,
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.primary,
  },
  coachIdLabel: { fontSize: 11, color: THEME.textSecondary, letterSpacing: 2, marginBottom: 6 },
  coachIdValue: { fontSize: 20, fontWeight: '900', color: THEME.primary, letterSpacing: 3 },
});
