# Otimização de páginas/funcionalidades pesadas

## Diagnóstico

Identifiquei o padrão comum que está a causar a lentidão em **Agricultores**, **Transações**, **Cartões SIM**, **Vendas**, **Geração em Lote de Cartões**, etc.:

1. **Carregamento total via `fetchAllPages`** — cada página puxa **TODAS** as linhas da tabela (até 18 mil agricultores, dezenas de milhares de transações) em chunks de 1000, mesmo quando só são apresentadas 10–15 linhas por página.
2. **Pesquisa/filtros/ordenação no browser** — re-corre o array completo a cada tecla digitada.
3. **Geração em lote sequencial** — em `CartaoIdLote.tsx` cada agricultor implica 3 round-trips (`select` + `update`/`insert` + `audit log`) feitos um a um, mais um `setTimeout(200ms)` por cartão renderizado.
4. **Falta de índices** na BD para colunas usadas em filtros (`province`, `status`, `school`, `farmer_code`, `created_at`).

---

## Plano de otimização (5 frentes)

### 1. Paginação e pesquisa no servidor (ganho maior)

Criar um hook genérico `useServerTable<T>` (em `src/hooks/useServerTable.ts`) que faz só **a página visível** com `range()` + `count: 'exact', head: true` e aceita filtros/ordenação:

```text
input  : { table, columns, page, pageSize, search, filters, sort, scope }
output : { rows, total, loading, refetch }
```

Aplicar a:
- **Agricultores** — pesquisa por `full_name`/`code`/`phone` via `or(ilike.%q%,...)`
- **Transações** — `farmer_transactions` com `farmer_code.ilike`/`empresa.eq`
- **Cartões SIM**, **Vendas**, **Facturas**, **Notas de Crédito**, **Stock**, **Ocorrências**

Manter o "carregar tudo" **só** na rota `/exportar` (CSV) e isolado num botão explícito.

### 2. Índices na base de dados

Migration única (`add_perf_indexes.sql`) com `CREATE INDEX CONCURRENTLY IF NOT EXISTS`:
- `farmers (status, province, municipality)` — filtros principais
- `farmers (created_at DESC)` — ordenação default
- `farmer_transactions (created_at DESC)`, `(empresa)`, `(farmer_code)`
- `pos_sales (created_at DESC)`, `(supplier_id)`, `(farmer_code)`
- Extensão `pg_trgm` + índices GIN trigram em `farmers.full_name`, `farmers.code`, `farmers.phone`, `farmers.bi` — torna `ILIKE '%termo%'` quase instantâneo

### 3. Operações em lote → RPC única (Geração de Cartões)

Substituir o loop de 3 chamadas/agricultor em `CartaoIdLote.tsx` por **uma** RPC `generate_farmer_cards_batch(_codes text[])`:
- faz `INSERT … ON CONFLICT DO UPDATE` em `farmer_cards` para todos os códigos
- regista `farmer_card_logs` em batch
- devolve `[{farmer_code, card_token}]`

Resultado: para 500 cartões passamos de **1500 round-trips** (~60–90 s) para **1** (~1–2 s).

Acertos adicionais no render PDF:
- Remover o `await setTimeout(200)` por cartão (ganho ≈ 200 ms × N).
- Renderizar em **batches paralelos** de 8 com `Promise.all` em vez de série.
- Lazy-import de `html2canvas`/`jspdf` na hora de gerar (já feito em parte) — confirmar.

### 4. React Query + cache partilhado

- Migrar `useFarmersList` (atualmente `useState/useEffect`) para `useQuery` com:
  - `staleTime: 60_000`
  - `placeholderData: keepPreviousData` (paginação sem flash)
- Reaproveita cache entre páginas (Agricultores ↔ CartaoIdLote ↔ Anomalias) — clicar entre elas fica instantâneo.
- Debounce do input de pesquisa (300 ms) com `useDeferredValue`.

### 5. Carga útil mais leve

- Reduzir `select(...)` aos campos mostrados (ex.: a listagem de Agricultores **não** precisa de `bi`, `saldo_final`, `total_gasto` — apresentamos esses só no perfil).
- Virtualizar listagens longas com `@tanstack/react-virtual` quando o utilizador escolhe "ver tudo" (modo export-preview).

---

## Detalhes técnicos

```text
src/
  hooks/
    useServerTable.ts        ← novo, genérico
    useFarmersList.ts        ← refactor para wrapper de useServerTable
  pages/
    Agricultores.tsx         ← passa filtros/page/sort ao hook
    Transacoes.tsx           ← idem
    CartaoIdLote.tsx         ← chamada única à RPC, batch render
    Mosap3PayCartoesSim.tsx  ← idem
    Mosap3PayVendas.tsx      ← idem
supabase/
  migrations/
    add_perf_indexes.sql                   ← índices + pg_trgm
    generate_farmer_cards_batch.sql        ← RPC em lote
```

Manter retrocompatibilidade: o hook antigo `useFarmersList()` continua a expor `farmers` mas com paginação opcional — páginas não migradas continuam a funcionar.

---

## Ordem de implementação (incremental, sem regressões)

1. **Migration de índices** — efeito imediato, sem mexer em código.
2. **Hook `useServerTable` + Agricultores** (página de maior impacto visível).
3. **Transações + Cartões SIM + Vendas** (mesmo padrão, copy-paste).
4. **RPC `generate_farmer_cards_batch` + refactor de `CartaoIdLote`**.
5. **Debounce/virtualização** onde fizer sentido após medições.

Após cada passo posso correr o `browser--performance_profile` para confirmar a melhoria.

## Resultado esperado

| Página | Antes | Depois |
|---|---|---|
| Agricultores (18k) | ~6–10 s | <500 ms |
| Transações | ~5–8 s | <500 ms |
| Geração lote 500 cartões | 60–90 s | 5–10 s |
| Pesquisa por nome | trava UI | instantâneo |
