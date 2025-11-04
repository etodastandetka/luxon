package com.req.notificationreader.adapter

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.req.notificationreader.R
import com.req.notificationreader.databinding.ItemWalletCardBinding

data class WalletCard(
    val id: String,
    val name: String,
    val type: String,
    val balance: Double,
    val change: Double,
    val icon: String = ""
)

class WalletCardAdapter(
    private val wallets: List<WalletCard>,
    private val onItemClick: (WalletCard) -> Unit
) : RecyclerView.Adapter<WalletCardAdapter.WalletViewHolder>() {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): WalletViewHolder {
        val binding = ItemWalletCardBinding.inflate(
            LayoutInflater.from(parent.context),
            parent,
            false
        )
        return WalletViewHolder(binding)
    }

    override fun onBindViewHolder(holder: WalletViewHolder, position: Int) {
        holder.bind(wallets[position])
    }

    override fun getItemCount(): Int = wallets.size

    inner class WalletViewHolder(
        private val binding: ItemWalletCardBinding
    ) : RecyclerView.ViewHolder(binding.root) {

        fun bind(wallet: WalletCard) {
            binding.walletNameText.text = wallet.name
            binding.walletTypeText.text = wallet.type
            binding.walletBalanceText.text = String.format("%.2f сом", wallet.balance)
            
            val changeText = if (wallet.change >= 0) {
                "+${String.format("%.2f", wallet.change)}%"
            } else {
                "${String.format("%.2f", wallet.change)}%"
            }
            binding.walletChangeText.text = changeText
            binding.walletChangeText.setTextColor(
                if (wallet.change >= 0) {
                    binding.root.context.getColor(android.R.color.holo_green_light)
                } else {
                    binding.root.context.getColor(android.R.color.holo_red_light)
                }
            )
            
            if (wallet.icon.isNotEmpty()) {
                binding.walletIcon.text = wallet.icon
            } else {
                binding.walletIcon.text = wallet.name.take(1).uppercase()
            }
            
            binding.root.setOnClickListener {
                onItemClick(wallet)
            }
        }
    }
}

