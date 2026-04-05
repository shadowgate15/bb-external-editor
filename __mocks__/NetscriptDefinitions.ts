/**
 * Jest mock factory for the NS (Netscript) interface and its sub-namespaces.
 *
 * Usage in tests:
 *   import { createNsMock } from '__mocks__/NetscriptDefinitions';
 *   const ns = createNsMock();
 *   ns.hack.mockResolvedValue(100);
 */
import type {
  Bladeburner,
  CodingContract,
  Corporation,
  Formulas,
  Gang,
  Go,
  GoAnalysis,
  GoCheat,
  Grafting,
  Hacknet,
  NetscriptPort,
  NS,
  NSEnums,
  Singularity,
  Sleeve,
  TIX,
} from '@ns'

export function createMockNetscriptPort(): jest.Mocked<NetscriptPort> {
  return {
    write: jest.fn(),
    tryWrite: jest.fn().mockReturnValue(false),
    read: jest.fn().mockReturnValue('NULL PORT DATA'),
    peek: jest.fn().mockReturnValue('NULL PORT DATA'),
    nextWrite: jest.fn().mockResolvedValue(undefined),
    full: jest.fn().mockReturnValue(false),
    empty: jest.fn().mockReturnValue(true),
    clear: jest.fn(),
  }
}

export function createMockHacknet(): jest.Mocked<Hacknet> {
  return {
    numNodes: jest.fn().mockReturnValue(0),
    maxNumNodes: jest.fn().mockReturnValue(0),
    purchaseNode: jest.fn().mockReturnValue(-1),
    getPurchaseNodeCost: jest.fn().mockReturnValue(0),
    getNodeStats: jest.fn().mockReturnValue({}),
    upgradeLevel: jest.fn().mockReturnValue(false),
    upgradeRam: jest.fn().mockReturnValue(false),
    upgradeCore: jest.fn().mockReturnValue(false),
    upgradeCache: jest.fn().mockReturnValue(false),
    getLevelUpgradeCost: jest.fn().mockReturnValue(0),
    getRamUpgradeCost: jest.fn().mockReturnValue(0),
    getCoreUpgradeCost: jest.fn().mockReturnValue(0),
    getCacheUpgradeCost: jest.fn().mockReturnValue(0),
    numHashes: jest.fn().mockReturnValue(0),
    hashCapacity: jest.fn().mockReturnValue(0),
    hashCost: jest.fn().mockReturnValue(0),
    spendHashes: jest.fn().mockReturnValue(false),
    getHashUpgrades: jest.fn().mockReturnValue([]),
    getHashUpgradeLevel: jest.fn().mockReturnValue(0),
    getStudyMult: jest.fn().mockReturnValue(1),
    getTrainingMult: jest.fn().mockReturnValue(1),
  }
}

