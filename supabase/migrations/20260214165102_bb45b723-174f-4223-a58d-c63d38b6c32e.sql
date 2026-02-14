
-- Create storage bucket for farmer media (photos and biometrics)
INSERT INTO storage.buckets (id, name, public)
VALUES ('farmer-media', 'farmer-media', true);

-- Storage policies for farmer-media bucket
CREATE POLICY "Authenticated users can upload farmer media"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'farmer-media' AND auth.role() = 'authenticated');

CREATE POLICY "Anyone can view farmer media"
ON storage.objects FOR SELECT
USING (bucket_id = 'farmer-media');

CREATE POLICY "Authenticated users can update farmer media"
ON storage.objects FOR UPDATE
USING (bucket_id = 'farmer-media' AND auth.role() = 'authenticated');

CREATE POLICY "Admins can delete farmer media"
ON storage.objects FOR DELETE
USING (bucket_id = 'farmer-media' AND public.is_admin(auth.uid()));

-- Create farmers table
CREATE TABLE public.farmers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  bi TEXT,
  birth_date DATE,
  gender TEXT,
  phone TEXT,
  province TEXT,
  municipality TEXT,
  school TEXT,
  status TEXT NOT NULL DEFAULT 'Pendente',
  -- Photo URLs (stored in storage bucket)
  photo_frontal_url TEXT,
  photo_profile_left_url TEXT,
  photo_profile_right_url TEXT,
  -- Biometric capture status and URLs
  biometric_thumb_right_url TEXT,
  biometric_index_right_url TEXT,
  biometric_thumb_left_url TEXT,
  biometric_index_left_url TEXT,
  registered_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.farmers ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can view farmers"
ON public.farmers FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can insert farmers"
ON public.farmers FOR INSERT
WITH CHECK (true);

CREATE POLICY "Authenticated users can update farmers"
ON public.farmers FOR UPDATE
USING (true);

CREATE POLICY "Admins can delete farmers"
ON public.farmers FOR DELETE
USING (public.is_admin(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_farmers_updated_at
BEFORE UPDATE ON public.farmers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
