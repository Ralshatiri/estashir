import type { ChatMessage, DemoState, DemoMode } from './types';

let idCounter = 0;
export function makeId(): string {
  idCounter += 1;
  return `${Date.now()}-${idCounter}`;
}

export function aiMessage(text: string): ChatMessage {
  return { id: makeId(), role: 'ai', text, ts: Date.now() };
}

export function patientMessage(text: string): ChatMessage {
  return { id: makeId(), role: 'patient', text, ts: Date.now() };
}

export function patch(state: DemoState, p: Partial<DemoState>): DemoState {
  return { ...state, ...p, updatedAt: Date.now() };
}

export function modeLabel(mode: DemoMode): string {
  switch (mode) {
    case 'interactive':
      return 'تجربة تفاعلية';
    case 'scripted':
      return 'رحلة جاهزة';
    case 'emergency':
      return 'حالة طارئة';
  }
}
