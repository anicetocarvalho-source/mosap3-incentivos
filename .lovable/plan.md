

## Plano: Remover página Empresas redundante

A página `/empresas` lê da mesma tabela `suppliers` que o MOSAP3Pay → Fornecedores, sem funcionalidade adicional. Deve ser removida.

### Alterações

1. **Eliminar `src/pages/Empresas.tsx`**

2. **`src/App.tsx`** — remover import (linha 16) e rota (linhas 91-92)

3. **`src/components/AppSidebar.tsx`** — remover item "Empresas" (linhas 80-85) e import `Building2` se não for usado noutro lugar

4. **`src/components/AppNavbar.tsx`** — remover item "Empresas" (linhas 85-90) e import `Building2` se não for usado noutro lugar

### Impacto
- Zero perda de dados ou funcionalidade
- Utilizadores acedem à gestão de fornecedores via MOSAP3Pay → Fornecedores

