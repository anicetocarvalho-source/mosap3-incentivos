-- Device pairing sessions (web ↔ Android companion app)
CREATE TABLE public.device_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_code TEXT NOT NULL UNIQUE,
  device_type TEXT NOT NULL CHECK (device_type IN ('fingerprint', 'nfc')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paired', 'active', 'expired', 'closed')),
  user_id UUID NOT NULL,
  farmer_code TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '10 minutes'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Data captured from companion device
CREATE TABLE public.device_captures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.device_sessions(id) ON DELETE CASCADE,
  capture_type TEXT NOT NULL CHECK (capture_type IN ('fingerprint_template', 'fingerprint_image', 'nfc_uid', 'nfc_ndef')),
  data TEXT NOT NULL,
  finger_position TEXT,
  quality_score INTEGER,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_device_sessions_code ON public.device_sessions(session_code);
CREATE INDEX idx_device_sessions_user ON public.device_sessions(user_id);
CREATE INDEX idx_device_sessions_status ON public.device_sessions(status) WHERE status IN ('pending', 'paired', 'active');
CREATE INDEX idx_device_captures_session ON public.device_captures(session_id);

-- Enable realtime for live pairing
ALTER PUBLICATION supabase_realtime ADD TABLE public.device_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.device_captures;

-- RLS
ALTER TABLE public.device_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_captures ENABLE ROW LEVEL SECURITY;

-- Authenticated users can manage their own sessions
CREATE POLICY "Users can view own sessions"
  ON public.device_sessions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own sessions"
  ON public.device_sessions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions"
  ON public.device_sessions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- Companion app uses anon key + session_code to insert captures
CREATE POLICY "Anon can insert captures via valid session"
  ON public.device_captures FOR INSERT TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.device_sessions ds
      WHERE ds.id = session_id
        AND ds.status IN ('paired', 'active')
        AND ds.expires_at > now()
    )
  );

-- Anon can also update session status to 'paired'
CREATE POLICY "Anon can pair pending sessions"
  ON public.device_sessions FOR UPDATE TO anon
  USING (status = 'pending' AND expires_at > now())
  WITH CHECK (status = 'paired');

-- Anon can read pending sessions (for pairing by code)
CREATE POLICY "Anon can find pending sessions by code"
  ON public.device_sessions FOR SELECT TO anon
  USING (status IN ('pending', 'paired', 'active') AND expires_at > now());

-- Authenticated users can view captures of their sessions
CREATE POLICY "Users can view captures of own sessions"
  ON public.device_captures FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.device_sessions ds
      WHERE ds.id = session_id AND ds.user_id = auth.uid()
    )
  );

-- Updated_at trigger
CREATE TRIGGER update_device_sessions_updated_at
  BEFORE UPDATE ON public.device_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();