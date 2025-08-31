// Script para atualizar todos os componentes removendo código legado
// Run with: npx tsx scripts/update-components.ts

import * as fs from 'fs';
import * as path from 'path';

interface FileUpdate {
  file: string;
  originalContent: string;
  updatedContent: string;
  changes: string[];
}

class LegacyCodeRemover {
  private updates: FileUpdate[] = [];

  updateFile(filePath: string): boolean {
    try {
      const fullPath = path.resolve(filePath);
      if (!fs.existsSync(fullPath)) {
        console.log(`⚠️ Arquivo não encontrado: ${filePath}`);
        return false;
      }

      const originalContent = fs.readFileSync(fullPath, 'utf8');
      let updatedContent = originalContent;
      const changes: string[] = [];

      // Aplicar todas as transformações
      const result = this.applyAllTransformations(updatedContent, filePath);
      updatedContent = result.content;
      changes.push(...result.changes);

      if (originalContent !== updatedContent) {
        this.updates.push({
          file: filePath,
          originalContent,
          updatedContent,
          changes
        });
        return true;
      }

      return false;
    } catch (error) {
      console.error(`❌ Erro ao processar ${filePath}:`, error);
      return false;
    }
  }

  private applyAllTransformations(content: string, filePath: string): { content: string; changes: string[] } {
    let updatedContent = content;
    const changes: string[] = [];

    // 1. Remover imports legados
    const importResult = this.removeLegacyImports(updatedContent);
    if (importResult.changed) {
      updatedContent = importResult.content;
      changes.push(...importResult.changes);
    }

    // 2. Remover uso de getCategoriesForAccount
    const getCategoriesResult = this.removeGetCategoriesUsage(updatedContent);
    if (getCategoriesResult.changed) {
      updatedContent = getCategoriesResult.content;
      changes.push(...getCategoriesResult.changes);
    }

    // 3. Remover fallbacks para sistema antigo
    const fallbackResult = this.removeLegacyFallbacks(updatedContent);
    if (fallbackResult.changed) {
      updatedContent = fallbackResult.content;
      changes.push(...fallbackResult.changes);
    }

    // 4. Limpezas específicas por arquivo
    const specificResult = this.applyFileSpecificCleanups(updatedContent, filePath);
    if (specificResult.changed) {
      updatedContent = specificResult.content;
      changes.push(...specificResult.changes);
    }

    return { content: updatedContent, changes };
  }

  private removeLegacyImports(content: string): { content: string; changed: boolean; changes: string[] } {
    const changes: string[] = [];
    let updatedContent = content;
    let changed = false;

    // Remover imports de categories.ts
    const categoryImportRegex = /import.*from.*['"]@\/lib\/categories['"];?\n/g;
    if (categoryImportRegex.test(updatedContent)) {
      updatedContent = updatedContent.replace(categoryImportRegex, '');
      changes.push('Removido import de categories.ts');
      changed = true;
    }

    // Remover getCategoriesForAccount das importações de useConfig
    const configImportRegex = /import\s*\{\s*([^}]*getCategoriesForAccount[^}]*)\s*\}\s*from\s*['"]@\/contexts\/ConfigContext['"];?/g;
    updatedContent = updatedContent.replace(configImportRegex, (match, imports) => {
      const importList = imports.split(',').map((imp: string) => imp.trim()).filter((imp: string) => 
        !imp.includes('getCategoriesForAccount')
      );
      
      if (importList.length > 0) {
        changes.push('Removido getCategoriesForAccount do import de ConfigContext');
        changed = true;
        return `import { ${importList.join(', ')} } from '@/contexts/ConfigContext';`;
      } else {
        changes.push('Removido import completo de ConfigContext (não usado)');
        changed = true;
        return '';
      }
    });

    return { content: updatedContent, changed, changes };
  }

  private removeGetCategoriesUsage(content: string): { content: string; changed: boolean; changes: string[] } {
    const changes: string[] = [];
    let updatedContent = content;
    let changed = false;

    // Remover linhas que usam getCategoriesForAccount
    const lines = updatedContent.split('\n');
    const filteredLines = lines.filter(line => {
      if (line.includes('getCategoriesForAccount') && !line.includes('//')) {
        changes.push(`Removida linha: ${line.trim()}`);
        changed = true;
        return false;
      }
      return true;
    });

    if (changed) {
      updatedContent = filteredLines.join('\n');
    }

    return { content: updatedContent, changed, changes };
  }

