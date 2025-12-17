import 'react-native-gesture-handler'
import React from 'react'
import { StatusBar } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import AppNavigator from './src/navigation/AppNavigator'

const queryClient = new QueryClient()

function App(): React.JSX.Element {
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
        <AppNavigator />
      </SafeAreaProvider>
    </QueryClientProvider>
  )
}

export default App
