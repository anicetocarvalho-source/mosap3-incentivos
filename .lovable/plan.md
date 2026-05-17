## Nova secção "Divergências por agricultor" em `/relatorios/snapshots`

Adicionar uma tabela detalhada por telefone/agricultor logo a seguir à secção "3. Comparação Soma vs. Último snapshot", reutilizando o `aggs` já computado (não há leitura extra do Excel).

### Colunas

| Coluna | Origem |
|--------|--------|
| Telefone | `aggs.phone` (9 dígitos canónicos) |
| Agricultor | `farmers.full_name` (lookup por telefone) |
| Código | `farmers.code` com link para `/agricultor/:code` |
| Snapshots | `aggs.snapshots` |
| Soma recebido | `aggs.somaRecebido` (Kz) |
| Último recebido | `aggs.ultimoRecebido` (Kz) |
| Δ recebido | `soma − último` (badge vermelho se >0) |
| Soma gasto | `aggs.somaGasto` (Kz) |
| Último gasto | `aggs.ultimoGasto` (Kz) |
| Δ gasto | `soma − último` |
| Soma saldo | `max(0, somaRecebido − somaGasto)` |
| Último saldo | `max(0, ultimoRecebido − ultimoGasto)` |
| Δ saldo | `soma − último` |
| Divergência total | `|Δ recebido| + |Δ gasto|` (ordenação por defeito, desc) |

### Funcionalidade

- **Ordenação clicável** por qualquer coluna numérica (estado local `sortKey` + `sortDir`); por defeito `Divergência total` desc.
- **Pesquisa** por telefone, nome ou código (Input com debounce simples).
- **Filtro "Apenas com divergência"** (toggle Switch): esconde linhas onde `|Δ recebido|+|Δ gasto| < 1 Kz`.
- **Paginação cliente** (50 por página) para evitar render lento quando há milhares de telefones.
- **Indicador "Órfão"**: linhas onde nenhum agricultor corresponde ao telefone → badge `Órfão` com link para `/telefones-orfaos`.
- **Botão "Exportar CSV"** que respeita filtros e ordenação actuais, gera ficheiro `divergencias_snapshot_YYYY-MM-DD.csv` via Blob.

### Lookup agricultores

Após o processamento do Excel, fazer **uma** query `supabase.from('farmers').select('code, full_name, phone').not('phone','is',null)`, paginada via `fetchAllPages`. Construir `Map<phone9digits, {code, full_name}>` usando a função `normPhone` existente no ficheiro.

O lookup só corre quando `aggs` está pronto; é cacheado em estado (`farmersByPhone`) e reutilizado se o utilizador recarregar o Excel.

### Apresentação

- **Desktop**: `<Table>` shadcn com cabeçalho fixo (`sticky top-0`), cabeçalhos clicáveis com seta de ordenação.
- **Mobile**: cards `divide-y` mostrando apenas Agricultor, Δ recebido, Δ gasto e Δ saldo (com cores semânticas `text-destructive`/`text-warning`).
- Cores: Δ positivo (soma > último) em `text-destructive`; Δ zero em `text-muted-foreground`.

### Ficheiros

- **Editar apenas**: `src/pages/RelatorioSnapshots.tsx` (adicionar estado, lookup, nova `<Card>` com a tabela, função CSV).
- Sem alterações de schema, navegação ou outras páginas.

### Fora de âmbito

- Não escreve nada na BD — é só visualização/exportação.
- Não modifica o motor de agregação existente (`aggs`/`PhoneAgg`).
- Não adiciona novos endpoints nem edge functions.