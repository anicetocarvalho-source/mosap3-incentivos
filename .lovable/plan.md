## Objectivo

1. Mostrar o saldo disponível de cada agricultor na lista de sugestões do POS, para o operador ver imediatamente quem tem saldo antes de seleccionar.
2. Eliminar a divergência entre o "saldo do perfil" e o "saldo do POS", adoptando uma única fórmula canónica em todo o sistema.

## Causa raiz da divergência (já confirmada)

Existem hoje duas fórmulas a coexistir:

- **Perfil / coluna `farmers.saldo_final`** → `max(0, valor_recebido − total_gasto)` (campos texto da tabela `farmers`, formato PT-AO).
- **POS (`fetchFarmerBalance`)** → `Σ farmer_incentives.amount (Aprovado/Pendente/Pago) − Σ pos_sales.total`.

Resultado: agricultores com `valor_recebido` importado mas sem `farmer_incentives` registados aparecem com saldo no perfil e a zero no POS — exactamente o sintoma reportado.

## Decisão

Adoptar como fonte única **`farmers.valor_recebido` e `farmers.total_gasto`** (mesma fórmula do perfil), porque:
- É a fonte usada nos relatórios financeiros, dashboard e listagens (`useFinancialSummary`, `parseAmount`/`computeSaldoFinal`).
- Reflecte importações em massa de incentivos que nem sempre passam por `farmer_incentives`.
- Mantém-se consistente com a regra de negócio existente "Removidos contam em todos os agregados".

## Alterações

### 1. POS — lista de sugestões (`src/pages/Mosap3PayPOS.tsx`)

Os campos `valor_recebido`, `total_gasto` e `saldo_final` já podem ser obtidos da mesma query que carrega as sugestões.

- Estender o `select` de sugestões (paginação inicial e "Carregar mais") para incluir `valor_recebido` e `total_gasto` (ou usar directamente `saldo_final` se preferirmos zero-cálculo no cliente — vamos calcular com `computeSaldoFinal` para ser robusto a inconsistências de import).
- Em cada item da lista (variantes Kiosk e Standard), adicionar uma linha/badge com `Saldo: {formatKzCompact(saldo)}`:
  - **Verde** quando `saldo > 0`.
  - **Vermelho** com sufixo "sem saldo" quando `saldo <= 0`.
- Manter o badge de PATEC já existente.

### 2. Alinhar `fetchFarmerBalance` à mesma fórmula

Em `Mosap3PayPOS.tsx`, substituir o cálculo actual por:

```ts
const fetchFarmerBalance = async (farmerCode: string) => {
  const { data } = await supabase
    .from("farmers")
    .select("valor_recebido, total_gasto")
    .eq("code", farmerCode)
    .maybeSingle();
  const balance = computeSaldoFinal(data?.valor_recebido, data?.total_gasto);
  setFarmerBalance(balance);
  return balance;
};
```

(Importar `computeSaldoFinal` de `@/lib/numberFormat`.)

Consequência: o saldo mostrado na lista, o saldo no card do produtor seleccionado e a regra de bloqueio passam todos a usar a mesma fonte.

### 3. Verificar outros pontos do POS que usem o saldo

Auditar e, se necessário, alinhar:
- `src/pages/fornecedor/FornecedorPOSVenda.tsx` (POS do portal do fornecedor) — aplicar a mesma lógica de leitura/cálculo se ainda usar `farmer_incentives − pos_sales`.
- Mensagens de erro/`toast` do POS continuam válidas (apenas mudou a fonte do número).

### 4. Memória do projecto

Adicionar uma regra Core curta: "Saldo canónico do produtor = `computeSaldoFinal(valor_recebido, total_gasto)` em todo o sistema (perfil, POS, lista, bloqueios)."

## Fora de âmbito

- Não tocar em `farmer_incentives` nem em `pos_sales` — continuam a ser as fontes de verdade para o histórico, mas não para o saldo agregado em tempo real.
- Não recalcular nem migrar dados; o cálculo é sempre feito a partir das colunas já existentes.

## Validação

- Verificar manualmente um agricultor que antes aparecia "sem saldo" no POS mas com saldo no perfil — passa a aparecer com o mesmo valor nos dois sítios e o botão "Processar Pagamento" deixa de estar bloqueado.
- Confirmar que nenhum teste existente (`pos-sale-flow.test.ts`, `patec-block-detail.test.ts`) depende da fórmula antiga; ajustar mocks se necessário.
