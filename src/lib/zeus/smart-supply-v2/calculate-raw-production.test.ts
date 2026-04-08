import { CorpIndustryName } from '@ns'

import { calculateRawProduction, CalculateRawProductionOpts } from './calculate-raw-production'

const BASE_OPTS: CalculateRawProductionOpts = {
  industry: 'Agriculture' as CorpIndustryName,
  operationsEmployeeProduction: 100,
  engineerEmployeeProduction: 100,
  managementEmployeeProduction: 100,
  makesProducts: false,
  productionMultiplier: 1,
  smartFactoryLevel: 0,
  hasDronesAssembly: false,
  hasSelfCorrectingAssemblers: false,
  hasUpgradeFulcrum: false,
}

describe('calculateRawProduction', () => {
  test('returns expected value with baseline inputs', () => {
    const result = calculateRawProduction(BASE_OPTS)

    const totalProd = 300
    const mgmtFactor = 1 + 100 / (1.2 * totalProd)
    const empMultiplier = (100 ** 0.4 + 100 ** 0.3) * mgmtFactor
    const expected = 0.05 * empMultiplier * 1 * 1 * 1

    expect(result).toBeCloseTo(expected)
  })

  test('halves output when makesProducts is true', () => {
    const material = calculateRawProduction({ ...BASE_OPTS, makesProducts: false })
    const product = calculateRawProduction({ ...BASE_OPTS, makesProducts: true })

    expect(product).toBeCloseTo(material * 0.5)
  })

  test('scales output by productionMultiplier', () => {
    const base = calculateRawProduction(BASE_OPTS)
    const doubled = calculateRawProduction({ ...BASE_OPTS, productionMultiplier: 2 })

    expect(doubled).toBeCloseTo(base * 2)
  })

  test('applies smart factory upgrade multiplier (1 + 0.03 * level)', () => {
    const base = calculateRawProduction(BASE_OPTS)
    const upgraded = calculateRawProduction({ ...BASE_OPTS, smartFactoryLevel: 10 })

    expect(upgraded).toBeCloseTo(base * (1 + 0.03 * 10))
  })

  test('applies Drones - Assembly research multiplier (×1.2)', () => {
    const base = calculateRawProduction(BASE_OPTS)
    const researched = calculateRawProduction({ ...BASE_OPTS, hasDronesAssembly: true })

    expect(researched).toBeCloseTo(base * 1.2)
  })

  test('applies Self-Correcting Assemblers research multiplier (×1.1)', () => {
    const base = calculateRawProduction(BASE_OPTS)
    const researched = calculateRawProduction({ ...BASE_OPTS, hasSelfCorrectingAssemblers: true })

    expect(researched).toBeCloseTo(base * 1.1)
  })

  test('applies uPgrade: Fulcrum multiplier only when makesProducts is true', () => {
    const baseMaterial = calculateRawProduction(BASE_OPTS)
    const materialWithFulcrum = calculateRawProduction({ ...BASE_OPTS, hasUpgradeFulcrum: true })

    expect(materialWithFulcrum).toBeCloseTo(baseMaterial)

    const baseProduct = calculateRawProduction({ ...BASE_OPTS, makesProducts: true })
    const productWithFulcrum = calculateRawProduction({ ...BASE_OPTS, makesProducts: true, hasUpgradeFulcrum: true })

    expect(productWithFulcrum).toBeCloseTo(baseProduct * 1.05)
  })

  test('combines all research multipliers', () => {
    const base = calculateRawProduction(BASE_OPTS)
    const all = calculateRawProduction({
      ...BASE_OPTS,
      makesProducts: true,
      hasDronesAssembly: true,
      hasSelfCorrectingAssemblers: true,
      hasUpgradeFulcrum: true,
    })

    expect(all).toBeCloseTo(base * 0.5 * 1.2 * 1.1 * 1.05)
  })

  test('returns 0 when all employee productions are 0', () => {
    const result = calculateRawProduction({
      ...BASE_OPTS,
      operationsEmployeeProduction: 0,
      engineerEmployeeProduction: 0,
      managementEmployeeProduction: 0,
    })

    expect(result).toBe(0)
  })
})
