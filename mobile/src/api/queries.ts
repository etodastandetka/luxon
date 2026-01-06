import { apiFetch } from './client'

type Banner = {
  id: number
  image_url?: string
  video_url?: string
  link?: string
  is_active: boolean
  order: number
}

type Transaction = {
  id?: string | number
  type: 'deposit' | 'withdraw'
  amount?: number
  status?: string
  created_at?: string
}

type VideoInstructions = {
  deposit_video_url?: string
  withdraw_video_url?: string
}

export async function fetchBanners(): Promise<Banner[]> {
  const data = await apiFetch<any>('/api/public/banners?active=true')
  const list: Banner[] = data?.data ?? data ?? []
  return (list || [])
    .filter(b => b.is_active !== false)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
}

export async function fetchTransactions(userId: string | number): Promise<Transaction[]> {
  const data = await apiFetch<any>(`/api/transaction-history?user_id=${userId}`)
  const tx = data?.data?.transactions || data?.transactions || []
  return tx as Transaction[]
}

export async function fetchVideoInstructions(): Promise<VideoInstructions> {
  const data = await apiFetch<any>('/api/video-instructions')
  return data?.data ?? {}
}







































