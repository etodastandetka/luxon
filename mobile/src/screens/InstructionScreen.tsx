import React, { useMemo } from 'react'
import { StyleSheet, View, Text, Pressable, Linking } from 'react-native'
import { useVideoInstructions } from '../hooks/useVideoInstructions'

const FALLBACK_DEPOSIT = 'https://drive.google.com/file/d/1IiIWC7eWvDQy0BjtHkCNJiU3ehgZ9ks4/view'
const FALLBACK_WITHDRAW = 'https://drive.google.com/file/d/1hKAE6dqLDPuijYwJAmK5xOoS8OX25hlH/view'

export default function InstructionScreen() {
  const { data, isLoading } = useVideoInstructions()

  const urls = useMemo(() => {
    return {
      deposit: data?.deposit_video_url || FALLBACK_DEPOSIT,
      withdraw: data?.withdraw_video_url || FALLBACK_WITHDRAW,
    }
  }, [data])

  const open = (url: string) => Linking.openURL(url)

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Видео инструкции</Text>
      <Text style={styles.text}>
        Откроются в браузере. Берём из /api/video-instructions. {isLoading ? 'Загрузка...' : ''}
      </Text>

      <Pressable style={styles.btn} onPress={() => open(urls.deposit)}>
        <Text style={styles.btnText}>Как пополнить</Text>
      </Pressable>
      <Pressable style={styles.btn} onPress={() => open(urls.withdraw)}>
        <Text style={styles.btnText}>Как вывести</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0b1224', padding: 20, gap: 12 },
  title: { fontSize: 20, fontWeight: '700', color: '#fff' },
  text: { fontSize: 14, color: '#cbd5e1', marginBottom: 6 },
  btn: {
    backgroundColor: '#111827',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  btnText: { color: '#e2e8f0', fontWeight: '700' },
})

