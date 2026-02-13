
-- Create system_settings table for key-value configuration storage
CREATE TABLE public.system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read settings
CREATE POLICY "Authenticated users can view settings"
  ON public.system_settings FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can modify settings
CREATE POLICY "Admins can insert settings"
  ON public.system_settings FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update settings"
  ON public.system_settings FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_system_settings_updated_at
  BEFORE UPDATE ON public.system_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default values
INSERT INTO public.system_settings (key, value) VALUES
  ('org_name', 'MOSAP3 — Ministério da Agricultura e Pescas'),
  ('org_email', 'suporte@mosap3.gov.ao'),
  ('org_phone', '+244 222 123 456'),
  ('campanha', '2025/2026'),
  ('idioma', 'pt'),
  ('notif_email', 'true'),
  ('notif_push', 'true'),
  ('modo_offline', 'true'),
  ('auto_sync', 'true'),
  ('intervalo_sync', '15');
