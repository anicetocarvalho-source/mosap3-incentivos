

## Plano: Remover página Compras redundante

A página `/compras` contém dados mock hardcoded e não está ligada à base de dados. Toda a funcionalidade de compras/vendas subsidiadas é agora gerida pelo Terminal POS do fornecedor (`pos_sales`). A página deve ser removida para evitar confusão.

### Alterações

1. **Eliminar ficheiro `src/pages/Compras.tsx`**

2. **Remover rota `/compras` de `src/App.tsx`** (linha ~86) e o respectivo import

3. **Remover entrada "Compras" da navegação em `src/components/AppSidebar.tsx`** (linhas ~79-83, o item com `icon: ShoppingCart, label: "Compras"`)

4. **Remover entrada "Compras" da navegação em `src/components/AppNavbar.tsx`** (procurar item com path `/compras` no array `navItems`)

### Impacto
- Nenhuma perda de dados (a página usava dados fictícios)
- Os utilizadores com perfil `gestor_incentivos` ou `senior/junior_agronegocio` deixam de ver o item no menu
- Toda a gestão de compras subsidiadas continua disponível via MOSAP3Pay → Vendas e Terminal POS

