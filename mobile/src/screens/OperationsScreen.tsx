import React, { useMemo } from 'react'
import { StyleSheet, View, Text, FlatList } from 'react-native'
import { useAuthStore } from '../state/authStore'
import { useTransactions } from '../hooks/useTransactions'

export default function OperationsScreen() {
  const userId = useAuthStore(state => state.user?.id)
  const { data, isLoading, isError } = useTransactions(userId)

  const list = useMemo(() => {
    if (isError || !data) return []
    return data
      .slice(0, 30)
      .map(tx => ({
        id: String(tx.id ?? `${tx.type}-${Math.random()}`),
        type: tx.type,
        amount: tx.amount ?? 0,
        status: tx.status ?? 'pending',
      }))
  }, [data, isError])

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Операции</Text>
      <Text style={styles.text}>Подгружаем из /api/transaction-history.</Text>
      {isLoading ? (
        <Text style={styles.text}>Загрузка...</Text>
      ) : (
        <FlatList
          data={list}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{item.type === 'deposit' ? 'Депозит' : 'Вывод'}</Text>
              <Text style={styles.amount}>{item.amount} ₽</Text>
              <Text style={[styles.status, statusColor(item.status)]}>{item.status}</Text>
            </View>
          )}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          contentContainerStyle={{ paddingVertical: 6 }}
          ListEmptyComponent={<Text style={styles.text}>Нет операций</Text>}
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
  text: { fontSize: 14, color: '#94a3b8', marginBottom: 4 },
  card: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  cardTitle: { color: '#e2e8f0', fontWeight: '700', marginBottom: 4 },
  amount: { color: '#22d3ee', fontWeight: '700', fontSize: 16 },
  status: { marginTop: 4, fontWeight: '600' },
})

