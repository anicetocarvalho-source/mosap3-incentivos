

## Auditoria Completa do Sistema MOSAP3 — Pontos de Melhoria

### A. DADOS ESTÁTICOS (PROBLEMA CRITICO)

Vários módulos usam **dados hardcoded** em vez de dados reais da base de dados:

| Pagina | Problema |
|--------|----------|
| **Transacoes.tsx** | Array estático `transacoes[]` com 8 registos fictícios. Nunca consulta a tabela `farmer_transactions` |
| **Incentivos.tsx** | Array estático `incentivesData[]` com 15 registos fictícios. Nunca consulta `farmer_incentives` |
| **Parcelas.tsx** | Array estático `parcelasData[]` com 9 registos fictícios. Nunca consulta `farmer_parcels` |
| **Producao.tsx** | Array estático `producaoData[]` com 8 registos fictícios. Nunca consulta `farmer_production` |
| **Relatorios.tsx** | Listas hardcoded de províncias, municípios e escolas |
| **Agricultores.tsx** | Filtro de províncias hardcoded (Benguela, Huambo, Bié) em vez de carregar da tabela `provinces` |

**Impacto**: Estes módulos são essencialmente demos visuais sem funcionalidade real.

---

### B. FORMULARIOS SEM FUNCIONALIDADE

| Pagina | Problema |
|--------|----------|
| **Parcelas.tsx** | Diálogo "Nova Parcela" fecha sem gravar. `onClick={() => setDialogOpen(false)}` |
| **Producao.tsx** | Diálogo "Nova Produção" fecha sem gravar |
| **Incentivos.tsx** | Diálogo "Novo Incentivo" fecha sem gravar |
| **Transacoes.tsx** | Botão "Filtros" não faz nada |

---

### C. UI/UX — INCONSISTENCIAS DE LAYOUT

1. **Falta de paginação**: Agricultores, Parcelas, Producao e Transacoes mostram todos os registos sem paginação
2. **Vista mobile incompleta**: Parcelas, Producao, Transacoes e Incentivos não têm layout mobile adaptado (tabela cortada em ecrãs pequenos)
3. **Barra de pesquisa inconsistente**: Utilizadores não tem ícone de pesquisa; Agricultores tem; formato varia entre páginas
4. **Filtros Select não funcionais**: Em Agricultores, o Select de "Província" não tem `value` nem `onValueChange` — é decorativo. O mesmo acontece nos filtros de Parcelas e Producao
5. **Loading states ausentes**: Transacoes e Incentivos não mostram loading spinner enquanto (supostamente) carregam dados
6. **Confirmação de eliminação ausente**: Em Fornecedores, produtos e terminais POS são eliminados sem dialog de confirmação

---

### D. FLUXOS E PROCESSOS

1. **Transacoes desligadas do MOSAP3Pay**: A página Transacoes mostra dados fictícios quando as transacções reais estão em `pos_sales`. Deveria mostrar dados reais ou ser unificada com MOSAP3Pay Vendas
2. **Incentivos desligados**: A página Incentivos usa dados fictícios quando existe uma tabela `farmer_incentives` na base de dados
3. **Agricultores sem exportação real**: O botão Download na página Agricultores não faz nada
4. **Configurações — valores estáticos na secção Segurança**: Mostra "3 Utilizadores Activos", "9 Perfis" e "18 Províncias" hardcoded em vez de contagens reais
5. **Relatorios com dados estáticos**: Os filtros de províncias/municípios/escolas são hardcoded em vez de virem da base de dados

---

### E. FUNCIONALIDADES EM FALTA

1. **Eliminar fornecedor**: Não existe botão/acção para desativar ou eliminar um fornecedor
2. **Paginação**: Ausente em Agricultores, Parcelas, Producao, Transacoes, Utilizadores
3. **Exportação de dados**: Botões de export (CSV/PDF) são decorativos ou inexistentes
4. **Breadcrumbs**: Não existem em páginas de detalhe (FarmerProfile, EscolaDetalhe, Fornecedor detalhe)
5. **Empty states**: Algumas tabelas não têm mensagem quando não há dados (Agricultores mobile, Transacoes)
6. **Pesquisa global**: O campo de pesquisa no header (`AppHeader.tsx`) é decorativo — não pesquisa nada

---

### F. PRIORIDADES SUGERIDAS

```text
PRIORIDADE 1 (Critica — dados reais):
  - Ligar Transacoes.tsx a farmer_transactions
  - Ligar Incentivos.tsx a farmer_incentives
  - Ligar Parcelas.tsx a farmer_parcels
  - Ligar Producao.tsx a farmer_production

PRIORIDADE 2 (Funcionalidade):
  - Formulários que gravam (Parcelas, Producao, Incentivos)
  - Filtros funcionais em todas as páginas
  - Paginação em listagens grandes
  - Confirmação antes de eliminar

PRIORIDADE 3 (UI/UX polish):
  - Layout mobile para tabelas
  - Consistência visual entre páginas
  - Loading states uniformes
  - Exportação real (CSV)
  - Breadcrumbs em páginas de detalhe
```

### G. Por onde quer começar?

Posso atacar qualquer uma destas áreas. As opções mais impactantes seriam:
- Ligar as 4 páginas com dados fictícios à base de dados real
- Tornar todos os formulários funcionais
- Adicionar paginação e filtros reais em todas as listagens

