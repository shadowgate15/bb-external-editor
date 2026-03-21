import Button from '@mui/material/Button'
import React from 'react'

import { useIsRunning } from '@/lib/hooks/use-is-running'
import { useNetscript } from '@/lib/hooks/use-netscript'
import { usePurchasedServers } from '@/lib/hooks/use-purchased-servers'

const SCRIPT = 'server-purchase.js'

export function PurchaseServersButton() {
  const ns = useNetscript()
  const { data: purchasedServers, isLoading: isPurchasedServersLoading } = usePurchasedServers()
  const { data: isRunning, isLoading: isIsRunningLoading } = useIsRunning(SCRIPT)
  const purchasedServerLimit = React.useMemo(() => ns.getPurchasedServerLimit(), [ns])

  return (
    <Button
      size="small"
      variant="contained"
      loading={isPurchasedServersLoading || isIsRunningLoading}
      disabled={purchasedServers?.length === purchasedServerLimit || isRunning}
      onClick={() => {
        ns.exec(SCRIPT, 'home')
      }}
    >
      Purchase 8gb Servers
    </Button>
  )
}
