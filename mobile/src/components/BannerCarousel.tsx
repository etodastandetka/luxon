import React, { useRef, useState, useEffect } from 'react'
import { Dimensions, FlatList, StyleSheet, View } from 'react-native'
import FastImage from 'react-native-fast-image'
import { useBanners } from '../hooks/useBanners'

const width = Dimensions.get('window').width

const FALLBACK = [
  { id: 'b1', image_url: 'https://via.placeholder.com/900x360?text=Banner+1' },
  { id: 'b2', image_url: 'https://via.placeholder.com/900x360?text=Banner+2' },
]

export default function BannerCarousel() {
  const { data, isLoading } = useBanners()
  const [index, setIndex] = useState(0)
  const viewConfigRef = useRef({ viewAreaCoveragePercentThreshold: 50 })

  const banners = (data && data.length > 0 ? data : FALLBACK).map(b => ({
    id: String(b.id ?? b.image_url),
    image: b.image_url,
  }))

  useEffect(() => {
    if (banners.length <= 1) return
    const timer = setInterval(() => setIndex(prev => (prev + 1) % banners.length), 5000)
    return () => clearInterval(timer)
  }, [banners.length])

  if (isLoading || banners.length === 0) return null

  return (
    <View style={styles.container}>
      <FlatList
        data={banners}
        keyExtractor={item => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={({ viewableItems }) => {
          if (viewableItems.length > 0) {
            setIndex(viewableItems[0].index ?? 0)
          }
        }}
        viewabilityConfig={viewConfigRef.current}
        renderItem={({ item }) => (
          <FastImage
            source={{ uri: item.image, priority: FastImage.priority.high }}
            style={styles.banner}
            resizeMode={FastImage.resizeMode.cover}
          />
        )}
      />
      {banners.length > 1 && (
        <View style={styles.dots}>
          {banners.map((b, i) => (
            <View key={b.id} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { width: '100%' },
  banner: {
    width,
    height: 170,
  },
  dots: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#475569',
  },
  dotActive: {
    backgroundColor: '#22d3ee',
  },
})

