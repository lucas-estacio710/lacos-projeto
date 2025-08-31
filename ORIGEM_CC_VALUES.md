# Valores Padrão - Origem e CC

Este documento define os valores padrão aceitos pelos campos `origem` e `cc` no sistema.

## Origem (Source)

Lista de valores aceitos para o campo `origem`:

| Valor | Label | Ícone | Descrição |
|-------|-------|-------|-----------|
| `Inter` | Inter | 🟠 | Banco Inter |
| `BB` | Banco do Brasil | 🟡 | Banco do Brasil |
| `Santander` | Santander | 🔴 | Banco Santander |
| `Stone` | Stone | 🟢 | Stone (Maquininhas) |
| `Nubank` | Nubank | 🟣 | Nubank |
| `MasterCard` | MasterCard | 💳 | Cartão MasterCard |
| `Visa` | Visa | 💳 | Cartão Visa |
| `Investimento Inter` | Investimento Inter | 📊 | Investimentos Inter |
| `Investimento Keka` | Investimento Keka | 📈 | Investimentos Keka |
| `Dinheiro` | Dinheiro | 💵 | Pagamentos em dinheiro |

## CC (Centro de Custo/Banco)

Lista de valores aceitos para o campo `cc`:

| Valor | Label | Ícone | Descrição |
|-------|-------|-------|-----------|
| `Inter` | Inter | 🟠 | Banco Inter |
| `BB` | Banco do Brasil | 🟡 | Banco do Brasil |
| `Santander` | Santander | 🔴 | Banco Santander |
| `Stone` | Stone | 🟢 | Stone (Maquininhas) |
| `Nubank` | Nubank | 🟣 | Nubank |
| `Investimento Inter` | Investimento Inter | 📊 | Investimentos Inter |
| `Investimento Keka` | Investimento Keka | 📈 | Investimentos Keka |
| `Dinheiro` | Dinheiro | 💵 | Pagamentos em dinheiro |

## Diferenças entre Origem e CC

- **Origem**: Inclui `MasterCard` e `Visa` (para transações de cartão)
- **CC**: Não inclui cartões, apenas bancos e investimentos

## Uso no Sistema

### Lançamento Manual
Os dropdowns no lançamento manual (`ComplexClassificationTab.tsx`) utilizam essas listas.

### Uploads Bancários
Os arquivos de upload (`BankUpload.tsx`) definem automaticamente estes valores baseados no tipo de arquivo.

### Filtros
Estes valores são utilizados nos filtros de origem no `InboxTab.tsx`.

## Manutenção

Ao adicionar novos bancos ou origens:

1. Atualize as listas `origemOptions` e `ccOptions` em `ComplexClassificationTab.tsx`
2. Atualize este documento
3. Verifique se há outros componentes que precisam dos novos valores
4. Teste o lançamento manual com os novos valores

---
*Última atualização: 2025-08-23*