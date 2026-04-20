
O utilizador está em `/fornecedor/pos` mas o sidebar do `FornecedorLayout` aponta para uma página POS que provavelmente não tem um botão claro para **abrir o Terminal POS** (modo venda). Verificando: o sidebar tem item `/fornecedor/pos` com label "Terminais POS" — esta é a página de **gestão de terminais** (CRUD de terminais), não o terminal de venda em si.

O terminal de venda real é `Mosap3PayPOS.tsx` em `/mosap3pay/pos` (backoffice). O fornecedor precisa de um equivalente — ou reutilizar o existente — para efectivamente vender.

## Plano

### 1. Adicionar botão "Abrir Terminal de Venda" na página `/fornecedor/pos`
Na página `FornecedorPOS.tsx` (gestão de terminais), adicionar para cada terminal listado um botão **"Abrir POS"** (ícone Play) que abre o terminal de venda. Também adicionar um botão destacado no topo "Abrir Terminal de Venda" que usa o terminal padrão (primeiro Activo).

### 2. Criar rota dedicada `/fornecedor/pos/venda`
Reutilizar o componente `Mosap3PayPOS` existente, mas:
- Forçar o `supplier_id` ao do fornecedor logado (vindo do `useOutletContext`), saltando o seletor de fornecedor.
- Esconder elementos só-admin se houver.

**Abordagem mais simples e segura:** Criar `FornecedorPOSVenda.tsx` como wrapper leve que:
- Lê `supplier` do contexto.
- Monta o componente POS com supplier pré-seleccionado (passar via prop ou query param `?supplier=<id>`).

Como `Mosap3PayPOS` actualmente faz auto-discovery do supplier, o caminho mais limpo é refactorizar **apenas o suficiente** para aceitar um `forcedSupplierId` opcional via prop. Se não vier, mantém o comportamento actual (selector). Sem prop nova → zero risco para `/mosap3pay/pos`.

### 3. Adicionar item de menu no sidebar do Fornecedor
No `FornecedorLayout.tsx`, adicionar entrada **"Vender (Terminal POS)"** com ícone `ShoppingCart` apontando para `/fornecedor/pos/venda`, posicionada entre "Stock" e "Terminais POS".

### 4. Registar a rota no `App.tsx`
Dentro do bloco `/fornecedor/*` (já com `FornecedorLayout`), adicionar `<Route path="pos/venda" element={<FornecedorPOSVenda />} />`.

### Ficheiros a editar
- `src/components/fornecedor/FornecedorLayout.tsx` — novo item menu "Vender".
- `src/pages/fornecedor/FornecedorPOS.tsx` — botão "Abrir POS" por terminal + CTA topo.
- `src/pages/fornecedor/FornecedorPOSVenda.tsx` — **novo**, wrapper que injecta `supplier.id`.
- `src/pages/Mosap3PayPOS.tsx` — aceitar prop opcional `forcedSupplierId?: string` (sem alterar comportamento default).
- `src/App.tsx` — registar rota `pos/venda`.

### Sem alterações
- Sem mudanças de BD nem RLS (RLS de `pos_sales` já permite supplier inserir as suas próprias vendas).
- Sem alterações ao backoffice POS existente.

### Resultado
O fornecedor terá no menu lateral uma opção clara **"Vender"** que abre o terminal POS já com a sua loja seleccionada, podendo identificar produtor, montar carrinho e processar pagamento — exactamente como no backoffice, mas restrito ao seu próprio catálogo.
