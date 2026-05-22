# Correções Operacionais — Produtores · Parcelas · POS · Vendas

## 1. Produtores

### 1.1 PATECs e Escolas de Campo limitados a 3 opções
**Causa**: `src/components/FarmerRegistrationForm.tsx` (linhas 360–362 e 373–375) tem PATEC 1/2/3 e EC Caimbambo/Longonjo/Cuemba **hardcoded**. A base já contém 10 PATECs (memória `patec-composicao`) e a tabela de escolas é dinâmica.

**Ação**:
- Carregar PATECs via hook `usePatecs()` (já existe) — filtrar `is_active=true`, ordenar por `sort_order`.
- Carregar Escolas de Campo via consulta a `schools` filtrada pela `provincia` (e, se preenchida, `municipio`) do formulário; cair para todas se o utilizador ainda não escolheu província.
- Guardar `patec_code` (texto) em vez do número legado, mantendo compatibilidade com `farmers.patec` (int) como fallback.

### 1.2 Não é possível registar a produção no perfil do produtor
**Investigação adicional necessária** em `src/pages/FichaProdutor.tsx` / `FarmerProfile.tsx`: identificar se o botão "Nova Produção" está presente, se o diálogo abre e se o `insert` em `farmer_production` falha (provável vínculo a `farmer_parcels` ou validação obrigatória de fase). Corrigir handler e validar com RLS `Backoffice can insert production`.

## 2. Parcelas

### 2.1 Mapa sobrepõe a modal "Nova Parcela"
**Causa**: o container Leaflet usa `z-index: 400–700` (panes/controles), enquanto o `DialogOverlay` shadcn usa `z-50`. Quando o diálogo abre, o mapa fica visualmente por cima.

**Ação**:
- Forçar os panes do Leaflet a `z-index ≤ 30` via CSS global em `src/index.css` (`.leaflet-pane, .leaflet-top, .leaflet-bottom { z-index: 30 !important; }`) **ou** subir o `Dialog` shadcn para `z-[60]`. Optar pela primeira (menos invasiva).

### 2.2 Permitir múltiplas culturas por parcela
**Schema**: `farmer_parcels.culture` é `text` simples.

**Ação**:
- Migração: adicionar coluna `cultures text[] NOT NULL DEFAULT '{}'` e copiar valores existentes (`UPDATE … SET cultures = ARRAY[culture]`). Manter `culture` (singular) para compatibilidade até refactor completo, preenchendo com `cultures[0]`.
- Form em `Parcelas.tsx` e `ParcelRegistrationForm.tsx`: substituir `Select` único por **multi-select** (checkbox list dentro de Popover) ou tags clicáveis. Persistir array.
- Listagens/mapa: mostrar todas as culturas (badges) em vez de uma só.

### 2.3 Simplificar entrada de coordenadas
**Ação** (no diálogo de Nova Parcela):
- Botão **"Usar a minha localização"** → `navigator.geolocation.getCurrentPosition` preenche lat/lon automaticamente.
- Botão **"Escolher no mapa"** → fecha o diálogo, ativa modo "picker" no `ParcelasMap` (cursor em cruz, clique coloca marcador, devolve lat/lon ao reabrir o form).
- Manter inputs manuais (lat/lon) como opção avançada, num bloco recolhível "Inserir manualmente".

## 3. POS

### 3.1 Kiosk mostra ecrã preto no terminal Kwanza
**Causa**: `toggleFullscreen` (linha 450) chama `document.documentElement.requestFullscreen()`. No WebView do terminal Kwanza, a API de Fullscreen não está implementada — a chamada falha silenciosamente (já protegida por `try/catch`), mas o overlay kiosk fica renderizado em `fixed inset-0 z-50` (linha 1556) por cima de uma página que perdeu interactividade (browser do terminal não aplica o estilo `:fullscreen` esperado e a navbar do Kwanza esconde o conteúdo).

**Ação**:
- Detectar suporte: `document.fullscreenEnabled === false` → não chamar `requestFullscreen`, apenas ativar `kioskMode` como overlay puro.
- Garantir que o overlay kiosk usa `bg-background` opaco com `min-h-[100dvh] w-screen`, força `position: fixed; top:0; left:0; right:0; bottom:0; z-index: 9999` para sobrepor qualquer chrome do Kwanza.
- Adicionar botão "Sair do modo Kiosk" visível mesmo quando o fullscreen API falha.

### 3.2 Erro nos hectares ao seleccionar produtor
**Investigação adicional necessária** durante implementação: reproduzir no preview, capturar console/network. Hipóteses prováveis:
- Diálogo `parcelDialogOpen` (linha 2138) abre antes do `farmer` carregar completamente → `PARCEL_OPTIONS` retorna `undefined`.
- Falta de `parcelSize` persistido entre selecções (limpar `setParcelSize(null)` ao mudar de produtor).

Implementar reset explícito de `parcelSize` no `setFarmer` e validação defensiva antes de abrir o diálogo.

## 4. Vendas

### 4.1 Mostrar ID de transação Unitel Money em vendas pagas
**Schema**: `pos_sales.unitel_transaction_id` (texto) já é gravado pela função `unitel-money-payment` (linha 265).

**Ação** em `src/pages/Mosap3PayVendas.tsx`:
- Incluir `unitel_transaction_id` no `select` da listagem.
- Na tabela desktop, acrescentar coluna **"ID Transação"** (visível apenas quando `payment_method = 'unitel_money'` e `payment_status = 'pago'`), com cópia rápida (botão `Copy`).
- No diálogo de detalhe (`selectedSale`), mostrar bloco "Referência Unitel Money" com `unitel_transaction_id` e `payment_reference` quando aplicável.
- Replicar no cartão mobile (badge pequeno com `TX: …`).

## Detalhes técnicos / Ordem de execução

```text
1) Migração SQL (parcelas multi-cultura)
2) Form Produtores (PATECs + Escolas dinâmicas)
3) Form Parcelas (multi-cultura + coords UX)
4) CSS leaflet z-index
5) POS Kiosk fallback sem fullscreen
6) POS: reset parcelSize ao trocar farmer (após reproduzir o bug)
7) Vendas: coluna + detalhe com Unitel TX ID
8) Diagnose + fix do registo de produção no perfil produtor
```

Sem impacto noutros módulos. Sem novos secrets necessários.
