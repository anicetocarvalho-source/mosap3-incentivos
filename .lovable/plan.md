

## Problema

No sidebar do Portal do Fornecedor o item "Vender (Terminal POS)" aponta para `/fornecedor/pos/venda`, mas o utilizador relata que a opção "Abrir POS" não aparece. Pelos logs de sessão, o utilizador está a clicar em "Terminais POS" (`/fornecedor/pos`) e vê apenas a tabela com o botão de editar — **sem o botão "Abrir POS"** por linha nem o CTA "Abrir Terminal de Venda" no topo, apesar de `FornecedorPOS.tsx` os ter no código.

## Causa provável

O componente renderizado em `/fornecedor/pos` **não é o `FornecedorPOS.tsx`** que foi editado. No `App.tsx`, o import pode estar a apontar para `Mosap3PayPOS` ou outro ficheiro (já que existem dois ficheiros com nomes semelhantes: `src/pages/fornecedor/FornecedorPOS.tsx` e `src/pages/fornecedor/FornecedorPOSVenda.tsx`, e também o backoffice `src/pages/Mosap3PayPOS.tsx`). Precisa confirmar-se que a rota `/fornecedor/pos` está mapeada para `FornecedorPOS` (gestão de terminais com os botões adicionados).

## Plano

### 1. Verificar e corrigir imports e rotas no `App.tsx`
Confirmar que:
- `/fornecedor/pos` → `FornecedorPOS` (de `src/pages/fornecedor/FornecedorPOS.tsx`, gestão de terminais **com** os botões "Abrir POS" e CTA topo)
- `/fornecedor/pos/venda` → `FornecedorPOSVenda` (wrapper que injecta `supplier.id` no `Mosap3PayPOS`)

Se qualquer um dos dois estiver errado ou em falta, corrigir.

### 2. Garantir que `FornecedorPOS.tsx` renderiza os CTAs mesmo sem terminais
O `EmptyState` actual mostra apenas "Criar primeiro terminal". Adicionar também o botão **"Abrir Terminal de Venda"** no header da página de forma sempre visível (já é, segundo o código actual) — confirmar que o build atual está efectivamente servido. Se o cache do Vite estiver a servir versão antiga, forçar refresh através de uma pequena edição não-funcional não é necessário; o rebuild acontece ao editar.

### 3. Confirmar que o sidebar tem o item "Vender"
Verificar em `FornecedorLayout.tsx` que `"/fornecedor/pos/venda"` com label "Vender (Terminal POS)" está presente. Pela última edição, deveria estar — mas o utilizador pode não o ver se houver erro de build.

### Ficheiros a verificar/editar
- `src/App.tsx` — confirmar os imports e rotas `/fornecedor/pos` e `/fornecedor/pos/venda`.
- `src/pages/fornecedor/FornecedorPOS.tsx` — confirmar que os botões "Abrir Terminal de Venda" (header) e "Abrir POS" (por linha) estão presentes e a navegar para `/fornecedor/pos/venda`.
- `src/components/fornecedor/FornecedorLayout.tsx` — confirmar item de menu "Vender (Terminal POS)".

### Resultado
Após correcção, em `/fornecedor/pos` o fornecedor verá:
- Botão destacado no topo **"Abrir Terminal de Venda"**.
- Em cada linha da tabela, botão **"Abrir POS"** (ícone Play).
- No sidebar, item **"Vender (Terminal POS)"** sempre acessível.

Clicar em qualquer um deles abre `/fornecedor/pos/venda` com o terminal de venda pré-configurado para a loja do fornecedor.

