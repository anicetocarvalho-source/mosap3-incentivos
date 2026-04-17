
User approved the audit recommendations. Plan: build reusable EmptyState/ErrorState components and roll them out to modules with gaps, plus add loading skeletons where missing.

# Implementar Estados de UI (Loading / Erro / Vazio)

## 1. Componentes reutilizáveis (novos)
| Ficheiro | Função |
|---|---|
| `src/components/ui/empty-state.tsx` | `<EmptyState icon title description action?>` — ilustração leve, CTA opcional |
| `src/components/ui/error-state.tsx` | `<ErrorState title? description? onRetry?>` — ícone alerta + botão "Tentar novamente" |
| `src/components/ui/loading-state.tsx` | `<LoadingState rows? variant="skeleton"\|"spinner">` — esqueleto reutilizável |

## 2. Portal Fornecedor (lacunas críticas — sem loading nem erro)
Adoptar os 3 estados em:
- `FornecedorDashboard.tsx` — loading skeleton dos KPIs + recent sales; try/catch + ErrorState
- `FornecedorVendas.tsx` — skeleton tabela + EmptyState com ilustração
- `FornecedorPOS.tsx` — loading + error + empty
- `FornecedorProdutos.tsx` — loading + error + empty
- `FornecedorStock.tsx` — error state nas chamadas
- `FornecedorPerfil.tsx` — error toast em handleSave/upload

## 3. Área Admin — adicionar erros + melhorar empty states
- `Dashboard.tsx` — empty state mais rico (ícone + CTA "Cadastrar primeiro produtor")
- `Agricultores.tsx` — ErrorState quando `useFarmersList` falhar
- `Parcelas.tsx`, `Producao.tsx`, `Incentivos.tsx`, `Transacoes.tsx` — `isError` do useQuery → `<ErrorState onRetry={refetch}/>`
- `Relatorios.tsx` — EmptyState quando filtros não retornam dados
- `Patec.tsx`, `Mosap3PayFornecedores.tsx`, `Mosap3PayVendas.tsx`, `Mosap3PayStock.tsx`, `Mosap3PayNotasCredito.tsx`, `Mosap3PayAuditLogs.tsx` — try/catch + toast.error + EmptyState

## 4. Hooks — propagar erros
- `useFarmersList.ts` — adicionar `error` ao retorno
- `useDashboardData.ts` — expor `isError` / `error`

## Padrão de uso
```tsx
if (isLoading) return <LoadingState rows={5} />;
if (isError) return <ErrorState onRetry={refetch} />;
if (!data?.length) return <EmptyState icon={Users} title="..." action={...} />;
```

## Estimativa
~20 ficheiros editados + 3 novos componentes. Faço numa só passagem, agrupando por módulo. Sem alterações de schema/BD.
