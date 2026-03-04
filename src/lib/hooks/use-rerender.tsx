/** Hook that returns a function for the component. Optionally set an interval to rerender the component.
 * @param autoRerenderTime: Optional. If provided and nonzero, used as the ms interval to automatically call the rerender function.
 */
export function useRerender(autoRerenderTime?: number) {
  const [, setRerender] = React.useState(0)

  const rerender = React.useCallback(() => setRerender((currentValue) => currentValue + 1), [])

  React.useEffect(() => {
    if (!autoRerenderTime) return

    const intervalID = setInterval(rerender, autoRerenderTime)

    return () => clearInterval(intervalID)
  }, [rerender, autoRerenderTime])

  return rerender
}
