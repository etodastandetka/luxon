import React from 'react'
import { FlatList, Pressable, StyleSheet, Text, View, Dimensions } from 'react-native'
import FastImage from 'react-native-fast-image'

type Item = { key: string; name: string; logo?: string; emoji?: string }

const ALL_BOOKMAKERS: Item[] = [
  { key: '1xbet', name: '1XBET', emoji: '🎯', logo: 'https://via.placeholder.com/400x200?text=1XBET' },
  { key: '1win', name: '1WIN', emoji: '🏆', logo: 'https://via.placeholder.com/400x200?text=1WIN' },
  { key: 'melbet', name: 'MELBET', emoji: '🎲', logo: 'https://via.placeholder.com/400x200?text=MELBET' },
  { key: 'mostbet', name: 'MOSTBET', emoji: '🎯', logo: 'https://via.placeholder.com/400x200?text=MOSTBET' },
  { key: 'winwin', name: 'WINWIN', emoji: '🎰', logo: 'https://via.placeholder.com/400x200?text=WINWIN' },
  { key: '888starz', name: '888STARZ', emoji: '⭐', logo: 'https://via.placeholder.com/400x200?text=888STARZ' },
]

type Props = {
  value?: string
  onChange: (key: string) => void
  disabledCasinos?: string[]
}

const numColumns = 2
const cardWidth = (Dimensions.get('window').width - 20 * 2 - 12 * (numColumns - 1)) / numColumns

export function BookmakerGrid({ value, onChange, disabledCasinos }: Props) {
  const renderItem = ({ item }: { item: Item }) => {
    const isDisabled = disabledCasinos?.includes(item.key)
    const isActive = value === item.key

    return (
      <Pressable
        onPress={() => {
          if (isDisabled) return
          onChange(item.key)
        }}
        style={[
          styles.card,
          {
            width: cardWidth,
            borderColor: isActive ? '#22d3ee' : '#1f2937',
            opacity: isDisabled ? 0.6 : 1,
          },
        ]}
      >
        {item.logo ? (
          <FastImage
            source={{ uri: item.logo, priority: FastImage.priority.high }}
            style={styles.image}
            resizeMode={FastImage.resizeMode.cover}
          />
        ) : (
          <View style={[styles.image, styles.placeholder]}>
            <Text style={styles.emoji}>{item.emoji}</Text>
          </View>
        )}
        <Text style={styles.name}>{item.name}</Text>
        {isDisabled && <Text style={styles.disabled}>Недоступно</Text>}
      </Pressable>
    )
  }

  return (
    <FlatList
      data={ALL_BOOKMAKERS}
      numColumns={numColumns}
      keyExtractor={item => item.key}
      renderItem={renderItem}
      columnWrapperStyle={{ gap: 12 }}
      contentContainerStyle={{ gap: 12, paddingVertical: 4 }}
    />
  )
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 14,
    backgroundColor: '#111827',
    overflow: 'hidden',
  },
  image: {
    height: 120,
    width: '100%',
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f172a',
  },
  emoji: { fontSize: 28 },
  name: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: '#e2e8f0',
    fontWeight: '700',
  },
  disabled: {
    position: 'absolute',
    bottom: 8,
    right: 10,
    color: '#fbbf24',
    fontSize: 12,
    fontWeight: '600',
  },
})

export default BookmakerGrid











