---
name: PATEC composição
description: Modelo normalizado PATEC em 5 tabelas (produtos, componentes, BOM, pacote-componente, expandido) + patec_items flat para retro-compatibilidade
type: feature
---
- Fonte de verdade: `PATECs_estruturado.xlsx`. 15 PATECs (PATEC-01..10 agrícolas, PATEC-11..15 pecuários).
- **Modelo normalizado** (novo, 2026-06-09):
  - `patec_products` — 189 produtos do catálogo mestre (`product_code` único).
  - `patec_components` — 20 componentes reutilizáveis (`component_code` único).
  - `patec_component_items` — BOM componente→produto (396 linhas).
  - `patec_package_components` — pacote→componente, com `is_optional` (65 ligações, 20 opcionais).
  - `patec_package_expanded` — vista materializada pacote→produto (1295 linhas, 190 opcionais). Usar este para POS/relatórios quando precisar de opcionais.
- **Tabela flat legacy**: `patec_items` (1195 linhas, sem opcionais nem componente) mantida para `PatecCompositionDialog` em /patec, POS e atribuição em lote. Backup em `patec_items_backup_20260609`.
- Mapeamento de códigos xlsx→BD: A01→01, A02→02, A03→03, A04→07, A05→04, A06→05, A07→09, A08→10, A09→08, A10→06, P01..P05→11..15.
- Pecuária não inclui irrigação (codificado nos próprios dados do xlsx, sem CMP-REG-* nos PATEC-Pxx).
- RLS: leitura para `authenticated`; escrita só admin / gestor_incentivos.
