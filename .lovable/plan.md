

## Causa raiz

Os 4 cards (Incentivos Recebidos, Compras, Saldo, Taxa de Utilização) estão a ler das tabelas **`farmer_incentives`** e **`pos_sales`** — mas estas tabelas estão **vazias** na base de dados:

| Tabela | Total de registos | Para AGR-10619 |
|---|---|---|
| `farmer_incentives` | **0** | 0 |
| `pos_sales` | **0** | 0 |
| `farmer_transactions` | 70.394 | 12 |
| `farmers.valor_recebido` (AGR-10619) | 198.700 Kz | — |

Ou seja: os dados que vês "carregados para cada agricultor" estão guardados em **dois sítios legados**:

1. **Campos de texto na própria tabela `farmers`** (`valor_recebido`, `total_gasto`, `saldo_final`) — são os 198.700 Kz que vês no header e na tabela de Agricultores.
2. **Tabela `farmer_transactions`** — 70 mil linhas de transações históricas (a antiga aba "Incentivos" mostrava-as).

A nova aba "Financeiro" (resultado da fusão anterior) só agrega `farmer_incentives` + `pos_sales`, que ainda **nunca foram alimentadas em massa**. Por isso mostra zeros.

## Como corrigir

Há duas formas. Recomendo **fazer ambas**:

### A) Corrigir o cálculo dos cards para incluir os dados legados

No `FarmerProfile.tsx` (aba Financeiro, linhas ~696–699), passar a calcular:

- **Incentivos Recebidos** = soma de `farmer_incentives.amount` **+** `farmers.valor_recebido` (legado, se não houver registos em `farmer_incentives`).
- **Compras Realizadas** = soma de `pos_sales.total` **+** soma de `farmer_transactions.valor` (legado).
- **Saldo** = Recebido − Compras (ou usar `farmers.saldo_final` quando não há POS nem incentivos novos).
- **Taxa Utilização** = Compras / Recebido × 100.

Lógica de fallback: se `farmer_incentives` e `pos_sales` ambos vazios → usa os campos legados de `farmers` + `farmer_transactions`. Se houver dados novos → usa preferencialmente os novos mas continua a somar os legados para não perder histórico.

A timeline já inclui `transactions` (do `farmer_transactions`), por isso os movimentos individuais já aparecem — só os 4 cards é que estavam a ignorá-los.

### B) (Opcional, futuro) Backfill da BD

Migração que copia o histórico de `farmer_transactions` para `pos_sales` (ou cria registos sintéticos em `farmer_incentives` a partir de `farmers.valor_recebido`). Recomendo **não fazer agora** — é destrutivo e os campos legados continuam fonte de verdade no header e na tabela.

## Alteração proposta

**Ficheiro único:** `src/pages/FarmerProfile.tsx` (linhas 696–699 e badge de estado linhas 781–793).

```ts
// Helper para parser pt-AO ("198.700,00" → 198700)
const parsePtAo = (s: string | null | undefined) => {
  if (!s) return 0;
  return parseFloat(String(s).replace(/\./g, "").replace(",", ".")) || 0;
};

const totalIncentivosNovos = incentives.reduce((s, i) => s + parseFloat(i.amount || "0"), 0);
const totalIncentivosLegado = parsePtAo(farmerRaw?.valor_recebido);
const totalIncentivos = totalIncentivosNovos + (totalIncentivosNovos === 0 ? totalIncentivosLegado : 0);

const totalComprasPos = posSales.reduce((s, v) => s + Number(v.total || 0), 0);
const totalComprasManuais = transactions.reduce((s, t) => s + parsePtAo(t.valor), 0);
const totalCompras = totalComprasPos + totalComprasManuais;

const saldo = totalIncentivos - totalCompras;
const percentUsado = totalIncentivos > 0 ? Math.min((totalCompras / totalIncentivos) * 100, 100) : 0;
```

E ajustar o subtítulo do card de Compras para indicar `posSales.length + transactions.length compra(s)`.

## Resultado esperado para AGR-10619

- Incentivos Recebidos: **198.700 Kz** (vinha de `valor_recebido`)
- Compras: soma das 12 transações em `farmer_transactions`
- Saldo: diferença real
- Taxa: % real

Sem migrações, sem perder histórico, sem partir nada nos perfis que já usem POS/incentivos novos.

