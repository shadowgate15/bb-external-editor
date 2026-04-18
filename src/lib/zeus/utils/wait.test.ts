import { createNsMock } from '@ns-mock'

import { waitFor, waitForFunds } from './wait'

describe('waitFor', () => {
  let ns: ReturnType<typeof createNsMock>

  beforeEach(() => {
    ns = createNsMock()
    jest.mocked(ns.sleep).mockResolvedValue(true)
  })

  test('resolves immediately when condition is already true on first call', async () => {
    const condition = jest.fn().mockReturnValue(true)

    await waitFor(ns, condition)

    expect(ns.sleep).not.toHaveBeenCalled()
    expect(condition).toHaveBeenCalledTimes(1)
  })

  test('polls until condition becomes true', async () => {
    const condition = jest.fn().mockReturnValueOnce(false).mockReturnValueOnce(false).mockReturnValueOnce(true)

    await waitFor(ns, condition)

    expect(ns.sleep).toHaveBeenCalledTimes(2)
    expect(ns.sleep).toHaveBeenCalledWith(1000)
    expect(condition).toHaveBeenCalledTimes(3)
  })

  test('sleeps for 1000ms between polls', async () => {
    const condition = jest.fn().mockReturnValueOnce(false).mockReturnValueOnce(true)

    await waitFor(ns, condition)

    expect(ns.sleep).toHaveBeenCalledWith(1000)
  })
})

describe('waitForFunds', () => {
  let ns: ReturnType<typeof createNsMock>

  beforeEach(() => {
    ns = createNsMock()
    jest.mocked(ns.sleep).mockResolvedValue(true)
  })

  test('resolves immediately when funds already meet the required amount', async () => {
    jest
      .mocked(ns.corporation.getCorporation)
      .mockReturnValue({ funds: 1000 } as ReturnType<typeof ns.corporation.getCorporation>)

    await waitForFunds(ns, 500)

    expect(ns.sleep).not.toHaveBeenCalled()
  })

  test('resolves immediately when funds exactly equal the required amount', async () => {
    jest
      .mocked(ns.corporation.getCorporation)
      .mockReturnValue({ funds: 500 } as ReturnType<typeof ns.corporation.getCorporation>)

    await waitForFunds(ns, 500)

    expect(ns.sleep).not.toHaveBeenCalled()
  })

  test('polls until funds are sufficient', async () => {
    jest
      .mocked(ns.corporation.getCorporation)
      .mockReturnValueOnce({ funds: 100 } as ReturnType<typeof ns.corporation.getCorporation>)
      .mockReturnValueOnce({ funds: 200 } as ReturnType<typeof ns.corporation.getCorporation>)
      .mockReturnValueOnce({ funds: 1000 } as ReturnType<typeof ns.corporation.getCorporation>)

    await waitForFunds(ns, 500)

    expect(ns.sleep).toHaveBeenCalledTimes(2)
    expect(ns.sleep).toHaveBeenCalledWith(1000)
  })

  test('calls getCorporation on each poll', async () => {
    jest
      .mocked(ns.corporation.getCorporation)
      .mockReturnValueOnce({ funds: 0 } as ReturnType<typeof ns.corporation.getCorporation>)
      .mockReturnValueOnce({ funds: 1000 } as ReturnType<typeof ns.corporation.getCorporation>)

    await waitForFunds(ns, 500)

    expect(ns.corporation.getCorporation).toHaveBeenCalledTimes(2)
  })
})
