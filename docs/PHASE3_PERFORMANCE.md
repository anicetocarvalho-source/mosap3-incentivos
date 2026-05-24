# Fase 3 — Performance, Escala & Resiliência

Documento operacional do endurecimento pré-produção MOSAP3.

---

## 3.1 Saúde da base de dados — snapshot inicial

Resultado de `supabase--db_health` (2026-05-24):

| Métrica | Valor | Observação |
|---|---|---|
| DB | up | OK |
| PgBouncer | up | OK |
| Memória | 54% | OK |
| Disco de dados | 44% | OK |
| Ligações | 8/60 | folga grande |
| Pool clients | 1/200 | folga grande |
| Tamanho DB | 183.7 MB | pequeno |
| WAL | 416 MB | normal |
| Restarts | 0 | OK |

**Conclusão:** infraestrutura actual aguenta o volume actual (~15k produtores, ~70k transacções). Para escala 50k+ produtores, monitorizar memória e considerar `Upgrade instance` em Lovable Cloud → Advanced settings.

### Índices adicionados (migration `Fase 3 — Optimização`)

- `idx_pos_sale_items_sale_id` — join sale → items
- `idx_farmer_incentives_code_date` — timeline do produtor
- `idx_farmer_incentives_status` — filtros por estado
- `idx_pos_sales_supplier_created` — painel de vendas por fornecedor
- `idx_audit_logs_user_created` — página de auditoria por utilizador
- `idx_notifications_user_created` — listagem cronológica

### Manutenção

- `cleanup_old_notifications()` (apenas admin) — apaga notificações lidas >90d e não lidas >180d.
  Executar mensalmente via `/diagnostico` ou cron. Tabela tinha 133k linhas e 14k dead tuples; após primeira execução cair para <30k.

---

## 3.2 Testes de carga

### Cenários a validar em staging

| Cenário | Volume | Critério de aceitação |
|---|---|---|
| Listagem `/agricultores` | 50.000 produtores | <2s primeira página, paginação fluida |
| Listagem `/incentivos` | 100.000 incentivos | <2s, filtros geo aplicados |
| Listagem `/vendas` | 100.000 vendas | <2s, paginação server-side |
| Distribuição lote | 5.000 produtores | <60s, blocos de 50 |
| POS — venda completa | concurrent 20 | OTP send→verify→sale <5s p95 |
| Sync queue retomado | 200 items pendentes | <30s para limpar fila |

### Ferramentas

- **k6** ou **Artillery** para HTTP load (publicar URL: `https://mosap3-incentivos.lovable.app`)
- Geração de dados sintéticos: script Node em `scripts/seed-load-test.ts` (a criar antes do teste)
- Métricas observadas: p50/p95/p99 latência, taxa de erro, ligações DB durante o pico (`pg_stat_activity`)

### Limites conhecidos

- PostgREST devolve no máximo 1000 linhas por pedido → `fetchAllPages` já paraleliza chunks de 4 páginas.
- Edge Functions: timeout default 25s, ajustável.
- Storage: signed URLs válidas 1h, devem ser geradas sob demanda.

---

## 3.3 PWA offline — validação em dispositivos reais

### Checklist obrigatório (3-4 Androids)

- [ ] **Gama baixa** (Android 8, 2GB RAM): registo offline → reconectar → sync sem perda
- [ ] **Gama média** (Android 11, 4GB RAM): captura biométrica (4 dedos) com câmara
- [ ] **Tablet** (Android 13): POS kiosk em ecrã 10"
- [ ] **2G/3G simulado** (chrome devtools): bundle inicial <500KB, app utilizável em 10s
- [ ] **Sem rede** a meio de venda POS: estado preservado, retoma ao voltar online
- [ ] **SyncQueue v3** com 100+ items pendentes: backoff exponencial visível em `/diagnostico`

### Métricas-alvo

- Bundle inicial: ≤500 KB gzipped
- First Contentful Paint: ≤2s em 3G
- Lighthouse PWA: ≥90
- IndexedDB cache TTL: 30min (configurado em `offlineDb.ts`)

---

## 3.4 Backup & Disaster Recovery

### Política de backups (Lovable Cloud)

A Lovable Cloud faz backups diários automáticos com retenção de 7 dias (default). Para retenção fiscal AGT (5 anos), exportar mensalmente:

1. Snapshot SQL completo via dashboard Cloud
2. Export SAF-T (AO) mensal — já automatizado via `generate-saft`
3. Armazenamento offsite (Google Drive / Dropbox empresarial)

### Procedimento de restauro testado

**RTO alvo:** <4h em incidente major.

1. Abrir Lovable Cloud → Backups → restaurar para projecto novo
2. Validar contagens com queries de smoke test:
   ```sql
   SELECT count(*) FROM farmers;
   SELECT count(*), max(created_at) FROM pos_sales;
   SELECT count(*) FROM farmer_incentives;
   ```
3. Reconfigurar secrets (`SMS_GATEWAY_*`, Unitel Money credenciais) — não migram.
4. Apontar DNS / domínio custom para o novo URL.
5. Comunicar utilizadores via email + notificação in-app.

**Acção pendente:** correr 1 restauro de teste antes do go-live e cronometrar RTO real.

### Risco: perda de fornecedor Lovable Cloud

- Migração possível para Supabase self-hosted via export `pg_dump` mensal.
- Manter `supabase/migrations/` versionado em Git (já está).
- Edge Functions em `supabase/functions/` portáveis para Supabase CLI.

---

## Aviso sobre `supabase--linter` (39 WARN SECURITY DEFINER)

Os 39 avisos são todos do tipo "Public/Signed-In Users Can Execute SECURITY DEFINER Function" e correspondem a funções **intencionalmente** públicas/autenticadas, necessárias para o funcionamento do sistema:

- `public_verify_farmer_card`, `public_lookup_nfc_tag`, `public_lookup_device_session` — endpoints públicos seguros criados na Fase 1.1, validados por token.
- `has_role`, `has_any_backoffice_role`, `has_geographic_scope` — funções base do RBAC, chamadas em todas as RLS policies.
- `compute_saldo_final`, `cleanup_old_notifications`, etc. — utilitários servidor.

Todas têm `SECURITY DEFINER` com `search_path = public` para evitar privilege escalation, e validam manualmente o caller via `auth.uid()` ou token. As tabelas subjacentes mantêm RLS activa. Estes avisos são **falsos positivos arquitecturais** e estão registados em `security-memory`.
