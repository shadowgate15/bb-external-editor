import { context } from 'esbuild'
import { BitburnerPlugin } from 'esbuild-bitburner-plugin'
import _ from 'lodash'
import { createRequire } from 'module'
import { nodeless } from 'unenv'

/** @type {(plugin: import('esbuild').Plugin) => import('esbuild').Plugin} */
const definePlugin = (plugin) => plugin

const nodelessPlugin = definePlugin({
  name: 'unenv-nodeless',
  setup(build) {
    const modules = ['events', 'node:events']
    const alias = _.pick(nodeless.alias, modules)

    const require = createRequire(import.meta.url)
    const aliasAbsolute = Object.fromEntries(
      Object.entries(alias).map(([key, value]) => [key, require.resolve(value).replace(/\.cjs$/, '.mjs')]),
    )

    build.onResolve(
      {
        filter: new RegExp(`^(${Object.keys(alias).join('|')})$`),
      },
      (args) => {
        const result = aliasAbsolute[args.path]
        return result ? { path: result } : undefined
      },
    )
  },
})

const createContext = async () =>
  await context({
    entryPoints: ['src/servers/**/*.js', 'src/servers/**/*.jsx', 'src/servers/**/*.ts', 'src/servers/**/*.tsx'],
    outbase: './src/servers',
    outdir: './build',
    plugins: [
      nodelessPlugin,
      BitburnerPlugin({
        port: 12525,
        types: 'NetscriptDefinitions.d.ts',
        remoteDebugging: true,
        mirror: {
          mirror: ['home'],
        },
        distribute: {},
      }),
    ],
    bundle: true,
    format: 'esm',
    platform: 'browser',
    logLevel: 'debug',
  })

const ctx = await createContext()
ctx.watch()
