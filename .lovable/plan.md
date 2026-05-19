## Resumo

Substituir o carregamento de todas as linhas de `farmers` na página `/provincias` por uma RPC agregada no Postgres que devolve contagens por província, município e escola — eliminando o `fetchAllPages` de produtores no cliente.

## Alterações

### 1. Backend — Migração SQL

Criar função `public.get_farmer_counts_by_location()`:

```sql
CREATE OR REPLACE FUNCTION public.get_farmer_counts_by_location()
RETURNS TABLE (
  province text,
  municipality text,
  school text,
  total bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(NULLIF(TRIM(LOWER(province)), ''), '') AS province,
    COALESCE(NULLIF(TRIM(LOWER(municipality)), ''), '') AS municipality,
    COALESCE(NULLIF(TRIM(LOWER(school)), ''), '') AS school,
    COUNT(*)::bigint AS total
  FROM public.farmers
  GROUP BY 1, 2, 3;
$$;

REVOKE ALL ON FUNCTION public.get_farmer_counts_by_location() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_farmer_counts_by_location() TO authenticated;
```

Notas:
- `SECURITY DEFINER` para contornar RLS — a função apenas devolve agregados (não dados pessoais).
- Inclui Removidos (regra canónica do projecto).
- Normalização (`trim`+`lower`) feita no servidor, alinhada com `norm()` do front.

### 2. Frontend — `src/pages/GestaoProvincias.tsx`

- Remover `fetchAllPages` sobre `farmers` em `refreshFarmerCounts`.
- Chamar `supabase.rpc('get_farmer_counts_by_location')`.
- Trocar `farmerRows` (lista de linhas) por `farmerCounts` (lista de agregados `{province, municipality, school, total}`).
- Recalcular `realByProvince`, `realBySchool`, `totalProdutores` somando `total` em vez de contar linhas.
- Manter botão "Actualizar contagens", spinner, toast de sucesso e toast de erro (já implementados).

### 3. Sem alterações
- Hooks (`useProvincesData`), restantes páginas, tabela `farmers`, RLS de `farmers`.

## Critérios de aceitação

- Página `/provincias` carrega contagens com **uma única chamada RPC** (sem paginação cliente).
- Totais dos cards (Produtores totais, por província, por escola) idênticos aos actuais.
- Botão "Actualizar contagens" continua a funcionar; toast de erro aparece se a RPC falhar.