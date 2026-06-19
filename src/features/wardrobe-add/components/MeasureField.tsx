// MeasureField.tsx — Compact labelled measurement input (e.g. "Chest  54").
// The value is stored as a number (cm); this component accepts a string draft
// and calls onCommit with the parsed number (or undefined for empty/invalid).

import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { T, type } from '../../../design/tokens';

interface Props {
  label: string;
  value: number | undefined;
  onCommit: (v: number | undefined) => void;
}

export function MeasureField({ label, value, onCommit }: Props) {
  const [draft, setDraft] = useState(value !== undefined ? String(value) : '');

  const handleBlur = () => {
    const n = parseFloat(draft);
    onCommit(isNaN(n) ? undefined : n);
  };

  return (
    <View style={styles.col}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={draft}
        onChangeText={setDraft}
        onBlur={handleBlur}
        placeholder="—"
        placeholderTextColor={T.color.tertiary}
        keyboardType="decimal-pad"
        style={styles.input}
      />
      <Text style={styles.unit}>cm</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  col: {
    flexDirection: 'column',
    gap: 6,
  },
  label: {
    ...type.ui,
    fontSize: 8,
    color: T.color.tertiary,
  },
  input: {
    width: '100%',
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: T.color.elevated,
    borderWidth: 0.5,
    borderColor: T.color.hairline,
    fontFamily: T.font.sans,
    fontSize: 14,
    color: T.color.primary,
  },
  unit: {
    ...type.micro,
    fontSize: 8,
    color: T.color.tertiary,
  },
});
