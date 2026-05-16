## Importação de 70.379 transações + 12 fornecedores

### Ficheiro analisado: `Dados_Transacoes_Actual_Mosap.xlsx`

- **70.379 transações** com ID único (1 a 70.483)
- **11.353 telefones únicos** — corresponde exactamente aos agricultores com gasto > 0 na BD ✓
- **Total**: 2.226,09 M Kz (idêntico ao agregado já carregado em `farmers.total_gasto`) ✓
- **12 empresas fornecedoras** e 36 produtos distintos
- **5.493 transações sem data válida** (5.492 NaT + 1 com data 1970)
- **105 transações sem ECA** (preenchível como `—`)

### Decisões aprovadas

| Tema | Escolha |
|---|---|
| Destino | Só `farmer_transactions` (não cria `pos_sales` fiscais) |
| Fornecedores | Criar 12 em `suppliers` (status `Ativo`, NIF/contactos a preencher) |
| Transações sem data | Atribuir `2025-09-01` |
| Recálculo do saldo | Reescrever `valor_recebido` (mesmo valor) para disparar trigger e regerar gasto/saldo a partir do detalhe |

### Top 12 fornecedores a criar
1. TOPO AGRO COMERCIO E AGROPECUARIO LIMITADA (22.852 tx)
2. AGROSAPI LDA (9.530)
3. ELSENGO COMERCIO GERAL LDA (8.436)
4. SONISAP INVESTMENT LDA (8.340)
5. JARDINS DA YOBA PRODUCAO AGRICULA LDA (6.577)
6. RIBBEN LIMITADA (5.593)
7. RURAL SHOP PRESTACAO DE SERVICOS LDA (4.121)
8. INDU AGRI ANGOLA (2.094)
9. FERTISEME FERTILIZANTES E SEMENTES LDA (1.748)
10. JDTS COMERCIO GERAL E PREST DE SERV (762)
11. + 2 outros

### Plano de execução

**1. Desactivar triggers ruidosos durante a importação (via migration)**
- `ALTER TABLE farmer_transactions DISABLE TRIGGER trg_recalc_on_transaction` (evita recalcular 70k vezes)
- `ALTER TABLE farmer_transactions DISABLE TRIGGER on_transaction_created` (evita criar 70k notificações)
- Reactivar no fim

**2. Criar fornecedores (`suppliers`)**
- 12 registos com `name`, `status='Ativo'`; restantes campos NULL
- Idempotente: usar `INSERT ... ON CONFLICT DO NOTHING` por nome (cria índice único parcial se necessário)

**3. Carregar staging temporário**
- Tabela `_tx_staging` (telefone, empresa, produto, unidades, valor, data) via `psql COPY`
- 70.379 linhas, datas NULL/inválidas substituídas por `2025-09-01`

**4. Inserir em `farmer_transactions` (bulk SQL)**
```sql
INSERT INTO farmer_transactions (farmer_code, product, empresa, valor, valor_num, transaction_date)
SELECT 'AGR-' || right(s.phone, 9), s.produto, s.empresa,
       format_ptao_numeric(s.valor), s.valor::numeric,
       to_char(s.data, 'YYYY-MM-DD')
FROM _tx_staging s
WHERE EXISTS (SELECT 1 FROM farmers f WHERE f.code = 'AGR-' || right(s.phone, 9));
```
- Validar que todos os 70.379 batem com um agricultor existente

**5. Reactivar triggers**
- `ALTER TABLE ... ENABLE TRIGGER ...` para ambos

**6. Disparar recálculo global**
- Para cada agricultor: `UPDATE farmers SET valor_recebido = valor_recebido WHERE code IN (...)`
- O trigger `trg_recalc_on_farmer_recebido` reescreve `total_gasto` e `saldo_final` a partir de `SUM(parse_ptao_numeric(valor))` em `farmer_transactions`
- Define `app.import_source = 'reprocessamento_transacoes'` para o histórico ficar etiquetado correctamente

**7. Verificação**
- `SELECT count(*) FROM farmer_transactions` → 70.379
- `SELECT count(DISTINCT farmer_code) FROM farmer_transactions` → 11.353
- `SELECT round(sum(valor_num)/1e6, 2) FROM farmer_transactions` → ~2.226,09
- `SELECT round(sum(parse_ptao_numeric(total_gasto))/1e6, 2) FROM farmers` → 2.226,09 (igual)
- Spot-check em 3 agricultores: `farmers.total_gasto` ≡ `SUM(valor_num)` das suas transações
- `transacoes_kpis()` (já existe) devolve top-5 produtos/empresas correctamente
- Página `/transacoes` (se existir) passa a listar dados reais

### Garantias

- **Idempotente**: a importação verifica se já existem transações antes de inserir (limpa primeiro `farmer_transactions` para o set completo, evitando duplicação)
- **Performance**: triggers desactivados durante COPY → ~2-3 min de execução total
- **Sem perda**: agricultores sem transação ficam com `total_gasto=0,00` e saldo igual ao recebido (correcto)
- **Auditoria**: 1 entrada em `audit_logs` com totais antes/depois e contagens

### O que NÃO está incluído

- Geração de facturas POS retroactivas (decisão aprovada)
- Vinculação de fornecedores a `supplier_provinces` (pode fazer-se depois em /fornecedores)
- Criação de `supplier_products` a partir dos 36 produtos do Excel
- Mapeamento de produto → PATEC (`patec_items` mantém-se intacto)

Se aprovares, executo a importação e mostro um relatório final com totais e exemplos.
