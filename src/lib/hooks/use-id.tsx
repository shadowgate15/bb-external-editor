import React from 'react'

let id = 0

export function useId() {
  return React.useMemo(() => id++, [])
}