export function createMockBladeburner(): jest.Mocked<Bladeburner> {
  return {
    getContractNames: jest.fn().mockReturnValue([]),
    getOperationNames: jest.fn().mockReturnValue([]),
    getBlackOpNames: jest.fn().mockReturnValue([]),
    getBlackOpRank: jest.fn().mockReturnValue(0),
    getGeneralActionNames: jest.fn().mockReturnValue([]),
    getSkillNames: jest.fn().mockReturnValue([]),
    startAction: jest.fn().mockReturnValue(false),
    stopBladeburnerAction: jest.fn(),
    getCurrentAction: jest.fn().mockReturnValue(null),
    getActionTime: jest.fn().mockReturnValue(0),
    getActionCurrentTime: jest.fn().mockReturnValue(0),
    getActionEstimatedSuccessChance: jest.fn().mockReturnValue([0, 0]),
    getActionRepGain: jest.fn().mockReturnValue(0),
    getActionCountRemaining: jest.fn().mockReturnValue(0),
    getActionMaxLevel: jest.fn().mockReturnValue(1),
    getActionCurrentLevel: jest.fn().mockReturnValue(1),
    getActionAutolevel: jest.fn().mockReturnValue(false),
    setActionAutolevel: jest.fn(),
    setActionLevel: jest.fn(),
    getRank: jest.fn().mockReturnValue(0),
    getSkillPoints: jest.fn().mockReturnValue(0),
    getSkillLevel: jest.fn().mockReturnValue(0),
    getSkillUpgradeCost: jest.fn().mockReturnValue(0),
    upgradeSkill: jest.fn().mockReturnValue(false),
    getTeamSize: jest.fn().mockReturnValue(0),
    setTeamSize: jest.fn().mockReturnValue(0),
    getCityEstimatedPopulation: jest.fn().mockReturnValue(0),
    getCityCommunities: jest.fn().mockReturnValue(0),
    getCityChaos: jest.fn().mockReturnValue(0),
    getCity: jest.fn().mockReturnValue('Sector-12'),
    switchCity: jest.fn().mockReturnValue(false),
    getStamina: jest.fn().mockReturnValue([0, 0]),
    joinBladeburnerFaction: jest.fn().mockReturnValue(false),
    joinBladeburnerDivision: jest.fn().mockReturnValue(false),
    getNextBlackOp: jest.fn().mockReturnValue(null),
    getActionSuccesses: jest.fn().mockReturnValue(0),
    inBladeburner: jest.fn().mockReturnValue(false),
    getBonusTime: jest.fn().mockReturnValue(0),
    nextUpdate: jest.fn().mockResolvedValue(0),
  }
}

export function createMockCodingContract(): jest.Mocked<CodingContract> {
  return {
    attempt: jest.fn().mockReturnValue(''),
    getContractType: jest.fn().mockReturnValue(''),
    getContract: jest.fn().mockReturnValue({}),
    getData: jest.fn().mockReturnValue(null),
    getDescription: jest.fn().mockReturnValue(''),
    getNumTriesRemaining: jest.fn().mockReturnValue(0),
    getContractTypes: jest.fn().mockReturnValue([]),
    createDummyContract: jest.fn().mockReturnValue(''),
  }
}

export function createMockGang(): jest.Mocked<Gang> {
  return {
    createGang: jest.fn().mockReturnValue(false),
    inGang: jest.fn().mockReturnValue(false),
    getMemberNames: jest.fn().mockReturnValue([]),
    getGangInformation: jest.fn().mockReturnValue({}),
    getOtherGangInformation: jest.fn().mockReturnValue({}),
    getMemberInformation: jest.fn().mockReturnValue({}),
    canRecruitMember: jest.fn().mockReturnValue(false),
    recruitMember: jest.fn().mockReturnValue(false),
    getTaskNames: jest.fn().mockReturnValue([]),
    getTaskStats: jest.fn().mockReturnValue({}),
    setMemberTask: jest.fn().mockReturnValue(false),
    getEquipmentNames: jest.fn().mockReturnValue([]),
    getEquipmentCost: jest.fn().mockReturnValue(0),
    getEquipmentType: jest.fn().mockReturnValue(''),
    getEquipmentStats: jest.fn().mockReturnValue({}),
    purchaseEquipment: jest.fn().mockReturnValue(false),
    ascendMember: jest.fn().mockReturnValue(undefined),
    getAscensionResult: jest.fn().mockReturnValue(undefined),
    setTerritoryWarfare: jest.fn(),
    getChanceToWinClash: jest.fn().mockReturnValue(0),
    getBonusTime: jest.fn().mockReturnValue(0),
    nextUpdate: jest.fn().mockResolvedValue(0),
    getRecruitsAvailable: jest.fn().mockReturnValue(0),
    respectForNextRecruit: jest.fn().mockReturnValue(0),
    renameMember: jest.fn().mockReturnValue(false),
    getInstallResult: jest.fn().mockReturnValue({}),
  }
}

