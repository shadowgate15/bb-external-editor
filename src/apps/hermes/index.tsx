import Box from '@mui/material/Box'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import React from 'react'

import { FitContent } from '@/lib/components/fit-content'
import { useNetscript } from '@/lib/hooks/use-netscript'

import { Launcher } from './tabs/launcher'

const TAB_MAP = {
  Launcher: <Launcher />,
}
type TabMap = typeof TAB_MAP

const TABS = Object.keys(TAB_MAP) as (keyof TabMap)[]

export function Hermes() {
  const ns = useNetscript()
  ns.ui.setTailTitle('Hermes')

  const [selectedTab, setSelectedTabe] = React.useState<keyof TabMap>('Launcher')
  const tabContent = React.useMemo(() => TAB_MAP[selectedTab], [selectedTab])

  return (
    <FitContent>
      <Box
        sx={{
          minWidth: 700,
        }}
      >
        <Tabs centered value={selectedTab} onChange={(_, newValue) => setSelectedTabe(newValue)}>
          {TABS.map((tab) => (
            <Tab value={tab} label={tab} key={tab} />
          ))}
        </Tabs>

        <Box>{tabContent}</Box>
      </Box>
    </FitContent>
  )
}
