import { CorpMaterialConstantData, CorpMaterialName, Product } from '@ns'

export interface GetLimitedRawProductionOpts {
  rawProduction: number
  outputUnitSpace: Record<CorpMaterialName, CorpMaterialConstantData>
  producedMaterials?: CorpMaterialName[]
  warehouseFreeSpace: number
  products?: Product[]
}

export function getLimitedRawProduction(opts: GetLimitedRawProductionOpts): number {
  const { rawProduction, outputUnitSpace, producedMaterials, products } = opts

  const mulitpliedRawProduction = rawProduction * 10

  const totalOutputUnitSpace =
    producedMaterials?.reduce((acc, material) => acc + outputUnitSpace[material].size, 0) ??
    products?.reduce((acc, product) => acc + product.size, 0) ??
    0

  if (totalOutputUnitSpace > 0) {
    const maxNumberOfOutputs = Math.floor(opts.warehouseFreeSpace / totalOutputUnitSpace)

    return Math.min(mulitpliedRawProduction, maxNumberOfOutputs)
  }

  return 0
}
