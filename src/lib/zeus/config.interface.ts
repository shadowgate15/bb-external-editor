import z from 'zod'

export const CONFIG_PATH = 'config.json'

export const configSchema = z.object({
  enableBoostMaterials: z.boolean().default(false),
})
export type ConfigData = z.infer<typeof configSchema>
