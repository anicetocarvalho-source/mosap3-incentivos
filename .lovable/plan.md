## Reprocessamento do Excel — Valores reais (snapshot mais recente)

### Diagnóstico do ficheiro `data_2-2.xlsx`

- **88.918 linhas**, **14.819 telefones únicos** (+ 4 linhas de rodapé/órfãs)
- **6 snapshots por telefone**, em **4 datas distintas**: `2025-06-06`, `2025-06-10`, `2025-06-25` (3 cargas no mesmo dia) e 1 linha sem data
- **Linha "Total" oficial do Excel**: Recebido **4.441,89 M Kz** · Gasto **2.228,18 M Kz** · Saldo **2.213,71 M Kz**

### ⚠️ Descoberta crítica sobre a semântica das colunas

| Coluna | Comportamento | Total correcto |
|---|---|---|
| `Total Disponibilizado` | **Idempotente** — mesmo valor repetido em todos os 6 snapshots do telefone | `MAX(rec)` por telefone (ou qualquer 1 snapshot) |
| `Valor Gasto` | **Transaccional** — cada linha é uma compra distinta; 11.353 telefones têm valores diferentes entre snapshots | `SUM(gasto)` por telefone (todos os snapshots) |

Ou seja, a estratégia "somar tudo" inflacionou só o **recebido** (~6×). O gasto na BD também está duplicado porque há 3 snapshots no mesmo dia (06-25). Os valores corrigidos devem ser:

- **Recebido por agricultor** = 1 snapshot (qualquer, idempotente)
- **Gasto por agricultor** = soma de todas as linhas (transaccional, sem deduplicação)
- **Saldo** = `max(0, recebido − gasto)` (regra canónica `computeSaldoFinal`)

### Totais esperados após reprocessamento

```
Recebido:  4.441,89 M Kz   (antes: ~31.093 M, 7× inflacionado)
Gasto:     2.228,18 M Kz   (antes: ~4.456 M,  2× inflacionado)
Saldo:     2.213,71 M Kz   (antes: ~26.637 M, ~12× inflacionado)
```

### Plano de execução

**1. Stage do ficheiro novo**
- Truncar `_xlsx_recon_staging`
- Carregar as 88.914 linhas válidas (telefone numérico) via `psql COPY`

**2. Agregação por telefone (em SQL)**
```sql
SELECT phone,
       MAX(recebido) AS recebido_real,
       SUM(COALESCE(gasto, 0)) AS gasto_real
FROM _xlsx_recon_staging
GROUP BY phone;
```

**3. UPDATE dos 14.819 farmers existentes**
- `valor_recebido` ← novo valor (formato `200000.00`)
- `total_gasto` ← novo valor
- `saldo_final` ← `computeSaldoFinal(recebido, gasto)`
- **NÃO toca em**: `province`, `municipality`, `school`, `full_name`, `status`, `patec`, biometria, etc.
- Em particular, preserva a correcção manual em `AGR-976107290` (Ester Daniel → Cuando-Cubango/Menongue)

**4. Trilha de auditoria por agricultor**
- 1 linha em `farmer_balance_history` por farmer com delta significativo (campo `valor_recebido` e `total_gasto`), source `reprocessamento_xlsx`, em blocos de 500
- 1 linha em `audit_logs` com `action='bulk_reprocess'`, contendo totais antes/depois e contagens

**5. Reconciliação**
- Telefones no ficheiro mas não na BD → reportar (esperado: 0; já foram todos importados antes)
- Telefones na BD mas não no ficheiro → reportar (esperado: 0)
- Linha órfã (gasto = 2.093.845, sem telefone) → confirmar que `orphan_phones` já a contém; sem alterações

**6. Verificação pós-reprocessamento**
- `SELECT SUM(valor_recebido::num)`, `SUM(total_gasto::num)` → comparar com 4.441,89 M / 2.228,18 M
- Spot-check de 5 agricultores aleatórios contra o Excel
- Verificar página `/relatorios/snapshots` — coluna "BD vs. Último (recebido)" deve passar a "Coerente <1%"

### Garantias

- **Idempotente**: re-executar com o mesmo ficheiro não altera valores nem cria histórico duplicado
- **Reversível**: o `farmer_balance_history` permite calcular o estado anterior se necessário
- **Sem perda de dados**: apenas 3 campos numéricos são alterados; tudo o resto (geografia, biometria, fotos, PATEC, status) permanece intacto
- **Saldo nunca negativo**: usa `computeSaldoFinal` (`max(0, rec − gasto)`)

### O que NÃO está incluído

- Re-criação de províncias/municípios/escolas (já estão correctos)
- Inserção de novos agricultores (o ficheiro tem os mesmos 14.819)
- Importação de transacções individuais como `farmer_transactions` (mantém-se agregado)
- Alteração da inferência geográfica feita para `AGR-976107290`

Se aprovares, executo o reprocessamento e mostro um relatório final com os totais antes/depois.
