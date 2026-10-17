import { useEffect, useRef, useState, useCallback } from 'react';
import { useApp } from '@/lib/context';
import {
  resetState,
  startScriptedJourney,
  startEmergencyJourney,
} from '@/lib/flows';
import { aiMessage, patientMessage } from '@/lib/helpers';
import { LiveVoiceAgent, type VoiceStatus } from '@/lib/voiceAgent';
import { resetAgentSession, sendAgentMessage } from '@/lib/agentClient';
import { FACILITIES, type ChatMessage, type DemoState, type Facility } from '@/lib/types';
import {
  Send,
  Mic,
  Phone,
  ShieldCheck,
  MapPin,
  Clock,
  Activity,
  Users,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  ChevronLeft,
  MessageSquare,
  Bell,
  FileText,
  RotateCcw,
  Star,
  PhoneOff,
} from 'lucide-react';

const LOGO = '/images/Copy_of_White_Red_Simple_Modern_Data_Analysis_Presentation_(1).png';

const AVAILABLE_DATES = ['اليوم', 'غداً', 'بعد غد'];
const AVAILABLE_TIMES = ['٩:٠٠ ص', '١٠:٣٠ ص', '١٢:٠٠ ظ', '٢:٣٠ م', '٤:٠٠ م', '٥:٣٠ م', '٧:٠٠ م'];

type Phase = 'idle' | 'chat' | 'triage' | 'arrival' | 'confirmed' | 'emergency' | 'voice';

function phaseOf(s: DemoState): Phase {
  if (s.patientStatus === 'emergency') return 'emergency';
  if (s.patientStatus === 'confirmed') return 'confirmed';
  if (s.patientStatus === 'arrival') return 'arrival';
  if (s.triage !== 'pending' && s.patientStatus !== 'idle') return 'triage';
  if (s.patientStatus === 'chatting' || s.patientStatus === 'consent' || s.patientStatus === 'record') {
    return s.commMethod === 'voice' ? 'voice' : 'chat';
  }
  return 'idle';
}

function congestionColor(c: number): string {
  if (c < 40) return 'bg-emerald-500';
  if (c < 65) return 'bg-amber-500';
  return 'bg-primary';
}

function congestionLabel(c: number): string {
  if (c < 40) return 'منخفض';
  if (c < 65) return 'متوسط';
  return 'مرتفع';
}

