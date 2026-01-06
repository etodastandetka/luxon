package com.req.notificationreader.ui.logs

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.os.Bundle
import android.view.LayoutInflater
import android.view.Menu
import android.view.MenuItem
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.appcompat.widget.SearchView
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import com.req.notificationreader.R
import com.req.notificationreader.adapter.LogAdapter
import com.req.notificationreader.database.AppDatabase
import com.req.notificationreader.databinding.FragmentLogsBinding
import com.req.notificationreader.model.AppLog
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*

class LogsFragment : Fragment() {
    
    private var _binding: FragmentLogsBinding? = null
    private val binding get() = _binding!!
    
    private lateinit var database: AppDatabase
    private lateinit var adapter: LogAdapter
    private var currentFilter: LogFilter = LogFilter.ALL
    
    private enum class LogFilter {
        ALL, INFO, WARNING, ERROR, SUCCESS, PAYMENT, DATABASE, NOTIFICATION, PARSING
    }
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setHasOptionsMenu(true)
    }
    
    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        _binding = FragmentLogsBinding.inflate(inflater, container, false)
        return binding.root
    }
    
    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        
        if (_binding == null) return
        
        try {
            database = AppDatabase.getDatabase(requireContext())
            setupRecyclerView()
            observeLogs()
        } catch (e: Exception) {
            android.util.Log.e("LogsFragment", "Ошибка инициализации", e)
        }
    }
    
    override fun onPrepareOptionsMenu(menu: Menu) {
        super.onPrepareOptionsMenu(menu)
        menu.clear()
        requireActivity().menuInflater.inflate(R.menu.logs_menu, menu)
        
        // Настройка SearchView
        val searchItem = menu.findItem(R.id.action_search)
        val searchView = searchItem.actionView as? SearchView
        searchView?.setOnQueryTextListener(object : SearchView.OnQueryTextListener {
            override fun onQueryTextSubmit(query: String?): Boolean {
                return false
            }
            
            override fun onQueryTextChange(newText: String?): Boolean {
                if (newText.isNullOrBlank()) {
                    applyFilter(currentFilter)
                } else {
                    searchLogs(newText)
                }
                return true
            }
        })
    }
    
    override fun onOptionsItemSelected(item: MenuItem): Boolean {
        return when (item.itemId) {
            R.id.action_filter_all -> {
                applyFilter(LogFilter.ALL)
                true
            }
            R.id.action_filter_errors -> {
                applyFilter(LogFilter.ERROR)
                true
            }
            R.id.action_filter_payments -> {
                applyFilter(LogFilter.PAYMENT)
                true
            }
            R.id.action_copy_all -> {
                copyAllLogs()
                true
            }
            R.id.action_clear_logs -> {
                clearLogs()
                true
            }
            else -> super.onOptionsItemSelected(item)
        }
    }
    
    private fun setupRecyclerView() {
        adapter = LogAdapter(
            onLogClick = { log -> showLogDetails(log) },
            onLongClick = { log -> copyLogToClipboard(log); true }
        )
        
        binding.logsRecyclerView.layoutManager = LinearLayoutManager(requireContext())
        binding.logsRecyclerView.adapter = adapter
    }
    
    private fun observeLogs() {
        applyFilter(currentFilter)
    }
    
    private fun applyFilter(filter: LogFilter) {
        currentFilter = filter
        
        lifecycleScope.launch {
            try {
                val logDao = database.logDao()
                val flow = when (filter) {
                    LogFilter.ALL -> logDao.getAllLogs()
                    LogFilter.INFO -> logDao.getLogsByLevel(AppLog.LogLevel.INFO)
                    LogFilter.WARNING -> logDao.getLogsByLevel(AppLog.LogLevel.WARNING)
                    LogFilter.ERROR -> logDao.getLogsByLevel(AppLog.LogLevel.ERROR)
                    LogFilter.SUCCESS -> logDao.getLogsByLevel(AppLog.LogLevel.SUCCESS)
                    LogFilter.PAYMENT -> logDao.getLogsByCategory("payment")
                    LogFilter.DATABASE -> logDao.getLogsByCategory("database")
                    LogFilter.NOTIFICATION -> logDao.getLogsByCategory("notification")
                    LogFilter.PARSING -> logDao.getLogsByCategory("parsing")
                }
                
                flow.collectLatest { logs ->
                    adapter.submitList(logs)
                    binding.emptyState.visibility = if (logs.isEmpty()) View.VISIBLE else View.GONE
                }
            } catch (e: Exception) {
                android.util.Log.e("LogsFragment", "Ошибка загрузки логов", e)
            }
        }
    }
    
    private fun searchLogs(query: String) {
        lifecycleScope.launch {
            try {
                database.logDao().searchLogs(query).collectLatest { logs ->
                    adapter.submitList(logs)
                    binding.emptyState.visibility = if (logs.isEmpty()) View.VISIBLE else View.GONE
                }
            } catch (e: Exception) {
                android.util.Log.e("LogsFragment", "Ошибка поиска", e)
            }
        }
    }
    
    private fun showLogDetails(log: AppLog) {
        val dateFormat = SimpleDateFormat("dd.MM.yyyy HH:mm:ss.SSS", Locale.getDefault())
        val fullText = buildString {
            appendLine("Дата: ${dateFormat.format(Date(log.timestamp))}")
            appendLine("Уровень: ${log.level}")
            appendLine("Категория: ${log.category}")
            appendLine("Сообщение: ${log.message}")
            if (!log.details.isNullOrBlank()) {
                appendLine("\nДетали:")
                appendLine(log.details)
            }
        }
        
        MaterialAlertDialogBuilder(requireContext())
            .setTitle("Детали лога")
            .setMessage(fullText)
            .setPositiveButton("Копировать") { _, _ -> copyTextToClipboard(fullText) }
            .setNegativeButton("Закрыть", null)
            .show()
    }
    
    private fun copyLogToClipboard(log: AppLog) {
        val dateFormat = SimpleDateFormat("dd.MM.yyyy HH:mm:ss", Locale.getDefault())
        val text = buildString {
            append("[${log.level}] ")
            append("${dateFormat.format(Date(log.timestamp))} ")
            append("[${log.category}] ")
            append(log.message)
            if (!log.details.isNullOrBlank()) {
                append("\n${log.details}")
            }
        }
        copyTextToClipboard(text)
        Toast.makeText(requireContext(), "Лог скопирован", Toast.LENGTH_SHORT).show()
    }
    
    private fun copyAllLogs() {
        lifecycleScope.launch {
            try {
                val logs = adapter.currentList
                if (logs.isEmpty()) {
                    Toast.makeText(requireContext(), "Нет логов для копирования", Toast.LENGTH_SHORT).show()
                    return@launch
                }
                
                val dateFormat = SimpleDateFormat("dd.MM.yyyy HH:mm:ss", Locale.getDefault())
                val text = buildString {
                    appendLine("=== ЛОГИ ПРИЛОЖЕНИЯ LUXON ===")
                    appendLine("Всего записей: ${logs.size}")
                    appendLine()
                    logs.forEach { log ->
                        appendLine("[${log.level}] ${dateFormat.format(Date(log.timestamp))} [${log.category}] ${log.message}")
                        if (!log.details.isNullOrBlank()) {
                            appendLine("  ${log.details}")
                        }
                        appendLine()
                    }
                }
                
                copyTextToClipboard(text)
                Toast.makeText(requireContext(), "Все логи скопированы (${logs.size} записей)", Toast.LENGTH_LONG).show()
            } catch (e: Exception) {
                Toast.makeText(requireContext(), "Ошибка копирования: ${e.message}", Toast.LENGTH_SHORT).show()
            }
        }
    }
    
    private fun copyTextToClipboard(text: String) {
        val clipboard = requireContext().getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        val clip = ClipData.newPlainText("Log", text)
        clipboard.setPrimaryClip(clip)
    }
    
    private fun clearLogs() {
        MaterialAlertDialogBuilder(requireContext())
            .setTitle("Очистить логи?")
            .setMessage("Все логи будут удалены. Это действие нельзя отменить.")
            .setPositiveButton("Удалить") { _, _ ->
                lifecycleScope.launch {
                    try {
                        database.logDao().deleteAllLogs()
                        Toast.makeText(requireContext(), "Логи очищены", Toast.LENGTH_SHORT).show()
                    } catch (e: Exception) {
                        Toast.makeText(requireContext(), "Ошибка: ${e.message}", Toast.LENGTH_SHORT).show()
                    }
                }
            }
            .setNegativeButton("Отмена", null)
            .show()
    }
    
    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}

