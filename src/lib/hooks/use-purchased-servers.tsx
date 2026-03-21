import { useQuery } from '@tanstack/react-query'

import { useNetscript } from './use-netscript'

export function usePurchasedServers() {
  const ns = useNetscript()

  return useQuery({
    queryKey: ['purchased-servers'],
    queryFn: async () => ns.getPurchasedServers(),
    refetchInterval: 1000,
  })
}
