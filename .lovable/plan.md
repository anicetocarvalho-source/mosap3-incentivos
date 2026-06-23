Plano de correcção:

1. Tornar a actualização do diálogo imediata após add/edit/delete
   - Depois de inserir, editar ou remover em `PatecCompositionDialog`, actualizar o estado local (`items`) de forma optimista com o registo retornado pela base de dados, antes/sem depender apenas do refetch.
   - Manter o refetch autoritativo como reconciliação silenciosa para garantir consistência.

2. Corrigir o momento de limpeza do formulário
   - No add, preservar a categoria activa e garantir que o novo item entra na lista antes de fechar/limpar o formulário.
   - Evitar que o `fetchItems()` sobrescreva temporariamente a lista com dados antigos se a leitura vier atrasada.

3. Melhorar tratamento de falhas de leitura
   - Em `fetchItems`, tratar explicitamente erros da query e não substituir `items` por lista vazia quando a leitura falhar.
   - Mostrar toast de erro se a gravação foi bem-sucedida mas a reconciliação falhou, sem esconder o item já adicionado.

4. Sincronizar contador do card sem espera perceptível
   - No callback `onMutated`, continuar a marcar o PATEC como dirty, mas disparar reconciliação imediata/curta para actualizar o badge rapidamente.
   - Manter o debounce apenas como fallback para eventos Realtime em lote.

5. Validar o fluxo afectado
   - Testar em `/patec → Composição`: adicionar item, confirmar que aparece imediatamente na aba correcta, editar/remover e confirmar que a lista e o contador do card acompanham a alteração.
   - Validar que não há regressão na aba PATECs do produtor, que reutiliza o mesmo diálogo.