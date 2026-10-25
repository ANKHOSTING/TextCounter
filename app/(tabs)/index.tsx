import React, { useMemo } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { analyze, formatDuration } from '@/lib/textStats';
import { saveDraft } from '@/lib/drafts';
import { useEditor } from '@/lib/editor';
import { AdBanner } from '@/components/AdBanner';
import { Button, Card, Stat, colors, s } from '@/components/ui';

export default function Write() {
  const router = useRouter();
  const { text, setText, draftId, setDraftId } = useEditor();
  const st = useMemo(() => analyze(text), [text]);

  const paste = async () => { const t = await Clipboard.getStringAsync(); if (t) setText(text ? `${text}${text.endsWith('\n') ? '' : '\n'}${t}` : t); };
  const copy = async () => { await Clipboard.setStringAsync(text); Alert.alert('Copied to clipboard'); };
  const clear = () => { if (!text) return; Alert.alert('Clear text?', 'Unsaved changes will be lost.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Clear', style: 'destructive', onPress: () => { setText(''); setDraftId(null); } }]); };
  const save = async () => { if (!text.trim()) return; const d = await saveDraft(text, draftId); setDraftId(d.id); Alert.alert('Draft saved', 'Saved on this device.'); };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: 14 }} keyboardShouldPersistTaps="handled">
        <Card style={{ flexDirection: 'row', flexWrap: 'wrap', paddingVertical: 6 }}>
          <Stat label="Words" value={st.words} />
          <Stat label="Characters" value={st.characters} />
          <Stat label="No spaces" value={st.charactersNoSpaces} />
          <Stat label="Sentences" value={st.sentences} />
          <Stat label="Paragraphs" value={st.paragraphs} />
          <Stat label="Reading" value={formatDuration(st.readingSeconds)} />
        </Card>
        <TextInput
          testID="editor" multiline value={text} onChangeText={setText} placeholder="Start typing or paste your text…"
          placeholderTextColor={colors.muted} textAlignVertical="top"
          style={{ minHeight: 260, backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 14, fontSize: 16, color: colors.text, marginBottom: 12 }}
        />
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
          <Button title="Paste" variant="ghost" onPress={paste} />
          <Button title="Copy" variant="ghost" onPress={copy} disabled={!text} />
          <Button title="Clear" variant="ghost" onPress={clear} disabled={!text} />
          <Button title="Save" variant="ghost" onPress={save} disabled={!text.trim()} />
        </View>
        <Button title="✨ AI writing check" onPress={() => router.push('/check')} disabled={!text.trim()} />
        <Text style={[s.muted, { fontSize: 12, marginTop: 8, textAlign: 'center' }]}>Counting works offline. Text only leaves your device when you run an AI check.</Text>
      </ScrollView>
      <AdBanner />
    </KeyboardAvoidingView>
  );
}
