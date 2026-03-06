import { FitContent } from '@/lib/components/fit-content'
import { ServerSelect } from '@/lib/components/server-select'
import { useNetscript } from '@/lib/hooks/use-netscript'
import { useServerList } from '@/lib/hooks/use-server-list'
import Box from '@mui/material/Box'
import FormControl from '@mui/material/FormControl'
import Grid from '@mui/material/Grid'
import OutlinedInput from '@mui/material/OutlinedInput'
import React from 'react'
import { Server } from './components/server'

export function Hermes() {
  const ns = useNetscript()
  ns.ui.setTailTitle('Hermes')

  const [servers] = useServerList((server) => {
    if (server === 'home') return false

    const serverInfo = ns.getServer(server)

    // Only include servers that we own, since we don't want to run share.js on servers we don't control
    return !serverInfo.purchasedByPlayer
  })
  const [selectedServers, setSelectedServers] = React.useState<string[]>([])

  return (
    <FitContent>
      <Box
        sx={{
          padding: 1,
          minWidth: 700,
        }}
      >
        <Grid container spacing={2}>
          <Grid size={12}>
            <FormControl fullWidth>
              <ServerSelect
                multiple
                servers={servers}
                value={selectedServers}
                input={<OutlinedInput label="Servers" />}
                renderValue={(selected) => selected.join(', ')}
                onChange={(e) => {
                  const {
                    target: { value },
                  } = e

                  setSelectedServers(typeof value === 'string' ? value.split(',') : value)
                }}
              />
            </FormControl>
          </Grid>
          <Grid size={12}>
            <Grid container spacing={2}>
              {selectedServers.map((server) => (
                <Server key={server} server={server} />
              ))}
            </Grid>
          </Grid>
        </Grid>
      </Box>
    </FitContent>
  )
}
