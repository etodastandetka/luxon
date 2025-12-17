import React, { useState } from 'react'
import { StyleSheet, View, Text, Pressable, Alert, TextInput } from 'react-native'
import { colors } from '../theme/colors'

const quickAmounts = [500, 1000, 2000, 5000]
const methods = ['Карта', 'O!Money', 'Баланс']

export default function DepositScreen() {
  const [amount, setAmount] = useState('1000')
  const [method, setMethod] = useState(methods[0])
  const [note, setNote] = useState('')

  const handleStart = () => {
    Alert.alert('Пополнение', `Сумма: ${amount} • Метод: ${method}\n(Подключим реальный API)`)
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Пополнение</Text>
      <Text style={styles.text}>Введите сумму и выберите способ оплаты. Дальше вызовем API.</Text>

      <Text style={styles.label}>Сумма</Text>
      <TextInput
        value={amount}
        onChangeText={setAmount}
        keyboardType="numeric"
        style={styles.input}
        placeholder="0"
        placeholderTextColor={colors.muted}
      />

      <View style={styles.row}>
        {quickAmounts.map(q => (
          <Pressable key={q} style={styles.chip} onPress={() => setAmount(String(q))}>
            <Text style={styles.chipText}>{q}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Способ</Text>
      <View style={styles.row}>
        {methods.map(m => (
          <Pressable
            key={m}
            style={[styles.chip, method === m && styles.chipActive]}
            onPress={() => setMethod(m)}
          >
            <Text style={[styles.chipText, method === m && styles.chipTextActive]}>{m}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Комментарий (необязательно)</Text>
      <TextInput
        value={note}
        onChangeText={setNote}
        style={[styles.input, { height: 90, textAlignVertical: 'top' }]}
        placeholder="Примечание для оператора"
        placeholderTextColor={colors.muted}
        multiline
      />

      <Pressable style={styles.btn} onPress={handleStart}>
        <Text style={styles.btnText}>Отправить заявку</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: 20, gap: 12 },
  title: { fontSize: 20, fontWeight: '700', color: colors.text },
  text: { fontSize: 14, color: colors.muted, lineHeight: 20 },
  label: { color: colors.text, fontSize: 14, fontWeight: '600', marginTop: 4 },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 6 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { borderColor: colors.accent, backgroundColor: '#0f172a' },
  chipText: { color: colors.text, fontWeight: '600' },
  chipTextActive: { color: colors.accent },
  btn: {
    backgroundColor: '#22d3ee',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  btnText: { color: '#0b1224', fontWeight: '700', fontSize: 16 },
})

