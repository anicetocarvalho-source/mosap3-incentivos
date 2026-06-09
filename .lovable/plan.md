# Múltiplos PATEC por agricultor

## Objectivo
Hoje cada agricultor tem no máximo um pacote tecnológico (coluna única `farmers.patec_code`). Vamos permitir que o mesmo agricultor receba vários PATEC — inclusive na mesma época — preservando a coluna actual como "PATEC principal" para compatibilidade.

## Modelo de dados

Nova tabela `public.farmer_patecs` (1 linha por vínculo):

| Coluna | Notas |
|---|---|
| `id` uuid PK | |
| `farmer_id` uuid → `farmers.id` (cascade) | |
| `patec_code` text → `patecs.code` | |
| `season_id` uuid → `agricultural_seasons.id` (nullable) | Época em que foi atribuído |
| `assigned_at`, `assigned_by` | Auditoria |
| `is_primary` boolean | Espelha `farmers.patec_code` |
| `created_at` / `updated_at` | |

- Índices em `farmer_id`, `(farmer_id, patec_code, season_id)` único parcial.
- GRANTs para `authenticated` / `service_role`; RLS reaproveita o padrão geográfico das outras tabelas (`farmers`/`user_provinces`).
- Trigger para manter `farmers.patec_code` / `farmers.patec` sincronizado com a linha marcada `is_primary` (a primeira atribuição torna-se primária automaticamente; ao remover a primária, promover a mais recente).
- Migração inicial: copiar para `farmer_patecs` todos os pares `(id, patec_code)` actualmente em `farmers` (com `is_primary = true`).

## Backend / queries

- Função `get_farmer_patec_codes(farmer_id)` (security definer) devolvendo array — útil para POS e cartão.
- Função `get_farmer_active_balance(farmer_id, season_id)` somando os limites/saldos de todos os pacotes activos da época. POS passa a usar esta função em vez de ler `patec_code` directamente.

## Frontend

### `/patec` (`src/pages/Patec.tsx`)
- Leitura de atribuições passa a vir de `farmer_patecs` (joined com `farmers`).
- Contagens por pacote: agrupar `farmer_patecs.patec_code` em vez de `farmers.patec_code`.
- Atribuição individual e em lote (`handleAssign`, `handleRegionAssign`, `handleRandomReassign`) — em vez de `UPDATE farmers SET patec_code=…`, executar `INSERT INTO farmer_patecs … ON CONFLICT DO NOTHING` em lotes de 50. Toggle "Substituir pacote existente" passa a ser "Adicionar pacote / Substituir todos".
- Novo botão "Remover pacote" por linha (apaga de `farmer_patecs`).
- Filtro "PATEC" continua a funcionar: agricultor aparece em todos os pacotes a que pertence.

### Perfil do agricultor (`src/components/FarmerRegistrationForm.tsx` + perfil)
- Mostrar lista de pacotes com badges; permitir adicionar/remover. `patec_code` aparece como "principal" (selector entre os atribuídos).

### POS (`src/pages/Mosap3PayPOS.tsx`, `usePatecCatalogIndex`)
- Catálogo permitido = união dos itens de todos os PATEC activos do agricultor na época corrente.
- Saldo apresentado = soma dos limites − consumos (via nova função RPC).
- `InvoicePDF` continua a imprimir o `patec_code` principal, mas adiciona "Pacotes: A, B, C" quando há mais de um.

### Outros pontos
- `patecAssignmentGuard` actualizado: validar lista em vez de valor único.
- Anomalias / cartão ID / relatórios continuam a ler `patec_code` principal (sem mudança visual imediata).
- Testes existentes (`patec-assignment-guard`, `patec-block-detail`, `patec-invoice-display`) ajustados para o novo modelo.

## Faseamento (1 migração, 1 PR)
1. Migração: tabela + grants + RLS + trigger + cópia inicial.
2. Refactor `Patec.tsx` (leitura, contagens, atribuição, UI de múltiplos pacotes).
3. Perfil do agricultor (lista + selector de principal).
4. POS: catálogo união + RPC de saldo agregado.
5. Ajustes em testes e `patecAssignmentGuard`.

## Fora do âmbito
- Reescrever cartão ID / relatórios para mostrar todos os pacotes (fica como follow-up se desejares).
- Limites por época ainda calculados a nível de PATEC (não de combinação).
