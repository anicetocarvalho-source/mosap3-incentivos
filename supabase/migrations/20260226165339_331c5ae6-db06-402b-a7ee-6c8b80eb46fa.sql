
-- Create farmer_documents table
CREATE TABLE public.farmer_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  farmer_code TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL DEFAULT 'outro',
  file_size INTEGER,
  uploaded_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add foreign key to farmers
ALTER TABLE public.farmer_documents
  ADD CONSTRAINT farmer_documents_farmer_code_fkey
  FOREIGN KEY (farmer_code) REFERENCES public.farmers(code);

-- Enable RLS
ALTER TABLE public.farmer_documents ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Auth users can view farmer documents"
  ON public.farmer_documents FOR SELECT
  USING (true);

CREATE POLICY "Auth users can insert farmer documents"
  ON public.farmer_documents FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can delete farmer documents"
  ON public.farmer_documents FOR DELETE
  USING (is_admin(auth.uid()));
