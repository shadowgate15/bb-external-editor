# Copilot Instructions

## Project Overview

This is an external editor template/framework for the game [Bitburner](https://github.com/bitburner-official/bitburner-src). It uses esbuild to bundle TypeScript/TSX scripts and syncs them to the game via a Remote API server (`npm start`). Scripts placed under `src/servers/<servername>/` are automatically uploaded to the corresponding in-game server.

## Commands

```sh
pnpm start        # Start the esbuild watcher + Bitburner RemoteAPI server (port 12525)
pnpm test         # Run all Jest tests
pnpm test -- --testPathPattern=<file>  # Run a single test file
pnpm lint         # Run ESLint with auto-fix
```

## Architecture

### File Hierarchy → Game Servers

`src/servers/<servername>/<path>.ts` compiles and uploads to `<servername>/<path>.js` in-game. The `mirror/` directory mirrors live game server content back to the local filesystem (configured in `config.mjs`).

### Key Layers

- **`src/servers/`** — Bitburner scripts. Every entry point must export `async function main(ns: NS)`.
- **`src/apps/`** — React UI apps rendered in Bitburner tail windows. Each app is a React component wrapped with `createWindowApp()`.
- **`src/lib/`** — Shared library code:
  - `zeus/` — Corporation automation; uses Inversify DI modules (`zeusModule`) and RxJS observables.
  - `thread-manager.ts` — RAM allocation across servers.
  - `window-app.tsx` — `createWindowApp(ns, Component)`: the standard factory to launch a React UI in a tail window. Sets up MUI theme from game styles, TanStack Query, and NS/Terminate React contexts.
  - `context.tsx` — `NetscriptContext` and `TerminateContext` React contexts.

### Dependency Injection (Inversify)

Services use `@injectable()` + `@provide()` decorators. NS is bound with `NSIdentifier` (`Symbol.for('NS')`), not injected by type. Services are registered in `ContainerModule`s (e.g., `zeusModule`).

```ts
@injectable()
@provide(undefined, (bind) => {
  bind.inSingletonScope()
})
export class MyService {
  constructor(@inject(NSIdentifier) private readonly ns: NS) {}
}
```

### React in Bitburner

- Access `ns` in components via `useNetscript()` (wraps `useContext(NetscriptContext)`).
- Use `createWindowApp(ns, Component)` as the `main` body in UI scripts — it resolves when the tail window is closed.
- MUI components are used for all UI; the theme is generated from game's `ns.ui.getTheme()` / `ns.ui.getStyles()`.
- TanStack Query (`useQuery`) handles data fetching with 1s stale/refetch intervals.

## Channel (`src/lib/channel.ts`)

`NSChannel` is a typed JSON-RPC 2.0 bidirectional channel built on Bitburner ports. Extend it to define an IPC protocol between two scripts.

```ts
class MyChannel extends NSChannel<ServerMethods, ClientMethods> {
  setupMethods() {
    this.server.addMethod('doThing', (params) => {
      /* handle */
    })
  }
  async preListen() {
    /* runs once before the listen loop */
  }
}

const ch = new MyChannel(ns, FROM_PORT, TO_PORT)
ch.send('notify', { data: 123 }) // fire-and-forget to other side
await ch.listen() // blocks until ch.close() or ns.atExit
```

- `TServer` = methods this side **handles**; `TClient` = methods this side **calls**.
- `listen()` loops on `ns.nextPortWrite(from)` and dispatches JSON-RPC messages via `server.receive()`.
- `close()` (and `ns.atExit`) write an abort sentinel to the port, breaking the listen loop.

## Port Number System (`src/lib/port-number/`)

Encodes structured meaning into Bitburner port integers using a fixed digit layout:

```text
[satyr:1][nymph:2][muse:2][hero:2][titan:2][ip:5]
```

The `ip` segment is the target server's IP digits joined (e.g. `1.2.3.4` → `01020304`). **Always** start a builder from a server:

```ts
const port = PortNumberBuilder.fromServer(ns, 'home')
  .batch() // sets Titan = Titan.Batch
  .parent() // sets Hero = Hero.Parent
  .fillRandom() // fills remaining segments, returns port number (integer)
```

**`PortProvider`** (injectable singleton via Inversify) is the preferred way to allocate ports at runtime — it tracks in-use ports and avoids collisions:

```ts
const [port, release] = portProvider.batchParent()
// ... use port ...
release() // mark port as free
```

### Adding a new subsystem

1. Add an entry to `Titan` enum in `src/lib/port-number/titan/index.enum.ts` (max 47 values — enforced by `assertTitanEnum`).
2. Create `src/lib/port-number/titan/<name>.ts` extending `BasePortNumberBuilder`. Define a `Hero` enum (max 25 values) and methods that set `PortNumberType.Hero`.
3. Export the new builder from `titan/index.ts`.
4. Add a method on `PortNumberBuilder` that calls `this.assignPort(PortNumberType.Titan, Titan.<Name>)` and returns the new builder.

## Key Conventions

### Path Aliases (tsconfig)

| Alias      | Resolves to                                     |
| ---------- | ----------------------------------------------- |
| `@/*`      | `src/*`                                         |
| `@home/*`  | `src/servers/home/*`                            |
| `@ns`      | `NetscriptDefinitions.d.ts` (game types)        |
| `@ns-mock` | `__mocks__/NetscriptDefinitions.ts` (Jest mock) |

### Testing

- Use `createNsMock()` from `@ns-mock` to get a fully-mocked, `jest.Mocked<NS>` instance.
- Use `makeTestScheduler()` from `__helpers__/test-scheduler` for RxJS marble tests.
  - This should be run as part of `beforeEach()` in any test suite that uses RxJS, and the returned `TestScheduler` should be used for all marble assertions in that suite.
- Test files match `**/*.+(spec|test).[jt]s?(x)` or files under `__tests__/`.

```ts
import { createNsMock } from '@ns-mock'
import { makeTestScheduler } from '__helpers__/test-scheduler'

const ns = createNsMock()
jest.mocked(ns.hack).mockResolvedValue(100)
```

### Documentation

Comments should be JSDoc style, with `/** ... */` and `@param`/`@returns` tags. For complex functions, include a brief description of the overall purpose in addition to parameter descriptions.

```ts
/**
 * Hack the specified server and return the amount of money hacked.
 *
 * @param target - The hostname of the server to hack.
 * @returns The amount of money hacked from the target server.
 */
async function hackServer(target: string): Promise<number> {
  // implementation
}
```

#### RxJS Pipelines

Document each operator step in an observable pipeline with a comment on the line above explaining what that step does:

```ts
source$.pipe(
  // ignore non-tick events
  filter((event) => event.type === 'tick'),
  // extract payload
  map((event) => event.payload),
  // wait for burst of ticks to settle
  debounceTime(200),
  // cancel in-flight request on new tick
  switchMap((payload) => fetchData(payload)),
)
```

### Code Style (Prettier)

- Single quotes, no semicolons, 2-space indent, 120-character print width, trailing commas.
- Imports are auto-sorted by `eslint-plugin-simple-import-sort` (enforced as error).
- Unused variables prefixed with `_` are ignored by ESLint.

## Corporation Automation (Zeus)

The `zeus/` library provides high-level abstractions for automating corporation management. It uses Inversify for DI and RxJS for reactive state management. The main entry point is the `Zeus` class, which orchestrates various services like `DivisionManager`, `EmployeeManager`, and `UpgradeManager`. Each service exposes methods to perform specific tasks (e.g., hiring employees, purchasing upgrades) and maintains observables for relevant state (e.g., current funds, employee count). The `zeusModule` registers all services in the DI container, allowing them to be injected into scripts or other services as needed.

### Extra Documentation

Additional documentation/suggestions for the in-game mechanics can be found at this [google doc](https://drive.google.com/file/d/1PCKaKgMBXrYsPyZ-vTRR9MBQI-f6ersJ/view) by CatLover.
