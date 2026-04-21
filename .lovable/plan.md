
## Problema

No formulário de login do Backoffice (`/auth`), o botão de submit aparece vazio (sem texto "Entrar"). Pela captura de ecrã, vê-se a caixa do botão renderizada mas sem label visível.

## Causa provável

Em `src/pages/Auth.tsx`, o botão de submit do formulário backoffice usa provavelmente um spinner condicional (`loading ? <Loader/> : "Entrar"`) ou tem o texto envolvido por algum elemento que não está a renderizar corretamente. Pode também ser:
- O texto foi removido acidentalmente numa edição anterior.
- O `Loader2` está sempre renderizado sem o texto fallback.
- O conteúdo do botão é apenas um ícone sem `<span>Entrar</span>`.

Preciso confirmar lendo `src/pages/Auth.tsx` para identificar a linha exata do botão de submit do backoffice. (Verifico no momento da execução, em modo default.)

## Solução

Editar `src/pages/Auth.tsx` no bloco do formulário backoffice para garantir que o botão de submit mostra:
- Estado normal: ícone (LogIn) + texto **"Entrar"**.
- Estado loading: ícone Loader2 a girar + texto **"A entrar..."**.

Estrutura alvo:
```tsx
<Button type="submit" className="w-full" disabled={loading}>
  {loading ? (
    <>
      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      A entrar...
    </>
  ) : (
    <>
      <LogIn className="h-4 w-4 mr-2" />
      Entrar
    </>
  )}
</Button>
```

Aplicar correção equivalente ao botão do formulário Fornecedor caso esteja com o mesmo problema.

### Ficheiros a editar
- `src/pages/Auth.tsx` — corrigir conteúdo do(s) botão(ões) de submit.

### Sem alterações
- Sem mudanças de BD, RLS ou outros componentes.

### Resultado
O botão "Entrar" do backoffice volta a mostrar o texto e ícone correctamente, com feedback visual durante o loading.
