# Ajustes ao Cartão de ID do Agricultor

Alterações apenas visuais/dados, sem mexer em lógica de negócio.

## 1. Frente do cartão — Cabeçalho MOSAP3

Atualmente o canto superior direito mostra logotipo MOSAP3 + texto "MOSAP3" + subtítulo "SISTEMA INTEGRADO DE GESTÃO AGRO FLORESTAL". É redundante.

- Remover o bloco de texto ("MOSAP3" + subtítulo).
- Manter apenas o logotipo, aumentado ligeiramente para ocupar o espaço vazio.
- Empurrar o logotipo para a direita (alinhamento `justify-end`), ficando onde estava o texto.

## 2. Frente do cartão — Substituir "Tipo de Produtor" por ECA

No bloco central, o último campo é "TIPO DE PRODUTOR". Passará a mostrar:

- Etiqueta: `ESCOLA DE CAMPO`
- Valor: `farmer.school` (já disponível em `FarmerCardData`)
- Fallback: `—` quando vazio.

O campo `tipo_produtor` deixa de ser usado no cartão (mantém-se no tipo `FarmerCardData` por compatibilidade, sem leitura).

## 3. Verso do cartão — Painel esquerdo verde

Atualmente mostra: Data de Emissão, Data de Validade, Estado de Registo.

- Remover o bloco "ESTADO DO REGISTO".
- Adicionar no seu lugar um bloco **REGISTADO POR** com:
  - Nome do extensionista (`profiles.full_name`)
  - Telefone do extensionista (`profiles.phone`) por baixo, em fonte menor
  - Fallback: `—` quando o agricultor não tem `registered_by` ou o perfil não foi encontrado.

## 4. Obter dados do extensionista

O `farmers.registered_by` é um `uuid` que aponta para `auth.users`. O nome e telefone vivem em `profiles` (via `profiles.user_id`).

- Estender o tipo `FarmerCardData` com `registered_by_name?: string | null` e `registered_by_phone?: string | null`.
- No hook `useFarmerCard` (e em qualquer outro consumidor — `CartaoIdLote`, `FarmerCardTab`), fazer uma consulta extra (ou join) que devolva o nome+telefone do perfil cujo `user_id = farmers.registered_by`. Caching simples em memória por uuid para evitar N+1 quando se geram cartões em lote.
- Passar os campos para `FarmerIdCard`.

## Detalhes técnicos

**Ficheiros a editar:**
- `src/components/cartao/FarmerIdCard.tsx` — alterações 1, 2, 3 (apresentação).
- `src/components/cartao/FarmerCardTab.tsx` — preencher `registered_by_name`/`phone` a partir do `farmerInfo` (se já vier) ou via fetch.
- `src/pages/CartaoIdLote.tsx` — idem, com batch fetch por lista de uuids únicos.
- `src/hooks/useFarmerCard.ts` (ou onde se monta `farmerInfo`) — incluir `registered_by` + lookup em `profiles`.

**Consulta tipo:**
```sql
select user_id, full_name, phone
from profiles
where user_id in (<uuids únicos dos registered_by>)
```

**Sem migrações de base de dados.** Nenhuma alteração de RLS, nenhum novo campo na BD.

**QA visual:** após edição, validar com screenshot do `/agricultores/AGR-XXX` (separador Cartão ID) que:
- Cabeçalho direito mostra só o logotipo MOSAP3 (mais à direita).
- Campo ECA aparece em vez de Tipo de Produtor.
- Verso mostra "Registado por: Nome / Telefone" e já não mostra "Estado de Registo".
