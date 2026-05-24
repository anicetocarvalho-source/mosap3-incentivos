# Changelog MOSAP3

Formato: [Não publicado] / [data].
Datas em ISO. Mudanças agrupadas: Adicionado, Alterado, Corrigido, Segurança, Removido.

---

## [2026-05-24] — Endurecimento pré-produção (Fases 1, 3, 4)

### Segurança (Fase 1)
- HIBP (Have I Been Pwned) activado nas palavras-passe.
- Registo público e contas anónimas desactivados.
- RBAC `has_any_backoffice_role` endurecida com enumeração explícita de 9 roles.
- RLS sensível removida do acesso anónimo: `pos_sales`, `pos_sale_items`, `credit_notes`, `farmer_cards`, `farmer_nfc_tags`, `fingerprint_verifications`, `stock_movements`.
- Novas RPCs públicas seguras (validadas por token): `public_verify_farmer_card`, `public_lookup_nfc_tag`, `public_lookup_device_session`.
- Storage: `farmer-media` e `supplier-logos` restringidos a backoffice / fornecedores donos.

### Performance (Fase 3)
- 6 índices novos: `pos_sale_items.sale_id`, `farmer_incentives(farmer_code, incentive_date)`, `farmer_incentives.status`, `pos_sales(supplier_id, created_at)`, `audit_logs(user_id, created_at)`, `notifications(user_id, created_at)`.
- Função admin `cleanup_old_notifications()` para reduzir a tabela de notificações (>90d lidas, >180d não lidas).
- Snapshot DB validado: 54% memória, 44% disco, 8/60 ligações — folga ampla.

### Operação & UX (Fase 4)
- **Adicionado:** reporte centralizado de erros no `client_errors` (tabela nova com RLS).
  - `ErrorBoundary` envia mensagem + stack + URL + versão.
  - Handlers globais para `window.onerror` e `unhandledrejection`.
  - Throttling de 1× por minuto para o mesmo par mensagem+URL.
- **Adicionado:** `/diagnostico` reformulado com 4 KPIs (ligação, fila de sync, erros 24h, ambiente/versão), botão "Forçar sync" e tabela de últimos 10 erros (admin).
- **Adicionado:** botões admin no `/diagnostico` para limpar notificações antigas e erros >30d.
- **Alterado:** `isDevOrPreview()` passa a tratar a published `.lovable.app` como **produção**. Só `id-preview--*.lovable.app`, `localhost` e `VITE_FORCE_DEV_MODE=true` mostram o auto-fill de demo. Isto **esconde os 9 perfis de teste** no URL público antes do go-live.

### Documentação
- `docs/PHASE3_PERFORMANCE.md` — checklist completo de testes de carga, validação PWA em Androids reais, backup & DR.
- `CHANGELOG.md` — este ficheiro.

---

## Convenção

- **Mudanças visíveis ao utilizador final** entram aqui.
- **Detalhes técnicos** ficam nos commits e em `.lovable/plan.md`.
- Mantemos as últimas 10 entradas; mais antigas movem-se para `docs/CHANGELOG_ARCHIVE.md` quando necessário.
