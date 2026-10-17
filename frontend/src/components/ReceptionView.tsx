import { useApp } from '@/lib/context';
import { type DemoState } from '@/lib/types';
import {
  Users,
  Clock,
  Activity,
  Stethoscope,
  CheckCircle2,
  XCircle,
  Settings2,
  LogIn,
  LogOut,
  Bell,
  MapPin,
  Calendar,
} from 'lucide-react';

export function ReceptionView() {
  const { state, update } = useApp();
  const occupancy = 68;
  const waiting = 4;
  const availableDoctors = 3;
  const estWait = 18;
  const congestion = 62;

  const hasRequest = state.arrivalStatus === 'requested' && state.requestedSlot;

  return (
    <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full px-4 pt-4 pb-6 overflow-y-auto no-scrollbar">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-ink mb-1">لوحة الاستقبال</h2>
        <p className="text-xs text-inkSoft">نظرة شاملة على حالة المرفق والطلبات الواردة</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <StatCard icon={Activity} label="نسبة الإشغال" value={`${occupancy}%`} tone="primary" />
        <StatCard icon={Users} label="مرضى بانتظار" value={`${waiting}`} tone="teal" />
        <StatCard icon={Stethoscope} label="أطباء متاحون" value={`${availableDoctors}`} tone="emerald" />
        <StatCard icon={Clock} label="متوسط الانتظار" value={`${estWait} د`} tone="sand" />
      </div>

      {/* Congestion bar */}
      <div className="rounded-2xl bg-white border border-line shadow-card p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-inkSoft">مستوى الازدحام</p>
          <span className={`text-xs font-bold ${congestion > 70 ? 'text-primary' : 'text-emerald-600'}`}>
            {congestion > 70 ? 'مرتفع' : 'متوسط'}
          </span>
        </div>
        <div className="h-2.5 rounded-full bg-surfaceAlt overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-l from-primary to-primary-dark transition-all duration-700"
            style={{ width: `${congestion}%` }}
          />
        </div>
      </div>

      {/* Incoming Smart Arrival request */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <Bell className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-bold text-ink">طلبات الموعد الذكي</h3>
        </div>

        {hasRequest && state.requestedSlot ? (
          <div className="rounded-2xl bg-white border-2 border-primary/20 shadow-float p-4 animate-rise">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-sm font-bold text-ink">{state.patientName || 'مستفيد جديد'}</p>
                <p className="text-[11px] text-inkSoft">رقم طبي: {state.recordNumber}</p>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-primary-50 text-primary text-[10px] font-semibold animate-pulse-soft">
                جديد
              </span>
            </div>

            <div className="space-y-2 mb-3 text-xs">
              <Row icon={MapPin} label="المرفق" value={state.requestedSlot.facilityName} />
              <Row icon={Calendar} label="الموعد" value={`${state.requestedSlot.date} · ${state.requestedSlot.time}`} />
              <Row icon={Clock} label="انتظار متوقع" value={`${state.requestedSlot.waitMin} د`} />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => update({ arrivalStatus: 'approved', confirmedSlot: state.requestedSlot, patientStatus: 'confirmed' })}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold active:scale-95 transition"
              >
                <CheckCircle2 className="w-4 h-4" />
                موافقة
              </button>
              <button
                onClick={() => update({ arrivalStatus: 'adjusted', requestedSlot: { ...state.requestedSlot!, time: '٤:٠٠ م' } })}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-sand-light text-ink text-sm font-semibold border border-sand active:scale-95 transition"
              >
                <Settings2 className="w-4 h-4" />
                تعديل
              </button>
              <button
                onClick={() => update({ arrivalStatus: 'rejected' })}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-primary-50 text-primary text-sm font-semibold active:scale-95 transition"
              >
                <XCircle className="w-4 h-4" />
                رفض
              </button>
            </div>

            {state.arrivalStatus === 'adjusted' && (
              <div className="mt-3 p-3 rounded-xl bg-sand-light border border-sand/40 flex items-center justify-between">
                <p className="text-xs text-inkSoft">تم التعديل إلى ٤:٠٠ م</p>
                <button
                  onClick={() => update({ arrivalStatus: 'approved', confirmedSlot: { ...state.requestedSlot!, time: '٤:٠٠ م' }, patientStatus: 'confirmed' })}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold"
                >
                  تأكيد
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-2xl bg-white border border-line p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-surfaceAlt flex items-center justify-center mx-auto mb-2">
              <Bell className="w-5 h-5 text-inkSoft" />
            </div>
            <p className="text-xs text-inkSoft">لا توجد طلبات واردة حالياً</p>
          </div>
        )}
      </div>

      {/* Waiting patients list */}
      <div>
        <h3 className="text-sm font-bold text-ink mb-2">المرضى في الانتظار</h3>
        <div className="space-y-2">
          {waitingPatients(state).map((p) => (
            <div key={p.id} className="flex items-center justify-between p-3 rounded-xl bg-white border border-line shadow-card">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-surfaceAlt flex items-center justify-center text-xs font-bold text-inkSoft">
                  {p.initials}
                </div>
                <div>
                  <p className="text-sm font-semibold text-ink">{p.name}</p>
                  <p className="text-[10px] text-inkSoft">{p.status}</p>
                </div>
              </div>
              {p.checkedIn ? (
                <button
                  onClick={() => update({ checkedInPatients: { ...state.checkedInPatients, [p.id]: false } })}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surfaceAlt text-inkSoft text-xs font-semibold active:scale-95 transition"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  خروج
                </button>
              ) : (
                <button
                  onClick={() => update({ checkedInPatients: { ...state.checkedInPatients, [p.id]: true } })}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-teal text-sand text-xs font-semibold active:scale-95 transition"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  تسجيل دخول
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function waitingPatients(state: DemoState) {
  const map = state.checkedInPatients ?? {};
  const base = [
    { id: '1', name: 'نورة الحربي', initials: 'ن ح', status: 'في الانتظار' },
    { id: '2', name: 'خالد الزهراني', initials: 'خ ز', status: 'غرفة ٣' },
    { id: '3', name: 'ريم السبيعي', initials: 'ر س', status: 'قادم' },
  ];
  if (state.arrivalStatus === 'approved' && state.confirmedSlot) {
    base.push({
      id: '4',
      name: state.patientName || 'مستفيد جديد',
      initials: 'م',
      status: 'موعد ذكي مؤكد',
    });
  }
  return base.map((p) => ({ ...p, checkedIn: map[p.id] ?? false }));
}

function StatCard({ icon: Icon, label, value, tone }: {
  icon: typeof Users;
  label: string;
  value: string;
  tone: 'primary' | 'teal' | 'emerald' | 'sand';
}) {
  const tones: Record<string, { bg: string; text: string }> = {
    primary: { bg: 'bg-primary-50', text: 'text-primary' },
    teal: { bg: 'bg-teal-50', text: 'text-teal' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600' },
    sand: { bg: 'bg-sand-light', text: 'text-primary-dark' },
  };
  const t = tones[tone];
  return (
    <div className="rounded-2xl bg-white border border-line shadow-card p-3.5">
      <div className={`w-9 h-9 rounded-lg ${t.bg} flex items-center justify-center mb-2`}>
        <Icon className={`w-4.5 h-4.5 ${t.text}`} />
      </div>
      <p className="text-[10px] text-inkSoft mb-0.5">{label}</p>
      <p className="text-lg font-bold text-ink">{value}</p>
    </div>
  );
}

function Row({ icon: Icon, label, value }: { icon: typeof MapPin; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5 text-inkSoft">
        <Icon className="w-3.5 h-3.5" />
        <span>{label}</span>
      </div>
      <span className="font-semibold text-ink">{value}</span>
    </div>
  );
}
