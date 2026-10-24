import AsyncStorage from '@react-native-async-storage/async-storage';

export type Draft = { id: string; title: string; text: string; updatedAt: number };
const KEY = 'textcraft.drafts.v1';

export async function listDrafts(): Promise<Draft[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const list: Draft[] = raw ? JSON.parse(raw) : [];
    return list.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch { return []; }
}

export function titleFor(text: string) {
  const first = text.trim().split('\n')[0]?.trim() ?? '';
  return first ? (first.length > 48 ? first.slice(0, 48) + '…' : first) : 'Untitled draft';
}

export async function saveDraft(text: string, id?: string | null): Promise<Draft> {
  const list = await listDrafts();
  const draft: Draft = { id: id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, title: titleFor(text), text, updatedAt: Date.now() };
  const next = [draft, ...list.filter((d) => d.id !== draft.id)];
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  return draft;
}

export async function deleteDraft(id: string) {
  const list = await listDrafts();
  await AsyncStorage.setItem(KEY, JSON.stringify(list.filter((d) => d.id !== id)));
}
