
The user is asking what else we can improve in the Layout. Current state: Dashboard was just redesigned (Hero, KPI cards, Chart cards). Now we should look at the broader layout shell — sidebar, navbar, page chrome — for premium polish.

Looking at AppLayout + AppNavbar + sidebar:
- Has both a top navbar AND a left sidebar — duplicates navigation, wastes vertical space
- Sidebar uses custom collapse logic instead of shadcn Sidebar
- No breadcrumbs / page header pattern (each page reinvents its own title)
- Main content area lacks max-width and consistent vertical rhythm
- No global page-transition animation
- OnlineStatusBanner sits above navbar pushing layout down
- Mobile: navbar dropdowns collapse fine but sidebar disappears completely

Let me propose a focused, high-impact set of improvements.

---

# Melhorias de Layout Propostas

## 1. Unificar navegação (eliminar duplicação navbar+sidebar)
Hoje temos navbar superior **e** sidebar lateral mostrando os mesmos itens. Proposta:
- **Navbar superior**: passa a ser slim (h-12), só com logo, breadcrumb, pesquisa global, notificações e avatar
- **Sidebar lateral**: passa a ser a navegação principal usando o componente shadcn `Sidebar` (com `collapsible="icon"`), mantendo modo compacto profissional
- Remove dropdowns de hover do navbar (movidos para sidebar agrupada)

## 2. Sistema de Page Header consistente
Criar `<PageHeader>` reutilizável com:
- Breadcrumb automático (com base na rota)
- Título + descrição
- Slot de acções à direita (botões CTA)
- Aplicar em todas as páginas principais

## 3. Container e ritmo vertical
- Adicionar `max-w-[1600px] mx-auto` ao `<main>` para evitar conteúdo esticado em ecrãs grandes
- Padding consistente (`px-4 md:px-6 lg:px-8 py-6`)
- Espaçamento padronizado entre secções

## 4. OnlineStatusBanner como toast/pill flutuante
Em vez de empurrar todo o layout para baixo, mostrar como pill discreto no canto inferior direito (só aparece quando offline/sincronizando).

## 5. Transições suaves entre páginas
Wrapper com `framer-motion` AnimatePresence no `<Outlet />` para fade/slide subtil ao navegar.

## 6. Sidebar premium
- Logo MOSAP3 no topo com versão compacta quando recolhido
- Secções com labels ("Operação", "Comercial", "Sistema")
- Indicador visual da rota activa (barra lateral colorida)
- Footer com info do utilizador (avatar + nome + role) e botão logout
- Notificações pending count visível mesmo recolhido

## 7. Tema / micro-detalhes
- Melhor contraste do sidebar escuro (já usa `--sidebar-*` tokens)
- Scrollbar customizada subtil
- Focus rings consistentes (`ring-ring/40`)

---

## Ficheiros a alterar/criar

| Ficheiro | Alteração |
|---|---|
| `src/components/AppLayout.tsx` | Refactor completo: usar `SidebarProvider` + slim navbar |
| `src/components/AppSidebar.tsx` | Reescrever com shadcn Sidebar, secções agrupadas, footer com user |
| `src/components/AppNavbar.tsx` | Slim down: só breadcrumb, search, bell, avatar |
| `src/components/PageHeader.tsx` | **Novo** — breadcrumb + título + descrição + acções |
| `src/components/OnlineStatusBanner.tsx` | Converter em pill flutuante |
| `src/components/PageTransition.tsx` | **Novo** — wrapper framer-motion |
| `src/index.css` | Scrollbar custom, focus rings |
| Páginas principais (Dashboard, Agricultores, Parcelas, etc.) | Adoptar `<PageHeader>` |

## Estimativa
Mudança estrutural — afecta o shell (3 componentes core) + criação de 2 novos componentes + adopção gradual em páginas. Posso aplicar em todas as páginas principais numa só passagem.
