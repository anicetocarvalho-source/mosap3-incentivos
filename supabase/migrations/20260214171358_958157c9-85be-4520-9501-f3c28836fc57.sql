
-- Table to store notifications for each user
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'sistema',
  entity_type TEXT,
  entity_id TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can delete own notifications"
  ON public.notifications FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_read ON public.notifications(user_id, read);

-- Table to store push subscriptions per user
CREATE TABLE public.push_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscriptions"
  ON public.push_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own subscriptions"
  ON public.push_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own subscriptions"
  ON public.push_subscriptions FOR DELETE
  USING (auth.uid() = user_id);

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Function to create notification for all users (broadcast)
CREATE OR REPLACE FUNCTION public.notify_all_users(
  _title TEXT,
  _body TEXT,
  _category TEXT DEFAULT 'sistema',
  _entity_type TEXT DEFAULT NULL,
  _entity_id TEXT DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user RECORD;
BEGIN
  FOR _user IN SELECT DISTINCT user_id FROM user_roles
  LOOP
    INSERT INTO notifications (user_id, title, body, category, entity_type, entity_id)
    VALUES (_user.user_id, _title, _body, _category, _entity_type, _entity_id);
  END LOOP;
END;
$$;

-- Trigger: new farmer registered
CREATE OR REPLACE FUNCTION public.on_farmer_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM notify_all_users(
    'Novo Agricultor Registado',
    'O produtor ' || NEW.full_name || ' (' || NEW.code || ') foi registado.',
    'agricultores',
    'farmer',
    NEW.code
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_farmer_created
  AFTER INSERT ON public.farmers
  FOR EACH ROW
  EXECUTE FUNCTION public.on_farmer_created();

-- Trigger: farmer status changed
CREATE OR REPLACE FUNCTION public.on_farmer_status_changed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM notify_all_users(
      'Estado do Agricultor Alterado',
      'O produtor ' || NEW.full_name || ' mudou de "' || OLD.status || '" para "' || NEW.status || '".',
      'agricultores',
      'farmer',
      NEW.code
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_farmer_status_changed
  AFTER UPDATE ON public.farmers
  FOR EACH ROW
  EXECUTE FUNCTION public.on_farmer_status_changed();

-- Trigger: new incentive
CREATE OR REPLACE FUNCTION public.on_incentive_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM notify_all_users(
    'Novo Incentivo Registado',
    'Incentivo ' || NEW.incentive_code || ' (' || NEW.type || ') de ' || NEW.amount || ' Kz.',
    'incentivos',
    'incentive',
    NEW.incentive_code
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_incentive_created
  AFTER INSERT ON public.farmer_incentives
  FOR EACH ROW
  EXECUTE FUNCTION public.on_incentive_created();

-- Trigger: incentive status changed
CREATE OR REPLACE FUNCTION public.on_incentive_status_changed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM notify_all_users(
      'Estado do Incentivo Alterado',
      'Incentivo ' || NEW.incentive_code || ' mudou para "' || NEW.status || '".',
      'incentivos',
      'incentive',
      NEW.incentive_code
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_incentive_status_changed
  AFTER UPDATE ON public.farmer_incentives
  FOR EACH ROW
  EXECUTE FUNCTION public.on_incentive_status_changed();

-- Trigger: new transaction
CREATE OR REPLACE FUNCTION public.on_transaction_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM notify_all_users(
    'Nova Transação Registada',
    'Transação de ' || NEW.valor || ' Kz em ' || NEW.product || ' (' || NEW.empresa || ').',
    'transacoes',
    'transaction',
    NEW.farmer_code
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_transaction_created
  AFTER INSERT ON public.farmer_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.on_transaction_created();

-- Trigger: new production
CREATE OR REPLACE FUNCTION public.on_production_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM notify_all_users(
    'Nova Produção Registada',
    'Produção ' || NEW.production_code || ' de ' || NEW.culture || ' registada.',
    'producao',
    'production',
    NEW.farmer_code
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_production_created
  AFTER INSERT ON public.farmer_production
  FOR EACH ROW
  EXECUTE FUNCTION public.on_production_created();

-- Trigger: production phase changed
CREATE OR REPLACE FUNCTION public.on_production_phase_changed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.current_phase IS DISTINCT FROM NEW.current_phase THEN
    PERFORM notify_all_users(
      'Fase de Produção Alterada',
      'Produção ' || NEW.production_code || ' avançou para "' || NEW.current_phase || '".',
      'producao',
      'production',
      NEW.farmer_code
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_production_phase_changed
  AFTER UPDATE ON public.farmer_production
  FOR EACH ROW
  EXECUTE FUNCTION public.on_production_phase_changed();

-- Trigger: new parcel
CREATE OR REPLACE FUNCTION public.on_parcel_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM notify_all_users(
    'Nova Parcela Registada',
    'Parcela ' || NEW.parcel_code || ' (' || NEW.culture || ', ' || NEW.area || ') registada.',
    'parcelas',
    'parcel',
    NEW.farmer_code
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_parcel_created
  AFTER INSERT ON public.farmer_parcels
  FOR EACH ROW
  EXECUTE FUNCTION public.on_parcel_created();

-- Trigger: parcel verified
CREATE OR REPLACE FUNCTION public.on_parcel_verified()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'Verificada' THEN
    PERFORM notify_all_users(
      'Parcela Verificada',
      'Parcela ' || NEW.parcel_code || ' foi verificada.',
      'parcelas',
      'parcel',
      NEW.farmer_code
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_parcel_verified
  AFTER UPDATE ON public.farmer_parcels
  FOR EACH ROW
  EXECUTE FUNCTION public.on_parcel_verified();
