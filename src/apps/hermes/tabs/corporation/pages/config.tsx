import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import FormControl from '@mui/material/FormControl'
import FormControlLabel from '@mui/material/FormControlLabel'
import Grid from '@mui/material/Grid'
import Switch from '@mui/material/Switch'
import React from 'react'
import { filter, first, map } from 'rxjs'

import { usePortServer } from '@/apps/hermes/hooks/use-port-server'
import { useNetscript } from '@/lib/hooks/use-netscript'
import { ConfigData } from '@/lib/zeus/config.interface'

import { useCorpClient } from '../hooks/use-corp-client'

export interface ConfigProps {
  onBack: () => void
}

export function Config({ onBack }: ConfigProps) {
  const ns = useNetscript()
  const corpClient = useCorpClient()
  const portServer = usePortServer()

  const [config, setConfig] = React.useState<ConfigData | null>(null)

  const fetchConfig = React.useCallback(async () => {
    const id = crypto.randomUUID()

    portServer.responses$$
      .pipe(
        filter((response) => response.action === 'zeusConfig'),
        first((response) => response.data.id === id),
        map((response) => response.data.config),
      )
      .subscribe((config) => {
        setConfig(config)
      })

    corpClient.send('getConfig', { id, returnPort: portServer.port })
  }, [ns, corpClient, portServer, setConfig])

  React.useEffect(() => {
    fetchConfig()
  }, [fetchConfig])

  return (
    <Grid container direction="column" spacing={1}>
      <Grid display="flex" size="grow" justifyContent="right">
        <Button onClick={onBack} size="small">
          Back
        </Button>
      </Grid>
      <Grid>
        {config === null ? (
          <CircularProgress aria-label="Loading..." />
        ) : (
          <FormControl variant="standard">
            <FormControlLabel
              control={
                <Switch
                  checked={config.enableBoostMaterials}
                  onChange={(_, checked) => {
                    corpClient.send('configUpdated', {
                      ...config,
                      enableBoostMaterials: checked,
                    })

                    setConfig(null)

                    setTimeout(() => {
                      fetchConfig()
                    }, 100)
                  }}
                  slotProps={{ input: { 'aria-label': 'controlled' } }}
                />
              }
              label="Enable Boost Material"
            />
          </FormControl>
        )}
      </Grid>
    </Grid>
  )
}
