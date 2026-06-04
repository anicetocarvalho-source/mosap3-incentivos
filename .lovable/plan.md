## Objectivo

Executar um teste completo do fluxo de venda no **Modo Kiosk** (`/mosap3pay/pos`) usando o browser automation, validando cada etapa visualmente e confirmando que a venda chega ao fim sem erros.

## Etapas do teste

1. **Navegação e entrada no Kiosk**
   - Abrir `/mosap3pay/pos` na preview (viewport desktop 1340×860).
   - Confirmar que carrega a UI do Terminal POS (login já ativo na sessão).
   - Ativar o **Modo Kiosk** (botão dedicado) e validar tema escuro + fullscreen UI.

2. **Selecção / troca de fornecedor**
   - Verificar que aparece o selector inicial de fornecedor.
   - Escolher um fornecedor com stock.
   - Trocar de fornecedor (botão "Trocar fornecedor") e voltar a escolher um — confirmar que o estado da venda reinicia corretamente.

3. **Identificação do produtor**
   - Pesquisar um produtor **com PATEC válido** (por código ou nome).
   - Validar nas sugestões:
     - Badge dourado com nome curto do PATEC.
     - Código PATEC e data "Válido até".
   - Selecionar o produtor e confirmar o cartão com saldo, PATEC, código e validade.
   - Repetir rapidamente com um produtor **sem PATEC** para confirmar badge vermelho "Sem PATEC" (sem prosseguir a venda).

4. **Adicionar produtos ao carrinho**
   - Adicionar 1–2 produtos do catálogo do fornecedor (idealmente itens PATEC).
   - Confirmar atualização do subtotal/IVA/total e do saldo disponível.

5. **Resumo da compra**
   - Avançar para o ecrã de resumo.
   - Confirmar visualmente que aparecem: produtor, código produtor, PATEC, **Código PATEC** e **Válido até**.

6. **Processamento do pagamento**
   - Escolher método (Unitel Money / OTP conforme disponível em sandbox).
   - Disparar o fluxo de pagamento. Se for necessário OTP real para produção, parar antes da submissão final e reportar — **não submeter** pagamentos reais sem confirmação do utilizador.
   - Se for fluxo simulado/sandbox, completar e confirmar o ecrã de sucesso.

7. **Recibo / Factura**
   - Abrir o recibo gerado e verificar:
     - Número da factura.
     - Linha "PATEC N — CÓDIGO".
     - Linha "Válido até: dd/mm/aaaa".
     - QR code e hash presentes.

8. **Sair do Kiosk**
   - Fechar Kiosk e confirmar retorno ao Terminal POS padrão sem erros.

## Verificações transversais

- **Console**: sem novos `error` durante todo o fluxo (warnings de React Router são esperados).
- **Network**: chamadas a `pos_sales`, `farmer_incentives`, `unitel-money-payment` devolvem 2xx; capturar IDs e validar payloads chave (farmer_id, supplier_id, total).
- **Screenshots**: capturar no mínimo: Kiosk inicial, selector fornecedor, sugestão com PATEC, cartão produtor, carrinho, resumo, recibo final.

## Critérios de aceitação

- Todos os 8 passos concluídos sem reload manual nem erros bloqueantes.
- PATEC (número, código, validade) visível e correto no cartão, no resumo **e** no recibo.
- Saldo do produtor atualiza após a venda (consultar via `supabase--read_query` em `farmers`/`pos_sales` pelo código).
- Relatório final ao utilizador com: passos OK, problemas encontrados (se houver), screenshots e IDs de venda criados.

## Notas

- Se a sandbox não tiver fornecedor com PATEC + produtor com saldo suficiente, parar e pedir indicação de quais usar antes de continuar.
- Não confirmar pagamentos via Unitel Money em produção sem aprovação explícita; se necessário, parar no ecrã de confirmação.
- Nenhuma alteração de código está prevista. Se forem detetados bugs, parar o teste e reportar antes de propor correções.
