import 'reflect-metadata'

import { provide } from '@inversifyjs/binding-decorators'
import { injectable } from 'inversify'

@injectable('Singleton')
@provide()
export class Deployer {}
