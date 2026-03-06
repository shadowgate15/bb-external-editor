import { FitContent } from '@/lib/components/fit-content'
import { ServerSelect } from '@/lib/components/server-select'
import { useNetscript } from '@/lib/hooks/use-netscript'
import { useServerList } from '@/lib/hooks/use-server-list'
import { mainWrapper } from '@/lib/window-app'
import Box from '@mui/material/Box'
import FormControl from '@mui/material/FormControl'
import React from 'react'
import { scoreServer, serversWithScoreAbove } from './deploy/get-target-server'
import FormControlLabel from '@mui/material/FormControlLabel'
import Switch from '@mui/material/Switch'
import Button from '@mui/material/Button'

export const main = mainWrapper(App)

function App() {
  const ns = useNetscript()
  ns.ui.setTailTitle('Start Batch')

  const [servers, reloadServers] = useServerList((server) => {
    if (server === 'home') return false

    const serverInfo = ns.getServer(server)

    // Only include servers that we own, since we don't want to run share.js on servers we don't control
    return !serverInfo.purchasedByPlayer
  })
  const scoredServers = React.useMemo(
    () =>
      serversWithScoreAbove(ns, servers)
        .filter(([server]) => !ns.isRunning('batch/main.js', 'home', server, '--home'))
        .map((s) => s[0]),
    [servers],
  )
  const [selectedServer, setSelectedServer] = React.useState('')
  const [shouldUseHome, setShouldUseHome] = React.useState(false)

  return (
    <FitContent>
      <Box sx={{ padding: 1 }}>
        <FormControl fullWidth>
          <ServerSelect
            servers={scoredServers}
            value={selectedServer}
            onChange={(e) => setSelectedServer(e.target.value)}
            itemRenderer={(server) => (
              <>
                {`${server} - ${ns.formatNumber(scoreServer(ns, server), 0)} - ${ns.formatNumber(ns.getServerMaxMoney(server), 2)}`}
              </>
            )}
          />
          <FormControlLabel
            control={<Switch value={shouldUseHome} onChange={(e) => setShouldUseHome(e.target.checked)} />}
            label="Home"
            sx={{ marginTop: 1 }}
          />
          <Button
            variant="contained"
            onClick={(e) => {
              e.preventDefault()

              const args = [selectedServer]

              if (shouldUseHome) {
                args.push('--home')
              }

              ns.exec('batch/main.js', 'home', 1, ...args)
              ns.toast(`Started batch on server: ${selectedServer} with args: ${args.join(', ')}`, 'success')
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
