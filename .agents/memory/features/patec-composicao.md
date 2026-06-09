---
name: PATEC composição
description: 15 PATECs (10 agrícolas + 5 pecuários) com 1195 itens em patec_items; dialog "Composição" em /patec
type: feature
---
- Tabela `patec_items` (categoria: agricultura | pecuaria | irrigacao | equipamento; subcategoria slug).
- 15 pacotes: PATEC-01..10 agrícolas (Milho+Feijão, Massango+Feijão, Massambala+Feijão, Mandioca+Feijão, Alho, Batata Doce, Batata Rena, Cebola, Cenoura, Repolho) + PATEC-11..15 pecuários (Aves, Bovinos, Caprinos, Ovinos, Suínos).
- Importado de `PATECs_estruturado.xlsx` (folha 06_Pacotes_Expandido) a 2026-06-09. Backup em `patec_items_backup_20260609`.
- Componentes "Opcionais" (Sementes Melhoradoras, Mudas) são tratados como Obrigatórios.
- Pecuária NÃO inclui o componente Sistema de Rega (excluído na importação).
- Dialog `PatecCompositionDialog` em `/patec` lê os itens dinamicamente; novos pacotes aparecem automaticamente em /patec, atribuição em lote e POS.