  private removeLegacyFallbacks(content: string): { content: string; changed: boolean; changes: string[] } {
    const changes: string[] = [];
    let updatedContent = content;
    let changed = false;

    // Remover blocos de fallback para sistema antigo
    const fallbackPattern = /\/\/\s*Fallback\s+para\s+sistema\s+antigo[\s\S]*?}\s*}/g;
    if (fallbackPattern.test(updatedContent)) {
      updatedContent = updatedContent.replace(fallbackPattern, '');
      changes.push('Removido código de fallback para sistema antigo');
      changed = true;
    }

    // Remover condições específicas de fallback
    const specificFallbacks = [
      /const categories = getCategoriesForAccount\([^)]+\);[\s\n]*if \(categories\[[^\]]+\]\) \{[\s\S]*?\}/g,
      /if \(categories\[[^\]]+\]\) \{[\s\S]*?\}/g
    ];

    specificFallbacks.forEach(pattern => {
      if (pattern.test(updatedContent)) {
        updatedContent = updatedContent.replace(pattern, '');
        changes.push('Removido bloco de fallback específico');
        changed = true;
      }
    });

    return { content: updatedContent, changed, changes };
  }

  private applyFileSpecificCleanups(content: string, filePath: string): { content: string; changed: boolean; changes: string[] } {
    const changes: string[] = [];
    let updatedContent = content;
    let changed = false;

    const fileName = path.basename(filePath);

    switch (fileName) {
      case 'ConfigContext.tsx':
        const configResult = this.cleanConfigContext(updatedContent);
        updatedContent = configResult.content;
        changes.push(...configResult.changes);
        changed = configResult.changed;
        break;

      case 'useTransactions.ts':
        const transResult = this.cleanUseTransactions(updatedContent);
        updatedContent = transResult.content;
        changes.push(...transResult.changes);
        changed = transResult.changed;
        break;

      case 'smartClassification.ts':
        const smartResult = this.cleanSmartClassification(updatedContent);
        updatedContent = smartResult.content;
        changes.push(...smartResult.changes);
        changed = smartResult.changed;
        break;
    }

    return { content: updatedContent, changed, changes };
  }

  private cleanConfigContext(content: string): { content: string; changed: boolean; changes: string[] } {
    const changes: string[] = [];
    let updatedContent = content;

    // Remover completamente a lógica de categorias legadas
    const categoriesToRemove = [
      /getCategoriesForAccount.*$/gm,
      /categories:\s*\{[\s\S]*?\},/g,
      /'PJ':\s*categoriesPJ,/g,
      /'PF':\s*categoriesPF,/g,
      /'CONC\.':\s*categoriesCONC/g
    ];

    categoriesToRemove.forEach(pattern => {
      if (pattern.test(updatedContent)) {
        updatedContent = updatedContent.replace(pattern, '');
        changes.push('Removida configuração de categorias legadas');
      }
    });

    return { content: updatedContent, changed: changes.length > 0, changes };
  }

  private cleanUseTransactions(content: string): { content: string; changed: boolean; changes: string[] } {
    const changes: string[] = [];
    let updatedContent = content;

    // Remover função getAccountFromCategory se usar categorias legadas
    const legacyAccountPattern = /const getAccountFromCategory[\s\S]*?return 'PF';[\s]*}/g;
    if (legacyAccountPattern.test(updatedContent)) {
      updatedContent = updatedContent.replace(legacyAccountPattern, '');
      changes.push('Removida função getAccountFromCategory legada');
    }

    return { content: updatedContent, changed: changes.length > 0, changes };
  }

  private cleanSmartClassification(content: string): { content: string; changed: boolean; changes: string[] } {
    const changes: string[] = [];
    let updatedContent = content;

    // Substituir lógica de classificação legada
    const legacyClassificationPattern = /if \(Object\.keys\(categoriesPJ\)\.includes\(c\.categoria.*?\)\)\s*conta = 'PJ';/g;
    if (legacyClassificationPattern.test(updatedContent)) {
      updatedContent = updatedContent.replace(legacyClassificationPattern, 
        '// TODO: Implementar classificação baseada na hierarquia dinâmica');
      changes.push('Substituída lógica de classificação legada por TODO');
    }

    return { content: updatedContent, changed: changes.length > 0, changes };
  }

  async applyUpdates(): Promise<void> {
    console.log(`\n📝 Aplicando ${this.updates.length} atualizações...\n`);

    for (const update of this.updates) {
      try {
        fs.writeFileSync(update.file, update.updatedContent, 'utf8');
        console.log(`✅ ${update.file}`);
        update.changes.forEach(change => console.log(`   - ${change}`));
        console.log('');
      } catch (error) {
        console.error(`❌ Erro ao salvar ${update.file}:`, error);
      }
    }
  }

  generateReport(): void {
    console.log('\n📊 RELATÓRIO DE LIMPEZA:\n');
    console.log(`Total de arquivos processados: ${this.updates.length}`);
    console.log(`Total de alterações: ${this.updates.reduce((sum, u) => sum + u.changes.length, 0)}\n`);

    if (this.updates.length === 0) {
      console.log('✅ Nenhuma alteração necessária - código já limpo!\n');
    }
  }
}

async function main() {
  console.log('🧹 INICIANDO LIMPEZA AUTOMÁTICA DO CÓDIGO LEGADO...\n');

  const remover = new LegacyCodeRemover();

  const filesToUpdate = [
    'src/components/AnalyticsTab.tsx',
    'src/components/BatchClassificationModal.tsx', 
    'src/components/CartoesTab.tsx',
    'src/components/ComplexClassificationTab.tsx',
    'src/components/EditTransactionModal.tsx',
    'src/components/ManualEntryModal.tsx',
    'src/components/OverviewTab.tsx',
    'src/components/SplitCardTransactionModal.tsx',
    'src/components/SplitTransactionModal.tsx',
    'src/contexts/ConfigContext.tsx',
    'src/hooks/useTransactions.ts',
    'src/lib/smartClassification.ts'
  ];

  let processedFiles = 0;
  for (const file of filesToUpdate) {
    console.log(`🔍 Processando: ${file}`);
    if (remover.updateFile(file)) {
      processedFiles++;
    }
  }

  remover.generateReport();

  if (processedFiles > 0) {
    await remover.applyUpdates();
    console.log('🎉 LIMPEZA CONCLUÍDA COM SUCESSO!\n');
    console.log('📋 PRÓXIMOS PASSOS:');
    console.log('1. Executar: npm run build');
    console.log('2. Testar funcionalidades principais');
    console.log('3. Executar testes se houver');
    console.log('4. Fazer commit das alterações\n');
  } else {
    console.log('✅ Código já está limpo!\n');
  }
}

main().catch(console.error);