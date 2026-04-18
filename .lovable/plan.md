

## Diagnóstico

O PostgREST do Supabase aplica um **limite máximo de 1000 linhas por request** mesmo quando não passamos `.limit()`/`.range()`. Com 10.905 farmers e 70.394 transações em base, várias páginas estão a mostrar apenas os primeiros 1000 registos sem aviso.

### Listagens afectadas (carregam tudo client-side, sem paginação real no servidor)

| Página/Hook | Tabela | Linhas reais | Mostra |
|---|---|---|---|
| `useFarmersList` (Agricultores) | farmers | 10.905 | 1000 |
| `Transacoes.tsx` | farmer_transactions | 70.394 | 1000 |
| `Patec.tsx` | farmers (PATEC) | 10.905 | 1000 |
| `Incentivos.tsx` | farmer_incentives | crescente | até 1000 |
| `Parcelas.tsx` | farmer_parcels | crescente | até 1000 |
| `Producao.tsx` | farmer_production | crescente | até 1000 |
| Dropdowns "selecionar agricultor" em Incentivos/Parcelas/Producao | farmers | 10.905 | 1000 |
| `useReportData` (joins via `.in("farmer_code", codes)`) | farmers→tx/incentivos/produção | grande | corta a 1000 em cada lado |

Limites já correctos (intencionais e pequenos): notificações (50), audit logs (500), stock movements (200), pesquisa POS (8), histórico vendas (50). Esses ficam como estão.

## Solução

Criar um helper genérico **`fetchAllPages`** em `src/lib/supabaseFetchAll.ts` que faz paginação por `.range(from, to)` em blocos de 1000 até esgotar (`count: "exact"` no primeiro pedido para saber o total, depois itera). 

Substituir os `select(...)` problemáticos por chamadas via este helper. Manter ordenação e filtros.

Para selects que servem só dropdowns de seleção (e.g. "escolher agricultor" no formulário de Incentivos/Parcelas/Producao), usar igualmente o helper para garantir que nenhum produtor desaparece da lista.

### Detalhe técnico do helper

```ts
// fetchAllPages<T>(builder: () => PostgrestFilterBuilder, pageSize=1000): Promise<T[]>
// 1) primeiro pedido com .range(0, 999) e { count: "exact" }
// 2) usa total para calcular nº de páginas; corre o resto em paralelo (Promise.all em chunks de 4)
// 3) concatena e devolve
```

Vantagens:
- Mantém RLS (cada request continua a passar pelo PostgREST).
- Permite filtros por `.eq`/`.in` antes de chamar o helper (recebe o builder, não dados).
- Performance OK: ~11 requests para farmers, ~71 para transações; paralelizados em chunks.

### Ficheiros a editar

1. **`src/lib/supabaseFetchAll.ts`** (novo) — helper de paginação.
2. **`src/hooks/useFarmersList.ts`** — usar helper.
3. **`src/pages/Transacoes.tsx`** — usar helper na queryFn.
4. **`src/pages/Patec.tsx`** — substituir o fetch de farmers.
5. **`src/pages/Incentivos.tsx`** — fetch incentivos + dropdown farmers.
6. **`src/pages/Parcelas.tsx`** — fetch parcels + dropdown farmers.
7. **`src/pages/Producao.tsx`** — fetch production + dropdown farmers.
8. **`src/hooks/useReportData.ts`** — wrap das 5 funções `fetch*` para puxar farmers e tabelas dependentes via helper (caso contrário os relatórios ficam incompletos para províncias grandes).

### Considerações de UX

- O carregamento inicial das páginas grandes (Agricultores, Transações) demora ~3-8s. Os Skeletons já existentes cobrem isso.
- Para Transações (70k linhas, ~30 MB JSON): aceitável numa primeira iteração. Se o utilizador reportar lentidão, próximo passo será **paginação server-side** com filtros (mover `search`/`empresa` para query Supabase). Mantenho fora do escopo deste ticket por ser refactor maior.

### Não tocar

- Limites pequenos intencionais (notifications 50, audit_logs 500, stock_movements 200, pesquisa POS 8, recent sales 5/10).
- RPC `dashboard_kpis*` (já agregam server-side, não sofrem do problema).

