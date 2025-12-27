import React from 'react'
import { View, Text, StyleSheet, ViewStyle } from 'react-native'
import { colors } from '../theme/colors'

type Props = {
  title: string
  right?: React.ReactNode
  style?: ViewStyle
}

export default function SectionTitle({ title, right, style }: Props) {
  return (
    <View style={[styles.row, style]}>
      <Text style={styles.title}>{title}</Text>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  title: { color: colors.text, fontSize: 16, fontWeight: '700' },
  right: { marginLeft: 8 },
})



















