## Mudança

Adicionar um botão **"Actualizar contagens"** no cabeçalho de `/provincias` (junto aos botões de export), que rebusca os produtores da BD e recalcula `realByProvince` / `realBySchool` sem recarregar a página.

## Implementação

Ficheiro único: `src/pages/GestaoProvincias.tsx`.

1. Extrair o fetch dos produtores (actualmente dentro do `useEffect`) para uma função `refreshFarmerCounts` reutilizável, que faz `fetchAllPages` da tabela `farmers` (colunas `province, municipality, school`, sem filtro de Removidos — regra de memória).
2. Adicionar estado `refreshing` para mostrar spinner no botão enquanto o fetch corre.
3. Chamar `refreshFarmerCounts()` no `useEffect` inicial e ao clicar no botão.
4. Adicionar o botão ao grupo de acções no header:
   - Ícone `RefreshCw` (lucide), `variant="outline"`, `size="sm"`.
   - Desactivado e com spinner enquanto `refreshing`.
   - Toast de sucesso com o novo total ("Contagens actualizadas — N produtores").
5. Também chamar `refetch()` do `useProvincesData` para apanhar mudanças em municípios/escolas.

Sem alterações de hooks, BD, ou outras páginas.
