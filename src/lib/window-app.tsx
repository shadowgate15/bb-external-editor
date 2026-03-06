import { createPortal } from 'react-dom'
import { findTailRoot, watchElForDeletion } from './bitburner-dom'
import { NetscriptContext, TerminateContext, TailRootContext } from './context'
import React from 'react'
import { createTheme, Theme, ThemeProvider } from '@mui/material/styles'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

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
  ns.printRaw(<span data-pid={ns.pid}></span>)
  ns.ui.renderTail()
  await ns.asleep(0) // give up control so DOM can update
  const root = findTailRoot(document.querySelector(`span[data-pid="${ns.pid}"]`)!)

  const controller = new AbortController()
  ns.atExit(() => (controller.abort(), ns.ui.closeTail()), crypto.randomUUID())

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
    watchElForDeletion(root, () => resolve(), controller.signal)
    ns.printRaw(
      <>
        {createPortal(
          <NetscriptContext.Provider value={ns}>
            <TerminateContext.Provider value={resolve}>
              <TailRootContext.Provider value={root}>
                <ThemeProvider theme={createThemeFromNS(ns)}>
                  <QueryClientProvider client={queryClient}>
                    <div
                      style={{
                        position: 'relative',
                        color: ns.ui.getTheme().primarylight,
                        width: '100%',
                        height: '100%',
                      }}
                    >
                      <Component></Component>
                    </div>
                  </QueryClientProvider>
                </ThemeProvider>
              </TailRootContext.Provider>
            </TerminateContext.Provider>
          </NetscriptContext.Provider>,
          root,
        )}
      </>,
    )
    ns.ui.renderTail()
  })
}

export const mainWrapper = (Component: React.FunctionComponent) => (ns: NS) =>
  createWindowApp(ns, Component).catch(console.error)