export function PatientView() {
  const { state, update } = useApp();
  const phase = phaseOf(state);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [agentError, setAgentError] = useState('');
  const busyRef = useRef(false);
  const requestRef = useRef(0);
  const currentState = useRef(state);
  currentState.current = state;

  useEffect(() => {
    if (state.patientStatus === 'idle') {
      requestRef.current += 1;
      busyRef.current = false;
      setTyping(false);
      setAgentError('');
      resetAgentSession();
    }
  }, [state.patientStatus]);

  useEffect(() => () => { requestRef.current += 1; }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [state.chat.length, typing]);

  const callAgent = useCallback(async (text: string, initial = false) => {
    if (busyRef.current) return;
    busyRef.current = true;
    const requestId = ++requestRef.current;
    setTyping(true);
    setAgentError('');
    const chat = initial ? [] : [...currentState.current.chat, patientMessage(text)];
    update({ chat });
    try {
      const result = await sendAgentMessage(text);
      if (!result || requestRef.current !== requestId) return;
      update({ ...result.patch, chat: [...chat, aiMessage(result.reply)] });
    } catch (error) {
      if (requestRef.current === requestId) {
        setAgentError(error instanceof Error ? error.message : 'تعذّر الاتصال بالوكيل.');
      }
    } finally {
      if (requestRef.current === requestId) {
        busyRef.current = false;
        setTyping(false);
      }
    }
  }, [update]);

  const handleSend = useCallback((overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || busyRef.current || agentError) return;
    setInput('');
    void callAgent(text);
  }, [input, callAgent, agentError]);

  function beginConversation(voice: boolean) {
    requestRef.current += 1;
    busyRef.current = false;
    resetAgentSession();
    setAgentError('');
    update({ ...resetState(), patientStatus: 'chatting', commMethod: voice ? 'voice' : 'chat' });
    if (!voice) void callAgent('ابدأ المحادثة وعرّف بنفسك واطلب الموافقة قبل جمع معلومات الحالة.', true);
  }

  function requestSlot() {
    const facility = FACILITIES.find((f) => f.id === state.selectedFacilityId);
    if (!facility) return;
    const slot = {
      facilityId: facility.id,
      facilityName: facility.name,
      date: state.selectedDate,
      time: state.selectedTime,
      waitMin: facility.waitMin,
    };
    update({ arrivalStatus: 'requested', requestedSlot: slot, proposedSlot: slot });
  }

  function startWithChat() { beginConversation(false); }
  function startWithVoice() { beginConversation(true); }

  return (
    <div className="flex-1 flex flex-col mx-auto w-full max-w-[440px] min-h-0">
      {agentError && (
        <div role="alert" className="p-3 text-sm bg-primary-50 text-primary">
          <p>{agentError}</p>
          <button className="underline mt-2" onClick={() => beginConversation(state.commMethod === 'voice')}>بدء محادثة جديدة</button>
        </div>
      )}
      {phase === 'idle' && (
        <IdleScreen
          onScripted={() => update(startScriptedJourney())}
          onEmergency={() => update(startEmergencyJourney())}
          onChat={startWithChat}
          onVoice={startWithVoice}
        />
      )}

      {(phase === 'chat' || phase === 'triage' || phase === 'arrival') && (
        <>
          <ChatHeader status={state.patientStatus} />
          <div ref={scrollRef} className="flex-1 overflow-y-auto no-scrollbar px-3.5 py-3 space-y-2.5 min-h-0">
            {state.chat.map((m) => (
              <ChatBubble key={m.id} message={m} />
            ))}
            {typing && <TypingIndicator />}
            {phase === 'triage' && <TriageAnalyzing />}
          </div>

          {phase === 'arrival' && (
            <ArrivalPanel
              state={state}
              update={update}
              onRequest={requestSlot}
            />
          )}

          {phase !== 'arrival' && (
            <ChatInput disabled={typing || Boolean(agentError)} value={input} onChange={setInput} onSend={() => handleSend()} />
          )}
        </>
      )}

      {phase === 'voice' && (
        <VoiceCallView state={state} update={update} />
      )}

      {phase === 'confirmed' && <ConfirmedScreen state={state} update={update} />}

      {phase === 'emergency' && <EmergencyScreen message={[...state.chat].reverse().find((m) => m.role === 'ai')?.text} />}
    </div>
  );
}

/* ── Logo component ── */
function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const dims = { sm: 'w-8 h-8', md: 'w-12 h-12', lg: 'w-20 h-20' };
  return (
    <img src={LOGO} alt="استشير" className={`${dims[size]} rounded-2xl object-cover shadow-card`} />
  );
}

