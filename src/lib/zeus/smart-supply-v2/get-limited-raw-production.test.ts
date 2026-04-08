import { CorpMaterialConstantData, CorpMaterialName, Product } from '@ns'

import { getLimitedRawProduction, GetLimitedRawProductionOpts } from './get-limited-raw-production'

const MATERIAL_DATA = {
  Plants: { name: 'Plants', size: 0.05 } as CorpMaterialConstantData,
  Water: { name: 'Water', size: 0.05 } as CorpMaterialConstantData,
} as Record<CorpMaterialName, CorpMaterialConstantData>

function makeMaterialOpts(overrides: Partial<GetLimitedRawProductionOpts> = {}): GetLimitedRawProductionOpts {
  return {
    rawProduction: 100,
    outputUnitSpace: MATERIAL_DATA,
    producedMaterials: ['Plants' as CorpMaterialName],
    warehouseFreeSpace: 1000,
    ...overrides,
  }
}

describe('getLimitedRawProduction', () => {
  test('multiplies rawProduction by 10 when warehouse has ample space', () => {
    const result = getLimitedRawProduction(makeMaterialOpts({ rawProduction: 50 }))

    // rawProduction * 10 = 500 units; 500 * 0.05 = 25 storage needed, fits in 1000
    expect(result).toBe(500)
  })

  test('caps production when warehouse free space is the limiting factor', () => {
    // Plants size = 0.05; warehouseFreeSpace = 10 → max 200 units
    const result = getLimitedRawProduction(
      makeMaterialOpts({
        rawProduction: 100, // would be 1000 units, but limited
        warehouseFreeSpace: 10,
      }),
    )

    expect(result).toBe(200)
  })

  test('returns warehouse-limited value when it is smaller than rawProduction * 10', () => {
    // rawProduction * 10 = 1000; Plants 0.05 → max = floor(5 / 0.05) = 100
    const result = getLimitedRawProduction(makeMaterialOpts({ rawProduction: 100, warehouseFreeSpace: 5 }))

    expect(result).toBe(100)
  })

  test('uses products when producedMaterials is not provided', () => {
    const products = [{ size: 0.1 } as Product]

    // rawProduction * 10 = 1000; product size = 0.1 → max = floor(1000 / 0.1) = 10000 → capped at 1000
    const result = getLimitedRawProduction({
      rawProduction: 100,
      outputUnitSpace: MATERIAL_DATA,
      warehouseFreeSpace: 1000,
      products,
    })

    expect(result).toBe(1000)
  })

  test('caps production when product size limits output', () => {
    const products = [{ size: 1 } as Product]

    // rawProduction * 10 = 1000; product size = 1 → max = floor(50 / 1) = 50
    const result = getLimitedRawProduction({
      rawProduction: 100,
      outputUnitSpace: MATERIAL_DATA,
      warehouseFreeSpace: 50,
      products,
    })

    expect(result).toBe(50)
  })

  test('returns 0 when neither producedMaterials nor products is provided', () => {
    const result = getLimitedRawProduction({
      rawProduction: 100,
      outputUnitSpace: MATERIAL_DATA,
      warehouseFreeSpace: 1000,
    })

    expect(result).toBe(0)
  })

  test('returns 0 when producedMaterials is an empty array', () => {
    const result = getLimitedRawProduction(makeMaterialOpts({ producedMaterials: [] }))

    expect(result).toBe(0)
  })

  test('sums sizes of multiple produced materials', () => {
    // Plants (0.05) + Water (0.05) = 0.1 per unit; warehouseFreeSpace = 10 → max = 100
    const result = getLimitedRawProduction(
      makeMaterialOpts({
        rawProduction: 100,
        producedMaterials: ['Plants' as CorpMaterialName, 'Water' as CorpMaterialName],
        warehouseFreeSpace: 10,
      }),
    )

    expect(result).toBe(100)
  })
})
