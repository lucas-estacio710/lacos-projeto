// Script para identificar e remover código legado do sistema de categorias
// Run with: npx tsx scripts/cleanup-legacy-system.ts

import * as fs from 'fs';
import * as path from 'path';

const sourceDir = path.join(__dirname, '../src');

interface LegacyUsage {
  file: string;
  lines: { number: number; content: string; type: string }[];
}

const legacyPatterns = [
  { pattern: /getCategoriesForAccount/g, type: 'getCategoriesForAccount' },
  { pattern: /from.*categories/g, type: 'categories import' },
  { pattern: /categories\[.*\]/g, type: 'categories object access' },
  { pattern: /categoriesPJ|categoriesPF|categoriesCONC/g, type: 'legacy categories constants' },
  { pattern: /useConfig.*categories/g, type: 'useConfig categories' }
];

function scanFile(filePath: string): LegacyUsage | null {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const foundLines: { number: number; content: string; type: string }[] = [];
    
    lines.forEach((line, index) => {
      legacyPatterns.forEach(({ pattern, type }) => {
        if (pattern.test(line)) {
          foundLines.push({
            number: index + 1,
            content: line.trim(),
            type
          });
        }
      });
    });
    
    return foundLines.length > 0 ? { file: filePath, lines: foundLines } : null;
  } catch (error) {
    return null;
  }
}

function scanDirectory(dir: string): LegacyUsage[] {
  const results: LegacyUsage[] = [];
  
  function scanRecursive(currentDir: string) {
    const files = fs.readdirSync(currentDir);
    
    files.forEach(file => {
      const fullPath = path.join(currentDir, file);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
        scanRecursive(fullPath);
      } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
        const result = scanFile(fullPath);
        if (result) {
          results.push(result);
        }
      }
    });
  }
  
  scanRecursive(dir);
  return results;
}

function main() {
  console.log('🔍 ESCANEANDO CÓDIGO LEGADO DO SISTEMA DE CATEGORIAS...\n');
  
  const legacyUsages = scanDirectory(sourceDir);
  
  if (legacyUsages.length === 0) {
    console.log('✅ NENHUM CÓDIGO LEGADO ENCONTRADO! Sistema 100% migrado.\n');
    return;
  }
  
  console.log(`❌ ENCONTRADAS ${legacyUsages.length} ARQUIVOS COM CÓDIGO LEGADO:\n`);
  
  legacyUsages.forEach(usage => {
    const relativePath = path.relative(process.cwd(), usage.file);
    console.log(`📄 ${relativePath}`);
    
    const typeGroups = usage.lines.reduce((acc, line) => {
      if (!acc[line.type]) acc[line.type] = [];
      acc[line.type].push(line);
      return acc;
    }, {} as Record<string, typeof usage.lines>);
    
    Object.entries(typeGroups).forEach(([type, lines]) => {
      console.log(`   🔸 ${type}:`);
      lines.forEach(line => {
        console.log(`      Linha ${line.number}: ${line.content}`);
      });
    });
    console.log('');
  });
  
  // Sugestões de limpeza
  console.log('🧹 SUGESTÕES DE LIMPEZA:\n');
  console.log('1. REMOVER ARQUIVOS:');
  console.log('   - src/lib/categories.ts');
  console.log('   - src/hooks/useCategorySystem.ts (se não usado)');
  console.log('');
  
  console.log('2. ATUALIZAR ConfigContext.tsx:');
  console.log('   - Remover getCategoriesForAccount');
  console.log('   - Remover imports de categories.ts');
  console.log('   - Manter apenas origins, banks, customAccounts');
  console.log('');
  
  console.log('3. LIMPAR COMPONENTES:');
  console.log('   - Remover fallbacks para sistema antigo');
  console.log('   - Usar apenas useHierarchy');
  console.log('   - Remover imports desnecessários');
  console.log('');
  
  console.log('4. SCRIPTS DE MIGRAÇÃO:');
  console.log('   - Mover scripts/migrations para scripts/archive/');
  console.log('   - Manter apenas scripts de manutenção da hierarquia');
}

main();