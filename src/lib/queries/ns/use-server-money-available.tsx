import { useNetscript } from '@/lib/hooks/use-netscript'
import { queryOptions, useQuery } from '@tanstack/react-query'

export function useServerMoneyAvailable(server: string) {
  const ns = useNetscript()

  return useQuery(
    queryOptions({
      queryKey: ['serverMoneyAvailable', server],
      queryFn: () => ns.getServerMoneyAvailable(server),
    }),
  )
}
