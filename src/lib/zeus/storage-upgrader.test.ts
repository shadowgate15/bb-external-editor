import { computeUpgradePlan, CORP_UPGRADE_PRICE_MULT, WAREHOUSE_UPGRADE_PRICE_MULT } from './storage-upgrader'

describe('computeUpgradePlan', () => {
  it('returns zero purchases for a zero budget', () => {
    const plan = computeUpgradePlan({
      budget: 0,
      currentSmartStorageCost: 1_000,
      currentSmartFactoriesCost: 2_000,
      includeSmartFactories: true,
      cityWarehouseCosts: { Aevum: 500, Chongqing: 500 },
    })

    expect(plan.smartStorageLevels).toBe(0)
    expect(plan.smartFactoriesLevels).toBe(0)
    expect(plan.warehouseLevels).toEqual({ Aevum: 0, Chongqing: 0 })
    expect(plan.totalCost).toBe(0)
  })

  it('buys the cheapest available upgrade first', () => {
    // Warehouse (500) is cheaper than Smart Storage (1000)
    const plan = computeUpgradePlan({
      budget: 600,
      currentSmartStorageCost: 1_000,
      currentSmartFactoriesCost: 1_000,
      includeSmartFactories: false,
      cityWarehouseCosts: { Aevum: 500 },
    })

    expect(plan.warehouseLevels['Aevum']).toBe(1)
    expect(plan.smartStorageLevels).toBe(0)
    expect(plan.totalCost).toBe(500)
  })

  it('stops buying when nothing is affordable', () => {
    // Budget is between 1 warehouse level and 2
    const warehouseCost = 1_000
    const plan = computeUpgradePlan({
      budget: warehouseCost + warehouseCost * WAREHOUSE_UPGRADE_PRICE_MULT - 1,
      currentSmartStorageCost: 999_999,
      currentSmartFactoriesCost: 999_999,
      includeSmartFactories: false,
      cityWarehouseCosts: { Aevum: warehouseCost },
    })

    expect(plan.warehouseLevels['Aevum']).toBe(1)
  })

  it('excludes Smart Factories when includeSmartFactories is false', () => {
    // Smart Factories is cheapest, but it should be skipped
    const plan = computeUpgradePlan({
      budget: 500,
      currentSmartStorageCost: 1_000,
      currentSmartFactoriesCost: 100,
      includeSmartFactories: false,
      cityWarehouseCosts: { Aevum: 1_000 },
    })

    expect(plan.smartFactoriesLevels).toBe(0)
    expect(plan.totalCost).toBe(0)
  })

  it('includes Smart Factories when includeSmartFactories is true', () => {
    // Smart Factories (100) is cheapest
    const plan = computeUpgradePlan({
      budget: 150,
      currentSmartStorageCost: 1_000,
      currentSmartFactoriesCost: 100,
      includeSmartFactories: true,
      cityWarehouseCosts: { Aevum: 1_000 },
    })

    expect(plan.smartFactoriesLevels).toBe(1)
    expect(plan.smartStorageLevels).toBe(0)
    expect(plan.warehouseLevels['Aevum']).toBe(0)
    expect(plan.totalCost).toBe(100)
  })

  it('advances virtual costs geometrically for corp upgrades', () => {
    // Both Smart Storage and warehouse start at cost 1000.
    // After buying 1 Smart Storage (cost 1000), next Smart Storage costs 1000 * 1.06 = 1060.
    // After buying 1 warehouse (cost 1000), next warehouse costs 1000 * 1.07 = 1070.
    // With budget 3100: buy Smart Storage (1000), then warehouse (1000), then Smart Storage (1060).
    const plan = computeUpgradePlan({
      budget: 3_100,
      currentSmartStorageCost: 1_000,
      currentSmartFactoriesCost: 99_999,
      includeSmartFactories: false,
      cityWarehouseCosts: { Aevum: 1_000 },
    })

    // Sequence: SS(1000), WH(1000), SS(1060) — total 3060, remaining 40 < next WH(1070)
    expect(plan.smartStorageLevels).toBe(2)
    expect(plan.warehouseLevels['Aevum']).toBe(1)
    expect(plan.totalCost).toBeCloseTo(3_060, 5)
  })

  it('treats each city warehouse independently', () => {
    // Both cities start at cost 500. The algorithm buys Aevum first (insertion order),
    // advancing Aevum's next cost to 500 * 1.07 = 535. Chongqing (500) is now cheaper,
    // so it gets bought next. Budget of 1100 is enough for exactly one level in each city.
    const plan = computeUpgradePlan({
      budget: 1_100,
      currentSmartStorageCost: 2_000,
      currentSmartFactoriesCost: 2_000,
      includeSmartFactories: false,
      cityWarehouseCosts: { Aevum: 500, Chongqing: 500 },
    })

    expect(plan.warehouseLevels['Aevum']).toBe(1)
    expect(plan.warehouseLevels['Chongqing']).toBe(1)
    expect(plan.smartStorageLevels).toBe(0)
    expect(plan.totalCost).toBe(1_000)
  })

  it('initialises warehouseLevels to zero for all cities even when not purchased', () => {
    const plan = computeUpgradePlan({
      budget: 0,
      currentSmartStorageCost: 1_000,
      currentSmartFactoriesCost: 1_000,
      includeSmartFactories: false,
      cityWarehouseCosts: { Aevum: 500, Chongqing: 600, Ishima: 700 },
    })

    expect(Object.keys(plan.warehouseLevels)).toEqual(expect.arrayContaining(['Aevum', 'Chongqing', 'Ishima']))
    expect(plan.warehouseLevels['Aevum']).toBe(0)
    expect(plan.warehouseLevels['Chongqing']).toBe(0)
    expect(plan.warehouseLevels['Ishima']).toBe(0)
  })

  it('uses CORP_UPGRADE_PRICE_MULT constant for corp upgrade cost progression', () => {
    const baseCost = 1_000
    // Buy 3 Smart Storage levels, each cost = baseCost * CORP_UPGRADE_PRICE_MULT^k
    const expectedCost = baseCost + baseCost * CORP_UPGRADE_PRICE_MULT + baseCost * CORP_UPGRADE_PRICE_MULT ** 2

    const plan = computeUpgradePlan({
      budget: expectedCost + 0.01, // just enough for exactly 3 levels
      currentSmartStorageCost: baseCost,
      currentSmartFactoriesCost: 99_999,
      includeSmartFactories: false,
      cityWarehouseCosts: { Aevum: 99_999 },
    })

    expect(plan.smartStorageLevels).toBe(3)
    expect(plan.totalCost).toBeCloseTo(expectedCost, 5)
  })

  it('uses WAREHOUSE_UPGRADE_PRICE_MULT constant for warehouse cost progression', () => {
    const baseCost = 1_000
    const expectedCost =
      baseCost + baseCost * WAREHOUSE_UPGRADE_PRICE_MULT + baseCost * WAREHOUSE_UPGRADE_PRICE_MULT ** 2

    const plan = computeUpgradePlan({
      budget: expectedCost + 0.01,
      currentSmartStorageCost: 99_999,
      currentSmartFactoriesCost: 99_999,
      includeSmartFactories: false,
      cityWarehouseCosts: { Aevum: baseCost },
    })

    expect(plan.warehouseLevels['Aevum']).toBe(3)
    expect(plan.totalCost).toBeCloseTo(expectedCost, 5)
  })
})
