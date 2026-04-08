import { computePurchasePlan, ComputePurchasePlanOpts } from './compute-purchase-plan'

function makeOpts(overrides: Partial<ComputePurchasePlanOpts> = {}): ComputePurchasePlanOpts {
  return {
    totalRawProduction: 1000,
    requiredMaterials: { Water: 0.5, Chemicals: 0.2 },
    materialSizes: {
      Water: { size: 0.05 },
      Chemicals: { size: 0.05 },
    },
    warehouseFreeSpace: 10000,
    inventory: {},
    ...overrides,
  }
}

describe('computePurchasePlan', () => {
  test('returns correct amounts with ample warehouse space and empty inventory', () => {
    // TRP = 1000; Water: 0.5*1000 = 500; Chemicals: 0.2*1000 = 200
    // worseAmt = min(500/0.5, 200/0.2) = min(1000, 1000) = 1000
    // aligned Water = 500, Chemicals = 200
    // totalSize = 500*0.05 + 200*0.05 = 25+10 = 35 → fits in 10000 → no scaling
    const result = computePurchasePlan(makeOpts())

    expect(result.Water).toBe(500)
    expect(result.Chemicals).toBe(200)
  })

  test('subtracts existing inventory from required amounts', () => {
    const result = computePurchasePlan(makeOpts({ inventory: { Water: 100, Chemicals: 50 } }))

    expect(result.Water).toBe(400)
    expect(result.Chemicals).toBe(150)
  })

  test('clamps to 0 when stored exceeds required amount', () => {
    const result = computePurchasePlan(makeOpts({ inventory: { Water: 1000, Chemicals: 0 } }))

    expect(result.Water).toBe(0)
    expect(result.Chemicals).toBe(200)
  })

  test('scales down all materials when totalSize exceeds free space', () => {
    // TRP=1000; aligned Water=500, Chemicals=200
    // totalSize = 500*0.05 + 200*0.05 = 35
    // freeSpace=17.5 → multiplier = 17.5/35 = 0.5
    // Water: 500*0.5 = 250; Chemicals: 200*0.5 = 100
    const result = computePurchasePlan(makeOpts({ warehouseFreeSpace: 17.5 }))

    expect(result.Water).toBeCloseTo(250)
    expect(result.Chemicals).toBeCloseTo(100)
  })

  test('scales and then subtracts inventory', () => {
    // multiplier = 0.5 (from above); Water: 250 - 50 = 200; Chemicals: 100 - 30 = 70
    const result = computePurchasePlan(makeOpts({ warehouseFreeSpace: 17.5, inventory: { Water: 50, Chemicals: 30 } }))

    expect(result.Water).toBeCloseTo(200)
    expect(result.Chemicals).toBeCloseTo(70)
  })

  test('handles a single input material', () => {
    const result = computePurchasePlan(
      makeOpts({
        requiredMaterials: { Plants: 1 },
        materialSizes: { Plants: { size: 0.05 } },
        inventory: {},
      }),
    )

    // TRP=1000; aligned Plants=1000; totalSize=50 → fits in 10000; amount=1000
    expect(result.Plants).toBe(1000)
  })

  test('uses fallback size of 1 when materialSizes entry is missing', () => {
    // Chemicals missing → size=1; aligned Chemicals=200; totalSize = 500*0.05 + 200*1 = 225
    // freeSpace = 225 → multiplier = 1; Water=500, Chemicals=200
    const result = computePurchasePlan(
      makeOpts({
        materialSizes: { Water: { size: 0.05 } },
        warehouseFreeSpace: 225,
      }),
    )

    expect(result.Water).toBe(500)
    expect(result.Chemicals).toBe(200)
  })

  test('returns empty plan when requiredMaterials is empty', () => {
    const result = computePurchasePlan(makeOpts({ requiredMaterials: {} }))

    expect(result).toEqual({})
  })

  test('accounts for material sizes when scaling (larger sizes scale more aggressively)', () => {
    // TRP=100; required Water=50; size=1; totalSize=50; freeSpace=25 → multiplier=0.5; amount=25
    const result = computePurchasePlan(
      makeOpts({
        totalRawProduction: 100,
        requiredMaterials: { Water: 0.5 },
        materialSizes: { Water: { size: 1 } },
        warehouseFreeSpace: 25,
      }),
    )

    expect(result.Water).toBeCloseTo(25)
  })
})
