import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { isPro } from './purchases';

const ProContext = createContext<{ pro: boolean; refresh: () => Promise<void> }>({ pro: false, refresh: async () => {} });

export function ProProvider({ children }: { children: React.ReactNode }) {
  const [pro, setPro] = useState(false);
  const refresh = useCallback(async () => setPro(await isPro()), []);
  useEffect(() => { refresh(); }, [refresh]);
  return <ProContext.Provider value={{ pro, refresh }}>{children}</ProContext.Provider>;
}
export const usePro = () => useContext(ProContext);
