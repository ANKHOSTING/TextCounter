import React from 'react';
import { Text } from 'react-native';
import { Tabs } from 'expo-router';
import { colors } from '@/components/ui';

const icon = (e: string) => ({ color }: { color: import('react-native').ColorValue }) => <Text style={{ fontSize: 18, color }}>{e}</Text>;

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: colors.primary, headerTintColor: colors.text }}>
      <Tabs.Screen name="index" options={{ title: 'TextCraft', tabBarLabel: 'Write', tabBarIcon: icon('✍️') }} />
      <Tabs.Screen name="analysis" options={{ title: 'Analysis', tabBarIcon: icon('📊') }} />
      <Tabs.Screen name="drafts" options={{ title: 'Drafts', tabBarIcon: icon('🗂️') }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: icon('⚙️') }} />
    </Tabs>
  );
}
