import { CorpMaterialConstantData, CorpMaterialName, Product } from '@ns'

export interface GetLimitedRawProductionOpts {
  /** Unconstrained raw production value from `calculateRawProduction`. */
  rawProduction: number
  /** Size constants keyed by material name, from `ns.corporation.getMaterialData`. */
  outputUnitSpace: Record<CorpMaterialName, CorpMaterialConstantData>
  /** Names of materials produced by this division/city. Mutually exclusive with `products`. */
  producedMaterials?: CorpMaterialName[]
  /** Available warehouse free space (`size - sizeUsed`). */
  warehouseFreeSpace: number
  /** Products produced by this division/city. Mutually exclusive with `producedMaterials`. */
  products?: Product[]
}

/**
 * Caps raw production by the available warehouse free space.
 *
 * Multiplies `rawProduction` by 10 (the game's internal cycle multiplier), then
 * limits the result to the maximum number of complete output units that will fit
 * in the warehouse's free space.
 *
 * @param opts - Raw production value, output unit sizes, and warehouse free space.
 * @returns The warehouse-limited production value, or 0 if no output unit space is defined.
 */
export function getLimitedRawProduction(opts: GetLimitedRawProductionOpts): number {
  const { rawProduction, outputUnitSpace, producedMaterials, products } = opts

  const multipliedRawProduction = rawProduction * 10

  const totalOutputUnitSpace =
    producedMaterials?.reduce((acc, material) => acc + outputUnitSpace[material].size, 0) ??
    products?.reduce((acc, product) => acc + product.size, 0) ??
    0

  if (totalOutputUnitSpace > 0) {
    const maxNumberOfOutputs = Math.floor(opts.warehouseFreeSpace / totalOutputUnitSpace)
    return Math.min(multipliedRawProduction, maxNumberOfOutputs)
  }

  return 0
}
