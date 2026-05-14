## Diagnóstico

Os logs de rede mostram dezenas de pedidos `HEAD /rest/v1/farmers?...&status=neq.Removido` a devolver **401** de minuto em minuto, sempre com o **mesmo JWT já expirado** (`exp` ≈ 13:37, pedidos a partir das 13:52). Ou seja: o token está caducado, o Supabase não o renova e o `usePatecPendingCount` (intervalo de 60 s) continua a martelar a API até "tudo parecer não carregar".

A causa raiz está em `src/lib/authSessionClockSkew.ts`:

```ts
const skew = now - expiresAt;
if (skew <= 5*60 || skew > 12*60*60) return { session, adjusted: false };
// caso contrário: expires_at = now + 3600  ← falsifica a expiração
```

Qualquer sessão **realmente expirada** entre 5 min e 12 h é tratada como "desvio de relógio" e o `expires_at` é reescrito para o futuro. Consequência:

1. O cliente Supabase pensa que o token ainda é válido → **nunca** faz auto-refresh.
2. `ensureFreshSession` vê `msUntilExpiry > 2 min` → também não refresca.
3. O servidor rejeita com 401 porque o JWT está mesmo expirado.
4. Não há `SIGNED_OUT`, não há redirect para `/auth`, e os pollers (PATEC, futuros sinais de cache) continuam a falhar em loop.

A heurística de skew confunde "token caducado por inatividade" com "relógio do cliente atrasado".

## Plano

### 1. Corrigir a normalização de clock-skew (`src/lib/authSessionClockSkew.ts`)
Só ajustar quando houver evidência real de relógio do cliente errado, não em qualquer expiração no passado.

- Usar o `iat` do `access_token` (decodificar o JWT sem validar) como referência do relógio do servidor.
- Considerar skew apenas se `Math.abs(now - iat) > 5 min` **e** o token foi emitido há pouco (`iat` próximo do `expires_at - ttl`).
- Se `iat <= now` e `expires_at < now` → token genuinamente expirado: **não tocar** em `expires_at`; deixar o cliente Supabase fazer refresh normal.
- Manter o limite máximo de ajuste (12 h) e o TTL por omissão.

### 2. Forçar recuperação quando uma sessão expirada é detectada (`src/hooks/useAuth.tsx`)
- No arranque, se `getSession()` devolver sessão com `expires_at < now` (sem ajuste falso), chamar `refreshSession()` uma vez; se falhar, `signOut()` + redirect para `/auth` (já existente, mas garantir que dispara).
- Em `ensureFreshSession`, refrescar também quando o token **já expirou** (hoje só refresca se faltar < 2 min, o que com o bug ficava sempre falso).

### 3. Parar o loop de 401 do `usePatecPendingCount` (`src/hooks/usePatecPendingCount.ts`)
- Capturar erros de auth (status 401 / mensagens `JWT expired` / `invalid token`) e, ao detectá-los, chamar `ensureFreshSession` (ou `supabase.auth.refreshSession()`) e desistir desse fetch sem agendar nova tentativa imediata.
- Reduzir `refetchInterval` para 5 min (300 000 ms) em vez de 60 s para baixar a pressão; manter `refetchOnWindowFocus` para frescura quando o utilizador volta ao separador.
- Manter `enabled: !!user && authReady` para não correr enquanto a auth não está pronta.

### 4. Verificação
- Recarregar a app: a sessão expirada deve desencadear refresh ou redirect para `/auth` em vez de 401 em loop.
- Confirmar nos logs de rede que deixam de aparecer 401 repetidos.
- Confirmar que após login as páginas (Dashboard, Escolas, Auditoria) voltam a carregar dados.

### Notas técnicas
- A decodificação do JWT é apenas leitura do payload (`atob` do segundo segmento); não valida assinatura.
- Não mexer em `src/integrations/supabase/client.ts`.
- Nenhuma migração de base de dados é necessária.