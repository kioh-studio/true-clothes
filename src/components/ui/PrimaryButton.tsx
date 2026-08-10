import React from 'react';
import { Pressable, Text, StyleSheet, ViewStyle } from 'react-native';
import { T, type } from '../../design/tokens';

interface Props {
  children: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  style?: ViewStyle;
  fullWidth?: boolean;
}

export function PrimaryButton({ children, onPress, disabled = false, style, fullWidth = true }: Props) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.button,
        fullWidth && styles.fullWidth,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      <Text style={styles.label}>{children}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 56,
    backgroundColor: T.color.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  disabled: {
    opacity: 0.3,
  },
  pressed: {
    opacity: 0.85,
  },
  label: {
    ...type.ui,
    color: T.color.canvas,
    // Android rounds the measured text width down and drops the trailing
    // letterSpacing, clipping the last glyph ("BEGIN" -> "BEGI").
    paddingHorizontal: 2,
  },
});
