import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { deleteDraft, listDrafts, type Draft } from '@/lib/drafts';
import { analyze } from '@/lib/textStats';
import { useEditor } from '@/lib/editor';
import { Card, colors, s } from '@/components/ui';

export default function Drafts() {
  const router = useRouter();
  const { setText, setDraftId } = useEditor();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const load = useCallback(() => { listDrafts().then(setDrafts); }, []);
  useFocusEffect(load);

  const open = (d: Draft) => { setText(d.text); setDraftId(d.id); router.navigate('/'); };
  const remove = (d: Draft) => Alert.alert('Delete draft?', d.title, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => { await deleteDraft(d.id); load(); } },
  ]);

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: 14 }} data={drafts} keyExtractor={(d) => d.id}
      ListEmptyComponent={<Card><Text style={s.muted}>No saved drafts yet. Tap Save on the Write tab. Drafts are stored only on this device.</Text></Card>}
      renderItem={({ item }) => (
        <Pressable onPress={() => open(item)} onLongPress={() => remove(item)}>
          <Card>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontWeight: '700', flex: 1 }} numberOfLines={1}>{item.title}</Text>
              <Pressable onPress={() => remove(item)} hitSlop={10}><Text style={{ color: colors.danger }}>Delete</Text></Pressable>
            </View>
            <Text style={s.muted}>{analyze(item.text).words} words · {new Date(item.updatedAt).toLocaleString()}</Text>
          </Card>
        </Pressable>
      )}
    />
  );
}
