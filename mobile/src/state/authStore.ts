import { create } from 'zustand'

type User = {
  id: string
  name: string
}

type AuthState = {
  token: string | null
  user: User | null
  setAuth: (token: string, user?: User) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>(set => ({
  token: null,
  user: null,
  setAuth: (token, user) => set({ token, user: user ?? null }),
  logout: () => set({ token: null, user: null }),
}))


















