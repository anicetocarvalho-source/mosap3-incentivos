# Validação dos Telefones Órfãos

## Resultado da auditoria

Executei matching entre `orphan_phones` (pendentes) e `farmers.phone` usando **últimos 9 dígitos** (mesma chave usada no resto do sistema):

| Métrica | Valor |
|---|---|
| Total de órfãos pendentes | **3.399** |
| Órfãos com agricultor correspondente (1 match único) | **3.387** (99,6 %) |
| Órfãos com múltiplos matches (ambíguos) | 0 |
| Órfãos verdadeiramente sem agricultor | **12** |
| Valor mal-classificado como órfão | **1.707.076.480,00 Kz** |

### Causa-raiz
O ficheiro CSV de pagamentos Unitel guarda telefones com **9 dígitos** (`976096393`), enquanto `farmers.phone` tem **12 dígitos** com prefixo do país (`244976096393`). O importador original comparou strings completas em vez de normalizar pelos últimos 9 dígitos, pelo que 3.387 pagamentos foram classificados como órfãos quando na verdade têm um agricultor único correspondente.

Exemplos confirmados:

```text
órfão 976096393  → AGR-MP5MM9GA-1716  Gervasio Hilukilwa  (244976096393)
órfão 976096395  → AGR-MP5MM9GA-1717  Ndaimutala Waishonga
órfão 976096397  → AGR-MP5MM9GA-1719  Teodora Manuel
```

Notei ainda que estes agricultores têm `valor_recebido = 0,00` — o pagamento nunca lhes foi creditado.

## Plano proposto

### 1. Auto-associar os 3.387 órfãos com match único
Migration que, numa única transacção:

- Faz UPDATE em `orphan_phones` para preencher `linked_farmer_code`, `linked_at = now()`, `notes = 'Auto-associado por validação (match últimos 9 dígitos)'` para cada órfão pendente cujos últimos 9 dígitos correspondem a **exactamente um** agricultor.
- Soma `orphan_phones.amount` ao campo `farmers.valor_recebido` desses agricultores (respeitando o formato `pt-AO` com vírgula decimal e separador de milhares com ponto).
- Insere uma linha em `farmer_balance_history` por agricultor afectado (`source = 'orphan_phone_auto_link'`, com `delta`, `old_value`, `new_value` e `source_ref = orphan_phones.id`) para garantir auditoria.
- Insere um registo em `audit_logs` com o resumo da operação (3.387 linhas, total Kz).

### 2. Validar os 12 órfãos verdadeiros
Manter pendentes em `/telefones-orfaos` (estes não têm qualquer agricultor com últimos 9 dígitos coincidentes — listados abaixo). O administrador pode associá-los manualmente como hoje.

```text
976103487, 976103177, 976103236, 976103342, 976102891,
976102908, 976102920, 976102986, 976103015, 976093238,
976093928, 976093235
```

### 3. Endurecer o importador
Pequena alteração na função/edge que cria órfãos (próximas importações Unitel) para que o matching inicial use já os últimos 9 dígitos antes de marcar como órfão — evita que o problema reapareça.

### 4. Sem alterações de UI
A página `/telefones-orfaos` continua igual; após a migration mostrará 12 pendentes (1 cartão "Pendentes") e 3.387 associados.

## Detalhes técnicos

- Match SQL canónico:
  ```sql
  RIGHT(regexp_replace(phone,'\D','','g'), 9)
  ```
- Conversão segura de `valor_recebido` (texto `'1.234,56'` → numeric → texto):
  ```sql
  to_char(
    coalesce(replace(replace(valor_recebido,'.',''),',','.')::numeric, 0)
      + op.amount,
    'FM999G999G990D00'
  )
  ```
  com `lc_numeric = 'pt_PT'` ou substituição manual `.`/`,`.
- A migration corre apenas para `linked_farmer_code IS NULL` e exige `n_farmers = 1` (já confirmado: 0 ambíguos hoje).
- RLS: a migration corre como `service_role`, sem impacto em policies.

## Risco / reversibilidade

- Reversível: cada auto-associação fica registada em `farmer_balance_history` com `source = 'orphan_phone_auto_link'` e `source_ref`, permitindo desfazer em massa se necessário.
- Sem perda de dados: nada é apagado; apenas preenchemos colunas e somamos saldos que deveriam ter sido somados na importação original.
