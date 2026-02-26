

## Análise de Layout e Apresentação — Páginas do MOSAP3

Após revisão completa de todas as páginas do sistema, identifico os seguintes pontos de melhoria organizados por prioridade:

### 1. Páginas sem layout mobile (cards) — Problema Crítico

Estas páginas usam apenas tabelas desktop, sem vista de cards para mobile:

| Pagina | Problema |
|--------|----------|
| **Patec.tsx** | Tabela de produtores sem vista mobile card |
| **Utilizadores.tsx** | Já usa cards — OK |
| **Mosap3PayVendas.tsx** | Tabela de vendas sem vista mobile |
| **Mosap3PayStock.tsx** | Tabelas de produtos e movimentos sem vista mobile |
| **Mosap3PayNotasCredito.tsx** | Tabela de notas de crédito sem vista mobile |
| **Mosap3PayAuditLogs.tsx** | Tabela de logs sem vista mobile |

### 2. Páginas sem paginação

| Pagina | Estado |
|--------|--------|
| **Mosap3PayVendas.tsx** | Mostra TODAS as vendas sem paginação |
| **Mosap3PayNotasCredito.tsx** | Sem paginação |
| **Mosap3PayAuditLogs.tsx** | Corta a 100 mas sem controlos de paginação |
| **Mosap3PayStock.tsx** | Sem paginação nos produtos |
| **Patec.tsx** | Sem paginação (pode ter centenas de produtores) |

### 3. Configurações — contagens hardcoded

`Configuracoes.tsx` linhas 230-239: mostra "3 Utilizadores Activos", "9 Perfis", "18 Províncias" como valores estáticos em vez de contar da base de dados.

### 4. Relatórios — filtros com dados hardcoded

`Relatorios.tsx` linhas 29-38: listas de províncias, municípios e escolas são arrays estáticos em vez de virem da base de dados.

### 5. Consistência visual

- **Mosap3Pay.tsx** (dashboard): KPI cards com layout `grid-cols-6` ficam apertados em tablet; sem loading skeleton
- **Mosap3PayConfiguracoes.tsx**: Loading state é texto simples em vez de spinner
- **EscolasCampo.tsx**: Já está bem — OK

---

## Plano de Implementação

### Passo 1 — Mobile cards + paginação nas 5 páginas MOSAP3Pay e Patec
Adicionar o padrão `hidden md:block` / `md:hidden` com cards `divide-y` e paginação (PAGE_SIZE=15) em:
- `Patec.tsx`
- `Mosap3PayVendas.tsx`
- `Mosap3PayStock.tsx` (tab produtos + tab movimentos)
- `Mosap3PayNotasCredito.tsx`
- `Mosap3PayAuditLogs.tsx`

### Passo 2 — Configurações com contagens reais
Em `Configuracoes.tsx`, substituir os 3 valores hardcoded por queries ao Supabase:
- Utilizadores activos → `profiles` count
- Perfis → constante `Object.keys(ROLE_LABELS).length` (são fixos do enum)
- Províncias → `provinces` count

### Passo 3 — Relatórios com filtros dinâmicos
Em `Relatorios.tsx`, substituir os arrays `provincias`, `municipios`, `escolas` por dados carregados das tabelas `provinces`, `municipalities`, `schools`.

### Passo 4 — Pequenas melhorias de consistência
- `Mosap3PayConfiguracoes.tsx`: trocar loading text por `Loader2` spinner
- `Mosap3Pay.tsx`: melhorar grid responsivo dos KPIs (2 cols mobile, 3 tablet, 6 desktop)

