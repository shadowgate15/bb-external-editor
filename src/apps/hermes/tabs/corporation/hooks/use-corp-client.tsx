import React from 'react'

import { CoprationDaemonClient } from '@/lib/zeus/daemon/client'

export const CorpClientContext = React.createContext<CoprationDaemonClient | null>(null)

export function useCorpClient() {
  const corpClient = React.useContext(CorpClientContext)

  if (corpClient === null) {
    throw new Error('useCorpClient must be used within a CorpClientProvider')
  }

  return corpClient
}
