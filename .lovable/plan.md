

## Plano: Renomear "Disponível" para "Usado" na tabela de Agricultores

### Problema
Na tabela em `/agricultores` a coluna que mostra `f.saldo_final` está rotulada como **"Disponível"**, mas conceptualmente o que se quer mostrar é o **valor já gasto/usado** pelo produtor (não o que sobra).

### Verificação de fonte
- `farmers.valor_recebido` → total recebido da Unitel Money (correto, fica como "Recebido")
- `farmers.total_gasto` → soma das transações em POS (este é o "Usado")
- `farmers.saldo_final` → `valor_recebido − total_gasto` (este é o "Disponível", e era o que estava a ser mostrado por engano)

Logo, além do label, a coluna deve ler **`f.total_gasto`**, não `f.saldo_final`.

### Alterações em `src/pages/Agricultores.tsx`

**1. Cabeçalho da tabela desktop**
- Coluna 7 muda de `Disponível` → `Usado`.

**2. Célula de dados desktop**
- Trocar `{fmtKz(f.saldo_final)}` por `{fmtKz(f.total_gasto)}`.
- Manter a classe `text-warning` (semanticamente continua a indicar "consumo").

**3. Export CSV (`handleExportCSV`)**
- Atualmente o CSV exporta apenas campos identificativos — não inclui valores. Adicionar duas colunas no fim: **"Recebido"** e **"Usado"** com `f.valor_recebido` e `f.total_gasto` (valores brutos para a folha de cálculo).

**4. Mobile**
- O cartão mobile não mostra valores monetários, sem alteração necessária.

### Detalhes técnicos
- Tipo `Farmer` em `useFarmersList` já expõe `total_gasto` (mesma forma que `saldo_final`), portanto não há alterações no hook.
- `fmtKz` (já a usar `formatKzCompact` do parser unificado) trata correctamente os formatos legados EN-US/PT na BD.
- Sem migrações nem alterações de RLS.

### Ficheiro afectado
- `src/pages/Agricultores.tsx`