export function createMockGoAnalysis(): jest.Mocked<GoAnalysis> {
  return {
    getValidMoves: jest.fn().mockReturnValue([]),
    getChains: jest.fn().mockReturnValue([]),
    getLiberties: jest.fn().mockReturnValue([]),
    getControlledEmptyNodes: jest.fn().mockReturnValue([]),
    getStats: jest.fn().mockReturnValue({}),
    highlightPoint: jest.fn(),
    clearPointHighlight: jest.fn(),
    clearAllPointHighlights: jest.fn(),
    setTestingBoardState: jest.fn().mockReturnValue([]),
    resetStats: jest.fn(),
  }
}

export function createMockGoCheat(): jest.Mocked<GoCheat> {
  return {
    getCheatSuccessChance: jest.fn().mockReturnValue(0),
    getCheatCount: jest.fn().mockReturnValue(0),
    removeRouter: jest.fn().mockResolvedValue({}),
    destroyNode: jest.fn().mockResolvedValue({}),
    playTwoMoves: jest.fn().mockResolvedValue({}),
    repairOfflineNode: jest.fn().mockResolvedValue({}),
  }
}

export function createMockGo(): jest.Mocked<Go> {
  return {
    makeMove: jest.fn().mockResolvedValue({}),
    passTurn: jest.fn().mockResolvedValue({}),
    getBoardState: jest.fn().mockReturnValue([]),
    getGameState: jest.fn().mockReturnValue({}),
    getCurrentPlayer: jest.fn().mockReturnValue('Black'),
    getOpponent: jest.fn().mockReturnValue('Illuminati'),
    getMoveHistory: jest.fn().mockReturnValue({}),
    resetBoardState: jest.fn().mockReturnValue([]),
    analysis: createMockGoAnalysis(),
    cheat: createMockGoCheat(),
    opponentNextTurn: jest.fn().mockResolvedValue({}),
  }
}

export function createMockSleeve(): jest.Mocked<Sleeve> {
  return {
    getNumSleeves: jest.fn().mockReturnValue(0),
    getSleeve: jest.fn().mockReturnValue({}),
    getTask: jest.fn().mockReturnValue(null),
    setToIdle: jest.fn().mockReturnValue(false),
    setToShockRecovery: jest.fn().mockReturnValue(false),
    setToSynchronize: jest.fn().mockReturnValue(false),
    setToCommitCrime: jest.fn().mockReturnValue(false),
    setToUniversityCourse: jest.fn().mockReturnValue(false),
    setToGymWorkout: jest.fn().mockReturnValue(false),
    setToCompanyWork: jest.fn().mockReturnValue(false),
    setToFactionWork: jest.fn().mockReturnValue(false),
    setToBladeburnerAction: jest.fn().mockReturnValue(false),
    travel: jest.fn().mockReturnValue(false),
    getSleeveAugmentations: jest.fn().mockReturnValue([]),
    getSleevePurchasableAugs: jest.fn().mockReturnValue([]),
    purchaseSleeveAug: jest.fn().mockReturnValue(false),
    getSleeveAugmentationPrice: jest.fn().mockReturnValue(0),
    getSleeveAugmentationRepReq: jest.fn().mockReturnValue(0),
  }
}

