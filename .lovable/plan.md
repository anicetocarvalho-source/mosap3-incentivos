## Problema

Após login, todas as chamadas à API retornam 401 (`JWT expired`) e o ecrã "Não foi possível carregar os dados" aparece em loop. O token nas requisições tem:

- `iat` = 1778750266 (emitido)
- `exp` = 1778753866 (válido por 1h)
- pedido feito em ~1778769364 (5h depois → genuinamente expirado)

## Causa raiz

`src/lib/authSessionClockSkew.ts` está a tratar **qualquer** token com `expires_at` no passado (até 12h) como "clock skew" e a falsificar `expires_at = now + 1h`. Resultado: o supabase-js acha que o token ainda é válido, **nunca chama refresh**, e o servidor responde 401 indefinidamente.

A correção anterior tentou usar o `iat` do JWT como "relógio do servidor", mas a lógica está invertida: se `|now − iat| > 5min` continua a ajustar — ou seja, sempre que o separador fica algumas horas inativo, cai exatamente neste caminho e bloqueia o refresh.

A verdade é simples:
- **Clock skew real** = relógio local atrasado em relação ao servidor → `iat` aparece **no futuro** relativamente ao `now` local.
- **Token genuinamente expirado** = `iat` no passado e `exp` no passado → tem de ir refrescar, não falsificar.

## Plano de correção

### 1. `src/lib/authSessionClockSkew.ts`
Reescrever `normalizeSessionShape` para só ajustar `expires_at` quando há evidência real de skew:

- Se `iat` não for legível → **não ajustar** (mais seguro deixar o supabase-js refrescar do que mascarar).
- Se `iat <= now` (emitido no passado segundo o relógio local) → token genuinamente envelhecido → **não ajustar**.
- Se `iat > now + CLOCK_SKEW_THRESHOLD` (emitido no "futuro" → relógio local atrasado) → ajustar `expires_at = now + ttl` (skew real).
- Caso contrário → não ajustar.

### 2. `src/hooks/useAuth.tsx`
- No arranque, se `getSession()` devolver sessão com `expires_at` no passado, chamar `supabase.auth.refreshSession()` **uma única vez**. Se falhar → `signOut()` + redirect para `/auth` (já existe, mas confirmar caminho).
- Em `ensureFreshSession`, se `refreshSession()` devolver erro com `refresh_token_not_found`/`invalid_grant`, forçar `signOut()` em vez de tentar de novo.

### 3. `src/hooks/usePatecPendingCount.ts`
Já tem guarda contra auth-error (devolve 0). Manter.

### 4. Limpar storage corrompido (uma vez)
Adicionar, em `normalizeStoredAuthSessionClockSkew`, deteção: se a sessão guardada já tem `expires_at` claramente "esticado" (`expires_at - iat > 1.5 × ttl_normal`), apagá-la para forçar re-login limpo. Isto resolve sessões já corrompidas pela versão antiga do código sem o utilizador ter de limpar manualmente o localStorage.

## Verificação

1. Após aplicar, fazer logout/login.
2. Confirmar que pedidos a `/rest/v1/farmers`, `/rest/v1/profiles`, etc. retornam 200.
3. Deixar o separador inativo > 1h e voltar — deve refrescar automaticamente, sem 401.
4. Verificar no DevTools → Application → Local Storage que `expires_at` da sessão guardada bate certo com o `exp` do JWT (não está esticado).

Sem alterações de schema nem de UI.
