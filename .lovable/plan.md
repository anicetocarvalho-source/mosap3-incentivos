## Objectivo

Após a validação do OTP, antes de gravar a venda, accionar o pedido à carteira Unitel Money do agricultor (STK Push nativo) e só finalizar a venda quando o agricultor introduzir o PIN no telemóvel e o pagamento for confirmado.

## Fluxo novo

```text
OTP validado
   │
   ▼
[Passo 1] Conectar carteira Money do agricultor
   - invoke('unitel-money-payment', { action: 'pay', amount, phone, sale_code provisório })
   - Unitel devolve conversation_id e dispara STK Push no telemóvel do agricultor
   │
   ▼
[Passo 2] Dialog "A aguardar PIN da carteira Money"
   - Mostra: nome, telefone (mascarado), total, contador de tempo
   - Estado: "Pedido enviado para +244 9XX XXX XXX. Aguardando PIN…"
   - Polling action='query' a cada 5s, até 90s
   - Botões: "Cancelar" (aborta polling) | "Reenviar pedido" (após 30s)
   │
   ▼
[Passo 3a] payment_status = 'pago'
   - processSale() cria pos_sales já com payment_status='pago',
     unitel_transaction_id e payment_reference preenchidos
   - Emite factura, abre recibo
   │
[Passo 3b] payment_status = 'falhado' ou timeout
   - Toast com motivo, dialog fecha, carrinho preservado
   - NÃO cria pos_sales
```

## Alterações no código

### `src/pages/Mosap3PayPOS.tsx`

1. **Novo estado da "carteira"** (junto aos OTP states):
   - `walletDialogOpen`, `walletStatus` (`idle | connecting | awaiting_pin | confirming | paid | failed | timeout`)
   - `walletConversationId`, `walletSaleCode`, `walletSecondsLeft`, `walletAttempts`, `walletError`

2. **Novo `initiateWalletPayment()`**:
   - Gera `saleCode` provisório (mesma função usada hoje em `processSale`).
   - Chama `unitel-money-payment` com `action: 'pay'` sem `sale_id` (ver alteração na edge function).
   - Guarda `conversation_id`, abre `WalletDialog`, arranca contador 90s e `pollWalletStatus()`.

3. **Novo `pollWalletStatus()`**:
   - Polling 5s com `action: 'query'` (sem `sale_id`).
   - Em `pago` → fecha dialog, chama `processSale({ prepaid: true, conversationId, saleCode })`.
   - Em `falhado` → mostra erro, fecha dialog, mantém carrinho.
   - Timeout → toast informativo, permite reenviar.

4. **Refactor `processSale`**:
   - Aceita `{ prepaid, conversationId, saleCode }`.
   - Quando `prepaid=true`: cria `pos_sales` já com `payment_status='pago'`, `unitel_transaction_id=conversationId`, `payment_reference=conversationId`, salta o bloco actual de invocação Unitel e o polling pós-criação.
   - Mantém compatibilidade com o caminho actual (pagamento manual) caso `farmer.phone` esteja em falta.

5. **Alterar `verifyOtpAndPay`**:
   - Onde hoje chama `await processSale()`, passa a chamar `initiateWalletPayment()` (excepto quando o agricultor não tem telefone → mensagem de aviso e mantém o fluxo manual antigo).

6. **Novo `WalletDialog`** (componente JSX dentro do mesmo ficheiro, como os outros dialogs):
   - Header: ícone smartphone + "Confirmação na carteira Money"
   - Corpo: nome do agricultor, telefone mascarado (`+244 9XX XXX 123`), total formatado, contador "Aguardando PIN — 87s".
   - Estados visuais com tokens semânticos (`info`, `warning`, `destructive`, `success`).
   - Botões: `Cancelar` e `Reenviar pedido` (habilitado após 30s).

### `supabase/functions/unitel-money-payment/index.ts`

- Tornar `sale_id` opcional em `action='pay'` e `action='query'`. Quando não vier, não fazer o `UPDATE pos_sales` — devolver apenas `conversation_id` / `payment_status` para o cliente decidir.
- Sem alterações de credenciais nem novas variáveis de ambiente.

### Sem alterações de BD

- Não são necessárias migrations: o pagamento só toca em `pos_sales` quando o estado é `pago` (no caminho normal) ou nos casos legacy.
- Tabela `pos_payment_otps` continua a ser consumida no `verify` — o OTP segue como prova de consentimento independente do PIN da Money.

## Tratamento de erros

- "Pagamentos Unitel não configurados" → mantém fallback actual (toast amarelo) e oferece via dialog uma opção "Registar como pagamento manual" que executa o `processSale` actual.
- Network error no `pay`/`query` → contador continua, mostra "A repetir…", até timeout.
- Se utilizador fechar o dialog ou navegar → polling é abortado via `AbortController`/flag, carrinho preservado.

## Testes a actualizar/adicionar

- `src/test/pos-sale-flow.test.ts`: cobrir novo caminho prepaid em `processSale` (cria venda já paga, sem invocar Unitel duas vezes).
- Novo `src/lib/wallet-payment-client.ts` (helpers puros: `tickWalletCountdown`, `canResendWallet`, `interpretWalletStatus`) + teste Vitest para o polling/contador, igual ao padrão do `pos-otp-client`.

## Notas de UI/UX

- Usar tokens semânticos (`info`, `success`, `destructive`) e ícones lucide (`Smartphone`, `Loader2`, `CheckCircle2`, `XCircle`).
- Mascarar telefone: mostrar últimos 3 dígitos.
- Mensagens em PT-AO consistentes: "A aguardar PIN no telemóvel do agricultor…", "Pagamento confirmado pela carteira Money", "Agricultor não confirmou a tempo".
- Dialog não fechável por click-outside enquanto `walletStatus === 'awaiting_pin'`.
