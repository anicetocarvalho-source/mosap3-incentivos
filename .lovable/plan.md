## Objetivo

Três melhorias relacionadas ao módulo de Produtos / PATEC / POS:

1. Padronizar **selector de unidade** em todos os formulários.
2. **Catálogo, Stock e Análise de Preços** devem sinalizar/filtrar produtos em função dos pacotes PATEC.
3. **Modo Kiosk do POS** com toda a informação útil já visível.

---

### 1. Selector de Unidade padronizado

Criar uma fonte única de unidades em `src/lib/units.ts`:

```ts
export const UNIT_OPTIONS = [
  { value: "Kg", label: "Quilograma (Kg)" },
  { value: "g", label: "Grama (g)" },
  { value: "L", label: "Litro (L)" },
  { value: "ml", label: "Mililitro (ml)" },
  { value: "un", label: "Unidade (un)" },
  { value: "Saco", label: "Saco" },
  { value: "Caixa", label: "Caixa" },
  { value: "Feixe", label: "Feixe" },
  { value: "Cabeça", label: "Cabeça" },
  { value: "Dose", label: "Dose" },
  { value: "Metro", label: "Metro (m)" },
  { value: "Hectare", label: "Hectare (ha)" },
];
```

Substituir `<Input value=unit>` por `<Select>` (com opção "Outro…" que mostra Input livre) em:

- `FornecedorProdutos.tsx` (criar/editar produto)
- `Mosap3PayStock.tsx` (edição rápida)
- `FornecedorStock.tsx` (edição rápida)
- `PatecCompositionDialog.tsx` (add item, edição rápida e full edit)
- `LivestockRegistrationForm.tsx`, `ProductionRegistrationForm.tsx`, `ParcelRegistrationForm.tsx` (rever campos de unidade onde existirem)

Texto livre é mantido para retro-compatibilidade (DB ainda guarda string).

---

### 2. Catálogo / Stock / Preços respeitar PATEC

Criar hook `usePatecCatalogIndex()` que carrega de `patec_items` os pares `(name, unit)` (normalizados) e devolve:

- `Set<string>` de chaves `name|unit` que existem em algum PATEC
- mapa `name → patec_codes[]` para mostrar badges

Aplicar em:

- **`FornecedorProdutos.tsx`** (Catálogo): badge "Em PATEC: 1,2" ou "Fora de PATEC" em cada linha; filtro topo `[Todos | Apenas PATEC | Fora de PATEC]`.
- **`Mosap3PayStock.tsx`** e **`FornecedorStock.tsx`**: mesmo filtro + badge; alerta visual quando produto fora de PATEC tem stock.
- **`Mosap3PayAnalisePrecos.tsx`**: coluna extra "PATEC" mostrando códigos vinculados e filtro `Apenas em PATEC`.

Nenhuma alteração de schema. Apenas leitura cruzada client-side com cache via React.

---

### 3. Revisão do Modo Kiosk do POS

Em `Mosap3PayPOS.tsx` (bloco `if (kioskMode)`):

**Cards de produto**
- Mostrar `stock` disponível e `unit` por baixo do nome.
- Badge "PATEC ✓" quando produto pertence ao PATEC do produtor identificado.
- Badge "Já levantado" + qty quando item PATEC já foi consumido nesta época.
- Desabilitar card quando `stock <= 0`.

**Topbar do carrinho / sidebar direita**
- Bloco fixo "Produtor activo" com: nome, código, PATEC, saldo recebido / gasto / disponível (FarmerSaldoBadge variant kiosk já existe — destacar).
- Vendedor + Turno + Fornecedor sempre visíveis no header.

**Checklist PATEC**
- Painel colapsável "Itens do PATEC" listando todos `patec_items` do PATEC do produtor com estado: ✓ Levantado / ◯ Pendente, baseado em vendas anteriores desta época.

**Atalhos**
- Manter o cartão de atalhos já existente; adicionar `F2` (focar identificação produtor) e `F3` (toggle checklist PATEC).

Nenhuma alteração de schema. Apenas UI + queries adicionais (`pos_sales` da época + `patec_items` do produtor).

---

## Ordem de execução

1. `src/lib/units.ts` + `UnitSelect` component reusável
2. Substituições nos formulários (item 1)
3. Hook `usePatecCatalogIndex` + integração Catálogo / Stock / Preços (item 2)
4. Refactor visual do Kiosk + checklist PATEC + badges (item 3)

Confirmação no fim com leitura do build / preview.
