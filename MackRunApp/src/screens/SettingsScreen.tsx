// src/screens/SettingsScreen.tsx
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, Alert, TextInput,
} from 'react-native';
import { useApp } from '../context/AppContext';
import { firebaseService } from '../services/FirebaseService';
import { THEME } from '../config/firebase';

export default function SettingsScreen() {
  const { state, signOut } = useApp();
  const [coachCode, setCoachCode] = useState('');
  const [linking, setLinking] = useState(false);

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ]);
  };

  const linkToCoach = async () => {
    if (!coachCode.trim() || !state.user) return;
    setLinking(true);
    try {
      await firebaseService.linkAthleteToCoach(state.user.uid, coachCode.trim());
      Alert.alert('Success', 'Connected to your coach');
      setCoachCode('');
    } catch (error) {
      Alert.alert('Error', 'Could not find coach with that ID');
    } finally {
      setLinking(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>

        <Text style={styles.title}>Settings</Text>

        {/* Profile card */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {state.user?.name?.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View>
            <Text style={styles.profileName}>{state.user?.name}</Text>
            <Text style={styles.profileEmail}>{state.user?.email}</Text>
            <View style={styles.rolePill}>
              <Text style={styles.roleText}>
                {state.user?.role === 'coach' ? '🎽 Coach / PT' : '🏃 Athlete'}
              </Text>
            </View>
          </View>
        </View>

        {/* Athlete: link to coach */}
        {state.user?.role === 'athlete' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>CONNECT TO COACH</Text>
            {state.user?.coachId ? (
              <View style={styles.linkedCard}>
                <Text style={styles.linkedText}>✓ Connected to coach</Text>
              </View>
            ) : (
              <View style={styles.linkCard}>
                <Text style={styles.linkDescription}>
                  Enter your coach's ID to share your session data with them in real time.
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="Coach ID"
                  placeholderTextColor={THEME.textSecondary}
                  value={coachCode}
                  onChangeText={setCoachCode}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={[styles.linkBtn, (!coachCode || linking) && styles.linkBtnDisabled]}
                  onPress={linkToCoach}
                  disabled={!coachCode || linking}>
                  <Text style={styles.linkBtnText}>
                    {linking ? 'Connecting...' : 'Connect'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Coach: share ID */}
        {state.user?.role === 'coach' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>YOUR COACH ID</Text>
            <View style={styles.coachIdCard}>
              <Text style={styles.coachIdDescription}>
                Share this ID with your athletes so they can connect to you.
              </Text>
              <View style={styles.coachIdBox}>
                <Text style={styles.coachIdValue}>
                  {state.user?.uid?.slice(0, 8).toUpperCase()}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* App info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ABOUT</Text>
          <View style={styles.infoCard}>
            <InfoRow label="App" value="MackRun v1.0" />
            <InfoRow label="Support" value="hello@mackrun.tech" />
            <InfoRow label="Website" value="mackrun.tech" />
          </View>
        </View>

        {/* Sign out */}
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.background },
  content: { padding: 20, gap: 0 },
  title: { fontSize: 28, fontWeight: '900', color: THEME.text, marginTop: 8, marginBottom: 24 },
  profileCard: {
    backgroundColor: THEME.surface,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: THEME.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 22, fontWeight: '900', color: '#000' },
  profileName: { fontSize: 17, fontWeight: '700', color: THEME.text },
  profileEmail: { fontSize: 13, color: THEME.textSecondary, marginTop: 2 },
  rolePill: {
    marginTop: 6,
    backgroundColor: THEME.background,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: THEME.border,
  },
  roleText: { fontSize: 11, color: THEME.textSecondary },
  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.textSecondary,
    letterSpacing: 2,
    marginBottom: 10,
  },
  linkedCard: {
    backgroundColor: '#00C85315',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#00C85340',
  },
  linkedText: { fontSize: 14, color: THEME.success, fontWeight: '600' },
  linkCard: {
    backgroundColor: THEME.surface,
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: THEME.border,
    gap: 12,
  },
  linkDescription: { fontSize: 13, color: THEME.textSecondary, lineHeight: 20 },
  input: {
    backgroundColor: THEME.background,
    borderWidth: 1,
    borderColor: THEME.border,
    borderRadius: 8,
    padding: 12,
    color: THEME.text,
    fontSize: 15,
  },
  linkBtn: {
    backgroundColor: THEME.primary,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  linkBtnDisabled: { opacity: 0.4 },
  linkBtnText: { fontSize: 14, fontWeight: '900', color: '#000' },
  coachIdCard: {
    backgroundColor: THEME.surface,
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: THEME.border,
    gap: 12,
  },
  coachIdDescription: { fontSize: 13, color: THEME.textSecondary, lineHeight: 20 },
  coachIdBox: {
    backgroundColor: THEME.background,
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.primary,
  },
  coachIdValue: { fontSize: 22, fontWeight: '900', color: THEME.primary, letterSpacing: 4 },
  infoCard: {
    backgroundColor: THEME.surface,
    borderRadius: 10,
    padding: 4,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
  },
  infoLabel: { fontSize: 14, color: THEME.textSecondary },
  infoValue: { fontSize: 14, color: THEME.text, fontWeight: '500' },
  signOutBtn: {
    borderWidth: 1,
    borderColor: THEME.danger,
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 32,
  },
  signOutText: { fontSize: 15, color: THEME.danger, fontWeight: '700' },
});
