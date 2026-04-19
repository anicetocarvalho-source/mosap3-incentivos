
O utilizador quer redesenhar a página `/auth` (Auth.tsx) para ficar premium e adicionar acesso para fornecedores. Já existe `/fornecedor/login` (FornecedorAuth.tsx) separado. A solução mais elegante é adicionar um **toggle visível** entre "Backoffice MOSAP3" e "Fornecedor" na mesma tela, sem fundir os fluxos (cada um continua a chamar a sua lógica/página).

## Plano

### Página `/auth` — redesign premium

**Layout split-screen (desktop ≥1024px)**
```
┌───────────────────────┬──────────────────────┐
│  Painel esquerdo      │  Painel direito      │
│  (gradiente verde)    │  (formulário)        │
│  - Logo MOSAP3 grande │  - Toggle perfil     │
│  - Tagline            │  - Form login        │
│  - 3 highlights       │  - CTA secundário    │
│  - Indicador online   │                      │
└───────────────────────┴──────────────────────┘
```

Mobile: empilhado (hero compacto em cima, form abaixo).

**Toggle de perfil no topo do form** (segmented control com 2 botões grandes):
- **Backoffice** (verde, default) → fluxo actual de email/password do MOSAP3.
- **Fornecedor** → redirige para `/fornecedor/login` (mantém isolamento já planeado em "portal-fornecedor-autonomia").
- Pequeno texto explicativo por baixo: "Acesso ao módulo comercial e POS para venda aos agricultores."

**Melhorias visuais (sem mudar lógica)**
1. Card com `backdrop-blur`, sombra suave, borda subtil; ocupa altura total no painel direito.
2. Inputs com ícones (Mail, Lock), focus ring verde, height 11.
3. Botão principal com gradiente verde + estado loading com spinner inline.
4. Badge offline/online no topo do form (quando offline mostra aviso âmbar).
5. Animações Framer Motion já existem — refinadas com `staggerChildren` e fade dos highlights.
6. Footer minimal: "© MOSAP3 · v1.0 · Apoio: suporte@mosap3.ao".
7. Painel esquerdo com **3 features destacadas** (icon + título + 1 linha):
   - "Cadastro Biométrico"
   - "Pacotes Tecnológicos"
   - "POS Comercial Integrado"
8. Botões de teste (TEST_USERS) movidos para um `Collapsible` discreto "Acessos de demonstração" (só aparece se online, como já é).

**Fluxo Fornecedor a partir do `/auth`**
- Clicar no toggle "Fornecedor" troca o card para um estado informativo:
  - Ícone Store grande
  - Título "Portal do Fornecedor"
  - Descrição: "Faça login para gerir as suas lojas, stock e realizar vendas via POS aos agricultores."
  - Botão primário "Entrar como Fornecedor" → `navigate("/fornecedor/login")`
  - Link secundário "Registar nova empresa" → `navigate("/fornecedor/login")` (lá já há tabs login/registo)

Não duplico o form aqui — o `FornecedorAuth.tsx` já é multi-step (3 passos: empresa → lojas → conta) e funciona bem. O `/auth` apenas serve de **ponto de entrada visível**.

### `/fornecedor/login` — pequenos refinamentos
- Adicionar link "← Voltar ao acesso Backoffice" no topo (navega para `/auth`).
- Manter restante intacto (já é multi-step e funcional).

### Ficheiros a editar
- `src/pages/Auth.tsx` — redesign completo, toggle perfil, painel split-screen.
- `src/pages/fornecedor/FornecedorAuth.tsx` — adicionar link de retorno para `/auth`.

### Sem alterações
- Sem mudanças de BD.
- Sem alterações de lógica de auth, roles, ou cache offline.
- TEST_USERS continua disponível (escondido em Collapsible).

### Resultado
Tela de login premium, dual-mode (Backoffice + Fornecedor), responsiva, com identidade visual reforçada e ponto de entrada claro para o módulo comercial — sem fundir fluxos nem partir nada do que já existe.
