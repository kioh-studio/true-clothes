// TagEditor.tsx — Editable tag chips: remove with ×, add via text input.

import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { T, type } from '../../../design/tokens';
import { IconX } from '../../../components/icons';

interface Props {
  tags: string[];
  onChange: (tags: string[]) => void;
}

export function TagEditor({ tags, onChange }: Props) {
  const [draft, setDraft] = useState('');

  const commit = () => {
    const t = draft.trim();
    if (t && !tags.some((x) => x.toLowerCase() === t.toLowerCase())) {
      onChange([...tags, t]);
    }
    setDraft('');
  };

  const remove = (tag: string) => onChange(tags.filter((x) => x !== tag));

  return (
    <View style={styles.row}>
      {tags.map((t) => (
        <View key={t} style={styles.chip}>
          <Text style={styles.chipText}>{t}</Text>
          <Pressable onPress={() => remove(t)} hitSlop={8} accessibilityLabel={`Remove ${t}`}>
            <IconX size={11} strokeWidth={1.8} color={T.color.canvas} />
          </Pressable>
        </View>
      ))}
      <TextInput
        value={draft}
        onChangeText={setDraft}
        onSubmitEditing={commit}
        onBlur={commit}
        placeholder="Add tag…"
        placeholderTextColor={T.color.tertiary}
        returnKeyType="done"
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingLeft: 12,
    paddingRight: 8,
    borderRadius: 999,
    backgroundColor: T.color.primary,
  },
  chipText: {
    ...type.ui,
    fontSize: 9,
    color: T.color.canvas,
  },
  input: {
    flex: 1,
    minWidth: 70,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 0.5,
    borderColor: T.color.hairlineStrong,
    borderStyle: 'dashed',
    borderRadius: 999,
    fontFamily: T.font.sans,
    fontSize: 12,
    color: T.color.primary,
  },
});
