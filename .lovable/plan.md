## Resumo

Adicionar `src/test/provincias-parity.test.ts` que valida que os totais de Produtores na página `/provincias` (RPC `get_farmer_counts_by_location`) batem certo com:
- `dashboard_kpis.total_farmers` (Dashboard)
- `fetchAllPages` sobre `farmers` com `includeRemoved: true` (Lista de Agricultores em modo Admin)

Para o mesmo dataset e mesmo "filtro" (escopo global Admin, incluindo Removidos — regra canónica do projecto).

## Ficheiro novo

`src/test/provincias-parity.test.ts`

Segue exactamente o padrão de `dashboard-list-parity.test.ts`:

1. **Dataset partilhado** — reutiliza a mesma forma (`ATIVOS=138` + `REMOVIDOS=14` = 152). Atribui `province / municipality / school` aleatórios mas determinísticos a cada linha para podermos validar agregação por escola.
2. **Mock `supabase`** com:
   - `from('farmers')` igual ao existente (suporta `.neq` Removido para o cenário "Lista").
   - `rpc('dashboard_kpis')` devolve `total_farmers = DATASET.length`.
   - `rpc('get_farmer_counts_by_location')` agrega o dataset por `(province, municipality, school)` normalizados com `trim + lower` (replicando a função SQL) e devolve `[{ province, municipality, school, total }]`.
3. **Testes**:
   - **`get_farmer_counts_by_location` soma == DATASET.length** (inclui Removidos).
   - **Soma das contagens == `dashboard_kpis.total_farmers`** — paridade `/provincias` ↔ Dashboard.
   - **Soma das contagens == `fetchAllPages(farmers, includeRemoved:true)`** — paridade `/provincias` ↔ Lista (Admin).
   - **Soma por província na RPC == soma equivalente derivada do dataset bruto** — garante que o agregado server-side não perde linhas (ex.: nulls).
   - **Província só com Removidos aparece nas contagens** — garante que nunca alguém volta a filtrar `Removido` na RPC.

## Sem alterações

- Sem mudanças em ficheiros de produção, hooks ou SQL.
- Apenas um ficheiro de teste novo.

## Critérios de aceitação

- `bunx vitest run src/test/provincias-parity.test.ts` passa.
- Se alguém alterar a RPC para excluir Removidos ou mudar a normalização, pelo menos um teste falha.