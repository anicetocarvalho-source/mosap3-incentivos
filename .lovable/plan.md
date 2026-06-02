
# Validação de acessos por tipo de utilizador

Fiz uma auditoria cruzada entre (1) a matriz `module_permissions` na base de dados, (2) os `allowedRoles` definidos em `AppNavbar.tsx` / `RoleGuard.tsx` e (3) as políticas RLS nas tabelas do backend. Resumo do estado atual e o que proponho corrigir.

## 1. Achados principais

### A. A matriz de permissões está VAZIA (crítico)
A tabela `module_permissions` não tem nenhuma linha. Consequências:
- A página `/perfis` mostra todos os switches desligados, mas isso não reflete a realidade.
- O `canAccessModule()` faz fallback "permitir tudo" quando não encontra dados → quem decide acesso é apenas o `allowedRoles` hardcoded em `navItems`.
- Resultado: módulos sem `allowedRoles` ficam visíveis para TODOS os perfis com sessão.

### B. Módulos visíveis para perfis que não deveriam ver
Pelo `navItems` actual, qualquer perfil autenticado (incluindo Técnico Extensionista e Júniores) vê:
- Dashboard
- Produtores (Registo do Pequeno Produtor, Cartões ID)
- Escolas de Campo
- Parcelas
- Produção
- Instalar

Restritos correctamente por `allowedRoles`:
- Incentivos, MOSAP3Pay, Anomalias → só `admin` + `gestor_incentivos`
- Relatórios → backoffice excepto `tecnico_extensionista`
- Utilizadores, Configurações → só `admin`

### C. Backend (RLS) não diferencia perfis dentro do backoffice
Quase todas as tabelas (`farmers`, `farmer_parcels`, `farmer_production`, `farmer_incentives`, `farmer_transactions`, etc.) usam `has_any_backoffice_role()`, que devolve true para **todos** os 9 perfis backoffice. Significa que:
- Um Técnico Extensionista pode, via API directa, ler/editar produtores de qualquer província.
- O filtro geográfico (províncias / ECAs) só é aplicado no cliente via `farmerScope.ts` — não é uma barreira de segurança.

### D. Perfil Fornecedor
Tem fluxo separado em `/fornecedor/*` com guarda própria (`FornecedorLayout`) e RLS dedicada — está OK e isolado do backoffice.

### E. Pequenas inconsistências
- `Perfis.tsx` lista o módulo "Compras" e "Empresas" que já foram removidos da navegação.
- O perfil `fornecedor` aparece como coluna em `/perfis` mas não tem nada a ver com módulos backoffice.
- "Análise de Preços" (recém criada) herda permissão do pai MOSAP3Pay → OK.

## 2. Matriz proposta (a popular em `module_permissions`)

```
Módulo                          adm  gest  sAgr sMon sAgn jAgr jMon jAgn tEx
Dashboard                        x    x     x    x    x    x    x    x    x
Cadastro de Agricultores         x    x     x    x    x    x    x    x    x
Escolas de Campo                 x    x     x    x    x    x    x    x    x
Parcelas                         x    x     x    .    .    x    .    .    x
Produção                         x    x     x    .    .    x    .    .    x
Incentivos                       x    x     .    .    .    .    .    .    .
MOSAP3Pay                        x    x     .    .    .    .    .    .    .
Relatórios                       x    x     x    x    x    x    x    x    .
Anomalias                        x    x     .    .    .    .    .    .    .
Utilizadores                     x    .     .    .    .    .    .    .    .
Configurações                    x    .     .    .    .    .    .    .    .
Gestão de Províncias             x    .     .    .    .    .    .    .    .
Gestão de ECAs                   x    x     x    x    x    .    .    .    .
```
(Confirmar consigo antes de aplicar — ver Decisões abaixo.)

## 3. Plano de correcção

### Passo 1 — Popular `module_permissions` (migração SQL)
Inserir uma linha por par (módulo, role) seguindo a matriz acima. Limpar entradas órfãs ("Compras", "Empresas") e remover a coluna `fornecedor` da página `/perfis`.

### Passo 2 — Reforçar `AppNavbar` para itens "abertos"
Adicionar `moduleName` em todos os itens que hoje não têm restrição (Dashboard, Produtores, Escolas, Parcelas, Produção) para que a matriz DB passe a controlá-los efectivamente. Já existem `moduleName` em quase todos; falta acrescentar restrições onde só há `moduleName` sem `allowedRoles` fallback.

### Passo 3 — Apertar RLS no backend (recomendado, mas opcional nesta fase)
Substituir `has_any_backoffice_role()` por funções `can_read_farmers(uid)` / `can_write_farmers(uid)` que validem província ou ECA via `user_provinces` / `user_ecas`. Isto fecha o gap de o filtro geográfico ser só client-side. **Impacto alto**: requer testes em todas as queries. Sugiro fazer numa iteração separada.

### Passo 4 — Limpeza visual em `/perfis`
- Remover linhas "Compras" e "Empresas".
- Remover coluna "Fornecedor" (não se aplica a módulos internos).
- Adicionar tooltip a explicar o efeito de cada toggle.

## 4. Decisões que preciso de si

1. **A matriz proposta na secção 2 está correcta?** Em particular:
   - Júniores Monitoria/Agronegócio devem ver Parcelas e Produção?
   - Técnico Extensionista deve aceder a Relatórios?
   - Gestor de Incentivos deve gerir Utilizadores / Configurações?
2. **Quer que eu avance já com o Passo 3 (RLS por província/ECA)** ou prefere fazer apenas Passos 1, 2 e 4 nesta iteração?
3. **Confirma a remoção da coluna "Fornecedor"** da matriz `/perfis`?

Assim que confirmar, executo as alterações.
