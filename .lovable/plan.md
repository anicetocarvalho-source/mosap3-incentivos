## Problema

No POS, depois de identificar o agricultor, o diálogo "Tamanho da parcela" abre, mas quando se clica numa opção (0,3 / 0,5 / 1 Ha) a selecção só fica efectiva ao segundo clique — só nessa altura o botão "Alterar parcela" aparece e o sistema reconhece o valor.

## Causa provável

Em `src/pages/Mosap3PayPOS.tsx` o `Dialog` de selecção da parcela (linhas 2398 e 1805 — versão normal e versão kiosk) tem este handler:

```ts
onOpenChange={(o) => { if (!o && parcelSize === null) return; setParcelDialogOpen(o); }}
```

Combinado com botões `<button>` sem `type="button"` dentro do `DialogContent`, e com `handleSelectParcel` que faz `setParcelSize(size)` e `setParcelDialogOpen(false)` no mesmo tick, o primeiro clique:

1. Move o foco para o botão (Radix faz focus trap ao abrir),
2. Dispara o evento, mas como `parcelSize` ainda é `null` no closure inicial, a guarda do `onOpenChange` bloqueia o fecho que o Radix tenta propagar ao perder foco,
3. Só no segundo clique o `parcelSize` já está definido e a sequência completa.

## Correcção (apenas UI/estado, sem mudar lógica de negócio)

Aplicar nos dois diálogos (normal em ~L2398 e kiosk em ~L1805):

1. Adicionar `type="button"` em cada botão de opção (PARCEL_OPTIONS.map) para evitar comportamento submit/focus default.
2. Substituir o `onOpenChange` por uma versão sem closure obsoleta — usar a callback funcional / ref ou simplesmente:
   ```ts
   onOpenChange={(o) => {
     if (!o && !parcelSize) return; // mantém aberto apenas quando ainda não há selecção
     setParcelDialogOpen(o);
   }}
   ```
   e garantir que `handleSelectParcel` faz, por ordem síncrona:
   ```ts
   setParcelSize(size);
   setParcelDialogOpen(false);
   if (patecItems.length > 0) prefillCartFromPatec(patecItems, size);
   ```
   já está assim — o problema é só o `type` em falta + foco. Adicionalmente, usar `onClick` directo no botão com `e.preventDefault()` para garantir que não há bolha.
3. Fechar o diálogo via mudança de estado controlada (já é o caso) e confirmar que não há `<form>` ascendente que esteja a interceptar o clique como submit.

## Validação

- Identificar agricultor no POS → diálogo abre.
- Clicar uma vez em "0,5 Ha" → diálogo fecha imediatamente, o cartão do agricultor passa a mostrar "🌾 Parcela: 0,5 Ha · Alterar".
- Clicar em "Alterar" reabre o diálogo, nova selecção aplica também ao primeiro clique e recalcula o carrinho.
- Repetir em modo kiosk para confirmar paridade.

## Ficheiros afectados

- `src/pages/Mosap3PayPOS.tsx` (apenas os dois blocos do `Dialog` da parcela e o `handleSelectParcel`).
