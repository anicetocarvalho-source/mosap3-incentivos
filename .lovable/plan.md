## Problema

Na lista lateral de `/patec` (e noutros locais que usam `patecMeta`), os pacotes de pecuária aparecem com o ícone genérico de caixa (`Package`) e fundo cinza, porque `patecMeta` em `src/pages/Patec.tsx` (linhas 66–77) só cobre os PATECs 1–10. Os PATECs 11–15 (Aves, Bovinos, Caprinos, Ovinos, Suínos) caem no fallback.

## Alteração

Estender `patecMeta` em `src/pages/Patec.tsx` com 5 novas entradas usando ícones de `lucide-react` já disponíveis e gradientes coerentes com a paleta agrícola/pecuária:

| PATEC | Cultura | Ícone | Gradiente |
|---|---|---|---|
| 11 | Aves | `Bird` | `from-sky-500 to-cyan-600` |
| 12 | Bovinos | `Beef` | `from-red-500 to-rose-600` |
| 13 | Caprinos | `PawPrint` | `from-amber-600 to-yellow-700` |
| 14 | Ovinos | `Rabbit` | `from-slate-400 to-zinc-500` |
| 15 | Suínos | `PiggyBank` | `from-pink-400 to-rose-500` |

Acrescentar os imports `Bird, Beef, PawPrint, Rabbit, PiggyBank` ao import existente de `lucide-react` no topo do ficheiro.

Manter o resto da estrutura (`color`, `bgAccent`, `chartFill`) consistente com o padrão dos itens 1–10.

## Notas

- `lucide-react` não tem ícones específicos de cabra, ovelha ou porco; `PawPrint`, `Rabbit` e `PiggyBank` são as escolhas mais próximas e mantêm o estilo SVG uniforme com os PATECs vegetais.
- Sem alterações de dados, schema, ou do form de criação de PATEC (continua a permitir edição manual do ícone).
- A mesma melhoria propaga-se automaticamente a todos os locais que consomem `patecMeta` (lista lateral, badges, gráficos, dashboards).

## Validação

Abrir `/patec` e confirmar que PATEC-11…PATEC-15 já mostram ícones distintos e gradientes próprios em vez do quadrado cinza com caixa.
