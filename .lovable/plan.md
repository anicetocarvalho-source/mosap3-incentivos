## Objetivo

Carregar no sistema a composição completa dos 10 Pacotes Tecnológicos (PATECs) a partir do ficheiro `PATECs_-_MOSAP3_V-Final.xlsx`, e mostrar essa composição no separador "Catálogo de Pacotes" da página `/patec`.

## Inventário do ficheiro

10 PATECs identificados:

| Nº | Agricultura | Pecuária |
|---|---|---|
| 1 | Milho + Feijão | Aves (5 M, 15 F) |
| 2 | Massango + Feijão | Bovinos (1 M, 1 F) |
| 3 | Massambala + Feijão | Caprinos (1 M, 4 F) |
| 4 | Mandioca + Feijão | Ovinos (1 M, 4 F) |
| 5 | Alho | Suínos |
| 6 | Batata Doce | — |
| 7 | Batata Rena | — |
| 8 | Cebola | — |
| 9 | Cenoura | — |
| 10 | Repolho | — |

Subcategorias presentes:
- **Agricultura por cultura:** Semente, Adubo (Amônio, Ureia, NPK, Composto orgânico), Inseticida (Benzoato-Emamectina, Cipermetrina, Imidacloroprido), Fungicida (Mancozeb, Melatonia, Metalaxil, Azoxistrobina), Plantas Sementes Melhoradoras (Mucuna, Crotalária, Cajanus Cajan), Mudas Frutícolas/Florestais (Abacate, Acácia, Bananeira, Café, Cacau, Casuarina, Cedro, Eucalipto, Goiabeira, Laranjeira, Limoeiro, Mamoeiro, Mangueira, Maracujá, Pinheiro, Tangerineira).
- **Pecuária por animal:** Ração, Antibióticos, Desparasitantes Internos, Desparasitante Externo, Vitaminas, Vacinas, Anti-inflamatório.
- **Transversal:** Irrigação e Equipamentos Gerais (folhas próprias).

A maioria das quantidades vem como `N/D`; apenas sementes, adubos, plantas de cobertura e contagens de animais têm valor numérico.

## Estado atual da base de dados

- `public.patecs`: **vazia** (0 registos).
- `public.patec_items`: **vazia**, com 2 restrições incompatíveis:
  - `patec_number IN (1,2,3)` → tem de aceitar 1‑10.
  - `category IN ('insumos','pecuaria','servicos')` → falta granularidade por subcategoria e cultura.

## Plano técnico

### 1. Migração de esquema

- Remover o check `patec_items_patec_number_check` e recriar como `patec_number BETWEEN 1 AND 50` (ou eliminar e ligar tudo via `patec_code`).
- Adicionar colunas em `patec_items`:
  - `subcategory text` (ex: `semente`, `adubo`, `inseticida`, `fungicida`, `planta_melhoradora`, `muda_fruteira_florestal`, `racao`, `antibiotico`, `desparasitante_interno`, `desparasitante_externo`, `vitamina`, `vacina`, `anti_inflamatorio`, `irrigacao`, `equipamento`).
  - `culture text NULL` (ex: `Milho`, `Feijão`, `Aves`, `Bovinos`…; NULL para itens transversais).
  - `sort_order int DEFAULT 0`.
- Manter `base_quantity numeric NULL` e `unit text NULL` para os itens `N/D`.
- Substituir o check de `category` por: `category IN ('agricultura','pecuaria','irrigacao','equipamento')`.

### 2. Seed dos 10 pacotes em `patecs`

Inserir cada PATEC com `code`, `name`, `cultures`, `icon`, `color_token`, `legacy_number` (1‑10), `sort_order`. Exemplos de cor/ícone (consistentes com a paleta atual `amber/emerald/violet/sky/rose/slate/orange`):

```
PATEC-01  Milho + Feijão           wheat    amber
PATEC-02  Massango + Feijão        wheat    orange
PATEC-03  Massambala + Feijão      wheat    rose
PATEC-04  Mandioca + Feijão        sprout   emerald
PATEC-05  Alho                     sprout   violet
PATEC-06  Batata Doce              carrot   sky
PATEC-07  Batata Rena              carrot   slate
PATEC-08  Cebola                   sprout   amber
PATEC-09  Cenoura                  carrot   orange
PATEC-10  Repolho                  leaf     emerald
```

### 3. Seed da composição em `patec_items`

Script Python lê o `.xlsx` e gera um único `INSERT` para `patec_items`:
- Cada linha com `patec_number`, `patec_code`, `category`, `subcategory`, `culture`, `name`, `base_quantity` (numérico se parseável, senão NULL), `unit` (Kg, Feixes, Litros, mL, cabeça), `sort_order`.
- Para "Quantidade Aves/Bovinos/Caprinos macho/fêmea": criar 2 linhas `category=pecuaria, subcategory=animal, name='Macho'/'Fêmea', base_quantity=N, unit='cabeça'`.
- Folhas **Irrigação** e **Equipamentos Gerais** entram com `patec_number=NULL` (ou pseudo-pacote partilhado) — confirmar opção (ver pergunta abaixo).

### 4. UI — exibir composição em `/patec`

No `PatecsTab.tsx`, adicionar à cada Card um botão **"Ver composição"** que abre um `Dialog` (novo ficheiro `PatecCompositionDialog.tsx`) com:
- Tabs por categoria (`Agricultura | Pecuária | Irrigação | Equipamentos`).
- Dentro de cada tab, secções agrupadas por `culture`/`animal` e por `subcategory`.
- Tabela com `Nome | Quantidade base | Unidade`.
- Quantidades NULL mostradas como `—` com badge "a definir".

Hook novo: `usePatecItems(patecCode)` em `src/hooks/usePatecs.ts` (extensão).

### 5. Atualização de tipos

Após a migração, o ficheiro `src/integrations/supabase/types.ts` é regenerado automaticamente — nenhum trabalho manual.

## Perguntas a confirmar

1. **Quantidades "N/D":** importar com `base_quantity = NULL` (preferido — composição completa, valores a definir mais tarde) ou ignorar as linhas N/D?
2. **Irrigação e Equipamentos Gerais:** anexar a *todos* os 10 PATECs, criar um pseudo-PATEC partilhado, ou deixar como catálogo separado (ex: nova tab "Comuns" no `/patec`)?
3. **Edição inline:** apenas leitura por agora, ou já permitir editar quantidades pela UI (admins)?

Sem resposta, assumo: (1) NULL, (2) catálogo separado partilhado, (3) só leitura nesta fase.
