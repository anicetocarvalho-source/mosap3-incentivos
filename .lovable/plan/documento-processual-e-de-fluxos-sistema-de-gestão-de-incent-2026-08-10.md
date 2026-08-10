# Documento Processual e de Fluxos — Sistema de Gestão de Incentivos (MOSAP3)

## Objetivo
Produzir um documento em Markdown (PT-AO) com a descrição processual completa do sistema e um conjunto de fluxogramas Mermaid em máximo detalhe, cobrindo o ciclo ponta-a-ponta: desde a compra no terminal POS até à componente administrativa, de controlo e monitorização.

## Entregáveis
Pasta `/mnt/documents/documentacao-processual/` com:

1. `00-documento-processual.md` — documento principal (descrição de todos os módulos, atores, regras de negócio, estados, integrações).
2. Diagramas `.mmd` individuais (visualizáveis no chat), referenciados a partir do documento:
   - `01-fluxo-macro.md` — visão ponta-a-ponta (registo do produtor → incentivo → compra → factura → reconciliação → relatórios).
   - `02-controlo-compras.mmd` — POS/venda, validação de saldo e PATEC, stock, pagamento Unitel Money, factura FT, nota de crédito NC.
   - `03-controlo-precos.mmd` — catálogo PATEC como fonte única, preços por fornecedor, deteção de desvios/variações abruptas, revisão de alertas.
   - `04-gestao-utilizadores.mmd` — criação de contas, atribuição de papéis (9 níveis RBAC), matriz de permissões por módulo, âmbito geográfico, vendedores do fornecedor com PIN + turnos.
   - `05-incentivos-patec.mmd` — períodos agrícolas, pacotes PATEC e composição, atribuição individual/lote/região, saldo canónico do produtor.
   - `06-fornecedores.mmd` — candidatura, aprovação, lojas, catálogo/stock, terminais POS.
   - `07-fiscal-agt.mmd` — séries FT/NC, SAF-T (AO), auditoria fiscal.
   - `08-monitorizacao.mmd` — dashboard, relatórios, anomalias, auditoria, diagnóstico de erros, notificações.
   - `09-swimlanes-rbac.mmd` — swimlanes por perfil (produtor, extensionista, vendedor, fornecedor, gestor de incentivos, administrador).
   - `10-estados-documentos.mmd` — máquina de estados de venda/factura/nota de crédito/pagamento.
   - `11-sincronizacao-offline.mmd` — PWA offline-first, IndexedDB, SyncQueue, resolução de conflitos.

## Método
- Levantamento a partir do código existente: rotas em `App.tsx`, guardas RBAC, páginas MOSAP3Pay, portal do fornecedor, módulo PATEC, hooks de análise de preços, funções de backend e esquema da base de dados.
- Confirmação das regras de negócio já consolidadas (saldo canónico, PATEC como fonte única, removidos contam nos agregados, séries fiscais, arquivamento de itens PATEC a desativar produtos do fornecedor).
- Nenhum dado será inventado: métricas e volumes só entram se lidos da base de dados; caso contrário ficam como marcadores explícitos.

## Notas técnicas
- Sem alterações ao código da aplicação, à base de dados ou a funções — trabalho exclusivamente documental.
- Diagramas em sintaxe Mermaid (`flowchart`, `stateDiagram-v2`, `sequenceDiagram`), sem emojis e sem cores personalizadas, para legibilidade em tema claro e escuro.
- Cada diagrama será validado por renderização antes da entrega.

## Validação
- Cada fluxograma renderiza sem erros de sintaxe.
- Cada módulo do sistema referido no documento corresponde a uma rota/componente real.
- Revisão de coerência entre o texto processual e os diagramas.
