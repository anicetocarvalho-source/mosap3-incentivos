## Objectivo

Detectar e alertar sobre preços anormais praticados por fornecedores, comparando cada produto à média dos restantes fornecedores do mesmo produto/categoria, para controlar especulação e variações abruptas.

## Nova página: `/mosap3pay/analise-precos`

Acessível apenas a roles backoffice (admin, gestor_incentivos). Adicionada ao menu **Comercial → MOSAP3Pay**, a seguir a "Stock".

### Estrutura da página

**1. KPIs no topo**
- Total de produtos monitorizados
- Produtos com preço anormal (alertas activos)
- Variação média de mercado (últimos 30 dias)
- Fornecedores com ≥1 alerta

**2. Tabela "Alertas de Preço Anormal"** (default tab)
Colunas: Produto · Categoria · Fornecedor · Preço actual · Média de mercado · Desvio (%) · Severidade · Última alteração · Acções (ver histórico, ver fornecedor).

Filtros: pesquisa por produto/fornecedor, categoria, severidade, província do fornecedor.

**3. Tabela "Variações Abruptas"** (segundo tab)
Lista alterações em `product_price_history` cuja variação ultrapassa um limiar configurável (default ±25% num único ajuste), com motivo, utilizador e data.

**4. Gráfico de evolução** (modal ao clicar num produto)
Linha temporal do preço desse produto por fornecedor + linha tracejada da média de mercado, usando `recharts`.

## Regras de detecção

Para cada `supplier_products` activo, agrupar por "produto comparável":
- Chave de agrupamento: `lower(name)` + `category` + `unit` (mesma unidade é essencial para comparar). Mínimo de 3 fornecedores para gerar média fiável; caso contrário marcar "amostra insuficiente" e não alertar.
- Calcular `avg_price`, `median_price`, `stddev` por grupo.
- **Severidade**:
  - Alta: desvio > +40% acima da média **ou** > 2× desvio-padrão
  - Média: desvio > +25% e ≤ +40%
  - Baixa (informativa): desvio < -25% (preço suspeito de dumping)
- Limiares configuráveis em `system_settings` (chaves novas: `price_alert_high_pct`, `price_alert_medium_pct`, `price_alert_min_suppliers`).

## Implementação técnica

```text
src/pages/Mosap3PayAnalisePrecos.tsx        (nova página)
src/hooks/usePriceAnalysis.ts               (carrega + calcula grupos)
src/components/precos/PriceAlertsTable.tsx
src/components/precos/AbruptChangesTable.tsx
src/components/precos/PriceEvolutionDialog.tsx
```

- **RPC SQL** `analyze_supplier_prices(p_min_suppliers int, p_high_pct numeric, p_medium_pct numeric)` (SECURITY DEFINER, `has_any_backoffice_role`):
  - Devolve linhas: `product_key`, `product_name`, `category`, `unit`, `supplier_id`, `supplier_name`, `province`, `current_price`, `avg_price`, `median_price`, `stddev`, `deviation_pct`, `severity`, `last_changed_at`.
  - Faz `GROUP BY` e `JOIN LATERAL` para obter `last_changed_at` de `product_price_history`.
- **RPC SQL** `detect_abrupt_price_changes(p_days int, p_threshold_pct numeric)`:
  - Lê `product_price_history` últimos N dias com `abs(delta/previous_price) >= threshold`.
- Sem alterações ao esquema existente; apenas funções e (opcional) 3 chaves em `system_settings`.

## Integrações

- **Cartão de aviso** no `FornecedorStock.tsx` (visão do fornecedor) quando algum dos seus produtos estiver marcado como "Alta" — mostra média de mercado e sugere revisão. Apenas leitura para o próprio fornecedor.
- **Badge** no card do fornecedor em `Mosap3PayFornecedores.tsx` com contagem de produtos em alerta.
- **Item no menu** Comercial → "Análise de Preços" (após Stock), com badge da contagem total de alertas activos (similar ao padrão já usado para PATEC pendentes).

## Fora deste plano

- Notificações automáticas (push/email) — pode ser adicionado em fase 2 reaproveitando `farmer_notifications` ou criando job cron.
- Bloqueio automático de vendas com preço anormal — apenas alertar nesta fase, sem bloquear o POS.
- Comparação com preços históricos do próprio fornecedor (já parcialmente coberto pelo histórico no Stock).
