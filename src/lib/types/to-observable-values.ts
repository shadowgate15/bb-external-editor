import { Observable } from 'rxjs'

export type ToObservableValues<T> = {
  [K in keyof T]: Observable<T[K]>
}
