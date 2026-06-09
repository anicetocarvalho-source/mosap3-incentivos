## Problema

O modelo normalizado tem **CMP-REG-01 (Sistema de Rega)** ligado a todos os PATECs pecuários (11–15), o que viola a regra de negócio "pecuária não inclui irrigação". O `patec_items` (lido pelo diálogo /patec) **já está correcto**.

Estado actual vs. esperado:

| Tabela | Actual | Esperado |
|---|---|---|
| `patec_package_components` (livestock) | 3 componentes cada (EQP + PEC + REG) | **2** (EQP + PEC) |
| `patec_package_expanded` total | 1295 | **1195** |
| CMP-REG-01 ligações | 15 PATECs | **10** (só agrícolas) |

## Objectivo

Remover Sistema de Rega dos PATECs pecuários no modelo normalizado, alinhar os baselines da rotina de consistência, manter `patec_items` intacto.

## Passos

1. **Apagar dados errados** (`supabase--insert`, em ordem inversa de FK):
   - `DELETE FROM patec_package_expanded WHERE patec_id IN (livestock PATECs) AND component_id = CMP-REG-01` → remove 100 linhas (20 × 5).
   - `DELETE FROM patec_package_components WHERE patec_id IN (livestock PATECs) AND component_id = CMP-REG-01` → remove 5 linhas.
   - Critério: `patec_id IN (SELECT id FROM patecs WHERE code IN ('PATEC-11','PATEC-12','PATEC-13','PATEC-14','PATEC-15'))`.

2. **Actualizar baselines da rotina diária** (`supabase--insert`, em `patec_consistency_baseline`):
   - Para livestock PATECs: `expected_components -= 1`, `expected_expanded -= 20`.
   - `expected_optional_components` e `expected_expanded_optional` permanecem 0.
   - `patec_global_baseline.expected_total_items` permanece 396 (não mexemos em `patec_component_items` — CMP-REG-01 mantém os seus 20 produtos no catálogo BOM, só deixa de estar ligado a pecuária).

3. **Verificar**:
   - Contagens: `patec_package_components` = 60, `patec_package_expanded` = 1195.
   - CMP-REG-01.`used_in_packages` = 10.
   - `SELECT public.run_patec_consistency_check('manual-after-fix')` → 0 divergências.

4. **Memória**:
   - Reforçar Core rule: "Pecuária não inclui irrigação. PATECs 11–15 não devem referenciar CMP-REG-01."
   - Actualizar `mem://features/patec-composicao` com totais novos (60 ligações, 1195 expanded).

## Fora do âmbito

- Não tocar em `patec_items` (já correcto).
- Não apagar `patec_components` CMP-REG-01 nem os seus 20 `patec_component_items` (continuam a servir os 10 PATECs agrícolas).
- Não alterar UI nem rotina de consistência (apenas baselines).
- Não modificar o ficheiro xlsx (continua como referência histórica, com nota de discrepância na memória).
