## Objectivo

Introduzir o modelo normalizado do `PATECs_estruturado.xlsx` na BD, com as folhas 03/05/06 totalmente populadas e com a coluna `is_optional` preservada. O `patec_items` actual (flat, 1195 linhas, sem opcionais) fica intacto para retro-compatibilidade do POS e atribuição em lote.

> **Nota importante**: o `patec_items` actual não contém `ID_Componente` nem o flag `Opcional` — não é possível reconstruir 03/05/06 só a partir dele. A migração lê o xlsx (`/mnt/user-uploads/PATECs_estruturado.xlsx`) como fonte de verdade e popula as novas tabelas; o `patec_items` continua a ser a vista usada pelas telas existentes.

## Mapeamento de códigos

PATEC xlsx → código BD (igual à importação anterior):

```text
A01→01  A02→02  A03→03  A04→07  A05→04
A06→05  A07→09  A08→10  A09→08  A10→06
P01→11  P02→12  P03→13  P04→14  P05→15
```

## Novas tabelas (schema `public`)

Todas com `id uuid pk`, `created_at`, `updated_at`, trigger `update_updated_at_column`, RLS ON, GRANT a `authenticated` (SELECT) e `service_role` (ALL). Apenas admins/gestores fazem escrita (políticas com `has_role`).

1. **`patec_products`** — catálogo mestre (folha 01, 189 produtos)
   - `product_code text unique not null` (ex.: `SEM-001`)
   - `name text not null`
   - `category text`, `subcategory text`, `unit text`

2. **`patec_components`** — módulos reutilizáveis (folha 02, 20 componentes)
   - `component_code text unique not null` (ex.: `CMP-AGR-01`)
   - `name text not null`
   - `kind text` (Cultura agrícola / Pecuária / Irrigação / Equipamento / Melhoradoras)
   - `base_dimension text` (ex.: "por hectare")

3. **`patec_component_items`** — BOM componente→produto (folha 03, ~396 linhas)
   - `component_id uuid fk patec_components`
   - `product_id uuid fk patec_products`
   - `quantity numeric` (0 quando pendente)
   - `unit text`, `state text` (Confirmado/Pendente), `note text`
   - `unique(component_id, product_id)`

4. **`patec_package_components`** — pacote→componente (folha 05, ~65 linhas)
   - `patec_id uuid fk patecs` (resolvido via `code` mapeado)
   - `component_id uuid fk patec_components`
   - `is_optional boolean default false` (`Opcional` → true)
   - `unique(patec_id, component_id)`

5. **`patec_package_expanded`** — vista materializada (folha 06, ~1295 linhas)
   - `patec_id uuid fk patecs`
   - `component_id uuid fk patec_components`
   - `product_id uuid fk patec_products`
   - `quantity numeric`, `unit text`
   - `is_optional boolean default false`
   - `state text`, `note text`
   - Índices em `(patec_id)` e `(patec_id, is_optional)`

## Passos

1. **Migration** (SQL único): cria as 5 tabelas, GRANTs, RLS, políticas, triggers.
2. **Importação de dados** (script Python local, depois `supabase--insert` em lotes de 50):
   - Limpa cada tabela na ordem inversa das FKs.
   - Insere `patec_products` (folha 01).
   - Insere `patec_components` (folha 02).
   - Insere `patec_component_items` (folha 03), resolvendo `component_code`/`product_code`.
   - Insere `patec_package_components` (folha 05), com `is_optional = (Inclusão == 'Opcional')` e mapeamento PATEC-Axx/Pxx → PATEC-NN.
   - Insere `patec_package_expanded` (folha 06) com a mesma lógica de mapeamento + `is_optional`.
3. **Verificação**: contagens por pacote vs xlsx; spot-check 3 pacotes (1 agrícola, 1 pecuário, Mandioca).
4. **Sem alterações de UI** neste passo — o dialog `PatecCompositionDialog` continua a ler de `patec_items`. Numa fase seguinte poderá passar a usar `patec_package_expanded` para mostrar opcionais.
5. **Memória**: actualizar `mem://features/patec-composicao` a referir as novas tabelas e a coexistência com `patec_items`.

## Pecuária e irrigação

A regra anterior ("pecuária não inclui irrigação") fica codificada nos próprios dados do xlsx (folha 05 não associa CMP-REG-* a PATEC-Pxx), portanto não é necessário filtro especial na importação.

## Fora do âmbito

- Não alteramos `patec_items` nem `patecs`.
- Não migramos UI para consumir as novas tabelas (fase seguinte, opcional).
- Não criamos endpoints novos.
