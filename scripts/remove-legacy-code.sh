#!/bin/bash
# Script para remover completamente o código legado do sistema de categorias
# Execute com: bash scripts/remove-legacy-code.sh

echo "🧹 REMOVENDO CÓDIGO LEGADO DO SISTEMA DE CATEGORIAS..."
echo ""

# 1. BACKUP DOS ARQUIVOS ANTES DA LIMPEZA
echo "📦 1. Criando backup dos arquivos legados..."
mkdir -p scripts/legacy-backup/$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="scripts/legacy-backup/$(date +%Y%m%d_%H%M%S)"

cp src/lib/categories.ts $BACKUP_DIR/ 2>/dev/null || echo "   - categories.ts não encontrado"
cp src/hooks/useCategorySystem.ts $BACKUP_DIR/ 2>/dev/null || echo "   - useCategorySystem.ts não encontrado"

echo "✅ Backup criado em: $BACKUP_DIR"
echo ""

# 2. REMOVER ARQUIVOS LEGADOS
echo "🗑️  2. Removendo arquivos legados..."
rm -f src/lib/categories.ts
rm -f src/hooks/useCategorySystem.ts
echo "✅ Arquivos removidos"
echo ""

# 3. MOVER SCRIPTS DE MIGRAÇÃO PARA ARQUIVO
echo "📁 3. Arquivando scripts de migração..."
mkdir -p scripts/archive/migrations
mv scripts/run-hierarchy-migrations*.ts scripts/archive/migrations/ 2>/dev/null || true
mv scripts/run-migration.ts scripts/archive/migrations/ 2>/dev/null || true
mv scripts/check-*.ts scripts/archive/migrations/ 2>/dev/null || true
mv scripts/list-tables.ts scripts/archive/migrations/ 2>/dev/null || true
echo "✅ Scripts de migração arquivados"
echo ""

echo "🎉 LIMPEZA INICIAL COMPLETA!"
echo ""
echo "📋 PRÓXIMOS PASSOS MANUAIS:"
echo "1. Executar: npx tsx scripts/update-components.ts"
echo "2. Testar o sistema"
echo "3. Executar: npm run build (verificar se não há erros)"
echo "4. Fazer commit das alterações"