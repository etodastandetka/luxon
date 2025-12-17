import React from 'react'
import { StyleSheet, View, Text, Pressable, Linking } from 'react-native'
import { colors } from '../theme/colors'

const SUPPORT_URL = 'https://t.me/your_support_bot' // замените на актуальный, при желании можно использовать support_bot токен

export default function SupportScreen() {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Поддержка</Text>
      <Text style={styles.text}>Откроем чат в Telegram. Замените URL на реальный бот поддержки.</Text>

      <Pressable style={styles.btn} onPress={() => Linking.openURL(SUPPORT_URL)}>
        <Text style={styles.btnText}>Открыть Telegram</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: 20, gap: 12 },
  title: { fontSize: 20, fontWeight: '700', color: colors.text },
  text: { fontSize: 14, color: colors.muted },
  btn: {
    marginTop: 8,
    backgroundColor: colors.accent,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnText: { color: '#0b1224', fontWeight: '700', fontSize: 16 },
})
import React from 'react'
import { StyleSheet, View, Text, Pressable, Linking } from 'react-native'

const SUPPORT_URL = 'https://t.me/your_support_bot'

export default function SupportScreen() {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Поддержка</Text>
      <Text style={styles.text}>Откроем чат в Telegram. Заменим на реальный бот/линк.</Text>

      <Pressable style={styles.btn} onPress={() => Linking.openURL(SUPPORT_URL)}>
        <Text style={styles.btnText}>Открыть Telegram</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0b1224', padding: 20, gap: 12 },
  title: { fontSize: 20, fontWeight: '700', color: '#fff' },
  text: { fontSize: 14, color: '#cbd5e1' },
  btn: {
    marginTop: 8,
    backgroundColor: '#22d3ee',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnText: { color: '#0b1224', fontWeight: '700', fontSize: 16 },
})

