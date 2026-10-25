import React from 'react';
import { Linking, ScrollView, Text } from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { usePro } from '@/lib/pro';
import { aiConfigured } from '@/lib/ai';
import { Button, Card, colors, s } from '@/components/ui';

const PRIVACY_URL = process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL ?? 'https://github.com/ANKHOSTING/TextCounter/blob/main/PRIVACY_POLICY.md';

export default function Settings() {
  const router = useRouter();
  const { pro } = usePro();
  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: 14 }}>
      <Card>
        <Text style={s.h2}>{pro ? '⭐ TextCraft Pro active' : 'TextCraft Pro'}</Text>
        <Text style={[s.muted, { marginBottom: 10 }]}>{pro ? 'Unlimited AI checks, no ads. Thank you!' : 'Unlimited AI writing checks and no ads.'}</Text>
        <Button title={pro ? 'Manage Pro' : 'Upgrade to Pro'} onPress={() => router.push('/pro')} />
      </Card>
      <Card>
        <Text style={s.h2}>AI writing check</Text>
        <Text style={s.muted}>{aiConfigured() ? 'Connected. Free users get a few checks per day.' : 'Not configured in this build. Counting and analysis work fully offline.'}</Text>
      </Card>
      <Card>
        <Text style={s.h2}>Privacy</Text>
        <Text style={[s.muted, { marginBottom: 10 }]}>No account needed. Drafts stay on your device. Text is sent to our AI service only when you tap “AI writing check”.</Text>
        <Button title="Privacy policy" variant="ghost" onPress={() => Linking.openURL(PRIVACY_URL)} />
      </Card>
      <Text style={[s.muted, { textAlign: 'center' }]}>TextCraft: Word Counter v{Constants.expoConfig?.version}</Text>
    </ScrollView>
  );
}
