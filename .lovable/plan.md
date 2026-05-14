## Objectivo
Os KPIs e a tabela `/mosap3pay/cartoes-sim` já suportam visualmente os estados `Pré desactivado`, `Barrado` e `Removido`, mas a base de dados só tem `Activo` (13.741) e `Pendente` (1.425). Faltam os números do ficheiro **ALL_MOSAP (003).xlsx** com esses 3 estados.

## Pré-requisito
**Reenvie o ficheiro `ALL_MOSAP (003).xlsx`** anexado nesta conversa — o ficheiro partilhado anteriormente não está acessível no sandbox.

## Plano de execução

### 1. Inspecção do Excel (após receber ficheiro)
- Ler todas as folhas com `pandas`.
- Identificar coluna `Estado` (ou similar) e coluna do número de telefone (MSISDN).
- Listar contagens por estado e amostra de linhas para validação consigo antes de tocar na BD.

### 2. Normalização e mapeamento
- Mapear valores do Excel para os 5 estados canónicos da BD:
  - `Activo`, `Pendente`, `Pré desactivado`, `Barrado`, `Removido`.
- Normalizar telefone (remover espaços, prefixo `+244`, manter 9 dígitos finais).
- Match contra `farmers.phone` normalizado (chave escolhida).

### 3. Edge function `import-sim-status` (re-deploy)
- Corre em modo **dry-run** primeiro: devolve quantos foram encontrados, quantos não bateram, e contagem por novo estado.
- Após confirmação, aplica `UPDATE farmers SET sim_status = ?, sim_status_updated_at = now(), sim_status_source = 'ALL_MOSAP_xlsx'` em blocos de 50 (Core rule).
- Apenas **sobrepõe** estados quando o ficheiro tem informação explícita; agricultores não listados ficam intactos.

### 4. Verificação
- Re-correr `src/test/sim-kpis-reconciliation.test.ts` — soma dos KPIs deve continuar a bater com 15.166.
- Confirmar visualmente em `/mosap3pay/cartoes-sim` que os 3 novos cards passam a ter valores reais.
- Notificar com resumo: contagem antes/depois por estado e nº de não-correspondidos.

## Fora de âmbito
- Alterar o esquema da tabela `farmers` (já tem `sim_status`/`sim_status_source`).
- Mudar UI dos cards (já existe).
- Alterar lógica de reconciliação financeira.

## Detalhes técnicos
- Chave de match: `phone` normalizado para últimos 9 dígitos.
- Se um agricultor aparecer em mais que um estado no Excel, prevalece a última ocorrência (com aviso no relatório dry-run).
- `sim_status_source = 'ALL_MOSAP_xlsx'` distingue da fonte anterior `unitel_sim_status`.
