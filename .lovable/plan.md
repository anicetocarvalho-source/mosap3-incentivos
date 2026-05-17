## Contexto

24 agricultores têm `school` NULL/vazio. Todos têm `phone` e estão localizados em 5 municípios (Balombo, Bocoio, Cubal, Menongue, Ondjiva). Nenhum tem BI, nenhum tem parcelas GPS. Não há trigger útil — é um backfill pontual.

A análise por **vizinhança numérica de telefone** (10 vizinhos mais próximos no mesmo município com ECA conhecida) produz votação maioritária clara para todos os 24, com 9-10/10 votos para uma só ECA. Distância numérica mínima ≤30 em 23 casos; apenas `AGR-976107290` tem dist_min=405 (mais fraco mas único candidato).

## Estratégia

Cascata por agricultor (ordem decrescente de confiança):

| # | Fonte                                                         | Confiança | Quando se aplica                                              |
|---|---------------------------------------------------------------|-----------|---------------------------------------------------------------|
| 1 | Mesmo telefone (últimos 9 dígitos) de outro agricultor com ECA | 95        | Hoje não existe; mantido por simetria com `infer_farmer_location` |
| 2 | Cluster por proximidade numérica de telefone no mesmo município | 80-90   | Maioria ≥6/10 vizinhos votam mesma ECA e dist_min ≤50         |
| 3 | Cluster por proximidade fraca                                  | 60      | Maioria ≥6/10 mas dist_min >50 (ex: `AGR-976107290`)          |
| 4 | Sem sinal                                                      | 0        | Marca explicitamente como "ECA Desconhecida" no audit_logs    |

**Limite para aplicar**: ≥75. Abaixo disso → regista `school_suggestion` no audit_logs sem alterar a linha; agricultor fica com `school='ECA Desconhecida'` para visibilidade.

## Implementação

Tudo num único SQL idempotente (não cria triggers nem funções permanentes — é um backfill pontual). Passos:

1. **CTE `voted`**: para cada órfão calcula a ECA mais votada entre os 10 vizinhos com phone numérico mais próximo no mesmo município, devolvendo `school`, `votos`, `dist_min`.
2. **CTE `final_assign`**: classifica cada caso em `confidence` (95/85/75/60/0) e `applied` (true/false).
3. **UPDATE** os 24 agricultores: aplica a ECA quando `confidence ≥ 75`; caso contrário escreve `'ECA Desconhecida'`.
4. **INSERT** uma linha em `audit_logs` por agricultor com `action='backfill_school'` e `details` contendo:
   - `farmer_code`, `applied`, `confidence`, `source`
   - `assigned_school`, `votes`, `total_neighbors`, `min_phone_distance`
   - `alternatives` (top 3 ECAs com contagem)
   - `previous_school: null`

## Verificação

1. `SELECT count(*) FROM farmers WHERE school IS NULL OR school IN ('','ECA Desconhecida')` → 0 NULL, eventuais "Desconhecida".
2. `SELECT details->>'source', count(*) FROM audit_logs WHERE action='backfill_school' GROUP BY 1` — distribuição.
3. Spot-check 3 agricultores ↔ ECAs atribuídas confirma plausibilidade geográfica.

## Fora de âmbito

- Trigger permanente (cobertura futura já está garantida via `trg_farmers_autofill_location` em INSERT/UPDATE — município, não ECA; pode ser estendido depois se necessário).
- Geocoding ou consulta a fontes externas.
- Backfill em massa de outros campos.