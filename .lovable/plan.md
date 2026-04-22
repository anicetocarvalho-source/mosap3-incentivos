
## Importação dos 10 ficheiros Unitel Money para `valor_recebido`

Recebi 10 ficheiros CSV (formato Unitel Money Bulk Report) com os pagamentos efectivamente creditados aos agricultores via telefone. Vou consolidá-los e carregá-los como `valor_recebido` na base de dados, fazendo a correspondência por número de telemóvel.

## Ficheiros recebidos

| Ficheiro | Plano | Registos | Valor (Kz) |
|---|---|---|---|
| Mosap3_ECA_Omahano.csv | ECA Omahano | 2 | 1.628.160 |
| Mosap3_ECA_CUNENE.csv | ECA Cunene | 2.261 | 1.840.634.880 |
| CUNENA_CONTA_1.csv | Cunene Conta 1 | 2.261 | 230.079.360 |
| BulkReport_125646.csv | Huíla ECAS Kusseteca | 39 | 7.200.000 |
| Huila-ECAS-Kusseteca-Tchongolomatemba.csv | Huíla Conta 1 | 39 | 3.900.000 |
| CUANDO_CUBANGO.csv | Cuando Cubango 200k | 2.279 | 433.000.000 |
| CUANDO_CUBANGO_CONTA_1_50.csv | Cuando Cubango Conta 1 | 2.279 | 226.823.040 |
| NAMIBE.csv | Namibe 200k | 568 | 111.200.000 |
| HUÍLA.csv | Huíla 200k | 2.895 | 564.000.000 |
| BulkReport_126002.csv | Benguela 200k | 6.630 | 1.279.000.000 |
| **Total bruto estimado** | | ~19.253 linhas | **~4.697 milhões Kz** |

> Apenas linhas com `Status = Completed` / `Validation Result = Success` serão contabilizadas. As falhadas são ignoradas.

## O que vou fazer

### 1. Consolidação dos CSVs (script Python local, sem alterar BD)
- Ler os 10 ficheiros, extrair linhas a partir do cabeçalho `Record No,...`.
- Filtrar `Status = Completed`.
- Normalizar `Credit Msisdn` para os **últimos 9 dígitos** (remove o prefixo `244`), igual à lógica do `ImportValoresRecebidosDialog`.
- Agregar por telefone: `SUM(Amount)` quando o mesmo número aparece em vários ficheiros (ex: ECA Cunene + Cunene Conta 1 do mesmo agricultor).
- Gerar um único ficheiro consolidado `valores_recebidos_consolidado.xlsx` em `/mnt/documents/` com colunas `telefone | valor` (compatível com o template do diálogo).

### 2. Validação prévia contra a base de dados
- Cruzar telefones do consolidado com `farmers.phone` (via `supabase--read_query`).
- Reportar:
   - Nº de telefones com correspondência (match)
   - Nº de telefones sem agricultor associado
   - Total Kz que será efectivamente creditado vs. total Kz órfão
   - Top 10 agricultores por valor recebido
- Gerar `relatorio_validacao.xlsx` em `/mnt/documents/` com 2 folhas: `Match` e `Sem_Match`.

### 3. Aplicação na base de dados
- Migração SQL (UPSERT em `farmers.valor_recebido`) que actualiza apenas as linhas com match, em batches.
- O trigger `farmers_recalc_on_recebido` (já criado) recalcula automaticamente `saldo_final = valor_recebido − total_gasto` para cada agricultor afectado.
- Registar entrada em `audit_logs` (acção `bulk_import_valores_recebidos`, com totais).

### 4. Verificação pós-importação
- Re-executar query de totais (`SUM(parse_ptao_numeric(valor_recebido))`) e comparar com o total consolidado.
- Confirmar que `saldo_final` deixou de ser 0 nos agricultores carregados.
- Mostrar amostra de 10 agricultores com `valor_recebido > 0` e `saldo_final` resultante.

## Detalhes técnicos

- **Formato CSV Unitel**: cabeçalhos têm tabs/espaços extra (`"\tCompleted"`, `"\t1"`); o parser fará `trim()` em cada campo.
- **Normalização telefone**: `244976102804` → `976102804` (9 dígitos). A coluna `farmers.phone` na BD tem maioritariamente 9 dígitos; o matching faz `RIGHT(phone, 9)` em ambos os lados.
- **Agregação multi-ficheiro**: o agricultor `244976096393` aparece em ECA Cunene (814.080) + Cunene Conta 1 (101.760) = 915.840 Kz total recebido. Esta soma é o que entra em `valor_recebido`.
- **Formato BD**: `valor_recebido` é `text` em formato pt-AO (`'915.840,00'`); usar `to_char(valor, 'FM999G999G990D00')` na migração.
- **Idempotência**: a migração faz `SET valor_recebido = <novo>` (substitui, não soma), portanto pode ser re-executada sem duplicar.
- **Saldo negativo esperado**: agricultores com `total_gasto > valor_recebido` ficarão com `saldo_final` negativo — isto é correcto e será sinalizado a vermelho na ficha (já implementado no plano anterior).

## Entregáveis

1. `/mnt/documents/valores_recebidos_consolidado.xlsx` — ficheiro consolidado pronto a usar também via UI.
2. `/mnt/documents/relatorio_validacao.xlsx` — match vs. sem-match para revisão.
3. Migração SQL aplicada à BD.
4. Resumo final em chat: total carregado, nº de agricultores actualizados, nº de órfãos, top 10.

## Confirmações necessárias

- Avanço com **soma agregada por telefone** quando o mesmo número aparece em vários ficheiros (ex: ECA + Conta 1)? Sim por defeito.
- Telefones presentes nos CSVs mas **sem agricultor** na BD: ignorar e listar no relatório (não criar agricultores novos).
- `valor_recebido` actual será **substituído** (não somado) pelo total consolidado dos ficheiros — esta é a fonte oficial passa a ser estes 10 CSVs.
