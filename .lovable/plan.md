

## Plano: Adicionar confirmação antes da atribuição bulk de PATEC

### Situação actual
O diálogo bulk já mostra a lista de produtores e o selector de PATEC, mas ao clicar "Atribuir" executa imediatamente sem pedir confirmação final.

### Alterações em `src/pages/Patec.tsx`

1. **Adicionar estado `bulkConfirmOpen`** para controlar um segundo diálogo (AlertDialog) de confirmação.

2. **Modificar o botão "Atribuir"** no diálogo bulk para, em vez de chamar `handleBulkSave` directamente, abrir o AlertDialog de confirmação.

3. **Adicionar AlertDialog de confirmação** com:
   - Mensagem clara: "Tem a certeza que deseja atribuir **PATEC X** a **N produtor(es)**?"
   - Resumo: quantos já têm PATEC atribuído (e vão ser alterados) vs quantos não têm
   - Botão "Cancelar" e botão "Confirmar Atribuição" que chama `handleBulkSave`

### Fluxo resultante
1. Utilizador selecciona produtores → clica "Atribuir PATEC em lote"
2. Dialog mostra lista + selector de PATEC → clica "Atribuir"
3. **AlertDialog de confirmação** aparece com contagem e resumo → clica "Confirmar Atribuição"
4. Executa `handleBulkSave`

