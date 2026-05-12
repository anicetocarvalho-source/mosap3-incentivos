## Problema

A página `/patec` mostra contagens incorrectas:
1. Total de produtores não bate com a base real.
2. Stats por PATEC 1/2/3/Sem PATEC desactualizados.
3. Inclui produtores soft-deleted (`status = 'Removido'`).
4. Não respeita as permissões geográficas (províncias / ECAs) do utilizador.

A mesma inconsistência precisa ser corrigida em todos os módulos que contam produtores, para manter coerência em toda a plataforma.

## Regras unificadas para contagem de produtores

A partir desta correcção, **todas** as contagens de produtores aplicam:

- Excluir `status = 'Removido'` (soft-delete).
- Filtrar por `user_provinces` se o utilizador for sénior/júnior (province scope).
- Filtrar por `user_ecas` (mapeado para `farmers.school`) se for técnico extensionista.
- Admin e gestor de incentivos veem o total global.

Reaproveita-se o helper `resolveScope` já existente em `useDashboardData.ts`, extraindo-o para `src/lib/farmerScope.ts` para uso partilhado.

## Mudanças

### 1. Novo helper `src/lib/farmerScope.ts`
- Move `getFilterScope`, `fetchUserProvinces`, `fetchUserEcas`, `resolveScope` para módulo partilhado.
- Adiciona `applyFarmerScopeFilter(query, scope, provinces, ecas)` que aplica `.neq("status", "Removido")` + `.in("province", …)` ou `.in("school", …)` conforme o scope.
- `useDashboardData.ts` passa a importar daqui.

### 2. `src/pages/Patec.tsx`
- Usa `useAuth` + `resolveScope` para obter scope/províncias/ECAs do utilizador.
- `fetchFarmers` aplica `applyFarmerScopeFilter` (exclui Removido + filtro geo).
- Header passa a mostrar badge com o âmbito (igual ao Dashboard) quando não for global.
- Stats `total / patec1 / patec2 / patec3 / semPatec` recalculam-se sobre a lista já filtrada — fica automaticamente correcto.
- Ao carregar a lista das catequeses (escolas) para atribuição em lote, respeita o mesmo scope.

### 3. `src/hooks/usePatecPendingCount.ts` (badge da sidebar)
- Adiciona `.neq("status", "Removido")` e aplica filtro geo via `resolveScope` para coincidir com a página.

### 4. Auditoria de outros módulos que contam produtores
Aplicar a mesma regra (excluir Removido + scope geo) a:

- `src/hooks/useFarmersList.ts` — lista de Agricultores (já tem filtro de status no UI, garantir que a contagem default exclui Removido salvo quando o utilizador escolhe explicitamente esse filtro).
- `src/hooks/useDashboardData.ts` / RPC `dashboard_kpis` — confirmar que a função SQL exclui Removido; se não excluir, criar migração para corrigir.
- `src/hooks/useReportData.ts` (página Relatórios) — aplicar exclusão e scope.
- `src/pages/Incentivos.tsx` e `src/components/incentivos/BatchDistributionDialog.tsx` — exclusão + scope.
- `src/pages/CartoesId.tsx` e `src/pages/CartaoIdLote.tsx` — exclusão + scope.
- `src/hooks/useFinancialSummary.ts` — exclusão.
- `src/pages/EscolasCampo.tsx` / `useSchoolDetail.ts` — exclusão na agregação por escola.
- Página `Producao` / `Parcelas` — exclusão na contagem de produtores associados.

Cada módulo recebe apenas o mínimo: passar a query pelo `applyFarmerScopeFilter` (ou equivalente para hooks que já têm a sua própria lógica de scope).

### 5. Migração SQL (se necessário)
Se a função `dashboard_kpis` (RPC) ou outras funções SQL contarem `farmers` sem excluir `Removido`, criar migração que actualiza as funções para ignorar esse status. Verificar antes de criar.

### 6. Verificação
- Login como admin → contagens totais batem com `SELECT count(*) FROM farmers WHERE status <> 'Removido'`.
- Login como sénior de uma província → contagens só dessa província.
- Login como extensionista → só da(s) sua(s) ECA(s).
- Marcar um produtor como Removido → contagem de PATEC, Dashboard, sidebar badge e Relatórios decrementa.

## Detalhes técnicos

```ts
// src/lib/farmerScope.ts
export async function applyFarmerScopeFilter<T>(
  query: any,
  { scope, provinces, ecas }: ResolvedScope,
  { includeRemoved = false } = {}
) {
  if (!includeRemoved) query = query.neq("status", "Removido");
  if (scope === "province" && provinces.length) query = query.in("province", provinces);
  else if (scope === "eca" && ecas.length) query = query.in("school", ecas);
  return query;
}
```

```ts
// src/pages/Patec.tsx (fetchFarmers)
const scope = await resolveScope(user.id, roles);
const data = await fetchAllPages<FarmerPatec>(() =>
  applyFarmerScopeFilter(
    supabase.from("farmers").select("id, code, full_name, province, municipality, school, patec, status", { count: "exact" }).order("code"),
    scope
  )
);
```

Sem alterações de schema previstas (apenas eventual ajuste em RPC se a auditoria mostrar que conta Removidos).