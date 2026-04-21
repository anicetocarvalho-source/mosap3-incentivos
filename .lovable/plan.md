
## Confirmação

Sim — está correcto. As facturas (Série FT) são geradas **automaticamente** a cada venda concluída no Terminal POS, sem qualquer intervenção manual do operador ou do fornecedor.

## Como funciona o fluxo actual

```text
[POS] Venda confirmada
   │
   ├─► next_invoice_number(supplier_id, ano)   ← função SQL (Postgres)
   │     • Lê/incrementa invoice_sequences
   │     • Devolve "FT {ano}/{NNNNN}" (sequencial por fornecedor/ano)
   │
   ├─► INSERT pos_sales
   │     • invoice_number = valor devolvido acima
   │     • subtotal, iva_total, total, payment_status, supplier_id, farmer_*
   │
   ├─► INSERT pos_sale_items (linhas com IVA 14%)
   │
   ├─► UPDATE supplier_products (stock) + INSERT stock_movements
   │
   └─► InvoicePDF + generateFiscalHash + buildQRContent (AGT)
```

## Pontos-chave da geração automática

- **Numeração fiscal**: gerada server-side pela função `next_invoice_number` (atómica via `ON CONFLICT`), garantindo sequência única por `supplier_id` + ano e impedindo saltos/duplicados.
- **Série FT**: formato `FT {ano}/{NNNNN}` (ex.: `FT 2026/00001`), conforme exigido pela AGT Angola.
- **Conformidade fiscal**: cada venda recebe imediatamente `invoice_number`, hash SHA-256 do documento (`generateFiscalHash`) e QR code AGT (`buildQRContent`) na pré-visualização/impressão.
- **Visibilidade no portal**: a página `/fornecedor/facturas` lista todos os `pos_sales` com `invoice_number` preenchido do fornecedor autenticado (filtro por `supplier_id` via `useOutletContext` + RLS `Suppliers can view own sales`).
- **Estados**: `pendente` → `pago` (após confirmação Unitel Money via `pollPaymentStatus`) ou `cancelado`. Apenas as **pagas** entram no cálculo de IVA a liquidar.
- **Notas de Crédito**: emitidas manualmente a partir de uma factura paga (Série NC, `next_credit_note_number`), e descontadas automaticamente no painel "IVA a liquidar".

## Onde isto está implementado

- **Geração**: `src/pages/Mosap3PayPOS.tsx` → função `processSale()` (chama `next_invoice_number` + INSERT em `pos_sales`).
- **Função SQL**: `next_invoice_number(supplier_id, year)` no Supabase (sequência atómica em `invoice_sequences`).
- **Listagem fornecedor**: `src/pages/fornecedor/FornecedorFacturas.tsx` (já implementada).
- **PDF/QR/Hash**: `src/components/InvoicePDF.tsx` (`generateFiscalHash`, `buildQRContent`).

## Conclusão

Não há nada a alterar — o comportamento descrito ("facturas geradas de forma automática a cada venda do POS") **já é exactamente o que o sistema faz hoje**. O fornecedor apenas consome essas facturas no portal, sem precisar criá-las.
