import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import FormControl from '@mui/material/FormControl'
import FormControlLabel from '@mui/material/FormControlLabel'
import Switch from '@mui/material/Switch'
import React from 'react'

import { FitContent } from '@/lib/components/fit-content'
import { useNetscript } from '@/lib/hooks/use-netscript'
import { CONFIG_PATH, configSchema } from '@/lib/zeus/config'
import { createCorporationDaemonClient } from '@/lib/zeus/daemon/client'

export function ZeusConfig() {
  const ns = useNetscript()

  const [config, setConfig] = React.useState(() => {
    const contents = ns.read(CONFIG_PATH)
    if (contents === '') {
      return configSchema.parse({})
    } else {
      return configSchema.parse(JSON.parse(contents))
    }
  })
  const client = React.useMemo(() => createCorporationDaemonClient(ns), [ns])

  return (
    <FitContent>
      <Box
        sx={{
          padding: 1,
        }}
      >
        <FormControl variant="standard" fullWidth>
          <FormControlLabel
            control={
              <Switch
                checked={config.enableBoostMaterials}
                onChange={(_, checked) => setConfig((prev) => ({ ...prev, enableBoostMaterials: checked }))}
                slotProps={{ input: { 'aria-label': 'controlled' } }}
              />
            }
            label="Enable Boost Material"
          />

          <Button
            variant="contained"
            onClick={() => {
              // Update the config file with the new settings
              ns.write(CONFIG_PATH, JSON.stringify(config), 'w')
              client.send('configUpdated')
            }}
            sx={{
              marginTop: 1,
            }}
          >
            Submit
          </Button>
        </FormControl>
      </Box>
    </FitContent>
  )
}
