# Reflectir a real quantidade de agricultores em todas as páginas

## Diagnóstico (números reais na BD)

| Métrica | Valor real | Onde aparece desactualizado |
|---|---|---|
| Total de produtores | **15.166** (13.803 ativos + 1.363 Removidos) | Dashboard ✅ correcto (RPC devolve 15.166) |
| Tabela `schools` | **733** escolas | Dashboard mostra **681** (DISTINCT em `farmers.school` texto) |
| Tabela `municipalities` | **8** municípios | Dashboard mostra **19** (DISTINCT em `farmers.municipality` texto livre) |
| `Σ schools.total_farmers` (cache) | **11.934** | Devia ser **15.166** — falta 3.232 |

### Onde está o erro

**1. Cache `schools.total_farmers` está desactualizada**
- 40 escolas têm `total_farmers` diferente do real (somando por nome+município+província).
- Σ contagem real por escola = 10.908; Σ cache = 11.934.
- 4.275 produtores têm `school = NULL`/vazio → não contam para nenhuma escola.
- **Páginas afectadas:** `EscolasCampo`, `ProvinciaEscolas`, `FichaEscola`, `EscolaDetalhe` (parcialmente — já recalcula em runtime).

**2. RPC `dashboard_kpis` calcula `total_schools` e `total_municipalities` com `DISTINCT` sobre o texto livre em `farmers`**
- `total_schools = 681` → devia ler de `schools` (733).
- `total_municipalities = 19` → devia ler de `municipalities` (8). Os 19 vêm de variações ortográficas no campo texto.

**3. Produtores "órfãos" de escola (4.275)**
- Têm `province` e `municipality` preenchidos mas `school` vazio. Não aparecem em nenhuma ficha de escola.
- Existe já a página `/escolas/auditoria` que detecta divergências de nome — mas não cobre o caso "sem escola".

## Plano de correcção

### 1. Migração: recalcular cache `schools.total_farmers`
Função SQL idempotente que faz, para cada `schools.id`:
```sql
UPDATE schools s SET total_farmers = (
  SELECT count(*) FROM farmers f
  WHERE lower(trim(f.school))       = lower(trim(s.name))
    AND lower(trim(f.municipality)) = lower(trim(m.name))
    AND lower(trim(f.province))     = lower(trim(p.name))
)
FROM municipalities m, provinces p
WHERE s.municipality_id = m.id AND s.province_id = p.id;
```
Adicionar trigger em `farmers` (INSERT/UPDATE/DELETE) que invoca a mesma função para as escolas afectadas, mantendo a cache automaticamente sincronizada.

### 2. Migração: corrigir `dashboard_kpis`
- `total_schools := (SELECT count(*) FROM schools)`
- `total_municipalities := (SELECT count(*) FROM municipalities)`
- Quando `p_scope='province'`, restringir os COUNT a `WHERE province_id IN (...)`.

### 3. Auditoria visual: marcar produtores sem escola
Na página `/escolas/auditoria`, adicionar um cartão extra:
> **4.275 produtores sem escola atribuída** (lista exportável, com botão para abrir cada um em `/agricultores/:code`).

### 4. Verificação final
Após migração, executar e mostrar ao utilizador:
- `Σ schools.total_farmers` deve passar de 11.934 → 15.166 (ou 15.166 − 4.275 = 10.891 se mantivermos só os com escola; preferimos atribuir ou registar como anomalia).
- Dashboard: Escolas = 733, Municípios = 8.
- `EscolasCampo`/`ProvinciaEscolas`: somatórios coerentes com `/agricultores`.

## Fora de âmbito

- Reatribuir manualmente os 4.275 produtores a escolas (precisa decisão de negócio — fica na página de auditoria como lista para acção).
- Alterações de RLS, autenticação ou outras páginas não relacionadas com contagem.
- Página `/agricultores` (já correcta — esconde Removidos por design, conforme regra Core).

## Ficheiros que vão mudar

- Nova migração SQL: função `recompute_school_farmer_counts()` + trigger em `farmers` + alteração do `dashboard_kpis`.
- `src/pages/EscolasAuditoria.tsx`: novo cartão "produtores sem escola".
- `src/hooks/useEscolasAuditoria.ts`: query auxiliar para listar produtores órfãos de escola.
