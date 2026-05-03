
# Cartão ID do Agricultor

## Resumo

Módulo completo para gerar cartões de identificação digitais (frente e verso) no formato CR80 (85.6×54mm), com QR Code dinâmico, código de barras SIGAF, exportação PDF print-ready e PNG preview, gestão de estados e operações em lote.

---

## 1. Base de Dados

### Tabela `farmer_cards`
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid PK | — |
| farmer_code | text NOT NULL | Código do agricultor |
| card_token | text UNIQUE NOT NULL | Token seguro para QR (uuid v4) |
| status | text | Rascunho / Gerado / Impresso / Entregue / Revogado |
| generated_at | timestamptz | Data de geração |
| generated_by | uuid | Utilizador que gerou |
| printed_at | timestamptz | — |
| delivered_at | timestamptz | — |
| revoked_at | timestamptz | — |
| revoked_reason | text | — |
| created_at / updated_at | timestamptz | — |

RLS: Backoffice pode ler/inserir/actualizar; Admin pode revogar/eliminar.

### Tabela `farmer_card_logs`
| Campo | Tipo |
|-------|------|
| id | uuid PK |
| farmer_code | text |
| action | text (gerado, impresso, entregue, revogado, regenerado) |
| performed_by | uuid |
| details | jsonb |
| created_at | timestamptz |

---

## 2. Página de Verificação Pública

**Rota:** `/verificacao/:token`

Página pública (fora do ProtectedRoute) que consulta `farmer_cards` pelo token e mostra:
- Nome, Estado (Activo/Inactivo), Elegibilidade (crédito/incentivo), Última actualização
- Sem dados sensíveis expostos

---

## 3. Componente de Renderização do Cartão

**Ficheiro:** `src/components/cartao/FarmerIdCard.tsx`

Renderiza frente e verso do cartão em HTML/CSS com dimensões CR80 (escala para ecrã e impressão):

**Frente:**
- Logo MOSAP3 + título
- Foto frontal do agricultor (signed URL)
- Nome completo, ID SIGAF
- Província / Município
- Tipo de produtor, Cultura principal
- QR Code (aponta para `/verificacao/{token}`)

**Verso:**
- Código de barras (ID SIGAF) — usar biblioteca `react-barcode` ou SVG inline
- Área produtiva, Score produtivo
- Elegibilidade (crédito / incentivo)
- Data de emissão, Validade
- Texto legal

---

## 4. Exportação PDF e PNG

**Abordagem:** Usar `html2canvas` para capturar o cartão renderizado + `jsPDF` para criar PDF a 300 DPI.

- **Download individual:** Botão no perfil do agricultor
- **Preview PNG:** Gerado via `html2canvas`
- **PDF print-ready:** Página A4 com cartão centralizado, margens de corte

---

## 5. Geração em Lote

**Ficheiro:** `src/pages/CartaoIdLote.tsx`

- Listagem de agricultores com checkbox de seleção
- Filtros por província, estado, PATEC
- Botão "Gerar Cartões" → para cada agricultor selecionado:
  1. Cria/actualiza registo em `farmer_cards` com token único
  2. Gera PDF com múltiplos cartões (4 por página A4)
- Download único do PDF agrupado
- Inserção em blocos de 50 (respeitar limite Supabase)

---

## 6. Dashboard de Cartões

**Ficheiro:** `src/pages/CartoesId.tsx`

KPIs:
- Nº cartões gerados / activos / revogados
- Taxa de emissão por província (gráfico de barras)

Listagem com filtros:
- Pesquisa por nome/código
- Filtro por estado, província
- Acções: Ver cartão, Imprimir, Alterar estado, Revogar

---

## 7. Integração no Perfil do Agricultor

No `FarmerProfile.tsx`, adicionar:
- Tab ou secção "Cartão ID"
- Preview do cartão (frente/verso)
- Botões: Gerar / Regenerar / Download PDF / Alterar estado
- Histórico de acções do cartão

---

## 8. Navegação

- Entrada no menu lateral: "Cartões ID" (ícone CreditCard)
- Rotas: `/cartoes-id` (dashboard), `/cartoes-id/lote` (geração em lote), `/verificacao/:token` (pública)

---

## 9. Dependências a Instalar

- `jspdf` — geração PDF
- `html2canvas` — captura HTML para canvas
- `react-barcode` — código de barras SVG

(`qrcode.react` já está instalado)

---

## 10. Segurança

- Token do QR é UUID v4, único e não sequencial
- Regeneração cria novo token e revoga o anterior
- Logs de todas as acções em `farmer_card_logs`
- Página de verificação não expõe dados financeiros

---

## Ordem de Implementação

1. Migração DB (`farmer_cards` + `farmer_card_logs` + RLS)
2. Instalar dependências (`jspdf`, `html2canvas`, `react-barcode`)
3. Componente `FarmerIdCard` (frente/verso)
4. Página de verificação pública `/verificacao/:token`
5. Hooks e lógica de geração/exportação PDF/PNG
6. Dashboard `/cartoes-id`
7. Geração em lote `/cartoes-id/lote`
8. Integração no perfil do agricultor
9. Navegação e rotas

---

## Detalhes Técnicos

- O cartão é renderizado em HTML a 300 DPI equivalente (escala 3x do tamanho CR80)
- O PDF usa formato A4 com área de corte para impressão profissional
- QR aponta para URL relativa do domínio publicado
- Código de barras usa formato CODE128 para o ID SIGAF
- Estados geridos com timestamps independentes para rastreabilidade completa
