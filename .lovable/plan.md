## Re-aplicar `mosap3-pay-dataset-2.json` ao sistema

Re-executar o pipeline de 4 fases sobre o staging existente (`_ds_produtores`, `_ds_transacoes`). Idempotente — só insere/actualiza o que estiver em falta ou divergente.

### Passos

1. **Verificar staging** — `SELECT count(*) FROM _ds_produtores / _ds_transacoes`. Se vazio, parar e pedir re-upload do JSON.
2. **Fase 1 — Produtores em falta**: `apply_dataset_missing_farmers()` via Edge Function `process-mosap3-dataset?action=apply`.
3. **Fase 2 — Saldos**: `apply_dataset_balances()` (actualiza `valor_recebido`, `total_gasto`, `saldo_final` em PT-AO, regista em `farmer_balance_history` com `source='mosap3-pay-dataset'`).
4. **Fase 3 — Transações em falta**:
   - `backfill_dataset_tx_external_id()` (liga existentes por chave natural)
   - `apply_dataset_missing_tx()` (INSERT ON CONFLICT em chunks)
5. **Validação final** — comparar totais BD vs dataset:
   - count(farmers) vs count(_ds_produtores)
   - SUM(saldo_final) vs SUM(saldo_actual)
   - count(farmer_transactions) vs count(_ds_transacoes)
6. **Cleanup** (opcional, com confirmação): `cleanup_dataset_staging()`.

### Detalhes técnicos

- Tudo via RPCs já criadas nas migrações anteriores (`20260626173030…173313`).
- Edge Function `process-mosap3-dataset` já suporta `action=apply` com whitelist de funções.
- `farmer_transactions.external_id` tem UNIQUE index → `ON CONFLICT DO NOTHING` garante idempotência.
- Saldo canónico mantém-se `computeSaldoFinal(valor_recebido, total_gasto)`.
- Removidos contam em agregados (não filtrar por status).
- Sem alterações de UI ou schema novas.

### Confirmação

- Deseja manter o staging após validação (para futuras re-execuções) ou correr `cleanup_dataset_staging()` no fim?