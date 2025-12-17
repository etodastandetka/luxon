import React, { useMemo } from 'react'
import { StyleSheet, View, Text, ScrollView, Pressable, Linking } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useAuthStore } from '../state/authStore'
import BannerCarousel from '../components/BannerCarousel'
import SectionTitle from '../components/SectionTitle'
import Card from '../components/Card'
import { colors } from '../theme/colors'
import { useTransactions } from '../hooks/useTransactions'
import { formatAmount } from '../utils/format'

export default function HomeScreen() {
  const navigation = useNavigation<any>()
  const user = useAuthStore(state => state.user)
  const { data: tx } = useTransactions(user?.id)

  const greeting = useMemo(() => {
    const hour = new Date().getHours()
    if (hour >= 5 && hour < 12) return 'Доброе утро'
    if (hour >= 12 && hour < 18) return 'Добрый день'
    if (hour >= 18 && hour < 22) return 'Добрый вечер'
    return 'Доброй ночи'
  }, [])

  const quickActions = [
    { title: 'Пополнить', subtitle: 'Моментально', onPress: () => navigation.navigate('Deposit') },
    { title: 'Вывести', subtitle: 'Быстрый вывод', onPress: () => navigation.navigate('Withdraw') },
  ]

  const services = [
    { title: 'Рефералы', subtitle: 'Реферальная программа', onPress: () => navigation.navigate('Instruction') },
    { title: 'История', subtitle: 'История операций', onPress: () => navigation.navigate('History') },
    { title: 'Инструкция', subtitle: 'Пошаговая инструкция', onPress: () => navigation.navigate('Instruction') },
    { title: 'Поддержка', subtitle: 'Связаться', onPress: () => navigation.navigate('Support') },
  ]

  const videoItems = [
    {
      title: 'Как пополнить',
      url: 'https://drive.google.com/file/d/1IiIWC7eWvDQy0BjtHkCNJiU3ehgZ9ks4/view',
    },
    {
      title: 'Как вывести',
      url: 'https://drive.google.com/file/d/1hKAE6dqLDPuijYwJAmK5xOoS8OX25hlH/view',
    },
  ]

  const stats = useMemo(() => {
    const deposits = tx?.filter(t => t.type === 'deposit') || []
    const withdraws = tx?.filter(t => t.type === 'withdraw') || []
    return {
      totalDeposit: deposits.reduce((s, t) => s + (t.amount ?? 0), 0),
      totalWithdraw: withdraws.reduce((s, t) => s + (t.amount ?? 0), 0),
      countDeposit: deposits.length,
      countWithdraw: withdraws.length,
      last: tx?.slice(0, 3) || [],
    }
  }, [tx])

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Профиль и сумма */}
      <Card style={{ gap: 6 }}>
        <Text style={styles.cardTitle}>Ваш профиль</Text>
        <Text style={styles.text}>{greeting}{user ? `, ${user.name}!` : '!'}</Text>
        <Text style={styles.subtle}>User ID: {user?.id ?? '—'}</Text>
        <View style={styles.row}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Баланс</Text>
            <Text style={styles.balance}>{formatAmount(stats.totalDeposit - stats.totalWithdraw)}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: '#0f172a', borderColor: colors.border }]}>
            <Text style={styles.badgeText}>Пополнений</Text>
            <Text style={styles.badgeValue}>{stats.countDeposit}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: '#0f172a', borderColor: colors.border }]}>
            <Text style={styles.badgeText}>Выводов</Text>
            <Text style={styles.badgeValue}>{stats.countWithdraw}</Text>
          </View>
        </View>
      </Card>

      {/* Быстрые действия */}
      <View style={styles.block}>
        <SectionTitle title="Быстрые действия" />
        <View style={styles.grid2}>
          {quickActions.map(action => (
            <Pressable key={action.title} style={styles.actionCard} onPress={action.onPress}>
              <Text style={styles.actionTitle}>{action.title}</Text>
              <Text style={styles.subtle}>{action.subtitle}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Баннеры */}
      <BannerCarousel />

      {/* Сервисы */}
      <View style={styles.block}>
        <SectionTitle title="Сервисы" />
        <View style={styles.grid2}>
          {services.map(s => (
            <Pressable key={s.title} style={styles.serviceCard} onPress={s.onPress}>
              <Text style={styles.serviceTitle}>{s.title}</Text>
              <Text style={styles.serviceSubtitle}>{s.subtitle}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Видео инструкции */}
      <View style={styles.block}>
        <SectionTitle title="Инструкции" right={<Text style={styles.subtle}>Откроется в браузере</Text>} />
        <View style={styles.grid2}>
          {videoItems.map(v => (
            <Pressable key={v.title} style={styles.actionGhost} onPress={() => Linking.openURL(v.url)}>
              <Text style={styles.actionTitleGhost}>{v.title}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Последние операции */}
      <View style={styles.block}>
        <SectionTitle title="Последние операции" right={<Pressable onPress={() => navigation.navigate('History')}><Text style={styles.link}>Смотреть все</Text></Pressable>} />
        {(stats.last.length === 0) ? (
          <Text style={styles.subtle}>Нет операций</Text>
        ) : (
          stats.last.map(item => (
            <Card key={item.id} style={{ marginBottom: 10 }}>
              <View style={styles.rowBetween}>
                <Text style={styles.cardTitle}>{item.type === 'deposit' ? 'Депозит' : 'Вывод'}</Text>
                <Text style={[styles.status, item.type === 'deposit' ? styles.statusGreen : styles.statusBlue]}>
                  {item.status || '—'}
                </Text>
              </View>
              <Text style={styles.amount}>{formatAmount(item.amount)}</Text>
            </Card>
          ))
        )}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, gap: 14 },
  block: { gap: 10 },
  cardTitle: { fontSize: 18, fontWeight: '700', color: '#e2e8f0' },
  text: { fontSize: 15, color: '#cbd5e1', lineHeight: 21 },
  subtle: { fontSize: 12, color: '#94a3b8' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#e2e8f0' },
  grid2: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  actionCard: {
    flexGrow: 1,
    flexBasis: '48%',
    backgroundColor: '#22d3ee',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
  },
  actionGhost: {
    flexGrow: 1,
    flexBasis: '48%',
    backgroundColor: '#111827',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1f2937',
    alignItems: 'center',
  },
  actionTitle: { fontSize: 15, fontWeight: '700', color: '#0b1224' },
  actionTitleGhost: { fontSize: 15, fontWeight: '700', color: '#e2e8f0' },
  serviceCard: {
    flexGrow: 1,
    flexBasis: '48%',
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  serviceTitle: { fontSize: 15, fontWeight: '700', color: '#e2e8f0' },
  serviceSubtitle: { fontSize: 12, color: '#94a3b8' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  badge: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minWidth: 90,
    gap: 4,
  },
  badgeText: { color: colors.muted, fontSize: 12 },
  badgeValue: { color: colors.text, fontWeight: '700', fontSize: 16 },
  balance: { color: colors.accent, fontWeight: '800', fontSize: 18 },
  link: { color: colors.accent, fontWeight: '700' },
  status: { fontSize: 12, fontWeight: '700' },
  statusGreen: { color: colors.success },
  statusBlue: { color: '#60a5fa' },
  amount: { color: colors.text, fontWeight: '700', fontSize: 16, marginTop: 6 },
})

