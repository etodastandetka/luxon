package com.req.notificationreader.ui.apps

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.req.notificationreader.adapter.AppAdapter
import com.req.notificationreader.adapter.AppInfoItem
import com.req.notificationreader.database.AppDatabase
import com.req.notificationreader.databinding.FragmentAppsBinding
import com.req.notificationreader.util.AppInfoHelper
import com.req.notificationreader.util.SharedPreferencesHelper
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class AppsManagementFragment : Fragment() {
    
    private var _binding: FragmentAppsBinding? = null
    private val binding get() = _binding!!
    
    private lateinit var database: AppDatabase
    private lateinit var prefsHelper: SharedPreferencesHelper
    private lateinit var adapter: AppAdapter
    
    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        _binding = FragmentAppsBinding.inflate(inflater, container, false)
        return binding.root
    }
    
    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        
        if (_binding == null) return
        
        try {
            database = AppDatabase.getDatabase(requireContext())
            prefsHelper = SharedPreferencesHelper(requireContext())
            setupRecyclerView()
            observeNotifications()
        } catch (e: Exception) {
            android.util.Log.e("AppsManagementFragment", "Ошибка инициализации", e)
            Toast.makeText(context, "Ошибка: ${e.message}", Toast.LENGTH_LONG).show()
        }
    }
    
    override fun onResume() {
        super.onResume()
        // Обновляем список при возврате на экран (только если view еще существует)
        if (_binding != null && isAdded) {
            refreshAppList()
        }
    }
    
    private fun setupRecyclerView() {
        if (_binding == null || !isAdded) return
        
        adapter = AppAdapter(
            onToggle = { packageName, isEnabled ->
                if (!isAdded || _binding == null) return@AppAdapter
                
                try {
                    if (isEnabled) {
                        prefsHelper.enableApp(packageName)
                        Toast.makeText(requireContext(), "Приложение включено", Toast.LENGTH_SHORT).show()
                    } else {
                        prefsHelper.disableApp(packageName)
                        Toast.makeText(requireContext(), "Приложение отключено", Toast.LENGTH_SHORT).show()
                    }
                    // Обновляем список после изменения состояния
                    refreshAppList()
                } catch (e: Exception) {
                    android.util.Log.e("AppsManagementFragment", "Ошибка переключения приложения", e)
                }
            },
            onItemClick = { packageName ->
                if (isAdded && _binding != null) {
                    showAppDetails(packageName)
                }
            }
        )
        
        binding.recyclerView.layoutManager = LinearLayoutManager(requireContext())
        binding.recyclerView.adapter = adapter
    }
    
    private fun refreshAppList() {
        if (!isAdded || _binding == null || !::database.isInitialized) return
        
        lifecycleScope.launch {
            try {
                if (!isAdded || _binding == null) return@launch
                
                // Получаем текущий список package names
                val packageNames = database.notificationHistoryDao().getDistinctPackages().first()
                if (packageNames.isNotEmpty() && isAdded && _binding != null) {
                    loadAppInfoList(packageNames)
                }
            } catch (e: Exception) {
                android.util.Log.e("AppsManagementFragment", "Ошибка обновления списка", e)
            }
        }
    }
    
    private fun observeNotifications() {
        if (!::database.isInitialized) return
        
        lifecycleScope.launch {
            try {
                database.notificationHistoryDao().getDistinctPackages().collectLatest { packageNames ->
                    if (!isAdded || _binding == null) return@collectLatest
                    
                    if (packageNames.isEmpty()) {
                        binding.emptyStateText.visibility = View.VISIBLE
                        binding.recyclerView.visibility = View.GONE
                        if (::adapter.isInitialized) {
                            adapter.submitList(emptyList())
                        }
                    } else {
                        binding.emptyStateText.visibility = View.GONE
                        binding.recyclerView.visibility = View.VISIBLE
                        
                        // Загружаем информацию о каждом приложении
                        if (isAdded && _binding != null) {
                            loadAppInfoList(packageNames)
                        }
                    }
                }
            } catch (e: Exception) {
                android.util.Log.e("AppsManagementFragment", "Ошибка загрузки приложений", e)
            }
        }
    }
    
    private suspend fun loadAppInfoList(packageNames: List<String>) {
        withContext(Dispatchers.IO) {
            try {
                val appInfoList = mutableListOf<AppInfoItem>()
                val disabledApps = if (::prefsHelper.isInitialized) {
                    prefsHelper.getDisabledApps()
                } else {
                    emptySet()
                }
                
                val context = try {
                    requireContext()
                } catch (e: Exception) {
                    android.util.Log.e("AppsManagementFragment", "Контекст недоступен", e)
                    return@withContext
                }
                
                for (packageName in packageNames) {
                    try {
                        // Получаем информацию о приложении
                        val appInfo = AppInfoHelper.getAppInfo(context, packageName)
                        
                        // Получаем количество уведомлений
                        val notificationCount = if (::database.isInitialized) {
                            try {
                                database.notificationHistoryDao().getNotificationCountByPackage(packageName)
                            } catch (e: Exception) {
                                android.util.Log.e("AppsManagementFragment", "Ошибка получения количества уведомлений для $packageName", e)
                                0
                            }
                        } else {
                            0
                        }
                        
                        val isEnabled = !disabledApps.contains(packageName)
                        
                        appInfoList.add(
                            AppInfoItem(
                                packageName = packageName,
                                appName = appInfo.name,
                                icon = appInfo.icon,
                                notificationCount = notificationCount,
                                isEnabled = isEnabled
                            )
                        )
                    } catch (e: Exception) {
                        android.util.Log.e("AppsManagementFragment", "Ошибка загрузки информации о приложении $packageName", e)
                    }
                }
                
                // Сортируем по количеству уведомлений (от большего к меньшему)
                appInfoList.sortByDescending { it.notificationCount }
                
                withContext(Dispatchers.Main) {
                    if (isAdded && _binding != null && ::adapter.isInitialized) {
                        adapter.submitList(appInfoList)
                    }
                }
            } catch (e: Exception) {
                android.util.Log.e("AppsManagementFragment", "Ошибка загрузки списка приложений", e)
            }
        }
    }
    
    private fun showAppDetails(packageName: String) {
        if (!isAdded || _binding == null || !::database.isInitialized) return
        
        lifecycleScope.launch {
            try {
                if (!isAdded || _binding == null) return@launch
                
                val context = requireContext()
                val notificationsFlow = database.notificationHistoryDao()
                    .getNotificationsByPackage(packageName)
                val notifications = notificationsFlow.first()
                
                if (!isAdded || _binding == null) return@launch
                
                if (notifications.isEmpty()) {
                    Toast.makeText(context, "Нет уведомлений от этого приложения", Toast.LENGTH_SHORT).show()
                    return@launch
                }
                
                val appName = AppInfoHelper.getAppName(context, packageName) ?: packageName
                val dateFormat = java.text.SimpleDateFormat("dd.MM.yyyy HH:mm:ss", java.util.Locale.getDefault())
                
                val details = buildString {
                    appendLine("Приложение: $appName")
                    appendLine("Package: $packageName")
                    appendLine("Всего уведомлений: ${notifications.size}")
                    appendLine("\nПоследние уведомления:\n")
                    
                    notifications.take(5).forEach { notification ->
                        appendLine("---")
                        appendLine("Дата: ${dateFormat.format(java.util.Date(notification.timestamp))}")
                        if (!notification.title.isNullOrBlank()) {
                            appendLine("Заголовок: ${notification.title}")
                        }
                        appendLine("Текст: ${notification.text}")
                        appendLine()
                    }
                    
                    if (notifications.size > 5) {
                        appendLine("... и еще ${notifications.size - 5} уведомлений")
                    }
                }
                
                if (!isAdded || _binding == null) return@launch
                
                val scrollView = android.widget.ScrollView(context)
                val textView = android.widget.TextView(context)
                textView.text = details
                textView.textSize = 14f
                textView.setPadding(32, 24, 32, 24)
                textView.setTextIsSelectable(true)
                scrollView.addView(textView)
                
                if (isAdded && _binding != null) {
                    android.app.AlertDialog.Builder(context)
                        .setTitle("Детали приложения")
                        .setView(scrollView)
                        .setPositiveButton("Закрыть", null)
                        .show()
                }
            } catch (e: Exception) {
                android.util.Log.e("AppsManagementFragment", "Ошибка показа деталей", e)
                if (isAdded && _binding != null) {
                    try {
                        Toast.makeText(requireContext(), "Ошибка: ${e.message}", Toast.LENGTH_SHORT).show()
                    } catch (e2: Exception) {
                        android.util.Log.e("AppsManagementFragment", "Ошибка показа Toast", e2)
                    }
                }
            }
        }
    }
    
    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}

