import { useApp } from '@/lib/context';
import { modeLabel } from '@/lib/helpers';
import { Stethoscope, User, ClipboardList, RotateCcw } from 'lucide-react';
import type { Role } from '@/lib/types';

const roles: { id: Role; label: string; icon: typeof User }[] = [
  { id: 'patient', label: 'المستفيد', icon: User },
  { id: 'reception', label: 'الاستقبال', icon: ClipboardList },
  { id: 'doctor', label: 'الطبيب', icon: Stethoscope },
];

export function RoleSwitcher() {
  const { role, setRole, state, reset } = useApp();

  return (
    <header className="sticky top-0 z-40 safe-top">
      <div className="glass border-b border-line">
        <div className="max-w-md mx-auto px-4 pt-3 pb-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <img src="/images/Copy_of_White_Red_Simple_Modern_Data_Analysis_Presentation_(1).png" alt="استشير" className="w-9 h-9 rounded-xl object-cover shadow-card" />
            <div className="leading-tight">
              <h1 className="text-base font-bold text-ink">استشير</h1>
              <p className="text-[10px] text-inkSoft -mt-0.5">الرعاية الذكية</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <span className="text-[10px] text-inkSoft px-2 py-0.5 rounded-full bg-surfaceAlt border border-line">
              {modeLabel(state.mode)}
            </span>
            <button
              onClick={reset}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-inkSoft hover:bg-surfaceAlt active:scale-95 transition"
              aria-label="إعادة ضبط"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="max-w-md mx-auto px-4 pb-2.5">
          <div className="flex gap-1.5 p-1 rounded-xl bg-surfaceAlt border border-line">
            {roles.map((r) => {
              const active = role === r.id;
              const Icon = r.icon;
              return (
                <button
                  key={r.id}
                  onClick={() => setRole(r.id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                    active
                      ? 'bg-white text-primary shadow-card'
                      : 'text-inkSoft hover:text-ink'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" strokeWidth={active ? 2.4 : 2} />
                  {r.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </header>
  );
}
