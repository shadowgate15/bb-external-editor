import 'reflect-metadata'

import { buildProviderModule, provide } from '@inversifyjs/binding-decorators'
import { Container, type Factory, inject, injectable } from 'inversify'

import { NSIdentifier } from '@/lib/ns.identifier'

const FACTORY = Symbol('Factory')
const TARGET = Symbol('Target')

export async function main(ns: NS) {
  ns.ui.openTail()

  const container = new Container()

  container.bind(NSIdentifier).toConstantValue(ns)

  container.load(buildProviderModule())
  container.bind(TARGET).toConstantValue(null)

  container.bind<Factory<Request>>(FACTORY).toFactory((context) => {
    return () => {
      const target = context.get(TARGET)

      const request = context.get(Request)
      request.target = 'home'

      ns.print(`Target: ${target}, Request: ${request}`)
      ns.print(`Target === Request.target: ${target === request.target}`)

      ns.print(`SubRequest.target: ${request.subRequest.target}`)
      ns.print(`Target === SubRequest.target: ${target === request.subRequest.target}`)
      ns.print(`Request.target === SubRequest.target: ${request.target === request.subRequest.target}`)

      return request
    }
  })

  container.get(Singleton).run()
}

@injectable('Request')
@provide()
class SubRequest {
  @inject(TARGET)
  readonly target!: string
}

@injectable('Request')
@provide()
class Request {
  @inject(TARGET)
  target!: string

  @inject(SubRequest)
  readonly subRequest!: SubRequest
}

@injectable('Singleton')
@provide()
class A {
  @inject(Request)
  readonly request!: Request
}

@injectable('Singleton')
@provide()
class B {
  @inject(Request)
  readonly request!: Request
}

@injectable('Singleton')
@provide()
class Singleton {
  @inject(NSIdentifier)
  readonly ns!: NS

  @inject(FACTORY)
  readonly factory!: Factory<Request>

  @inject(Request)
  readonly request!: Request

  @inject(A)
  readonly a!: A

  @inject(B)
  readonly b!: B

  run() {
    const request = this.factory()

    this.ns.print(`this.request === factory request: ${this.request === request}`)
    this.ns.print(`this.a.request === factory request: ${this.a.request === request}`)
    this.ns.print(`this.b.request === factory request: ${this.b.request === request}`)
    this.ns.print(`this.a.request === this.b.request: ${this.a.request === this.b.request}`)
  }
}
