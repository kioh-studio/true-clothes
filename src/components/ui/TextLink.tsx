import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { T, type } from '../../design/tokens';

interface Props {
  children: React.ReactNode;
  onPress?: () => void;
  color?: string;
  arrow?: boolean;
}

export function TextLink({ children, onPress, color = T.color.primary, arrow = false }: Props) {
  return (
    <Pressable onPress={onPress}>
      <Text style={[styles.text, { color }]}>
        {children}{arrow ? ' →' : ''}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  text: {
    ...type.ui,
    textDecorationLine: 'underline',
    // Same trailing-letterSpacing clip guard as PrimaryButton.
    paddingHorizontal: 2,
  },
});
