# Corrigir "actualizações não se reflectem" na Composição do Pacote

## Sintoma
Em `/patec → Detalhes`, adicionar um item mostra o toast de sucesso mas o item não aparece imediatamente na lista da composição (e o badge "N itens" do card pode também ficar desactualizado).

## Causa
`PatecCompositionDialog` faz **actualização optimista** do estado local — `setItems(prev => [...prev, data])` após o `insert().select().single()`. Quando essa resposta vem incompleta (ou o estado do tab cai num grupo diferente do que o utilizador está a ver), o item não é desenhado mesmo tendo sido persistido. Edição e remoção sofrem do mesmo padrão. Adicionalmente, o card pai depende exclusivamente do canal Realtime de `patec_items` para refrescar o badge — se o evento atrasar/falhar, a contagem fica antiga até nova reconciliação.

## Plano (apenas frontend, sem alterações de schema)

### 1. `src/components/patec/PatecCompositionDialog.tsx`
- **Refetch autoritativo após cada mutação.** Em `submitAdd`, `saveEdit`, `saveEditFull` e `confirmDelete`: depois do `insert/update/delete` bem-sucedido, chamar `await fetchItems()` em vez de mutar o array local. Isto garante que a UI mostra exactamente o que está na BD e elimina qualquer divergência por payload incompleto, mudança de categoria/subcategoria ou ordenação por `sort_order`.
- **Forçar o tab activo para a categoria do item adicionado/editado.** Promover `Tabs` para controlado (`value` + `onValueChange`) e, após `submitAdd`/`saveEditFull`, setar `activeTab = addingCategory`/`editFullCategory`. Resolve o caso de o utilizador estar em "Pecuária" e adicionar em "Agricultura" (ou vice-versa) e não ver o resultado.
- **Notificar o pai.** Aceitar nova prop opcional `onMutated?: () => void` e invocá-la após cada mutação bem-sucedida.

### 2. `src/pages/Patec.tsx`
- Passar `onMutated={() => { /* re-reconciliar contagem deste código */ dirtyCodesRef.current.add(composingPatec!.code); scheduleReconcile(); }}` ao `<PatecCompositionDialog>` da linha ~2087. Isto faz o badge "N itens" do card actualizar imediatamente, mesmo que o evento Realtime não chegue.

### 3. `src/components/patec/PatecsTab.tsx`
- Passar a mesma callback `onMutated` ao `<PatecCompositionDialog>` da linha 175, ligada ao `refetch` já recebido por props.

## Fora do âmbito
- Sem alterações ao schema, RLS, Realtime publication ou Service Worker.
- Sem mexer em outros separadores (Stock & Preços, Catálogo), perfis ou outras páginas.

## Validação
1. `/patec → Detalhes → Adicionar item` em Agricultura: item aparece na lista sem fechar/reabrir.
2. Mesmo teste em Pecuária; e estando em Pecuária, adicionar em Agricultura → o dialog comuta para o tab correcto e mostra o item.
3. Editar quantidade/unidade e mudar subcategoria → valor refresca imediatamente.
4. Remover item → desaparece da lista e badge "N itens" do card decrementa sem F5.
5. Reabrir o dialog → contagem do header (`{items.length} item(s)`) bate certo com a BD.
