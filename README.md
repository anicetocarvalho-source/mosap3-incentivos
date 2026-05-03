# MOSAP3 — Sistema de Gestão Agrícola

> Plataforma PWA offline-first para gestão de produtores, incentivos, parcelas e ponto de venda (MOSAP3Pay) do Projecto MOSAP3 em Angola.

## Stack Tecnológico

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18, Vite 5, TypeScript 5, Tailwind CSS 3, shadcn/ui |
| Backend | Lovable Cloud (Supabase) — Auth, Database, Edge Functions, Storage |
| PWA | vite-plugin-pwa, Workbox, IndexedDB (idb), Service Worker |
| Mapas | Leaflet (vanilla) + ArcGIS satellite tiles |

## Desenvolvimento Local

```sh
# 1. Clonar o repositório
git clone <YOUR_GIT_URL>
cd mosap3-insentivos

# 2. Instalar dependências
npm install

# 3. Iniciar servidor de desenvolvimento
npm run dev
# → http://localhost:8080
```

> **Nota:** O service worker está **desactivado** em modo de desenvolvimento (`devOptions: { enabled: false }` implícito) para evitar cache no editor Lovable.

## Estrutura do Projecto

```
public/
  pwa-*.png              # Ícones PWA (72–1024px)
  apple-splash-*.png     # Splash screens iOS/iPad
  push-sw.js             # Service worker de push notifications
  manifest.json          # Gerado pelo vite-plugin-pwa (build)
src/
  components/            # Componentes UI reutilizáveis
  hooks/                 # Custom hooks (useOfflineQuery, useOnlineStatus, useAuth…)
  lib/                   # Lógica core (offlineDb, imageCompression, formValidation…)
  pages/                 # Páginas da aplicação
  integrations/supabase/ # Cliente e tipos auto-gerados (NÃO EDITAR)
supabase/
  functions/             # Edge Functions (SAF-T, Unitel Money, VAPID…)
  config.toml            # Configuração do projecto
```

---

## Deploy em Produção

### Opção 1 — Lovable (recomendado)

1. Abrir o projecto em [Lovable](https://lovable.dev/projects/002d3433-84c2-45f4-b6be-9972899daa14)
2. Clicar **Share → Publish → Update**
3. O frontend é construído e publicado automaticamente em `mosap3-insentivos.lovable.app`
4. As Edge Functions e migrações de base de dados são aplicadas automaticamente

### Opção 2 — Self-hosting

```sh
# 1. Build de produção
npm run build
# Gera pasta dist/ com manifest.webmanifest, service worker e assets

# 2. Servir com qualquer servidor estático (Nginx, Caddy, Vercel, etc.)
# Exemplo com serve:
npx serve dist -s -l 3000
```

**Configuração do servidor (obrigatório para SPA):**
- Redirecionar todas as rotas para `index.html` (SPA fallback)
- Headers recomendados:
  ```
  Cache-Control: no-cache, must-revalidate  (para index.html)
  Cache-Control: public, max-age=31536000   (para assets com hash)
  ```

### Domínio Personalizado

Project Settings → Domains → Connect Domain  
Documentação: [Custom Domain](https://docs.lovable.dev/features/custom-domain)

---

## PWA — Checklist de Verificação

Após cada deploy em produção, verificar os seguintes pontos:

### Service Worker

- [ ] O ficheiro `sw.js` é servido na raiz (`/sw.js`) com `Content-Type: application/javascript`
- [ ] O service worker está registado (DevTools → Application → Service Workers → Status: **activated and running**)
- [ ] `skipWaiting` e `clientsClaim` estão activos (actualização automática sem refresh manual)
- [ ] A rota `/~oauth` **não** é interceptada (está em `navigateFallbackDenylist`)
- [ ] O runtime caching funciona:
  - `map-tiles` — ArcGIS tiles (CacheFirst, 30 dias)
  - `supabase-api` — REST API (NetworkFirst, timeout 5s, fallback cache)
  - `google-fonts` — Fontes (CacheFirst, 1 ano)
- [ ] Auth endpoints (`/auth/*`) usam `NetworkOnly` (nunca em cache)

### Manifest

- [ ] `manifest.webmanifest` é servido correctamente (DevTools → Application → Manifest)
- [ ] `name`: "MOSAP3 - Gestão Agrícola"
- [ ] `short_name`: "MOSAP3"
- [ ] `display`: "standalone"
- [ ] `theme_color`: "#1B5E20"
- [ ] `start_url`: "/"
- [ ] Todos os **12 ícones** presentes (72, 96, 128, 144, 152, 167, 180, 192, 256, 384, 512, 1024)
- [ ] Ícone `maskable` (512×512) declarado
- [ ] Banner "Adicionar ao ecrã inicial" aparece no Chrome Android

### Splash Screens (iOS)

- [ ] 11 splash screens Apple declaradas no `<head>` do `index.html`
- [ ] Dispositivos cobertos: iPhone SE → iPhone 15 Pro Max, iPad → iPad Pro 12.9"
- [ ] Fundo verde MOSAP3 (`#1B5E20`) com logótipo centrado
- [ ] `apple-mobile-web-app-capable` = "yes"
- [ ] `apple-mobile-web-app-status-bar-style` = "black-translucent"

### Modo Offline

- [ ] Com rede: dados carregados do servidor e cacheados em IndexedDB (TTL 30 min)
- [ ] Sem rede: dados servidos do cache IndexedDB + UI mostra banner "Modo offline"
- [ ] Registo de produtores funciona offline (SyncQueue v3)
- [ ] Ao reconectar: sincronização automática com toast de confirmação
- [ ] `OfflineFallback` exibido quando API falha em modo offline
- [ ] Contagem de registos pendentes visível no banner

### Como Testar

```sh
# 1. Build local
npm run build && npx serve dist -s

# 2. Abrir Chrome → DevTools → Application
#    - Service Workers: verificar registo e activação
#    - Manifest: verificar ícones e configuração
#    - Cache Storage: verificar caches criados

# 3. Simular offline
#    DevTools → Network → Offline (checkbox)
#    Navegar pela app — deve funcionar com dados em cache
#    Registar um produtor — deve guardar em IndexedDB

# 4. Voltar online
#    Desmarcar "Offline" → verificar sincronização automática

# 5. Lighthouse PWA audit
#    DevTools → Lighthouse → Progressive Web App → Generate report
#    Objectivo: score ≥ 90
```

---

## Testes

```sh
# Executar todos os testes
npx vitest run

# Testes específicos do modo offline
npx vitest run src/test/offline-mode.test.ts

# Testes com watch
npx vitest
```

---

## Perfis de Teste (apenas online)

| Perfil | Descrição |
|--------|-----------|
| `admin` | Acesso total ao sistema |
| `gestor_incentivos` | Gestão de incentivos e transacções |
| `senior_agricultura` | Supervisão agrícola provincial |
| `senior_monitoria` | Supervisão de monitoria |
| `junior_agricultura` | Técnico agrícola municipal |
| `junior_monitoria` | Técnico de monitoria municipal |
| `senior_agronegocio` | Supervisão de agronegócio |
| `junior_agronegocio` | Técnico de agronegócio |
| `tecnico_extensionista` | Agente de campo / ECA |

---

## Licença

Projecto interno MOSAP3 — Todos os direitos reservados.
