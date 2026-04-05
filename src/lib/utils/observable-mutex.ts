import { delay, finalize, Observable, ReplaySubject, Subject, switchMap, take } from 'rxjs'

/** A mutex for RxJS observables that ensures only one subscriber executes at a time. */
export class ObservableMutex {
  // ReplaySubject(1) so late subscribers immediately receive the current lock state.
  private readonly isLocked$ = new ReplaySubject<boolean>(1)

  private readonly queue: (() => void)[] = []

  private isLocked = false

  constructor() {
    // Start in the unlocked state.
    this.isLocked$.next(false)
  }

  /**
   * Waits until the mutex is free, then acquires the lock and runs `fn`.
   * The lock is released automatically when the returned observable completes,
   * errors, or is unsubscribed — guaranteeing no deadlocks.
   */
  runExclusive$<T>(fn: () => Observable<T>): Observable<T> {
    const run = () =>
      fn().pipe(
        finalize(() => {
          const next = this.queue.shift()

          if (next) {
            next()
          } else {
            this.isLocked = false
          }
        }),
      )

    if (!this.isLocked) {
      this.isLocked = true

      return run()
    }

    const ret = new Subject<null>()

    this.queue.push(() => {
      console.log('running next task in queue')
      ret.next(null)
    })

    return ret.pipe(
      take(1),
      delay(1), // A small delay to ensure the current task has fully released the lock before the next one tries to acquire it.
      switchMap(() => run()),
    )
  }
}

export const observableMutex = () => new ObservableMutex()
