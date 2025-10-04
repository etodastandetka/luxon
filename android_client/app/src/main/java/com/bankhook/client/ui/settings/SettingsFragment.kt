package com.bankhook.client.ui.settings

import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import com.bankhook.client.databinding.FragmentSettingsBinding
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import android.widget.Toast

class SettingsFragment : Fragment() {
    private var _binding: FragmentSettingsBinding? = null
    private val binding get() = _binding!!

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentSettingsBinding.inflate(inflater, container, false)
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
        binding.apiBase.setText(prefs.getString("apiBase", "https://example.com"))
        binding.apiToken.setText(prefs.getString("apiToken", ""))
        binding.switchSending.isChecked = prefs.getBoolean("sendingEnabled", true)

        binding.btnSave.setOnClickListener {
            prefs.edit()
                .putString("apiBase", binding.apiBase.text?.toString()?.trim())
                .putString("apiToken", binding.apiToken.text?.toString()?.trim())
                .putBoolean("sendingEnabled", binding.switchSending.isChecked)
                .apply()
            Toast.makeText(requireContext(), "Сохранено", Toast.LENGTH_SHORT).show()
        }

        binding.btnNotifAccess.setOnClickListener {
            startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
