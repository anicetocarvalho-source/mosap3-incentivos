
## Problema

Ao clicar em "Sair" no Portal do Fornecedor, o utilizador é redireccionado para `/fornecedor/login` — uma página antiga de autenticação isolada que já não é o ponto de entrada oficial. O login de fornecedor está agora unificado em `/auth` (com toggle Backoffice/Fornecedor).

## Causa

Em `src/components/fornecedor/FornecedorLayout.tsx`:
- `handleLogout()` faz `navigate("/fornecedor/login")` após `signOut()`.
- O guard de sessão (linha 36) e o caso "conta não associada" (linha 38) também redirecionam para `/fornecedor/login`.

Existem ainda outras referências a `/fornecedor/login` que devem apontar para `/auth`:
- `src/pages/Auth.tsx` (linha 465): botão "Registar nova empresa" navega para a página antiga.
- `src/pages/fornecedor/FornecedorAuth.tsx`: usado no `emailRedirectTo` do signup.

## Solução

1. **`src/components/fornecedor/FornecedorLayout.tsx`** — substituir os 3 `navigate("/fornecedor/login")` por `navigate("/auth")` (logout, sessão ausente, conta sem fornecedor associado).

2. **`src/pages/Auth.tsx`** — o botão "Registar nova empresa" continua a apontar para `/fornecedor/login` (que tem o fluxo de registo de 3 passos com lojas). Manter, OU fazer scroll/abrir um diálogo a partir do `/auth`. Decisão: **manter o link para `/fornecedor/login`** porque o fluxo de registo multi-passo ainda vive lá; apenas o logout/guard é que deve voltar a `/auth`.

3. **`src/pages/fornecedor/FornecedorAuth.tsx`** — manter como está (continua a servir registo de novas empresas via link explícito). Sem alterações.

### Comportamento final
- Logout do portal do fornecedor → `/auth` (com toggle no separador Fornecedor pré-selecionado seria ideal, mas requer state; nesta primeira iteração apenas redireciona para `/auth` que abre por defeito no Backoffice — o utilizador clica no toggle "Fornecedor" se quiser voltar a entrar).
- Sessão expirada / conta não vinculada → `/auth`.
- "Registar nova empresa" continua a abrir `/fornecedor/login` (fluxo de registo multi-passo).

### Opcional (recomendado)
Passar `?profile=fornecedor` no `navigate("/auth?profile=fornecedor")` e ler em `Auth.tsx` via `useSearchParams` para pré-selecionar o toggle "Fornecedor" automaticamente após logout. Pequeno ajuste, melhora UX.

### Ficheiros a editar
- `src/components/fornecedor/FornecedorLayout.tsx` — 3 redirects.
- `src/pages/Auth.tsx` — ler `?profile=` e definir state inicial do toggle (opcional mas recomendado).

### Sem alterações
- BD, RLS, `FornecedorAuth.tsx`, fluxo de registo.

### Resultado
Logout do fornecedor passa a voltar para a página de autenticação unificada `/auth`, alinhando com o fluxo actual de login. A página antiga `/fornecedor/login` permanece acessível apenas para registo de novas empresas.
