import z from 'zod'

export const CONFIG_PATH = 'config.json'

export const configSchema = z.object({
  enableBoostMaterials: z.boolean().default(false),
  enableOptimizeJobs: z.boolean().default(false),
  jobProductionWeights: z
    .object({
      operations: z.number().default(1),
      engineer: z.number().default(1),
      business: z.number().default(0.5),
      management: z.number().default(0.5),
      research: z.number().default(1),
    })
    .default({}),
})
export type ConfigData = z.infer<typeof configSchema>
