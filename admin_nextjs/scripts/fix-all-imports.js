#!/usr/bin/env node
/**
 * Скрипт для замены всех относительных путей к lib/ на алиасы @/lib/
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const appDir = path.join(__dirname, '..', 'app');

function findFiles(dir, extensions = ['.ts', '.tsx']) {
  let results = [];
  const list = fs.readdirSync(dir);
  
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat && stat.isDirectory()) {
      results = results.concat(findFiles(filePath, extensions));
    } else if (extensions.some(ext => file.endsWith(ext))) {
      results.push(filePath);
    }
  });
  
  return results;
}

function fixImports(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Заменяем различные варианты относительных путей
  const patterns = [
    // ../../lib/ -> @/lib/
    { from: /from\s+['"]\.\.\/\.\.\/lib\//g, to: "from '@/lib/" },
    // ../../../lib/ -> @/lib/
    { from: /from\s+['"]\.\.\/\.\.\/\.\.\/lib\//g, to: "from '@/lib/" },
    // ../../../../lib/ -> @/lib/
    { from: /from\s+['"]\.\.\/\.\.\/\.\.\/\.\.\/lib\//g, to: "from '@/lib/" },
    // ../../../../../lib/ -> @/lib/
    { from: /from\s+['"]\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/lib\//g, to: "from '@/lib/" },
    // ../../../../../../lib/ -> @/lib/
    { from: /from\s+['"]\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/lib\//g, to: "from '@/lib/" },
  ];
  
  patterns.forEach(({ from, to }) => {
    if (from.test(content)) {
      content = content.replace(from, to);
      modified = true;
    }
  });
  
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    return true;
  }
  
  return false;
}

console.log('🔧 Исправление всех импортов lib/ на алиасы @/lib/...\n');

const files = findFiles(appDir);
let fixedCount = 0;

files.forEach(file => {
  if (fixImports(file)) {
    const relativePath = path.relative(path.join(__dirname, '..'), file);
    console.log(`  ✅ Исправлен: ${relativePath}`);
    fixedCount++;
  }
});

console.log(`\n✅ Исправлено файлов: ${fixedCount}`);

// Проверяем оставшиеся
console.log('\n📋 Проверяю оставшиеся относительные пути...');
const remaining = files.filter(file => {
  const content = fs.readFileSync(file, 'utf8');
  return /from\s+['"]\.\.\/.*lib\//.test(content);
});

if (remaining.length > 0) {
  console.log(`⚠️  Найдено еще ${remaining.length} файлов с относительными путями:`);
  remaining.forEach(file => {
    const relativePath = path.relative(path.join(__dirname, '..'), file);
    console.log(`  - ${relativePath}`);
  });
} else {
  console.log('✅ Все относительные пути заменены!');
}

