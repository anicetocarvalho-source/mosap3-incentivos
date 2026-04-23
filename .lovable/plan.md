

## Plano: ECAs com lista de agricultores + página da província organizada

### Problema 1 — Lista de agricultores vazia em `/escolas/:id`
O hook `useSchoolDetail` carrega a escola mas devolve sempre `farmers: []` e `visits: []`. Como `farmers.school` já contém o nome da escola para os 10 905 produtores, basta cruzar.

### Problema 2 — `/escolas/provincia/:slug` muito extensa
A página lista, em sequência, todos os municípios com todas as ECAs em grids — para províncias como Benguela isto produz uma página enorme. Faltam abas/accordion.

---

### O que vou implementar

**1. Carregar agricultores reais na ficha da ECA (`useSchoolDetail.ts`)**
- Após carregar `schools` + `provinces` + `municipalities`, faz uma 2ª query em `farmers` com `LOWER(TRIM(school)) = nome da escola` e `LOWER(TRIM(province)) = província` e `status <> 'Removido'`, ordenado por `full_name`.
- Mapeia cada `farmer` para a interface `FarmerTracking`:
  - `id` ← `farmer.code` (para o link `/agricultores/:code` funcionar — confirmado pelo padrão usado na tabela)
  - `name` ← `full_name`
  - `culture`, `area`, `currentPhase`, `startDate`, `expectedHarvest`, `status`, `visits`, `lastVisit`, `notes` → valores por defeito ("—", "Preparação", "No Prazo", 0, "—", "")
  - `parcels: []` (não há ligação direta agricultor↔parcela GPS na BD por ECA neste momento — só seria preenchido se quisermos cruzar com `farmer_parcels`).
- Mantém `visits: []` (visitas não estão modeladas em BD).

**2. Adaptar `EscolaDetalhe.tsx` para o caso "sem dados de produção"**
- O resumo "Distribuição por Fase" e contadores (No Prazo / Atrasados / Concluídos) continuam a calcular a partir dos defaults — vão refletir corretamente "todos em Preparação / No Prazo".
- Adicionar pesquisa por nome/código + paginação simples (50/página) para escolas com muitos produtores.
- Recalcular `totalFarmers` localmente a partir do array carregado (caso `schools.total_farmers` fique stale entre runs do trigger).
- Os botões "Fase" e "Problema" continuam a abrir os diálogos existentes (regista in-memory). Sem mudanças funcionais aqui.

**3. Reorganizar `/escolas/provincia/:slug` (`ProvinciaEscolas.tsx`)**
- Substituir a sequência de blocos por **Tabs**:
  - Tab 1: **Visão por Município** (pré-selecionada) — cada município é um item de **Accordion** (`@/components/ui/accordion`) que mostra o nº de escolas no header e expande para a grid de cards.
  - Tab 2: **Todas as escolas** — uma grid plana com pesquisa (nome / aldeia / técnico) e filtro por status (Ativa/Inativa), útil para procurar rapidamente sem saber o município.
  - Tab 3: **Municípios sem escolas** — apenas a lista de badges.
- Por defeito, o accordion tem o primeiro município expandido; os restantes colapsados → página fica curta logo à entrada.
- O bloco de "Summary" (4 cards no topo) e o cabeçalho com voltar/título mantêm-se inalterados.

### Detalhes técnicos
- Ficheiros a alterar:
  - `src/hooks/useSchoolDetail.ts` — adicionar query `farmers` e mapeamento.
  - `src/pages/EscolaDetalhe.tsx` — adicionar pesquisa + paginação na tab "Acompanhamento"; mostrar `Empty state` se `school.farmers.length === 0`.
  - `src/pages/ProvinciaEscolas.tsx` — refactor com `Tabs` + `Accordion`.
- Sem alterações de BD nem de RLS — a política `Backoffice can view farmers` já permite o SELECT necessário.
- Mantém o link existente `Link to={'/agricultores/' + farmer.id}` (passa a apontar para o `farmer.code` — `Agricultores.tsx` já trata isso através do `FarmerProfile`).

