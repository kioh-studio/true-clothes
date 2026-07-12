// TagEditor.tsx — Editable tag chips: remove with ×, add via text input.

import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { T, type } from '../../../design/tokens';
import { IconX } from '../../../components/icons';
import { useTranslation } from '../../../i18n';

interface Props {
  tags: string[];
  onChange: (tags: string[]) => void;
}

export function TagEditor({ tags, onChange }: Props) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');

  const commit = () => {
    const val = draft.trim();
    if (val && !tags.some((x) => x.toLowerCase() === val.toLowerCase())) {
      onChange([...tags, val]);
    }
    setDraft('');
  };

  const remove = (tag: string) => onChange(tags.filter((x) => x !== tag));

  return (
    <View style={styles.row}>
      {tags.map((tag) => (
        <View key={tag} style={styles.chip}>
          <Text style={styles.chipText}>{tag}</Text>
          <Pressable onPress={() => remove(tag)} hitSlop={8} accessibilityLabel={t('tagEditor_removeAccessibility', { tag })}>
            <IconX size={11} strokeWidth={1.8} color={T.color.canvas} />
          </Pressable>
        </View>
      ))}
      <TextInput
        value={draft}
        onChangeText={setDraft}
        onSubmitEditing={commit}
        onBlur={commit}
        placeholder={t('tagEditor_addTagPlaceholder')}
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