export function createMockTIX(): jest.Mocked<TIX> {
  return {
    getConstants: jest.fn().mockReturnValue({}),
    hasWSEAccount: jest.fn().mockReturnValue(false),
    hasTIXAPIAccess: jest.fn().mockReturnValue(false),
    has4SData: jest.fn().mockReturnValue(false),
    has4SDataTIXAPI: jest.fn().mockReturnValue(false),
    getSymbols: jest.fn().mockReturnValue([]),
    getPrice: jest.fn().mockReturnValue(0),
    getAskPrice: jest.fn().mockReturnValue(0),
    getBidPrice: jest.fn().mockReturnValue(0),
    getMaxShares: jest.fn().mockReturnValue(0),
    getVolatility: jest.fn().mockReturnValue(0),
    getForecast: jest.fn().mockReturnValue(0),
    getOrganization: jest.fn().mockReturnValue(''),
    getPosition: jest.fn().mockReturnValue([0, 0, 0, 0]),
    buyStock: jest.fn().mockReturnValue(0),
    sellStock: jest.fn().mockReturnValue(0),
    buyShort: jest.fn().mockReturnValue(0),
    sellShort: jest.fn().mockReturnValue(0),
    placeOrder: jest.fn().mockReturnValue(false),
    cancelOrder: jest.fn().mockReturnValue(false),
    getOrders: jest.fn().mockReturnValue({}),
    getPurchaseCost: jest.fn().mockReturnValue(0),
    getSaleGain: jest.fn().mockReturnValue(0),
    purchaseWseAccount: jest.fn().mockReturnValue(false),
    purchaseTixApi: jest.fn().mockReturnValue(false),
    purchase4SMarketData: jest.fn().mockReturnValue(false),
    purchase4SMarketDataTixApi: jest.fn().mockReturnValue(false),
    nextUpdate: jest.fn().mockResolvedValue(0),
    getBonusTime: jest.fn().mockReturnValue(0),
  }
}

export function createMockFormulas(): jest.Mocked<Formulas> {
  return {
    mockServer: jest.fn().mockReturnValue({}),
    mockPlayer: jest.fn().mockReturnValue({}),
    mockPerson: jest.fn().mockReturnValue({}),
    hacking: {
      hackChance: jest.fn().mockReturnValue(0),
      hackExp: jest.fn().mockReturnValue(0),
      hackPercent: jest.fn().mockReturnValue(0),
      hackTime: jest.fn().mockReturnValue(0),
      growPercent: jest.fn().mockReturnValue(0),
      growTime: jest.fn().mockReturnValue(0),
      weakenTime: jest.fn().mockReturnValue(0),
      growAmount: jest.fn().mockReturnValue(0),
      weakenThreads: jest.fn().mockReturnValue(0),
    } as unknown as Formulas['hacking'],
    skills: {
      calculateSkill: jest.fn().mockReturnValue(0),
      calculateExp: jest.fn().mockReturnValue(0),
    } as unknown as Formulas['skills'],
    hacknetNodes: {
      moneyGainRate: jest.fn().mockReturnValue(0),
      levelUpgradeCost: jest.fn().mockReturnValue(0),
      ramUpgradeCost: jest.fn().mockReturnValue(0),
      coreUpgradeCost: jest.fn().mockReturnValue(0),
      hacknetNodeCost: jest.fn().mockReturnValue(0),
      constants: jest.fn().mockReturnValue({}),
    } as unknown as Formulas['hacknetNodes'],
    hacknetServers: {
      hashGainRate: jest.fn().mockReturnValue(0),
      levelUpgradeCost: jest.fn().mockReturnValue(0),
      ramUpgradeCost: jest.fn().mockReturnValue(0),
      coreUpgradeCost: jest.fn().mockReturnValue(0),
      cacheUpgradeCost: jest.fn().mockReturnValue(0),
      hacknetServerCost: jest.fn().mockReturnValue(0),
      constants: jest.fn().mockReturnValue({}),
    } as unknown as Formulas['hacknetServers'],
    reputation: {
      calculateFavorToRep: jest.fn().mockReturnValue(0),
      calculateRepToFavor: jest.fn().mockReturnValue(0),
      repFromDonation: jest.fn().mockReturnValue(0),
    } as unknown as Formulas['reputation'],
    work: {
      crimeSuccessChance: jest.fn().mockReturnValue(0),
      crimeGains: jest.fn().mockReturnValue({}),
      gymGains: jest.fn().mockReturnValue({}),
      universityGains: jest.fn().mockReturnValue({}),
      companyGains: jest.fn().mockReturnValue({}),
      factionGains: jest.fn().mockReturnValue({}),
    } as unknown as Formulas['work'],
    gang: {
      wantedPenalty: jest.fn().mockReturnValue(0),
      respectGain: jest.fn().mockReturnValue(0),
      wantedLevelGain: jest.fn().mockReturnValue(0),
      moneyGain: jest.fn().mockReturnValue(0),
      ascensionPointsGain: jest.fn().mockReturnValue(0),
      ascensionMultiplier: jest.fn().mockReturnValue(0),
    } as unknown as Formulas['gang'],
    bladeburner: {
      skillMaxUpgradeCount: jest.fn().mockReturnValue(0),
      successChance: jest.fn().mockReturnValue(0),
      successChanceStamina: jest.fn().mockReturnValue(0),
      successChanceDifficulty: jest.fn().mockReturnValue(0),
      successChanceTeam: jest.fn().mockReturnValue(0),
      successChanceEstimate: jest.fn().mockReturnValue(0),
      successChanceContracted: jest.fn().mockReturnValue(0),
      successChanceOverflow: jest.fn().mockReturnValue(0),
      successChanceSkills: jest.fn().mockReturnValue(0),
      actionTime: jest.fn().mockReturnValue(0),
      expectedActionTime: jest.fn().mockReturnValue(0),
    } as unknown as Formulas['bladeburner'],
  }
}

