// src/services/FirebaseService.ts
// Handles all Firebase operations — auth, real-time sync, session storage

import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import database from '@react-native-firebase/database';
import { EMGData } from './BLEService';

export interface UserProfile {
  uid: string;
  email: string;
  role: 'athlete' | 'coach';
  name: string;
  athleteIds?: string[];   // for coaches — list of athletes they manage
  coachId?: string;        // for athletes — their assigned coach
  createdAt: number;
}

export interface Session {
  id: string;
  athleteId: string;
  athleteName: string;
  startTime: number;
  endTime: number | null;
  duration: number;
  peakMGRMS: number;
  peakTARMS: number;
  avgMGFatigue: number;
  avgTAFatigue: number;
  fatigueOnsetTime: number | null;
  coActivationRatio: number;
  notes: string;
}

export interface LiveSessionData {
  athleteId: string;
  athleteName: string;
  isRecording: boolean;
  lastUpdate: number;
  mgRMS: number;
  taRMS: number;
  mgFatigue: number;
  taFatigue: number;
  sessionDuration: number;
}

class FirebaseService {
  // ─── Authentication ────────────────────────────────────────────

  async signIn(email: string, password: string): Promise<UserProfile> {
    const credential = await auth().signInWithEmailAndPassword(email, password);
    const profile = await this.getUserProfile(credential.user.uid);
    if (!profile) throw new Error('User profile not found');
    return profile;
  }

  async signUp(
    email: string,
    password: string,
    name: string,
    role: 'athlete' | 'coach'
  ): Promise<UserProfile> {
    const credential = await auth().createUserWithEmailAndPassword(email, password);

    const profile: UserProfile = {
      uid: credential.user.uid,
      email,
      role,
      name,
      createdAt: Date.now(),
    };

    await firestore()
      .collection('users')
      .doc(credential.user.uid)
      .set(profile);

    return profile;
  }

  async signOut(): Promise<void> {
    await auth().signOut();
  }

  getCurrentUser() {
    return auth().currentUser;
  }

  onAuthStateChanged(callback: (user: any) => void) {
    return auth().onAuthStateChanged(callback);
  }

  // ─── User Profiles ─────────────────────────────────────────────

  async getUserProfile(uid: string): Promise<UserProfile | null> {
    const doc = await firestore().collection('users').doc(uid).get();
    return doc.exists ? (doc.data() as UserProfile) : null;
  }

  async updateUserProfile(uid: string, updates: Partial<UserProfile>): Promise<void> {
    await firestore().collection('users').doc(uid).update(updates);
  }

  // Coach links athlete to their dashboard
  async linkAthleteToCoach(athleteId: string, coachId: string): Promise<void> {
    const batch = firestore().batch();

    batch.update(firestore().collection('users').doc(athleteId), {
      coachId,
    });

    batch.update(firestore().collection('users').doc(coachId), {
      athleteIds: firestore.FieldValue.arrayUnion(athleteId),
    });

    await batch.commit();
  }

  // ─── Real-time Live Session Streaming ──────────────────────────

  // Push live EMG data to Firebase Realtime Database (low latency)
  async pushLiveData(athleteId: string, data: EMGData, sessionDuration: number): Promise<void> {
    const ref = database().ref(`live_sessions/${athleteId}`);
    await ref.set({
      athleteId,
      isRecording: true,
      lastUpdate: data.timestamp,
      mgRMS: Math.round(data.mgRMS * 100) / 100,
      taRMS: Math.round(data.taRMS * 100) / 100,
      mgFatigue: Math.round(data.mgFatigue * 1000) / 1000,
      taFatigue: Math.round(data.taFatigue * 1000) / 1000,
      sessionDuration,
    });
  }

  // Coach subscribes to athlete's live data
  subscribeLiveData(
    athleteId: string,
    callback: (data: LiveSessionData | null) => void
  ): () => void {
    const ref = database().ref(`live_sessions/${athleteId}`);
    const handler = ref.on('value', snapshot => {
      callback(snapshot.val() as LiveSessionData | null);
    });

    // Return unsubscribe function
    return () => ref.off('value', handler);
  }

  // Clear live data when session ends
  async clearLiveData(athleteId: string): Promise<void> {
    await database().ref(`live_sessions/${athleteId}`).remove();
  }

  // ─── Session Storage ───────────────────────────────────────────

  async saveSession(session: Omit<Session, 'id'>): Promise<string> {
    const ref = await firestore()
      .collection('sessions')
      .add({
        ...session,
        endTime: Date.now(),
      });
    return ref.id;
  }

  async getSessions(athleteId: string, limitCount: number = 20): Promise<Session[]> {
    const snapshot = await firestore()
      .collection('sessions')
      .where('athleteId', '==', athleteId)
      .orderBy('startTime', 'desc')
      .limit(limitCount)
      .get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    } as Session));
  }

  async getSession(sessionId: string): Promise<Session | null> {
    const doc = await firestore().collection('sessions').doc(sessionId).get();
    return doc.exists ? { id: doc.id, ...doc.data() } as Session : null;
  }

  async updateSessionNotes(sessionId: string, notes: string): Promise<void> {
    await firestore().collection('sessions').doc(sessionId).update({ notes });
  }

  // Get all athletes for a coach
  async getCoachAthletes(coachId: string): Promise<UserProfile[]> {
    const coachDoc = await firestore().collection('users').doc(coachId).get();
    const coachData = coachDoc.data() as UserProfile;

    if (!coachData.athleteIds || coachData.athleteIds.length === 0) return [];

    const athleteDocs = await Promise.all(
      coachData.athleteIds.map(id =>
        firestore().collection('users').doc(id).get()
      )
    );

    return athleteDocs
      .filter(doc => doc.exists)
      .map(doc => doc.data() as UserProfile);
  }

  // Get latest session metrics for an athlete (for coach overview)
  async getAthleteLatestMetrics(athleteId: string): Promise<Session | null> {
    const sessions = await this.getSessions(athleteId, 1);
    return sessions.length > 0 ? sessions[0] : null;
  }

  // ─── Fatigue Alerts ────────────────────────────────────────────

  async sendFatigueAlert(
    athleteId: string,
    athleteName: string,
    coachId: string,
    fatigueIndex: number,
    muscle: 'MG' | 'TA'
  ): Promise<void> {
    await firestore().collection('alerts').add({
      athleteId,
      athleteName,
      coachId,
      fatigueIndex,
      muscle,
      timestamp: Date.now(),
      read: false,
      message: `${athleteName}'s ${muscle === 'MG' ? 'Gastrocnemius' : 'Tibialis Anterior'} fatigue reached ${Math.round(fatigueIndex * 100)}%`,
    });
  }

  async getUnreadAlerts(coachId: string): Promise<any[]> {
    const snapshot = await firestore()
      .collection('alerts')
      .where('coachId', '==', coachId)
      .where('read', '==', false)
      .orderBy('timestamp', 'desc')
      .limit(20)
      .get();

    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  async markAlertRead(alertId: string): Promise<void> {
    await firestore().collection('alerts').doc(alertId).update({ read: true });
  }
}

export const firebaseService = new FirebaseService();
