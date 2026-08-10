// CreditQuotaNote — one quiet line telling the user how much of this month's
// AI allowance is left. Rendered next to the action that spends it.
//
// Renders nothing when there is no usable reading (loading, demo account,
// failed query) — see useCreditQuota. Purely informational: no tap target, no
// banner chrome. The exhausted/upgrade states have their own banners already;
// this line must not compete with them.

import React from 'react';
import { Text, StyleSheet, type StyleProp, type TextStyle } from 'react-native';
import { T, type } from '../../../design/tokens';
import { useTranslation } from '../../../i18n';
import type { CreditStatus, CreditType } from '../../../services/usageCreditService';

interface Props {
  status: CreditStatus | null;
  creditType: CreditType;
  style?: StyleProp<TextStyle>;
}

export function CreditQuotaNote({ status, creditType, style }: Props) {
  const { t } = useTranslation();
  if (!status) return null;

  const key = creditType === 'try_on' ? 'creditQuota_tryOnsLeft' : 'creditQuota_scansLeft';
  return (
    <Text style={[styles.note, style]}>
      {t(key, { remaining: status.remaining, limit: status.limit })}
    </Text>
  );
}

const styles = StyleSheet.create({
  note: {
    ...type.caption,
    fontSize: 11,
    color: T.color.tertiary,
  },
});