/* ── Idle / Communication choice ── */
function IdleScreen({ onScripted, onEmergency, onChat, onVoice }: {
  onScripted: () => void;
  onEmergency: () => void;
  onChat: () => void;
  onVoice: () => void;
}) {
  const [stage, setStage] = useState<'hero' | 'choice'>('hero');

  return (
    <div className="flex-1 flex flex-col px-5 pt-4 pb-6 overflow-y-auto no-scrollbar">
      {stage === 'hero' ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <div className="relative mb-5">
            <Logo size="lg" />
            <div className="absolute -inset-2 rounded-3xl bg-sand/30 blur-xl -z-10 animate-pulse-soft" />
          </div>
          <h2 className="text-xl font-bold text-ink mb-1.5">استشير</h2>
          <p className="text-[13px] text-inkSoft leading-relaxed max-w-[280px] mb-6">
            مساعدك الذكي للرعاية الصحية. سيوجهك للمسار المناسب ويحجز لك موعداً ذكياً.
          </p>
          <button
            onClick={() => setStage('choice')}
            className="w-full max-w-[300px] py-3.5 rounded-2xl bg-primary text-white font-semibold text-[15px] shadow-float active:scale-[0.98] transition flex items-center justify-center gap-2"
          >
            ابدأ الاستشارة
          </button>
          <div className="w-full max-w-[300px] mt-6 space-y-2">
            <p className="text-[11px] text-inkSoft text-center mb-1.5">أو اختر رحلة جاهزة للعرض</p>
            <button onClick={onScripted} className="w-full flex items-center justify-between p-3 rounded-xl bg-white border border-line shadow-card active:scale-[0.98] transition">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center">
                  <Calendar className="w-4 h-4 text-teal" />
                </div>
                <div className="text-right">
                  <p className="text-[13px] font-semibold text-ink">رحلة جاهزة</p>
                  <p className="text-[10px] text-inkSoft">مسار طبيعي ينتهي بموعد ذكي</p>
                </div>
              </div>
              <ChevronLeft className="w-3.5 h-3.5 text-inkSoft" />
            </button>
            <button onClick={onEmergency} className="w-full flex items-center justify-between p-3 rounded-xl bg-white border border-line shadow-card active:scale-[0.98] transition">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4 text-primary" />
                </div>
                <div className="text-right">
                  <p className="text-[13px] font-semibold text-ink">حالة طارئة</p>
                  <p className="text-[10px] text-inkSoft">تصعيد عاجل محاكى</p>
                </div>
              </div>
              <ChevronLeft className="w-3.5 h-3.5 text-inkSoft" />
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center animate-fade">
          <Logo size="md" />
          <h2 className="text-lg font-bold text-ink mt-4 mb-1.5">كيف تفضل التواصل مع استشير؟</h2>
          <p className="text-[12px] text-inkSoft mb-7 max-w-[260px]">
            اختر طريقة التواصل مع المساعد الذكي. سيتم تحديد مسار رعايتك تلقائياً بناءً على إجاباتك.
          </p>
          <div className="w-full max-w-[300px] space-y-2.5">
            <button onClick={onVoice} className="w-full flex items-center gap-3 p-4 rounded-2xl bg-white border-2 border-line shadow-card active:scale-[0.98] active:border-primary/30 transition">
              <div className="w-11 h-11 rounded-xl bg-primary-50 flex items-center justify-center">
                <Phone className="w-5 h-5 text-primary" />
              </div>
              <div className="text-right flex-1">
                <p className="text-[15px] font-semibold text-ink">مكالمة صوتية</p>
                <p className="text-[11px] text-inkSoft">تحدث مع المساعد بالصوت</p>
              </div>
              <ChevronLeft className="w-4 h-4 text-inkSoft" />
            </button>
            <button onClick={onChat} className="w-full flex items-center gap-3 p-4 rounded-2xl bg-white border-2 border-line shadow-card active:scale-[0.98] active:border-primary/30 transition">
              <div className="w-11 h-11 rounded-xl bg-teal-50 flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-teal" />
              </div>
              <div className="text-right flex-1">
                <p className="text-[15px] font-semibold text-ink">محادثة</p>
                <p className="text-[11px] text-inkSoft">اكتب ردودك نصياً</p>
              </div>
              <ChevronLeft className="w-4 h-4 text-inkSoft" />
            </button>
          </div>
          <button onClick={() => setStage('hero')} className="mt-5 text-[12px] text-inkSoft active:text-primary transition">رجوع</button>
        </div>
      )}
    </div>
  );
}

