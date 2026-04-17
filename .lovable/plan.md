
The user wants comprehensive route testing. This is a verification/testing task using the browser tool, not a code change. Let me plan a structured test pass.

Routes to test (from App.tsx):
- Public: /auth, /fornecedor/login
- Protected (admin layout): /, /agricultores, /agricultores/:id, /agricultores/:id/ficha, /escolas, /escolas/provincia/:slug, /escolas/:id, /escolas/:id/ficha, /parcelas, /producao, /instalar, /patec, /mosap3pay/*, /incentivos, /transacoes, /relatorios, /utilizadores, /perfis, /configuracoes, /provincias
- Supplier portal: /fornecedor, /fornecedor/produtos, /fornecedor/stock, /fornecedor/pos, /fornecedor/vendas, /fornecedor/lojas, /fornecedor/perfil
- 404: any non-existent route

Test scenarios:
1. Unauthenticated access to protected routes → should redirect to /auth
2. Unauthenticated access to /fornecedor/* → should redirect to /fornecedor/login
3. Direct URL access to public routes
4. 404 page for non-existent routes
5. Browser back/forward navigation consistency
6. After login, sidebar navigation between modules
7. RoleGuard behavior (will need a non-admin role, but if only admin test user is logged, document the expected behaviour)

Since this requires browser automation and the user explicitly asked to "test" — that's allowed. But I'm in READ-ONLY plan mode, so I must present a plan first and get approval before running browser tests.

Plan should be concise — just outline the test matrix and expected outcomes.
