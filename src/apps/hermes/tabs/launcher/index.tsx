import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid'
import React from 'react'

import { PurchaseServersButton } from './components/purchase-servers-button'
import { UpgradeServersButton } from './components/upgrade-servers-button'

export function Launcher() {
  return (
    <Box
      sx={{
        padding: 1,
      }}
    >
      <Grid container spacing={1}>
        <Grid>
          <PurchaseServersButton />
        </Grid>

        <Grid>
          <UpgradeServersButton />
        </Grid>
      </Grid>
    </Box>
  )
}
