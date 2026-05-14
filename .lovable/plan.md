## Análise do ficheiro `ALL_MOSAP_003.xlsx`

O ficheiro tem 2 folhas; a folha **`Detalhe`** contém **15 166 registos** com as colunas: `MSISDN, NAME, TRUST LEVEL, STATUS, PRODUCT_NAME, PROVINCE, REGION (município), SALDO_DISPONIVEL_EMONEY, SALDO_DISPONIVEL_MOSAP, Nome_Cliente, Estado_Numero`.

### Cruzamento com a base de dados (`farmers`, 10 905 registos)

| Métrica | Valor |
|---|---|
| Telefones presentes em ambos | **10 905** (100% da BD) |
| Telefones só no Excel (potenciais novos) | **4 261** |
| Telefones só na BD | 0 |
| Matched com `Estado_Numero = Removido` | 826 |
| Matched com `Estado_Numero = Barrado` | 2 158 |
| Matched com `STATUS = Pendente` | 134 |
| Matched com saldo MOSAP = 0 (esgotado) | 33 |

### Distribuição dos 4 261 novos por província
CUNENE 1 552 · BENGUELA 1 540 · KUANDO KUBANGO 597 · HUÍLA 487 · NAMIBE 83 · BENGO 1 · LUANDA 1.

### Campos que o Excel **pode preencher / validar**
- `phone` (chave de match) ✓
- `full_name` (corrigir capitalização e erros tipo "Menogue" → "Menongue")
- `province` (normalizar: `BENGUELA`→`Benguela`, `HUÍLA`→`Huila`, `KUANDO KUBANGO`→`Cuando Cubango`, etc.)
- `municipality` (do campo `REGION`, com limpeza de variantes tipo "Cuanhama (Kwanhama)" → "Cuanhama")
- `saldo_final` (sincronizar com `SALDO_DISPONIVEL_MOSAP`)
- `status` na BD (marcar `Removido` quando `Estado_Numero=Removido`; flag de revisão para `Barrado`)

### Campos que o Excel **NÃO contém** (continuam em falta)
`bi`, `gender`, `birth_date`, `school` (escola de campo), `patec`, `valor_recebido`, `total_gasto`, fotos, biometria. Estes 10 905 registos da BD continuarão sem `bi/género/data` (campo a recolher em campo).

---

## Plano de acção

Construir uma **página de Reconciliação MOSAP3 Pay** (rota `/mosap3pay/reconciliacao`) que faz a análise sem aplicar nada ao banco até confirmação do utilizador. Sem mexer em outras páginas.

### 1. Página `src/pages/Mosap3PayReconciliacao.tsx`
- Bloco de upload (drag-drop) de `.xlsx` com mesma estrutura do `ALL_MOSAP_*.xlsx` (reutiliza `xlsx` já no projecto).
- Validação imediata da folha `Detalhe` e cabeçalhos esperados.
- Dashboard de KPIs após parse:
  - Total no Excel / Total na BD / Match / Novos / Só na BD
  - Distribuição por província dos novos
  - Discrepâncias detectadas (nome, província, município, saldo)
  - Estados anómalos (`Removido`, `Barrado`, `Pendente`)
- 4 abas com pré-visualização:
  - **Novos** (4 261) — checkbox por linha + bulk select; ao confirmar insere em blocos de 50 (regra do projeto) na tabela `farmers` com `code` gerado, `status='Pendente'`, província/município normalizados.
  - **Diferenças de nome** — lista lado a lado (BD vs Excel), checkbox para aplicar.
  - **Diferenças de saldo** — lista `saldo_final` BD vs `SALDO_DISPONIVEL_MOSAP` Excel; checkbox para sincronizar.
  - **A remover** — registos cujo `Estado_Numero=Removido` ou `Barrado`; checkbox para fazer soft-delete (`status='Removido'`).

### 2. Helpers em `src/lib/reconciliation.ts`
- `normalizeProvince()` com mapa Excel→BD (7 províncias).
- `normalizeMunicipality()` com map para variantes ("Cuanhama (Kwanhama)" → "Cuanhama", "Cuito Cuanavale (Kuito Kuanavale)" → "Cuito Cuanavale").
- `normalizeName()` (title-case PT, preservando acentos).
- `diffFarmer(dbRow, xlRow)` devolve campos divergentes.

### 3. Lote de aplicação
- Inserts/updates feitos lado-cliente em **blocos de 50** com barra de progresso (`Progress`).
- Cada operação registada em `audit_logs` (já existe) com `action='reconciliation_import'` e payload JSON do diff.
- Toast final com sucesso / falhas.

### 4. RBAC
- Rota só visível para `admin` e `incentive_manager` (usar `RoleGuard`).

### 5. Verificação
- Tipechecks ao build automático.
- Teste manual em /preview: carregar `ALL_MOSAP_003.xlsx`, confirmar que mostra 4 261 novos, 826 a remover, ~3 000 diferenças de saldo. Aplicar uma amostra de 5 e validar na BD.

---

### Notas técnicas
- **Sem alterações ao schema** — todas as colunas-alvo já existem em `farmers`.
- Não tocar em `bi`, `gender`, `birth_date` (Excel não tem). Esses campos continuam em falta e devem ser recolhidos em campo (extensionistas via wizard de registo).
- Utiliza a infraestrutura existente: `xlsx` (já em `package.json`), `BulkImportDialog` como referência, `applyFarmerScopeFilter` para respeitar permissões geográficas dos gestores.
- Não recriar páginas removidas ("Compras"/"Empresas") — esta vive dentro do MOSAP3Pay.
