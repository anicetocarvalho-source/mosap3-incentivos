
The user uploaded `transacoes_agrupadas.xlsx` containing real data for the platform (farmers, suppliers, transactions, provinces, field schools, etc.). I couldn't inspect the file contents in plan mode — `document--parse_document` returned empty pages and shell tools aren't available for xlsx parsing here. The plan must therefore include an inspection step in default mode, followed by mapping, import, and mock cleanup.

# Plano: Importar dados reais do Excel para a plataforma

## Fase 1 — Inspecção do ficheiro (diagnóstico)
Em default mode, ler o `.xlsx` com `xlsx` (Node) ou `openpyxl` (Python via exec) para listar **todas as folhas, cabeçalhos e amostra de 5 linhas de cada**. Apresentar o mapeamento proposto folha → tabela Supabase antes de inserir.

Mapeamento esperado (a confirmar após inspecção):

| Folha provável | Tabela destino |
|---|---|
| Províncias | `provinces` |
| Municípios | `municipalities` |
| Escolas de Campo / ECAs | `schools` |
| Agricultores / Produtores | `farmers` |
| Fornecedores / Empresas | `suppliers` (+ `supplier_provinces`) |
| Transacções | `farmer_transactions` ou `pos_sales` |
| PATEC / Pacotes | `patec_items` |

## Fase 2 — Limpeza dos dados mock existentes
Antes de inserir, executar `DELETE` em ordem segura (filhos → pais) via migração:
1. `farmer_transactions`, `farmer_incentives`, `farmer_parcels`, `farmer_production`, `farmer_dependents`, `farmer_documents`, `livestock*`
2. `pos_sale_items`, `pos_sales`, `credit_note_items`, `credit_notes`, `stock_movements`
3. `supplier_products`, `supplier_pos`, `supplier_provinces`, `supplier_stores`, `suppliers`
4. `farmers`
5. `schools`, `municipalities`, `provinces` (apenas se substituídas pelo Excel)

**Salvaguarda**: manter utilizadores (`profiles`, `user_roles`, `module_permissions`, `system_settings`).

## Fase 3 — Import com normalização
Script Node em `scripts/import-real-data.ts` (executável uma vez via `tsx`), ou directamente via `psql COPY` se os dados forem tabulares limpos. Para cada folha:

- **Normalizar**: trim, padronizar género (M/F → Masculino/Feminino), datas → ISO, valores monetários (`"1.234,56" → "1234.56"`).
- **Resolver chaves**: `province_name → province_id` (cache em memória), `municipality_name → municipality_id`, etc.
- **Gerar códigos** se ausentes: `AGR-0001`, `FORN-001`, etc.
- **Inserir em lotes de 50** (limite Supabase, conforme convenção do projecto).
- **Relatório final**: contagem inserida vs ignorada por folha + erros de validação.

## Fase 4 — Limpeza de mocks no código
Remover/desactivar:
- `src/data/escolasData.ts` (mocks `provinces`, `allSchools`, `getSchoolsByProvince`) — substituir consumidores por `useProvincesData()` / `useSchoolDetail()` que já leem da BD.
- Verificar `useSchoolDetail.ts` (faz fallback a `allSchools` por nome — passar a usar apenas BD).
- Verificar `EscolasCampo.tsx`, `FichaEscola.tsx`, `ProvinciaEscolas.tsx` — confirmar que não dependem dos mocks.
- Sweep com `grep` por `allSchools`, `escolasData`, `mock` e remover referências mortas.

## Fase 5 — Validação
- `npx tsc --noEmit`
- Verificar Dashboard, Agricultores, Fornecedores, Escolas de Campo, MOSAP3Pay → todos os números devem reflectir os dados reais.
- Confirmar que filtros geográficos cascateiam correctamente.

## Notas técnicas
- `farmers.valor_recebido / total_gasto / saldo_final` são `text` no schema (formato pt-AO). Manter formato `"0,00"`.
- Sem alterações de schema previstas — só dados.
- Operação destrutiva: confirmar com o utilizador antes do `DELETE` em massa (passo explícito).

## Entregáveis após aprovação
1. Mensagem com inspecção das folhas + mapeamento proposto (pedir confirmação se ambíguo).
2. Migração de limpeza dos mocks na BD.
3. Script de import + execução.
4. Remoção dos ficheiros de dados mock no código.
5. Resumo final com contagens por tabela.
