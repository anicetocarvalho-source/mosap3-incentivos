# Catálogo Central PATEC → Stock & Vendas

## Objectivo
Garantir que os produtos disponíveis para gestão de **Stock** e **Vendas** (POS) no MOSAP3Pay e no Portal do Fornecedor saem **directamente da composição dos PATECs**. No registo, o fornecedor passa a partir de uma lista pré-definida (catálogo PATEC) em vez de criar produtos do zero.

## Estado actual
- `patec_items` já contém a composição oficial (10 PATECs, 631 itens). 
- `supplier_products` é livre — o fornecedor digita nome/categoria à mão. Já existe um botão "Importar do PATEC" em `FornecedorProdutos.tsx`, mas é opcional e a entrada manual ainda é o caminho por defeito.
- Stock (`FornecedorStock.tsx`) e POS lêem `supplier_products`. Logo, se o produto não corresponder ao nome em `patec_items`, fica "Fora de PATEC" e não conta para validação no POS/PATEC.

## Mudanças propostas

### 1. Registo de produto guiado pelo catálogo PATEC (Portal do Fornecedor)
Em `src/pages/fornecedor/FornecedorProdutos.tsx`:
- Substituir o diálogo "Novo Produto" por um **selector do catálogo PATEC**:
  - Passo 1: escolher PATEC (1–10).
  - Passo 2: escolher item da composição (autocomplete sobre `patec_items` filtrado pelo PATEC).
  - Pré-preenche `name`, `category`, `patec_number`, `patec_category`, `unit` (de `patec_items.unit`).
  - Fornecedor só edita `iva_rate`, `max_per_farmer_per_season`, `description` e (depois) preço/stock.
- Manter botão **"Adicionar fora do catálogo"** secundário (admin/uso excepcional) com aviso "Produto fora de PATEC — não elegível para incentivos".
- Continuar a permitir a importação em massa por PATEC já existente.

### 2. Catálogo unificado no MOSAP3Pay
Em `src/pages/Mosap3PayStock.tsx` e `Mosap3PayPOS.tsx`:
- Já lêem `supplier_products`. Não muda a fonte, mas adicionar **badge "PATEC X" / "Fora de PATEC"** consistente (reusar `usePatecCatalogIndex`) na listagem de stock.
- Filtro rápido "Apenas catálogo PATEC" nas listas de stock e POS (sem alterar dados).

### 3. Onboarding do fornecedor
- Em `FornecedorDashboard.tsx`, quando o catálogo do fornecedor estiver vazio, mostrar CTA "Importar catálogo PATEC" (abre o diálogo de importação já existente e pré-selecciona todos os itens). Reduz o atrito inicial.

### 4. Integridade
- **Sem mudanças de schema** nesta fase. `supplier_products` continua a tabela operacional (preço/stock são por fornecedor).
- Match PATEC ↔ produto continua por nome normalizado via `usePatecCatalogIndex` (já existente).

## Fora de âmbito
- Não criar uma nova tabela "produtos globais" — `patec_items` já cumpre esse papel.
- Não alterar regras de validação PATEC no POS (mantém-se).
- Não migrar produtos existentes "Fora de PATEC" — ficam visíveis com badge de aviso.

## Detalhes técnicos
- Ficheiros tocados: `FornecedorProdutos.tsx`, `FornecedorDashboard.tsx`, `Mosap3PayStock.tsx`, `Mosap3PayPOS.tsx`.
- Reusar: `usePatecCatalogIndex`, `usePatecLabel`, `UnitSelect`.
- Sem migrações SQL, sem novas RLS.
- Validação: build + abrir `/fornecedor/catalogo` e verificar fluxo guiado.

Aprovas para implementar?
