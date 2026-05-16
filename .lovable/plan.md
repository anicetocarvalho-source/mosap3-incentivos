## Carregamento do ficheiro `data_2.xlsx`

### Dados de origem
- **88.918 linhas** → **14.821 agricultores únicos** (cada telefone aparece em ~6 snapshots; 2 farmers só têm 1)
- **5 províncias** (Cunene, Benguela, Huíla, Cuando-Cubango, Namibe) + 1 valor `Null` (1 farmer)
- **8 municípios**: Bocoio, Ondjiva, Menongue, Cubal, Balombo, Chibia, Quipungo, Bibala
- **758 ECAs** distintas
- **2 linhas sem telefone** com gasto de 2.093.845 AOA → vão para `orphan_phones`

### ⚠️ Aviso importante sobre "Somar todos os snapshots"
Os valores `Total Disponibilizado` e `Valor Gasto` são **idênticos** nas 6 linhas de cada telefone (são snapshots, não transações independentes). Somar vai multiplicar os valores reais por 6:

| Métrica | Valor real (1 snapshot) | Após somar 6 snapshots |
|---|---|---|
| Total disponibilizado | ≈ 5.182 M AOA | **31.093 M AOA** |
| Valor gasto | ≈ 742 M AOA | **4.454 M AOA** |

Vou seguir a escolha (somar), mas **recomendo fortemente mudar para "Manter só o mais recente"** para refletir os valores reais. Se quiseres, podemos trocar antes de eu executar.

### Plano de execução

**1. Migração — tabela de staging temporária**
```text
_xlsx_recon_staging já existe (RLS admin). Re-uso para carregar todos os 88.918 registos.
```

**2. Carregar staging via `psql COPY` (rápido, ~30s)**
- Limpar staging
- COPY do CSV gerado a partir do Excel

**3. Inserir entidades de referência** (idempotente — `ON CONFLICT DO NOTHING`)
- 5 provinces (ignorar `Null`)
- 8 municipalities (ligadas a province_id)
- 758 escolas de campo (ligadas a province_id + municipality_id)

**4. Inserir agricultores deduplicados (14.821 registos)**
- Agregação por telefone: SUM(total), SUM(gasto), saldo = total − gasto
- `code` = `AGR-` + últimos 9 dígitos do telefone
- `full_name`, `phone`, `province`, `municipality`, `school` = primeiro valor não-nulo
- `status` = `Ativo`
- `valor_recebido`, `total_gasto`, `saldo_final` formatados como string PT-AO (`"5.182.080,00"`)
- O telefone com província `Null` fica sem província/município
- Inserções em blocos de 500 (respeitando limite Supabase)

**5. Registar 2 linhas órfãs em `orphan_phones`** (telefone NULL, gasto = 2.093.845)

**6. Audit log**: registar acção `bulk_import` com totais e contagens em `audit_logs`

**7. Verificação pós-importação**
- `SELECT count(*) FROM farmers` → esperado: 14.821
- `SELECT SUM(valor_num) FROM …` para sanity check
- `SELECT count(*) FROM escolas_campo / municipalities / provinces`

### Detalhes técnicos

**Geração do código farmer**
```python
code = f"AGR-{str(int(telefone))[-9:]}"
# Telefone 244973240696 → AGR-973240696
```

**Colisão de últimos 9 dígitos**: vou validar antes de inserir. Se houver colisões, uso `AGR-{telefone completo}` para esses casos.

**ECAs com mesmo nome em municípios diferentes**: trato como entidades distintas (chave = nome + municipality_id).

**Formato monetário PT-AO**: `1234567.89` → `"1.234.567,89"` (consistente com `saldo_final` actual).

**Performance**: usar `supabase--insert` em chunks de 500 + ON CONFLICT no `code` para idempotência.

### Resultado esperado
- 14.821 agricultores activos prontos para uso no POS
- Hierarquia geográfica completa (provinces → municipalities → escolas_campo)
- 2 órfãos registados para reconciliação manual
- Audit trail da operação

### O que NÃO está incluído
- Transações individuais (`farmer_transactions`) — os dados são snapshots
- Registos de incentivos (`farmer_incentives`)
- Biometria / fotos / documentos
- Atribuição de PATEC

Se aprovares, executo. Antes disso, **confirma se manténs a soma dos snapshots ou se preferes trocar para "snapshot mais recente"** (valores ~6× menores, mas reais).