export function createMockStanek(): jest.Mocked<NS['stanek']> {
  return {
    giftWidth: jest.fn().mockReturnValue(0),
    giftHeight: jest.fn().mockReturnValue(0),
    chargeFragment: jest.fn().mockResolvedValue(undefined),
    fragmentDefinitions: jest.fn().mockReturnValue([]),
    activeFragments: jest.fn().mockReturnValue([]),
    clearGift: jest.fn(),
    canPlaceFragment: jest.fn().mockReturnValue(false),
    placeFragment: jest.fn().mockReturnValue(false),
    getFragment: jest.fn().mockReturnValue(undefined),
    removeFragment: jest.fn().mockReturnValue(false),
    acceptGift: jest.fn().mockReturnValue(false),
  }
}

export function createMockInfiltration(): jest.Mocked<NS['infiltration']> {
  return {
    getPossibleLocations: jest.fn().mockReturnValue([]),
    getInfiltration: jest.fn().mockReturnValue({}),
  }
}

export function createMockUserInterface(): jest.Mocked<NS['ui']> {
  return {
    openTail: jest.fn(),
    renderTail: jest.fn(),
    moveTail: jest.fn(),
    resizeTail: jest.fn(),
    closeTail: jest.fn(),
    setTailTitle: jest.fn(),
    setTailFontSize: jest.fn(),
    windowSize: jest.fn().mockReturnValue([0, 0]),
    getTheme: jest.fn().mockReturnValue({}),
    setTheme: jest.fn(),
    resetTheme: jest.fn(),
    getStyles: jest.fn().mockReturnValue({}),
    setStyles: jest.fn(),
    resetStyles: jest.fn(),
    getGameInfo: jest.fn().mockReturnValue({}),
    clearTerminal: jest.fn(),
  }
}

