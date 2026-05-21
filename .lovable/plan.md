## Problema

Em modo dev, depois de receber o `dev_code` e inseri-lo, o diálogo responde sempre "Introduza o código de 6 dígitos." sem chegar a chamar `pos-otp-verify`.

## Causa

`src/pages/Mosap3PayPOS.tsx`, linha 1248, a condição de guarda tem a regex **invertida**:

```ts
if (!otpId || /^\d{6}$/.test(otpCode)) {
  toast.error("Introduza o código de 6 dígitos.");
  return;
}
```

O ramo dispara exactamente quando o código É válido (6 dígitos), abortando o submit antes da chamada à edge function.

## Correcção

Inverter o teste para rejeitar apenas códigos que **não** sejam 6 dígitos:

```ts
if (!otpId || !/^\d{6}$/.test(otpCode)) {
  toast.error("Introduza o código de 6 dígitos.");
  return;
}
```

Apenas 1 ficheiro alterado, 1 caractere (`!`) adicionado. Backend e lógica de idempotência permanecem inalterados.

## Verificação

- Em modo dev: enviar OTP, copiar `dev_code` do toast, introduzir no diálogo → deve validar e prosseguir para `processSale()`.
- Código inválido (ex. 5 dígitos, letras) → continua a mostrar a mensagem de erro.
