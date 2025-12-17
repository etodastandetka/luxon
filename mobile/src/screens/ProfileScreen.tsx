import React from 'react'
import { StyleSheet, View, Text, Pressable } from 'react-native'
import { useAuthStore } from '../state/authStore'

export default function ProfileScreen() {
  const { user, token, logout } = useAuthStore()

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Профиль</Text>
      <Text style={styles.text}>Имя: {user?.name ?? '—'}</Text>
      <Text style={styles.text}>User ID: {user?.id ?? '—'}</Text>
      <Text style={styles.text}>Token: {token ? token.slice(0, 8) + '…' : '—'}</Text>

      <Pressable style={styles.btn} onPress={logout}>
        <Text style={styles.btnText}>Выйти</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0b1224', padding: 20, gap: 12 },
  title: { fontSize: 20, fontWeight: '700', color: '#fff' },
  text: { fontSize: 14, color: '#cbd5e1' },
  btn: {
    marginTop: 10,
    backgroundColor: '#ef4444',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnText: { color: '#fff', fontWeight: '700' },
})

