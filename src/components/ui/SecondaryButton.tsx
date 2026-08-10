import React from 'react';
import { Pressable, Text, StyleSheet, ViewStyle, View } from 'react-native';
import { T, type } from '../../design/tokens';

interface Props {
  children: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  style?: ViewStyle;
  fullWidth?: boolean;
  icon?: React.ReactNode;
}

export function SecondaryButton({ children, onPress, disabled = false, style, fullWidth = true, icon }: Props) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={[styles.button, fullWidth && styles.fullWidth, disabled && styles.disabled, style]}
    >
      {icon && <View style={styles.icon}>{icon}</View>}
      <Text style={styles.label}>{children}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: T.color.primary,
    paddingHorizontal: 32,
    gap: 10,
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  disabled: {
    opacity: 0.4,
  },
  icon: {},
  label: {
    ...type.ui,
    color: T.color.primary,
    // Same trailing-letterSpacing clip guard as PrimaryButton.
    paddingHorizontal: 2,
  },
});
