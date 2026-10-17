import { createContext, useContext } from 'react';
import type { DemoState, Role } from './types';

export interface AppContextValue {
  state: DemoState;
  role: Role;
  setRole: (r: Role) => void;
  update: (patch: Partial<DemoState>) => void;
  reset: () => void;
}

export const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
