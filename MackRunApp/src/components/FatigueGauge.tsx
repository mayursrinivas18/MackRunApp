// src/components/FatigueGauge.tsx
// Red/yellow/green precursor gauge — a gradient bar with a positioned
// indicator showing where the current fatigue value sits.
import React, { useState } from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { THEME, EMG_CONFIG } from '../config/firebase';

export type FatigueLevel = 'green' | 'yellow' | 'red';

export function getFatigueLevel(value: number): FatigueLevel {
  if (value >= EMG_CONFIG.FATIGUE_THRESHOLD) return 'red';
  if (value >= EMG_CONFIG.WARNING_THRESHOLD) return 'yellow';
  return 'green';
}

const LEVEL_COLOUR: Record<FatigueLevel, string> = {
  green: THEME.success,
  yellow: THEME.warning,
  red: THEME.danger,
};

const LEVEL_LABEL: Record<FatigueLevel, string> = {
  green: 'GREEN — Good',
  yellow: 'YELLOW — Monitor',
  red: 'RED — Take Action',
};

const BAR_HEIGHT = 14;
const THUMB_SIZE = 18;

export default function FatigueGauge({
  value,
  title,
}: {
  value: number; // 0-1
  title: string;
}) {
  const [barWidth, setBarWidth] = useState(0);
  const clamped = Math.min(Math.max(value, 0), 1);
  const level = getFatigueLevel(clamped);
  const colour = LEVEL_COLOUR[level];

  const onLayout = (e: LayoutChangeEvent) => {
    setBarWidth(e.nativeEvent.layout.width);
  };

  const thumbLeft = Math.min(
    Math.max(barWidth * clamped - THUMB_SIZE / 2, 0),
    Math.max(barWidth - THUMB_SIZE, 0)
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{title}</Text>
        <Text style={[styles.statusText, { color: colour }]}>
          {LEVEL_LABEL[level]}
        </Text>
      </View>

      <View style={styles.barWrapper} onLayout={onLayout}>
        {barWidth > 0 && (
          <Svg width={barWidth} height={BAR_HEIGHT}>
            <Defs>
              <LinearGradient id="fatigueGradient" x1="0" y1="0" x2="1" y2="0">
                <Stop offset={0} stopColor={THEME.success} />
                <Stop offset={EMG_CONFIG.WARNING_THRESHOLD} stopColor={THEME.success} />
                <Stop offset={EMG_CONFIG.WARNING_THRESHOLD} stopColor={THEME.warning} />
                <Stop offset={EMG_CONFIG.FATIGUE_THRESHOLD} stopColor={THEME.warning} />
                <Stop offset={EMG_CONFIG.FATIGUE_THRESHOLD} stopColor={THEME.danger} />
                <Stop offset={1} stopColor={THEME.danger} />
              </LinearGradient>
            </Defs>
            <Rect
              x={0}
              y={0}
              width={barWidth}
              height={BAR_HEIGHT}
              rx={BAR_HEIGHT / 2}
              fill="url(#fatigueGradient)"
            />
          </Svg>
        )}

        <View pointerEvents="none" style={[styles.thumb, { left: thumbLeft }]} />
      </View>

      <View style={styles.scaleRow}>
        <Text style={styles.scaleLabel}>0%</Text>
        <Text style={[styles.valueLabel, { color: colour }]}>
          {Math.round(clamped * 100)}%
        </Text>
        <Text style={styles.scaleLabel}>100%</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 4 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  title: { fontSize: 13, fontWeight: '700', color: THEME.text },
  statusText: { fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  barWrapper: { height: BAR_HEIGHT, justifyContent: 'center' },
  thumb: {
    position: 'absolute',
    top: -3,
    width: THUMB_SIZE,
    height: BAR_HEIGHT + 6,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#000000',
  },
  scaleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  scaleLabel: { fontSize: 9, color: THEME.textSecondary },
  valueLabel: { fontSize: 12, fontWeight: '900' },
});
