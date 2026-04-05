import { delay, of, Subject, tap, throwError } from 'rxjs'

import { ObservableMutex } from './observable-mutex'

describe('ObservableMutex', () => {
  let mutex: ObservableMutex

  beforeEach(() => {
    jest.useFakeTimers()
    mutex = new ObservableMutex()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  test('should execute a single observable', (done) => {
    const result: number[] = []

    mutex
      .runExclusive$(() => of(42))
      .subscribe({
        next: (v) => result.push(v),
        complete: () => {
          expect(result).toEqual([42])
          done()
        },
      })
  })

  test('should run observables sequentially (not in parallel)', (done) => {
    const order: string[] = []

    const first$ = () =>
      of(null).pipe(
        tap(() => order.push('start-1')),
        delay(100),
        tap(() => order.push('end-1')),
      )

    const second$ = () =>
      of(null).pipe(
        tap(() => order.push('start-2')),
        delay(100),
        tap(() => order.push('end-2')),
      )

    mutex.runExclusive$(first$).subscribe()
    mutex.runExclusive$(second$).subscribe({
      complete: () => {
        expect(order).toEqual(['start-1', 'end-1', 'start-2', 'end-2'])
        done()
      },
    })

    jest.advanceTimersByTime(300)
  })

  test('should release lock after completion', (done) => {
    const calls: number[] = []

    const fn = (id: number) => () =>
      of(id).pipe(
        tap(() => calls.push(id)),
        delay(50),
      )

    mutex.runExclusive$(fn(1)).subscribe()
    mutex.runExclusive$(fn(2)).subscribe({
      complete: () => {
        expect(calls).toEqual([1, 2])
        done()
      },
    })

    jest.advanceTimersByTime(200)
  })

  test('should release lock after error', (done) => {
    const calls: string[] = []

    const errorFn = () =>
      throwError(() => new Error('fail')).pipe(
        tap({
          error: () => calls.push('error'),
        }),
      )

    const successFn = () => of(null).pipe(tap(() => calls.push('success')))

    mutex.runExclusive$(errorFn).subscribe({
      error: () => {},
    })

    mutex.runExclusive$(successFn).subscribe({
      complete: () => {
        expect(calls).toEqual(['error', 'success'])
        done()
      },
    })
  })

  test('should release lock on unsubscribe', () => {
    const subject = new Subject<void>()
    const calls: string[] = []

    const sub = mutex.runExclusive$(() => subject.pipe(tap(() => calls.push('running')))).subscribe()

    // Start execution
    subject.next()

    // Unsubscribe before completion
    sub.unsubscribe()

    // Next task should run
    mutex.runExclusive$(() => of(null).pipe(tap(() => calls.push('next')))).subscribe()

    expect(calls).toContain('next')
  })

  test('should not execute second task until first completes', () => {
    const subject = new Subject<void>()
    const calls: string[] = []

    mutex.runExclusive$(() => subject.pipe(tap(() => calls.push('first')))).subscribe()

    mutex.runExclusive$(() => of(null).pipe(tap(() => calls.push('second')))).subscribe()

    // Trigger first
    subject.next()

    // Second should not run yet because first hasn't completed
    expect(calls).toEqual(['first'])

    // Complete first
    subject.complete()

    expect(calls).toEqual(['first', 'second'])
  })
})
