import React from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { useAuthStore } from '../state/authStore'
import AuthScreen from '../screens/AuthScreen'
import HomeScreen from '../screens/HomeScreen'
import CasinosScreen from '../screens/CasinosScreen'
import OperationsScreen from '../screens/OperationsScreen'
import ProfileScreen from '../screens/ProfileScreen'
import DepositScreen from '../screens/DepositScreen'
import WithdrawScreen from '../screens/WithdrawScreen'
import InstructionScreen from '../screens/InstructionScreen'
import SupportScreen from '../screens/SupportScreen'
import HistoryScreen from '../screens/HistoryScreen'

const Stack = createNativeStackNavigator()
const Tab = createBottomTabNavigator()

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: '#0f172a', borderTopColor: '#1f2937' },
        tabBarActiveTintColor: '#22d3ee',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarLabelStyle: { fontSize: 12 },
      }}
    >
      <Tab.Screen name="HomeTab" component={HomeScreen} options={{ tabBarLabel: 'Главная' }} />
      <Tab.Screen name="Casinos" component={CasinosScreen} options={{ tabBarLabel: 'Казино' }} />
      <Tab.Screen name="Operations" component={OperationsScreen} options={{ tabBarLabel: 'Операции' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ tabBarLabel: 'Профиль' }} />
    </Tab.Navigator>
  )
}

export default function AppNavigator() {
  const token = useAuthStore(state => state.token)

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: '#0f172a' },
          headerTintColor: '#fff',
          contentStyle: { backgroundColor: '#0b1224' },
        }}
      >
        {token ? (
          <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
        ) : (
          <Stack.Screen name="Auth" component={AuthScreen} options={{ title: 'Авторизация' }} />
        )}
        <Stack.Screen name="Deposit" component={DepositScreen} options={{ title: 'Пополнение' }} />
        <Stack.Screen name="Withdraw" component={WithdrawScreen} options={{ title: 'Вывод' }} />
        <Stack.Screen name="Instruction" component={InstructionScreen} options={{ title: 'Инструкция' }} />
        <Stack.Screen name="Support" component={SupportScreen} options={{ title: 'Поддержка' }} />
        <Stack.Screen name="History" component={HistoryScreen} options={{ title: 'История операций' }} />
      </Stack.Navigator>
    </NavigationContainer>
  )
}

