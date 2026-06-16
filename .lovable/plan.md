## Problema

Na card **Composição dos Pacotes** (`/patec`), o título de cada linha mostra:

`PATEC-01 — PATEC 1 — Milho + Feijão · Milho + Feijão`

Isto porque rendemos `code — name · cultures`, mas o campo `name` já contém "PATEC N — Cultura" e `cultures` repete a cultura.

## Alteração

Em `src/pages/Patec.tsx` (linhas 1400-1410), simplificar o título para usar apenas o código e a cultura (com fallback para `name` quando `cultures` está vazio), seguindo o mesmo padrão já usado no filtro lateral (linha 1480):

```tsx
<p className="text-sm font-semibold leading-tight truncate">
  {p.code}
  <span className="text-muted-foreground font-normal">
    {" — "}{p.cultures || p.name}
  </span>
  {!p.is_active && (
    <span className="ml-2 text-[10px] uppercase tracking-wider text-muted-foreground">(inativo)</span>
  )}
</p>
```

Resultado: `PATEC-02 — Massango + Feijão`.

## Fora do âmbito

- `PatecsTab.tsx` (catálogo, cards maiores) — já mostra `code`, `name` e `cultures` em linhas separadas sem redundância visível, não alterar.
- `PatecCompositionDialog.tsx` (título do diálogo) — usa apenas `patec.name`; não alterar.
- Filtro `Filtrar PATEC` (linha 1480) — já está correcto.
- Sem alterações de dados nem de schema.

## Validação

Abrir `/patec` como Admin e confirmar que cada linha da Composição mostra apenas `PATEC-XX — <cultura>` sem repetição.
