package com.req.notificationreader.adapter

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.req.notificationreader.databinding.ItemPaymentBinding
import com.req.notificationreader.model.PaymentNotification
import java.text.SimpleDateFormat
import java.util.*

class PaymentAdapter(
    private val onItemClick: ((PaymentNotification) -> Unit)? = null
) : ListAdapter<PaymentNotification, PaymentAdapter.PaymentViewHolder>(DiffCallback()) {
    
    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): PaymentViewHolder {
        return try {
            val binding = ItemPaymentBinding.inflate(
                LayoutInflater.from(parent.context),
                parent,
                false
            )
            PaymentViewHolder(binding, onItemClick)
        } catch (e: Exception) {
            android.util.Log.e("PaymentAdapter", "КРИТИЧЕСКАЯ ошибка создания ViewHolder", e)
            e.printStackTrace()
            // Перебрасываем исключение с более понятным сообщением
            throw RuntimeException("Не удалось создать элемент списка. Проверьте layout файл item_payment.xml", e)
        }
    }
    
    override fun onBindViewHolder(holder: PaymentViewHolder, position: Int) {
        holder.bind(getItem(position))
    }
    
    class PaymentViewHolder(
        private val binding: ItemPaymentBinding,
        private val onItemClick: ((PaymentNotification) -> Unit)? = null
    ) : RecyclerView.ViewHolder(binding.root) {
        
        fun bind(payment: PaymentNotification) {
            // Делаем весь элемент кликабельным
            binding.root.setOnClickListener {
                onItemClick?.invoke(payment)
            }
            try {
                binding.bankNameText.text = payment.bankName ?: "Неизвестно"
                
                // Форматируем сумму с валютой
                val currencySymbol = when (payment.currency) {
                    "KGS" -> "сом"
                    "USD" -> "$"
                    "EUR" -> "€"
                    "RUB" -> "₽"
                    else -> payment.currency ?: "сом"
                }
                binding.amountText.text = String.format("%.2f %s", payment.amount, currencySymbol)
                
                try {
                    val dateFormat = SimpleDateFormat("dd.MM.yyyy HH:mm", Locale.getDefault())
                    binding.dateText.text = dateFormat.format(Date(payment.transactionDate))
                } catch (e: Exception) {
                    binding.dateText.text = "Дата неизвестна"
                }
                
                // Отображаем номер карты или счета если есть
                val cardInfo = payment.cardNumber?.let { "****$it" } 
                    ?: payment.accountNumber?.let { "Счет: $it" }
                    ?: "Не указано"
                
                binding.cardNumberText.text = cardInfo
                
                // Показываем package name для клонированных приложений
                if (payment.packageName.contains(".clone")) {
                    binding.packageNameText.text = "Клонированное приложение"
                    binding.packageNameText.visibility = android.view.View.VISIBLE
                } else {
                    binding.packageNameText.visibility = android.view.View.GONE
                }
            } catch (e: Exception) {
                android.util.Log.e("PaymentAdapter", "Ошибка при привязке данных", e)
            }
        }
    }
    
    class DiffCallback : DiffUtil.ItemCallback<PaymentNotification>() {
        override fun areItemsTheSame(
            oldItem: PaymentNotification,
            newItem: PaymentNotification
        ): Boolean = oldItem.id == newItem.id
        
        override fun areContentsTheSame(
            oldItem: PaymentNotification,
            newItem: PaymentNotification
        ): Boolean = oldItem == newItem
    }
}

