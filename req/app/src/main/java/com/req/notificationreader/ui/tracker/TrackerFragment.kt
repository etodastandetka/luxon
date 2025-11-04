package com.req.notificationreader.ui.tracker

import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.req.notificationreader.adapter.PaymentAdapter
import com.req.notificationreader.database.AppDatabase
import com.req.notificationreader.databinding.FragmentTrackerBinding
import com.req.notificationreader.model.PaymentNotification
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch

class TrackerFragment : Fragment() {
    
    private var _binding: FragmentTrackerBinding? = null
    private val binding get() = _binding!!
    
    private lateinit var database: AppDatabase
    private lateinit var adapter: PaymentAdapter
    
    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        return try {
            _binding = FragmentTrackerBinding.inflate(inflater, container, false)
            binding.root
        } catch (e: Exception) {
            android.util.Log.e("TrackerFragment", "Ошибка создания view", e)
            null
        }
    }
    
    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        
        if (_binding == null) return
        
        try {
            database = AppDatabase.getDatabase(requireContext())
            setupRecyclerView()
            checkNotificationPermission()
            observePayments()
        } catch (e: Exception) {
            android.util.Log.e("TrackerFragment", "Ошибка инициализации", e)
            Toast.makeText(context, "Ошибка: ${e.message}", Toast.LENGTH_LONG).show()
        }
    }
    
    private fun setupRecyclerView() {
        adapter = PaymentAdapter { payment ->
            showNotificationDetails(payment)
        }
        binding.recyclerView.layoutManager = LinearLayoutManager(requireContext())
        binding.recyclerView.adapter = adapter
    }
    
    private fun showNotificationDetails(payment: PaymentNotification) {
        val dateFormat = java.text.SimpleDateFormat("dd.MM.yyyy HH:mm:ss", java.util.Locale.getDefault())
        val formattedDate = dateFormat.format(java.util.Date(payment.transactionDate))
        
        val details = buildString {
            append("Приложение: ${payment.packageName}\n")
            append("Банк: ${payment.bankName}\n")
            append("Дата: $formattedDate\n")
            append("Сумма: ${payment.amount} ${payment.currency}\n\n")
            append("Полный текст уведомления:\n\n")
            append(payment.rawText)
        }
        
        val scrollView = android.widget.ScrollView(requireContext())
        val textView = android.widget.TextView(requireContext())
        textView.text = details
        textView.textSize = 14f
        textView.setPadding(32, 24, 32, 24)
        textView.setTextIsSelectable(true)
        scrollView.addView(textView)
        
        android.app.AlertDialog.Builder(requireContext())
            .setTitle("Детали уведомления")
            .setView(scrollView)
            .setPositiveButton("Закрыть", null)
            .show()
    }
    
    private fun checkNotificationPermission() {
        if (!isNotificationServiceEnabled()) {
            android.app.AlertDialog.Builder(requireContext())
                .setTitle("Требуется разрешение")
                .setMessage("Для работы приложения необходимо разрешить доступ к уведомлениям.")
                .setPositiveButton("Открыть настройки") { _, _ ->
                    val intent = Intent(android.provider.Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
                    startActivity(intent)
                }
                .setNegativeButton("Отмена", null)
                .show()
        }
    }
    
    private fun isNotificationServiceEnabled(): Boolean {
        val pkgName = requireContext().packageName
        val flat = android.provider.Settings.Secure.getString(
            requireContext().contentResolver,
            "enabled_notification_listeners"
        )
        return flat?.contains(pkgName) == true
    }
    
    private fun observePayments() {
        lifecycleScope.launch {
            try {
                if (!isAdded) return@launch
                database.paymentDao().getAllPayments().collectLatest { payments ->
                    if (!isAdded || isDetached || _binding == null) return@collectLatest
                    
                    try {
                        val sortedPayments = payments.sortedByDescending { it.transactionDate }
                        
                        if (sortedPayments.isEmpty()) {
                            binding.emptyStateText.visibility = View.VISIBLE
                            binding.recyclerView.visibility = View.GONE
                            binding.totalAmountText.text = "0.00 сом"
                        } else {
                            binding.emptyStateText.visibility = View.GONE
                            binding.recyclerView.visibility = View.VISIBLE
                            adapter.submitList(sortedPayments)
                            updateTotalAmount(sortedPayments)
                        }
                    } catch (e: Exception) {
                        android.util.Log.e("TrackerFragment", "Ошибка обработки платежей", e)
                    }
                }
            } catch (e: Exception) {
                android.util.Log.e("TrackerFragment", "Ошибка наблюдения за платежами", e)
            }
        }
    }
    
    private fun updateTotalAmount(payments: List<PaymentNotification>) {
        try {
            if (!isAdded || _binding == null) return
            val total = payments.fold(0.0) { acc, payment -> acc + payment.amount }
            binding.totalAmountText.text = String.format("%.2f сом", total)
        } catch (e: Exception) {
            android.util.Log.e("TrackerFragment", "Ошибка обновления суммы", e)
        }
    }
    
    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}

