// src/screens/AuthScreen.tsx
import React, { useState } from 'react';
import {
  View, Text, Image, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { firebaseService } from '../services/FirebaseService';
import { useApp } from '../context/AppContext';
import { THEME } from '../config/firebase';

type Mode = 'signin' | 'signup';
type Role = 'athlete' | 'coach';

export default function AuthScreen() {
  const { dispatch } = useApp();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('athlete');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter your email and password');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'signin') {
        const profile = await firebaseService.signIn(email, password);
        dispatch({ type: 'SET_USER', payload: profile });
      } else {
        if (!name) {
          Alert.alert('Error', 'Please enter your name');
          return;
        }
        const profile = await firebaseService.signUp(email, password, name, role);
        dispatch({ type: 'SET_USER', payload: profile });
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* Header */}
        <View style={styles.header}>
          <Image
            source={require('../assets/MackRunClearLogo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.tagline}>Achilles Intelligence</Text>
        </View>

        {/* Mode toggle */}
        <View style={styles.modeToggle}>
          <TouchableOpacity
            style={[styles.modeBtn, mode === 'signin' && styles.modeBtnActive]}
            onPress={() => setMode('signin')}>
            <Text style={[styles.modeBtnText, mode === 'signin' && styles.modeBtnTextActive]}>
              Sign In
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, mode === 'signup' && styles.modeBtnActive]}
            onPress={() => setMode('signup')}>
            <Text style={[styles.modeBtnText, mode === 'signup' && styles.modeBtnTextActive]}>
              Sign Up
            </Text>
          </TouchableOpacity>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {mode === 'signup' && (
            <TextInput
              style={styles.input}
              placeholder="Full name"
              placeholderTextColor={THEME.textSecondary}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />
          )}

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={THEME.textSecondary}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={THEME.textSecondary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          {mode === 'signup' && (
            <View style={styles.roleContainer}>
              <Text style={styles.roleLabel}>I am a:</Text>
              <View style={styles.roleToggle}>
                <TouchableOpacity
                  style={[styles.roleBtn, role === 'athlete' && styles.roleBtnActive]}
                  onPress={() => setRole('athlete')}>
                  <Text style={[styles.roleBtnText, role === 'athlete' && styles.roleBtnTextActive]}>
                    Athlete
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.roleBtn, role === 'coach' && styles.roleBtnActive]}
                  onPress={() => setRole('coach')}>
                  <Text style={[styles.roleBtnText, role === 'coach' && styles.roleBtnTextActive]}>
                    Coach / PT
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.submitBtnText}>
                {mode === 'signin' ? 'Sign In' : 'Create Account'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.background,
  },
  scroll: {
    flexGrow: 1,
    padding: 32,
    justifyContent: 'center',
  },
  header: {
    marginBottom: 48,
    alignItems: 'center',
  },
  logo: {
    width: 300,
    height: 300,
    // The source image has ~22% of its height as transparent padding below
    // the visible mark, so a negative margin is needed to actually tighten
    // the gap to the tagline below it.
    marginBottom: -55,
  },
  tagline: {
    fontSize: 13,
    color: THEME.textSecondary,
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: THEME.surface,
    borderRadius: 8,
    marginBottom: 24,
    padding: 4,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 6,
  },
  modeBtnActive: {
    backgroundColor: THEME.primary,
  },
  modeBtnText: {
    color: THEME.textSecondary,
    fontWeight: '600',
    fontSize: 14,
  },
  modeBtnTextActive: {
    color: '#000',
  },
  form: {
    gap: 12,
  },
  input: {
    backgroundColor: THEME.surface,
    borderWidth: 1,
    borderColor: THEME.border,
    borderRadius: 8,
    padding: 16,
    color: THEME.text,
    fontSize: 15,
  },
  roleContainer: {
    marginTop: 4,
  },
  roleLabel: {
    color: THEME.textSecondary,
    fontSize: 13,
    marginBottom: 8,
  },
  roleToggle: {
    flexDirection: 'row',
    gap: 8,
  },
  roleBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  roleBtnActive: {
    borderColor: THEME.primary,
    backgroundColor: '#25A6D715',
  },
  roleBtnText: {
    color: THEME.textSecondary,
    fontWeight: '600',
  },
  roleBtnTextActive: {
    color: THEME.primary,
  },
  submitBtn: {
    backgroundColor: THEME.primary,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1,
  },
});
