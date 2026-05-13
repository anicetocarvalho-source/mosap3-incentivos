## Objectivo

Atribuir PATEC 1/2/3 de forma aleatória balanceada a todos os ~10.905 agricultores activos, para destrancar o teste end-to-end do fluxo de compras (POS → saldo → factura).

## Recomendação de execução

**Migração SQL única, idempotente.** Razão:
- É um seed de ambiente de teste, não uma feature de produto recorrente — não justifica UI dedicada nem código TypeScript.
- Uma migração corre num passo, fica versionada no histórico do projecto, e o utilizador aprova antes de executar (sem surpresas).
- Idempotente: pode ser re-executada sem duplicar nem partir dados já atribuídos manualmente.

Descarto as outras opções: o "script seedável" obriga a manter uma função SQL no schema só para testes (poluição); o "botão admin em /patec" custa muito mais código para algo que vais correr 1 vez.

## Regras de atribuição

- Universo: `farmers` onde `status <> 'Removido'` E `patec IS NULL` (não sobrescreve quem já tenha PATEC manual).
- Distribuição: `NTILE(3)` sobre `ORDER BY random()` → ~⅓ recebe PATEC 1, ⅓ PATEC 2, ⅓ PATEC 3.
- Resultado esperado: ~3.635 produtores por pacote, "Sem PATEC" cai para 0 (excluindo Removidos).

## Passos

1. Criar migração SQL com `UPDATE farmers SET patec = ... WHERE patec IS NULL AND status <> 'Removido'` usando CTE com `NTILE(3) OVER (ORDER BY random())`.
2. Após aplicação, validar via `/patec`:
   - Total no topo = nº de activos
   - Stats PATEC 1/2/3 ≈ ⅓ cada
   - "Sem PATEC" = 0
3. Validar com utilizador júnior (Benguela) que os contadores filtrados pelo scope geográfico continuam coerentes.

## Detalhes técnicos

```sql
WITH buckets AS (
  SELECT id, ((NTILE(3) OVER (ORDER BY random()))) AS bucket
  FROM farmers
  WHERE patec IS NULL AND status <> 'Removido'
)
UPDATE farmers f
SET patec = b.bucket, updated_at = now()
FROM buckets b
WHERE f.id = b.id;
```

Nota: não usar `random()` directamente em `SET patec = ...` porque cada chamada a `random()` reavalia por linha — `NTILE` garante a distribuição exacta em terços.

## Fora de âmbito

- Não cria atribuições para "Removidos" nem sobrescreve PATEC já existentes.
- Não mexe em `farmer_incentives`, saldos, ou lojas — só preenche a coluna `farmers.patec`.
- Não adiciona UI nova.