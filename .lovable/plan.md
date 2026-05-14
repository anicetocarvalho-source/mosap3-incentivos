## Diagnóstico

A escola que está a abrir é **"1 De Maio" — Balombo / Benguela** (id `6b5c61…08caa`).

Na base de dados existem **três escolas com o mesmo nome "1 De Maio"** em municípios diferentes:

| Província | Município | Produtores |
|---|---|---|
| Benguela | **Cubal** | 56 |
| Benguela | **Balombo** | 20 |
| Huíla | Quipungo | 45 |

O hook `useSchoolDetail` filtra os produtores por **nome da escola + província**, mas **ignora o município**. Resultado: para a escola de Balombo soma também os 56 produtores de Cubal → **76**. O número correcto é **20**.

A causa é a tabela `farmers` guardar a escola como texto (`school`) sem `school_id`, e o filtro actual só comparar `school` + `province`.

## Correcção

1. **`src/hooks/useSchoolDetail.ts`**
   - Adicionar comparação por município à query de produtores: além de `school` e `province`, exigir que `farmers.municipality` (normalizado, lowercase, trim) seja igual ao município da escola obtido via `municipalities`.
   - Manter `.ilike("school", dbSchool.name)` na query Supabase e reforçar com filtro no cliente (igual ao padrão actual) incluindo agora o município.
   - Tratar caso em que `farmers.municipality` está vazio: nesse caso, não incluir o produtor (evita arrastar duplicados sem município definido para a escola errada).

2. **Confirmação visual**
   - Após a correcção, abrir `/escolas/6b5c6129-…` deve mostrar 20 produtores.
   - As outras duas escolas com nome "1 De Maio" (Cubal e Quipungo) continuam a mostrar 56 e 45 respectivamente.

## Fora do âmbito

- **Não** vou recalcular nem actualizar a coluna `schools.total_farmers` (usada nas listas `/escolas` e `/escolas/provincia/...`). Posso fazê-lo num passo seguinte se quiser que os contadores das listas também fiquem correctos — diga.
- **Não** vou introduzir `school_id` na tabela `farmers` (mudança estrutural maior).

## Ficheiros alterados

- `src/hooks/useSchoolDetail.ts` (filtro de produtores)
