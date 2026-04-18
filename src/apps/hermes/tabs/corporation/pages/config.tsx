import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import Accordion from '@mui/material/Accordion'
import AccordionDetails from '@mui/material/AccordionDetails'
import AccordionSummary from '@mui/material/AccordionSummary'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import FormControl from '@mui/material/FormControl'
import FormControlLabel from '@mui/material/FormControlLabel'
import Grid from '@mui/material/Grid'
import Switch from '@mui/material/Switch'
import Typography from '@mui/material/Typography'
import React from 'react'
import { filter, first, map } from 'rxjs'
import { PartialDeep } from 'type-fest'

import { usePortServer } from '@/apps/hermes/hooks/use-port-server'
import NumberField from '@/lib/components/number-field'
import { useNetscript } from '@/lib/hooks/use-netscript'
import { ConfigData, configSchema } from '@/lib/zeus/config.interface'

import { useCorpClient } from '../hooks/use-corp-client'

export interface ConfigProps {
  onBack: () => void
}

const useExpanded = () => {
  const [expanded, setExpanded] = React.useState<string | false>(false)

  return [
    expanded,
    setExpanded,
    function handleChange(panel: string) {
      return (event: React.SyntheticEvent, isExpanded: boolean) => setExpanded(isExpanded ? panel : false)
    },
  ] as const
}

export function Config({ onBack }: ConfigProps) {
  const ns = useNetscript()
  const corpClient = useCorpClient()
  const portServer = usePortServer()

  const [config, setConfig] = React.useState<ConfigData | null>(null)
  const [expanded, setExpanded, handleChange] = useExpanded()

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

  const modifyConfig = React.useCallback(
    (nextConfig: PartialDeep<ConfigData>) => {
      const { jobProductionWeights, ...restConfig } = nextConfig
      corpClient.send(
        'configUpdated',
        configSchema.parse({
          ...(config ?? {}),
          jobProductionWeights: {
            ...(config?.jobProductionWeights ?? {}),
            ...(jobProductionWeights ?? {}),
          },
          ...(restConfig ?? {}),
        }),
      )

      setConfig(null)

      setTimeout(() => {
        fetchConfig()
      }, 100)
    },
    [corpClient, setConfig, fetchConfig],
  )

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
                  onChange={(_, checked) => modifyConfig({ enableBoostMaterials: checked })}
                  slotProps={{ input: { 'aria-label': 'controlled' } }}
                />
              }
              label="Enable Boost Material"
            />

            <FormControlLabel
              control={
                <Switch
                  checked={config.enableOptimizeJobs}
                  onChange={(_, checked) => modifyConfig({ enableOptimizeJobs: checked })}
                  slotProps={{ input: { 'aria-label': 'controlled' } }}
                />
              }
              label="Enable Optimize Jobs"
            />

            <FormControlLabel
              control={
                <Switch
                  checked={config.enableEnergyMoraleOptimizer}
                  onChange={(_, checked) => modifyConfig({ enableEnergyMoraleOptimizer: checked })}
                  slotProps={{ input: { 'aria-label': 'controlled' } }}
                />
              }
              label="Enable Energy Morale Optimizer"
            />

            <Accordion expanded={expanded === 'jobProductionWeights'} onChange={handleChange('jobProductionWeights')}>
              <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                aria-controls="jobProductionWeights-content"
                id="jobProductionWeights-header"
              >
                <Typography component="span">Job Production Weights</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <NumberField
                  label="Operations"
                  value={config.jobProductionWeights.operations}
                  step={0.1}
                  onValueChange={(value) => modifyConfig({ jobProductionWeights: { operations: value || 0 } })}
                />

                <NumberField
                  label="Engineer"
                  value={config.jobProductionWeights.engineer}
                  step={0.1}
                  onValueChange={(value) => modifyConfig({ jobProductionWeights: { engineer: value || 0 } })}
                />

                <NumberField
                  label="Business"
                  value={config.jobProductionWeights.business}
                  step={0.1}
                  onValueChange={(value) => modifyConfig({ jobProductionWeights: { business: value || 0 } })}
                />

                <NumberField
                  label="Management"
                  value={config.jobProductionWeights.management}
                  step={0.1}
                  onValueChange={(value) => modifyConfig({ jobProductionWeights: { management: value || 0 } })}
                />

                <NumberField
                  label="Research & Development"
                  value={config.jobProductionWeights.research}
                  step={0.1}
                  onValueChange={(value) => modifyConfig({ jobProductionWeights: { research: value || 0 } })}
                />
              </AccordionDetails>
            </Accordion>
          </FormControl>
        )}
      </Grid>
    </Grid>
  )
}
