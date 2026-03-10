import { queryOptions, useQuery } from '@tanstack/react-query'

import { useNetscript } from '@/lib/hooks/use-netscript'

export function useServerMaxMoney(server: string) {
  const ns = useNetscript()

  return useQuery(
    queryOptions({
      queryKey: ['serverMaxMoney', server],
      queryFn: () => ns.getServerMaxMoney(server),
    }),
  )
}
