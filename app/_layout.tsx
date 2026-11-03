import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ProProvider } from '@/lib/pro';
import { EditorProvider } from '@/lib/editor';
import { initPurchases } from '@/lib/purchases';
import { initMobileAds } from '@/lib/mobileAds';
import { colors } from '@/components/ui';

initPurchases();

export default function RootLayout() {
  useEffect(() => { initMobileAds(); }, []);
  return (
    <ProProvider>
      <EditorProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerTintColor: colors.primary }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="check" options={{ title: 'AI writing check' }} />
          <Stack.Screen name="pro" options={{ title: 'TextCraft Pro', presentation: 'modal' }} />
        </Stack>
      </EditorProvider>
    </ProProvider>
  );
}
