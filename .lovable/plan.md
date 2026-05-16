
# Plano de revisão de dados — pós-reconciliação

Baseado em queries directas à base de dados depois do `apply-xlsx-corrections`. Apresento o diagnóstico real, o impacto em cada página, e as correcções propostas — **sem tocar em dados ainda**.

---

## 1. Diagnóstico (estado actual)

| Métrica | Valor |
|---|---|
| Total de produtores | 15.166 |
| Sem BI preenchido | **15.166 (100%)** |
| Sem género | **15.166 (100%)** |
| Sem ECA | 4.275 |
| Sem PATEC | 4.261 |
| Sem província / município / telefone | 0 ✓ |
| Telefones duplicados (activos) | 0 ✓ |
| BIs duplicados (activos) | 0 ✓ |
| `farmer_incentives` / `pos_sales` / `credit_notes` | **0 / 0 / 0** |
| Órfãos totais / já ligados / por ligar | 3.727 / 3.387 / 340 |
| Match telefone órfãos ↔ farmers (não ligados) | 0 |
| **Valores numéricos com formato misto** (`200.000,00` em recebido vs `200,000.00` em gasto/saldo) | **14.501** |

### Bug crítico detectado

O `apply-xlsx-corrections` reescreveu `valor_recebido` no formato PT (`200.000,00`) mas o `recalc_farmer_totals` mantém `total_gasto` e `saldo_final` no formato EN (`200,000.00`). Resultado: **14.501 fichas com formatos inconsistentes na mesma linha**. O `parseAmount` lida com ambos, mas qualquer export, ordenação alfabética ou cálculo regex pode partir.

---

## 2. Auditoria por página

### `/agricultores` (Lista)
- **OK**: 15.166 fichas, sem duplicados, província preenchida.
- **Risco**: ordenação por valor falha porque os campos são `text` com formatos misturados. Visual: cards mostram valores correctos (parseAmount aceita ambos), mas o CSV export sai inconsistente.

### `/agricultores/[code]` (FichaProdutor)
- **OK**: `computeSaldoFinal(valor_recebido, total_gasto)` recalcula em runtime → saldo apresentado é correcto.
- **A confirmar**: 14.501 fichas têm `saldo_final` persistido em formato EN — se algum sítio ler directamente da coluna sem `parseAmount`, fica errado.

### Dashboard (`/`)
- KPI `total_recebido` e `total_gasto` vêm da RPC `dashboard_kpis`. **Precisa validar** se a função SQL faz parse robusto dos dois formatos. Se não, os totais aparecerão metade em milhões, metade em centenas.

### `/relatorios` e cards financeiros (`useFinancialSummary`, `EcaBalanceTable`)
- Usam `parseAmount` no cliente → resistentes a ambos os formatos. ✓
- Removidos contam (constraint do projeto). ✓

### `/anomalias`
- **Esperado**: 340 órfãos restantes sem match (já confirmado, 0 ligáveis por telefone).
- **A reavaliar**: detecção de "saldo negativo" e "valores fora dos escalões" com formato EN pode dar falsos positivos.

### `/telefones-orfaos`
- 340 entradas sem `linked_farmer_code`, valor médio 692k Kz. Match por similaridade de nome (Levenshtein) ainda não tentado.

### MOSAP3Pay (POS, Stock, Facturas, Notas, Vendas, Reconciliação)
- **Vazio**: 0 vendas, 0 notas, 0 facturas, 0 incentivos formais. Páginas funcionam mas não têm dados para validar — todo o histórico financeiro vive apenas nos 2 campos de texto de `farmers`.

### `/escolas/auditoria`, `/patec`, `/parcelas`, `/producao`, `/pecuaria`
- Sem dependência directa do UPDATE recente. Auditoria recomendada de coerência (contagens vs Lista) já está coberta pelos testes de paridade existentes.

---

## 3. Correcções propostas (por prioridade)

### P1 — Normalizar formato numérico (BUG crítico)
Edge function `normalize-farmer-amounts` que:
- Lê todos os 15.166 farmers
- Converte `valor_recebido`, `total_gasto`, `saldo_final` para um **formato canónico único**: PT-AO `1.234.567,89` (consistente com o resto do UI)
- Usa `parseAmount` (já tolerante a ambos) → re-formata com `formatAmount`
- Recalcula `saldo_final = valor_recebido − total_gasto`
- Escreve em chunks de 500

**Impacto**: corrige as 14.501 inconsistências sem alterar valores reais.

### P2 — Reconciliar 340 órfãos restantes
Como o match por telefone já está esgotado:
- Edge function `match-orphans-by-name` que cruza `orphan_phones` não ligados com `farmers` via similaridade de nome (Jaro-Winkler ≥ 0,9) na mesma província.
- Gera CSV `orfaos_candidatos_match.csv` para revisão manual antes de qualquer link.
- Não escreve em DB sem aprovação.

### P3 — Sanitização de `farmer_balance_history`
Confirmar que o histórico gerado pelo UPDATE em massa não duplicou linhas (tem 4.706 + 765 entries esperadas). Query de auditoria + CSV.

### P4 — Validar RPCs do Dashboard com formato misto
`code--view` em `dashboard_kpis` / `dashboard_charts` (SQL) para garantir que o parser numérico aceita `1.234,56` e `1,234.56`. Se não, criar migração para usar a mesma lógica de `parseAmount`.

### P5 — Relatório consolidado
Gerar em `/mnt/documents/`:
- `auditoria_resumo.csv` — métricas por página
- `auditoria_inconsistencias.csv` — fichas com problemas (formato, sem ECA, sem PATEC)
- `auditoria_orfaos_candidatos.csv` — matches sugeridos por nome

### Fora de âmbito (não tocar)
- Campos sempre vazios (BI, género): foram nunca preenchidos no cadastro em massa, **não é regressão** do UPDATE.
- Sem ECA/PATEC: 4.275 fichas — requer decisão de negócio, não correcção automática.

---

## Detalhes técnicos

```text
P1 normalize-farmer-amounts
  ├─ SELECT code, valor_recebido, total_gasto FROM farmers
  ├─ Para cada: vr = parseAmount(...); tg = parseAmount(...); sf = vr - tg
  ├─ UPDATE farmers SET
  │     valor_recebido = formatAmount(vr),  -- "200.000,00"
  │     total_gasto    = formatAmount(tg),
  │     saldo_final    = formatAmount(sf)
  └─ Chunks de 500, log de erros, idempotente

P2 match-orphans-by-name
  ├─ Para cada órfão sem link:
  │   buscar farmers na mesma província com sim(nome) >= 0.9
  ├─ Output CSV: orphan_id, phone, valor, candidato_code, candidato_nome, score
  └─ Sem UPDATE — apenas relatório

P4 dashboard_kpis (a verificar)
  └─ Se SUM(valor_recebido::numeric) → falha em "1.234,56".
     Solução: SUM(parse_amount_text(valor_recebido)) com função SQL helper.
```

Após aprovação, executo P1 → P2 → P3 → P4 → P5 nessa ordem, parando entre cada para mostrares os relatórios.
