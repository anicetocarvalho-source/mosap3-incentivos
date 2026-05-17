## Redesign do cartão de identificação

Refatorar `src/components/cartao/FarmerIdCard.tsx` para uma composição mais limpa e bem proporcionada, mantendo as dimensões CR80 (85,6 × 54 mm).

### Frente

Nova estrutura em 3 zonas verticais (header / corpo / footer) com grelha consistente:

```
┌────────────────────────────────────────────────┐
│ [Angola]  MINAGRIF                  [MOSAP3]   │ header (h≈42)
│           República de Angola                  │
├────────────────────────────────────────────────┤
│ ┌──────┐  ABEL CANDIEIRO              ┌─────┐ │
│ │      │  ID  AGR-976091758           │ QR  │ │ corpo
│ │ FOTO │  Província / Município       │     │ │
│ │      │  ECA: ...                    └─────┘ │
│ │      │  PATEC: ...                  Verificar│
│ └──────┘                                       │
├────────────────────────────────────────────────┤
│ Cartão de Identificação do Agricultor   ATIVO  │ footer
└────────────────────────────────────────────────┘
```

Mudanças específicas:
- Header com duas marcas: à **esquerda** insígnia da República de Angola + texto "MINAGRIF" / "República de Angola" empilhado; à **direita** logo MOSAP3 em círculo branco. Título "Cartão de Identificação do Agricultor" passa para o footer para libertar o topo.
- Foto **estilo passaporte** (proporção 3:4, ~64×84 px à escala 1), borda branca fina, canto arredondado discreto, alinhada verticalmente ao bloco de informação.
- Nome do agricultor com tipografia maior e bold, ID em mono numa linha logo abaixo, província/município/ECA/PATEC em linhas separadas com hierarquia consistente (tracking, opacidade) e truncagem.
- QR à direita alinhado ao topo do bloco de informação (mesma baseline da foto), com label "Verificar" centrada por baixo.
- Footer com gradiente subtil e badge de estado à direita usando tokens semânticos (`success` / `warning`) em vez de `text-green-300` literal.
- Remover os `transform: scale(${scale})` aninhados que estavam a causar desalinhamento entre header/corpo/footer; aplicar `scale` apenas no contentor raiz.

### Verso

```
┌────────────────────────────────────────────────┐
│              ║║│║║│║│║│║║│║│║                  │ barcode centrado
│              AGR-976091758                     │
├────────────────────────────────────────────────┤
│  BI:            004XXXXXXLA041                 │
│  Telefone:      244 976 091 758                │ grid 2 col
│  Elegibilidade: Sem crédito                    │ key→muted
│  Emissão:       17/05/2026                     │ value→foreground
├────────────────────────────────────────────────┤
│ Cartão emitido pelo sistema MOSAP3.            │
│ Para verificar autenticidade, leia o QR Code.  │
└────────────────────────────────────────────────┘
```

- Padding lateral consistente com a frente (px-4) e blocos verticalmente espaçados com `space-y`.
- Grelha de detalhes com colunas alinhadas (label muted, valor foreground), tipografia ligeiramente maior (8–9px à escala 1) para legibilidade.
- Barcode reduzido de altura mas com mais ar à volta; código por baixo em mono.
- Footer em duas linhas centradas.

### Tokens / cores
- Manter o gradiente verde MOSAP3 mas usar tokens HSL existentes (`--primary` → variação mais escura) sem cores literais novas.
- Estado: `success` (Ativo/Aprovado), `warning` (Pendente), `destructive` (Revogado).

### Ativos a adicionar
Aguardar upload do utilizador:
- `src/assets/republica-angola.png` (insígnia / brasão da República)
- `src/assets/minagrif.png` (opcional, se logo separado; caso contrário usar apenas texto "MINAGRIF")

Até as imagens chegarem, deixar `<img>` com `src` apontando para o ficheiro esperado e fallback de texto, para que a substituição depois seja um simples drop-in.

### Ficheiros tocados
- `src/components/cartao/FarmerIdCard.tsx` (único componente — afeta automaticamente `CartaoIdLote`, `CartoesId`, `FarmerCardTab`, exportação PDF/PNG via `cardExport.ts`).

Sem alterações em rotas, dados ou exportação.