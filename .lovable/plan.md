

Alterações em `src/pages/Agricultores.tsx` (apenas tabela desktop, mobile mantém-se):

**Colunas (antes → depois)**
- Agricultor • ~~BI~~ • Telefone • Província • Escola • PATEC • ~~Estado~~ • **Recebido** • **Disponível** • Ações

**Detalhes**
1. Remover colunas `BI` e `Estado` do `<thead>` e `<tbody>`.
2. Adicionar `Recebido` (verde) e `Disponível` (âmbar/destaque) usando `f.valor_recebido` e `f.saldo_final` já existentes em `farmers`. Formatador `Kz` (pt-AO, sem decimais redundantes).
3. Atualizar `useFarmersList` para incluir `valor_recebido, saldo_final` no `select`. Atualizar `FarmerListItem`.
4. Estado deixa de ser coluna mas continua a influenciar:
   - Linha de Removidos com `opacity-60`.
   - Filtro "Estado" no topo mantém-se.
   - Pequeno dot colorido (●) antes do nome do agricultor para indicar estado (Ativo verde, Pendente amarelo, Suspenso/Removido vermelho), tooltip com label.
5. Agrupar Ações num único `DropdownMenu` (ícone `MoreHorizontal`): Ver, Editar, Remover/Restaurar. Reduz a coluna a uma única célula estreita.
6. Skeletons e linhas-loading actualizados para nº de colunas novo.
7. CSV export mantém todas as colunas (inclui BI e Estado) — útil para auditoria.

Mobile (cards) inalterado — já é compacto.

