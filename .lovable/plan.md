## Objectivo

Popular a tabela `supplier_products` para que todos os 12 fornecedores activos disponham do catálogo completo dos PATEC, permitindo testar de ponta a ponta o fluxo de venda no POS (validação de saldo, IVA, séries fiscais, abate de stock e Notas de Crédito).

## Dados base

- 12 fornecedores activos (`suppliers.status = 'Ativo'`).
- 117 nomes distintos de itens em `patec_items` (agregando duplicados como Amoxacilina/Amoxaclina/Amoxicilina e Bronquite/Bronquiti Infecciosa).
- `supplier_products` actualmente vazio (0 registos).

## O que será feito (uma única migração de dados, via `supabase--insert`)

1. **Inserir 117 produtos × 12 fornecedores = 1.404 linhas** em `supplier_products`, via `INSERT ... SELECT` que faz o produto cartesiano de:
   - `suppliers` activos
   - itens distintos de `patec_items` (DISTINCT por `name`, agregando `category`/`subcategory`/`unit`/`patec_number` mais frequentes).
2. **Mapeamento de colunas:**
   - `name` ← `patec_items.name`
   - `description` ← `"Item PATEC — <subcategory>"`
   - `category` ← `'insumos'` (fixo) e `patec_category` ← `patec_items.category` (agricultura/pecuaria)
   - `unit` ← `COALESCE(patec_items.unit, 'un')`
   - `price` ← **1000** Kz
   - `stock` ← **1000**
   - `min_stock` ← `5` (default)
   - `iva_rate` ← `14.00`
   - `patec_number` ← número PATEC mais comum do item (para o ecrã POS marcar "do pacote do produtor")
   - `status` ← `'Ativo'`
3. **Idempotência**: a query usa `ON CONFLICT DO NOTHING` num índice `(supplier_id, lower(name))` — para isso, primeiro criamos esse índice único via migração curta, e só depois executamos o INSERT. (Permite re-correr o seed sem duplicar.)

## Como verificar

- Após o INSERT: `SELECT COUNT(*) FROM supplier_products` ⇒ esperado 1.404.
- Abrir `/mosap3pay/pos` (Terminal POS) com um agricultor que tenha saldo e PATEC atribuído → confirmar:
  - Catálogo lista os produtos com badge "Do pacote".
  - Adicionar item → calcula IVA 14% e abate saldo.
  - Stock decrementa após emissão de Factura (Série FT).
  - Nota de Crédito (Série NC) repõe saldo.

## Notas

- Apenas seed de dados — não há alterações de UI, RLS ou edge functions.
- Caso prefiras preços diferenciados por categoria mais à frente (ex.: sementes vs. medicamentos), fica trivial fazer um UPDATE posterior.
