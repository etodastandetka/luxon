package com.req.notificationreader.adapter

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.TextView
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.req.notificationreader.R
import com.req.notificationreader.databinding.ItemRequestCardBinding
import com.req.notificationreader.model.Request
import java.text.SimpleDateFormat
import java.util.*

class RequestAdapter(
    private val onItemClick: (Request) -> Unit
) : ListAdapter<Request, RequestAdapter.RequestViewHolder>(RequestDiffCallback()) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): RequestViewHolder {
        val binding = ItemRequestCardBinding.inflate(
            LayoutInflater.from(parent.context),
            parent,
            false
        )
        return RequestViewHolder(binding, onItemClick)
    }

    override fun onBindViewHolder(holder: RequestViewHolder, position: Int) {
        holder.bind(getItem(position))
    }

    class RequestViewHolder(
        private val binding: ItemRequestCardBinding,
        private val onItemClick: (Request) -> Unit
    ) : RecyclerView.ViewHolder(binding.root) {

        fun bind(request: Request) {
            val userName = request.username
                ?.let { "@$it" }
                ?: (request.firstName?.let { first ->
                    "${first}${request.lastName?.let { " $it" } ?: ""}"
                } ?: "ID: ${request.userId}")

            binding.userNameText.text = userName
            binding.userNameText2.text = "ID: ${request.accountId ?: request.userId}"
            
            // Сумма (формат: +1 000,68 без "сом")
            binding.amountText.text = formatAmount(request)
            binding.timeText.text = formatDate(request.createdAt)
            
            // Статус (желтый бейдж с точкой)
            val statusLabel = getStatusLabel(request.status)
            binding.statusText.text = statusLabel
            binding.statusBadge.visibility = View.VISIBLE
            
            // Цвет точки в зависимости от статуса
            val dotColor = when (request.status) {
                "pending" -> android.graphics.Color.parseColor("#FF9800") // оранжевая
                "completed", "approved", "auto_completed", "autodeposit_success" -> 
                    android.graphics.Color.parseColor("#4CAF50") // зеленая
                "rejected", "declined" -> android.graphics.Color.parseColor("#F44336") // красная
                "deferred" -> android.graphics.Color.parseColor("#FF9800") // оранжевая
                else -> android.graphics.Color.parseColor("#FF9800")
            }
            binding.statusDot.background = android.graphics.drawable.ColorDrawable(dotColor)
            
            // Цвет бейджа - желтый для "pending", зеленый для успешных
            val badgeColor = when (request.status) {
                "pending" -> android.graphics.Color.parseColor("#FFC107") // желтый
                "completed", "approved", "auto_completed", "autodeposit_success" -> 
                    android.graphics.Color.parseColor("#4CAF50") // зеленый
                "rejected", "declined" -> android.graphics.Color.parseColor("#F44336") // красный
                "deferred" -> android.graphics.Color.parseColor("#FF9800") // оранжевый
                else -> android.graphics.Color.parseColor("#FFC107")
            }
            binding.statusBadge.setBackgroundColor(badgeColor)
            
            // Тип транзакции (синяя кнопка с "-")
            val transactionType = getTransactionType(request)
            binding.transactionTypeText.text = transactionType
            
            // Иконка банка (показываем дефолтную розовую/фиолетовую)
            binding.bankIcon.visibility = View.GONE
            binding.defaultIcon.visibility = View.VISIBLE
            
            binding.root.setOnClickListener {
                onItemClick(request)
            }
        }

        private fun formatAmount(request: Request): String {
            val amount = request.amount?.toDoubleOrNull() ?: 0.0
            val isDeposit = request.requestType == "deposit"
            val isDeferred = request.status == "deferred"
            val transactionType = getTransactionType(request)
            val showMinus = isDeferred && transactionType == "Авто пополнение"
            
            val sign = when {
                showMinus -> "-"
                isDeposit -> "+"
                else -> "-"
            }
            
            // Формат: +1 000,68 (с пробелами для тысяч, без "сом")
            val formattedAmount = String.format(Locale("ru", "RU"), "%.2f", amount)
                .replace(".", ",")
                .replace(Regex("(\\d)(?=(\\d{3})+(?!\\d))"), "$1 ")
            
            return "$sign$formattedAmount"
        }

        private fun formatDate(dateString: String): String {
            return try {
                val inputFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.getDefault())
                inputFormat.timeZone = TimeZone.getTimeZone("UTC")
                val date = inputFormat.parse(dateString)
                
                val outputFormat = SimpleDateFormat("dd.MM.yyyy • HH:mm", Locale.getDefault())
                outputFormat.format(date ?: Date())
            } catch (e: Exception) {
                dateString
            }
        }

        private fun getStatusLabel(status: String): String {
            return when (status) {
                "pending" -> "Ожидает"
                "completed", "approved", "auto_completed", "autodeposit_success" -> "Успешно"
                "rejected", "declined" -> "Отклонено"
                "deferred" -> "Отложено"
                "manual", "awaiting_manual" -> "Ручная"
                else -> status
            }
        }

        private fun getStatusColor(status: String): Int {
            return when (status) {
                "completed", "approved", "auto_completed", "autodeposit_success" -> 
                    android.R.color.holo_green_light
                "pending" -> android.R.color.holo_orange_light
                "rejected", "declined", "manual", "awaiting_manual" -> 
                    android.R.color.holo_red_light
                "deferred" -> android.R.color.holo_orange_dark
                else -> android.R.color.darker_gray
            }
        }

        private fun getTransactionType(request: Request): String {
            if (request.status == "pending" || request.status == "processing") {
                return "-"
            }
            
            if (request.requestType == "withdraw") {
                val match = request.status_detail?.let { Regex("profile-\\d+").find(it) }
                return match?.value ?: "profile-1"
            }
            
            if (request.requestType == "deposit") {
                if (request.status == "autodeposit_success" || 
                    request.status == "auto_completed" || 
                    request.status_detail?.contains("autodeposit") == true) {
                    return "Авто пополнение"
                }
                
                val profileMatch = request.status_detail?.let { Regex("profile-\\d+").find(it) }
                if (profileMatch != null) {
                    return profileMatch.value
                }
                
                return "profile-1"
            }
            
            return if (request.requestType == "deposit") "Пополнение" else "Вывод"
        }

        private fun getBankImageResource(bank: String?): Int? {
            // Пока возвращаем null, так как ресурсы изображений банков не созданы
            // TODO: Добавить drawable ресурсы для банков
            return null
        }
    }

    class RequestDiffCallback : DiffUtil.ItemCallback<Request>() {
        override fun areItemsTheSame(oldItem: Request, newItem: Request): Boolean {
            return oldItem.id == newItem.id
        }

        override fun areContentsTheSame(oldItem: Request, newItem: Request): Boolean {
            return oldItem == newItem
        }
    }
}

