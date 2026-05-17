## Página `/revisao-inferencias`

Nova página dedicada para o admin/gestor de incentivos rever, aceitar ou recusar as inferências automáticas de **província**, **município** e **ECA** dos agricultores.

### Fontes de dados

1. **Casos pendentes** — `farmers` onde:
   - `province` é NULL/vazia, OU
   - `municipality` é NULL/vazia, OU
   - `school` = `'ECA Desconhecida'` (ou NULL/vazia)
2. **Sugestões existentes** — última linha de `audit_logs` por agricultor com `action IN ('backfill_school','municipality_suggestion','auto_assign_municipality','auto_assign_failed')`, usando `details->>'suggested_school'`, `details->>'municipality'`, `details->>'province'`, `confidence`, `source`, `votes`, `alternatives`.

Combina as duas: cada linha mostra o agricultor + campos em falta + sugestão (se houver) + confiança/fonte.

### UI

- **`PageHeader`** com título "Revisão de Inferências" e contadores: Pendentes, Aceites, Recusados.
- **Filtros**: tipo de inferência (Província | Município | ECA | Todos), província, município, confiança mínima (slider 0-100), pesquisa por nome/código.
- **Listagem responsiva** (tabela desktop / cards mobile, padrão do sistema):
  - Coluna **Agricultor**: código + nome + telefone.
  - Coluna **Localização atual**: província / município / ECA (com chips `Em falta` quando vazio).
  - Coluna **Sugestão**: campo sugerido + valor + badge de confiança (verde ≥85, âmbar 60-84, cinza <60) + fonte (`phone_neighbor_cluster`, `eca`, `gps`, etc.) + tooltip com "X votos de Y vizinhos, dist=Z" e top-3 alternativas.
  - Coluna **Acções**: 3 botões compactos — **Aceitar** (✓ verde), **Recusar** (✗ vermelho), **Editar** (lápis, abre Dialog com Selects encadeados Província→Município→ECA).
- **Acção em lote**: checkbox por linha + barra "Aceitar X sugestões seleccionadas" (apenas para casos com sugestão confiança ≥ limite).

### Acções

| Acção | Efeito |
|-------|--------|
| **Aceitar** | `UPDATE farmers SET province/municipality/school = sugestão` + `INSERT audit_logs (action='inference_accepted', details={field, old, new, source, confidence, accepted_by})` |
| **Recusar** | Não muda o agricultor; `INSERT audit_logs (action='inference_rejected', details={field, suggested, source, confidence, rejected_by, reason?})`. Caso oculto da listagem por defeito (filtro "Mostrar recusados"). |
| **Editar** | Dialog com Selects encadeados que lê `provinces`/`municipalities`/`schools`; ao gravar, faz UPDATE + `audit_logs (action='inference_manual_override', details={field, suggested, chosen, source, confidence})`. |
| **Aceitar em lote** | Itera selecção e dispara N updates + N audit_logs (chunks de 50, padrão do projecto). |

### Estado "Recusado" persistente

Para não voltar a mostrar casos já recusados, a query principal filtra `WHERE NOT EXISTS (SELECT 1 FROM audit_logs WHERE entity_id=farmer.code AND action='inference_rejected' AND details->>'field'=<campo>)`. Toggle "Mostrar recusados" desactiva esse filtro.

### Acesso e navegação

- Rota: `/revisao-inferencias`, protegida por `RoleGuard allowedRoles={["admin","gestor_incentivos"]}` em `App.tsx`.
- Item de menu em `AppNavbar.tsx` na secção "Incentivos" (ou "Qualidade de Dados", junto a `/anomalias` e `/revisao-provincias`), ícone `Sparkles` ou `CheckCheck`.

### Ficheiros

- **Novo**: `src/pages/RevisaoInferencias.tsx` (página com hooks de dados, filtros, tabela/cards, dialogs).
- **Editar**: `src/App.tsx` (rota), `src/components/AppNavbar.tsx` (item de menu).

### Fora de âmbito

- Não cria triggers nem migrações de schema — usa as tabelas existentes (`farmers`, `audit_logs`, `provinces`, `municipalities`, `schools`).
- Não altera o motor de inferência (`infer_farmer_location`); só consome sugestões já registadas.
- Não suporta múltiplas sugestões alternativas em UI separada (só mostra as top-3 em tooltip; editar permite escolher livremente).