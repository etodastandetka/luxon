package com.req.notificationreader.adapter

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.req.notificationreader.databinding.ItemRequestCardBinding
import com.req.notificationreader.model.Transaction
import java.text.SimpleDateFormat
import java.util.*

class TransactionAdapter : ListAdapter<Transaction, TransactionAdapter.TransactionViewHolder>(TransactionDiffCallback()) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): TransactionViewHolder {
        val binding = ItemRequestCardBinding.inflate(
            LayoutInflater.from(parent.context),
            parent,
            false
        )
        return TransactionViewHolder(binding)
    }

    override fun onBindViewHolder(holder: TransactionViewHolder, position: Int) {
        holder.bind(getItem(position))
    }

    class TransactionViewHolder(
        private val binding: ItemRequestCardBinding
    ) : RecyclerView.ViewHolder(binding.root) {

        fun bind(transaction: Transaction) {
            binding.userNameText.text = transaction.user_display_name
            binding.userNameText2.text = "ID: ${transaction.user_id}"
            
            // Форматирование суммы
            val amountText = "${if (transaction.type == "deposit") "+" else "-"}${String.format(Locale("ru", "RU"), "%.2f", transaction.amount).replace(".", ",")}"
            binding.amountText.text = amountText
            binding.amountText.setTextColor(
                if (transaction.type == "deposit") 0xFF22C55E.toInt() else 0xFFEF4444.toInt()
            )
            
            // Дата
            val dateFormat = SimpleDateFormat("dd.MM.yyyy • HH:mm", Locale("ru", "RU"))
            binding.timeText.text = try {
                dateFormat.format(Date(transaction.created_at))
            } catch (e: Exception) {
                transaction.created_at
            }
            
            // Тип транзакции
            val transactionType = when {
                transaction.status == "pending" || transaction.status == "processing" -> "-"
                transaction.type == "withdraw" -> {
                    transaction.status_detail?.let { 
                        Regex("profile-\\d+").find(it)?.value ?: "profile-1"
                    } ?: "profile-1"
                }
                transaction.type == "deposit" -> {
                    when {
                        transaction.status == "autodeposit_success" || transaction.status == "auto_completed" 
                            || transaction.status_detail?.contains("autodeposit") == true -> "Авто пополнение"
                        transaction.status_detail?.let { Regex("profile-\\d+").find(it)?.value } != null -> 
                            transaction.status_detail?.let { Regex("profile-\\d+").find(it)?.value } ?: "profile-1"
                        else -> "profile-1"
                    }
                }
                else -> if (transaction.type == "deposit") "Пополнение" else "Вывод"
            }
            binding.transactionTypeText.text = transactionType
            
            // Статус
            val statusLabel = getStatusLabel(transaction.status, transaction.status_detail)
            binding.statusText.text = statusLabel.first
            
            // Цвет точки статуса
            val dotColor = when (statusLabel.first) {
                "Успешно" -> 0xFF22C55E.toInt()
                "Отклонено" -> 0xFFEF4444.toInt()
                "Отложено" -> 0xFFF97316.toInt()
                else -> 0xFFEAB308.toInt()
            }
            binding.statusDot.background = android.graphics.drawable.ColorDrawable(dotColor)
        }
        
        private fun getStatusLabel(status: String, statusDetail: String?): Pair<String, String> {
            return when {
                status == "completed" || status == "auto_completed" || status == "approved" || status == "autodeposit_success" -> 
                    Pair("Успешно", "bg-green-500")
                status == "rejected" || status == "declined" -> 
                    Pair("Отклонено", "bg-red-500")
                status == "pending" || status == "processing" -> 
                    Pair("Ожидает", "bg-yellow-500")
                status == "manual" || status == "awaiting_manual" || statusDetail == "manual" -> 
                    Pair("Ручная", "bg-red-500")
                status == "deferred" -> 
                    Pair("Отложено", "bg-orange-500")
                else -> Pair(status, "bg-gray-700")
            }
        }
    }

    class TransactionDiffCallback : DiffUtil.ItemCallback<Transaction>() {
        override fun areItemsTheSame(oldItem: Transaction, newItem: Transaction): Boolean {
            return oldItem.id == newItem.id
        }

        override fun areContentsTheSame(oldItem: Transaction, newItem: Transaction): Boolean {
            return oldItem == newItem
        }
    }
}

