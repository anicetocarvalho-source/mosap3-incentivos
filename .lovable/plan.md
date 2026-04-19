
O utilizador quer reforçar o fluxo do POS para que:
1. Pesquisa de agricultor por nome ou telefone (já existe parcialmente).
2. Validação de saldo disponível (já existe).
3. Restringir produtos ao PATEC do agricultor (já existe).
4. **NOVO**: Após selecionar agricultor, perguntar tamanho da parcela (0.3, 0.5 ou 1 Ha).
5. **NOVO**: Quantidades dos produtos pré-calculadas em função do PATEC × tamanho da parcela.
6. **NOVO**: Bloquear aquisição fora dessas quantidades/produtos definidos.

Preciso ver o POS actual e a tabela patec_items para perceber se há quantidades por item ou se são apenas nomes.

Vou planear sem mais inspecção (já tenho contexto suficiente do schema e summaries).

## Plano

### Diagnóstico
- `patec_items` actualmente só guarda `patec_number`, `category`, `name` — **não tem quantidade base** por item nem por área de referência.
- `Mosap3PayPOS.tsx` já filtra produtos por PATEC e valida saldo, mas:
  - Permite entrar produtos arbitrários do catálogo do fornecedor (desde que partilhem `patec_number`).
  - Não pergunta área, não pré-calcula quantidades, e a quantidade é livre até `max_per_farmer_per_season`/stock.

### Alterações de Base de Dados (migração)

1. **`patec_items`** — adicionar:
   - `base_quantity numeric` (quantidade recomendada para parcela de referência de **0.5 Ha**).
   - `unit text` (kg, L, un...) para dar consistência.
2. **`pos_sales`** — adicionar:
   - `parcel_size numeric` (0.3, 0.5 ou 1).
   - `parcel_size_label text` (ex.: "0,5 Ha").

Nada destrutivo; valores antigos ficam `NULL` e o POS faz fallback.

### Alterações no POS (`Mosap3PayPOS.tsx`)

**Fluxo novo após confirmar agricultor:**

1. **Diálogo "Selecionar Parcela"** com 3 botões grandes: `0,3 Ha`, `0,5 Ha`, `1 Ha`. Não se pode prosseguir sem escolher.
2. Carregar `patec_items` do PATEC do agricultor + fazer `match` com `supplier_products` por nome (já existe lógica via "vinculo-patec-catalogo"). Para cada item:
   - `quantidade_recomendada = base_quantity × (parcel_size / 0.5)`.
   - Esta quantidade torna-se **quantidade obrigatória/máxima** para essa venda.
3. **Pré-popular o carrinho** automaticamente com todos os itens do PATEC nas quantidades calculadas (utilizador remove o que o agricultor não quer levar).
4. **Bloqueios**:
   - Não permite adicionar produtos fora da lista do PATEC (botão "Adicionar" desactivado nos restantes).
   - Quantidade no carrinho fica `readonly` ou limitada a `≤ quantidade_recomendada` (configurável: bloqueio rígido por defeito).
   - Validação final: total ≤ saldo disponível (já existe).
5. **Mudar parcela**: badge no topo "Parcela: 0,5 Ha · Alterar" reabre o diálogo e recalcula carrinho (com aviso se já tinha itens).
6. Gravar `parcel_size` e `parcel_size_label` em `pos_sales`. Mostrar essa informação na factura, no histórico de vendas e na timeline financeira do agricultor.

### Admin — `Patec.tsx`
Adicionar dois campos nos diálogos de criar/editar item: `Quantidade base (0,5 Ha)` e `Unidade`. Mostrar na lista. Sem isto, o POS não consegue pré-calcular — mostra `0` e pede ao admin para configurar.

### Pesquisa por nome/telefone
Já está implementada no POS (`searchFarmer`). Confirmo que continua a aceitar nome OU telefone (além de código/BI). Pequeno ajuste de copy: placeholder passa a "Nome ou telefone do agricultor".

### Ficheiros a editar
- Migração SQL: `patec_items` + `pos_sales` (colunas novas).
- `src/pages/Mosap3PayPOS.tsx` — fluxo de parcela, pré-popular carrinho, bloqueios.
- `src/pages/Patec.tsx` — diálogos com `base_quantity` e `unit`.
- `src/pages/Mosap3PayVendas.tsx` + `src/components/InvoicePDF.tsx` — mostrar parcela na venda/factura.
- `src/pages/FarmerProfile.tsx` (timeline) — etiqueta da parcela na compra POS.

### Validações
- Se o PATEC do agricultor não tem itens com `base_quantity` → mostrar aviso no POS: "Pacote tecnológico sem quantidades configuradas. Contacte o administrador."
- Se algum item do PATEC não tem produto correspondente no fornecedor → mostrar como "Indisponível neste fornecedor" no carrinho pré-populado.

### Resultado
Venda só acontece para produtos do PATEC do agricultor, nas quantidades exactas definidas pela parcela escolhida (0.3 / 0.5 / 1 Ha), com saldo disponível suficiente. Tudo o resto fica bloqueado.
