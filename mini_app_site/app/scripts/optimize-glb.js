const fs = require('fs');
const path = require('path');

async function optimizeGLB() {
  try {
    const publicDir = path.join(__dirname, '../public');
    const inputPath = path.join(publicDir, 'logo.glb');
    const outputPath = path.join(publicDir, 'logo-optimized.glb');
    
    // Проверяем наличие файла
    if (!fs.existsSync(inputPath)) {
      console.error('❌ Файл logo.glb не найден в папке public/');
      console.log('Пожалуйста, убедитесь, что файл logo.glb находится в папке mini_app_site/app/public/');
      process.exit(1);
    }
    
    const glb = fs.readFileSync(inputPath);
    const originalSize = (glb.length / 1024 / 1024).toFixed(2);
    console.log(`📦 Исходный размер: ${originalSize} MB`);
    
    // Используем gltf-transform через командную строку
    const { execSync } = require('child_process');
    const npxPath = process.platform === 'win32' ? 'npx.cmd' : 'npx';
    
    console.log('🔄 Оптимизация с помощью gltf-transform...');
    
    try {
      // Запускаем gltf-transform optimize
      execSync(
        `${npxPath} @gltf-transform/cli optimize ${inputPath} ${outputPath} --texture-compress webp --simplify --simplify-ratio 0.5`,
        { 
          cwd: path.join(__dirname, '..'),
          stdio: 'inherit'
        }
      );
      
      if (fs.existsSync(outputPath)) {
        const optimizedSize = (fs.statSync(outputPath).size / 1024 / 1024).toFixed(2);
        const reduction = ((1 - fs.statSync(outputPath).size / glb.length) * 100).toFixed(1);
        
        console.log(`\n✅ Оптимизация завершена!`);
        console.log(`📦 Оптимизированный размер: ${optimizedSize} MB`);
        console.log(`📉 Уменьшение: ${reduction}%`);
        
        // Создаем резервную копию оригинала
        const backupPath = path.join(publicDir, 'logo-original.glb');
        if (!fs.existsSync(backupPath)) {
          fs.copyFileSync(inputPath, backupPath);
          console.log(`💾 Резервная копия сохранена: logo-original.glb`);
        }
        
        // Заменяем оригинал оптимизированной версией
        fs.copyFileSync(outputPath, inputPath);
        fs.unlinkSync(outputPath);
        console.log(`✅ Файл logo.glb обновлен оптимизированной версией`);
      }
    } catch (error) {
      console.error('❌ Ошибка при использовании gltf-transform:', error.message);
      console.log('\n💡 Попробуем альтернативный метод с gltf-pipeline...');
      
      // Альтернативный метод с gltf-pipeline
      try {
        const gltfPipeline = require('gltf-pipeline');
        
        console.log('🔄 Оптимизация с помощью gltf-pipeline...');
        const options = {
          dracoOptions: {
            compressionLevel: 10,
            quantizePositionBits: 14,
            quantizeNormalBits: 10,
            quantizeTexcoordBits: 12
          }
        };
        
        const results = await gltfPipeline.processBinary(glb, options);
        
        const optimizedSize = (results.glb.length / 1024 / 1024).toFixed(2);
        const reduction = ((1 - results.glb.length / glb.length) * 100).toFixed(1);
        
        console.log(`\n✅ Оптимизация завершена!`);
        console.log(`📦 Оптимизированный размер: ${optimizedSize} MB`);
        console.log(`📉 Уменьшение: ${reduction}%`);
        
        // Резервная копия
        const backupPath = path.join(publicDir, 'logo-original.glb');
        if (!fs.existsSync(backupPath)) {
          fs.copyFileSync(inputPath, backupPath);
          console.log(`💾 Резервная копия сохранена: logo-original.glb`);
        }
        
        // Заменяем оригинал
        fs.writeFileSync(inputPath, results.glb);
        console.log(`✅ Файл logo.glb обновлен оптимизированной версией`);
      } catch (pipelineError) {
        console.error('❌ Ошибка при использовании gltf-pipeline:', pipelineError.message);
        console.log('\n💡 Рекомендуется оптимизировать файл вручную в Blender:');
        console.log('   1. Откройте модель в Blender');
        console.log('   2. Добавьте модификатор Decimate (Ratio: 0.1-0.3)');
        console.log('   3. Экспортируйте в GLB с включенной компрессией Draco');
        process.exit(1);
      }
    }
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  }
}

optimizeGLB();
