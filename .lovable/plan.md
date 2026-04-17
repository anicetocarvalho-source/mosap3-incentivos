
The user is asking for KPI/chart suggestions for the Dashboard, aligned with the system's purpose. This is a research/advisory task — I have enough context from the schema (farmers, parcels, production, livestock, incentives, transactions, pos_sales, credit_notes, supplier_products, audit_logs) and existing dashboard structure (`useDashboardData.ts`).

System purpose recap: Plataforma MOSAP3 — gestão de incentivos agrícolas para produtores em Angola, com acompanhamento de produção, pecuária, parcelas, distribuição de incentivos monetários (MOSAP3Pay), POS fiscal e rastreabilidade. Objectivo central: **maximizar impacto dos incentivos na produtividade agrícola e bem-estar dos produtores**.

Current dashboard already has: total/aprovados produtores, transacções, empresas, escolas, parcelas, área, produção, pecuária, volume transacções, género, produção por cultura, pecuária por espécie, transacções por província.

Gaps relativos ao objectivo do sistema: impacto, eficiência, conformidade, risco, equidade, desempenho operacional.

I'll propose KPIs grouped by strategic axis. No code yet — this is advisory.

# Recomendações de KPIs e Gráficos para o Dashboard MOSAP3

Objectivo do sistema: **maximizar o impacto dos incentivos agrícolas na produtividade e bem-estar dos produtores, com rastreabilidade fiscal e equidade territorial**. Os KPIs actuais cobrem volume; faltam métricas de **impacto, eficiência, equidade, risco e conformidade**.

## 1. KPIs de Impacto (Cards)

| KPI | Fórmula / Fonte | Porquê |
|---|---|---|
| **Taxa de Utilização de Incentivos** | `total_gasto / valor_recebido × 100` (farmers) | Mede se o dinheiro distribuído está efectivamente a ser convertido em insumos |
| **Saldo Médio por Produtor** | `avg(saldo_final)` | Detecta produtores parados (saldo elevado = não compra) |
| **Produtividade Média (kg/ha)** | `sum(actual_yield) / sum(area)` (farmer_production) | KPI agronómico central — eficácia técnica |
| **Diferença Estimado vs Real** | `(actual_yield - estimated_yield) / estimated_yield` | Avalia precisão das previsões dos técnicos |
| **Ticket Médio POS** | `sum(total) / count(pos_sales)` | Comportamento de compra do produtor |

## 2. KPIs de Equidade & Cobertura (Cards + mini-gráficos)

| KPI | Fonte |
|---|---|
| **% Mulheres com Incentivo** | `farmers.gender='Feminino' AND valor_recebido>0` |
| **% Produtores Activos** | Produtores com ≥1 transacção nos últimos 90d |
| **Cobertura Geográfica** | Províncias com ≥1 venda POS / total províncias |
| **Produtores sem PATEC** | `farmers.patec IS NULL` |

## 3. KPIs de Risco & Operação (Cards com semáforo)

| KPI | Cor |
|---|---|
| **Stock Crítico** | `count(supplier_products WHERE stock <= min_stock)` — vermelho se >10 |
| **Vendas Pendentes Pagamento** | `pos_sales.payment_status='pendente'` |
| **Notas de Crédito (mês)** | `count(credit_notes WHERE created_at >= mês actual)` — sinal de problemas |
| **Produtores Removidos** | `status='Removido'` |
| **Sincronizações Offline Pendentes** | (via SyncQueue v3, se exposto) |

## 4. Gráficos Estratégicos Novos

### A. **Funil de Conversão do Incentivo** (BarChart horizontal empilhado)
```
Atribuído → Recebido → Gasto → Reconciliado
```
Mostra perdas em cada fase — KPI mais importante do MOSAP3.

### B. **Evolução Temporal de Vendas POS** (AreaChart, 12 meses)
Eixos: data × volume Kz, separado por categoria (insumos, ferramentas, etc.). Detecta sazonalidade.

### C. **Top 10 Produtos Mais Comprados** (BarChart)
`pos_sale_items` agrupado por `product_name`. Informa decisões de stock para fornecedores.

### D. **Heatmap Província × Cultura**
Quantidade de produtores por (província, cultura). Identifica concentrações e lacunas.

### E. **Ranking de ECAs por Produtividade** (BarChart Top 10)
`avg(actual_yield/area)` agrupado por `escola`. Identifica boas práticas a replicar.

### F. **Taxa de Aprovação por Técnico** (BarChart)
`approved/registered` por `registered_by`. Avalia desempenho dos extensionistas.

### G. **Ciclo de Vida da Produção** (FunnelChart)
Semeada → Crescimento → Colheita → Comercializada. Detecta abandonos/falhas.

### H. **Distribuição de Saldo por Faixa** (Histograma)
Faixas: 0–5k, 5–20k, 20–50k, 50–100k, >100k Kz. Mostra concentração de poder de compra.

## 5. KPIs de Conformidade Fiscal (mini-cards no topo)

- **IVA Liquidado (mês)** — `sum(iva_total)` de `pos_sales`
- **Próxima exportação SAF-T** — dias até fim do mês
- **Notas de Crédito vs Vendas** — % saudável <2%

## 6. Filtros Adicionais Sugeridos

- **Período** (mês/trimestre/ano) — actualmente o dashboard mostra tudo
- **Comparação YoY** (badge ↑/↓ % vs período anterior) em cada card
- **Toggle "Apenas activos nos últimos 90d"**

## 7. Priorização Recomendada (Fase 1)

Maior impacto vs esforço:
1. **Taxa de Utilização de Incentivos** (card) — directo da `farmers`
2. **Produtividade kg/ha** (card) — directo de `farmer_production`
3. **Funil do Incentivo** (gráfico) — o KPI estratégico
4. **Stock Crítico** (card vermelho) — operacional, evita rupturas
5. **Evolução temporal POS** (gráfico) — visão de tendência
6. **Filtro de período + comparação YoY** (transversal)

Posso avançar com a implementação destes 6 itens prioritários numa única passagem, criando um novo agrupamento "Impacto" no `HeroHeader` e adicionando os gráficos abaixo dos existentes. Sem alterações de schema.
