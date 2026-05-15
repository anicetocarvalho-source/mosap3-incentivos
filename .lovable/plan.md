## Validação e reconciliação de saldos a partir do Excel

### Resumo do ficheiro
- 88.918 linhas, 14.821 telefones únicos, 2 linhas sem telefone.
- Cada linha é um carregamento (data, valor disponibilizado, valor gasto, saldo) por agricultor/ECA.
- Mesmo telefone pode aparecer até 6 vezes (vários carregamentos / ECAs).

### Objectivo
Comparar agregados do ficheiro com os valores actuais em `farmers` e produzir um relatório de divergências. **Sem alterações de dados nesta fase.**

### Passos

1. **Agregar o Excel por telefone** (normalizado, sem prefixo `244`):
   - `total_disponibilizado_xlsx = SUM(Total Disponibilizado)`
   - `total_gasto_xlsx = SUM(Valor Gasto)`
   - `saldo_xlsx = total_disponibilizado_xlsx − total_gasto_xlsx`
   - Manter lista de ECAs e provícias por telefone (para detectar conflitos).

2. **Carregar agregados da BD** (telefone normalizado):
   - `farmers.valor_recebido`, `farmers.total_gasto`, `farmers.saldo_final` (via `parse_ptao_numeric`).
   - Telefones em `orphan_phones` para excluir falsos "não encontrado".

3. **Classificar cada telefone** numa destas categorias:
   - **OK** — valores batem certo (tolerância 1 Kz).
   - **Diferença em recebido** — `valor_recebido` da BD ≠ soma do ficheiro.
   - **Diferença em gasto** — `total_gasto` da BD ≠ soma do ficheiro.
   - **Diferença em saldo** — só saldo difere (recebido/gasto OK mas saldo desactualizado → recalcular via `recalc_farmer_totals`).
   - **Telefone órfão** — existe no ficheiro mas não em `farmers` (já em `orphan_phones` ou novo).
   - **Telefone partilhado** — vários `farmers` para o mesmo telefone (usar lógica do detector de anomalias).
   - **Conflito de ECA/Província** — dados do ficheiro divergem do perfil do agricultor.

4. **Produzir 3 ficheiros em `/mnt/documents/`**:
   - `reconciliacao_resumo.csv` — contagem por categoria e total Kz por categoria.
   - `reconciliacao_divergencias.csv` — uma linha por telefone com divergência (telefone, nome xlsx, nome BD, código, prov, muni, eca, recebido_xlsx, recebido_bd, delta_recebido, gasto_xlsx, gasto_bd, delta_gasto, saldo_xlsx, saldo_bd, delta_saldo, categoria).
   - `reconciliacao_orfaos.csv` — telefones do ficheiro sem agricultor (com soma de valor disponibilizado, para depois adicionar a `orphan_phones` numa segunda fase).

5. **Apresentar ao utilizador um sumário** no chat:
   - Totais (recebido, gasto) ficheiro vs BD.
   - Nº de agricultores OK / com divergência / órfãos / partilhados.
   - Top 10 maiores divergências em valor absoluto.

### Detalhes técnicos
- Script Python (openpyxl + supabase REST via `psql`/Supabase tools) executado em sandbox, sem alterar a BD.
- Normalização de telefone: remover espaços, `+`, prefixo `244`, manter apenas dígitos.
- Tolerância de 1 Kz para evitar falsos positivos por arredondamento.
- Usar `parse_ptao_numeric` (já existe) para descodificar `valor_recebido`/`total_gasto` da BD.

### Próxima fase (após aprovação do relatório)
Numa mensagem separada, decidir caso-a-caso:
- Importar correcções para `farmers` (UPDATE em lotes de 50).
- Inserir órfãos em `orphan_phones`.
- Marcar telefones partilhados como anomalia para revisão manual em `/anomalias`.