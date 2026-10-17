import { useEffect, useRef, useState, useCallback } from 'react';
import { AppContext, type AppContextValue } from './lib/context';
import { loadState, saveState, subscribeState } from './lib/state';
import { initialState, type DemoState, type Role } from './lib/types';
import { patch as patchState } from './lib/helpers';
import { resetState } from './lib/flows';
import { RoleSwitcher } from './components/RoleSwitcher';
import { PatientView } from './components/PatientView';
import { ReceptionView } from './components/ReceptionView';
import { DoctorView } from './components/DoctorView';

function App() {
  const [state, setState] = useState<DemoState>(initialState);
  const [role, setRole] = useState<Role>('patient');
  const [loaded, setLoaded] = useState(false);
  const skipNextRemote = useRef(false);

  useEffect(() => {
    let mounted = true;
    loadState().then((s) => {
      if (mounted) {
        setState(s);
        setLoaded(true);
      }
    });
    const unsub = subscribeState((remote) => {
      if (skipNextRemote.current) {
        skipNextRemote.current = false;
        return;
      }
      setState(remote);
    });
    return () => {
      mounted = false;
      unsub();
    };
  }, []);

  const update = useCallback(
    (p: Partial<DemoState>) => {
      setState((prev) => {
        const next = patchState(prev, p);
        skipNextRemote.current = true;
        saveState(next);
        return next;
      });
    },
    []
  );

  const reset = useCallback(() => {
    update(resetState());
  }, [update]);

  if (!loaded) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-surface">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-primary animate-pulse-soft" />
          <p className="text-inkSoft text-sm">جارٍ التحميل…</p>
        </div>
      </div>
    );
  }

  const ctx: AppContextValue = { state, role, setRole, update, reset };

  return (
    <AppContext.Provider value={ctx}>
      <div className="min-h-[100dvh] bg-surface flex flex-col">
        <RoleSwitcher />
        <main className="flex-1 flex flex-col">
          {role === 'patient' && <PatientView />}
          {role === 'reception' && <ReceptionView />}
          {role === 'doctor' && <DoctorView />}
        </main>
      </div>
    </AppContext.Provider>
  );
}

export default App;
