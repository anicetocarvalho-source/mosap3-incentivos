## Objectivo

Criar uma página `/anomalias` que detecta automaticamente casos suspeitos nos dados de produtores (como o duplicado da Victoria Intumba) para revisão manual pelo Admin / Gestor de Incentivos.

## O caso real diagnosticado

A Victoria Intumba (AGR-10639) tem `valor_recebido = 301.760,00 Kz` — não é um valor anormal por si só (é o segundo escalão mais comum, presente em 1.921 produtoras). O verdadeiro problema é:

1. Existe um registo **gémeo** AGR-10640 ("Victoria Intumba Mutango Ndala") na mesma província/município, criado **no mesmo segundo** (2026-04-17 07:54:27) e creditado com **o mesmo valor no mesmo lote** Unitel (`import_unitel_money_2026_04`).
2. AGR-10639 tem **saldo negativo de -362.796,24 Kz** (gastou 363k mas só recebeu 301k).

Provável duplicação de registo durante a importação inicial.

## Categorias de anomalia detectadas

| Categoria | Regra | Severidade |
|---|---|---|
| **Duplicado de produtor** | Mesmo nome normalizado (lowercase, sem acentos, palavras-chave comuns) na mesma província+município, ou nomes muito similares (Levenshtein ≤ 2) | Alta |
| **Saldo negativo** | `parse_ptao_numeric(total_gasto) > parse_ptao_numeric(valor_recebido)` | Alta |
| **Valor fora dos escalões** | `valor_recebido` não pertence a {0; 200.000; 301.760; 915.840} e não é nulo | Média |
| **Telefone partilhado** | Mesmo `phone` (não vazio) em 2+ produtores | Alta |
| **BI partilhado** | Mesmo `bi` (não vazio) em 2+ produtores | Alta |

## Estrutura de implementação

### 1. Backend — Function SQL

Criar uma view/function `detect_farmer_anomalies()` que devolve:
```
anomaly_type | severity | farmer_code | farmer_name | province | municipality | school | details (jsonb) | related_codes (text[])
```

Lógica em SQL puro (uma só query unionada por categoria) para ser performante e re-executável.

### 2. Tabela de resolução

```
anomaly_resolutions
  id, anomaly_type, anomaly_key (texto único: ex "duplicate:victoria-intumba|cuando-cubango|menogue"),
  resolved_as ('falso_positivo'),
  notes, resolved_by, resolved_at
```

RLS: SELECT/INSERT/UPDATE para `is_admin OR has_role(gestor_incentivos)`.

Quando uma anomalia é marcada como falso positivo, fica registada por `anomaly_key` e deixa de aparecer.

### 3. Frontend — `/anomalias`

Layout padrão do sistema (filtros + tabela desktop / cards mobile):

- **Cards de resumo no topo**: contagem por categoria (Duplicados, Saldo Negativo, Valor Fora Escalões, Telefone/BI partilhado).
- **Filtros**: categoria, província, severidade, "incluir falsos positivos" (off por defeito).
- **Tabela**: tipo, produtor (linka para `/agricultores/{code}`), localização, detalhes (ex. "AGR-10639 + AGR-10640 — mesmo nome, mesma escola"), saldo, acções.
- **Acções por linha**:
  - **Abrir perfil** → navega para `/agricultores/{code}`
  - **Marcar falso positivo** → dialog com nota obrigatória; grava em `anomaly_resolutions` + `audit_logs`.
- **Skeletons** de carregamento e `EmptyState` "Sem anomalias detectadas" (já criados).

### 4. Navegação e RBAC

- Adicionar item "Anomalias" no `AppSidebar` (debaixo de Relatórios), com badge mostrando contagem total não resolvida.
- Visível apenas para Admin e Gestor de Incentivos. Aplicar filtro geográfico do utilizador (províncias permitidas).

### 5. Filtragem geográfica

Reutilizar o helper `useGeoScope()` para garantir que utilizadores não-globais só vêem anomalias das suas províncias permitidas (consistente com o resto do sistema).

## Detalhes técnicos

**Ficheiros a criar:**
- `supabase/migrations/<ts>_anomaly_detection.sql` — function SQL + tabela `anomaly_resolutions` + RLS
- `src/hooks/useAnomalies.ts` — fetch via RPC + filtragem por scope
- `src/pages/Anomalias.tsx` — página principal
- `src/components/anomalies/AnomalyTable.tsx`
- `src/components/anomalies/AnomalyCard.tsx` (mobile)
- `src/components/anomalies/MarkFalsePositiveDialog.tsx`
- `src/components/anomalies/AnomalySummaryCards.tsx`

**Ficheiros a editar:**
- `src/App.tsx` — rota `/anomalias`
- `src/components/AppSidebar.tsx` — entrada de menu + badge
- `src/lib/permissions.ts` (ou equivalente) — gating por role

**Memória de projecto:** adicionar `mem://features/deteccao-anomalias` descrevendo a regra de detecção e localização da página.

## Fora de âmbito desta versão

- Fusão automática de duplicados (apenas marcação manual + abrir perfil para acção).
- Soft-delete em massa.
- Exportação CSV (pode ser adicionada depois se necessária).
- Re-cálculo automático de saldos.