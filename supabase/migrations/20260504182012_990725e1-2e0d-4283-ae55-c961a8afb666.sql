CREATE TABLE public.farmer_nfc_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  farmer_code TEXT NOT NULL,
  nfc_uid TEXT NOT NULL,
  nfc_type TEXT DEFAULT 'unknown',
  label TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  device_session_id UUID REFERENCES public.device_sessions(id),
  linked_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(nfc_uid, is_active)
);

CREATE INDEX idx_farmer_nfc_code ON public.farmer_nfc_tags(farmer_code);
CREATE INDEX idx_farmer_nfc_uid ON public.farmer_nfc_tags(nfc_uid) WHERE is_active = true;

ALTER TABLE public.farmer_nfc_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can view nfc tags"
  ON public.farmer_nfc_tags FOR SELECT TO authenticated USING (true);

CREATE POLICY "Auth users can link nfc tags"
  ON public.farmer_nfc_tags FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = linked_by);

CREATE POLICY "Auth users can deactivate nfc tags"
  ON public.farmer_nfc_tags FOR UPDATE TO authenticated USING (true);

-- Anon can look up farmer by NFC UID (for verification)
CREATE POLICY "Anon can lookup by nfc uid"
  ON public.farmer_nfc_tags FOR SELECT TO anon USING (is_active = true);

CREATE TRIGGER update_farmer_nfc_tags_updated_at
  BEFORE UPDATE ON public.farmer_nfc_tags
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();