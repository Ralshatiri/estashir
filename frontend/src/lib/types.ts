export type Role = 'patient' | 'reception' | 'doctor';

export type DemoMode = 'interactive' | 'scripted' | 'emergency';

export type TriageOutcome = 'pending' | 'emergency' | 'telehealth' | 'inperson';

export type ArrivalStatus = 'none' | 'proposed' | 'requested' | 'approved' | 'adjusted' | 'rejected';

export interface ChatMessage {
  id: string;
  role: 'ai' | 'patient';
  text: string;
  ts: number;
}

export interface Facility {
  id: string;
  name: string;
  distanceKm: number;
  travelMin: number;
  capacity: number;
  congestion: number; // 0-100
  waitMin: number;
}

export interface SlotProposal {
  facilityId: string;
  facilityName: string;
  date: string;
  time: string;
  waitMin: number;
}

export type CommMethod = 'none' | 'voice' | 'chat';

export interface DemoState {
  mode: DemoMode;
  commMethod: CommMethod;
  patientStatus: 'idle' | 'chatting' | 'consent' | 'record' | 'triage' | 'arrival' | 'confirmed' | 'emergency';
  triage: TriageOutcome;
  triageSummary: string;
  chat: ChatMessage[];
  arrivalStatus: ArrivalStatus;
  proposedSlot: SlotProposal | null;
  requestedSlot: SlotProposal | null;
  confirmedSlot: SlotProposal | null;
  selectedFacilityId: string;
  selectedDate: string;
  selectedTime: string;
  reminderEnabled: boolean;
  followUpRequested: boolean;
  recordNumber: string;
  consentGiven: boolean;
  symptoms: string[];
  patientName: string;
  patientAge: number;
  receptionCheckedIn: boolean;
  checkedInPatients: Record<string, boolean>;
  doctorDecision: string;
  doctorNotes: string;
  updatedAt: number;
}

export const FACILITIES: Facility[] = [
  {
    id: 'f1',
    name: 'مستشفى الملك فهد التخصصي',
    distanceKm: 3.2,
    travelMin: 9,
    capacity: 320,
    congestion: 62,
    waitMin: 25,
  },
  {
    id: 'f2',
    name: 'مركز العناية الطبية',
    distanceKm: 5.8,
    travelMin: 14,
    capacity: 180,
    congestion: 38,
    waitMin: 12,
  },
  {
    id: 'f3',
    name: 'مستشفى السعودي الألماني',
    distanceKm: 8.1,
    travelMin: 19,
    capacity: 410,
    congestion: 71,
    waitMin: 38,
  },
];

export const initialState: DemoState = {
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
  updatedAt: Date.now(),
};
