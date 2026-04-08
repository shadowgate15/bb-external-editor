import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import FormControl from '@mui/material/FormControl'
import FormControlLabel from '@mui/material/FormControlLabel'
import Grid from '@mui/material/Grid'
import Switch from '@mui/material/Switch'
import { useMutation, useQuery } from '@tanstack/react-query'
import React from 'react'
import { combineLatest, defer, filter, first, firstValueFrom, map, of } from 'rxjs'

import { usePortServer } from '@/apps/hermes/hooks/use-port-server'
import { ConfigData } from '@/lib/zeus/config.interface'

import { useCorpClient } from '../hooks/use-corp-client'

export interface ConfigProps {
  onBack: () => void
}

export function Config({ onBack }: ConfigProps) {
  const corpClient = useCorpClient()
  const portServer = usePortServer()

  const configQuery = React.useMemo(
    () =>
      useQuery({
        // eslint-disable-next-line @tanstack/query/exhaustive-deps
        queryKey: ['corpConfig'],
        queryFn: async () => {
          const id = crypto.randomUUID()

          return firstValueFrom(
            combineLatest([
              portServer.responses$$.pipe(
                filter((response) => response.action === 'zeusConfig'),
                first((response) => response.data.id === id),
              ),
              defer(() => of(corpClient.send('getConfig', { id, returnPort: portServer.port }))),
            ]).pipe(map(([response, _]) => response.data.config)),
          )
        },
        refetchInterval: false,
      }),
    [portServer, corpClient],
  )

  const mutateConfig = React.useMemo(
    () =>
      useMutation({
        mutationFn: async (newConfig: ConfigData) => {
          corpClient.send('configUpdated', newConfig)

          configQuery.refetch()
        },
      }),
    [corpClient, configQuery],
  )

  return (
    <Grid container spacing={1}>
      <Grid display="flex" size="grow" justifyContent="right">
        <Button onClick={onBack} size="small">
          Back
        </Button>
      </Grid>
      <Grid>
        {configQuery.isLoading && <CircularProgress aria-label="Loading…" />}

        {configQuery.isError && <div>Error loading config: {String(configQuery.error)}</div>}

        {configQuery.isSuccess && (
          <FormControl variant="standard">
            <FormControlLabel
              control={
                <Switch
                  checked={configQuery.data.enableBoostMaterials}
                  onChange={(_, checked) =>
                    mutateConfig.mutate({
                      ...configQuery.data,
                      enableBoostMaterials: checked,
                    })
                  }
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
