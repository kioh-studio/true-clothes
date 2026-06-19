// Picker.tsx — Single-select chip grid for controlled vocab fields.
// Used by FieldRow (type, colour, material etc).

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { T, type } from '../../../design/tokens';

interface Props {
  label: string;
  value: string;
  options: string[];
  swatch?: (v: string) => string;
  onPick: (v: string) => void;
}

export function Picker({ label, value, options, swatch, onPick }: Props) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.chips}>
        {options.map((o) => {
          const sel = o === value;
          return (
            <Pressable
              key={o}
              onPress={() => onPick(o)}
              style={[styles.chip, sel && styles.chipSelected]}
            >
              {swatch && (
                <View style={[styles.swatch, { backgroundColor: swatch(o) }]} />
              )}
              <Text style={[styles.chipText, sel && styles.chipTextSelected]}>
                {o}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginTop: 8,
  },
  label: {
    ...type.ui,
    fontSize: 9,
    color: T.color.tertiary,
    marginBottom: 10,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 0.5,
    borderColor: T.color.hairlineStrong,
    backgroundColor: 'transparent',
  },
  chipSelected: {
    backgroundColor: T.color.primary,
    borderWidth: 0,
  },
  swatch: {
    width: 11,
    height: 11,
    borderRadius: 999,
    borderWidth: 0.5,
    borderColor: 'rgba(26,24,21,0.15)',
  },
  chipText: {
    ...type.ui,
    fontSize: 9,
    color: T.color.primary,
  },
  chipTextSelected: {
    color: T.color.canvas,
  },
});
