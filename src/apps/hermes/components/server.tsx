import { useNetscript } from '@/lib/hooks/use-netscript'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Divider from '@mui/material/Divider'
import Grid from '@mui/material/Grid'
import Typography from '@mui/material/Typography'
import React from 'react'

export interface ServerProps {
  server: string
}

export function Server({ server }: ServerProps) {
  const ns = useNetscript()

  return (
    <Grid size={4}>
      <Card variant="outlined" sx={{ height: '100%' }}>
        <CardContent>
          <Typography gutterBottom sx={{ color: 'textSecondary' }}>
            {server}
          </Typography>
          <Typography sx={{ fontSize: 14 }}>
            Money: {ns.formatNumber(ns.getServerMoneyAvailable(server))} /{' '}
            {ns.formatNumber(ns.getServerMaxMoney(server))}
          </Typography>

          <Divider />

          <Typography sx={{ fontSize: 14 }}>
            Security: {ns.getServerSecurityLevel(server)} / {ns.getServerMinSecurityLevel(server)}
          </Typography>
        </CardContent>
      </Card>
    </Grid>
  )
}
