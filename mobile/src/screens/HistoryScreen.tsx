import React, { useMemo } from 'react'
import { StyleSheet, View, Text, FlatList } from 'react-native'
import { useAuthStore } from '../state/authStore'
import { useTransactions } from '../hooks/useTransactions'

export default function HistoryScreen() {
  const userId = useAuthStore(state => state.user?.id)
  const { data, isLoading, isError } = useTransactions(userId)

  const list = useMemo(() => {
    if (isError || !data) return []
    return data.slice(0, 50).map(tx => ({
      id: String(tx.id ?? `${tx.type}-${Math.random()}`),
      title: tx.type === 'deposit' ? 'Пополнение' : 'Вывод',
      amount: tx.amount ?? 0,
      ts: tx.created_at || '',
      status: tx.status || '',
    }))
  }, [data, isError])

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>История операций</Text>
      {isLoading ? (
        <Text style={styles.meta}>Загрузка...</Text>
      ) : (
        <FlatList
          data={list}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.amount}>{item.amount} ₽</Text>
              <Text style={styles.meta}>{item.ts}</Text>
              <Text style={[styles.status, statusColor(item.status)]}>{item.status || '—'}</Text>
            </View>
          )}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          contentContainerStyle={{ paddingVertical: 8 }}
          ListEmptyComponent={<Text style={styles.meta}>Нет операций</Text>}
        />
      )}
    </View>
  )
}

const statusColor = (status: string) => {
  const normalized = status.toLowerCase()
  if (normalized.includes('success') || normalized.includes('complete')) return { color: '#22c55e' }
  if (normalized.includes('pending') || normalized.includes('process')) return { color: '#fbbf24' }
  if (normalized.includes('reject') || normalized.includes('decline')) return { color: '#f87171' }
  return { color: '#e5e7eb' }
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0b1224', padding: 20, gap: 10 },
  title: { fontSize: 20, fontWeight: '700', color: '#fff' },
  card: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1f2937',
    gap: 4,
  },
  cardTitle: { color: '#e2e8f0', fontWeight: '700' },
  amount: { color: '#22d3ee', fontWeight: '700', fontSize: 16 },
  meta: { color: '#94a3b8', fontSize: 12 },
  status: { fontWeight: '700' },
  ok: { color: '#22c55e' },
  pending: { color: '#fbbf24' },
})

