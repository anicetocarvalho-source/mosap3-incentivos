
## Objetivo

Reforçar o fluxo do POS (`/mosap3pay/pos`) em dois pontos:

1. **Parcela visível e editável no momento da confirmação da compra.**
2. **Verificação OTP do agricultor antes** de disparar o Push USSD da carteira Unitel Money.

---

## 1. Parcela no diálogo "Confirmar Venda"

Hoje a parcela só aparece como badge no painel do agricultor (linha 1631 de `Mosap3PayPOS.tsx`). No diálogo final `Confirmar Venda` (linha 1881) ela não consta.

Mudanças (apenas UI em `Mosap3PayPOS.tsx`):

- No bloco de dados do agricultor dentro do `Dialog open={confirmOpen}`, acrescentar uma linha com:
  - 🌾 **Parcela:** label seleccionado (ex.: "1 hectare")
  - Botão "Alterar" que fecha o diálogo de confirmação e reabre `parcelDialogOpen`, mantendo o carrinho. Ao gravar a nova parcela o sistema já recalcula quantidades (lógica `prefillCartFromPatec` existente).
- Se `parcelSize` for `null` (caso bordo), mostrar aviso e desactivar "Confirmar e Pagar" até ser definida.
- Mesmo bloco replicado no diálogo equivalente do **Modo Kiosk** (linha 1424).

Sem alterações de schema nem de lógica de negócio — a parcela já é gravada em `pos_sales.parcel_size` (linha 875).

---

## 2. Fluxo OTP antes do pagamento Unitel Money

### Fluxo desejado

```text
Carrinho pronto
   │
   ▼
[Confirmar e Pagar]  ← diálogo existente
   │
   ▼
Sistema gera OTP de 6 dígitos, grava em BD, envia SMS ao telefone do agricultor
   │
   ▼
Novo diálogo "Verificação do Agricultor"
   - mostra: telefone mascarado, contador de expiração (5 min), botão Reenviar (após 30s)
   - input de 6 dígitos que o fornecedor digita com o código que o agricultor leu
   - botão "Validar e Pagar"
   │
   ▼ (OTP válido)
Cria pos_sale  +  invoca edge function unitel-money-payment (action=pay)
   │
   ▼
Unitel dispara Push USSD ao telemóvel do agricultor (PIN Unitel Money)
   │
   ▼
Polling de estado (já existe) → Pago / Falhou / Timeout
```

### Backend (migração)

Tabela nova `pos_payment_otps`:

| coluna | tipo | notas |
|---|---|---|
| id | uuid PK | |
| supplier_id | uuid | quem iniciou |
| farmer_code | text | |
| phone | text | snapshot |
| code_hash | text | SHA-256 do OTP (nunca em claro) |
| amount | numeric | total esperado |
| attempts | int | máx. 5 |
| status | text | `pendente` · `usado` · `expirado` · `falhado` |
| expires_at | timestamptz | now() + 5 min |
| created_at / used_at | timestamptz | |

RLS:
- Fornecedor só vê / insere registos onde `supplier_id` corresponde ao seu `suppliers.user_id`.
- Backoffice/admin: leitura total.
- Sem UPDATE/DELETE pelo cliente — toda a validação passa por edge functions com service role.

Índice `(farmer_code, status, expires_at)` para procura rápida.

### Edge functions

- **`pos-otp-send`** — recebe `{ supplier_id, farmer_code, phone, amount }`, gera OTP, grava hash, envia SMS via Unitel SMS Gateway, devolve `{ otp_id, expires_at }`.
- **`pos-otp-verify`** — recebe `{ otp_id, code }`, valida hash, expiração e tentativas, marca `usado`, devolve `{ success: true }` ou erro estruturado (`expired`, `invalid`, `locked`).

Ambas com `verify_jwt` (sessão do fornecedor) e validação Zod do input.

### Frontend (`Mosap3PayPOS.tsx`)

- Substituir o handler actual do botão "Confirmar e Pagar":
  1. Chama `pos-otp-send` → fecha `confirmOpen`, abre novo `otpDialogOpen`.
  2. Diálogo OTP: input de 6 dígitos, contador de expiração, "Reenviar SMS" (rate-limited).
  3. Ao "Validar e Pagar" → chama `pos-otp-verify`; se OK chama o `processSale` existente (que cria a venda e invoca `unitel-money-payment`).
- Estado novo: `otpDialogOpen`, `otpId`, `otpExpiresAt`, `otpCode`, `otpAttempts`, `sendingOtp`, `verifyingOtp`.
- Mensagens claras em PT-AO.
- Se agricultor sem `phone` → bloquear, com aviso "Agricultor sem telefone — pagamento por OTP indisponível".

### Notas operacionais

- A configuração Unitel Money continua opcional: se não estiver activa, o passo Push USSD faz fallback (já tratado pela edge function `unitel-money-payment`, devolve 200 com `fallback: true`).
- Auditoria: registar `audit_logs` com `action='otp_sent'` e `action='otp_verified'`.

---

## Pergunta antes de implementar

O envio do SMS do OTP requer um gateway. O sistema **já tem credenciais Unitel** (BuyGoods). Confirmas que devo usar o **mesmo endpoint Unitel para o envio de SMS** (será preciso adicionar o secret de SMS se for diferente), ou preferes que eu **simule o envio** numa primeira fase (OTP gravado em BD e mostrado em toast para o fornecedor — útil para testes) e a integração SMS fique para uma fase 2?
