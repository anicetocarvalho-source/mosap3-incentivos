

## Problema

No POS do Portal do Fornecedor (`/fornecedor/pos/venda`), a pesquisa de produtores devolve sempre vazio. Causa: a RLS da tabela `farmers` só permite SELECT a quem tenha `has_any_backoffice_role(auth.uid())` (admin, sénior, junior, extensionista, etc). O utilizador fornecedor **não tem role de backoffice**, logo o PostgREST devolve 0 linhas (sem erro) e o POS mostra "Produtor não encontrado".

## Solução

Adicionar uma policy SELECT em `farmers` que permita a fornecedores autenticados (utilizador dono de uma linha em `suppliers`) consultar produtores **apenas com os campos necessários para vender**: identificação, telefone, PATEC, foto, saldo. A pesquisa no POS já só pede esses campos.

### Migração SQL
```sql
-- Permitir que fornecedores autenticados consultem produtores (necessário para POS)
CREATE POLICY "Suppliers can view farmers for POS"
ON public.farmers
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.suppliers s
    WHERE s.user_id = auth.uid()
  )
);
```

### Considerações de segurança
- Só fornecedores autenticados (com registo em `suppliers`) ganham acesso de leitura.
- Sem acesso a INSERT/UPDATE/DELETE de produtores.
- Os campos sensíveis (`bi`, `birth_date`, biometrias, fotos de perfil) continuam expostos por essa policy, igual ao que já acontece para staff. Aceitável porque o POS precisa identificar o produtor de forma fidedigna (BI/telefone/nome) e mostrar foto frontal para conferência presencial.
- Se quiseres restringir mais (ex.: ocultar BI/biometrias), posso depois criar uma view `farmers_pos_public` com colunas mínimas e mover a policy para essa view, mas isso exige refactor do POS.

### Ficheiros a editar
- Migração SQL nova (criar policy).
- Sem alterações ao código frontend.

### Resultado
Após aplicar, ao escrever "Maria" na pesquisa do POS do fornecedor, as sugestões aparecerão e a selecção do produtor passa a funcionar — incluindo carregamento de saldo, PATEC e processamento de venda.

