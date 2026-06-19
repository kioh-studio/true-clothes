// FieldRow.tsx — Expandable field row: tap to open a chip picker or edit text inline.
// Used inside ItemCard for type, colour, fabric, brand, link fields.

import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { T, type } from '../../../design/tokens';
import { IconEdit } from '../../../components/icons';
import { Picker } from './Picker';

interface BaseProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
}

interface PickerProps extends BaseProps {
  mode: 'picker';
  options: string[];
  swatch?: (v: string) => string;
  placeholder?: never;
}

interface TextProps extends BaseProps {
  mode: 'text';
  placeholder?: string;
  options?: never;
  swatch?: never;
}

type Props = PickerProps | TextProps;

export function FieldRow(props: Props) {
  const [open, setOpen] = useState(false);

  if (props.mode === 'picker') {
    const { label, value, onChange, options, swatch } = props;
    return (
      <View style={styles.wrapper}>
        <Pressable onPress={() => setOpen((o) => !o)} style={styles.row}>
          <Text style={styles.fieldLabel}>{label}</Text>
          <View style={styles.valueRow}>
            {swatch && (
              <View style={[styles.swatch, { backgroundColor: swatch(value) }]} />
            )}
            <Text style={styles.valueText}>{value}</Text>
            <IconEdit size={13} strokeWidth={1.4} color={T.color.tertiary} />
          </View>
        </Pressable>
        {open && (
          <Picker
            label={`CHOOSE ${label}`}
            value={value}
            options={options}
            swatch={swatch}
            onPick={(v) => { onChange(v); setOpen(false); }}
          />
        )}
      </View>
    );
  }

  // text mode
  const { label, value, onChange, placeholder } = props;
  return (
    <View style={[styles.wrapper, styles.textRow]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder ?? ''}
        placeholderTextColor={T.color.tertiary}
        style={styles.textInput}
        textAlign="right"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingVertical: 12,
    borderTopWidth: 0.5,
    borderTopColor: T.color.hairline,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  textRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fieldLabel: {
    ...type.ui,
    fontSize: 9,
    color: T.color.tertiary,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  swatch: {
    width: 12,
    height: 12,
    borderRadius: 999,
    borderWidth: 0.5,
    borderColor: 'rgba(26,24,21,0.15)',
  },
  valueText: {
    fontFamily: T.font.sans,
    fontSize: 15,
    color: T.color.primary,
  },
  textInput: {
    flex: 1,
    minWidth: 0,
    fontFamily: T.font.sans,
    fontSize: 15,
    color: T.color.primary,
    padding: 0,
    textAlign: 'right',
  },
});
