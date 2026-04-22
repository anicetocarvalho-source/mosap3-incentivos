
## Validação dos valores recebidos pelos agricultores

Validei contra a base de dados (10.905 agricultores). **Há uma inconsistência conceitual importante a corrigir**, mas os números estão matematicamente coerentes entre si.

## O que os dados mostram

| Métrica | Valor |
|---|---|
| Total de agricultores | 10.905 |
| `valor_recebido` = `total_gasto` (em todos) | 10.905 (100%) |
| `saldo_final` = 0 (em todos) | 10.905 (100%) |
| Soma `valor_recebido` | 2.226.704.037 Kz |
| Soma `total_gasto` | 2.226.704.037 Kz |
| Soma `farmer_transactions.valor` | 2.226.704.037 Kz |
| Registos em `farmer_incentives` | **0** |
| Registos em `pos_sales` (pago) | **0** |

## Diagnóstico

1. **`valor_recebido` está a espelhar `total_gasto`** — para todos os 10.905 agricultores os dois valores são exactamente iguais e o `saldo_final` é 0. Isto significa que o campo `valor_recebido` **não reflecte incentivos efectivamente recebidos** (a tabela `farmer_incentives` está vazia); está a ser preenchido com a mesma soma das transações registadas em `farmer_transactions`.

2. **As diferenças entre agricultores que observou são reais nas transações**, não no recebimento de incentivos. Exemplos do ecrã actual:
   - AGR-10515 Velacia Mwafekelange — 814.080 Kz (5 transações grandes)
   - AGR-10508 Vasco Monteiro — 613.039 Kz
   - AGR-10505 Vasco Calianguila — 553.560 Kz
   - AGR-10514 Velacia Kakalwumutumba — 41.790 Kz (apenas)

   Cada valor corresponde **exactamente** à soma das linhas em `farmer_transactions` desse agricultor. Não há erro de cálculo; o que varia é o histórico de transações importado por agricultor.

3. **Fórmula esperada vs. realidade**:
   - Esperado: `saldo_final = valor_recebido (incentivos) − total_gasto (POS + transacções)`
   - Realidade actual: `valor_recebido` foi populado igual a `total_gasto`, logo `saldo_final = 0` em todos.

## Conclusão

- **Os valores não estão "errados" matematicamente** — somam exactamente o que está em `farmer_transactions`.
- **Estão semanticamente incorrectos**: o campo `valor_recebido` deveria representar incentivos recebidos (`farmer_incentives.amount` + `farmer_transactions` do tipo crédito, conforme regra de negócio), não uma cópia do `total_gasto`.
- A diferença entre agricultores reflecte apenas o volume de transações importado por cada um, não diferenças reais no incentivo atribuído.

## Plano de correção (a executar após aprovação)

1. **Esclarecer regra de negócio** (vou perguntar antes de migrar): qual é a fonte verdadeira de `valor_recebido`?
   - (a) Soma de `farmer_incentives.amount` (status ≠ Pendente)?
   - (b) Um valor fixo definido na importação inicial?
   - (c) `farmer_transactions` com sinal/tipo "crédito"?

2. **Migração SQL** que recalcula em massa:
   ```sql
   UPDATE farmers f SET
     valor_recebido = to_char(coalesce((SELECT SUM(parse_ptao_numeric(amount)) 
                       FROM farmer_incentives WHERE farmer_code = f.code AND status <> 'Pendente'),0), 'FM999G999G990D00'),
     total_gasto    = to_char(coalesce((SELECT SUM(parse_ptao_numeric(valor)) 
                       FROM farmer_transactions WHERE farmer_code = f.code),0)
                       + coalesce((SELECT SUM(total) FROM pos_sales 
                          WHERE farmer_code = f.code AND payment_status = 'pago'),0), 'FM999G999G990D00'),
     saldo_final    = ... (diferença);
   ```

3. **Trigger de manutenção** em `farmer_incentives`, `farmer_transactions`, `pos_sales` e `credit_notes` para manter os 3 campos sempre coerentes (hoje só há recálculo no fluxo POS).

4. **UI**: na ficha do produtor (`FarmerProfile` → tab Financeiro) acrescentar um aviso quando `valor_recebido < total_gasto` (saldo negativo) e mostrar a decomposição (incentivos vs. transações vs. POS).

### Pergunta antes de migrar
Como `farmer_incentives` está vazia, preciso confirmar consigo qual destas três fontes deve alimentar `valor_recebido`. Após aprovação deste plano, no próximo passo abro `ask_questions` para essa decisão e depois aplico a migração + triggers.
