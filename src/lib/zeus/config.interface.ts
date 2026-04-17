import z from 'zod'

export const CONFIG_PATH = 'config.json'

export const configSchema = z.object({
  enableBoostMaterials: z.boolean().default(false),
  enableOptimizeJobs: z.boolean().default(false),
  enableEnergyMoraleOptimizer: z.boolean().default(false),
  jobProductionWeights: z
    .object({
      operations: z.number().default(1),
      engineer: z.number().default(1),
      business: z.number().default(0.5),
      management: z.number().default(0.5),
      research: z.number().default(1),
    })
    .default({
      operations: 1,
      engineer: 1,
      business: 0.5,
      management: 0.5,
      research: 1,
    }),
  /** Morale points to recover per cycle. Smaller steps are more cost-efficient than a single large jump. */
  moraleStepSize: z.number().default(10),
})
export type ConfigData = z.infer<typeof configSchema>
