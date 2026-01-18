/**
 * Script to replace console statements with logger utility
 * 
 * Run with: node scripts/remove-console-logs.js
 * 
 * This script:
 * 1. Finds all console.log/warn/info/debug statements
 * 2. Replaces them with logger equivalents
 * 3. Keeps console.error (errors are important)
 * 
 * NOTE: Review changes before committing - some logs may need manual adjustment
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const APP_DIR = path.join(__dirname, '..');
const EXCLUDE_DIRS = ['node_modules', '.expo', 'dist', 'web-build', '.git', 'scripts'];

// Files to skip (documentation, config files, etc.)
const SKIP_FILES = [
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'eslint.config.js',
  'app.json',
  'eas.json',
  'README.md',
  'COMPLIANCE_PLAN.md',
  'APP_STORE_AUDIT.md',
  'BACKEND_IMPLEMENTATION_PLAN.md',
  'DEPENDENCY_AUDIT.md',
  'DEPLOYMENT_CHECKLIST.md',
  'IMPLEMENTATION_STATUS.md',
  'NEXT_STEPS_ANALYSIS.md',
  'PHASE5_AUDIT.md',
  'PROFILE_UPDATE_IMPLEMENTATION.md',
  'REFACTORING_PLAN.md',
  'ROADMAP.md',
  'SETTINGS_IMPLEMENTATION_PLAN.md',
  'STATE_MANAGEMENT_ANALYSIS.md',
  'SUPABASE_MIGRATIONS.md',
  'UPDATE_MENU_PERMISSIONS.md',
];

function shouldProcessFile(filePath) {
  const fileName = path.basename(filePath);
  if (SKIP_FILES.includes(fileName)) return false;
  if (!filePath.endsWith('.ts') && !filePath.endsWith('.tsx') && !filePath.endsWith('.js') && !filePath.endsWith('.jsx')) {
    return false;
  }
  return true;
}

function getAllFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      if (!EXCLUDE_DIRS.includes(file)) {
        getAllFiles(filePath, fileList);
      }
    } else if (shouldProcessFile(filePath)) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

function replaceConsoleStatements(content, filePath) {
  let modified = content;
  let changes = 0;
  
  // Check if logger is already imported
  const hasLoggerImport = /import.*logger.*from.*['"]@\/utils\/logger['"]/.test(content);
  
  // Add logger import if needed and if we're making changes
  const needsLogger = /console\.(log|warn|info|debug)/.test(content);
  
  if (needsLogger && !hasLoggerImport) {
    // Find the last import statement
    const importMatch = content.match(/(import.*from.*['"][^'"]+['"];?\s*\n)+/);
    if (importMatch) {
      const lastImportIndex = importMatch[0].lastIndexOf('\n');
      const insertIndex = importMatch.index + lastImportIndex + 1;
      modified = modified.slice(0, insertIndex) + 
                 "import { logger } from '@/utils/logger';\n" + 
                 modified.slice(insertIndex);
      changes++;
    } else {
      // No imports found, add at top
      modified = "import { logger } from '@/utils/logger';\n" + modified;
      changes++;
    }
  }
  
  // Replace console.log with logger.log
  modified = modified.replace(/console\.log\(/g, (match) => {
    changes++;
    return 'logger.log(';
  });
  
  // Replace console.warn with logger.warn
  modified = modified.replace(/console\.warn\(/g, (match) => {
    changes++;
    return 'logger.warn(';
  });
  
  // Replace console.info with logger.info
  modified = modified.replace(/console\.info\(/g, (match) => {
    changes++;
    return 'logger.info(';
  });
  
  // Replace console.debug with logger.debug
  modified = modified.replace(/console\.debug\(/g, (match) => {
    changes++;
    return 'logger.debug(';
  });
  
  // Keep console.error as-is (errors are important)
  
  return { modified, changes };
}

function main() {
  console.log('🔍 Finding all TypeScript/JavaScript files...');
  const files = getAllFiles(APP_DIR);
  console.log(`Found ${files.length} files to process\n`);
  
  let totalChanges = 0;
  const changedFiles = [];
  
  files.forEach(file => {
    try {
      const content = fs.readFileSync(file, 'utf8');
      const { modified, changes } = replaceConsoleStatements(content, file);
      
      if (changes > 0) {
        fs.writeFileSync(file, modified, 'utf8');
        totalChanges += changes;
        changedFiles.push({ file, changes });
        console.log(`✅ ${file}: ${changes} changes`);
      }
    } catch (error) {
      console.error(`❌ Error processing ${file}:`, error.message);
    }
  });
  
  console.log(`\n✨ Done! Made ${totalChanges} changes across ${changedFiles.length} files.`);
  console.log('\n📝 Next steps:');
  console.log('1. Review the changes with: git diff');
  console.log('2. Test the app to ensure everything works');
  console.log('3. Some files may need manual adjustment (e.g., prefixed logs)');
}

if (require.main === module) {
  main();
}

module.exports = { replaceConsoleStatements };
