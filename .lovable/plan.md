## Diagnóstico

Em base de dados existem apenas **12 telefones verdadeiramente órfãos** (1.215.840,00 Kz). Confirmado em duas queries independentes:

```text
total = 3.399
auto-associados (linked + notes "Auto…") = 3.387
manuais = 0
pendentes (linked_farmer_code IS NULL) = 12
```

A página mostra ~1.000 pendentes. A causa é o **service worker PWA**: em `vite.config.ts` o padrão `^https://*.supabase.co/rest/v1/*` está em `NetworkFirst` com cache de 24h. Como a primeira página (`amount` desc, range 0-999) foi cacheada **antes** da reconciliação automática (quando ainda havia ~1.000 NULLs no topo), o browser continua a servir esse snapshot em cima de Ctrl+Shift+R (o hard reload limpa cache HTTP do browser, não a Cache API do SW).

## Alterações

### 1. Bypass de cache para `orphan_phones` (frontend)

Em `src/pages/TelefonesOrfaos.tsx`, alterar o `load` para forçar resposta fresca:

- Adicionar header `Cache-Control: no-cache` à query (via `supabase.from(...).select(..., { head: false }).abortSignal(...)` não suporta headers; em alternativa, anexar um query-param "cache-buster" `?_=${Date.now()}` recriando o URL não é trivial via SDK).
- **Solução prática:** dentro do `load`, primeiro chamar `caches.delete('supabase-api')` (apaga o bucket Workbox correspondente) e só depois invocar `fetchAllPages`. Isto garante que cada `Atualizar` traz dados reais.
- Mostrar timestamp "Última actualização: HH:MM:SS" junto ao botão Atualizar para o utilizador perceber que os dados são frescos.

### 2. Excluir `orphan_phones` do cache do SW (definitivo)

Em `vite.config.ts`, antes do padrão genérico Supabase REST, adicionar regra `NetworkOnly` para esta tabela:

```ts
{
  urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/orphan_phones.*/i,
  handler: "NetworkOnly",
},
```

Assim, futuras visitas nunca apanham dados desactualizados desta tabela (que é sempre admin-only e pequena).

### 3. Botão "Reconciliar pendentes agora"

Acrescentar acção no `PageHeader` (visível só para admin) que invoca a RPC já existente `bulk_insert_orphan_phones` com payload vazio `[]`. A função normaliza/agrega e tenta auto-associar todos os pendentes pelos últimos 9 dígitos — útil quando novos agricultores são criados depois do upload original. O toast mostra `auto_linked` e `still_orphan` devolvidos pela RPC.

### 4. Aviso visual quando o SW serve dados antigos

Comparar o `count(*)` lido com o cabeçalho `Content-Range` da primeira página de `fetchAllPages`. Se diferir do número de linhas obtidas, mostrar `Alert` warning a sugerir recarregamento.

## Fora do âmbito

- Sem alterações de schema, RLS ou da função `bulk_insert_orphan_phones`.
- Sem mexer noutras páginas que consumam `orphan_phones`.
- Sem alterar outras regras Workbox (apenas adicionar a entrada específica para `orphan_phones`).

## Resultado esperado

- Cards passam a mostrar **Pendentes: 12 (1.215.840,00 Kz)** imediatamente após o próximo carregamento da página.
- Re-deploys posteriores deixam de exibir contagens fantasma porque a tabela é sempre lida da rede.
- Admin pode forçar nova reconciliação a qualquer momento sem precisar reabrir o ficheiro CSV.
