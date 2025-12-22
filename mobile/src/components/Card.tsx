import React from 'react'
import { View, StyleSheet, ViewStyle } from 'react-native'
import { colors } from '../theme/colors'

type Props = {
  children: React.ReactNode
  style?: ViewStyle
}

export default function Card({ children, style }: Props) {
  return <View style={[styles.card, style]}>{children}</View>
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
})











