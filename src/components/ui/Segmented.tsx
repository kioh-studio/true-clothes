import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { T, type } from '../../design/tokens';

interface Props {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}

export function Segmented({ options, value, onChange }: Props) {
  return (
    <View style={styles.container}>
      {options.map((opt) => {
        const active = opt === value;
        return (
          <Pressable
            key={opt}
            onPress={() => onChange(opt)}
            style={[styles.option, active && styles.optionActive]}
          >
            <Text style={[styles.label, active ? styles.labelActive : styles.labelInactive]}>
              {opt}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderWidth: 0.5,
    borderColor: T.color.hairlineStrong,
    borderRadius: 999,
    padding: 2,
  },
  option: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  optionActive: {
    backgroundColor: T.color.primary,
  },
  label: {
    ...type.ui,
    fontSize: 9,
  },
  labelActive: {
    color: T.color.canvas,
  },
  labelInactive: {
    color: T.color.tertiary,
  },
});
