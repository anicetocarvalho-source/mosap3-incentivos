## Validação — Resultado

Cruzei os **1.363 agricultores marcados como `Removido`** com a folha `Detalhe` do anexo `ALL_MOSAP_003-5.xlsx` (15.166 linhas) usando os últimos 9 dígitos do MSISDN:

| Métrica | Valor |
|---|---|
| Removidos no nosso sistema | **1.363** |
| Encontrados no anexo (Estado MOSAP3 = Activo) | **1.363 (100%)** |
| Não encontrados no anexo | **0** |
| Removidos com duplicado entre os ativos da BD (últimos 9 dígitos) | **0** |
| Removidos com `valor_recebido` já registado | 1.100 |

**Conclusão:** Os 1.363 estão **todos legítimos** no sistema MOSAP3 da operadora — não são duplicados de nenhum agricultor activo. A marcação `Removido` foi indevida (resultado das duas vagas de 17:54 e 18:26 de hoje, esta última no mesmo timestamp do `bulk_link_orphan_phones`).

---

## Plano

### 1. Restaurar estado dos 1.363
Migração que faz `UPDATE farmers SET status = 'Pendente'` apenas para os agricultores que cumprem **todas** as condições (defensivo, evita afectar outros registos):

- `status = 'Removido'`
- `bi IS NULL` AND `school IS NULL` AND `registered_by IS NULL`
- `phone IS NOT NULL`
- `updated_at` ∈ {17:54:34 e 18:26:28 de 2026-05-14}

Estes 1.363 voltam ao estado `Pendente` (não vão para `Aprovado` porque ainda estão sem BI / escola / foto / extensionista).

### 2. Enriquecer com dados do anexo
Para cada um dos 1.363, cruzar pelos últimos 9 dígitos do telefone e preencher:

| Campo BD | Origem no anexo | Regra |
|---|---|---|
| `sim_status` | `Estado_Numero` (Activo) | `'Ativo'`; `sim_status_source = 'unitel_export_2026-05-14'`; `sim_status_updated_at = now()` |
| `valor_recebido` | `SALDO_DISPONIVEL_MOSAP` | Apenas se actual = `'0,00'` (não sobrescreve valores já reconciliados) |
| `province` / `municipality` | `PROVINCE` / `REGION` | Apenas se actual `IS NULL` (preserva o que já temos) |

A operação é feita por **insert tool** (UPDATE em blocos de 50 — regra do projecto), não por migração de schema.

### 3. Registo de auditoria
Inserir uma linha em `audit_logs`:

```
action  : bulk_restore_removidos_unitel
entity  : farmers (1363)
details : { source: 'ALL_MOSAP_003-5.xlsx', total: 1363, províncias: {...} }
```

### 4. Ficheiro organizado para o utilizador
Gerar `/mnt/documents/removidos_reconciliados_v1.xlsx` com 3 folhas:

- **Resumo** — totais por província/município, valor total restaurado, estado SIM, antes/depois.
- **Detalhe (1.363)** — Código MOSAP3 · Nome · Telefone · Província · Município · Estado SIM (anexo) · Saldo MOSAP (anexo) · Saldo eMoney (anexo) · Estado actual BD (antes/depois) · Já tinha valor_recebido (S/N).
- **Auditoria** — origem da decisão, timestamps das duas vagas, ID do registo de audit_logs.

---

## Fora de âmbito

- Não vou atribuir-lhes escola/BI/foto — isso exige decisão de campo do extensionista.
- Não vou tocar em nenhum dos 13.803 agricultores activos.
- Não vou alterar a regra global "Removidos contam em todos os agregados" — após a restauração os contadores ficam: 13.803 + 1.363 = 15.166 activos+pendentes, alinhado com o anexo.
