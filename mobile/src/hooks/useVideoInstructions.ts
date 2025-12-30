import { useQuery } from '@tanstack/react-query'
import { fetchVideoInstructions } from '../api/queries'

export function useVideoInstructions() {
  return useQuery({
    queryKey: ['video-instructions'],
    queryFn: fetchVideoInstructions,
    staleTime: 10 * 60 * 1000,
  })
}






















