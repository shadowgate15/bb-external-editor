import Button from '@mui/material/Button'
import { useQuery } from '@tanstack/react-query'
import React from 'react'

import { useIsRunning } from '@/lib/hooks/use-is-running'
import { useNetscript } from '@/lib/hooks/use-netscript'
import { usePurchasedServers } from '@/lib/hooks/use-purchased-servers'

const SCRIPT = 'server-upgrade.js'

const useHasUpgradeableServers = () => {
  const ns = useNetscript()

  return useQuery({
    queryKey: ['purschased-servers', 'has-upgradeable-servers'],
    queryFn: () => {
      const purchasedServers = ns.getPurchasedServers()
      const purchasedServerMaxRam = ns.getPurchasedServerMaxRam()

      return purchasedServers.some((server) => ns.getServerMaxRam(server) < purchasedServerMaxRam)
    },
  })
}

export function UpgradeServersButton() {
  const ns = useNetscript()
  const { data: purchasedServers, isLoading: isPurchasedServersLoading } = usePurchasedServers()
  const { data: isRunning, isLoading: isIsRunningLoading } = useIsRunning(SCRIPT)
  const purchasedServerLimit = React.useMemo(() => ns.getPurchasedServerLimit(), [ns])
  const { data: hasUpgradeableServers, isLoading: isHasUpgradeableServersLoading } = useHasUpgradeableServers()

  return (
    <Button
      size="small"
      variant="contained"
      loading={isPurchasedServersLoading || isIsRunningLoading || isHasUpgradeableServersLoading}
      disabled={purchasedServers?.length !== purchasedServerLimit || isRunning || !hasUpgradeableServers}
      onClick={() => {
        ns.exec(SCRIPT, 'home')
      }}
    >
      Upgrade Servers
    </Button>
  )
}
