## Alteração no card "Produtores" do Dashboard

No KPI principal **Produtores** (Visão Geral), o subtítulo actual é `{X} aprovados` — o que é enganador, porque todos os produtores carregados estão marcados como aprovados.

### Mudança

Substituir o subtítulo por:

> `do total de 18.000`

Mantendo o valor principal como o número actual de produtores registados no sistema (`stats.totalFarmers`), filtrado pelo âmbito geográfico do utilizador.

### Detalhes técnicos

- Ficheiro: `src/pages/Dashboard.tsx` (linha 114)
- Substituir:
  ```tsx
  subtitle={`${formatNumber(stats.totalApproved)} aprovados`}
  ```
  por:
  ```tsx
  subtitle={`do total de ${formatNumber(18000)}`}
  ```
- A meta `18.000` fica como constante no topo do ficheiro (`META_PRODUTORES = 18000`) para facilitar futura configuração.
- Sem alterações a queries, tipos ou outros componentes.

### Fora de âmbito

- Não vou tornar a meta editável via UI/configurações nesta iteração (posso fazer numa próxima se quiser).
- Não vou alterar outros cards nem lógica de aprovação dos produtores.
