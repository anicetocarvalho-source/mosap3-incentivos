## Diagnóstico

As alterações de código anteriores podem estar correctas, mas há duas causas que explicam porque o sistema continua a mostrar valores antigos:

1. **A própria fonte única `/patec` ainda contém nomes legados na base de dados**
   - `patecs.name` ainda tem valores como `PATEC 1 — Milho + Feijão`, `PATEC 2 — Massango + Feijão`, etc.
   - Portanto, qualquer ecrã que agora usa correctamente o catálogo vai continuar a reflectir esses valores enquanto o catálogo não for actualizado.

2. **Há cache PWA/API que pode manter respostas antigas após publicar**
   - O projecto usa `vite-plugin-pwa` com cache para chamadas REST do backend (`supabase-api`) até 24h.
   - Em preview/dev, a configuração actual não tem os guardrails recomendados para impedir service worker/cache de interferir.

Também ainda há pontos técnicos a alinhar:
- `/patec` mantém `patecMeta` com títulos/culturas hardcoded como fallback visual.
- Alguns ecrãs continuam a buscar composição por `patec_number`; isso funciona por compatibilidade, mas para fonte única deve preferir `patec_code` quando existir.
- `FornecedorAuth.tsx` tem `[1,2,3]`, mas é apenas indicador de passos do formulário, não PATEC.

## Plano de correcção

### 1. Garantir que o catálogo é a fonte real e actualizada
- Criar/aplicar uma migração de dados para normalizar os nomes no catálogo `patecs`:
  - `name` e `cultures` alinhados com o padrão actual do catálogo.
  - Manter `legacy_number` apenas para retro-compatibilidade.
- Validar que existem exactamente os 15 pacotes activos esperados e que `PATEC-01..PATEC-15` estão consistentes.

### 2. Remover fallback visual hardcoded que parece “fonte de verdade”
- Alterar `src/pages/Patec.tsx` para que `patecMeta` seja usado só para ícone/cor/visual.
- Remover `title` e `cultures` hardcoded de `patecMeta`, ou impedir que sejam usados para nomes exibidos.
- Todo texto de nome/título deve vir de `patecs.code`, `patecs.cultures` e `patecs.name`.

### 3. Preferir `patec_code` para composição
- Actualizar os ecrãs que ainda carregam composição por `patec_number` para usar:
  - `patec_code` quando disponível.
  - fallback por `patec_number` apenas para registos legados.
- Abrange principalmente:
  - Perfil do produtor
  - Ficha do produtor
  - POS/MOSAP3Pay
  - Portal fornecedor/importação de produtos PATEC

### 4. Corrigir cache PWA que pode manter dados antigos
- Ajustar `vite.config.ts` para não cachear chamadas REST do backend (`/rest/v1`) que alimentam PATEC, POS, perfis e relatórios.
- Adicionar configuração PWA segura:
  - `injectRegister: null`
  - `devOptions.enabled: false`
  - navegação `NetworkFirst`
- Se houver service worker antigo já instalado, publicar um pequeno “limpador” no mesmo caminho (`/sw.js`) por um ciclo para limpar caches Workbox antigas e forçar os navegadores a buscar a versão nova.

### 5. Revalidar depois das alterações
- Repetir a auditoria com `rg` para confirmar que não restam labels PATEC 1/2/3 hardcoded usados em UI real.
- Consultar a base de dados para confirmar os 15 PATECs e contagens de composição.
- Confirmar que páginas críticas usam o catálogo:
  - `/patec`
  - perfil/ficha do produtor
  - POS, vendas, facturas, PDF
  - portal do fornecedor
  - relatórios/exportações quando aplicável

## Resultado esperado

Depois de aprovado e implementado:
- O que aparece em `/patec` será a fonte única real.
- Os outros ecrãs deixarão de depender de nomes antigos ou fallbacks locais.
- Publicar/actualizar deixará de ficar preso a respostas antigas por cache PWA/API.