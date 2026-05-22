## Estado actual

Os 8 itens identificados no plano anterior já foram implementados no bloco `if (kioskMode)` de `src/pages/Mosap3PayPOS.tsx`:

- Badge PATEC / "Sem PATEC" + telefone + aviso "Sem saldo" + botão "Definir parcela" no painel do produtor.
- Alerta SIM bloqueado / "Pré desactivado" com botão **Contactar gestor**.
- Checklist colapsável "Itens do PATEC" (✓ / Sem stock / Indisp.).
- Chip "Filtrado por PATEC X" e aviso "Produtor sem PATEC" na grid.
- Badge "Resta: N" (limite por época) e badge "Sem stock" por produto.
- Bloco `patecBlock` (venda bloqueada por época) já partilhado.
- OTP Unitel Money, parcela-dialog e diálogo de confirmação reutilizam os fluxos do POS normal.

## O que falta para fechar

Pequenos polimentos de consistência — nenhum bloqueador funcional:

### 1. Consistência de formatação de saldo (UX)
No painel do produtor seleccionado (linhas ~1725-1729) o saldo é renderizado com `farmerBalance.toLocaleString("pt-AO")`. Substituir pelo componente partilhado **`FarmerSaldoBadge variant="kiosk"`** (já usado nas sugestões, linha 1857) para garantir uso de `computeSaldoFinal` e `formatKzCompact` — alinhado com a memória `features/padrao-listagens-sistema` e a regra core do saldo canónico.

### 2. Linha de saldo no diálogo de confirmação
O `confirmOpen` Kiosk (linhas ~2019-2048) já mostra "Saldo restante", mas não mostra o **saldo actual antes da compra** nem o aviso quando `farmerBalance <= 0` (caso o operador abra o dialog mesmo assim). Adicionar uma linha "Saldo actual" acima de "Saldo restante" para paridade com o POS normal.

### 3. Atalhos visíveis (descoberta)
O botão `Settings2` no topbar (linha 1599-1601) tem só `title="Atalhos: F1-F5"`. Trocar por um `Popover`/tooltip com a lista real (F1 = pesquisar produtor, F2 = pesquisar produto, F3 = limpar carrinho, F4 = emitir, F5 = sair Kiosk — confirmar mapeamento no `useEffect` linhas 493-507).

### 4. Verificação manual (checklist final)
No preview `/mosap3pay/pos` → **F5** para entrar em Kiosk e validar:
- Produtor sem PATEC → ver aviso vermelho na grid + badge "Sem PATEC" no painel.
- Produtor com PATEC, sem parcela definida → botão "🌾 Definir parcela" visível.
- Produtor com `sim_status` bloqueado → alerta + botão "Contactar gestor" funcional.
- Checklist "Itens do PATEC" mostra ✓ / "Sem stock" / "Indisp." corretamente.
- Produto com `max_per_farmer_per_season` → badge "Resta: N" actualiza ao adicionar ao carrinho.
- Bloco `patecBlock` (época encerrada) aparece sticky acima do carrinho.

## Detalhes técnicos

- Todas as alterações dentro do bloco Kiosk; sem mudanças no POS normal nem em dialogs partilhados.
- Sem novas dependências, sem alterações de DB/RLS/edge functions.
- Manter HSL inline (tema Kiosk dedicado — memória `style/design-tokens-semanticos`).
- Build automático verifica TypeScript.

## Resumo

Funcionalmente o Kiosk está em paridade com o POS. Para "fechar" formalmente só faltam: (1) trocar saldo por `FarmerSaldoBadge`, (2) acrescentar "Saldo actual" no confirm, (3) popover com lista de atalhos, e (4) executar a checklist manual no preview.
