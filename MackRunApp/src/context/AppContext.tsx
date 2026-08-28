// src/context/AppContext.tsx
import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { UserProfile, firebaseService } from '../services/FirebaseService';
import { bleService, ConnectionStatus, EMGData } from '../services/BLEService';
import { Device } from 'react-native-ble-plx';

interface AppState {
  user: UserProfile | null;
  isLoading: boolean;
  connectionStatus: ConnectionStatus;
  connectedDevice: Device | null;
  liveData: EMGData | null;
  isRecording: boolean;
  sessionStartTime: number | null;
}

type AppAction =
  | { type: 'SET_USER'; payload: UserProfile | null }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_CONNECTION_STATUS'; payload: ConnectionStatus }
  | { type: 'SET_CONNECTED_DEVICE'; payload: Device | null }
  | { type: 'SET_LIVE_DATA'; payload: EMGData }
  | { type: 'START_RECORDING' }
  | { type: 'STOP_RECORDING' };

const initialState: AppState = {
  user: null,
  isLoading: true,
  connectionStatus: 'disconnected',
  connectedDevice: null,
  liveData: null,
  isRecording: false,
  sessionStartTime: null,
};

function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_USER':
      return { ...state, user: action.payload };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_CONNECTION_STATUS':
      return { ...state, connectionStatus: action.payload };
    case 'SET_CONNECTED_DEVICE':
      return { ...state, connectedDevice: action.payload };
    case 'SET_LIVE_DATA':
      return { ...state, liveData: action.payload };
    case 'START_RECORDING':
      return { ...state, isRecording: true, sessionStartTime: Date.now() };
    case 'STOP_RECORDING':
      return { ...state, isRecording: false };
    default:
      return state;
  }
}

interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  signOut: () => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    // Listen for auth state changes
    const unsubscribeAuth = firebaseService.onAuthStateChanged(async user => {
      if (user) {
        const profile = await firebaseService.getUserProfile(user.uid);
        dispatch({ type: 'SET_USER', payload: profile });
      } else {
        dispatch({ type: 'SET_USER', payload: null });
      }
      dispatch({ type: 'SET_LOADING', payload: false });
    });

    // Listen for BLE status changes
    bleService.onStatus(status => {
      dispatch({ type: 'SET_CONNECTION_STATUS', payload: status });
      if (status === 'disconnected') {
        dispatch({ type: 'SET_CONNECTED_DEVICE', payload: null });
      }
    });

    // Listen for EMG data
    bleService.onData(data => {
      dispatch({ type: 'SET_LIVE_DATA', payload: data });
    });

    return () => {
      unsubscribeAuth();
    };
  }, []);

  const signOut = async () => {
    await bleService.disconnect();
    await firebaseService.signOut();
    dispatch({ type: 'SET_USER', payload: null });
  };

  return (
    <AppContext.Provider value={{ state, dispatch, signOut }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextType {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}
