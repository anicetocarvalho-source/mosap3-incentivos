

## Plano: Sincronizar valores Unitel + contagem de Escolas de Campo

### Problema 1 — Valor recebido / saldo desatualizado
A página `/revisao-provincias` já cruza CSVs Unitel com `farmers` por telefone, deteta duplicados e gera relatório, **mas nunca escreve na tabela `farmers`**. Por isso a coluna `valor_recebido` (e o `saldo_final` derivado) não reflete o que está nos ficheiros.

### Problema 2 — Escolas de Campo a zero
A tabela `schools.total_farmers` está sempre `0` para as 733 escolas, apesar de `farmers.school` ter dados consistentes (todos os nomes em `farmers` correspondem a uma escola em `schools`). Por isso `/escolas` mostra "0 produtores" em todas as ECAs.

---

### O que vou implementar

**1. Aplicar valores Unitel à BD (a partir de `/revisao-provincias`)**

Adicionar na revisão já gerada um botão **"Aplicar valores na BD"** (visível só para Admin/Gestor de Incentivos), que:
- Mostra dialog de confirmação com: nº de produtores afetados, total Kz a creditar, lista de duplicados que serão **ignorados** (conforme decisão do utilizador no painel de duplicados).
- Para cada agricultor com match, faz `UPDATE farmers SET valor_recebido = <novo total>` — o trigger `trg_recalc_on_farmer_recebido` recalcula `total_gasto` e `saldo_final` automaticamente, e `log_farmer_balance_change` regista o histórico.
- Define `SET LOCAL app.import_source = 'unitel_csv:<filename>'` antes do UPDATE para que `farmer_balance_history` registe a fonte correta (em vez de `edicao_manual`).
- Marca a revisão guardada com flag `applied_at` (nova coluna em `province_reviews`) para indicar que já foi materializada — previne reaplicação acidental.
- Telefones órfãos (sem agricultor associado) são gravados em `orphan_phones` via a função `bulk_insert_orphan_phones` que já existe.

**2. Recálculo de `schools.total_farmers`**

- Criar função SQL `recalc_school_farmer_counts()` que faz `UPDATE schools SET total_farmers = (SELECT COUNT(*) FROM farmers f WHERE LOWER(TRIM(f.school)) = LOWER(TRIM(schools.name)) AND f.province = (SELECT name FROM provinces WHERE id = schools.province_id) AND f.status <> 'Removido')`.
- Criar trigger em `farmers` (AFTER INSERT/UPDATE/DELETE de `school` ou `status`) que recalcula automaticamente as escolas afetadas — mantém o número sempre certo dali em diante.
- Executar a função uma vez na migração para preencher os 733 registos atuais.

### Detalhes técnicos

- Migração SQL nova:
  - `ALTER TABLE province_reviews ADD COLUMN applied_at timestamptz, applied_by uuid, applied_summary jsonb;` + policy de UPDATE para Admin/Gestor.
  - `CREATE FUNCTION recalc_school_farmer_counts()` + trigger `trg_school_count_on_farmer`.
  - `SELECT recalc_school_farmer_counts();` (one-shot).
- Frontend `src/pages/RevisaoProvincias.tsx`:
  - Novo botão **"Aplicar valores na BD"** (badge "irreversível"), só ativo após gerar revisão e quando `applied_at IS NULL`.
  - Dialog de confirmação com texto livre obrigatório (escrever "APLICAR") para destravar.
  - Loop de UPDATEs em chunks de 50 (consistente com a regra existente para batch operations) com barra de progresso.
  - Após sucesso: `toast` com totais aplicados, atualiza estado local com `applied_at`, invalida queries `["farmers_list"]`, `["farmer_incentives"]`.
- Frontend Escolas: nenhuma alteração necessária — `useProvincesData` já lê `schools.total_farmers`, vai passar a mostrar números reais assim que a função correr.

### Segurança
- Aplicação dos valores restrita a `is_admin OR has_role('gestor_incentivos')`, igual à política existente em `province_reviews`.
- Cada UPDATE deixa rasto em `farmer_balance_history` (trigger já existe).
- Uma revisão só pode ser aplicada **uma vez** (verificação `applied_at IS NULL`).

