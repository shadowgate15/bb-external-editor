import { TestScheduler } from 'rxjs/testing'

export function makeTestScheduler() {
  return new TestScheduler((actual, expected) => {
    expect(actual).toEqual(expected)
  })
}
