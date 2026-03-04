//@ts-expect-error will not be null at runtime
export const NetscriptContext = React.createContext<NS>(null)
//@ts-expect-error will not be null at runtime
export const TerminateContext = React.createContext<() => void>(null)
//@ts-expect-error will not be null at runtime
export const TailRootContext = React.createContext<HTMLElement>(null)
