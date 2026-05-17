-- Helper: normalize last 9 digits of phone
CREATE OR REPLACE FUNCTION public.normalize_phone9(_p text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path=public AS $$
  SELECT NULLIF(RIGHT(regexp_replace(COALESCE(_p,''), '\D', '', 'g'), 9), '');
$$;

-- Helper: Haversine distance in km between two text lat/lon pairs
CREATE OR REPLACE FUNCTION public.haversine_km(_lat1 numeric, _lon1 numeric, _lat2 numeric, _lon2 numeric)
RETURNS numeric LANGUAGE sql IMMUTABLE SET search_path=public AS $$
  SELECT 2 * 6371 * asin(sqrt(
    sin(radians((_lat2-_lat1)/2))^2 +
    cos(radians(_lat1))*cos(radians(_lat2))*sin(radians((_lon2-_lon1)/2))^2
  ));
$$;

-- Core inference function: returns province/municipality/confidence/source/evidence
CREATE OR REPLACE FUNCTION public.infer_farmer_location(
  _farmer_code text, _school text, _province text, _bi text, _phone text
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_result jsonb := jsonb_build_object('confidence', 0);
  r record;
  v_phone9 text;
  v_lat numeric; v_lon numeric;
BEGIN
  -- 1. School (ECA) -> province + municipality
  IF _school IS NOT NULL AND btrim(_school) <> '' THEN
    SELECT p.name AS prov_name, m.name AS muni_name, s.id AS school_id, s.name AS school_name
      INTO r
      FROM public.schools s
      LEFT JOIN public.provinces p ON p.id = s.province_id
      LEFT JOIN public.municipalities m ON m.id = s.municipality_id
     WHERE lower(btrim(s.name)) = lower(btrim(_school))
     LIMIT 2;
    IF FOUND AND r.muni_name IS NOT NULL THEN
      IF _province IS NULL OR btrim(_province) = '' OR lower(btrim(_province)) = lower(btrim(r.prov_name)) THEN
        RETURN jsonb_build_object(
          'province', r.prov_name, 'municipality', r.muni_name,
          'confidence', 95, 'source', 'school',
          'evidence', jsonb_build_object('school_id', r.school_id, 'school_name', r.school_name)
        );
      END IF;
    END IF;
  END IF;

  -- 2. BI match — outro agricultor com mesmo BI
  IF _bi IS NOT NULL AND btrim(_bi) <> '' THEN
    SELECT f.province AS prov_name, f.municipality AS muni_name, f.code AS match_code
      INTO r
      FROM public.farmers f
     WHERE lower(btrim(f.bi)) = lower(btrim(_bi))
       AND f.code IS DISTINCT FROM _farmer_code
       AND COALESCE(f.status,'') <> 'Removido'
       AND f.municipality IS NOT NULL AND f.municipality <> ''
     LIMIT 1;
    IF FOUND THEN
      IF _province IS NULL OR btrim(_province) = '' OR lower(btrim(_province)) = lower(btrim(r.prov_name)) THEN
        RETURN jsonb_build_object(
          'province', r.prov_name, 'municipality', r.muni_name,
          'confidence', 90, 'source', 'bi_match',
          'evidence', jsonb_build_object('match_farmer_code', r.match_code, 'bi', _bi)
        );
      END IF;
    END IF;
  END IF;

  -- 3. Phone match (últimos 9 dígitos)
  v_phone9 := public.normalize_phone9(_phone);
  IF v_phone9 IS NOT NULL AND length(v_phone9) = 9 THEN
    SELECT f.province AS prov_name, f.municipality AS muni_name, f.code AS match_code, count(*) OVER () AS n
      INTO r
      FROM public.farmers f
     WHERE public.normalize_phone9(f.phone) = v_phone9
       AND f.code IS DISTINCT FROM _farmer_code
       AND COALESCE(f.status,'') <> 'Removido'
       AND f.municipality IS NOT NULL AND f.municipality <> ''
     LIMIT 1;
    IF FOUND AND r.n = 1 THEN
      IF _province IS NULL OR btrim(_province) = '' OR lower(btrim(_province)) = lower(btrim(r.prov_name)) THEN
        RETURN jsonb_build_object(
          'province', r.prov_name, 'municipality', r.muni_name,
          'confidence', 80, 'source', 'phone_match',
          'evidence', jsonb_build_object('match_farmer_code', r.match_code, 'phone9', v_phone9)
        );
      END IF;
    END IF;
  END IF;

  -- 4. GPS — vizinho mais próximo (≤5 km) com município conhecido
  IF _farmer_code IS NOT NULL THEN
    SELECT AVG(NULLIF(replace(lat,',','.'),'')::numeric),
           AVG(NULLIF(replace(lon,',','.'),'')::numeric)
      INTO v_lat, v_lon
      FROM public.farmer_parcels
     WHERE farmer_code = _farmer_code
       AND lat IS NOT NULL AND lon IS NOT NULL;
    IF v_lat IS NOT NULL AND v_lon IS NOT NULL THEN
      SELECT f.province AS prov_name, f.municipality AS muni_name, f.code AS match_code,
             public.haversine_km(v_lat, v_lon,
               NULLIF(replace(p.lat,',','.'),'')::numeric,
               NULLIF(replace(p.lon,',','.'),'')::numeric) AS dist_km
        INTO r
        FROM public.farmer_parcels p
        JOIN public.farmers f ON f.code = p.farmer_code
       WHERE p.farmer_code IS DISTINCT FROM _farmer_code
         AND p.lat IS NOT NULL AND p.lon IS NOT NULL
         AND f.municipality IS NOT NULL AND f.municipality <> ''
         AND COALESCE(f.status,'') <> 'Removido'
       ORDER BY public.haversine_km(v_lat, v_lon,
                  NULLIF(replace(p.lat,',','.'),'')::numeric,
                  NULLIF(replace(p.lon,',','.'),'')::numeric) ASC
       LIMIT 1;
      IF FOUND AND r.dist_km IS NOT NULL AND r.dist_km <= 5 THEN
        IF _province IS NULL OR btrim(_province) = '' OR lower(btrim(_province)) = lower(btrim(r.prov_name)) THEN
          RETURN jsonb_build_object(
            'province', r.prov_name, 'municipality', r.muni_name,
            'confidence', 75, 'source', 'gps_neighbor',
            'evidence', jsonb_build_object(
              'neighbor_farmer_code', r.match_code,
              'distance_km', round(r.dist_km, 3),
              'origin_lat', v_lat, 'origin_lon', v_lon
            )
          );
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN v_result;
END;
$$;

-- Trigger function
CREATE OR REPLACE FUNCTION public.trg_autofill_farmer_location()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_inf jsonb;
  v_conf int;
  v_muni text;
  v_prov text;
  v_prev_prov text := OLD.province;
  v_prev_muni text := OLD.municipality;
  v_assigned jsonb;
BEGIN
  -- só actua se município está vazio
  IF NEW.municipality IS NOT NULL AND btrim(NEW.municipality) <> '' THEN
    RETURN NEW;
  END IF;

  BEGIN
    v_inf := public.infer_farmer_location(NEW.code, NEW.school, NEW.province, NEW.bi, NEW.phone);
    v_conf := COALESCE((v_inf->>'confidence')::int, 0);
    v_muni := v_inf->>'municipality';
    v_prov := v_inf->>'province';

    IF v_conf >= 75 AND v_muni IS NOT NULL THEN
      NEW.municipality := v_muni;
      -- só preenche província se estava vazia e confiança ≥90
      IF (NEW.province IS NULL OR btrim(NEW.province) = '') AND v_conf >= 90 AND v_prov IS NOT NULL THEN
        NEW.province := v_prov;
      END IF;

      v_assigned := jsonb_build_object('province', NEW.province, 'municipality', NEW.municipality);

      INSERT INTO public.audit_logs (action, entity_type, entity_id, user_id, details)
      VALUES (
        'auto_assign_municipality', 'farmer', NEW.code, auth.uid(),
        jsonb_build_object(
          'farmer_code', NEW.code,
          'applied', true,
          'confidence', v_conf,
          'source', v_inf->>'source',
          'assigned', v_assigned,
          'previous', jsonb_build_object('province', v_prev_prov, 'municipality', v_prev_muni),
          'evidence', v_inf->'evidence'
        )
      );
    ELSIF v_conf > 0 THEN
      INSERT INTO public.audit_logs (action, entity_type, entity_id, user_id, details)
      VALUES (
        'municipality_suggestion', 'farmer', NEW.code, auth.uid(),
        jsonb_build_object(
          'farmer_code', NEW.code,
          'applied', false,
          'confidence', v_conf,
          'source', v_inf->>'source',
          'suggested', jsonb_build_object('province', v_prov, 'municipality', v_muni),
          'previous', jsonb_build_object('province', v_prev_prov, 'municipality', v_prev_muni),
          'evidence', v_inf->'evidence',
          'reason', 'below_threshold_75'
        )
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    BEGIN
      INSERT INTO public.audit_logs (action, entity_type, entity_id, user_id, details)
      VALUES ('auto_assign_failed', 'farmer', NEW.code, auth.uid(),
              jsonb_build_object('error', SQLERRM, 'farmer_code', NEW.code));
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_farmers_autofill_location ON public.farmers;
CREATE TRIGGER trg_farmers_autofill_location
BEFORE INSERT OR UPDATE OF school, province, municipality, phone, bi
ON public.farmers
FOR EACH ROW
EXECUTE FUNCTION public.trg_autofill_farmer_location();