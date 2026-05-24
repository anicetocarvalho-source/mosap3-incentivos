# Plano: Endurecimento Pré-Produção MOSAP3

Objectivo: deixar o sistema pronto para go-live com produtores reais, MOSAP3Pay com Unitel Money em produção e conformidade AGT.

---

## ✅ Fase 1 — Segurança & Conformidade (concluída)

- HIBP activado, signup público desactivado, anónimos desactivados.
- RBAC `has_any_backoffice_role` endurecida (enumeração explícita de 9 roles).
- RLS removida de tabelas sensíveis para anon: `pos_sales`, `pos_sale_items`, `credit_notes`, `farmer_cards`, `farmer_nfc_tags`, `fingerprint_verifications`, `stock_movements`.
- RPCs públicas seguras: `public_verify_farmer_card`, `public_lookup_nfc_tag`, `public_lookup_device_session`.
- Storage `farmer-media` e `supplier-logos` restringidos.
- Resultado: 0 erros críticos (antes: 9).

---

## Fase 2 — Integrações Críticas (próxima)

**2.1 Unitel Money produção** — BuyGoods sync/async/refund com credenciais reais, idempotência, job de reconciliação.
**2.2 SMS Gateway POS OTP** — substituir `dev_code` por gateway Unitel SMS real (secrets `SMS_GATEWAY_URL/TOKEN/SENDER_ID`).
**2.3 SAF-T (AO)** — homologação AGT com 1 mês de dados reais.
**2.4 Auditoria completa** — confirmar cobertura `audit_logs` e retenção 5 anos.

---

## ✅ Fase 3 — Performance, Escala & Resiliência (concluída)

**3.1 Saúde DB** — snapshot OK (mem 54%, disco 44%, conn 8/60). Ver `docs/PHASE3_PERFORMANCE.md`.

**3.2 Índices adicionados:**
- `idx_pos_sale_items_sale_id`
- `idx_farmer_incentives_code_date`, `idx_farmer_incentives_status`
- `idx_pos_sales_supplier_created`
- `idx_audit_logs_user_created`
- `idx_notifications_user_created`

**3.3 Manutenção:** função `cleanup_old_notifications()` (admin-only) — apaga lidas >90d, não lidas >180d. Tabela actual: 133k linhas, 14k dead tuples → executar 1ª vez antes do go-live.

**3.4 A executar manualmente antes do go-live** (instruções em `docs/PHASE3_PERFORMANCE.md`):
- Testes de carga k6/Artillery em staging (50k produtores, 100k transacções, alvo <2s p95).
- Validação PWA em 3-4 Androids reais (incluindo gama baixa + 2G/3G).
- 1 restauro de backup cronometrado (RTO alvo <4h).
- Export SAF-T mensal offsite (retenção fiscal 5 anos).

**3.5 Linter:** 39 warnings SECURITY DEFINER são falsos positivos arquitecturais (RPCs públicas seguras + helpers RBAC). Documentado.

---

## Fase 4 — Operação & UX

**4.1 Monitorização** — Sentry no `ErrorBoundary`, alertas (SyncQueue, edge errors >5%, Unitel callbacks), métricas em `/diagnostico`.
**4.2 Limpeza pré-go-live** — auto-fill 9 perfis desactivado no domínio final, limpar dados de teste, `disable_signup=true` confirmado.
**4.3 Onboarding** — manual por perfil RBAC, vídeos curtos, changelog.
**4.4 Testes E2E** (opcional) — Playwright nos fluxos críticos.

---

## Próximo passo

Fase 2 — começar por adicionar secrets `SMS_GATEWAY_*` e validar Unitel Money em ambiente sandbox→produção.
