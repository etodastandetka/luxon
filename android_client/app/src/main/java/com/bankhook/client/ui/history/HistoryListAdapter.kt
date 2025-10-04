package com.bankhook.client.ui.history

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.bankhook.client.data.local.TransactionEntity
import com.bankhook.client.databinding.ItemHistoryBinding
import java.util.Locale

class HistoryListAdapter : ListAdapter<TransactionEntity, HistoryListAdapter.VH>(DIFF) {
    companion object {
        private val DIFF = object : DiffUtil.ItemCallback<TransactionEntity>() {
            override fun areItemsTheSame(oldItem: TransactionEntity, newItem: TransactionEntity) = oldItem.id == newItem.id
            override fun areContentsTheSame(oldItem: TransactionEntity, newItem: TransactionEntity) = oldItem == newItem
        }
    }

    class VH(val binding: ItemHistoryBinding) : RecyclerView.ViewHolder(binding.root)

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): VH {
        val binding = ItemHistoryBinding.inflate(LayoutInflater.from(parent.context), parent, false)
        return VH(binding)
    }

    override fun onBindViewHolder(holder: VH, position: Int) {
        val item = getItem(position)
        holder.binding.bank.text = item.bank
        holder.binding.amount.text = String.format("%.2f", item.amount)
        holder.binding.time.text = item.timestampIso.replace('T', ' ')
        holder.binding.status.text = when (item.status) {
            "sent" -> "✅ Успешно"
            "error" -> "❌ Ошибка"
            else -> "⏳ Отправка"
        }

        // Set bank icon. Expected drawable names: mbank, optima, demirbank, balancekg, megapay, bakai, elqr
        val ctx = holder.binding.root.context
        val iconName = when (item.bank.lowercase(Locale.getDefault())) {
            "mbank", "m-bank", "m bank" -> "mbank"
            "optima", "optima bank" -> "optima"
            "demirbank", "demir" -> "demirbank"
            "balance.kg", "balance", "balancekg" -> "balancekg"
            "megapay", "mega pay" -> "megapay"
            "bakai", "bakai bank" -> "elqr" // per request use elqr icon for Bakai
            else -> "mbank"
        }
        val resId = ctx.resources.getIdentifier(iconName, "drawable", ctx.packageName)
        if (resId != 0) {
            holder.binding.icon.setImageResource(resId)
        } else {
            // fallback to mipmap launcher if not found
            val mipId = ctx.resources.getIdentifier("ic_launcher", "mipmap", ctx.packageName)
            if (mipId != 0) holder.binding.icon.setImageResource(mipId)
        }
    }
}
