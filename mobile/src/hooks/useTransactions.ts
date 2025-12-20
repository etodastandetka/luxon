import { useQuery } from '@tanstack/react-query'
import { fetchTransactions } from '../api/queries'

export function useTransactions(userId?: string | number) {
  return useQuery({
    queryKey: ['transactions', userId],
    queryFn: () => fetchTransactions(userId as string),
    enabled: !!userId,
    staleTime: 60 * 1000,
  })
}










