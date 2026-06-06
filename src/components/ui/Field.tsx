import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, ViewStyle, KeyboardTypeOptions } from 'react-native';
import { T, type } from '../../design/tokens';

interface Props {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  suffix?: string;
  error?: string | null;
  helper?: string | null;
  autoFocus?: boolean;
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean;
  style?: ViewStyle;
  editable?: boolean;
}

export function Field({
  label, value, onChange, placeholder = '', keyboardType, suffix, error, helper,
  autoFocus = false, secureTextEntry = false, autoCapitalize, autoCorrect, style, editable = true,
}: Props) {
  const [focused, setFocused] = useState(false);
  const showLabel = focused || (value !== '' && value !== undefined);

  return (
    <View style={[styles.wrapper, style]}>
      <View style={styles.inputRow}>
        {label ? (
          <Text style={[styles.label, error && styles.labelError, showLabel ? styles.labelUp : styles.labelMid]}>
            {label}
          </Text>
        ) : null}
        <View style={styles.inputLine}>
          <TextInput
            value={value}
            onChangeText={onChange}
            placeholder={focused ? placeholder : ''}
            placeholderTextColor={T.color.tertiary}
            keyboardType={keyboardType}
            autoFocus={autoFocus}
            secureTextEntry={secureTextEntry}
            autoCapitalize={autoCapitalize}
            autoCorrect={autoCorrect}
            editable={editable}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={styles.input}
          />
          {suffix && <Text style={styles.suffix}>{suffix}</Text>}
        </View>
        <View style={[styles.underline, focused && styles.underlineFocused, !!error && styles.underlineError]} />
      </View>
      {(helper || error) && (
        <Text style={[styles.helper, error && styles.helperError]}>{error || helper}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {},
  inputRow: {
    height: 64,
    position: 'relative',
    justifyContent: 'flex-end',
  },
  label: {
    ...type.micro,
    color: T.color.tertiary,
    position: 'absolute',
    left: 0,
    top: 0,
  },
  labelUp: { opacity: 1 },
  labelMid: { opacity: 0.6, top: 24 },
  labelError: { color: T.color.error },
  inputLine: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingBottom: 8,
  },
  input: {
    flex: 1,
    ...type.bodyL,
    color: T.color.primary,
    padding: 0,
    height: 36,
  },
  suffix: {
    ...type.ui,
    color: T.color.tertiary,
    marginLeft: 8,
    paddingBottom: 2,
  },
  underline: {
    height: 0.5,
    backgroundColor: T.color.hairline,
  },
  underlineFocused: {
    height: 1,
    backgroundColor: T.color.primary,
  },
  underlineError: {
    height: 1,
    backgroundColor: T.color.error,
  },
  helper: {
    ...type.caption,
    fontSize: 12,
    color: T.color.tertiary,
    marginTop: 8,
  },
  helperError: {
    color: T.color.error,
  },
});
