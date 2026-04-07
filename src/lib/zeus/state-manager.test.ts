import type { CorpStateName } from '@ns'
import { createNsMock } from '@ns-mock'
import { lastValueFrom, Observable, take, tap } from 'rxjs'
import { TestScheduler } from 'rxjs/testing'

import { StateManager } from './state-manager'

const testScheduler = new TestScheduler((actual, expected) => {
  expect(actual).toEqual(expected)
})

/** Yields control to the microtask queue so pending promise callbacks can run. */
const tick = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('StateManager', () => {
  const mockNs = createNsMock()

  // Controls when each `nextUpdate` promise resolves, preventing an unbounded
  // repeat() loop from flooding the microtask queue.
  let triggerUpdate: (state: CorpStateName) => void

  let sut: StateManager

  const getSut = () => new StateManager(mockNs)

  beforeEach(() => {
    jest
      .mocked(mockNs.corporation.nextUpdate)
      .mockImplementation(() => new Promise<CorpStateName>((resolve) => (triggerUpdate = resolve)))
    sut = getSut()
  })

  test('should be defined', () => {
    expect(sut).toBeDefined()
  })

  describe('state$', () => {
    test('should return observable', () => {
      expect(sut.state$()).toBeInstanceOf(Observable)
    })

    test('should emit the state resolved by nextUpdate', async () => {
      const result = lastValueFrom(sut.state$().pipe(take(1)))
      triggerUpdate('START')
      expect(await result).toBe('START')
    })

    test('should return the same observable instance on every call', () => {
      expect(sut.state$()).toBe(sut.state$())
    })

    test('should replay last emitted state synchronously to new subscribers', async () => {
      const first = lastValueFrom(sut.state$().pipe(take(1)))
      triggerUpdate('SALE')
      await first

      // shareReplay(1) replays buffered 'SALE' synchronously — marble (a|) at frame 0
      testScheduler.run(({ expectObservable }) => {
        expectObservable(sut.state$().pipe(take(1))).toBe('(a|)', { a: 'SALE' as CorpStateName })
      })
    })

    test('should not call nextUpdate again when replaying to a new subscriber', async () => {
      const first = lastValueFrom(sut.state$().pipe(take(1)))
      triggerUpdate('START')
      await first

      const callsBefore = (mockNs.corporation.nextUpdate as jest.Mock).mock.calls.length

      testScheduler.run(({ expectObservable }) => {
        expectObservable(sut.state$().pipe(take(1))).toBe('(a|)', { a: 'START' as CorpStateName })
      })

      expect(mockNs.corporation.nextUpdate).toHaveBeenCalledTimes(callsBefore)
    })

    test('should emit distinct states from consecutive nextUpdate resolutions', async () => {
      const emissions: CorpStateName[] = []
      const done = lastValueFrom(
        sut.state$().pipe(
          take(3),
          tap((s) => emissions.push(s)),
        ),
      )

      triggerUpdate('PURCHASE')
      await tick()
      triggerUpdate('PRODUCTION')
      await tick()
      triggerUpdate('SALE')
      await done

      expect(emissions).toEqual(['PURCHASE', 'PRODUCTION', 'SALE'])
    })
  })
})
