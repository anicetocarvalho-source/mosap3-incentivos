

## Investigação: Plataforma "sem dados"

### Resultado

A base de dados **não está vazia** — tem 10 905 agricultores, 70 394 transações e ~3 mil milhões Kz de incentivos recebidos. Se vê tudo a zero no ecrã, **o problema é de visibilidade no front-end**, não de ausência de dados.

### Tabelas com dados vs vazias

| Tem dados | Vazia |
|---|---|
| farmers (10 905) | farmer_incentives |
| farmer_transactions (70 394) | farmer_parcels |
| schools (733) | farmer_production (apenas 1) |
| suppliers (13) | livestock |
| orphan_phones (3 399) | pos_sales |

### Causa mais provável (a confirmar consigo)

1. **Sessão / role**: o seu utilizador tem que ter um `user_role` de backoffice (admin, gestor_incentivos, etc.). Se a sessão expirou ou não tem role, **todas as RLS bloqueiam o SELECT** e a UI mostra zero. — **Mais provável**.
2. **Filtros geográficos ativos**: o dashboard filtra por província/ECA do utilizador. Se o seu utilizador estiver associado a uma província **sem** dados, vê tudo vazio.
3. **Fluxo histórico**: incentivos foram registados em `farmers.valor_recebido` (não em `farmer_incentives`), e POS/Parcelas/Pecuária nunca foram usados em produção. Isto é **real** — precisa de ser preenchido ou a UI ajustada para refletir esse modelo.

### Próximos passos propostos

A. **Confirmar a causa imediata** — diga-me:
   - Está autenticado? Que email/role?
   - Em que página(s) específica(s) vê "sem dados"? (/, /agricultores, /incentivos, /transacoes…)
   - Vê erro na consola do browser?

B. Conforme a resposta, corrigirei uma destas coisas:
   - **Se for sessão/RLS**: validar `user_roles` e re-login.
   - **Se for filtro geográfico**: rever associações em `user_provinces`.
   - **Se for "incentivos não migrados"**: criar uma migração que materializa um registo em `farmer_incentives` por cada bloco importado (a partir de `farmer_balance_history` que já regista a fonte), ou ajustar a UI de /incentivos para ler de `farmers.valor_recebido` + `farmer_balance_history` em vez de `farmer_incentives`.

Sem este passo de confirmação não faço alterações — quero evitar inserir dados ou mexer em RLS sem saber qual é o cenário real.

