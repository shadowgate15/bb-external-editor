import type { CorpStateName, NS } from '@ns'
import { Observable, Subject } from 'rxjs'

export type StateManagerMock = {
  state$: jest.MockedFunction<() => Observable<CorpStateName>>
  _subject: Subject<CorpStateName>
}

export function createStateManagerMock(_ns: NS): StateManagerMock {
  const subject = new Subject<CorpStateName>()
  return {
    state$: jest.fn<Observable<CorpStateName>, []>().mockReturnValue(subject.asObservable()),
    _subject: subject,
  }
}

export const StateManager = jest.fn().mockImplementation(createStateManagerMock)
