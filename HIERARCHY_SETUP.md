# Sistema de Hierarquias - Setup e Uso

## 📋 Visão Geral

Sistema de hierarquia dinâmica para classificações contábeis:
- **Contas** (PJ, PF, CONC., Raquel, etc.)
- **Categorias** (Receitas, Despesas, etc.)  
- **Subtipos** (REC. A. P. IND., ALUGUEL RIP, etc.)

## 🚀 Setup Inicial

### 1. Executar Migrações

```bash
# Executar migrações do sistema de hierarquia
npm run hierarchy:setup
```

### 2. Verificar no Supabase

Após executar, verifique se foram criadas as tabelas:
- `contas`
- `categorias` 
- `subtipos`
- `vw_hierarquia_completa` (view)

### 3. Dados Populados

O sistema será populado com:
- **PJ**: Receita Nova, Receita Antiga, Custos Operacionais, etc.
- **PF**: Contas Fixas, Contas Necessárias, Aquisições, etc.
- **CONC**: Entrecontas, Gastos Mamu, etc.
- **RAQUEL**: Conta criada mas sem categorias (para você adicionar)

## 📚 Como Usar

### Hook Principal

```typescript
import { useHierarchy } from '@/hooks/useHierarchy';

function MeuComponente() {
  const {
    // Dados
    contas,           // Lista de contas
    categorias,       // Lista de categorias
    subtipos,         // Lista de subtipos
    hierarquia,       // Estrutura hierárquica completa
    visaoPlana,       // Para dropdowns (caminho completo)
    loading,
    error,
    
    // Ações
    criarConta,
    atualizarConta,
    deletarConta,
    // ... etc
    
    // Utilitários
    obterContaPorCodigo,
    obterSubtiposPorConta
  } = useHierarchy();
}
```

### Exemplo: Dropdown de Classificação

```typescript
function ClassificationDropdown() {
  const { visaoPlana, loading } = useHierarchy();
  
  if (loading) return <div>Carregando...</div>;
  
  return (
    <select>
      {visaoPlana.map(item => (
        <option key={item.subtipo_id} value={item.subtipo_id}>
          {item.caminho_completo}
        </option>
      ))}
    </select>
  );
}
```

### Exemplo: Filtrar por Conta

```typescript
function SubtiposPJ() {
  const { obterSubtiposPorConta } = useHierarchy();
  
  const subtiposPJ = obterSubtiposPorConta('PJ');
  
  return (
    <ul>
      {subtiposPJ.map(subtipo => (
        <li key={subtipo.subtipo_id}>
          {subtipo.categoria_nome} > {subtipo.subtipo_nome}
        </li>
      ))}
    </ul>
  );
}
```

## 🎨 Cores (Removidas)

**IMPORTANTE**: Sistema de cores foi removido do código.
- ✅ Verde = valores positivos (receitas)
- ❌ Vermelho = valores negativos (despesas)
- Cores são determinadas pelo valor da transação, não pela classificação

## 🗂️ Estrutura de Arquivos

```
database/migrations/
├── 005_hierarchy_clean.sql        # Schema das tabelas
└── 006_populate_from_categories.sql # Dados iniciais

scripts/
├── run-hierarchy-migrations-direct.ts # Script principal
└── run-hierarchy-migrations.ts       # Script alternativo

src/
├── hooks/useHierarchy.ts          # Hook principal
├── types/database.ts              # Types para o banco
└── lib/categories.ts              # Dados legados (sem cores)
```

## 🔧 Troubleshooting

### Erro de Conexão
Verifique se as variáveis estão definidas:
```env
NEXT_PUBLIC_SUPABASE_URL=sua_url
SUPABASE_SERVICE_ROLE_KEY=sua_chave
```

### Tabelas não Criadas
1. Verifique logs do script
2. Execute manualmente no SQL Editor do Supabase
3. Verifique permissões RLS

### Hook não Carrega Dados
1. Verifique se as tabelas existem
2. Verifique se há dados populados
3. Verifique console para erros

## 🚀 Próximos Passos

1. Testar sistema criando transações
2. Atualizar componentes existentes
3. Criar interface de gestão da hierarquia
4. Migrar dados existentes (quando necessário)

## 📝 Comandos Úteis

```bash
# Setup completo
npm run hierarchy:setup

# Verificar se tsx está instalado
npm install -g tsx

# Executar script diretamente
npx tsx scripts/run-hierarchy-migrations-direct.ts
```