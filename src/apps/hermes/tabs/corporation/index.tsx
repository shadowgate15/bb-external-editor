import Box from '@mui/material/Box'
import React from 'react'

import { useNetscript } from '@/lib/hooks/use-netscript'
import { createCorporationDaemonClient } from '@/lib/zeus/daemon/client'

import { CorpClientContext } from './hooks/use-corp-client'
import { Config } from './pages/config'
import { Home } from './pages/home'

export enum Page {
  Home,
  Config,
}

export function Corporation() {
  const ns = useNetscript()
  const corpClient = React.useMemo(() => createCorporationDaemonClient(ns), [ns])

  const [page, setPage] = React.useState(Page.Home)

  const child = React.useMemo(() => {
    switch (page) {
      case Page.Config:
        return <Config onBack={() => setPage(Page.Home)} />
      case Page.Home:
      default:
        return <Home onConfig={() => setPage(Page.Config)} />
    }
  }, [page, setPage])

  return (
    <CorpClientContext.Provider value={corpClient}>
      <Box
        sx={{
          padding: 1,
        }}
      >
        {child}
      </Box>
    </CorpClientContext.Provider>
  )
}
