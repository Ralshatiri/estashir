/*
# Create shared استشير demo state

1. New Tables
- `demo_state` stores the single shared hackathon demonstration state as JSON.
- `id` is the stable row key.
- `state` stores the patient, reception, doctor, and journey status values.
- `updated_at` records the latest shared update time.

2. Security
- Row-level security is enabled.
- The demo intentionally has no sign-in screen, so anon and authenticated roles can read and update the shared simulation.
- Separate CRUD policies are defined for the intentionally shared demo row.

3. Important Notes
- This is a single-tenant presentation/demo workflow, not a production medical record store.
- The application uses the database as the shared source of truth so role actions remain synchronized.
*/

CREATE TABLE IF NOT EXISTS public.demo_state (
  id text PRIMARY KEY,
  state jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.demo_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "demo_state_select_shared" ON public.demo_state;
CREATE POLICY "demo_state_select_shared" ON public.demo_state
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "demo_state_insert_shared" ON public.demo_state;
CREATE POLICY "demo_state_insert_shared" ON public.demo_state
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "demo_state_update_shared" ON public.demo_state;
CREATE POLICY "demo_state_update_shared" ON public.demo_state
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "demo_state_delete_shared" ON public.demo_state;
CREATE POLICY "demo_state_delete_shared" ON public.demo_state
  FOR DELETE TO anon, authenticated USING (true);

INSERT INTO public.demo_state (id, state)
VALUES ('main', '{"mode":"interactive","patientStatus":"idle","triage":"pending","arrivalStatus":"none","facility":"مستشفى الملك فهد","slot":"اليوم، ٢:٣٠ م"}'::jsonb)
ON CONFLICT (id) DO NOTHING;