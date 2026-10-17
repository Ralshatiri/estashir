import type { DemoState } from './types';

const STORAGE_KEY = 'estashir-adk-session';
let generation = 0;

export function resetAgentSession(): void {
  generation += 1;
  sessionStorage.removeItem(STORAGE_KEY);
}

async function request(path: string, body: object): Promise<Record<string, unknown>> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body), signal: AbortSignal.timeout(100000),
    });
  } catch {
    throw new Error('تعذّر الاتصال بالخادم. تأكد من تشغيل backend ثم ابدأ محادثة جديدة.');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof data.detail === 'string' ? data.detail : 'تعذّر الاتصال بالوكيل.');
  }
  return data;
}

export async function sendAgentMessage(message: string): Promise<{ reply: string; patch: Partial<DemoState> } | null> {
  const currentGeneration = generation;
  try {
    let sessionId = sessionStorage.getItem(STORAGE_KEY);
    if (!sessionId) {
      const session = await request('/sessions', {});
      if (currentGeneration !== generation) return null;
      if (typeof session.session_id !== 'string') throw new Error('استجابة جلسة غير صالحة.');
      sessionId = session.session_id;
      sessionStorage.setItem(STORAGE_KEY, sessionId);
    }
    const result = await request('/chat', { session_id: sessionId, message });
    if (currentGeneration !== generation) return null;
    if (typeof result.reply !== 'string' || !result.patch || typeof result.patch !== 'object') {
      throw new Error('استجابة الوكيل غير صالحة.');
    }
    return { reply: result.reply, patch: result.patch as Partial<DemoState> };
  } catch (error) {
    if (currentGeneration !== generation) return null;
    throw error;
  }
}

export async function createVoiceSession(): Promise<string> {
  const session = await request('/sessions', {});
  if (typeof session.session_id !== 'string') throw new Error('استجابة جلسة غير صالحة.');
  return session.session_id;
}
