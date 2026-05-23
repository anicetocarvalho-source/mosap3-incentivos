# Plano: Endurecimento Pré-Produção MOSAP3

Objectivo: deixar o sistema pronto para go-live com produtores reais, MOSAP3Pay com Unitel Money em produção e conformidade AGT. Organizado em 4 fases sequenciais.

---

## Fase 1 — Segurança & Conformidade (bloqueante)

**1.1 Auditoria automática**
- Correr `supabase--linter` e fechar todos os warnings.
- Correr `security--run_security_scan` e tratar findings ALTO/CRÍTICO.
- Activar **Leaked Password Protection (HIBP)** via `configure_auth`.

**1.2 Revisão manual de RLS**
- Validar políticas nas tabelas sensíveis: `farmers`, `farmer_incentives`, `pos_sales`, `pos_payment_otps`, `user_roles`, `system_settings`, `audit_logs`, `farmer_documents`.
- Confirmar que `system_settings` com chaves Unitel só é legível por admin.
- Garantir que nenhuma Edge Function devolve `service_role` ou dados fora do âmbito do utilizador.

**1.3 SMS Gateway para OTP do POS**
- Hoje `pos-otp-send` devolve `dev_code` ao fornecedor quando `SMS_GATEWAY_ENABLED!="true"` — inseguro em produção.
- Configurar gateway SMS real (Unitel SMS) e adicionar secrets `SMS_GATEWAY_URL`, `SMS_GATEWAY_TOKEN`, `SMS_SENDER_ID`.
- Bloquear `dev_code` em domínio de produção mesmo com gateway off.

---

## Fase 2 — Integrações Críticas

**2.1 Unitel Money — validação end-to-end com credenciais de produção**
- Testar BuyGoods sync, async e refund com transacções reais de baixo valor.
- Confirmar idempotência: callback async duplicada não cria dupla venda.
- Implementar job de reconciliação para callbacks perdidas (cron edge function).
- Timeout/retry policy explícita em `unitel-money-payment`.

**2.2 SAF-T (AO) — homologação AGT**
- Gerar SAF-T de 1 mês completo com vendas + notas de crédito.
- Correr `validate-saft` e corrigir avarias.
- Submeter ficheiro de teste ao portal AGT para validação oficial.

**2.3 Auditoria completa de acções sensíveis**
- Confirmar que `audit_logs` regista: CRUD produtores, incentivos, vendas, alterações de role, alterações de `system_settings`, anulações/notas de crédito, OTP send/verify.
- Definir política de retenção (ex: 5 anos para fiscal).

---

## Fase 3 — Performance, Escala & Resiliência

**3.1 Saúde da base de dados**
- Correr `supabase--db_health` e dimensionar instância adequada.
- Adicionar índices nas colunas mais consultadas: `farmers(province_id, municipality_id, eca_code, status)`, `pos_sales(farmer_code, created_at, status)`, `farmer_incentives(farmer_code, season_id)`.

**3.2 Testes de carga**
- Simular 50k produtores e 100k transacções em ambiente de staging.
- Validar que `fetchAllPages` e ecrãs com listagens grandes (`/agricultores`, `/incentivos`, `/vendas`) respondem <2s.

**3.3 PWA offline — validação em dispositivos reais**
- Testar checklist do README em 3-4 Androids reais (incluindo gama baixa usada por extensionistas).
- Cenários: registo offline → reconectar → sync; perda de conectividade a meio de venda POS; SyncQueue v3 com 100+ items pendentes.
- Medir tamanho do bundle inicial (importante para 2G/3G rurais).

**3.4 Backup & disaster recovery**
- Documentar política de backups automáticos.
- Executar restauro de teste pelo menos 1× e cronometrar RTO.

---

## Fase 4 — Operação & UX

**4.1 Monitorização**
- Integrar reporte de erros frontend (Sentry ou equivalente) no `ErrorBoundary`.
- Alertas automáticos: SyncQueue acumulando, Edge Functions com erro >5%, callbacks Unitel falhadas.
- Expor métricas-chave em `/diagnostico` para admin.

**4.2 Limpeza pré-go-live**
- Verificar que auto-fill dos 9 perfis de teste (`isDevOrPreview()`) está desactivado no domínio de produção final (não `.lovable.app`).
- Limpar produtores, vendas e incentivos de teste da base de dados.
- Verificar que `disable_signup=true` no auth (registo público fechado).

**4.3 Onboarding & documentação**
- Manual do utilizador resumido por perfil RBAC (9 níveis).
- Vídeos curtos (2-3 min): registo de produtor, registo de parcela, venda POS com OTP, distribuição de incentivos em lote.
- Changelog visível ao utilizador.

**4.4 Testes E2E dos fluxos críticos** (opcional mas recomendado)
- Playwright cobrindo: registo de produtor, venda POS com OTP, distribuição de incentivos em lote.

---

## Detalhes técnicos

**Ordem de execução recomendada:** Fase 1 → 2 em paralelo com 3.1/3.2 → 3.3/3.4 → 4.

**Ferramentas automáticas a usar primeiro:**
- `supabase--linter`
- `security--run_security_scan`
- `supabase--db_health`
- `security--get_table_schema`

**Secrets a adicionar antes de produção:**
- `SMS_GATEWAY_URL`, `SMS_GATEWAY_TOKEN`, `SMS_SENDER_ID`, `SMS_GATEWAY_ENABLED=true`
- Credenciais Unitel Money de produção (substituir as de sandbox em `system_settings`)

**Não está no plano (já implementado):** RBAC, RLS base, SyncQueue v3, compressão de imagens, saldo canónico, soft-delete de produtores, SAF-T generator, kiosk mode.

---

## Próximo passo proposto

Começar pela **Fase 1.1** — corrida automática dos 3 scanners (linter, security scan, db health) para obter findings concretos e refinar este plano com prioridades reais do teu projecto.
