## Objectivo

No `PatecCompositionDialog` (acessível em `/patec` via botão "Composição") já é possível **editar** quantidade/unidade de cada item. Falta:

1. **Adicionar** novos itens à composição do pacote.
2. **Remover** itens existentes.

## Alterações em `src/components/patec/PatecCompositionDialog.tsx`

### Remover item
- Botão "lixo" ao lado do lápis em cada linha.
- `AlertDialog` de confirmação ("Remover [nome] do pacote?").
- `DELETE` em `patec_items` por `id`; actualizar estado local.
- Toast de sucesso/erro.

### Adicionar item
- Botão **"+ Adicionar item"** no topo de cada categoria (Agricultura / Pecuária).
- Formulário inline (linha expandida) com:
  - `Nome` (texto, obrigatório)
  - `Subcategoria` (Select com as chaves de `SUBCATEGORY_LABELS` filtradas pela categoria activa — semente/adubo/etc. para agricultura; animal/ração/etc. para pecuária)
  - `Cultura` (texto livre, opcional — para agrupar; valida contra culturas já existentes no pacote via datalist)
  - `Quantidade base` (decimal, obrigatório)
  - `Unidade` (texto, obrigatório — ex.: kg, L, un, cabeça)
  - Botões "Guardar" / "Cancelar"
- `INSERT` em `patec_items` com:
  - `patec_code` = pacote actual
  - `patec_number` = `patec.legacy_number` (mantém compatibilidade legacy)
  - `category` = categoria da tab activa
  - `sort_order` = `max(sort_order)+10` dentro do grupo (cultura+subcategoria)
- Refresh local da lista; toast de sucesso.

### Permissões
- RLS já restringe `INSERT/UPDATE/DELETE` a admins. O dialog deve apenas mostrar os botões "+ Adicionar" e "remover" para utilizadores com `isAdmin` (importar `useAuth`). Não admins continuam a ver edição de quantidade? Hoje já está aberto; mantém-se o comportamento actual (RLS bloqueia no backend) mas escondemos visualmente para não-admins.

### UX
- Estado `addingCategory: "agricultura" | "pecuaria" | null` controla qual formulário inline está aberto (apenas um de cada vez).
- Validações iguais às do `saveEdit` actual (quantidade numérica ≥ 0, unidade não vazia, nome não vazio).
- Pequeno aviso de impacto: tooltip no botão remover — "Esta acção remove o item para todos os agricultores com este pacote."

## Fora de âmbito

- Sem alterações ao schema de `patec_items` (todas as colunas necessárias já existem).
- Sem alteração ao `PatecFormDialog` nem ao módulo de épocas.
- Sem migração de dados.
- POS e relatórios já leem `patec_items` dinamicamente — qualquer adição/remoção reflecte-se automaticamente no carrinho pré-carregado em `Mosap3PayPOS`.

## Verificação

- Abrir `/patec` → botão "Composição" num pacote → adicionar item de teste → aparece na lista correcta.
- Identificar agricultor com esse pacote no POS → novo item aparece pré-preenchido no carrinho.
- Remover item → confirmar → desaparece da lista; nova venda já não o inclui.
- Utilizador não-admin: botões de adicionar/remover ocultos.
