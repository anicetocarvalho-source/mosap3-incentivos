## Resumo

Adicionar um toast de erro visível quando o carregamento dos dados de `farmers` falhar na página `/provincias`, tanto na carga inicial quanto ao clicar no botão "Actualizar contagens".

## Alterações

**Ficheiro:** `src/pages/GestaoProvincias.tsx`

1. **Toast de erro sempre visível**: no bloco `catch` de `refreshFarmerCounts`, o toast de erro deve ser exibido **sempre** que houver falha, independentemente do parâmetro `notify`. Atualmente só aparece quando `notify === true` (i.e., ao clicar no botão).
2. **Mensagem descritiva**: incluir detalhe do erro na descrição do toast (ex.: "Falha ao consultar produtores: [mensagem do erro]").
3. **Não bloquear UI**: manter o comportamento existente que atribui `[]` a `farmerRows` em caso de erro, para que a página não fique em loading infinito.

## Critérios de aceitação

- Se a carga inicial de `farmers` falhar, o utilizador vê um toast de erro.
- Se o utilizador clicar "Actualizar contagens" e falhar, o toast de erro continua a aparecer.
- A UI não fica presa no estado de carregamento quando ocorre erro.