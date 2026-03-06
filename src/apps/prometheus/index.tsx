import React from 'react'
import { useNetscript } from '@/lib/hooks/use-netscript'
import { useServerList } from '@/lib/hooks/use-server-list'
import Button from '@mui/material/Button'
import FormControl from '@mui/material/FormControl'
import { ServerSelect } from '@/lib/components/server-select'
import { FitContent } from '@/lib/components/fit-content'
import Box from '@mui/material/Box'

export function Prometheus() {
  const ns = useNetscript()
  ns.ui.setTailTitle('Prometheus')

  const [servers, reloadServers] = useServerList((server) => {
    if (server === 'home') return false

    const serverInfo = ns.getServer(server)

    // Only include servers that we own, since we don't want to run share.js on servers we don't control
    return serverInfo.purchasedByPlayer && serverInfo.ramUsed === 0
  })
  const [selectedServer, setSelectedServer] = React.useState('')

  function submit(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault()

    const target = selectedServer

    ns.scp('share.js', target)

    const scriptRam = ns.getScriptRam('share.js')
    const maxThreads = Math.floor(ns.getServerMaxRam(target) / scriptRam)

    ns.exec('share.js', target, { threads: maxThreads, temporary: true })
    ns.toast(`Sharing data from server: ${target} with ${maxThreads} threads`, 'success')

    reloadServers()

    setSelectedServer('')
  }

  return (
    <FitContent>
      <Box
        sx={{
          padding: 1,
        }}
      >
        <FormControl variant="standard" fullWidth>
          <ServerSelect
            servers={servers}
            value={selectedServer}
            onChange={(e) => {
              return setSelectedServer(e.target.value)
            }}
          />

          <Button
            variant="contained"
            onClick={submit}
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
