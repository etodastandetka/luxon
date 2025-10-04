package com.bankhook.client.ui.history

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.core.widget.addTextChangedListener
import com.bankhook.client.data.local.AppDatabase
import com.bankhook.client.databinding.FragmentHistoryBinding
import com.google.android.material.datepicker.MaterialDatePicker
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter

class HistoryFragment : Fragment() {
    private var _binding: FragmentHistoryBinding? = null
    private val binding get() = _binding!!

    private lateinit var adapter: HistoryListAdapter
    private var startMillis: Long? = null
    private var endMillis: Long? = null
    private var query: String = ""

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentHistoryBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        adapter = HistoryListAdapter()
        binding.recycler.layoutManager = LinearLayoutManager(requireContext())
        binding.recycler.adapter = adapter

        val dao = AppDatabase.get(requireContext()).txDao()
        viewLifecycleOwner.lifecycleScope.launch {
            dao.observeAll().collectLatest { items ->
                val filtered = items.filter { e ->
                    val okDate = run {
                        if (startMillis == null && endMillis == null) return@run true
                        val ts = try { Instant.parse(toIsoStrict(e.timestampIso)).toEpochMilli() } catch (_: Exception) { 0L }
                        val sOk = startMillis?.let { ts >= it } ?: true
                        val eOk = endMillis?.let { ts <= it } ?: true
                        sOk && eOk
                    }
                    val q = query.trim().lowercase()
                    val okQuery = if (q.isEmpty()) true else {
                        e.bank.lowercase().contains(q) || e.rawMessage.lowercase().contains(q)
                    }
                    okDate && okQuery
                }
                adapter.submitList(filtered)
            }
        }

        binding.btnDateRange.setOnClickListener {
            val picker = MaterialDatePicker.Builder.dateRangePicker()
                .setTitleText("Выберите период")
                .build()
            picker.addOnPositiveButtonClickListener { range ->
                startMillis = range.first
                endMillis = range.second?.let { it + 86_399_000 } // include full end day
                // Trigger refresh by re-collecting latest (flow collector above reacts automatically)
            }
            picker.show(parentFragmentManager, "date_range")
        }

        binding.btnClear.setOnClickListener {
            startMillis = null
            endMillis = null
            binding.inputSearch.setText("")
            query = ""
        }

        binding.inputSearch.addTextChangedListener {
            query = it?.toString() ?: ""
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }

    private fun toIsoStrict(src: String): String {
        // Ensure offset is present; if not, assume Z
        return if (src.endsWith("Z") || src.contains("+")) src else src + "Z"
    }
}
