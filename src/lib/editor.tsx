import React, { createContext, useContext, useState } from 'react';

type Editor = { text: string; setText: (t: string) => void; draftId: string | null; setDraftId: (id: string | null) => void };
const Ctx = createContext<Editor>({ text: '', setText: () => {}, draftId: null, setDraftId: () => {} });

export function EditorProvider({ children }: { children: React.ReactNode }) {
  const [text, setText] = useState('');
  const [draftId, setDraftId] = useState<string | null>(null);
  return <Ctx.Provider value={{ text, setText, draftId, setDraftId }}>{children}</Ctx.Provider>;
}
export const useEditor = () => useContext(Ctx);
