## Problema

No Terminal POS (`/mosap3pay/pos`) a pesquisa de agricultor não devolve todos os registos:
1. A consulta tem `.limit(8)` — quando há mais de 8 correspondências, os restantes nunca aparecem.
2. A pesquisa por telefone faz `phone.ilike.%q%` literal — se o utilizador digitar `923xxxxxx` mas a BD guarda `244923xxxxxx` (formato PT-AO), não há match.

## Alterações (apenas em `src/pages/Mosap3PayPOS.tsx`, bloco linhas 202-216)

### 1. Aumentar limite e melhorar UX da lista
- Subir `.limit(8)` para `.limit(50)`.
- Manter o dropdown com `max-height` + scroll (já existente) para mostrar todos sem inundar o ecrã.
- Adicionar contador discreto no rodapé do dropdown: "A mostrar X resultados — refine a pesquisa para ver mais" quando `length === 50`.

### 2. Normalizar pesquisa por telefone
Construir uma variante normalizada do termo de pesquisa antes de montar o `.or()`:

```text
qDigits   = q.replace(/\D/g, '')
qPhoneAlt = qDigits sem prefixo 244 (se começar) ou com 244 prepended (se 9 dígitos a começar por 9)
```

Ramos do `.or()` ficam:
- `full_name.ilike.%q%`
- `code.ilike.%q%`
- `bi.ilike.%q%`
- `phone.ilike.%qDigits%` (se `qDigits.length >= 3`)
- `phone.ilike.%qPhoneAlt%` (se diferente de `qDigits`)

Isto garante que digitar `923456789`, `244923456789` ou `+244 923 456 789` encontra o mesmo agricultor.

### 3. (Opcional, mesmo bloco) Reduzir mínimo para 1 carácter quando o termo for puramente numérico (códigos curtos), mantendo 2 caracteres para texto.

## Fora de âmbito
- Não mexer em RLS, edge functions, esquema da BD, layout do POS ou qualquer outro ficheiro.
- Não alterar a pesquisa global (`/`) nem outros ecrãs com pesquisa de agricultor.

## Validação
Após implementar:
- Testar pesquisa por nome comum (ex.: "Maria") — deve listar até 50 com indicador "refine para ver mais".
- Testar telefone em 3 formatos (`923…`, `244923…`, `+244 923…`) — todos devem encontrar o mesmo registo.
- Confirmar que clicar numa sugestão continua a carregar saldo, PATEC e produtos como antes.
