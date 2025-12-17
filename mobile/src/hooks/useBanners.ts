import { useQuery } from '@tanstack/react-query'
import { fetchBanners } from '../api/queries'

export function useBanners() {
  return useQuery({
    queryKey: ['banners'],
    queryFn: fetchBanners,
    staleTime: 5 * 60 * 1000,
  })
}

