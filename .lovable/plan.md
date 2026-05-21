## Problema

No POS (`/mosap3pay/pos`), depois de identificar e seleccionar o produtor:

- Se o utilizador fechar o diálogo "Tamanho da parcela" sem escolher (ou se a selecção falhar), o cartão do produtor aparece **sem** opção visível para abrir o diálogo da parcela.
- O botão "🌾 Parcela: … · Alterar" em `src/pages/Mosap3PayPOS.tsx` (linhas 2109-2117) só é renderizado quando `parcelSize` já tem valor.
- A única forma de reabrir o diálogo nesse caso é clicar de novo no produtor nas sugestões — o que reinicia o fluxo.

## Correcção (apenas UI, sem alterar lógica de negócio)

Editar `src/pages/Mosap3PayPOS.tsx` no bloco do cartão de produtor identificado:

1. Mostrar **sempre** uma acção de parcela quando existe `farmer` (e ele tem PATEC e saldo > 0 — ou seja, quando o diálogo seria mesmo necessário):
   - Sem `parcelSize`: botão em destaque "🌾 Definir tamanho da parcela" (estilo `text-primary` + sublinhado leve, ou variante `outline` pequeno), que abre `setParcelDialogOpen(true)`.
   - Com `parcelSize`: o actual "🌾 Parcela: <label> · Alterar" mantém-se.
2. Se o produtor não tem PATEC ou tem saldo ≤ 0, manter a mensagem actual sem o botão (a venda já está bloqueada).
3. Garantir que o estado visual deixa claro que falta um passo: usar `text-warning` ou `border-warning` no estado "Definir" para chamar a atenção.

Sem mudanças em `selectFarmerFromSuggestion`, no diálogo, ou em qualquer lógica de cálculo de quantidades. Apenas tornar a entrada para o diálogo permanentemente acessível após identificação.

## Ficheiros tocados

- `src/pages/Mosap3PayPOS.tsx` — apenas o bloco JSX do cartão de produtor identificado (~linhas 2103-2129).
