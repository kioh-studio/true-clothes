import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { T } from '../../design/tokens';

interface Props {
  vertical?: boolean;
  style?: ViewStyle;
}

export function Divider({ vertical = false, style }: Props) {
  return (
    <View style={[vertical ? styles.vertical : styles.horizontal, style]} />
  );
}

const styles = StyleSheet.create({
  horizontal: {
    width: '100%',
    height: 0.5,
    backgroundColor: T.color.hairline,
  },
  vertical: {
    width: 0.5,
    height: '100%',
    backgroundColor: T.color.hairline,
  },
});
