# Plano: Endurecimento Pré-Produção MOSAP3

---

## ✅ Fase 1 — Segurança & Conformidade (concluída)

- HIBP, signup público desactivado, anónimos desactivados.
- RBAC endurecida, RLS sensível protegida, RPCs públicas seguras.
- Storage `farmer-media` e `supplier-logos` restringidos.
- Resultado: 0 erros críticos.

---

## Fase 2 — Integrações Críticas (próxima)

**2.1 Unitel Money produção** — BuyGoods sync/async/refund com credenciais reais, idempotência, job de reconciliação.
**2.2 SMS Gateway POS OTP** — substituir `dev_code` por gateway Unitel SMS (secrets `SMS_GATEWAY_URL/TOKEN/SENDER_ID`).
**2.3 SAF-T (AO)** — homologação AGT com 1 mês de dados reais.
**2.4 Auditoria** — cobertura completa de `audit_logs` e retenção 5 anos.

---

## ✅ Fase 3 — Performance, Escala & Resiliência (concluída)

- 6 índices novos, função `cleanup_old_notifications()`.
- Snapshot DB saudável.
- Doc completa em `docs/PHASE3_PERFORMANCE.md` (testes carga, PWA Androids, DR).

---

## ✅ Fase 4 — Operação & UX (concluída — parte automatizável)

**4.1 Monitorização (feito):**
- Tabela `client_errors` + RPC `cleanup_old_client_errors()`.
- `lib/errorReporter.ts` com throttle de 60s por (mensagem+URL).
- Handlers globais para `window.onerror` e `unhandledrejection`.
- `ErrorBoundary` envia erros + component stack.
- `/diagnostico` reformulado: KPIs (ligação, fila sync, erros 24h, versão), forçar sync, tabela de erros recentes (admin), botões de limpeza.

**4.2 Limpeza pré-go-live (feito):**
- `isDevOrPreview()` corrigido — auto-fill dos 9 perfis de teste só aparece em `id-preview--*.lovable.app`, `localhost` ou `VITE_FORCE_DEV_MODE=true`. **Já não aparece no URL publicado**.
- Pendente manual: limpar produtores/vendas/incentivos de teste da base de dados antes do go-live.

**4.3 Documentação (parcial):**
- `CHANGELOG.md` criado e visível para futura referência.
- Pendente manual: manual do utilizador por perfil RBAC (9 níveis) e vídeos curtos de fluxos críticos.

**4.4 Testes E2E (opcional):**
- Playwright nos fluxos críticos (registo produtor, venda POS com OTP, distribuição de incentivos em lote). Não implementado, sugerido para iteração futura.

**Pendente externo:**
- Alerts (SyncQueue, edge errors >5%, Unitel callbacks) — requer integração com Sentry/Datadog ou serviço similar.
- Manual e vídeos — produção de conteúdo manual.

---

## Próximo passo

**Fase 2** — começar por adicionar os secrets `SMS_GATEWAY_*` e validar Unitel Money em sandbox → produção.
