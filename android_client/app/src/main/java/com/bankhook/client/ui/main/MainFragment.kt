package com.bankhook.client.ui.main

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.provider.Settings
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ArrayAdapter
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.bankhook.client.data.local.AppDatabase
import com.bankhook.client.databinding.FragmentMainBinding
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.time.OffsetDateTime
import java.time.format.DateTimeFormatter

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

        // Banks list (could be loaded from server later). Codes must match Django BankSettings.bank_code
        val banks = listOf("demirbank", "odengi", "bakai", "balance", "megapay", "mbank")
        binding.spinnerBank.adapter = ArrayAdapter(requireContext(), android.R.layout.simple_spinner_dropdown_item, banks)

        binding.btnSave.setOnClickListener {
            prefs.edit()
                .putString("apiBase", binding.inputApiBase.text?.toString()?.trim())
                .putString("apiToken", binding.inputApiToken.text?.toString()?.trim())
                .putBoolean("sendingEnabled", binding.switchSending.isChecked)
                .apply()
            Toast.makeText(requireContext(), "Сохранено", Toast.LENGTH_SHORT).show()
        }

        binding.btnNotifAccess.setOnClickListener {
            startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
        }

        // Send manual payment to Django
        binding.btnSendManual.setOnClickListener {
            if (!binding.switchSending.isChecked) {
                Toast.makeText(requireContext(), "Отправка выключена в настройках", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            val base = binding.inputApiBase.text?.toString()?.trim()?.trimEnd('/') ?: ""
            val token = binding.inputApiToken.text?.toString()?.trim() ?: ""
            val bank = binding.spinnerBank.selectedItem?.toString() ?: ""
            val amountStr = binding.inputAmount.text?.toString()?.trim() ?: ""
            val msg = binding.inputRawMessage.text?.toString() ?: ""
            val amount = amountStr.toDoubleOrNull()
            if (base.isEmpty() || token.isEmpty() || amount == null || amount <= 0) {
                Toast.makeText(requireContext(), "Проверьте базовый URL, токен и сумму", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            val url = "$base/bot_control/api/payment-hook/"
            val json = JSONObject().apply {
                put("amount", amount)
                put("bank", bank)
                put("timestamp", OffsetDateTime.now().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME))
                put("raw_message", msg)
            }
            val body = json.toString().toRequestBody("application/json".toMediaType())
            val req = Request.Builder()
                .url(url)
                .addHeader("Authorization", "Bearer $token")
                .post(body)
                .build()
            val client = OkHttpClient()

            CoroutineScope(Dispatchers.IO).launch {
                try {
                    client.newCall(req).execute().use { resp ->
                        val ok = resp.isSuccessful
                        val text = if (ok) "Отправлено" else "Ошибка: ${resp.code}"
                        CoroutineScope(Dispatchers.Main).launch {
                            Toast.makeText(requireContext(), text, Toast.LENGTH_SHORT).show()
                        }
                    }
                } catch (e: Exception) {
                    CoroutineScope(Dispatchers.Main).launch {
                        Toast.makeText(requireContext(), "Ошибка сети: ${e.message}", Toast.LENGTH_LONG).show()
                    }
                }
            }
        }

        // Open report page in browser
        binding.btnOpenReport.setOnClickListener {
            val base = binding.inputApiBase.text?.toString()?.trim()?.trimEnd('/') ?: ""
            if (base.isEmpty()) {
                Toast.makeText(requireContext(), "Заполните API base", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            val uri = Uri.parse("$base/bot_control/bank-report/")
            startActivity(Intent(Intent.ACTION_VIEW, uri))
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
