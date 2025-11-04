package com.req.notificationreader.adapter

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageButton
import android.widget.TextView
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.req.notificationreader.R
import com.req.notificationreader.databinding.ItemWalletRequisiteBinding
import com.req.notificationreader.model.Wallet

class WalletRequisiteAdapter(
    private val onEditClick: (Wallet) -> Unit,
    private val onDeleteClick: (Wallet) -> Unit
) : ListAdapter<Wallet, WalletRequisiteAdapter.WalletViewHolder>(WalletDiffCallback()) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): WalletViewHolder {
        val binding = ItemWalletRequisiteBinding.inflate(
            LayoutInflater.from(parent.context),
            parent,
            false
        )
        return WalletViewHolder(binding, onEditClick, onDeleteClick)
    }

    override fun onBindViewHolder(holder: WalletViewHolder, position: Int) {
        holder.bind(getItem(position))
    }

    class WalletViewHolder(
        private val binding: ItemWalletRequisiteBinding,
        private val onEditClick: (Wallet) -> Unit,
        private val onDeleteClick: (Wallet) -> Unit
    ) : RecyclerView.ViewHolder(binding.root) {

        fun bind(wallet: Wallet) {
            binding.walletNameText.text = wallet.name ?: "Кошелек #${wallet.id}"
            
            binding.activeBadge.visibility = if (wallet.isActive) View.VISIBLE else View.GONE
            
            binding.requisiteText.text = wallet.value
            
            if (wallet.email != null && wallet.email.isNotEmpty()) {
                binding.emailLabel.visibility = View.VISIBLE
                binding.emailContainer.visibility = View.VISIBLE
                binding.emailText.text = wallet.email
            } else {
                binding.emailLabel.visibility = View.GONE
                binding.emailContainer.visibility = View.GONE
            }
            
            if (wallet.password != null && wallet.password.isNotEmpty()) {
                binding.passwordLabel.visibility = View.VISIBLE
                binding.passwordContainer.visibility = View.VISIBLE
                binding.passwordText.text = "••••••••"
            } else {
                binding.passwordLabel.visibility = View.GONE
                binding.passwordContainer.visibility = View.GONE
            }
            
            binding.editButton.setOnClickListener { onEditClick(wallet) }
            binding.deleteButton.setOnClickListener { onDeleteClick(wallet) }
        }
    }

    class WalletDiffCallback : DiffUtil.ItemCallback<Wallet>() {
        override fun areItemsTheSame(oldItem: Wallet, newItem: Wallet): Boolean {
            return oldItem.id == newItem.id
        }

        override fun areContentsTheSame(oldItem: Wallet, newItem: Wallet): Boolean {
            return oldItem == newItem
        }
    }
}

