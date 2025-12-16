package com.req.notificationreader

import android.os.Bundle
import android.provider.Settings
import android.view.Menu
import android.view.MenuItem
import androidx.appcompat.app.AppCompatActivity
import androidx.navigation.fragment.NavHostFragment
import androidx.navigation.ui.AppBarConfiguration
import androidx.navigation.ui.setupActionBarWithNavController
import androidx.navigation.ui.setupWithNavController
import com.req.notificationreader.databinding.ActivityMainBinding
import com.req.notificationreader.util.AppLogger

class MainActivity : AppCompatActivity() {
    
    private lateinit var binding: ActivityMainBinding
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        try {
            binding = ActivityMainBinding.inflate(layoutInflater)
            setContentView(binding.root)
            
            setSupportActionBar(binding.toolbar)
            
            // Настройка Navigation
            val navHostFragment = supportFragmentManager.findFragmentById(R.id.navHostFragment) as? NavHostFragment
            if (navHostFragment == null) {
                android.util.Log.e("MainActivity", "NavHostFragment не найден!")
                return
            }
            
            val navController = navHostFragment.navController
        
        // Конфигурация AppBar
        val appBarConfiguration = AppBarConfiguration(
            setOf(R.id.navigation_tracker, R.id.navigation_logs, R.id.navigation_apps)
        )
            
            setupActionBarWithNavController(navController, appBarConfiguration)
            
            // Инициализируем логгер
            AppLogger.initialize(this)
            AppLogger.info("app", "Приложение запущено")
            
            // Устанавливаем заголовок
            binding.toolbar.title = "LUXON"
            binding.toolbar.subtitle = "Трекер пополнений"
        } catch (e: Exception) {
            android.util.Log.e("MainActivity", "Критическая ошибка при инициализации", e)
            // Показываем пользователю простое сообщение об ошибке
            android.widget.Toast.makeText(this, "Ошибка запуска приложения", android.widget.Toast.LENGTH_LONG).show()
            finish()
        }
    }
    
    override fun onCreateOptionsMenu(menu: Menu): Boolean {
        menuInflater.inflate(R.menu.main_menu, menu)
        return true
    }
    
    override fun onOptionsItemSelected(item: MenuItem): Boolean {
        return when (item.itemId) {
            R.id.menu_logs -> {
                val navHostFragment = supportFragmentManager.findFragmentById(R.id.navHostFragment) as? NavHostFragment
                navHostFragment?.navController?.navigate(R.id.navigation_logs)
                true
            }
            R.id.menu_apps -> {
                val navHostFragment = supportFragmentManager.findFragmentById(R.id.navHostFragment) as? NavHostFragment
                navHostFragment?.navController?.navigate(R.id.navigation_apps)
                AppLogger.info("app", "Открыта страница управления приложениями")
                true
            }
            R.id.menu_settings -> {
                // Открыть настройки доступа к уведомлениям
                val intent = android.content.Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
                startActivity(intent)
                AppLogger.info("app", "Открыты настройки доступа к уведомлениям")
                true
            }
            else -> super.onOptionsItemSelected(item)
        }
    }
}