export function createMockSingularity(): jest.Mocked<Singularity> {
  return {
    b1tflum3: jest.fn(),
    destroyW0r1dD43m0n: jest.fn(),
    applyToCompany: jest.fn().mockReturnValue(null),
    checkFactionInvitations: jest.fn().mockReturnValue([]),
    commitCrime: jest.fn().mockReturnValue(0),
    connect: jest.fn().mockReturnValue(false),
    createProgram: jest.fn().mockReturnValue(false),
    donateToFaction: jest.fn().mockReturnValue(false),
    exportGame: jest.fn(),
    exportGameBonus: jest.fn().mockReturnValue(false),
    getAugmentationBasePrice: jest.fn().mockReturnValue(0),
    getAugmentationFactions: jest.fn().mockReturnValue([]),
    getAugmentationPrereq: jest.fn().mockReturnValue([]),
    getAugmentationPrice: jest.fn().mockReturnValue(0),
    getAugmentationRepReq: jest.fn().mockReturnValue(0),
    getAugmentationStats: jest.fn().mockReturnValue({}),
    getAugmentationsFromFaction: jest.fn().mockReturnValue([]),
    getCompanyFavor: jest.fn().mockReturnValue(0),
    getCompanyFavorGain: jest.fn().mockReturnValue(0),
    getCompanyPositionInfo: jest.fn().mockReturnValue({}),
    getCompanyPositions: jest.fn().mockReturnValue([]),
    getCompanyRep: jest.fn().mockReturnValue(0),
    getCrimeChance: jest.fn().mockReturnValue(0),
    getCrimeStats: jest.fn().mockReturnValue({}),
    getCurrentServer: jest.fn().mockReturnValue('home'),
    getCurrentWork: jest.fn().mockReturnValue(null),
    getDarkwebProgramCost: jest.fn().mockReturnValue(0),
    getDarkwebPrograms: jest.fn().mockReturnValue([]),
    getFactionEnemies: jest.fn().mockReturnValue([]),
    getFactionFavor: jest.fn().mockReturnValue(0),
    getFactionFavorGain: jest.fn().mockReturnValue(0),
    getFactionInviteRequirements: jest.fn().mockReturnValue([]),
    getFactionRep: jest.fn().mockReturnValue(0),
    getFactionWorkTypes: jest.fn().mockReturnValue([]),
    getSaveData: jest.fn().mockResolvedValue(new Uint8Array()),
    getOwnedAugmentations: jest.fn().mockReturnValue([]),
    getOwnedSourceFiles: jest.fn().mockReturnValue([]),
    getUpgradeHomeCoresCost: jest.fn().mockReturnValue(0),
    getUpgradeHomeRamCost: jest.fn().mockReturnValue(0),
    goToLocation: jest.fn().mockReturnValue(false),
    gymWorkout: jest.fn().mockReturnValue(false),
    hospitalize: jest.fn(),
    installAugmentations: jest.fn(),
    installBackdoor: jest.fn().mockResolvedValue(undefined),
    isBusy: jest.fn().mockReturnValue(false),
    isFocused: jest.fn().mockReturnValue(false),
    joinFaction: jest.fn().mockReturnValue(false),
    manualHack: jest.fn().mockResolvedValue(0),
    purchaseAugmentation: jest.fn().mockReturnValue(false),
    purchaseProgram: jest.fn().mockReturnValue(false),
    purchaseTor: jest.fn().mockReturnValue(false),
    quitJob: jest.fn(),
    setFocus: jest.fn().mockReturnValue(false),
    softReset: jest.fn(),
    stopAction: jest.fn().mockReturnValue(false),
    travelToCity: jest.fn().mockReturnValue(false),
    universityCourse: jest.fn().mockReturnValue(false),
    upgradeHomeCores: jest.fn().mockReturnValue(false),
    upgradeHomeRam: jest.fn().mockReturnValue(false),
    workForCompany: jest.fn().mockReturnValue(false),
    workForFaction: jest.fn().mockReturnValue(false),
    cat: jest.fn(),
  } as unknown as jest.Mocked<Singularity>
}

export function createMockGrafting(): jest.Mocked<Grafting> {
  return {
    getGraftableAugmentations: jest.fn().mockReturnValue([]),
    graftAugmentation: jest.fn().mockReturnValue(false),
    waitForOngoingGrafting: jest.fn().mockResolvedValue(undefined),
    getAugmentationGraftPrice: jest.fn().mockReturnValue(0),
    getAugmentationGraftTime: jest.fn().mockReturnValue(0),
  }
}

