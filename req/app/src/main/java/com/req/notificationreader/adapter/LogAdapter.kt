package com.req.notificationreader.adapter

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.req.notificationreader.R
import com.req.notificationreader.model.AppLog
import java.text.SimpleDateFormat
import java.util.*

class LogAdapter(
    private val onLogClick: (AppLog) -> Unit,
    private val onLongClick: (AppLog) -> Boolean
) : ListAdapter<AppLog, LogAdapter.LogViewHolder>(LogDiffCallback()) {
    
    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): LogViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_log, parent, false)
        return LogViewHolder(view, onLogClick, onLongClick)
    }
    
    override fun onBindViewHolder(holder: LogViewHolder, position: Int) {
        holder.bind(getItem(position))
    }
    
    class LogViewHolder(
        itemView: View,
        private val onLogClick: (AppLog) -> Unit,
        private val onLongClick: (AppLog) -> Boolean
    ) : RecyclerView.ViewHolder(itemView) {
        
        private val timestampView: TextView = itemView.findViewById(R.id.logTimestamp)
        private val levelView: TextView = itemView.findViewById(R.id.logLevel)
        private val categoryView: TextView = itemView.findViewById(R.id.logCategory)
        private val messageView: TextView = itemView.findViewById(R.id.logMessage)
        private val detailsView: TextView = itemView.findViewById(R.id.logDetails)
        
        private val dateFormat = SimpleDateFormat("dd.MM.yyyy HH:mm:ss", Locale.getDefault())
        
        fun bind(log: AppLog) {
            timestampView.text = dateFormat.format(Date(log.timestamp))
            levelView.text = when (log.level) {
                AppLog.LogLevel.INFO -> "INFO"
                AppLog.LogLevel.WARNING -> "WARN"
                AppLog.LogLevel.ERROR -> "ERROR"
                AppLog.LogLevel.SUCCESS -> "OK"
            }
            categoryView.text = log.category
            messageView.text = log.message
            
            // Показываем детали если есть
            if (!log.details.isNullOrBlank()) {
                detailsView.visibility = View.VISIBLE
                detailsView.text = log.details
            } else {
                detailsView.visibility = View.GONE
            }
            
            // Цвет в зависимости от уровня
            val colorRes = when (log.level) {
                AppLog.LogLevel.INFO -> android.R.color.darker_gray
                AppLog.LogLevel.WARNING -> android.R.color.holo_orange_dark
                AppLog.LogLevel.ERROR -> android.R.color.holo_red_dark
                AppLog.LogLevel.SUCCESS -> android.R.color.holo_green_dark
            }
            levelView.setTextColor(ContextCompat.getColor(itemView.context, colorRes))
            
            itemView.setOnClickListener { onLogClick(log) }
            itemView.setOnLongClickListener { onLongClick(log) }
        }
    }
    
    class LogDiffCallback : DiffUtil.ItemCallback<AppLog>() {
        override fun areItemsTheSame(oldItem: AppLog, newItem: AppLog): Boolean {
            return oldItem.id == newItem.id
        }
        
        override fun areContentsTheSame(oldItem: AppLog, newItem: AppLog): Boolean {
            return oldItem == newItem
        }
    }
}

