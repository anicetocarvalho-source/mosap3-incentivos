# Unificar PATECs em todo o sistema

## Problema

O catálogo `/patec` mostra 15 PATECs (PATEC-01..15, agrícolas + pecuários) lidos da tabela `patecs` + composição em `patec_items`. Mas vários ecrãs ainda estão presos a uma versão antiga com apenas 3 pacotes hardcoded ("Milho / Massango / Massambala"). Isto causa nomes diferentes, opções em falta e composição divergente.

## Fonte de verdade

- **Lista de pacotes e nomes**: `usePatecs({ activeOnly: true })` → `patecs` da BD. Formato visual unificado: `{code} — {cultures || name}` (mesmo que no `PatecsTab`).
- **Composição de itens**: `patec_items` filtrado por `patec_number` (já é a fonte usada pelo POS).
- **Filtros/selects**: opções vêm de `patecs`, não de constantes 1..3.

## Ficheiros a alterar (apenas UI/labels, sem mexer em regras de negócio)

1. **`src/pages/Mosap3PayPOS.tsx`**
   - Remover constante `patecLabels` hardcoded (3 entradas).
   - Carregar pacotes via `usePatecs({ activeOnly: true })`.
   - Helper `patecLabelFor(patecNumber)` → procura no array por `legacy_number` e devolve `"{code} — {cultures}"`; fallback `"PATEC {n}"`.
   - Substituir todas as 6 ocorrências de `patecLabels[...]` (linhas ~1718, 1808, 1876, 1946, 2121, 2420) pelo helper.

2. **`src/pages/FarmerProfile.tsx`**
   - Substituir `patecOptions` hardcoded (1/2/3) por opções derivadas de `usePatecs({ activeOnly: true })` — `value = code`, `label = "{code} — {cultures}"`.
   - Substituir o bloco `patecData` hardcoded (linhas ~959-984) por leitura dinâmica: ler `patecs` (para título/cultures) + `patec_items` filtrado por `patec_number = patecNum` para mostrar a composição real (mesma que `PatecCompositionDialog` usa em /patec).
   - O guardar continua a aceitar tanto `code` como `legacy_number` (já é o que `FarmerRegistrationForm` faz na linha 198-200).

3. **`src/pages/Agricultores.tsx`**
   - Substituir os 3 `<SelectItem>` hardcoded (linhas 330-332) por map sobre `usePatecs({ activeOnly: true })`.
   - Filtro `q.eq("patec", Number(filterPatec))` continua válido (valores numéricos = `legacy_number`); manter "all" e "none".
   - Badge na tabela passa a mostrar o `code` do PATEC quando disponível (em vez de `PATEC {n}`), via lookup local.

4. **`src/lib/formValidation.ts`**
   - Trocar `regex(/^[1-3]$/)` por validação contra a lista actual de PATECs activos (string não vazia). Deixar o componente do formulário garantir que o valor é um dos `patecs[].code` ou `legacy_number`.

5. **`src/components/agricultores/BulkImportDialog.tsx`**
   - Substituir `![1,2,3].includes(row.patec)` por validação contra `patecs[].legacy_number` (lista carregada via `usePatecs`).

6. **`src/pages/fornecedor/FornecedorVendas.tsx`** (cosmético)
   - `PATEC ${s.patec_number}` → usar mesmo helper/label do POS para mostrar `{code} — {cultures}` (fica consistente com recibos).

## Fora de scope

- Sem migrações de BD. `patecs`, `patec_items` e `farmers.patec / patec_code` já existem com os dados certos.
- Sem alterações ao /patec, à composição na BD, nem a regras de bloqueio do POS.
- Testes que ainda esperam apenas 1-3 (`farmer-registration.test.ts`, `pos-sale-flow.test.ts`) ficam a falhar — actualizar mocks para usar a lista carregada via `usePatecs`.

## Resultado esperado

Em qualquer ecrã (POS, Perfil do Produtor, lista de Agricultores, Importação em lote, Vendas do Fornecedor, Recibos), a lista de PATECs disponíveis, os nomes apresentados e a composição mostrada passam a ser exactamente os mesmos que aparecem em `/patec` — incluindo os pacotes pecuários PATEC-11..15.
