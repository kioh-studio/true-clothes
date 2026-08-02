import React from 'react';
import { View, ViewStyle, StyleProp } from 'react-native';
import { CONTENT_MAX } from '../../design/layout';

/** Centers its children at a max width on wide screens; full-width on phones.
 *  Works inside a ScrollView contentContainer (alignSelf centers the column). */
export function Bounded({
  children,
  max = CONTENT_MAX,
  style,
}: {
  children: React.ReactNode;
  max?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ width: '100%', maxWidth: max, alignSelf: 'center' }, style]}>
      {children}
    </View>
  );
}
