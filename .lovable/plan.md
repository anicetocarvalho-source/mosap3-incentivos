# Problema

Em `/provincias` aparece "Erro ao carregar contagens" e "Falha ao consultar produtores". Causa: a função `public.get_farmer_counts_by_location` perdeu o GRANT de EXECUTE para `authenticated` (e `anon`), provavelmente após uma recriação recente. Os logs do cliente mostram:

```
permission denied for function get_farmer_counts_by_location (code 42501)
```

O catálogo confirma que só `postgres`, `service_role` e `sandbox_exec` têm privilégios — nenhum role de utilizador autenticado consegue chamá-la.

# Correção

Migração SQL única para reconceder EXECUTE:

```sql
GRANT EXECUTE ON FUNCTION public.get_farmer_counts_by_location TO authenticated, anon;
```

(Mantém-se o `service_role` que já tem acesso. `anon` incluído porque o dashboard público pode invocá-la em rotas não autenticadas; se preferir restringir, removo.)

# Fora de âmbito

- Sem alterações ao corpo da função, RLS, tabelas, ou ao código frontend.