/* ── Chat components ── */
function ChatHeader({ status }: { status: DemoState['patientStatus'] }) {
  const labels: Record<string, string> = {
    chatting: 'الاستشارة جارية', consent: 'الموافقة والخصوصية',
    record: 'جمع الأعراض', triage: 'تحليل التوجيه', arrival: 'اختيار المرفق والموعد',
  };
  return (
    <div className="px-3.5 pt-2.5 pb-1.5 shrink-0">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse-soft" />
        <p className="text-[11px] font-semibold text-inkSoft">{labels[status] || 'الاستشارة'}</p>
      </div>
    </div>
  );
}

function ChatBubble({ message }: { message: ChatMessage }) {
  const isAI = message.role === 'ai';
  return (
    <div className={`flex ${isAI ? 'justify-start' : 'justify-end'} animate-rise`}>
      <div className={`max-w-[78%] px-3.5 py-2.5 rounded-2xl text-[13px] leading-relaxed ${
        isAI ? 'bg-white border border-line text-ink rounded-tr-md shadow-card' : 'bg-primary text-white rounded-tl-md'
      }`}>
        {message.text}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="bg-white border border-line rounded-2xl rounded-tr-md px-4 py-3 shadow-card">
        <div className="flex gap-1.5">
          <span className="w-2 h-2 rounded-full bg-inkSoft/40 typing-dot" />
          <span className="w-2 h-2 rounded-full bg-inkSoft/40 typing-dot" />
          <span className="w-2 h-2 rounded-full bg-inkSoft/40 typing-dot" />
        </div>
      </div>
    </div>
  );
}

function TriageAnalyzing() {
  return (
    <div className="flex items-center justify-center gap-2 py-2.5 animate-fade">
      <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      <p className="text-[11px] text-inkSoft">يحلل الأعراض…</p>
    </div>
  );
}

function ChatInput({ value, onChange, onSend, disabled = false }: { value: string; onChange: (v: string) => void; onSend: () => void; disabled?: boolean; }) {
  const send = () => { if (!disabled) onSend(); };
  return (
    <div className="shrink-0 safe-bottom px-3.5 pt-2 pb-2.5 glass border-t border-line">
      <div className="flex items-center gap-2">
        <input disabled={disabled} value={value} onChange={(e) => onChange(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="اكتب ردك…"
          className="flex-1 px-3.5 py-2.5 rounded-xl bg-surfaceAlt border border-line text-[13px] text-ink placeholder:text-inkSoft/50 focus:outline-none focus:border-primary/40 focus:bg-white transition min-w-0"
        />
        <button disabled={disabled} onClick={send} className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center shadow-card active:scale-95 transition shrink-0" aria-label="إرسال">
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

/* ── Voice call ── */
function VoiceCallView({ state, update }: {
  state: DemoState; update: (patch: Partial<DemoState>) => void;
}) {
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [voiceError, setVoiceError] = useState('');
  const [captions, setCaptions] = useState({ patient: '', assistant: '' });
  const agentRef = useRef<LiveVoiceAgent | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }); }, [state.chat.length, captions]);
  useEffect(() => () => { agentRef.current?.stop(); }, []);

  async function startCall() {
    if (agentRef.current) agentRef.current.stop();
    setVoiceError('');
    setCaptions({ patient: '', assistant: '' });
    update({ ...resetState(), patientStatus: 'chatting', commMethod: 'voice' });
    const agent = new LiveVoiceAgent({
      getState: () => stateRef.current,
      update,
      onStatus: (next, message) => { setStatus(next); if (message) setVoiceError(message); },
      onTranscript: (patient, assistant) => setCaptions({ patient, assistant }),
    });
    agentRef.current = agent;
    try { await agent.start(); }
    catch (error) {
      agent.stop();
      setStatus('error');
      setVoiceError(error instanceof Error ? error.message : 'تعذّر بدء المكالمة.');
    }
  }

  const active = status === 'listening' || status === 'speaking' || status === 'connecting';
  const labels: Record<VoiceStatus, string> = {
    idle: 'ابدأ المكالمة', connecting: 'جارٍ الاتصال…', listening: 'أستمع…',
    speaking: 'استشير يتحدث…', error: 'تعذّر الاتصال', ended: 'انتهت المكالمة',
  };
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <p className="px-4 py-2 text-xs text-inkSoft">محادثة صوتية مباشرة مع استشير</p>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3.5 py-3 space-y-2.5 min-h-0">
        {state.chat.map((message) => <ChatBubble key={message.id} message={message} />)}
        {captions.patient && <p className="text-sm text-primary text-right">{captions.patient}</p>}
        {captions.assistant && <p className="text-sm text-inkSoft">{captions.assistant}</p>}
        {status === 'connecting' && <TypingIndicator />}
      </div>
      <div className="px-4 py-3 text-center">
        {voiceError && <p role="alert" className="text-xs text-primary mb-2">{voiceError}</p>}
        <button onClick={active ? () => agentRef.current?.stop() : startCall}
          className="p-4 rounded-full bg-primary text-white" aria-label={active ? 'إنهاء المكالمة' : 'بدء المكالمة'}>
          {active ? <PhoneOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
        </button>
        <p className="text-xs mt-2">{labels[status]}</p>
      </div>
    </div>
  );
}

