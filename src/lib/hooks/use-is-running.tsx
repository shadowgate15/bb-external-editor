import { FilenameOrPID, ScriptArg } from '@ns'
import { useQuery } from '@tanstack/react-query'

import { useNetscript } from './use-netscript'

export function useIsRunning(script: FilenameOrPID, ...args: ScriptArg[]) {
  const ns = useNetscript()

  return useQuery({
    queryKey: ['is-running', script, ...args],
    queryFn: () => ns.isRunning(script, 'home', ...args),
  })
}
