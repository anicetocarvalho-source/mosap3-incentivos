## Problema

No modo **Kiosk**, a lista de sugestões durante a identificação do produtor (`Mosap3PayPOS.tsx`, linha ~1921) só mostra o PATEC quando existe:

```
{s.code} • {s.phone} • PATEC 1 — Milho
```

Quando o produtor não tem PATEC atribuído, a linha fica sem qualquer indicação — o operador só descobre depois de seleccionar o produtor.

No **Terminal POS** padrão a sugestão também é discreta, mas o cartão pós-selecção (linha 2277) mostra claramente um badge `Sem PATEC` vermelho. O Kiosk já tem esse badge no cartão (linha 1796), mas falta o aviso **na própria lista de sugestões** para evitar selecções inúteis.

## Alteração proposta

Em `src/pages/Mosap3PayPOS.tsx`, no bloco do dropdown de sugestões do Kiosk (`if (kioskMode)`, ~linhas 1916-1925):

- Substituir o texto inline `… • ${patecLabels[s.patec]}` por um **badge visual** à direita da linha (antes do `FarmerSaldoBadge`), com dois estados:
  - **Com PATEC** → badge dourado (`bg-[hsl(45,90%,50%)]/20 text-[hsl(45,90%,60%)]`) com o nome curto do PATEC (`patecLabels[s.patec]`).
  - **Sem PATEC** → badge vermelho (`bg-[hsl(0,70%,40%)]/20 text-[hsl(0,70%,65%)]`) com o texto `Sem PATEC`.
- Reaproveitar exactamente o mesmo estilo já usado no cartão do produtor identificado (linhas 1791-1799) para manter consistência visual dentro do tema escuro Kiosk.
- Aplicar a mesma melhoria à sugestão do Terminal POS padrão (linha 2244) para garantir que mostra também `Sem PATEC` (badge `variant="destructive"`) — hoje só aparece quando há PATEC.

Sem alterações de schema, queries ou lógica de venda — apenas apresentação.

## Validação

- Abrir Kiosk em `/mosap3pay/pos`, pesquisar um produtor com PATEC e outro sem PATEC; confirmar badge dourado vs vermelho na sugestão.
- Repetir no Terminal POS padrão (sair do Kiosk) e confirmar o mesmo comportamento.
