## Objetivo

Processar `mosap3-pay-dataset.json` (14.833 produtores, 73.194 transações, 2.326.839.863,33 AOA) em **4 fases sequenciais**, cada uma com confirmação. Match por telefone (`produtor_id` ↔ `farmers.phone` → `code = 'AGR-' + phone[3:]`).

Estado atual da BD: 14.823 produtores · 70.379 transações · ~10 produtores em falta · ~2.815 transações em falta.

---

## Fase 1 — Reconciliação (read-only)

Página nova `/mosap3pay/reconciliacao-dataset` (Admin) que:

1. Faz upload do JSON (ou lê de bucket temporário).
2. Compara cada produtor do ficheiro com `farmers`:
   - **Match exato** (saldo igual ±1 Kz)
   - **Diferença de saldo** (`saldo_actual` ≠ `saldo_final`)
   - **Diferença de gasto** (`total_gasto`)
   - **Em falta na BD** (telefone só no ficheiro)
   - **Em falta no ficheiro** (telefone só na BD)
3. Compara `transacoes` com `farmer_transactions` por `transacao_id` (novo campo) ou por (`farmer_code`, `data`, `valor`, `produto`):
   - Novas, Diferentes, Em falta no ficheiro
4. Exporta CSV de divergências por categoria + KPIs no topo.

**Sem alterações de dados nesta fase.**

---

## Fase 2 — Atualizar saldos dos produtores existentes

Botão "Aplicar saldos" na página de reconciliação que executa em lote (chunks de 500) via Edge Function `apply-dataset-balances`:

- Para cada produtor com match: `UPDATE farmers SET valor_recebido = saldo_inicial, total_gasto = total_gasto_ficheiro, saldo_final = saldo_actual, updated_at = now() WHERE phone = produtor_id`
- Formatação PT-AO (`1.017.600,00`) consistente com a coluna `text`.
- Regista entrada em `farmer_balance_history` com `source = 'mosap3-pay-dataset'` e `gerado_em` do ficheiro.
- Auditoria em `audit_logs`.

---

## Fase 3 — Importar produtores em falta (~10)

Para os produtores presentes só no ficheiro:

- INSERT em `farmers` com:
  - `code = 'AGR-' + phone[3:]`
  - `phone`, `full_name`, `province`, `municipality`, `school` (eca), `gender`, `age`
  - `valor_recebido = saldo_inicial`, `total_gasto`, `saldo_final = saldo_actual`
  - `status = 'Ativo'`, `source = 'mosap3-pay-dataset'`
- Validação prévia: província/município/escola existem em `provinces`/`municipalities`/`schools`; caso contrário, mostrar lista para resolução manual antes de aplicar.

---

## Fase 4 — Importar transações em falta (~2.815)

Adicionar coluna `external_id text UNIQUE` a `farmer_transactions` para idempotência (= `transacao_id` do ficheiro).

Edge Function `import-dataset-transactions` (chunks de 1000):
- `INSERT ... ON CONFLICT (external_id) DO NOTHING`
- Campos: `external_id`, `farmer_code`, `product`, `empresa`, `valor` (PT-AO formatado), `valor_num`, `transaction_date` (data ISO do ficheiro), `categoria` (nova coluna opcional).

Backfill de `external_id` nas 70.379 linhas existentes deixa-se vazio (apenas as novas terão ID externo).

---

## Detalhes técnicos

```text
JSON → upload → reconciliacao-dataset (UI)
        ├─ Fase 1: diff em memória + CSVs
        ├─ Fase 2: Edge fn apply-dataset-balances (UPDATE farmers)
        ├─ Fase 3: Edge fn import-dataset-farmers   (INSERT farmers)
        └─ Fase 4: Edge fn import-dataset-transactions (INSERT farmer_transactions)
```

**Migrações necessárias:**
- `ALTER TABLE farmer_transactions ADD COLUMN external_id text UNIQUE`
- `ALTER TABLE farmer_transactions ADD COLUMN categoria text`
- `ALTER TABLE farmers ADD COLUMN source text` (se não existir)

**Edge Functions novas (com `x-bulk-secret`, service role):**
- `apply-dataset-balances`
- `import-dataset-farmers`
- `import-dataset-transactions`

**Memória relevante** (já existente, será respeitada):
- Saldo canónico = `computeSaldoFinal(valor_recebido, total_gasto)`
- Removidos contam em agregados — não filtrar
- Formato PT-AO em campos `text`

**Não incluído:** apagar transações/produtores que estão na BD mas não no ficheiro (apenas relatados na Fase 1 para revisão manual).

---

## Confirmação necessária antes de avançar

- O ficheiro carregado é a fonte canónica (sobrescreve a BD nos campos indicados)?
- Aceita carregar o JSON (19 MB) via página, ou prefere que seja colocado num bucket de storage e processado por Edge Function?