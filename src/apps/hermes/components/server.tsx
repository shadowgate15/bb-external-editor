import { useNetscript } from '@/lib/hooks/use-netscript'
import { useServerMaxMoney } from '@/lib/queries/ns/use-server-max-money'
import { useServerMoneyAvailable } from '@/lib/queries/ns/use-server-money-available'
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
  const { data: serverMoneyAvailable, isLoading: isServerMoneyAvailableLoading } = useServerMoneyAvailable(server)
  const { data: serverMaxMoney, isLoading: isServerMaxMoneyLoading } = useServerMaxMoney(server)

  const isLoading = React.useMemo(
    () => isServerMoneyAvailableLoading || isServerMaxMoneyLoading,
    [isServerMoneyAvailableLoading, isServerMaxMoneyLoading],
  )

  return (
    <Grid size={4}>
      <Card variant="outlined" sx={{ height: '100%' }}>
        <CardContent>
          {isLoading ? (
            'Loading...'
          ) : (
            <>
              <Typography gutterBottom sx={{ color: 'textSecondary' }}>
                {server}
              </Typography>
              <Typography sx={{ fontSize: 14 }}>
                Money: {ns.formatNumber(serverMoneyAvailable, 2)} / {ns.formatNumber(serverMaxMoney, 2)}
              </Typography>

              <Divider />

              <Typography sx={{ fontSize: 14 }}>
                Security: {ns.getServerSecurityLevel(server)} / {ns.getServerMinSecurityLevel(server)}
              </Typography>
            </>
          )}
        </CardContent>
      </Card>
    </Grid>
  )
}
