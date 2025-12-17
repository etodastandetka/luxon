import React, { useState } from 'react'
import { StyleSheet, View, Text, Pressable, TextInput, Alert } from 'react-native'
import { useAuthStore } from '../state/authStore'
import { validateTelegramInitData, parseUser, validateDomain } from '../utils/telegramAuth'
import { colors } from '../theme/colors'

export default function AuthScreen() {
  const setAuth = useAuthStore(state => state.setAuth)
  const [userId, setUserId] = useState('1')
  const [name, setName] = useState('Telegram User')
  const [initData, setInitData] = useState('')

  const handleTelegramLogin = () => {
    if (initData.trim()) {
      const { ok, data, error } = validateTelegramInitData(initData.trim())
      if (!ok) {
        Alert.alert('Ошибка Telegram', error || 'Не удалось проверить initData')
        return
      }
      if (!validateDomain(data?.tgWebAppData || data?.domain || '')) {
        Alert.alert('Ошибка домена', 'Домен не совпадает с ожидаемым')
        return
      }
      const parsedUser = parseUser(data)
      if (!parsedUser) {
        Alert.alert('Ошибка', 'Не удалось прочитать пользователя из initData')
        return
      }
      setAuth(initData.trim(), parsedUser)
      return
    }

    // Fallback: ручной ввод
    setAuth('mock-token', { id: userId || '1', name: name || 'Telegram User' })
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Вход через Telegram</Text>
      <Text style={styles.text}>Временный вход: укажите user_id и имя. Подключу реальный Telegram flow.</Text>

      <View style={styles.field}>
        <Text style={styles.label}>Telegram user_id</Text>
        <TextInput
          value={userId}
          onChangeText={setUserId}
          placeholder="12345"
          placeholderTextColor="#6b7280"
          keyboardType="numeric"
          style={styles.input}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Имя</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Имя"
          placeholderTextColor="#6b7280"
          style={styles.input}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Telegram initData (WebApp)</Text>
        <TextInput
          value={initData}
          onChangeText={setInitData}
          placeholder="query_id=...&user=...&hash=..."
          placeholderTextColor={colors.muted}
          style={[styles.input, { height: 90, textAlignVertical: 'top' }]}
          multiline
        />
      </View>

      <Pressable style={styles.primaryBtn} onPress={handleTelegramLogin}>
        <Text style={styles.primaryBtnText}>Продолжить</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    padding: 20,
    gap: 14,
    justifyContent: 'center',
    backgroundColor: '#0b1224',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  text: {
    fontSize: 15,
    color: '#cbd5e1',
    lineHeight: 22,
  },
  field: { gap: 6 },
  label: { color: '#e2e8f0', fontSize: 14, fontWeight: '600' },
  input: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#1f2937',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#e5e7eb',
  },
  primaryBtn: {
    marginTop: 8,
    backgroundColor: '#22d3ee',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#0b1224',
    fontWeight: '700',
    fontSize: 16,
  },
})

