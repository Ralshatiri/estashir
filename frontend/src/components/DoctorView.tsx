import { useApp } from '@/lib/context';
import {
  Stethoscope,
  FileText,
  AlertTriangle,
  Activity,
  CheckCircle2,
  Phone,
  Sparkles,
} from 'lucide-react';
import { useState } from 'react';

export function DoctorView() {
  const { state, update } = useApp();
  const [decision, setDecision] = useState(state.doctorDecision || '');
  const [notes, setNotes] = useState(state.doctorNotes || '');

  const hasPatient = state.consentGiven && state.recordNumber;

  return (
    <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full px-4 pt-4 pb-6 overflow-y-auto no-scrollbar">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-ink mb-1">لوحة الطبيب</h2>
        <p className="text-xs text-inkSoft">ملخص المريض والقرار السريري النهائي</p>
      </div>

      {!hasPatient ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-16">
          <div className="w-16 h-16 rounded-full bg-surfaceAlt flex items-center justify-center mb-3">
            <Stethoscope className="w-7 h-7 text-inkSoft" />
          </div>
          <p className="text-sm text-inkSoft">لا يوجد مرضى واردون حالياً</p>
        </div>
      ) : (
        <>
          {/* Patient card */}
          <div className="rounded-2xl bg-white border border-line shadow-card p-4 mb-3 animate-rise">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center text-sand font-bold text-lg">
                {(state.patientName || 'م')[0]}
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-ink">{state.patientName || 'مستفيد'}</p>
                <p className="text-[11px] text-inkSoft">
                  {state.patientAge > 0 ? `${state.patientAge} سنة · ` : ''}رقم طبي: {state.recordNumber}
                </p>
              </div>
              {state.triage === 'emergency' && (
                <span className="px-2 py-1 rounded-full bg-primary text-white text-[10px] font-bold animate-pulse-soft flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  طارئ
                </span>
              )}
            </div>

            {/* AI Summary */}
            <div className="rounded-xl bg-teal-50 border border-teal-100 p-3 mb-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Sparkles className="w-3.5 h-3.5 text-teal" />
                <p className="text-[11px] font-semibold text-teal-700">ملخص الذكاء الاصطناعي</p>
              </div>
              <p className="text-xs text-teal-700 leading-relaxed">
                {state.triageSummary || 'جارٍ التحليل…'}
              </p>
            </div>

            {/* Symptoms */}
            <div className="mb-3">
              <p className="text-[11px] font-semibold text-inkSoft mb-1.5">الأعراض المجمعة</p>
              <div className="flex flex-wrap gap-1.5">
                {state.symptoms.length > 0 ? (
                  state.symptoms.map((s, i) => (
                    <span key={i} className="px-2.5 py-1 rounded-lg bg-surfaceAlt border border-line text-[11px] text-ink">
                      {s}
                    </span>
                  ))
                ) : (
                  <span className="text-[11px] text-inkSoft">لا توجد أعراض مسجلة</span>
                )}
              </div>
            </div>

            {/* Triage pathway */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-sand-light border border-sand/40">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                <span className="text-xs text-inkSoft">مسار التوجيه</span>
              </div>
              <span className="text-xs font-bold text-primary">{triageLabel(state.triage)}</span>
            </div>
          </div>

          {/* Consultation / Decision */}
          <div className="rounded-2xl bg-white border border-line shadow-card p-4 mb-3 animate-rise">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-4 h-4 text-ink" />
              <h3 className="text-sm font-bold text-ink">الاستشارة والقرار السريري</h3>
            </div>

            <label className="text-[11px] font-semibold text-inkSoft mb-1.5 block">القرار النهائي</label>
            <textarea
              value={decision}
              onChange={(e) => setDecision(e.target.value)}
              placeholder="اكتب القرار السريري (تشخيص / تحويل / وصفة)…"
              rows={3}
              className="w-full px-3 py-2.5 rounded-xl bg-surfaceAlt border border-line text-sm text-ink placeholder:text-inkSoft/40 focus:outline-none focus:border-primary/40 focus:bg-white transition resize-none mb-3"
            />

            <label className="text-[11px] font-semibold text-inkSoft mb-1.5 block">ملاحظات</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="ملاحظات إضافية للمريض أو الفريق…"
              rows={2}
              className="w-full px-3 py-2.5 rounded-xl bg-surfaceAlt border border-line text-sm text-ink placeholder:text-inkSoft/40 focus:outline-none focus:border-primary/40 focus:bg-white transition resize-none mb-3"
            />

            <button
              onClick={() => update({ doctorDecision: decision, doctorNotes: notes })}
              disabled={!decision.trim()}
              className="w-full py-3 rounded-xl bg-primary text-white font-semibold text-sm shadow-card active:scale-[0.98] transition disabled:opacity-40 flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              حفظ القرار السريري
            </button>
          </div>

          {state.doctorDecision && (
            <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4 animate-rise">
              <div className="flex items-center gap-2 mb-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <p className="text-sm font-semibold text-emerald-700">تم تسجيل القرار</p>
              </div>
              <p className="text-xs text-emerald-700 leading-relaxed">{state.doctorDecision}</p>
            </div>
          )}

          {state.triage === 'emergency' && (
            <div className="rounded-2xl bg-primary-50 border border-primary/20 p-4 mt-3 animate-rise">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                  <Phone className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-primary">حالة طارئة — تصعيد فوري</p>
                  <p className="text-[11px] text-primary-dark">تم إبلاغ فريق الطوارئ</p>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function triageLabel(triage: string): string {
  switch (triage) {
    case 'emergency':
      return 'طارئ';
    case 'telehealth':
      return 'عن بُعد';
    case 'inperson':
      return 'حضوري';
    default:
      return 'قيد التحديد';
  }
}
