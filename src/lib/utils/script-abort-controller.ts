import 'reflect-metadata'

import { provide } from '@inversifyjs/binding-decorators'
import { injectable } from 'inversify'

@injectable('Singleton')
@provide()
export class ScriptAbortController extends AbortController {
  /**
   * This will create a child AbortController that will be aborted when the parent is aborted.
   * This is useful for creating abort controllers for individual tasks that should be aborted when the main script is aborted.
   */
  childController(child: AbortController) {
    const listener = () => {
      child.abort()
    }

    this.signal.addEventListener('abort', listener)
    child.signal.addEventListener('abort', () => {
      this.signal.removeEventListener('abort', listener)
    })
  }
}
