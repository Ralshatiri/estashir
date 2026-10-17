import { supabase } from './supabase';
import { initialState, type DemoState } from './types';

const STATE_ID = 'main';

export async function loadState(): Promise<DemoState> {
  const { data, error } = await supabase
    .from('demo_state')
    .select('state')
    .eq('id', STATE_ID)
    .maybeSingle();

  if (error) {
    console.warn('loadState error', error);
    return { ...initialState };
  }

  if (!data) {
    return { ...initialState };
  }

  return { ...initialState, ...(data.state as DemoState) };
}

export async function saveState(state: DemoState): Promise<void> {
  const payload = { id: STATE_ID, state, updated_at: new Date().toISOString() };
  const { error } = await supabase
    .from('demo_state')
    .upsert(payload);

  if (error) {
    console.warn('saveState error', error);
  }
}

export function subscribeState(callback: (state: DemoState) => void): () => void {
  const channel = supabase
    .channel('demo_state_changes')
    .on(
      'postgres_changes' as never,
      { event: '*' as never, schema: 'public', table: 'demo_state', filter: `id=eq.${STATE_ID}` },
      (payload: { new: { state: DemoState } }) => {
        if (payload.new?.state) {
          callback({ ...initialState, ...payload.new.state });
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
