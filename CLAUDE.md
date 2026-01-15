# Instruções para o Claude - Projeto Laços

## Versionamento

**IMPORTANTE:** Sempre que fizer alterações significativas no código, incrementar a versão no header do app.

- Arquivo: `src/app/dashboard/page.tsx`
- Procurar por: `v3.` (linha ~734)
- Formato: `vX.Y.Z` (SemVer)
  - X = Major (breaking changes)
  - Y = Minor (novas funcionalidades)
  - Z = Patch (correções/ajustes)

Exemplo de quando incrementar:
- Nova funcionalidade → v3.8.1 → v3.9.0
- Correção de bug → v3.8.1 → v3.8.2
- Mudança grande/breaking → v3.8.1 → v4.0.0

## Commits

Usar emojis nos commits:
- ✨ Nova funcionalidade
- 🐛 Correção de bug
- 🔧 Ajuste/configuração
- 🏷️ Versionamento
- 📝 Documentação
- ♻️ Refatoração

Sempre incluir co-author:
```
Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

## Estrutura do Projeto

- **Contas (CC):** Inter, BB, Stone, Santander Keka, Nubank, VISA, MasterCard
- **Transações:** Tabela `transactions` no Supabase
- **Hierarquia:** Conta → Categoria → Subtipo (via `subtipo_id`)
- **Status realizado:** 's' (realizado), 'p' (pendente), 'r' (reconciliado)

## Arquivos Importantes

- `src/app/dashboard/page.tsx` - Página principal + versão
- `src/components/BankUpload.tsx` - Importação de extratos
- `src/hooks/useTransactions.ts` - Hook de transações
- `src/types/index.ts` - Tipos TypeScript

## Git

Token do GitHub já está configurado no remote origin.
