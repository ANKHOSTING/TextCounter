import React from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

export const colors = { primary: '#4F46E5', primaryDark: '#3730A3', bg: '#F5F6FB', card: '#FFFFFF', text: '#111827', muted: '#6B7280', border: '#E5E7EB', danger: '#DC2626', good: '#059669' };

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[s.card, style]}>{children}</View>;
}
export function Button({ title, onPress, variant = 'primary', disabled }: { title: string; onPress: () => void; variant?: 'primary' | 'ghost' | 'danger'; disabled?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled}
      style={({ pressed }) => [s.btn, variant === 'primary' && { backgroundColor: colors.primary }, variant === 'ghost' && s.ghost, variant === 'danger' && { backgroundColor: colors.danger }, (pressed || disabled) && { opacity: 0.6 }]}>
      <Text style={[s.btnText, variant === 'ghost' && { color: colors.primary }]}>{title}</Text>
    </Pressable>
  );
}
export function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={s.stat}>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}
export const s = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
  btn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, alignItems: 'center', flexGrow: 1 },
  ghost: { backgroundColor: '#EEF2FF' },
  btnText: { color: '#fff', fontWeight: '600' },
  stat: { width: '33.33%', paddingVertical: 8, alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '700', color: colors.text },
  statLabel: { fontSize: 12, color: colors.muted, textAlign: 'center' },
  h2: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 8 },
  muted: { color: colors.muted },
});
