import React from 'react';
import { Pressable, Text, StyleSheet, ViewStyle } from 'react-native';
import { T, type } from '../../design/tokens';

interface Props {
  children: React.ReactNode;
  selected?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
  size?: 'sm' | 'md';
}

export function Tag({ children, selected = false, onPress, style, size = 'md' }: Props) {
  const padV = size === 'sm' ? 6 : 8;
  const padH = size === 'sm' ? 12 : 14;
  const fontSize = size === 'sm' ? 9 : 10;

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.tag,
        { paddingVertical: padV, paddingHorizontal: padH },
        selected ? styles.selected : styles.unselected,
        style,
      ]}
    >
      <Text style={[styles.label, { fontSize }, selected ? styles.labelSelected : styles.labelUnselected]}>
        {children}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tag: {
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  selected: {
    backgroundColor: T.color.primary,
  },
  unselected: {
    backgroundColor: 'transparent',
    borderWidth: 0.5,
    borderColor: T.color.hairlineStrong,
  },
  label: {
    ...type.ui,
  },
  labelSelected: {
    color: T.color.canvas,
  },
  labelUnselected: {
    color: T.color.primary,
  },
});
