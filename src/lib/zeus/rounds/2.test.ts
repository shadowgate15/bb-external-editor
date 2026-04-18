import type { CityName, Division, Office } from '@ns'
import { createNsMock } from '@ns-mock'

import type { DivisionsMock } from '../__mocks__/divisions'
import { createDivisionsMock } from '../__mocks__/divisions'
import type { Divisions } from '../divisions'
import { Round2 } from './2'

const CITIES = ['Aevum', 'Chongqing', 'Sector-12', 'New Tokyo', 'Ishima', 'Volhaven'] as CityName[]

function makeDivision(overrides: Partial<Division> = {}): Division {
  return {
    name: 'AgriCorp',
    type: 'Agriculture',
    awareness: 0,
    popularity: 0,
    productionMult: 1,
    researchPoints: 0,
    lastCycleRevenue: 0,
    lastCycleExpenses: 0,
    thisCycleRevenue: 0,
    thisCycleExpenses: 0,
    numAdVerts: 0,
    cities: CITIES,
    products: [],
    makesProducts: false,
    maxProducts: 0,
    ...overrides,
  } as unknown as Division
}

function makeOffice(overrides: Partial<Office> = {}): Office {
  return {
    city: 'Aevum' as CityName,
    size: 9,
    minEnergyLevel: 0,
    maxEnergyLevel: 100,
    minMoraleLevel: 0,
    maxMoraleLevel: 100,
    avgEnergy: 100,
    avgMorale: 100,
    numEmployees: 9,
    employeeProductionByJob: {},
    employeeJobs: {},
    ...overrides,
  } as unknown as Office
}

