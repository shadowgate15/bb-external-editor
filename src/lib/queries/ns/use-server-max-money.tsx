import { useNetscript } from '@/lib/hooks/use-netscript'
import { queryOptions, useQuery } from '@tanstack/react-query'

export function useServerMaxMoney(server: string) {
  const ns = useNetscript()

  return useQuery(
    queryOptions({
      queryKey: ['serverMaxMoney', server],
      queryFn: () => ns.getServerMaxMoney(server),
    }),
  )
}
