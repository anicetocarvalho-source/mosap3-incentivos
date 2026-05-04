-- Farmer fingerprint templates (ISO 19794-2)
CREATE TABLE public.farmer_fingerprints (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  farmer_code TEXT NOT NULL,
  finger_position TEXT NOT NULL CHECK (finger_position IN (
    'polegar_dir', 'indicador_dir', 'medio_dir', 'anelar_dir',
    'polegar_esq', 'indicador_esq', 'medio_esq', 'anelar_esq'
  )),
  template_iso TEXT NOT NULL,
  raw_image_path TEXT,
  quality_score INTEGER,
  device_session_id UUID REFERENCES public.device_sessions(id),
  enrolled_by UUID NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(farmer_code, finger_position, is_active)
);

-- Fingerprint verification log
CREATE TABLE public.fingerprint_verifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  farmer_code TEXT NOT NULL,
  finger_position TEXT,
  match_score INTEGER NOT NULL,
  match_result TEXT NOT NULL CHECK (match_result IN ('match', 'no_match', 'error')),
  verified_by UUID,
  device_session_id UUID REFERENCES public.device_sessions(id),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_farmer_fp_code ON public.farmer_fingerprints(farmer_code);
CREATE INDEX idx_farmer_fp_active ON public.farmer_fingerprints(farmer_code, is_active) WHERE is_active = true;
CREATE INDEX idx_fp_verif_farmer ON public.fingerprint_verifications(farmer_code);
CREATE INDEX idx_fp_verif_date ON public.fingerprint_verifications(created_at DESC);

-- RLS
ALTER TABLE public.farmer_fingerprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fingerprint_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can view fingerprints"
  ON public.farmer_fingerprints FOR SELECT TO authenticated USING (true);

CREATE POLICY "Auth users can enroll fingerprints"
  ON public.farmer_fingerprints FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = enrolled_by);

CREATE POLICY "Auth users can deactivate fingerprints"
  ON public.farmer_fingerprints FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Auth users can view verifications"
  ON public.fingerprint_verifications FOR SELECT TO authenticated USING (true);

CREATE POLICY "Auth users can log verifications"
  ON public.fingerprint_verifications FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = verified_by);

-- Anon can verify (for public card verification endpoint)
CREATE POLICY "Anon can log verifications"
  ON public.fingerprint_verifications FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "Anon can read verifications"
  ON public.fingerprint_verifications FOR SELECT TO anon USING (true);

-- Updated_at trigger
CREATE TRIGGER update_farmer_fingerprints_updated_at
  BEFORE UPDATE ON public.farmer_fingerprints
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();