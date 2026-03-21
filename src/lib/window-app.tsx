import Box from '@mui/material/Box'
import { createTheme, Theme, ThemeProvider } from '@mui/material/styles'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

import { NetscriptContext, TerminateContext } from './context'
import { useTerminate } from './hooks/use-terminate'

function createThemeFromNS(ns: NS): Theme {
  const nsTheme = ns.ui.getTheme()
  const nsStyle = ns.ui.getStyles()

  const getPaletteColor = (color: string) => ({
    main: color,
  })

  return createTheme({
    typography: {
      fontFamily: nsStyle.fontFamily,
      fontSize: nsStyle.tailFontSize,
    },
    palette: {
      primary: getPaletteColor(nsTheme.primary),
      secondary: getPaletteColor(nsTheme.secondary),
      error: getPaletteColor(nsTheme.error),
      warning: getPaletteColor(nsTheme.warning),
      info: getPaletteColor(nsTheme.info),
      success: getPaletteColor(nsTheme.success),
      mode: 'dark',
    },
    zIndex: {
      mobileStepper: 10000,
      fab: 10500,
      speedDial: 10500,
      appBar: 11000,
      drawer: 12000,
      modal: 13000,
      snackbar: 14000,
      tooltip: 15000,
    },
  })
}

export async function createWindowApp(ns: NS, Component: React.FunctionComponent) {
  ns.ui.openTail()
  ns.disableLog('ALL')
  ns.clearLog()
  ns.ui.renderTail()
  await ns.asleep(0) // give up control so DOM can update

  ns.atExit(() => ns.ui.closeTail(), crypto.randomUUID())

  // Create a client
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000, // 1 second
        refetchInterval: 1000, // 1 second
      },
    },
  })

  return new Promise<void>((resolve) => {
    ns.printRaw(
      <NetscriptContext.Provider value={ns}>
        <TerminateContext.Provider value={resolve}>
          <ThemeProvider theme={createThemeFromNS(ns)}>
            <QueryClientProvider client={queryClient}>
              <TerminateOnUnmount>
                <Component></Component>
              </TerminateOnUnmount>
            </QueryClientProvider>
          </ThemeProvider>
        </TerminateContext.Provider>
      </NetscriptContext.Provider>,
    )
    ns.ui.renderTail()
  })
}

function TerminateOnUnmount({ children }: React.PropsWithChildren<object>) {
  const terminate = useTerminate()

  React.useEffect(() => {
    return () => {
      terminate()
    }
  }, [terminate])

  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
      }}
    >
      {children}
    </Box>
  )
}

export const mainWrapper = (Component: React.FunctionComponent) => (ns: NS) =>
  createWindowApp(ns, Component).catch(console.error)
