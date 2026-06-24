CREATE TABLE IF NOT EXISTS public._ds_produtores (
  produtor_id text PRIMARY KEY,
  nome text,
  provincia text,
  municipio text,
  eca text,
  genero text,
  idade int,
  saldo_inicial numeric,
  total_gasto numeric,
  saldo_actual numeric,
  n_transacoes int
);
CREATE TABLE IF NOT EXISTS public._ds_transacoes (
  transacao_id text PRIMARY KEY,
  produtor_id text,
  data timestamptz,
  produto text,
  categoria text,
  empresa text,
  valor numeric
);
CREATE INDEX IF NOT EXISTS _ds_tx_prod_idx ON public._ds_transacoes(produtor_id);
GRANT ALL ON public._ds_produtores TO service_role;
GRANT ALL ON public._ds_transacoes TO service_role;
ALTER TABLE public._ds_produtores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public._ds_transacoes ENABLE ROW LEVEL SECURITY;
TRUNCATE public._ds_produtores;
TRUNCATE public._ds_transacoes;