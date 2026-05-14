## Contexto

Após a reconciliação automática, o estado real em base é:
- **3.399** telefones órfãos no total (1.708.292.320,00 Kz)
- **3.387** auto-associados a agricultores (1.707.076.480,00 Kz) — `notes = "Auto-associado por validação (match últimos 9 dígitos)"`
- **12** ainda verdadeiramente pendentes (1.215.840,00 Kz)
- 0 associações manuais até ao momento

A página atual mostra apenas três contadores genéricos (Total / Pendentes / Associados) e não distingue auto vs manual, nem dá visibilidade aos 12 casos prioritários nem ao histórico da reconciliação.

## Alterações (apenas frontend, ficheiro `src/pages/TelefonesOrfaos.tsx`)

### 1. Cards de estatísticas (4 em vez de 3)
- **Total** (mantém)
- **Pendentes** (destaque visual reforçado quando count > 0 — borda warning + ícone)
- **Auto-associados** (success): conta linhas com `notes ILIKE 'Auto-associado%'`
- **Associados manualmente** (info/primary): conta linhas com `linked_farmer_code IS NOT NULL` e notes não auto

Cada card mostra contagem + valor em Kz formatado pt-AO.

### 2. Banner informativo no topo (quando há auto-associações)
Pequeno alerta success-tinted: "Reconciliação automática concluída — 3.387 telefones associados (1.707.076.480,00 Kz). Restam X casos para revisão manual." Calculado dinamicamente.

### 3. Filtros
Substituir os 3 botões atuais por 4: `Pendentes` (default) · `Auto-associados` · `Manuais` · `Todos`. Filtro derivado das `notes`.

### 4. Tabela
- Nova coluna **Origem** (badge): `Auto` (success outline) / `Manual` (primary outline) / `—` para pendentes
- Coluna **Notas/Detalhe** truncada com tooltip mostrando notes completos
- Ordenação default: pendentes primeiro, depois por valor desc
- Mostrar `linked_at` formatado em pt-AO na linha quando associado

### 5. Versão mobile
Cards já existentes recebem o mesmo badge de origem e a data de associação.

### 6. Dialog de associação manual
- Adicionar `notes` que comecem por `Manual:` para que o filtro distinga (já está, mas garantir prefixo `Manual:`)
- **Registar entrada em `farmer_balance_history`** após a associação manual (igual ao que o auto-link da função RPC faz), com `source = 'orphan_phone_manual_link'`, `delta`, `old_value`, `new_value`, `source_ref = orphan_phone.id`. Hoje a página atualiza `valor_recebido` mas não escreve histórico — é uma inconsistência face ao fluxo automático.

### 7. Export CSV
Acrescentar coluna `origem` (Auto/Manual/Pendente) ao CSV exportado.

## Fora do âmbito
- Sem alterações de schema nem de RPC.
- Sem alterações nas migrações de reconciliação já aplicadas.
- Sem mudanças noutras páginas.
