import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { runWritingCheck, MAX_AI_CHARS, type CheckResult } from '@/lib/ai';
import { useEditor } from '@/lib/editor';
import { usePro } from '@/lib/pro';
import { Button, Card, colors, s } from '@/components/ui';

const badge: Record<string, string> = { spelling: '🔤 Spelling', grammar: '📝 Grammar', punctuation: '❗ Punctuation', style: '💡 Style' };

export default function Check() {
  const router = useRouter();
  const { text, setText } = useEditor();
  const { pro } = usePro();
  const [result, setResult] = useState<CheckResult | null>(null);
  useEffect(() => { runWritingCheck(text).then(setResult); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!result) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator color={colors.primary} size="large" /><Text style={[s.muted, { textAlign: 'center', marginTop: 10 }]}>Checking your writing…</Text></View>;

  if (!result.ok) return (
    <ScrollView contentContainerStyle={{ padding: 14 }}>
      <Card><Text style={s.h2}>{result.reason === 'limit' ? 'Daily limit reached' : result.reason === 'unconfigured' ? 'AI check unavailable' : 'Something went wrong'}</Text><Text>{result.message}</Text></Card>
      {result.reason === 'limit' && !pro && <Button title="Get TextCraft Pro" onPress={() => router.replace('/pro')} />}
      {result.reason === 'error' && <Button title="Try again" onPress={() => { setResult(null); runWritingCheck(text).then(setResult); }} />}
    </ScrollView>
  );

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: 14 }}>
      {text.length > MAX_AI_CHARS && <Card><Text style={s.muted}>Only the first {MAX_AI_CHARS} characters were checked.</Text></Card>}
      {result.limit !== null && result.used !== null && <Text style={[s.muted, { marginBottom: 8 }]}>{Math.max(0, result.limit - result.used)} of {result.limit} free checks left today.</Text>}
      <Card>
        <Text style={s.h2}>{result.issues.length ? `${result.issues.length} issue${result.issues.length > 1 ? 's' : ''} found` : '✅ No issues found'}</Text>
        {result.issues.map((i, n) => (
          <View key={n} style={{ borderTopWidth: n ? 1 : 0, borderColor: colors.border, paddingVertical: 8 }}>
            <Text style={{ fontWeight: '700' }}>{badge[i.type] ?? i.type}</Text>
            <Text><Text style={{ color: colors.danger, textDecorationLine: 'line-through' }}>{i.original}</Text>  →  <Text style={{ color: colors.good, fontWeight: '600' }}>{i.suggestion}</Text></Text>
            {!!i.explanation && <Text style={s.muted}>{i.explanation}</Text>}
          </View>
        ))}
      </Card>
      {result.suggestions.length > 0 && <Card><Text style={s.h2}>Suggestions</Text>{result.suggestions.map((t, n) => <Text key={n}>• {t}</Text>)}</Card>}
      {result.correctedText && result.correctedText !== text && (
        <Card>
          <Text style={s.h2}>Corrected text</Text>
          <Text selectable style={{ marginBottom: 10 }}>{result.correctedText}</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button title="Use corrected text" onPress={() => { setText(result.correctedText); router.back(); }} />
            <Button title="Copy" variant="ghost" onPress={async () => { await Clipboard.setStringAsync(result.correctedText); Alert.alert('Copied'); }} />
          </View>
        </Card>
      )}
      <Text style={[s.muted, { fontSize: 12, textAlign: 'center' }]}>AI suggestions can be wrong. Review before using.</Text>
    </ScrollView>
  );
}
