package com.bankhook.client.ui.main

import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.bankhook.client.data.local.AppDatabase
import com.bankhook.client.databinding.FragmentMainBinding
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class MainFragment : Fragment() {
    private var _binding: FragmentMainBinding? = null
    private val binding get() = _binding!!

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentMainBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        val prefs = EncryptedSharedPreferences.create(
            requireContext(),
            "secure_prefs",
            MasterKey.Builder(requireContext()).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build(),
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )

        binding.inputApiBase.setText(prefs.getString("apiBase", "https://example.com"))
        binding.inputApiToken.setText(prefs.getString("apiToken", ""))
        binding.switchSending.isChecked = prefs.getBoolean("sendingEnabled", true)

        binding.btnSave.setOnClickListener {
            prefs.edit()
                .putString("apiBase", binding.inputApiBase.text?.toString()?.trim())
                .putString("apiToken", binding.inputApiToken.text?.toString()?.trim())
                .putBoolean("sendingEnabled", binding.switchSending.isChecked)
                .apply()
        }

        binding.btnNotifAccess.setOnClickListener {
            startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
        }

        // Simple stats
        CoroutineScope(Dispatchers.IO).launch {
            val dao = AppDatabase.get(requireContext()).txDao()
            // We could compute counts if needed in DAO; here is a simple count via list size
            // This is just a quick UI informational fetch
            // Not observing continuously on purpose
            val total = dao.observeAll()
            // skip; leave blank to avoid heavy collection here
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