/* ── Facility picker + slot selection ── */
function ArrivalPanel({ state, update, onRequest }: {
  state: DemoState;
  update: (p: Partial<DemoState>) => void;
  onRequest: () => void;
}) {
  const best = FACILITIES.reduce((a, b) => b.congestion < a.congestion ? b : a);
  const selectedFacility = FACILITIES.find((f) => f.id === state.selectedFacilityId) || FACILITIES[0];

  return (
    <div className="shrink-0 max-h-[70%] overflow-y-auto no-scrollbar px-3.5 pb-2.5 space-y-2.5 animate-rise">
      {/* AI recommendation banner */}
      <div className="flex items-center gap-2 p-2.5 rounded-xl bg-sand-light border border-sand/40">
        <Star className="w-4 h-4 text-primary shrink-0" />
        <p className="text-[11px] text-ink leading-snug">
          نوصي بـ <span className="font-bold">{best.name}</span> — أقل ازدحام وأقصر انتظار
        </p>
      </div>

      {/* Facility cards */}
      {FACILITIES.map((f) => (
        <FacilityCard key={f.id} facility={f} selected={state.selectedFacilityId === f.id} isBest={f.id === best.id}
          onSelect={() => update({ selectedFacilityId: f.id })} />
      ))}

      {/* Date selection */}
      <div className="rounded-2xl bg-white border border-line shadow-card p-3 space-y-2">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-primary" />
          <p className="text-[12px] font-semibold text-ink">اختر التاريخ</p>
        </div>
        <div className="flex gap-2">
          {AVAILABLE_DATES.map((d) => (
            <button key={d} onClick={() => update({ selectedDate: d })}
              className={`flex-1 py-2 rounded-lg text-[12px] font-semibold transition ${
                state.selectedDate === d ? 'bg-primary text-white shadow-card' : 'bg-surfaceAlt text-inkSoft border border-line'
              }`}>
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* Time selection */}
      <div className="rounded-2xl bg-white border border-line shadow-card p-3 space-y-2">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" />
          <p className="text-[12px] font-semibold text-ink">اختر الوقت</p>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {AVAILABLE_TIMES.map((t) => (
            <button key={t} onClick={() => update({ selectedTime: t })}
              className={`py-2 rounded-lg text-[11px] font-semibold transition ${
                state.selectedTime === t ? 'bg-primary text-white shadow-card' : 'bg-surfaceAlt text-inkSoft border border-line'
              }`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Request status */}
      {state.arrivalStatus === 'requested' && (
        <div className="flex items-center justify-center gap-2 py-2.5 text-inkSoft">
          <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-[11px]">بانتظار موافقة الاستقبال…</p>
        </div>
      )}
      {state.arrivalStatus === 'approved' && (
        <div className="flex items-center justify-center gap-2 py-2 rounded-xl bg-emerald-50 text-emerald-700">
          <CheckCircle2 className="w-4 h-4" />
          <p className="text-[13px] font-semibold">تمت الموافقة! توجه للموعد</p>
        </div>
      )}
      {state.arrivalStatus === 'rejected' && (
        <div className="text-center py-2 rounded-xl bg-primary-50 text-primary">
          <p className="text-[13px] font-semibold">تم رفض الطلب. يرجى إعادة المحاولة.</p>
        </div>
      )}

      {/* Submit */}
      {state.arrivalStatus === 'proposed' && (
        <button onClick={onRequest}
          className="w-full py-3 rounded-xl bg-primary text-white font-semibold text-[14px] shadow-float active:scale-[0.98] transition flex items-center justify-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          طلب الموعد — {selectedFacility.name} · {state.selectedDate} · {state.selectedTime}
        </button>
      )}
    </div>
  );
}

function FacilityCard({ facility, selected, isBest, onSelect }: {
  facility: Facility; selected: boolean; isBest: boolean; onSelect: () => void;
}) {
  return (
    <button onClick={onSelect}
      className={`w-full text-right rounded-2xl border-2 p-3 transition-all ${
        selected ? 'border-primary bg-primary-50/30 shadow-card' : 'border-line bg-white'
      }`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-start gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-surfaceAlt flex items-center justify-center shrink-0">
            <MapPin className="w-4 h-4 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-[13px] font-semibold text-ink">{facility.name}</p>
              {isBest && (
                <span className="px-1.5 py-0.5 rounded-full bg-sand-light text-primary text-[9px] font-bold">موصى به</span>
              )}
            </div>
            <p className="text-[10px] text-inkSoft mt-0.5">
              {facility.distanceKm} كم · {facility.travelMin} دقيقة
            </p>
          </div>
        </div>
        <div className={`w-5 h-5 rounded-full border-2 shrink-0 mt-1 flex items-center justify-center ${
          selected ? 'border-primary bg-primary' : 'border-line'
        }`}>
          {selected && <CheckCircle2 className="w-3 h-3 text-white" />}
        </div>
      </div>

      {/* Congestion bar */}
      <div className="mb-2">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5">
            <Activity className="w-3 h-3 text-inkSoft" />
            <span className="text-[10px] text-inkSoft">الازدحام</span>
          </div>
          <span className={`text-[10px] font-bold ${
            facility.congestion < 40 ? 'text-emerald-600' : facility.congestion < 65 ? 'text-amber-600' : 'text-primary'
          }`}>{congestionLabel(facility.congestion)} · {facility.congestion}%</span>
        </div>
        <div className="h-2 rounded-full bg-surfaceAlt overflow-hidden">
          <div className={`h-full rounded-full ${congestionColor(facility.congestion)} transition-all duration-500`} style={{ width: `${facility.congestion}%` }} />
        </div>
      </div>

      <div className="flex gap-2">
        <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-surfaceAlt">
          <Clock className="w-3 h-3 text-inkSoft" />
          <span className="text-[10px] text-ink font-semibold">{facility.waitMin} د انتظار</span>
        </div>
        <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-surfaceAlt">
          <Users className="w-3 h-3 text-inkSoft" />
          <span className="text-[10px] text-ink font-semibold">{facility.capacity} سعة</span>
        </div>
      </div>
    </button>
  );
}

/* ── Confirmed screen with reminder + instructions + follow-up ── */
function ConfirmedScreen({ state, update }: { state: DemoState; update: (p: Partial<DemoState>) => void; }) {
  const slot = state.confirmedSlot || state.proposedSlot;
  const [tab, setTab] = useState<'summary' | 'instructions' | 'followup'>('summary');

  return (
    <div className="flex-1 flex flex-col px-5 pt-5 pb-6 overflow-y-auto no-scrollbar">
      <div className="flex flex-col items-center text-center mb-4 animate-rise">
        <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mb-3">
          <CheckCircle2 className="w-9 h-9 text-emerald-600" strokeWidth={1.8} />
        </div>
        <h2 className="text-lg font-bold text-ink mb-1">
          {state.triage === 'telehealth' ? 'تم حجز استشارة عن بُعد' : 'تم تأكيد موعدك'}
        </h2>
        <p className="text-[13px] text-inkSoft">سيتم تذكيرك قبل الموعد بوقت كافٍ.</p>
      </div>

      {slot && (
        <div className="rounded-2xl bg-white border border-line shadow-card p-3.5 space-y-2.5 animate-rise">
          <div className="flex items-center gap-2.5 pb-2.5 border-b border-line">
            <div className="w-9 h-9 rounded-xl bg-primary-50 flex items-center justify-center">
              <MapPin className="w-4.5 h-4.5 text-primary" />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-ink">{slot.facilityName}</p>
              <p className="text-[10px] text-inkSoft">{slot.date} · {slot.time}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-inkSoft">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            بياناتك مشاركتها بأمان مع الفريق الطبي
          </div>
        </div>
      )}

      {state.triage === 'telehealth' && (
        <div className="rounded-2xl bg-teal-50 border border-teal-100 p-3.5 mt-2.5 animate-rise">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal flex items-center justify-center">
              <Phone className="w-4.5 h-4.5 text-sand" />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-teal-700">استشارة عن بُعد</p>
              <p className="text-[10px] text-teal-600">سيتصل بك طبيب مختص قريباً</p>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1.5 p-1 rounded-xl bg-surfaceAlt border border-line mt-4">
        <TabBtn active={tab === 'summary'} onClick={() => setTab('summary')} icon={Bell} label="تذكير" />
        <TabBtn active={tab === 'instructions'} onClick={() => setTab('instructions')} icon={FileText} label="تعليمات" />
        <TabBtn active={tab === 'followup'} onClick={() => setTab('followup')} icon={RotateCcw} label="متابعة" />
      </div>

      <div className="mt-3 animate-fade">
        {tab === 'summary' && <ReminderTab state={state} update={update} slot={slot} />}
        {tab === 'instructions' && <InstructionsTab />}
        {tab === 'followup' && <FollowUpTab state={state} update={update} />}
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: typeof Bell; label: string }) {
  return (
    <button onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12px] font-semibold transition ${
        active ? 'bg-white text-primary shadow-card' : 'text-inkSoft'
      }`}>
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}

function ReminderTab({ state, update, slot }: { state: DemoState; update: (p: Partial<DemoState>) => void; slot: DemoState['proposedSlot'] }) {
  return (
    <div className="space-y-2.5">
      <div className="rounded-2xl bg-white border border-line shadow-card p-3.5">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary" />
            <p className="text-[13px] font-semibold text-ink">تذكير بالموعد</p>
          </div>
          <button onClick={() => update({ reminderEnabled: !state.reminderEnabled })}
            className={`w-11 h-6 rounded-full transition relative ${state.reminderEnabled ? 'bg-primary' : 'bg-surfaceAlt border border-line'}`}>
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${state.reminderEnabled ? 'right-0.5' : 'right-5'}`} />
          </button>
        </div>
        <p className="text-[11px] text-inkSoft leading-relaxed">
          {state.reminderEnabled
            ? 'سيصلك تذكير قبل الموعد بساعة وبرسالة نصية في صباح اليوم نفسه.'
            : 'التذكير معطّل حالياً. يمكنك تفعيله في أي وقت.'}
        </p>
      </div>

      {slot && (
        <div className="rounded-2xl bg-sand-light border border-sand/40 p-3.5">
          <div className="flex items-center gap-2 mb-1.5">
            <Calendar className="w-4 h-4 text-primary" />
            <p className="text-[12px] font-bold text-ink">موعدك المؤكد</p>
          </div>
          <p className="text-[13px] text-ink">{slot.facilityName}</p>
          <p className="text-[11px] text-inkSoft">{slot.date} · {slot.time}</p>
          <p className="text-[10px] text-inkSoft mt-1">رقم مرجعي: {state.recordNumber || '—'}</p>
        </div>
      )}
    </div>
  );
}

function InstructionsTab() {
  const instructions = [
    'احضر بطاقتك الوطنية وبطاقتك الطبية.',
    'صل قبل الموعد بـ ١٥ دقيقة لتجنب تأخير الفحص.',
    'دوّن أي أدوية تتناولها حالياً أو حساسية دوائية.',
    'ارتدِ كمامة داخل المرفق واتبع إرشادات العدوى.',
    'في حال تأخر الموعد، سيتم إشعارك فوراً عبر التذكير.',
  ];
  return (
    <div className="rounded-2xl bg-white border border-line shadow-card p-3.5 space-y-2.5">
      <div className="flex items-center gap-2 mb-1">
        <FileText className="w-4 h-4 text-primary" />
        <p className="text-[13px] font-semibold text-ink">تعليمات قبل الزيارة</p>
      </div>
      {instructions.map((ins, i) => (
        <div key={i} className="flex items-start gap-2">
          <div className="w-5 h-5 rounded-full bg-primary-50 flex items-center justify-center shrink-0 mt-0.5">
            <span className="text-[10px] font-bold text-primary">{i + 1}</span>
          </div>
          <p className="text-[12px] text-ink leading-relaxed">{ins}</p>
        </div>
      ))}
    </div>
  );
}

function FollowUpTab({ state, update }: { state: DemoState; update: (p: Partial<DemoState>) => void; }) {
  return (
    <div className="space-y-2.5">
      <div className="rounded-2xl bg-white border border-line shadow-card p-3.5">
        <div className="flex items-center gap-2 mb-2">
          <RotateCcw className="w-4 h-4 text-primary" />
          <p className="text-[13px] font-semibold text-ink">متابعة بعد الزيارة</p>
        </div>
        <p className="text-[11px] text-inkSoft leading-relaxed mb-3">
          بعد زيارتك، يمكنك طلب متابعة مع الطبيب نفسه لمشاركة النتائج أو استكمال العلاج.
        </p>

        {state.followUpRequested ? (
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-50 text-emerald-700">
            <CheckCircle2 className="w-4 h-4" />
            <p className="text-[12px] font-semibold">تم تسجيل طلب المتابعة. سيتواصل معك الفريق.</p>
          </div>
        ) : (
          <button onClick={() => update({ followUpRequested: true })}
            className="w-full py-2.5 rounded-xl bg-primary text-white font-semibold text-[13px] shadow-card active:scale-[0.98] transition">
            طلب متابعة بعد الزيارة
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Emergency ── */
function EmergencyScreen({ message }: { message?: string }) {
  return (
    <div className="flex-1 flex flex-col px-5 pt-5 pb-6">
      <div className="flex-1 flex flex-col items-center justify-center text-center">
        <div className="w-20 h-20 rounded-full bg-primary-50 flex items-center justify-center mb-4 animate-pulse-soft">
          <AlertTriangle className="w-10 h-10 text-primary" strokeWidth={1.6} />
        </div>
        <h2 className="text-xl font-bold text-primary mb-2">تصعيد طارئ</h2>
        <p className="text-[13px] text-inkSoft leading-relaxed max-w-[280px] mb-5">
          {message || 'يرجى طلب المساعدة الطبية الطارئة المحلية أو التوجه لأقرب قسم طوارئ.'}
        </p>

      </div>
    </div>
  );
}
