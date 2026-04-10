import Button from '@mui/material/Button'
import React from 'react'

import { useNetscript } from '@/lib/hooks/use-netscript'

const SCRIPT = 'zeusd-config.js'

export function ZeusdConfigButton() {
  const ns = useNetscript()

  return (
    <Button
      size="small"
      variant="contained"
      onClick={() => {
        ns.exec(SCRIPT, 'corporation')
      }}
    >
      Zeus Config
    </Button>
  )
}
