import type { ChatMessage, DemoState } from './types';
import { aiMessage, patientMessage, patch } from './helpers';

export const AI_GREETING =
  'مرحباً بك في استشير. أنا مساعدك الذكي للرعاية الصحية. سأطرح عليك أسئلة تساعدني على فهم حالتك وتوجيهك للمسار المناسب. لن أقوم بتشخيص أو وصف علاج؛ القرار السريري النهائي للطبيب. هل أنت مستعد للبدء؟';

export const AI_ASK_RECORD =
  'شكراً لك. لكي أتمكن من تقديم رعاية مناسبة، أرجو إدخال رقمك الطبي.';

export const AI_ASK_CONSENT =
  'بموجب سياسة الخصوصية، أحتاج موافقتك لمشاركة بياناتك مع الفريق الطبي. هل توافق؟';

export const AI_SYMPTOM_QUESTIONS = [
  'ما هو الشعور أو العرض الرئيسي الذي دفعك لطلب الاستشارة اليوم؟',
  'منذ متى بدأ هذا الشعور؟ (ساعات / أيام)',
  'هل يصاحبه ألم في الصدر أو ضيق في التنفس؟',
  'هل ترتفع درجة حرارتك أو تشعر بقشعريرة؟',
];

export const AI_TRIAGE_PENDING =
  'شكراً لإجاباتك. أقوم الآن بتحليل الأعراض لتحديد المسار الأنسب لك…';

export const AI_TRIAGE_EMERGENCY =
  'بناءً على أعراضك، حالتك تستدعي تدخلاً عاجلاً. سأقوم بإبلاغ فريق الطوارئ وتجهيز تحويل فوري. يرجى التوجه لأقرب قسم طوارئ أو الاتصال على 998 فوراً.';

export const AI_TRIAGE_TELEHEALTH =
  'أعراضك لا تستدعي زيارة عاجلة. سأرتب لك استشارة عن بُعد مع طبيب مختص. اختر المرفق والتاريخ والوقت المناسبين من الخيارات أدناه لتأكيد موعد الاستشارة.';

export const AI_TRIAGE_INPERSON =
  'أعراضك تستدعي فحصاً حضورياً. سأقترح عليك أقرب المرافق المتاحة مع موعد ذكي للوصول لتقليل وقت الانتظار.';

export const AI_PROPOSE_SLOT =
  'بناءً على المسافة وزمن الوصول والازدحام، اخترت المرفق الأنسب لك. يمكنك الآن اختيار المرفق والتاريخ والوقت المناسبين من الخيارات أدناه، ثم طلب الموعد وسيتلقاه موظف الاستقبال للموافقة.';

export function startChat(): Partial<DemoState> {
  return {
    patientStatus: 'chatting',
    chat: [aiMessage(AI_GREETING)],
  };
}

export function startScriptedJourney(): Partial<DemoState> {
  const messages: ChatMessage[] = [
    aiMessage(AI_GREETING),
    patientMessage('نعم، أنا مستعد'),
    aiMessage(AI_ASK_RECORD),
    patientMessage('100245'),
    aiMessage(AI_ASK_CONSENT),
    patientMessage('أوافق'),
    aiMessage(AI_SYMPTOM_QUESTIONS[0]),
    patientMessage('صداع مستمر مع إرهاق'),
    aiMessage(AI_SYMPTOM_QUESTIONS[1]),
    patientMessage('منذ يومين تقريباً'),
    aiMessage(AI_SYMPTOM_QUESTIONS[2]),
    patientMessage('لا، الحمد لله'),
    aiMessage(AI_SYMPTOM_QUESTIONS[3]),
    patientMessage('درجة حرارتي طبيعية'),
    aiMessage(AI_TRIAGE_PENDING),
    aiMessage(AI_TRIAGE_INPERSON),
    aiMessage(AI_PROPOSE_SLOT),
  ];

  return {
    mode: 'scripted',
    patientStatus: 'arrival',
    triage: 'inperson',
    triageSummary: 'أعراض غير طارئة — صداع مزمن مع إرهاق بدون علامات خطر. يستحسن فحص حضوري.',
    chat: messages,
    recordNumber: '100245',
    consentGiven: true,
    symptoms: ['صداع مستمر', 'إرهاق', 'منذ يومين'],
    patientName: 'أحمد العتيبي',
    patientAge: 34,
    arrivalStatus: 'proposed',
    selectedFacilityId: 'f2',
    selectedDate: 'اليوم',
    selectedTime: '٢:٣٠ م',
    proposedSlot: {
      facilityId: 'f2',
      facilityName: 'مركز العناية الطبية',
      date: 'اليوم',
      time: '٢:٣٠ م',
      waitMin: 12,
    },
  };
}

export function startEmergencyJourney(): Partial<DemoState> {
  const messages: ChatMessage[] = [
    aiMessage(AI_GREETING),
    patientMessage('أعاني من ألم شديد في الصدر وضيق في التنفس'),
    aiMessage(AI_SYMPTOM_QUESTIONS[0]),
    patientMessage('ألم ضاغط في الصدر ينتشر للذراع الأيسر'),
    aiMessage(AI_SYMPTOM_QUESTIONS[1]),
    patientMessage('منذ ٢٠ دقيقة فجأة'),
    aiMessage(AI_SYMPTOM_QUESTIONS[2]),
    patientMessage('نعم، ألم شديد في الصدر مع ضيق تنفس'),
    aiMessage(AI_TRIAGE_PENDING),
    aiMessage(AI_TRIAGE_EMERGENCY),
  ];

  return {
    mode: 'emergency',
    patientStatus: 'emergency',
    triage: 'emergency',
    triageSummary: 'أعراض تثير اشتباهاً قلبياً — ألم صدري ضاغط ينتشر للذراع مع ضيق تنفس. تصعيد طارئ.',
    chat: messages,
    recordNumber: '100877',
    consentGiven: true,
    symptoms: ['ألم صدري ضاغط', 'انتشار للذراع الأيسر', 'ضيق تنفس', 'بداية مفاجئة'],
    patientName: 'سعد القحطاني',
    patientAge: 52,
  };
}

export function resetState(): Partial<DemoState> {
  return {
    mode: 'interactive',
    commMethod: 'none',
    patientStatus: 'idle',
    triage: 'pending',
    triageSummary: '',
    chat: [],
    arrivalStatus: 'none',
    proposedSlot: null,
    requestedSlot: null,
    confirmedSlot: null,
    selectedFacilityId: 'f2',
    selectedDate: 'اليوم',
    selectedTime: '٢:٣٠ م',
    reminderEnabled: true,
    followUpRequested: false,
    recordNumber: '',
    consentGiven: false,
    symptoms: [],
    patientName: '',
    patientAge: 0,
    receptionCheckedIn: false,
    checkedInPatients: { '1': true, '2': true, '3': false, '4': false },
    doctorDecision: '',
    doctorNotes: '',
  };
}

export { patch };
