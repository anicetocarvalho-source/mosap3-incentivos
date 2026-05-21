## Objectivo

O Modo Kiosk do POS (`src/pages/Mosap3PayPOS.tsx`, bloco `if (kioskMode)` em ~1553-1990) partilha já a lógica de negócio com o POS normal (mesmo estado, mesmo `addToCart`, mesmo OTP, mesmo `computeSaldoFinal`), mas a **UI Kiosk não reflecte vários avisos e indicadores** introduzidos no POS completo. Resultado: o operador em modo loja/kiosk não vê bloqueios SIM, checklist PATEC, "sem PATEC", limites por produto, etc.

Este plano alinha visualmente o Kiosk com o POS normal, mantendo o tema escuro dedicado (HSL inline) e sem mexer em lógica.

## Lacunas identificadas (POS normal → Kiosk)

| # | Funcionalidade no POS | Estado no Kiosk |
|---|---|---|
| 1 | Alerta SIM bloqueado / "Pré desactivado" com botão "Contactar gestor" | Ausente |
| 2 | Card "Itens do PATEC" (checklist com ✓ / sem stock / indisponível) | Ausente |
| 3 | Aviso "Sem PATEC atribuído" quando `farmer.patec` é null | Ausente |
| 4 | Botão "Definir tamanho da parcela" (warning quando não escolhido) | Só mostra pill se já escolhido |
| 5 | Badge PATEC + aviso "⚠ Sem saldo — compras bloqueadas" no painel do produtor | Saldo aparece, mas sem badge PATEC nem aviso explícito |
| 6 | "Resta: N" por produto (limite `max_per_farmer_per_season`) | Só desactiva o cartão; não mostra contador |
| 7 | Badge "Sem stock" no produto | Ausente (só não aparece se stock=0 nada distingue) |
| 8 | Badge "Filtrado por PATEC X" no cabeçalho dos produtos | Ausente |

OTP, parcela-dialog e confirmação reutilizam os mesmos dialogs (`{/* Kiosk dialogs reuse normal dialogs */}`) — já correctos.

## Alterações

Tudo dentro do bloco `if (kioskMode) { return (...) }` em `src/pages/Mosap3PayPOS.tsx`. Sem novas dependências, sem novas tabelas.

### 1. Painel do produtor seleccionado (≈ linhas 1683-1702)

- Adicionar badge PATEC (ou badge vermelho "Sem PATEC") ao lado do nome.
- Quando `farmer.patec && !parcelSize && farmerBalance > 0`, mostrar botão warning "🌾 Definir tamanho da parcela" (mesmo padrão de `setParcelDialogOpen(true)`).
- Quando `farmerBalance <= 0`, linha extra "⚠ Sem saldo — compras bloqueadas" em vermelho.

### 2. Alerta SIM (a inserir após o painel do produtor, antes do bloco PATEC)

Replicar o bloco `isSimBlocked(farmer.sim_status) || sim_status === "Pré desactivado"` do POS normal, adaptado ao tema escuro (cores HSL Kiosk: vermelho `hsl(0,70%,55%)` para bloqueado, âmbar `hsl(45,90%,55%)` para aviso). Incluir botão "Contactar gestor" (reusa `setContactConfirmOpen(true)` + `loadManagers()`).

### 3. Checklist "Itens do PATEC" colapsável

Novo bloco no painel direito (ou como faixa acima do carrinho) quando `farmer && patecItems.length > 0`:
- Lista compacta com ícone ✓ (disponível com stock), ⚠ âmbar (sem stock) ou ⚠ esbatido (indisponível), agrupada por categoria (Insumos / Pecuária / Serviços).
- Mesma fonte de verdade que o POS normal (`patecItems` + `products`).
- Estilo escuro: fundo `hsl(220,15%,13%)`, texto `hsl(0,0%,85%)`, sucesso `hsl(120,60%,55%)`, aviso `hsl(45,90%,55%)`.

### 4. Grid de produtos (≈ linhas 1627-1655)

- Adicionar badge "Resta: N" em cima à direita quando `p.max_per_farmer_per_season` definido (cor âmbar; vermelho se `remaining <= 0`).
- Adicionar pequena tag "Sem PATEC do produtor" sobreposta quando `!farmer?.patec` (em vez de só `toast.info` ao clicar).
- Adicionar badge "Sem stock" se `p.stock === 0`.

### 5. Cabeçalho da grid de produtos

Mostrar pequeno chip "Filtrado por {patecLabels[farmer.patec]}" junto ao título quando há produtor com PATEC.

## Detalhes técnicos

- Toda a lógica já existe (`patecItems`, `getRemainingLimit`, `isSimBlocked`, `simStatusReason`, `patecLabels`, `setContactConfirmOpen`, `loadManagers`, `setParcelDialogOpen`). Apenas adicionamos JSX no ramo Kiosk.
- Manter classes HSL inline (memória `style/design-tokens-semanticos` — Kiosk usa HSL distinto, não tokens semânticos).
- Sem alterações no painel `else` (POS normal) nem nos dialogs partilhados.
- Sem alterações de DB, RLS ou edge functions.

## Verificação

- Build do projecto (automática).
- Manual no preview `/mosap3pay/pos` → F5 para entrar em Kiosk:
  1. Pesquisar produtor sem PATEC → ver aviso "Sem PATEC".
  2. Produtor com PATEC e sem parcela definida → ver botão "Definir parcela".
  3. Produtor com SIM bloqueado/Pré desactivado → ver alerta + botão "Contactar gestor".
  4. Confirmar checklist "Itens do PATEC" com ✓/sem stock/indisponível.
  5. Produto com `max_per_farmer_per_season` → ver "Resta: N".
