## Problema

A página `/instalar` faz crash com `Converting circular structure to JSON` no `useEffect` da linha 198-200:

```ts
localStorage.setItem(STORAGE_KEY, JSON.stringify(checklists));
```

O estado `checklists` contém nós React no campo `icon` (`<Smartphone />`), e elementos React têm referências circulares (`_context.Provider`), pelo que `JSON.stringify` rebenta.

A reidratação inicial (linha 161, `JSON.parse(saved)`) também devolve objectos sem `icon` válido — mesmo quando o `localStorage` tem dados antigos, os ícones ficam como objectos serializados sem sentido.

## Correcção em `src/pages/Instalar.tsx`

1. Remover o campo `icon` da interface `ChecklistSection` (passa a ser apenas dados serializáveis: `title`, `os`, `steps`).
2. Criar um mapa local `ICONS: Record<"android" | "ios", ReactNode>` fora do componente para obter o ícone a partir de `section.os` no render.
3. Manter o `useEffect` de persistência, agora seguro porque o estado é puro JSON.
4. Garantir que o `useState` inicial e a validação do `localStorage` continuam a funcionar (já não há `icon` para validar).
5. Actualizar o JSX que usa `section.icon` para usar `ICONS[section.os]`.

Sem mudanças noutros ficheiros, sem mudanças de comportamento visual.
