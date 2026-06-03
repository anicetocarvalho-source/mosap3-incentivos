
## Objetivo

Permitir que o fornecedor crie **vendedores** (com username + PIN curto) e que cada terminal POS opere com um vendedor autenticado e um **turno aberto**, para saber em qualquer momento quem vendeu o quê.

## Modelo de funcionamento

- O dono do fornecedor continua a entrar com email + password.
- Dentro do portal cria/gere vendedores: nome, username único por fornecedor, PIN 4–6 dígitos, estado ativo/inativo.
- Vendedor é do **fornecedor** (pode operar em qualquer POS / loja).
- No POS, antes de vender, faz‑se "login de turno": escolhe o POS, escolhe o vendedor, introduz PIN → abre `pos_shift` (caixa). Todas as vendas dessa sessão gravam `seller_id` e `shift_id`.
- No fim do dia o vendedor (ou o dono) **fecha o turno**: o sistema regista totais (nº de vendas, total bruto, IVA, métodos de pagamento) e timestamp de fecho. Turno fechado fica imutável.
- Relatórios por vendedor / por turno / por dia.

## Base de dados (migração)

Novas tabelas em `public`:

1. **`supplier_sellers`**
   - `supplier_id` (FK suppliers), `full_name`, `username` (único por fornecedor), `pin_hash` (PBKDF2/bcrypt via pgcrypto, nunca PIN em claro), `pin_salt`, `is_active`, `created_by`, timestamps.
   - Índice único `(supplier_id, lower(username))`.

2. **`pos_shifts`**
   - `supplier_id`, `seller_id` (FK supplier_sellers), `pos_id` (FK supplier_pos, opcional), `opened_at`, `closed_at`, `status` ('aberto'|'fechado'), `opening_note`, `closing_note`.
   - `totals` jsonb consolidado no fecho (nº vendas, subtotal, iva, total, por método).
   - Constraint: no máximo um turno `aberto` por `(seller_id, pos_id)`.

3. **`pos_sales`** — adicionar colunas `seller_id uuid`, `shift_id uuid`, `seller_name text` (snapshot), índices por ambos. Backfill = NULL para vendas anteriores.

Funções SECURITY DEFINER (parametrizadas, nada de SQL dinâmico):
- `supplier_seller_login(_supplier_id, _username, _pin)` → valida hash, devolve `seller_id` + dados básicos. Rate‑limit simples por (supplier_id, username) via tentativas falhadas (campo `failed_attempts`, `locked_until`).
- `open_pos_shift(_seller_id, _pos_id, _note)` → cria turno aberto.
- `close_pos_shift(_shift_id, _note)` → consolida totais a partir de `pos_sales` e marca fechado.
- `supplier_seller_set_pin(_seller_id, _new_pin)` → só dono do fornecedor / admin.

RLS:
- Dono do fornecedor (user_id = auth.uid() em `suppliers`) gere os seus vendedores e turnos (SELECT/INSERT/UPDATE).
- Admin backoffice vê tudo.
- `pos_sales` mantém RLS atual; trigger garante que `seller_id`/`shift_id`, se preenchidos, pertencem ao mesmo fornecedor.
- GRANTs explícitos para `authenticated` e `service_role`.

Auditoria: `audit_logs` para criação/desativação de vendedor, alteração de PIN, abertura/fecho de turno.

## Frontend

Páginas/components novos no portal do fornecedor:

```text
/fornecedor/vendedores       → FornecedorVendedores.tsx (lista + dialog criar/editar + reset PIN + ativar/desativar)
/fornecedor/turnos           → FornecedorTurnos.tsx (lista turnos por data/vendedor/POS; ver totais; reabrir indisponível)
```

POS (`Mosap3PayPOS` / `FornecedorPOSVenda`):
- Novo gate "Abrir turno": seleciona POS + vendedor + PIN → chama `supplier_seller_login` e `open_pos_shift`.
- Cabeçalho mostra "Vendedor: X · Turno aberto há Yh · Vendas: N".
- Botão "Fechar turno" no menu (confirma totais e bloqueia novas vendas até abrir outro).
- Sessão de turno guardada em `sessionStorage` (não localStorage) para não fugir entre operadores; expira ao fim de N horas configurável (default 12h) e ao fechar.
- Cada `pos_sales.insert` passa a incluir `seller_id` + `shift_id` + `seller_name`.

Navbar do portal do fornecedor: adicionar "Vendedores" e "Turnos" (badge "Novo" durante 14 dias). Atalho "Vendedores" também no Dashboard do fornecedor.

Relatórios (`FornecedorVendas`, `FornecedorDashboard`): novos filtros por vendedor e por turno; coluna "Vendedor" na tabela de vendas; agregados por vendedor/dia.

## Validação

- Zod nos forms (PIN: 4–6 dígitos numéricos; username: 3–30 chars alfanuméricos + ponto/underscore; nome obrigatório).
- Testes vitest novos:
  - hash de PIN (sucesso/falha/lock após 5 tentativas);
  - abrir/fechar turno (não permite 2 abertos simultâneos);
  - venda sem turno aberto é rejeitada no POS.
- Teste manual no preview com 2 vendedores em paralelo.

## Fora de âmbito

- Conta Lovable Cloud individual por vendedor (continua a haver 1 conta = dono).
- Comissões e folha de pagamento por vendedor.
- Login offline de vendedor (a primeira versão exige rede para validar PIN; podemos adicionar offline depois reaproveitando `offlineAuth`).
