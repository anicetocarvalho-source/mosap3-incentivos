INSERT INTO storage.buckets (id, name, public)
VALUES ('sim-import-tmp', 'sim-import-tmp', false)
ON CONFLICT (id) DO NOTHING;