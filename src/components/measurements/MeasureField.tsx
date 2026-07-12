// MeasureField.tsx — Compact labelled measurement input (e.g. "Chest  54").
// Shared (wardrobe-add ItemCard + try-on ResultScreen) — lives in src/components/
// so neither feature imports the other (Constitution VI).
//
// The value is stored as a number (cm, or EU number for shoe size); this component
// keeps a local string draft and calls onCommit with the parsed number (or undefined
// for empty/invalid) on blur. The draft re-syncs when `value` changes from outside
// (e.g. the AI mapper fills the grid), but NOT while the user is mid-edit — `value`
// only changes on commit/blur or external update, never on each keystroke.

import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { T, type } from '../../design/tokens';

interface Props {
  label: string;
  value: number | undefined;
  onCommit: (v: number | undefined) => void;
  /** Unit suffix shown under the field. Defaults to 'cm'; pass 'EU' for shoe size. */
  unit?: string;
}

export function MeasureField({ label, value, onCommit, unit = 'cm' }: Props) {
  const [draft, setDraft] = useState(value !== undefined ? String(value) : '');
  // Snapshot of the draft as of the last focus/commit — lets onBlur skip
  // re-committing (and re-triggering server re-evaluation) on a plain
  // tap-in-tap-out where the text never actually changed.
  const [lastCommitted, setLastCommitted] = useState(draft);

  // Re-sync the draft when the value is changed from outside (e.g. AI mapping
  // fills the field). Safe because `value` doesn't change while typing.
  useEffect(() => {
    const next = value !== undefined ? String(value) : '';
    setDraft(next);
    setLastCommitted(next);
  }, [value]);

  const handleBlur = () => {
    if (draft === lastCommitted) return;
    setLastCommitted(draft);
    // Vietnamese numeric keyboards use ',' as the decimal separator;
    // parseFloat("54,5") would otherwise truncate to 54.
    const n = parseFloat(draft.replace(',', '.'));
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
      <Text style={styles.unit}>{unit}</Text>
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
