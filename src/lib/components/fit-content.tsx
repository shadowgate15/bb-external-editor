import React from 'react'
import { useNetscript } from '../hooks/use-netscript'
import { OnResizeCallback, useResizeDetector } from 'react-resize-detector'

export function FitContent({ children }: React.PropsWithChildren<object>) {
  const ns = useNetscript()
  const resizeCallback: OnResizeCallback = React.useCallback(
    (resize) => {
      ns.ui.resizeTail(resize.width, resize.height + 33)
    },
    [ns],
  )

  const { ref } = useResizeDetector<HTMLDivElement>({
    disableRerender: true,
    onResize: resizeCallback,
  })

  return (
    <div
      ref={ref}
      style={{
        minWidth: '216px',
        height: 'fit-content',
        width: 'fit-content',
      }}
    >
      {children}
    </div>
  )
}
