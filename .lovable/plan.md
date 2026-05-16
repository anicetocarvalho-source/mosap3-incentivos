## Diagnóstico

O login com `admin@mosap3.test` / `teste123` devolve `400 invalid_credentials` porque **as 9 contas demo simplesmente não existem na base de dados de autenticação**:

- `auth.users` = 0 registos
- `public.user_roles` = 0 registos

A edge function `seed-test-users` já existe e cria as 9 contas + perfis + roles, mas exige que o caller seja `admin` — o que é impossível quando ainda não há nenhum utilizador. Daí o impasse atual.

## Plano

1. **Adicionar modo bootstrap à `seed-test-users`**
   - Se `auth.users` tiver 0 registos (ou nenhum admin existir), permitir a invocação sem JWT.
   - Caso já exista um admin, manter o comportamento atual (exigir JWT de admin).
   - Adicionar `verify_jwt = false` em `supabase/config.toml` para esta função, controlando a autorização dentro do código.

2. **Invocar a função uma vez** a partir do botão "Auto-preencher" no `/auth` (ou diretamente via `supabase.functions.invoke('seed-test-users')`) para criar as 9 contas com password `teste123`, marcar email como confirmado e atribuir as roles corretas.

3. **Adicionar um aviso visual em `/auth`**: se o utilizador clicar num perfil demo e o login falhar com `invalid_credentials`, mostrar um botão **"Criar contas demo"** que chama a edge function e tenta o login outra vez.

4. **Verificação**
   - Após executar a seed: `select count(*) from auth.users` deve retornar 9.
   - Login com qualquer perfil demo deve passar e redirecionar para `/`.
   - As roles devem aparecer em `user_roles` para que o RBAC funcione.

## Detalhes técnicos

- Manter `SUPABASE_SERVICE_ROLE_KEY` apenas dentro da edge function (nunca exposto ao cliente).
- A função continua idempotente: contas já existentes são puladas, apenas roles/perfis em falta são adicionados.
- Não tocar em `src/integrations/supabase/client.ts` nem em `supabase/config.toml` na parte `project_id`.