describe('Round2', () => {
  let ns: ReturnType<typeof createNsMock>
  let divisionsMock: DivisionsMock

  const getSut = () => new Round2(ns, divisionsMock as unknown as Divisions)

  beforeEach(() => {
    ns = createNsMock()
    divisionsMock = createDivisionsMock()

    jest.mocked(ns.sleep).mockResolvedValue(true)
    jest.mocked(ns.ui.openTail).mockReturnValue(undefined as unknown as void)

    // Agriculture division already at target state by default
    divisionsMock.findDivisionNameByType = jest.fn().mockReturnValue('AgriCorp')

    const agriDivision = makeDivision({ name: 'AgriCorp', type: 'Agriculture', cities: CITIES, numAdVerts: 8 })
    const chemDivision = makeDivision({ name: 'Chemical', type: 'Chemical', cities: CITIES })

    jest.mocked(ns.corporation.getCorporation).mockReturnValue({
      divisions: ['AgriCorp', 'Chemical'],
      funds: Number.MAX_SAFE_INTEGER,
    } as ReturnType<typeof ns.corporation.getCorporation>)

    jest
      .mocked(ns.corporation.getDivision)
      .mockImplementation((name) => (name === 'AgriCorp' ? agriDivision : chemDivision))

    // Default: offices already at target sizes with full staff — no loops entered
    jest.mocked(ns.corporation.getOffice).mockReturnValue(makeOffice({ size: 9, numEmployees: 9 }))

    jest.mocked(ns.corporation.hasUnlock).mockReturnValue(true)
    jest.mocked(ns.corporation.hasWarehouse).mockReturnValue(true)
    jest.mocked(ns.corporation.getOfficeSizeUpgradeCost).mockReturnValue(0)
    jest.mocked(ns.corporation.getHireAdVertCost).mockReturnValue(0)
    jest.mocked(ns.corporation.getUpgradeWarehouseCost).mockReturnValue(0)
    jest.mocked(ns.corporation.hireEmployee).mockReturnValue(true)
  })

  test('should be defined', () => {
    expect(getSut()).toBeDefined()
  })

  test('purchases Export unlock when not already unlocked', async () => {
    jest.mocked(ns.corporation.hasUnlock).mockReturnValue(false)

    await getSut().run()

    expect(ns.corporation.purchaseUnlock).toHaveBeenCalledWith('Export')
  })

  test('does not purchase Export unlock when already unlocked', async () => {
    jest.mocked(ns.corporation.hasUnlock).mockReturnValue(true)

    await getSut().run()

    expect(ns.corporation.purchaseUnlock).not.toHaveBeenCalled()
  })

  test('uses Divisions.findDivisionNameByType to locate Agriculture division', async () => {
    await getSut().run()

    expect(divisionsMock.findDivisionNameByType).toHaveBeenCalledWith('Agriculture')
  })

  test('throws when no Agriculture division is found', async () => {
    divisionsMock.findDivisionNameByType = jest.fn().mockReturnValue(undefined)

    await expect(getSut().run()).rejects.toThrow('No Agriculture division found')
  })

  test('upgrades Agriculture offices that are below target size', async () => {
    // numEmployees set to 9 (target) so hiring loop is not entered — isolates size upgrade
    jest
      .mocked(ns.corporation.getOffice)
      .mockImplementation((divName, cityName) =>
        divName === 'AgriCorp' && cityName === ('Aevum' as CityName)
          ? makeOffice({ size: 3, numEmployees: 9 })
          : makeOffice({ size: 9, numEmployees: 9 }),
      )

    await getSut().run()

    expect(ns.corporation.upgradeOfficeSize).toHaveBeenCalledWith('AgriCorp', 'Aevum', 6)
  })

  test('does not upgrade Agriculture offices already at target size', async () => {
    await getSut().run()

    expect(ns.corporation.upgradeOfficeSize).not.toHaveBeenCalledWith('AgriCorp', expect.anything(), expect.anything())
  })

  test('hires employees for Agriculture cities that are understaffed', async () => {
    // Use a stateful counter so the hiring while loop terminates after one iteration
    const employeeCounts: Record<string, number> = { Aevum: 8 }

    jest
      .mocked(ns.corporation.getOffice)
      .mockImplementation((divName, cityName) => makeOffice({ size: 9, numEmployees: employeeCounts[cityName] ?? 9 }))
    jest.mocked(ns.corporation.hireEmployee).mockImplementation((divName, cityName) => {
      employeeCounts[cityName] = (employeeCounts[cityName] ?? 9) + 1
      return true
    })

    await getSut().run()

    expect(ns.corporation.hireEmployee).toHaveBeenCalledWith('AgriCorp', 'Aevum')
  })

  test('hires AdVerts for Agriculture until target is reached', async () => {
    let adVerts = 6
    const agriDivision = makeDivision({ name: 'AgriCorp', type: 'Agriculture', cities: CITIES, numAdVerts: 6 })

    jest.mocked(ns.corporation.getDivision).mockImplementation((name) => {
      if (name === 'AgriCorp') return { ...agriDivision, numAdVerts: adVerts }
      return makeDivision({ name: 'Chemical', type: 'Chemical', cities: CITIES })
    })
    jest.mocked(ns.corporation.hireAdVert).mockImplementation(() => {
      adVerts++
    })

    await getSut().run()

    expect(ns.corporation.hireAdVert).toHaveBeenCalledTimes(2)
    expect(ns.corporation.hireAdVert).toHaveBeenCalledWith('AgriCorp')
  })

  test('creates Chemical division if it does not exist', async () => {
    jest.mocked(ns.corporation.getCorporation).mockReturnValue({
      divisions: ['AgriCorp'],
      funds: Number.MAX_SAFE_INTEGER,
    } as ReturnType<typeof ns.corporation.getCorporation>)

    jest.mocked(ns.corporation.getDivision).mockImplementation((name) => {
      if (name === 'AgriCorp')
        return makeDivision({ name: 'AgriCorp', type: 'Agriculture', cities: CITIES, numAdVerts: 8 })
      return makeDivision({ name: 'Chemical', type: 'Chemical', cities: CITIES })
    })

    await getSut().run()

    expect(ns.corporation.expandIndustry).toHaveBeenCalledWith('Chemical', 'Chemical')
  })

  test('does not re-create Chemical division if it already exists', async () => {
    await getSut().run()

    expect(ns.corporation.expandIndustry).not.toHaveBeenCalled()
  })

  test('expands Chemical division to cities not yet present', async () => {
    const chemDivision = makeDivision({ name: 'Chemical', type: 'Chemical', cities: ['Aevum'] as CityName[] })

    jest.mocked(ns.corporation.getDivision).mockImplementation((name) => {
      if (name === 'AgriCorp')
        return makeDivision({ name: 'AgriCorp', type: 'Agriculture', cities: CITIES, numAdVerts: 8 })
      return chemDivision
    })

    await getSut().run()

    expect(ns.corporation.expandCity).toHaveBeenCalledWith('Chemical', 'Chongqing')
    expect(ns.corporation.expandCity).toHaveBeenCalledWith('Chemical', 'Sector-12')
    expect(ns.corporation.expandCity).not.toHaveBeenCalledWith('Chemical', 'Aevum')
  })

  test('purchases warehouses for Chemical cities that lack one', async () => {
    jest.mocked(ns.corporation.hasWarehouse).mockReturnValue(false)

    await getSut().run()

    expect(ns.corporation.purchaseWarehouse).toHaveBeenCalledWith('Chemical', expect.any(String))
  })

  test('upgrades warehouse once per Chemical city', async () => {
    await getSut().run()

    for (const city of CITIES) {
      expect(ns.corporation.upgradeWarehouse).toHaveBeenCalledWith('Chemical', city, 1)
    }
  })

  test('upgrades Chemical offices that are below target size', async () => {
    // numEmployees set to 5 (target) so hiring loop is not entered — isolates size upgrade
    jest
      .mocked(ns.corporation.getOffice)
      .mockImplementation((divName) =>
        divName === 'Chemical' ? makeOffice({ size: 3, numEmployees: 5 }) : makeOffice({ size: 9, numEmployees: 9 }),
      )

    await getSut().run()

    expect(ns.corporation.upgradeOfficeSize).toHaveBeenCalledWith('Chemical', expect.any(String), 2)
  })

  test('hires employees for Chemical cities that are understaffed', async () => {
    const employeeCounts: Record<string, number> = {}

    jest
      .mocked(ns.corporation.getOffice)
      .mockImplementation((divName, cityName) =>
        makeOffice({ size: 9, numEmployees: divName === 'Chemical' ? (employeeCounts[cityName] ?? 4) : 9 }),
      )
    jest.mocked(ns.corporation.hireEmployee).mockImplementation((divName, cityName) => {
      if (divName === 'Chemical') employeeCounts[cityName] = (employeeCounts[cityName] ?? 4) + 1
      return true
    })

    await getSut().run()

    expect(ns.corporation.hireEmployee).toHaveBeenCalledWith('Chemical', expect.any(String))
  })
})
