package com.req.notificationreader.adapter

import android.graphics.drawable.Drawable
import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.req.notificationreader.databinding.ItemAppBinding

data class AppInfoItem(
    val packageName: String,
    val appName: String?,
    val icon: Drawable?,
    val notificationCount: Int,
    val isEnabled: Boolean
)

class AppAdapter(
    private val onToggle: (String, Boolean) -> Unit,
    private val onItemClick: ((String) -> Unit)? = null
) : ListAdapter<AppInfoItem, AppAdapter.AppViewHolder>(DiffCallback()) {
    
    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): AppViewHolder {
        val binding = ItemAppBinding.inflate(
            LayoutInflater.from(parent.context),
            parent,
            false
        )
        return AppViewHolder(binding, onToggle, onItemClick)
    }
    
    override fun onBindViewHolder(holder: AppViewHolder, position: Int) {
        try {
            if (position >= 0 && position < itemCount) {
                holder.bind(getItem(position))
            }
        } catch (e: Exception) {
            android.util.Log.e("AppAdapter", "Ошибка привязки ViewHolder", e)
        }
    }
    
    class AppViewHolder(
        private val binding: ItemAppBinding,
        private val onToggle: (String, Boolean) -> Unit,
        private val onItemClick: ((String) -> Unit)? = null
    ) : RecyclerView.ViewHolder(binding.root) {
        
        fun bind(appInfo: AppInfoItem) {
            try {
                binding.appNameText.text = appInfo.appName ?: appInfo.packageName
                binding.packageNameText.text = appInfo.packageName
                
                // Устанавливаем иконку
                try {
                    if (appInfo.icon != null) {
                        binding.appIcon.setImageDrawable(appInfo.icon)
                    } else {
                        binding.appIcon.setImageResource(android.R.drawable.ic_dialog_info)
                    }
                } catch (e: Exception) {
                    android.util.Log.e("AppAdapter", "Ошибка установки иконки", e)
                    binding.appIcon.setImageResource(android.R.drawable.ic_dialog_info)
                }
                
                // Устанавливаем количество уведомлений
                val countText = when {
                    appInfo.notificationCount < 0 -> "Нет уведомлений"
                    appInfo.notificationCount == 0 -> "Нет уведомлений"
                    appInfo.notificationCount == 1 -> "1 уведомление"
                    appInfo.notificationCount in 2..4 -> "${appInfo.notificationCount} уведомления"
                    else -> "${appInfo.notificationCount} уведомлений"
                }
                binding.notificationCountText.text = countText
                
                // Устанавливаем состояние переключателя (сначала убираем listener, чтобы избежать двойного срабатывания)
                binding.appToggleSwitch.setOnCheckedChangeListener(null)
                binding.appToggleSwitch.isChecked = appInfo.isEnabled
                
                // Обработчик переключения
                binding.appToggleSwitch.setOnCheckedChangeListener { _, isChecked ->
                    try {
                        onToggle(appInfo.packageName, isChecked)
                    } catch (e: Exception) {
                        android.util.Log.e("AppAdapter", "Ошибка в обработчике переключения", e)
                    }
                }
                
                // Обработчик клика на весь элемент
                binding.root.setOnClickListener {
                    try {
                        onItemClick?.invoke(appInfo.packageName)
                    } catch (e: Exception) {
                        android.util.Log.e("AppAdapter", "Ошибка в обработчике клика", e)
                    }
                }
            } catch (e: Exception) {
                android.util.Log.e("AppAdapter", "Ошибка привязки данных", e)
            }
        }
    }
    
    class DiffCallback : DiffUtil.ItemCallback<AppInfoItem>() {
        override fun areItemsTheSame(
            oldItem: AppInfoItem,
            newItem: AppInfoItem
        ): Boolean = oldItem.packageName == newItem.packageName
        
        override fun areContentsTheSame(
            oldItem: AppInfoItem,
            newItem: AppInfoItem
        ): Boolean = oldItem == newItem
    }
}

