
## Diagnóstico

O problema já não está na lista de Agricultores em si: o helper `fetchAllPages` está activo aí e as requests mostram paginação real (`offset=2000&limit=1000`, etc.). O problema é que a correcção foi aplicada só em parte da plataforma.

Ainda existem várias páginas/hooks com `select(...)` simples, sem `.range(...)`/paginação, por isso continuam sujeitas ao limite de 1000 registos e acabam por parecer “dados em falta”.

## Áreas ainda afectadas

- `src/hooks/useProvincesData.ts`
  - afecta `EscolasCampo`, `ProvinciaEscolas`, `GestaoProvincias`
  - `provinces`, `municipalities` e `schools` ainda carregam sem paginação
- `src/pages/Mosap3PayFornecedores.tsx`
  - lista de fornecedores e zonas de actuação ainda sem `fetchAllPages`
- `src/pages/Relatorios.tsx`
  - filtros de província/município/escola podem vir incompletos
- `src/pages/Mosap3Pay.tsx`
  - estatísticas de vendas/receita usam `pos_sales.select("*")` e podem parar nos 1000
- `src/pages/fornecedor/FornecedorDashboard.tsx`
  - stats de vendas por fornecedor também podem cortar nos 1000
- `src/pages/Mosap3PayStock.tsx`
  - produtos/fornecedores usam `select` simples; pode truncar catálogos grandes

## Plano de correcção

### 1. Aplicar `fetchAllPages` nas fontes-base em falta
Actualizar os carregamentos que alimentam várias páginas:
- `useProvincesData.ts` para `provinces`, `municipalities`, `schools`
- `Mosap3PayFornecedores.tsx` para `suppliers` e `supplier_provinces`
- `Relatorios.tsx` para listas de filtros territoriais

Isto deve resolver de uma vez:
- Escolas de Campo
- página por província
- gestão territorial
- filtros dos relatórios
- listagem de fornecedores

### 2. Corrigir KPIs/listas que ainda contam só 1000 registos
Actualizar queries agregadas que hoje fazem `select("*")` completo:
- `Mosap3Pay.tsx`:
  - usar `count: "exact"` para total de vendas
  - usar `fetchAllPages` para receita total e pendentes, ou refactor para agregação leve
- `FornecedorDashboard.tsx`:
  - substituir `select("id,total")` simples por paginação completa para stats reais

### 3. Rever stock e páginas satélite
Aplicar a mesma abordagem em páginas com potencial de crescimento:
- `Mosap3PayStock.tsx` para `supplier_products` e `suppliers`
- manter limites pequenos intencionais, como histórico recente e movimentos recentes, onde o limite é funcional e não bug

### 4. Endurecer o padrão técnico
Padronizar para evitar regressões:
- sempre que uma página “carrega tudo e filtra no cliente”, usar `fetchAllPages`
- deixar selects pequenos/intencionais só quando houver `limit(...)` explícito por UX
- opcionalmente criar um comentário utilitário/padrão de uso para a equipa repetir menos o erro

## Ficheiros a editar

- `src/hooks/useProvincesData.ts`
- `src/pages/Mosap3PayFornecedores.tsx`
- `src/pages/Relatorios.tsx`
- `src/pages/Mosap3Pay.tsx`
- `src/pages/fornecedor/FornecedorDashboard.tsx`
- `src/pages/Mosap3PayStock.tsx`

## Resultado esperado

Após a implementação:
- Agricultores continuam completos
- Escolas de Campo passam a mostrar todas as províncias/municípios/escolas carregadas
- Fornecedores e zonas aparecem completos
- filtros dos relatórios deixam de omitir opções
- contagens e totais de vendas deixam de ficar presos aos primeiros 1000 registos
