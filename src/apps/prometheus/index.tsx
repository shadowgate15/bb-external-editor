import React from 'react'
import { useNetscript } from '@/lib/hooks/use-netscript'
import { useServerList } from '@/lib/hooks/use-server-list'
import Button from '@mui/material/Button'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import { ServerSelect } from '@/lib/components/server-select'

export function Prometheus() {
  const ns = useNetscript()
  ns.ui.setTailTitle('Prometheus')

  const [servers, reloadServers] = useServerList((server) => {
    if (server === 'home') return false

    const serverInfo = ns.getServer(server)

    // Only include servers that we own, since we don't want to run share.js on servers we don't control
    return serverInfo.purchasedByPlayer && serverInfo.ramUsed === 0
  })
  const [selectedServer, setSelectedServer] = React.useState(servers[0] || '')

  function submit(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault()

    const target = selectedServer

    ns.scp('share.js', target)

    const scriptRam = ns.getScriptRam('share.js')
    const maxThreads = Math.floor(ns.getServerMaxRam(target) / scriptRam)

    ns.exec('share.js', target, { threads: maxThreads, temporary: true })
    ns.toast(`Sharing data from server: ${target} with ${maxThreads} threads`, 'success')
    reloadServers()
    setSelectedServer(servers[0] || '')
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
      }}
    >
      <FormControl
        variant="standard"
        fullWidth
        sx={{
          marginTop: 1,
        }}
      >
        <ServerSelect servers={servers} value={selectedServer} onChange={(e) => setSelectedServer(e.target.value)} />

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
    </div>
  )
}
