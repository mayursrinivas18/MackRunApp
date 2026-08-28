// src/navigation/AppNavigator.tsx
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ActivityIndicator, View } from 'react-native';

import { useApp } from '../context/AppContext';
import { THEME } from '../config/firebase';

// Screens
import AuthScreen from '../screens/AuthScreen';
import HomeScreen from '../screens/HomeScreen';
import ConnectScreen from '../screens/ConnectScreen';
import LiveSessionScreen from '../screens/LiveSessionScreen';
import SessionHistoryScreen from '../screens/SessionHistoryScreen';
import CoachDashboardScreen from '../screens/CoachDashboardScreen';
import AthleteDetailScreen from '../screens/AthleteDetailScreen';
import SettingsScreen from '../screens/SettingsScreen';

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  LiveSession: undefined;
  AthleteDetail: { athleteId: string; athleteName: string };
};

export type AthleteTabParamList = {
  Home: undefined;
  Connect: undefined;
  History: undefined;
  Settings: undefined;
};

export type CoachTabParamList = {
  Dashboard: undefined;
  History: undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const AthleteTab = createBottomTabNavigator<AthleteTabParamList>();
const CoachTab = createBottomTabNavigator<CoachTabParamList>();

function AthleteTabs() {
  return (
    <AthleteTab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: THEME.surface,
          borderTopColor: THEME.border,
          height: 60,
          paddingBottom: 8,
        },
        tabBarActiveTintColor: THEME.primary,
        tabBarInactiveTintColor: THEME.textSecondary,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}>
      <AthleteTab.Screen
        name="Home"
        component={HomeScreen}
        options={{ tabBarLabel: 'Home' }}
      />
      <AthleteTab.Screen
        name="Connect"
        component={ConnectScreen}
        options={{ tabBarLabel: 'Device' }}
      />
      <AthleteTab.Screen
        name="History"
        component={SessionHistoryScreen}
        options={{ tabBarLabel: 'History' }}
      />
      <AthleteTab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ tabBarLabel: 'Settings' }}
      />
    </AthleteTab.Navigator>
  );
}

function CoachTabs() {
  return (
    <CoachTab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: THEME.surface,
          borderTopColor: THEME.border,
          height: 60,
          paddingBottom: 8,
        },
        tabBarActiveTintColor: THEME.primary,
        tabBarInactiveTintColor: THEME.textSecondary,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}>
      <CoachTab.Screen
        name="Dashboard"
        component={CoachDashboardScreen}
        options={{ tabBarLabel: 'Athletes' }}
      />
      <CoachTab.Screen
        name="History"
        component={SessionHistoryScreen}
        options={{ tabBarLabel: 'Sessions' }}
      />
      <CoachTab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ tabBarLabel: 'Settings' }}
      />
    </CoachTab.Navigator>
  );
}

export default function AppNavigator() {
  const { state } = useApp();

  if (state.isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: THEME.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={THEME.primary} size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!state.user ? (
          <Stack.Screen name="Auth" component={AuthScreen} />
        ) : (
          <>
            <Stack.Screen
              name="Main"
              component={state.user.role === 'coach' ? CoachTabs : AthleteTabs}
            />
            <Stack.Screen
              name="LiveSession"
              component={LiveSessionScreen}
              options={{ presentation: 'fullScreenModal' }}
            />
            <Stack.Screen
              name="AthleteDetail"
              component={AthleteDetailScreen}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
