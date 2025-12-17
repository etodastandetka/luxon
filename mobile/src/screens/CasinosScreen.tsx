import React, { useState } from 'react'
import { StyleSheet, View, Text } from 'react-native'
import BookmakerGrid from '../components/BookmakerGrid'
import SectionTitle from '../components/SectionTitle'
import { colors } from '../theme/colors'

export default function CasinosScreen() {
  const [selected, setSelected] = useState<string | undefined>()

  return (
    <View style={styles.screen}>
      <SectionTitle title="Выбор казино" />
      <Text style={styles.text}>Список можно заменить на данные API. Выберите нужное казино.</Text>
      <BookmakerGrid value={selected} onChange={setSelected} />
      {selected && <Text style={styles.selection}>Вы выбрали: {selected.toUpperCase()}</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: 20,
    gap: 10,
  },
  text: { fontSize: 14, color: colors.muted },
  selection: { marginTop: 6, color: colors.accent, fontWeight: '700' },
})

