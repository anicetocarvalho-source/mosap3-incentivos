# Redesign do Cartão de Identificação do Agricultor

Substituir o visual atual (cartão verde com gradiente) pelo novo design oficial fornecido nas imagens, mantendo o logotipo **MOSAP3** no canto superior direito (em vez de SIGAFLO).

Ficheiro único afetado: `src/components/cartao/FarmerIdCard.tsx`.

## Frente

Layout claro (fundo branco) em formato CR80 (proporção ~85.6 × 54 mm):

- **Cabeçalho**
  - Esquerda: insígnia da República de Angola + texto "REPÚBLICA DE ANGOLA / Ministério da Agricultura e Florestas" (uppercase, tracking largo, cinza).
  - Direita: logotipo horizontal **MOSAP3** + subtítulo "SISTEMA INTEGRADO DE GESTÃO AGRO FLORESTAL" em verde-escuro.
- **Faixa verde** com texto branco centrado: "CARTÃO DE IDENTIFICAÇÃO DO AGRICULTOR".
- **Corpo (3 colunas)**
  - Foto do agricultor num quadrado verde-claro arredondado; fallback com iniciais grandes em verde.
  - Bloco central com pares label/valor: `NOME COMPLETO`, `ID SIGAFLO` (= `farmer.code`, mono), `BI / NIF`, `TIPO DE PRODUTOR`.
  - Bloco direito: `PROVÍNCIA` e `MUNICÍPIO` (bullet verde antes do valor) + QR code com legenda "VERIFIQUE A AUTENTICIDADE DESTE CARTÃO".
- **Rodapé curvo verde** com onda SVG e quatro pilares com bullet dourado: `PRODUZIR · PRESERVAR · DESENVOLVER · INCLUIR`.
- StatusBadge ("Aprovado/Pendente/...") mantido, reposicionado discretamente sobre o cabeçalho.

## Verso

- **Painel esquerdo verde-escuro (~40%)** com texto branco:
  - `DATA DE EMISSÃO` (data atual)
  - `DATA DE VALIDADE` (emissão + 5 anos)
  - `ESTADO DO REGISTO` (derivado de `farmer.status` → "ATIVO"/"INATIVO"/"PENDENTE")
  - Assinatura "Autoridade" em itálico script + label "AUTORIDADE EMISSORA".
- **Área direita branca**:
  - `CÓDIGO DE BARRAS` no topo (Code128 do `farmer.code`) com o código por baixo em mono.
  - Caixa verde-claro: "LINHA DE APOIO SIGAFLO" (label fica, é o nome da linha) com ícone telefone, número, email e site (valores das `system_settings` se já existirem; senão constantes razoáveis).
  - Linha legal em baixo: "Este cartão é pessoal e intransmissível. O uso indevido implica sanções nos termos da lei."
- BI e telefone do agricultor podem aparecer discretamente acima do disclaimer (manter info atual sem perder dados).

## Detalhes técnicos

- Continuar a usar `forwardRef`, props (`farmer`, `cardToken`, `side`, `scale`) e `innerScale` para impressão/lote — nenhuma alteração na API exportada, portanto `CartaoIdLote`, `FarmerCardTab`, `useFarmerCard` continuam a funcionar sem mudanças.
- Manter constantes `CARD_W = 340` / `CARD_H = 214` (ajustar +6px de altura se necessário para acomodar rodapé curvo, validando que não quebra a grelha de impressão em `CartaoIdLote`).
- Cores via tokens semânticos HSL (`--primary`, `--success`, `--warning`, novo `--gold` se necessário em `index.css`/`tailwind.config.ts`) — sem cores hardcoded fora dos tokens existentes.
- Onda do rodapé como `<svg>` inline (path simples) preenchido em duas tonalidades de verde.
- Datas formatadas com `toLocaleDateString("pt-AO")`; validade = `now + 5 anos`.
- Inicial do nome: `farmer.full_name.trim().split(/\s+/).map(w=>w[0]).slice(0,2).join('').toUpperCase()`.
- `verifyUrl` e geração de QR/Barcode permanecem idênticos.
- Sem alterações em backend, hooks ou rotas.

## Fora de scope

- Página de verificação pública.
- Estrutura de dados / migrações.
- Outros componentes que consomem `FarmerCardData`.
