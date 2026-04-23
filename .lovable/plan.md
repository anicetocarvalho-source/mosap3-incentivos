

## Diagnóstico — “200 Kz” em vez de “200 000 Kz”

Confirmei na base de dados: os 10 903 valores importados estão guardados em **formato EN-US** (`"200,000.00"`, `"915,840.00"`, `"101,760.00"` — exactamente como aparecem no anexo da Unitel).

O bug está nos **parsers do front-end**, que assumem formato PT (ponto = milhar, vírgula = decimal) e por isso interpretam `"200,000.00"` como `200,00` Kz em vez de `200.000,00` Kz. A unidade está correcta na BD — só o ecrã divide tudo por 1000.

### Locais afectados

| Ficheiro | Função | Sintoma |
|---|---|---|
| `src/pages/Agricultores.tsx` | `parsePtAo` | Coluna “Recebido / Saldo” mostra 200 Kz |
| `src/pages/FarmerProfile.tsx` | `parsePtAo` (linha 698) | Resumo financeiro do produtor errado |
| `src/components/dashboard/EcaBalanceTable.tsx` | `parsePtao` | Tabela de saldos por ECA → soma 0 Kz |
| `src/pages/RevisaoProvincias.tsx` | `parsePtao` (helper global) | Totais da revisão Unitel ficam ÷1000 |

### O que vou implementar

**1. Criar parser único e robusto em `src/lib/numberFormat.ts`** que aceita os dois formatos sem ambiguidade:
- Se a string casa `^-?\d{1,3}(,\d{3})+(\.\d+)?$` → EN-US (vírgula = milhar)
- Se casa `^-?\d{1,3}(\.\d{3})+(,\d+)?$` → PT (ponto = milhar)
- Caso simples (só um separador): heurística pelo nº de dígitos depois do separador (3 → milhar; 1-2 → decimal)
- Exporta também `formatKz(n)` consistente, sempre em pt-AO com `Intl.NumberFormat`

**2. Substituir os 4 `parsePtAo`/`parsePtao` locais por `parseAmount` do novo módulo** — apaga as 4 implementações duplicadas, deixa um único ponto de verdade.

**3. Padronizar a escrita futura na BD** em `RevisaoProvincias.tsx` (`formatPtao`, linhas 1089-1093) e em `ImportValoresRecebidosDialog.tsx` (linha 195) para gravarem sempre em **EN-US** (`"200000.00"` simples, sem separadores de milhar) — formato menos ambíguo, fácil de parsear, compatível com `Number()`. Não toco no que já está na BD; o novo parser lê os dois formatos.

**4. Verificação visual** após a correcção: abrir `/agricultores` e confirmar que os 5 produtores do anexo passam a mostrar `200 000 Kz` / `915 840 Kz` / `101 760 Kz` / `100 000 Kz` / `814 080 Kz`.

### Detalhes técnicos

- **Sem migração de dados**: os valores na BD já estão correctos em magnitude; só o display é que estava errado. Não preciso reescrever os 10 903 registos.
- **Sem mudanças de schema**: as colunas continuam `text`.
- **Compatibilidade**: o novo parser continua a aceitar os dois formatos legados (`"200,000.00"` e `"200.000,00"`), portanto qualquer importação antiga continua a funcionar.
- **Triggers da BD**: `trg_recalc_on_farmer_recebido` e `log_farmer_balance_change` operam sobre o texto guardado; como vou continuar a guardar texto numérico válido, não há impacto.

