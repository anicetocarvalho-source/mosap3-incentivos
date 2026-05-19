## Resumo

Dois melhoramentos na página `/patec`, separador **Atribuição**:

1. **UX do popup de atribuição individual** — quando o PATEC tem muitos itens (composição grande) o conteúdo cresce e o diálogo deixa de ser navegável. Tornar o `DialogContent` scrollável e isolar a composição num bloco com altura máxima + scroll próprio. Adicionar atalho "Ver composição completa" que reaproveita o `PatecCompositionDialog` já existente.

2. **Atribuição em massa por Província / Município / Escola (ECA)** — novo botão na barra de filtros que abre um diálogo dedicado para atribuir um PATEC a todos os produtores de uma região, sem precisar de seleccionar linha a linha.

## Alterações

### Ficheiro: `src/pages/Patec.tsx`

#### A. Popup de atribuição individual (Edit Dialog ~ linhas 1370–1430)
- `<DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">`.
- Envolver o corpo num `<div className="flex-1 overflow-y-auto pr-1">` para permitir scroll quando a composição é grande.
- Cartão de composição: `max-h-[40vh] overflow-y-auto` e adicionar botão "Ver composição completa" que abre `PatecCompositionDialog` com o PATEC seleccionado (estado já existe: `compositionPatec`).
- `DialogFooter` fica fixo (fora do bloco scrollável).

#### B. Novo dialog "Atribuir por região"
- Botão adicional na zona de filtros (linha ~1234), à direita do Select de PATEC: `Atribuir por região` (`MapPin` icon, variant `outline`, `size sm`).
- Estado novo:
  - `regionDialogOpen: boolean`
  - `regionScope: "provincia" | "municipio" | "escola"` (default `provincia`)
  - `regionValues: string[]` (multi-select)
  - `regionPatecCode: string`
  - `regionOverwrite: boolean` (default `false`) — se `false`, só atribui a quem ainda **não tem** PATEC; se `true`, substitui também os já atribuídos.
- Opções derivadas de `farmers` carregados (respeitando o scope do utilizador, já presente):
  - Províncias: `Array.from(new Set(farmers.map(f => f.province)))`.
  - Municípios: idem para `f.municipality`, filtrados pelas províncias seleccionadas (se houver).
  - Escolas: idem para `f.school`, filtradas por município/província.
- Pré-visualização: contagem dos produtores afectados com a regra de overwrite aplicada (`x produtores serão actualizados`).
- Confirmação: usa o mesmo padrão de `handleBulkSave` (lotes de 50, `validatePatecAssignment`, refetch, toast). Função nova `handleRegionAssign()`.
- PATEC seleccionável: usa `patecsForSeason` (mesma regra da época).

#### C. Mensagens / acessibilidade
- Mensagens em PT-AO.
- `aria-label` nos selects/checkboxes.

### Sem alterações
- Sem mudanças na BD nem em RPCs (reutiliza `farmers.update` por lotes).
- Sem mudanças noutras páginas.

## Critérios de aceitação

- No diálogo individual com um PATEC grande (PATEC-01..10), é possível fazer scroll dentro do popup e o `Guardar/Cancelar` permanece visível.
- Existe botão "Ver composição completa" no popup individual que abre o `PatecCompositionDialog`.
- Botão "Atribuir por região" abre diálogo com selecção de Província/Município/Escola (multi-select), pré-visualização da contagem, escolha de PATEC e opção "Substituir atribuições existentes".
- Ao confirmar, todos os produtores correspondentes recebem o PATEC (lotes de 50). Toast de sucesso/erro e refetch automático.
- Respeita scope (Sénior/Júnior/Extensionista só vê e altera os seus produtores) — basta operar sobre `farmers` já carregados em memória, que já passam por `applyFarmerScopeFilter`.