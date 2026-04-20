
O utilizador notou que ao clicar em "Entrar como Fornecedor" no `/auth`, é redireccionado para outra página de login (`/fornecedor/login`) em vez de fazer login directamente no `/auth`.

Isto foi uma decisão deliberada do plano anterior — manter os fluxos isolados porque o `FornecedorAuth.tsx` é um wizard multi-passo (login + registo de empresa em 3 passos) bastante diferente do login simples do backoffice. Mas o utilizador quer agora um fluxo unificado.

## Plano

### Unificar o login no `/auth`

Quando o toggle estiver em **"Fornecedor"**, em vez de mostrar um CTA que redirige, mostrar **directamente o formulário de login** (email + password) na mesma página, idêntico ao do Backoffice mas com lógica diferente:

**Fluxo Fornecedor inline em `/auth`:**
1. Form email + password (mesmo visual do Backoffice).
2. Ao submeter:
   - `supabase.auth.signInWithPassword(...)`
   - Verificar se o user tem registo na tabela `suppliers` (via `user_id`)
   - Se sim → `navigate("/fornecedor")`
   - Se não → `signOut()` + erro "Conta não associada a fornecedor"
3. Botão secundário discreto: **"Registar nova empresa →"** que aí sim leva para `/fornecedor/login` (onde está o wizard de 3 passos para criar empresa + lojas + conta).

### Resultado
- Login de fornecedor faz-se na mesma tela `/auth` (sem redireccionamento).
- O `/fornecedor/login` continua a existir mas só é usado para **registo de nova empresa** (wizard multi-passo).
- Mantém o toggle Backoffice/Fornecedor já existente.
- Mantém o botão de "Fornecedor Teste" (seed) no modo Fornecedor.

### Ficheiros a editar
- `src/pages/Auth.tsx` — adicionar handler `handleSupplierLogin` e renderizar form inline quando `profile === "fornecedor"` (em vez do CTA actual).

### Sem alterações
- `FornecedorAuth.tsx` mantém-se (continua a servir registo).
- Sem mudanças de BD nem de RLS.
