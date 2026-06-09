## Objectivo

Substituir os 631 itens actuais de `patec_items` pela composição expandida do ficheiro `PATECs_estruturado.xlsx`, acrescentando os 5 PATECs pecuários (P01..P05) que ainda não existem na BD. Os opcionais são tratados como obrigatórios (sem nova coluna). Os PATEC de Pecuaria, não devem estar necessariamente anexado a irrigação. Digo ele pode fazer pecuaria sem necessidade de irrigar 1 hectare

## Mapeamento de códigos xlsx → BD

Mantemos os códigos `PATEC-01..PATEC-10` para não partir referências em `farmers.patec_code` e em `farmer_incentives`. Os pecuários entram como `PATEC-11..PATEC-15`.


| xlsx      | Cultura             | BD              |
| --------- | ------------------- | --------------- |
| PATEC-A01 | Milho + Feijão      | PATEC-01        |
| PATEC-A02 | Massango + Feijão   | PATEC-02        |
| PATEC-A03 | Massambala + Feijão | PATEC-03        |
| PATEC-A04 | Batata-rena         | PATEC-07        |
| PATEC-A05 | Mandioca + Feijão   | PATEC-04        |
| PATEC-A06 | Alho                | PATEC-05        |
| PATEC-A07 | Cenoura             | PATEC-09        |
| PATEC-A08 | Repolho             | PATEC-10        |
| PATEC-A09 | Cebola              | PATEC-08        |
| PATEC-A10 | Batata-doce         | PATEC-06        |
| PATEC-P01 | Aves                | PATEC-11 (novo) |
| PATEC-P02 | Bovinos             | PATEC-12 (novo) |
| PATEC-P03 | Caprinos            | PATEC-13 (novo) |
| PATEC-P04 | Ovinos              | PATEC-14 (novo) |
| PATEC-P05 | Suínos              | PATEC-15 (novo) |


## Passos

1. **Snapshot de segurança** — `CREATE TABLE patec_items_backup_YYYYMMDD AS SELECT * FROM patec_items;` (migration).
2. **Inserir 5 pecuários em `patecs**` — `PATEC-11..15` com `legacy_number=11..15`, `is_active=true`, ícone/cor adequados.
3. **Gerar SQL de importação** a partir da folha `06_Pacotes_Expandido`:
  - Ler o xlsx com Python (openpyxl).
  - Para cada linha: aplicar o mapeamento de código, normalizar `name`/`category`/`subcategory`/`unit`, `base_quantity = Quantidade`, `culture` derivada do componente (ou do nome do pacote para pecuária).
  - Produzir um único script `supabase--insert` com `DELETE FROM patec_items` + `INSERT` em lotes de 50 linhas (regra do projecto).
4. **Atribuir `patec_number**` — manter compatibilidade: usar o `legacy_number` do PATEC correspondente.
5. **Verificação** — contar itens por PATEC e comparar com o xlsx; spot-check 3 pacotes (1 agrícola + 1 pecuário + Mandioca que mudou de código).
6. **UI** — nenhuma alteração de código planeada. O dialog `PatecCompositionDialog` em `/patec` já lista os itens dinamicamente a partir de `patec_items`. Os 5 novos PATECs aparecerão automaticamente em `/patec`, na atribuição em lote e no POS.
7. **Memória** — actualizar `mem://features/patec-composicao` para reflectir "15 PATECs (10 agrícolas + 5 pecuários) com ~1295 itens".

## Riscos & mitigações

- **Quebra de referências de produtores**: mitigada ao reutilizar `PATEC-01..10`.
- **Itens órfãos em `supplier_products` ligados a antigos `patec_items**`: o vínculo PATEC↔catálogo é feito por nome de produto (`patecCatalogIndex`), não por FK — a substituição é segura.
- **Quantidades pendentes (linhas amarelas no xlsx)**: importadas com `base_quantity=0` quando vazias; comportamento actual do POS já tolera isto.

## Fora do âmbito

- Não criamos novas tabelas (produtos mestre / componentes). Modelo permanece flat em `patec_items`.
- Opcionais não recebem flag `is_optional` (decisão do utilizador).
- Não há alterações ao módulo de épocas (`patec_seasons`) — os 5 novos pacotes ficam disponíveis para serem vinculados manualmente a uma época depois.