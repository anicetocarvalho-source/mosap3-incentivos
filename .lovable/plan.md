## Objectivo

Preencher automaticamente `farmers.municipality` (e, quando seguro, `farmers.province`) no momento de INSERT/UPDATE, registando evidência e nível de confiança em `audit_logs`. Só grava se `confidence >= 75`; caso contrário regista apenas sugestão.

## Restrições descobertas

- `municipalities` só tem `name` + `province_id` (sem geometria) — point-in-polygon clássico não é viável.
- `farmer_parcels` tem `lat`/`lon` em texto, mas só por agricultor, não há boundaries.
- `schools` tem `province_id` + `municipality_id` (FK fiável).
- Estado actual: 0 agricultores sem província/município; feature opera sobre futuros INSERT/UPDATE e importações em lote.

## Estratégia de inferência (ordem de prioridade)

| # | Fonte                                          | Confiança | Condição                                                                 |
|---|------------------------------------------------|-----------|--------------------------------------------------------------------------|
| 1 | ECA (`schools.municipality_id` + `province_id`)| 95        | `NEW.school` resolve para uma escola única e a província bate certo      |
| 2 | Outro agricultor com mesmo BI                  | 90        | BI normalizado, status ≠ Removido, município já preenchido               |
| 3 | Outro agricultor com mesmo telefone (últimos 9 dígitos) | 80 | Match único                                                              |
| 4 | Parcela GPS — vizinho mais próximo (Haversine ≤5 km) com município conhecido | 75 | `farmer_parcels.lat/lon` válidos                       |
| 5 | Prefixo de telefone Unitel (tabela `phone_prefix_regions` opcional, futuro) | 50 | Apenas sugestão, nunca grava                                            |

**Regra "província NULL"**: só preenche `municipality` se a `province` resultante for igual à `NEW.province` ou se `NEW.province` for NULL **e** a fonte for de confiança ≥90 (nesse caso preenche também `province`). Nunca sobrescreve valores já presentes.

## Implementação técnica

### 1. Migration: função `infer_farmer_location(_new farmers)`
- Retorna `jsonb { province, municipality, confidence, source, evidence }`.
- Implementa a cascata acima em PL/pgSQL com `SECURITY DEFINER`, `search_path=public`.
- Helpers: `normalize_phone9(text)`, `haversine_km(lat1,lon1,lat2,lon2)`.

### 2. Migration: trigger `trg_farmers_autofill_location`
- `BEFORE INSERT OR UPDATE OF school, province, municipality, phone, bi ON farmers FOR EACH ROW`.
- Só actua se `NEW.municipality IS NULL OR NEW.municipality = ''`.
- Chama `infer_farmer_location(NEW)`.
- Se `confidence >= 75`:
  - Atribui `NEW.municipality` (e `NEW.province` se aplicável e estava NULL).
  - `INSERT INTO audit_logs (action='auto_assign_municipality', entity_type='farmer', entity_id=NEW.code, details=evidence_jsonb)`.
- Se `confidence < 75` mas há sugestão: regista `action='municipality_suggestion'` no `audit_logs` sem alterar a linha.
- Nunca falha o INSERT — captura excepções e regista `action='auto_assign_failed'`.

### 3. RPC opcional (admin) — fora do âmbito desta task
A escolha foi "apenas trigger". Não criamos endpoint manual; mas a função `infer_farmer_location` fica reutilizável.

### 4. Formato dos detalhes do audit_log

```json
{
  "farmer_code": "AGR-912345678",
  "applied": true,
  "confidence": 95,
  "source": "school",
  "assigned": { "province": "Huíla", "municipality": "Lubango" },
  "previous": { "province": null, "municipality": null },
  "evidence": {
    "school_id": "uuid…",
    "school_name": "ECA Lubango Centro",
    "alternatives_considered": ["phone", "bi"]
  }
}
```

## Verificação

1. `psql` — inserir agricultor de teste com `school` válida e `municipality=NULL` → confirmar preenchimento + linha em `audit_logs`.
2. Inserir com BI duplicado de outro agricultor → confirmar fonte=`bi_match`.
3. Inserir sem qualquer sinal → confirmar que linha entra sem alteração e regista `municipality_suggestion` com confidence baixa (ou nada).
4. Confirmar idempotência: UPDATE noutra coluna não dispara nova atribuição.

## Fora de âmbito

- UI admin / página de revisão de sugestões (pode ser feita depois lendo `audit_logs` por `action='municipality_suggestion'`).
- Tabela `phone_prefix_regions` (sinal 5) — fica como hook futuro.
- Backfill dos 14 819 agricultores existentes (todos já têm município).