/** Creates a fully-mocked NS object. All methods are jest.fn() with sensible defaults. */
export function createNsMock(): jest.Mocked<NS> {
  return {
    // Sub-namespaces
    hacknet: createMockHacknet(),
    bladeburner: createMockBladeburner(),
    codingcontract: createMockCodingContract(),
    gang: createMockGang(),
    go: createMockGo(),
    sleeve: createMockSleeve(),
    stock: createMockTIX(),
    formulas: createMockFormulas(),
    stanek: createMockStanek(),
    infiltration: createMockInfiltration(),
    corporation: {} as jest.Mocked<Corporation>,
    ui: createMockUserInterface(),
    singularity: createMockSingularity(),
    grafting: createMockGrafting(),

    // Script metadata
    args: [],
    pid: 1,

    // Hacking
    hack: jest.fn().mockResolvedValue(0),
    grow: jest.fn().mockResolvedValue(0),
    weaken: jest.fn().mockResolvedValue(0),
    weakenAnalyze: jest.fn().mockReturnValue(0),
    hackAnalyzeThreads: jest.fn().mockReturnValue(0),
    hackAnalyze: jest.fn().mockReturnValue(0),
    hackAnalyzeSecurity: jest.fn().mockReturnValue(0),
    hackAnalyzeChance: jest.fn().mockReturnValue(0),
    growthAnalyze: jest.fn().mockReturnValue(0),
    growthAnalyzeSecurity: jest.fn().mockReturnValue(0),
    getHackTime: jest.fn().mockReturnValue(0),
    getGrowTime: jest.fn().mockReturnValue(0),
    getWeakenTime: jest.fn().mockReturnValue(0),

    // Timing
    sleep: jest.fn().mockResolvedValue(true as const),
    asleep: jest.fn().mockResolvedValue(true as const),

    // Logging
    print: jest.fn(),
    printRaw: jest.fn(),
    printf: jest.fn(),
    tprint: jest.fn(),
    tprintRaw: jest.fn(),
    tprintf: jest.fn(),
    clearLog: jest.fn(),
    disableLog: jest.fn(),
    enableLog: jest.fn(),
    isLogEnabled: jest.fn().mockReturnValue(false),
    getScriptLogs: jest.fn().mockReturnValue([]),
    getRecentScripts: jest.fn().mockReturnValue([]),

    // Tail / UI
    tail: jest.fn(),
    moveTail: jest.fn(),
    resizeTail: jest.fn(),
    closeTail: jest.fn(),
    setTitle: jest.fn(),

    // Network
    scan: jest.fn().mockReturnValue([]),
    hasTorRouter: jest.fn().mockReturnValue(false),
    nuke: jest.fn().mockReturnValue(false),
    brutessh: jest.fn().mockReturnValue(false),
    ftpcrack: jest.fn().mockReturnValue(false),
    relaysmtp: jest.fn().mockReturnValue(false),
    httpworm: jest.fn().mockReturnValue(false),
    sqlinject: jest.fn().mockReturnValue(false),

    // Script execution
    run: jest.fn().mockReturnValue(0),
    exec: jest.fn().mockReturnValue(0),
    spawn: jest.fn(),
    self: jest.fn().mockReturnValue({}),
    kill: jest.fn().mockReturnValue(false),
    killall: jest.fn().mockReturnValue(false),
    exit: jest.fn() as unknown as () => never,
    scp: jest.fn().mockReturnValue(false),
    ls: jest.fn().mockReturnValue([]),
    ps: jest.fn().mockReturnValue([]),
    isRunning: jest.fn().mockReturnValue(false),
    getRunningScript: jest.fn().mockReturnValue(null),
    scriptRunning: jest.fn().mockReturnValue(false),
    scriptKill: jest.fn().mockReturnValue(false),
    getScriptName: jest.fn().mockReturnValue(''),
    getScriptRam: jest.fn().mockReturnValue(0),
    getScriptIncome: jest.fn().mockReturnValue(0),
    getScriptExpGain: jest.fn().mockReturnValue(0),
    getTotalScriptIncome: jest.fn().mockReturnValue([0, 0] as [number, number]),
    getTotalScriptExpGain: jest.fn().mockReturnValue(0),
    ramOverride: jest.fn().mockReturnValue(0),

    // Server info
    hasRootAccess: jest.fn().mockReturnValue(false),
    getHostname: jest.fn().mockReturnValue('home'),
    getHackingLevel: jest.fn().mockReturnValue(1),
    getHackingMultipliers: jest.fn().mockReturnValue({}),
    getHacknetMultipliers: jest.fn().mockReturnValue({}),
    getServer: jest.fn().mockReturnValue({}),
    getServerMoneyAvailable: jest.fn().mockReturnValue(0),
    getServerMaxMoney: jest.fn().mockReturnValue(0),
    getServerGrowth: jest.fn().mockReturnValue(0),
    getServerSecurityLevel: jest.fn().mockReturnValue(1),
    getServerMinSecurityLevel: jest.fn().mockReturnValue(1),
    getServerBaseSecurityLevel: jest.fn().mockReturnValue(1),
    getServerMaxRam: jest.fn().mockReturnValue(0),
    getServerUsedRam: jest.fn().mockReturnValue(0),
    getServerRequiredHackingLevel: jest.fn().mockReturnValue(1),
    getServerNumPortsRequired: jest.fn().mockReturnValue(0),
    serverExists: jest.fn().mockReturnValue(false),

    // Purchased servers
    getPurchasedServerCost: jest.fn().mockReturnValue(0),
    purchaseServer: jest.fn().mockReturnValue(''),
    getPurchasedServerUpgradeCost: jest.fn().mockReturnValue(0),
    upgradePurchasedServer: jest.fn().mockReturnValue(false),
    renamePurchasedServer: jest.fn().mockReturnValue(false),
    deleteServer: jest.fn().mockReturnValue(false),
    getPurchasedServers: jest.fn().mockReturnValue([]),
    getPurchasedServerLimit: jest.fn().mockReturnValue(0),
    getPurchasedServerMaxRam: jest.fn().mockReturnValue(0),

    // File I/O
    write: jest.fn(),
    tryWritePort: jest.fn().mockReturnValue(false),
    nextPortWrite: jest.fn().mockResolvedValue(undefined),
    read: jest.fn().mockReturnValue(''),
    peek: jest.fn().mockReturnValue('NULL PORT DATA'),
    clear: jest.fn(),
    clearPort: jest.fn(),
    writePort: jest.fn().mockReturnValue(undefined),
    readPort: jest.fn().mockReturnValue('NULL PORT DATA'),
    getPortHandle: jest.fn().mockReturnValue(createMockNetscriptPort()),
    rm: jest.fn().mockReturnValue(false),
    mv: jest.fn(),
    fileExists: jest.fn().mockReturnValue(false),

    // Formatting
    sprintf: jest.fn().mockReturnValue(''),
    vsprintf: jest.fn().mockReturnValue(''),
    formatNumber: jest.fn().mockReturnValue(''),
    formatRam: jest.fn().mockReturnValue(''),
    formatPercent: jest.fn().mockReturnValue(''),
    nFormat: jest.fn().mockReturnValue(''),
    tFormat: jest.fn().mockReturnValue(''),

    // UI prompts
    prompt: jest.fn().mockResolvedValue(false),
    alert: jest.fn(),
    toast: jest.fn(),

    // Misc
    wget: jest.fn().mockResolvedValue(false),
    getFavorToDonate: jest.fn().mockReturnValue(0),
    getBitNodeMultipliers: jest.fn().mockReturnValue({}),
    getPlayer: jest.fn().mockReturnValue({}),
    getMoneySources: jest.fn().mockReturnValue({}),
    atExit: jest.fn(),
    getResetInfo: jest.fn().mockReturnValue({}),
    getFunctionRamCost: jest.fn().mockReturnValue(0),
    flags: jest.fn().mockReturnValue({}),
    share: jest.fn().mockResolvedValue(undefined),
    getSharePower: jest.fn().mockReturnValue(1),
    getTimeSinceLastAug: jest.fn().mockReturnValue(0),
    heart: { break: jest.fn().mockReturnValue(0) },
    enums: {} as NSEnums,
  } as unknown as jest.Mocked<NS>
}
