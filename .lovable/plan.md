# Gestão completa de Pacotes Tecnológicos (PATEC) + Épocas Agrícolas

## Contexto actual

- `patec_items` tem `patec_number` (inteiro 1/2/3 hardcoded). Não existe tabela de pacotes.
- `farmers.patec` integer; `pos_sales.patec_number` integer. Função `dashboard_kpis` conta `FILTER (WHERE patec = 1/2/3)` hardcoded.
- Metadados de PATEC (título, gradiente, ícone) estão em `patecMeta` no `Patec.tsx`.
- Não há tabela de épocas; `pos_sales.season` é texto livre.

## Objectivo

Permitir ao Admin: criar, editar, remover, activar/desactivar pacotes; gerir épocas agrícolas (datas) e definir em que épocas cada pacote está disponível; bloquear vendas POS quando o pacote estiver inactivo ou fora-de-época.

---

## 1. Esquema de Base de Dados (migração)

### Tabela `patecs`
```text
id                uuid PK
code              text UNIQUE NOT NULL        -- ex.: "PATEC-MILHO" (editável)
name              text NOT NULL               -- ex.: "Milho + Feijão + Gado"
description       text
cultures          text                        -- "Milho + Feijão"
icon              text DEFAULT 'wheat'        -- nome lucide-react
color_token       text DEFAULT 'amber'        -- amber|emerald|violet|...
is_active         boolean DEFAULT true
sort_order        int DEFAULT 0
legacy_number     int UNIQUE                  -- compatibilidade (1, 2, 3 nos antigos)
created_at, updated_at
```
- **RLS**: SELECT autenticados; INSERT/UPDATE/DELETE só admin.
- **Seed**: PATEC-MILHO (legacy 1), PATEC-MASSANGO (legacy 2), PATEC-MASSAMBALA (legacy 3) com metadados actuais.

### Tabela `agricultural_seasons`
```text
id          uuid PK
name        text UNIQUE NOT NULL    -- "Época 2025/2026"
start_date  date NOT NULL
end_date    date NOT NULL
is_active   boolean DEFAULT true
notes       text
created_at, updated_at
```
- Trigger valida `end_date > start_date` (validation trigger, não CHECK).
- RLS: SELECT autenticados; CRUD só admin.

### Tabela de junção `patec_seasons`
```text
patec_id     uuid REFERENCES patecs(id) ON DELETE CASCADE
season_id    uuid REFERENCES agricultural_seasons(id) ON DELETE CASCADE
PRIMARY KEY (patec_id, season_id)
created_at
```
- RLS: SELECT autenticados; INSERT/DELETE só admin.

### Migração de colunas existentes para código alfanumérico
- `farmers`: adicionar `patec_code text` (FK lógica para `patecs.code`). Backfill a partir de `patec` integer via `patecs.legacy_number`. Manter `patec` integer durante período de transição (deprecated) para não partir queries existentes.
- `patec_items`: adicionar `patec_code text NOT NULL`; backfill via `legacy_number`. Manter `patec_number` durante a transição.
- `pos_sales`: adicionar `patec_code text`; backfill.
- Função `dashboard_kpis` reescrita para agregar dinamicamente por código (loop sobre `patecs`) e devolver `patec_counts jsonb` (`{ "PATEC-MILHO": 123, ... }`) em vez de `total_patec_1/2/3`.

### Função helper SQL `is_patec_available(_code text, _at timestamptz DEFAULT now())`
Retorna `true` se PATEC `is_active` E existe pelo menos uma `agricultural_season` ligada que esteja `is_active` E `_at BETWEEN start_date AND end_date`. Usada pelo POS.

---

## 2. UI — página `/patec` reorganizada em separadores

Ainda na mesma rota, mas com `Tabs`:

### Separador 1 — "Pacotes" (gestão CRUD admin)
- Lista de cartões/tabela com cada PATEC: ícone, code, nome, culturas, badge "Activo/Inactivo", contagem agricultores, contagem épocas associadas.
- Botões por linha: **Editar**, **Activar/Desactivar** (toggle), **Remover** (com `AlertDialog`; bloqueada se houver agricultores atribuídos — sugere desactivar).
- Botão **+ Novo Pacote** (Dialog): code, nome, descrição, culturas, ícone (select de lucide), color_token, sort_order, épocas (multi-select).
- Secção "Itens incluídos" (mantém o que existe hoje: insumos/pecuária/serviços por categoria) abaixo, ligada ao PATEC seleccionado.

### Separador 2 — "Épocas Agrícolas"
- Tabela de épocas com nome, datas, estado, nº PATECs ligados.
- CRUD: criar/editar (date pickers Shadcn), activar/desactivar, remover.
- Em cada linha, multi-select dos PATECs disponíveis nessa época.

### Separador 3 — "Atribuição" (mantém UI existente)
- A actual lista de agricultores com filtros, atribuição individual e em massa, redistribuição aleatória — mas com PATEC apresentado por **code/nome** em vez de nº fixo. Filtro `filterPatec` passa a usar `patec_code`.

---

## 3. Validação no POS (Mosap3PayPOS)

Antes de finalizar venda:
1. Obter `patec_code` do agricultor (via `farmers`).
2. Chamar `is_patec_available(patec_code)` (RPC) ou validar client-side com cache.
3. Se `false`: mostrar `toast.error` e bloquear: *"Pacote {code} indisponível — está inactivo ou fora da época agrícola actual."*

Igual validação ao escolher PATEC no fluxo de selecção de produtos.

---

## 4. Auditoria

Cada criação/edição/activação/desactivação/remoção de PATEC ou Época grava em `audit_logs` (entity_type `patec` ou `season`).

---

## 5. Detalhes técnicos

- Componentes Shadcn: `Tabs`, `Dialog`, `AlertDialog`, `Switch` (activar/desactivar), `Calendar`+`Popover` (datas), `MultiSelect` (épocas — usar `Command` + `Popover` ou checkboxes).
- Ícones: select com lista curada (`Wheat, Sprout, Leaf, TreeDeciduous, Carrot, ...`).
- Color tokens: lista curada (`amber, emerald, violet, sky, rose, slate`) → mapeada para classes Tailwind no componente (objecto `colorMap`).
- Real-time: opcional, não necessário no MVP.

## 6. Ficheiros a tocar

- **Novo**: `supabase/migrations/<timestamp>_patecs_seasons.sql`
- **Novo**: `src/hooks/usePatecs.ts`, `src/hooks/useSeasons.ts`
- **Novo**: `src/components/patec/PatecsTab.tsx`, `SeasonsTab.tsx`, `PatecFormDialog.tsx`, `SeasonFormDialog.tsx`
- **Editado**: `src/pages/Patec.tsx` (envolve em Tabs, mantém atribuição), `src/pages/Mosap3PayPOS.tsx` (validação `is_patec_available`)
- **Editado** (consumidores de `patec` integer/`patecMeta`): identificar com grep e migrar para usar `patecs` da BD em vez do objecto hardcoded — `Dashboard.tsx`, `Relatorios.tsx`, etc.

## 7. Fora do âmbito

- Disponibilidade por província (utilizador escolheu "global").
- Migração definitiva (drop) das colunas inteiras antigas — fica para iteração futura quando todo o código estiver convertido.
