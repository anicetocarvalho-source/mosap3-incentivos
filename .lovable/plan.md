## Diagnóstico

A lógica actual em `src/components/fornecedor/FornecedorLayout.tsx` calcula `active` item-a-item usando `path === item.to || path.startsWith(item.to + "/")`. Como vários itens do menu partilham prefixo, mais do que um item fica destacado ao mesmo tempo:

- Em `/fornecedor/pos/venda` ficam acesos **"Vender (Terminal POS)"** e **"Terminais POS"** (porque `/fornecedor/pos/venda` começa por `/fornecedor/pos`).
- Em `/fornecedor/relatorios/vendedores` qualquer futuro `/fornecedor/relatorios` teria o mesmo problema.
- Rotas legadas `/fornecedor/stock` e `/fornecedor/precos` já estão tratadas, mas via caso especial em vez de regra geral.

Por isso o utilizador vê o destaque "do mesmo jeito" — não é cache, é colisão de prefixos.

## Plano

Substituir o cálculo por item por uma estratégia de **melhor correspondência única** dentro do `nav`:

1. Antes do `map`, calcular um `activeTo` único:
   - Normalizar `path` (tirar query/hash — já vem só pathname, ok).
   - Aplicar redirects legados ao nível do path: se `path` for `/fornecedor/stock` ou `/fornecedor/precos`, tratar como `/fornecedor/catalogo`.
   - Dashboard (`/fornecedor`) só corresponde em match exacto.
   - Entre os restantes itens, escolher aquele cujo `item.to` é igual ao path **ou** é o prefixo mais longo de `path` (com fronteira `/`). Empates impossíveis porque escolhemos o `to` mais longo.
2. No `map`, `active = item.to === activeTo`. Garante exclusividade: só um item fica destacado.
3. Manter visual e estrutura existentes; sem alterações de rotas, dados ou estilo.

## Verificação

- `/fornecedor` → Dashboard.
- `/fornecedor/catalogo`, `/fornecedor/catalogo?tab=stock`, `/fornecedor/stock`, `/fornecedor/precos` → "Catálogo & Stock".
- `/fornecedor/pos` → "Terminais POS".
- `/fornecedor/pos/venda` → apenas "Vender (Terminal POS)".
- `/fornecedor/relatorios/vendedores` → "Relatório Vendedores".
- `/fornecedor/perfil`, `/fornecedor/lojas`, `/fornecedor/facturas`, `/fornecedor/turnos`, `/fornecedor/vendedores`, `/fornecedor/vendas` → o respectivo item, sozinho.

## Detalhes técnicos

Ficheiro único: `src/components/fornecedor/FornecedorLayout.tsx` (substituir o bloco de cálculo de `active` por uma função utilitária local que devolve o `to` vencedor). Sem alterações em rotas, dados, PWA ou backend.