import React from 'react'

export function useId() {
  return React.useMemo(() => new TextDecoder().decode(crypto.getRandomValues(new Uint8Array(5))), [])
}
