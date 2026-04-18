

## Diferença entre as abas Incentivos e Conformação

Olhei para o `FarmerProfile.tsx` e confirmo: **há sobreposição real entre as duas abas, mas servem ângulos diferentes**.

### Aba "Incentivos" (linhas 603–683)
Foco: **dinheiro do produtor visto pelo lado do MOSAP3 (não-POS)**.
- 3 cards: Valor Recebido, Total Gasto, Saldo Final — vindos dos campos legados `farmers.valor_recebido / total_gasto / saldo_final`.
- Tabela de **`farmer_transactions`** (transações antigas/manuais — produto, empresa, valor, data) com botão "Nova Transação".
- **Não mostra** as compras feitas via POS dos fornecedores nem a lista de incentivos creditados.

### Aba "Conformação" (linhas 775+)
Foco: **reconciliação real entre incentivos creditados e compras feitas no POS**.
- 4 cards calculados em tempo real: Incentivos Recebidos (soma de `farmer_incentives`), Compras Realizadas (soma de `pos_sales`), Saldo Disponível, Taxa de Utilização.
- Badge de estado: Conformado / Não Conformado / Sem Dados.
- Timeline cronológica unificando `farmer_incentives` + `pos_sales` (com itens da venda).

### Por que parece duplicado
Ambas mostram "valor recebido / gasto / saldo", mas com fontes diferentes:

| | Aba Incentivos | Aba Conformação |
|---|---|---|
| Origem dos valores | Campos texto em `farmers` + `farmer_transactions` | Agregações de `farmer_incentives` + `pos_sales` |
| Lista de incentivos individuais | ❌ não aparece | ✅ no timeline |
| Compras POS reais | ❌ não aparece | ✅ no timeline |
| Transações manuais antigas | ✅ tabela | ❌ ignoradas |

Resultado: o utilizador vê dois "saldos" que podem nem bater certo, e a aba Incentivos chama-se assim mas **não lista incentivos** — lista transações genéricas.

### Recomendação

Unificar numa única aba **"Incentivos & Conformação"** (ou simplesmente **"Financeiro"**) com esta estrutura:

1. **4 cards de topo** (os da Conformação, que são os reais: agregam `farmer_incentives` + `pos_sales`).
2. **Badge de Estado da Conformação** (Conformado / Não Conformado).
3. **Timeline unificada** de incentivos creditados + compras POS + transações manuais antigas (incluindo `farmer_transactions` para não perder histórico).
4. Botão **"Nova Transação"** mantém-se, para registos manuais fora do POS.
5. Eliminar a aba duplicada e os 3 cards "legados" baseados em `farmers.valor_recebido/total_gasto/saldo_final` (que também já estão no header e na tabela de Agricultores).

**Ficheiro afectado:** `src/pages/FarmerProfile.tsx` (remover `TabsTrigger value="incentivos"` e respectivo `TabsContent`; juntar a tabela de `farmer_transactions` ao timeline da aba Conformação).

Se aprovares, implemento a fusão. Se preferires manter as duas separadas, posso em vez disso renomear "Incentivos" para "Transações Manuais" para clarificar o âmbito.

