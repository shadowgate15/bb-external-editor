import { queryOptions, useQuery } from '@tanstack/react-query'

import { useNetscript } from '@/lib/hooks/use-netscript'

export function useServerMoneyAvailable(server: string) {
  const ns = useNetscript()

  return useQuery(
    queryOptions({
      queryKey: ['serverMoneyAvailable', server],
      queryFn: () => ns.getServerMoneyAvailable(server),
    }),
  )
}
