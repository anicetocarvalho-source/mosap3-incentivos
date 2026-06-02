## Diagnóstico

As funcionalidades **estão implementadas e acessíveis**, mas ficaram "escondidas":

| Funcionalidade | Estado real | Onde está hoje |
|---|---|---|
| Análise de Preços | OK — rota `/mosap3pay/analise-precos` + RoleGuard admin/gestor_incentivos | Apenas no dropdown do menu superior "MOSAP3Pay" (item nº 10 numa lista de 16) |
| Marcar alerta como "revisto" | OK — botão dentro da página Análise de Preços | Só visível depois de abrir Análise de Preços |
| Notificações de severidade alta | OK — trigger BD + sino `NotificationBell` no header | Sino existe mas sem indicação contextual no hub MOSAP3Pay |
| Outras features recentes (Notas de Crédito, Reconciliação, Stock, Ocorrências, Auditoria, Painel de Vendas, Cartões SIM) | OK — todas com rota e link no dropdown | Idem: só no dropdown |

**Causa raiz:** o hub `/mosap3pay` (Dashboard MOSAP3Pay, o que o utilizador abre primeiro) só mostra **3 cards rápidos** (Fornecedores, POS, Histórico de Vendas). Tudo o resto vive escondido no submenu da barra do topo, o que dá a falsa impressão de que "não está disponível".

Não é problema de permissões (o utilizador é admin, `module_permissions` está populada, RoleGuards passam) nem de rota em falta.

## Plano

Reorganizar o hub `/mosap3pay` para expor **todas as funcionalidades** do módulo comercial, com destaque para as novas. Sem alterar lógica de negócio, RLS ou rotas.

### 1. Reescrever a grelha de acessos rápidos no hub MOSAP3Pay
Substituir os 3 cards atuais por uma grelha responsiva (2/3/4 colunas) agrupada por área:

```text
Operação          Catálogo & Stock     Análise & Controlo       Administração
- Terminal POS    - Fornecedores       - Análise de Preços ★    - Configurações
- Vendas          - Stock              - Painel de Vendas       - Auditoria
- Facturas        - Aprovação Fornec.  - Reconciliação          - Cartões SIM
- Notas Crédito                        - Relatórios MOSAP3Pay   - Ocorrências
```

Cada card: ícone, título, 1 linha de descrição, badge "Novo" nos itens recentes (Análise de Preços, Notas de Crédito, Painel de Vendas), botão `Link` para a rota.

### 2. Banner contextual de alertas de preço
No topo do hub, se existirem alertas `severidade='alta'` não revistos do utilizador atual:
- Card destacado (cor `warning`) com contagem ("3 fornecedores com preços anormais")
- CTA "Rever alertas" → `/mosap3pay/analise-precos`

Usa a mesma query já existente em `usePriceAnalysis` (filtra `revisto_em IS NULL` e `severidade='alta'`).

### 3. Pequena melhoria de descoberta no menu
No dropdown "MOSAP3Pay" do `AppNavbar`, adicionar um separador visual (`border-t`) entre grupos para facilitar a leitura dos 16 itens, e badge `Novo` ao lado de "Análise de Preços", "Notas de Crédito" e "Painel de Vendas" durante 30 dias.

### Detalhes técnicos

- Ficheiros a alterar:
  - `src/pages/Mosap3Pay.tsx` — substituir bloco de Quick Actions (linhas ~103-146) pela nova grelha + banner
  - `src/components/AppNavbar.tsx` — separadores e badges no submenu MOSAP3Pay (linhas 108-125)
- Sem alterações a base de dados, RLS, hooks, ou tipos
- Reutilizar tokens semânticos (`text-primary`, `text-warning`, `text-info`, `Badge variant="secondary"`)
- Layout 100% responsivo (1 coluna no mobile, 2 no tablet, 4 no desktop)

### Fora do âmbito

- Não mexer em permissões (`module_permissions` está OK)
- Não alterar a lógica de cálculo de alertas nem o trigger de notificações
- Não tocar no portal do fornecedor