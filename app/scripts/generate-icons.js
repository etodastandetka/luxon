/**
 * Скрипт для генерации иконок PWA из SVG
 * Требует: sharp (npm install sharp --save-dev)
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const sizes = [192, 512];
const inputSvg = path.join(__dirname, '../public/icon.svg');
const outputDir = path.join(__dirname, '../public');

async function generateIcons() {
  try {
    // Читаем SVG
    const svgBuffer = fs.readFileSync(inputSvg);
    
    for (const size of sizes) {
      const outputPath = path.join(outputDir, `icon-${size}.png`);
      
      await sharp(svgBuffer)
        .resize(size, size)
        .png()
        .toFile(outputPath);
      
      console.log(`✅ Создана иконка: icon-${size}.png`);
    }
    
    console.log('✅ Все иконки успешно созданы!');
  } catch (error) {
    console.error('❌ Ошибка при создании иконок:', error);
    console.log('\n💡 Если sharp не установлен, выполните: npm install sharp --save-dev');
    process.exit(1);
  }
}

generateIcons();

