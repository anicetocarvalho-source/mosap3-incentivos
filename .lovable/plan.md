

## Revisão dos valores recebidos — Cuando Cubango

### O que está nos ficheiros Unitel (já carregados)

| Ficheiro | Plano | Linhas Success | Valor unit. | Total Kz |
|---|---|---|---|---|
| `CUANDO_CUBANGO.csv` | "200k Cuando Cubango" | 2.279 | 200.000,00 | 433.000.000 (estimado) |
| `CUANDO_CUBANGO_CONTA_1_50.csv` | "Carregamento 50% Cont1 Cuando Cubango" | 2.229 (50 falharam) | 101.760,00 | 226.823.040 |
| **`CUANDO_CUBANGO_CONTA_1_50-2.csv` (novo upload)** | Mesmo plano que o anterior, mesmo Bulk Plan ID `812184` | 2.229 | 101.760,00 | 226.823.040 |

**Observação crítica:** o ficheiro novo (`-2`) é uma **reedição do mesmo bulk** (`Bulk Plan ID 812184`) — **não é um novo pagamento**. Mesma data (11-09-2025 15:39), mesmo valor total (231.911.040 plano / 226.823.040 sucesso), mesmos 50 falhados, mesmos operadores. Re-importá-lo somando seria duplicar saldos.

### O que está na BD agora (Cuando Cubango)

| Métrica | Valor |
|---|---|
| Agricultores totais na província | 1.921 |
| Com `valor_recebido > 0` | 1.921 (100%) |
| Soma `valor_recebido` | 579.680.960,00 Kz |
| Soma `total_gasto` | 391.854.695,00 Kz |
| Soma `saldo_final` | −391.275.014,04 Kz |
| **Distribuição de `valor_recebido`** | **Todos com 301.760,00 Kz** (200.000 + 101.760) |

Ou seja: a importação anterior somou correctamente os dois ficheiros (200k + 50%). Não há grupos diferentes — o Cuando Cubango está **uniforme**. Os 1.921 agricultores na BD vs. 2.279 telefones no ficheiro = **358 telefones do Unitel sem agricultor associado** (já estão em `orphan_phones`).

### Plano de revisão por grupos

Quando passar para modo execução, faço:

**1. Confirmar que o `-2.csv` é duplicado**
   - Comparar linha-a-linha (`Credit Msisdn` + `TransactionID`) entre `CUANDO_CUBANGO_CONTA_1_50.csv` original e o novo.
   - Se `TransactionID` 100% coincidirem → ignorar, não importar (o saldo já está reflectido).
   - Se houver diferenças → mostrar diff antes de qualquer write.

**2. Listar grupos do Cuando Cubango por escola/ECA**
   ```text
   SELECT school, COUNT(*), SUM(parse_ptao_numeric(valor_recebido)),
          SUM(parse_ptao_numeric(saldo_final))
   FROM farmers WHERE province='Cuando Cubango' GROUP BY school;
   ```
   - Entrega um quadro: ECA | nº agricultores | total recebido | total gasto | saldo (positivo / negativo).

**3. Comparar contra ficheiros Unitel**
   - Para cada ficheiro Unitel do Cuando Cubango, contar quantos telefones bateram com agricultores existentes vs órfãos.
   - Top 10 órfãos por valor (potenciais agricultores em falta no cadastro).

**4. Entregáveis** (em `/mnt/documents/`):
   - `cuando_cubango_por_eca.xlsx` — totais por ECA.
   - `cuando_cubango_diff_unitel.xlsx` — match vs órfãos por ficheiro.
   - `cuando_cubango_duplicado_check.xlsx` — comparação dos dois CSVs Conta 1 50% para confirmar duplicação.

**5. Decisão sua antes de qualquer write**
   - Confirmar que `-2.csv` é duplicado (não importar).
   - Decidir se quer associar manualmente os órfãos do Cuando Cubango a agricultores existentes (via `/telefones-orfaos`).

Não vou alterar `valor_recebido` nem `saldo_final` sem aprovação explícita após ver os relatórios.

