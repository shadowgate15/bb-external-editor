import { assertTitanEnum } from '../utils'

/** Major subsystems or foundational modules */
export enum Titan {
  Batch,
  Corporation,
}

assertTitanEnum(Titan)
