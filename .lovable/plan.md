# Corrigir cálculo do Saldo Final no resumo financeiro

## Problema

O "Saldo Final" no resumo financeiro de Províncias e ECAs é atualmente obtido somando o campo `saldo_final` da tabela `farmers`, que pode trazer valores negativos.

Pretende-se que o Saldo Final seja **sempre** calculado como `Total Recebido − Total Gasto` e **nunca** negativo (mínimo 0).

## Alterações propostas

### 1. `src/hooks/useFinancialSummary.ts`
- Deixar de acumular `saldo_final` da BD.
- Calcular o saldo derivado: `saldo = Math.max(0, recebido - gasto)`.
- Remover `saldo_final` do `select` e do tipo `FarmerRow`.
- Manter `recebido`, `gasto`, `beneficiarios`, `totalFarmers` e `utilizationPct` como estão.

### 2. `src/components/FinancialSummaryCards.tsx`
- Remover a lógica de "saldo negativo":
  - `valueClass` do cartão Saldo Final passa a ser sempre `"text-foreground"`.
  - `hint` passa a ser sempre `"Disponível"`.

## Resultado esperado

Em Província e ECA, o cartão **Saldo Final** mostra exatamente `Total Recebido − Total Gasto`, com mínimo de 0 Kz.