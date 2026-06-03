## Objectivo

Remover por completo a selecção do **tamanho da parcela / área** do fluxo de venda do POS. A quantidade de cada produto passa a vir directamente do Pacote Tecnológico (PATEC) atribuído ao agricultor — sem multiplicador por hectares.

## Onde está hoje

A selecção de parcela só existe no POS principal do backoffice (`src/pages/Mosap3PayPOS.tsx`). O POS do portal do fornecedor (`FornecedorPOSVenda.tsx`) já não usa parcela. As páginas de vendas/facturas apenas **exibem** o `parcel_size_label` quando ele existe em vendas antigas.

## Alterações

### 1. `src/pages/Mosap3PayPOS.tsx` (limpeza completa)

- Remover constantes `PARCEL_OPTIONS` e `PARCEL_REFERENCE`.
- Remover estado `parcelSize` e `parcelDialogOpen`.
- Substituir `computeRecommendedQty(item, parcel)` por uma leitura directa de `item.base_quantity` (sem factor). Itens sem `base_quantity` mantêm `recommendedQty = 0` (sem tecto).
- `prefillCartFromPatec(items)` deixa de receber `parcel` e usa apenas `base_quantity` para pré-carregar o carrinho assim que o PATEC do agricultor é detectado.
- Remover todas as validações `!parcelSize` (botões de OTP/confirmar deixam de exigir parcela).
- Remover os dois diálogos "Tamanho da parcela" (kiosk e modo normal) e todos os botões "Definir/Alterar parcela" no header, no carrinho e no modal de confirmação.
- No `insert` em `pos_sales`, passar `parcel_size: null` e `parcel_size_label: null` (as colunas são nullable, mantém-se compatibilidade com dados antigos).
- Mensagens de toast relacionadas com parcela são removidas.

### 2. Histórico (sem alterações de schema)

- `Mosap3PayVendas.tsx`, `Mosap3PayFacturas.tsx`, `FarmerProfile.tsx`, `InvoicePDF.tsx`, `FornecedorFacturas.tsx` continuam a **mostrar** "Parcela X" só quando a venda antiga tiver esse campo preenchido. Vendas novas deixam de exibir.
- Colunas `parcel_size` e `parcel_size_label` na tabela `pos_sales` ficam intactas (nullable) para preservar histórico fiscal/AGT. Não há migração de BD.

## Fora de âmbito

- Nenhuma alteração ao módulo PATEC nem ao cálculo de composições.
- Sem alterações ao portal do fornecedor (já não dependia de parcela).
- Sem migração de dados nem remoção das colunas legacy em `pos_sales`.

## Verificação

- Abrir o POS, identificar um agricultor com PATEC → carrinho é pré-carregado automaticamente pelas quantidades do PATEC, sem pedir parcela.
- Confirmar venda → fluxo OTP/pagamento prossegue sem bloqueios.
- Abrir uma factura antiga que tinha parcela → continua a mostrar "Parcela X" no detalhe e no PDF.
- Vendas novas em `/mosap3pay/vendas` não mostram chip de parcela.
