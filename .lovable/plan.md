## Plano

1. **Corrigir o cooldown do “Reenviar SMS”**
   - Ajustar o contador para chegar a `0` (actualmente fica preso em `1`), para o botão voltar a ficar clicável.
   - Unificar as condições dos botões para evitar estados contraditórios (`> 0` vs `> 1`).

2. **Isolar o reenvio como reinício real do OTP**
   - Criar um helper de reset local do OTP que limpe código digitado, expiração, tentativas, `dev_code`, replay idempotente e locks do OTP anterior.
   - Fazer o “Reenviar SMS” gerar sempre um novo `otp_id` e substituir o estado local pelo novo OTP.

3. **Evitar bloqueio permanente após erro de validação**
   - Rever o lock `pos_otp_processing_*`: hoje ele pode ficar activo após código errado/expirado e impedir nova validação.
   - Garantir que o lock é limpo no fim da tentativa de validação quando a resposta não deixa um pagamento em processamento.

4. **Reiniciar validação automaticamente quando fizer sentido**
   - Após reenvio bem-sucedido, manter o diálogo aberto, limpar o input e focar novamente o campo do código.
   - Preservar agricultor, carrinho e total para continuar o pagamento sem reabrir o fluxo completo.

5. **Validar o resultado**
   - Executar uma verificação focada do fluxo: enviar OTP → tentar código inválido → reenviar → confirmar que o novo OTP aceita digitação/validação e que o botão não fica bloqueado.