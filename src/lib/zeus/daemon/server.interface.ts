import {
  CityName,
  CorpIndustryData,
  CorpIndustryName,
  CorpMaterialConstantData,
  CorpMaterialName,
  CorporationInfo,
  CorpResearchName,
  CorpUpgradeName,
  Division,
  Office,
  Product,
  Warehouse,
} from '@ns'

import { ConfigData } from '../config.interface'

export enum ServerResponseKind {
  GetDivisions = 'getDivisions',
  GetCorporation = 'getCorporation',
  GetOffices = 'getOffices',
  GetUpgradeLevels = 'getUpgradeLevels',
  HasResearched = 'hasResearched',
  GetMaterialData = 'getMaterialData',
  GetProducts = 'getProducts',
  GetIndustryData = 'getIndustryData',
  GetWarehouses = 'getWarehouses',
}

export type ServerResponse<Kind extends ServerResponseKind, Data> =
  | {
      kind: Kind
      data: Data
      error: never
    }
  | {
      kind: Kind
      data: never
      error: Error
    }

export type GetDivisions = ServerResponse<ServerResponseKind.GetDivisions, Division[] | null>

export type GetCorporation = ServerResponse<ServerResponseKind.GetCorporation, CorporationInfo>

export type GetOffices = ServerResponse<ServerResponseKind.GetOffices, Record<string, Record<CityName, Office>> | null>

export type GetUpgradeLevels = ServerResponse<ServerResponseKind.GetUpgradeLevels, Record<CorpUpgradeName, number>>

export type HasResearched = ServerResponse<
  ServerResponseKind.HasResearched,
  Record<string, Record<CorpResearchName, boolean>>
>

export type GetMaterialData = ServerResponse<
  ServerResponseKind.GetMaterialData,
  Record<CorpMaterialName, CorpMaterialConstantData>
>

export type GetProducts = ServerResponse<
  ServerResponseKind.GetProducts,
  Record<string, Record<CityName, Record<string, Product>>> | null
>

export type GetIndustryData = ServerResponse<
  ServerResponseKind.GetIndustryData,
  Record<CorpIndustryName, CorpIndustryData>
>

export type GetWarehouses = ServerResponse<
  ServerResponseKind.GetWarehouses,
  Record<string, Record<CityName, Warehouse>> | null
>

export type Response =
  | GetCorporation
  | GetDivisions
  | GetOffices
  | GetUpgradeLevels
  | HasResearched
  | GetMaterialData
  | GetProducts
  | GetIndustryData
  | GetWarehouses

export type ResponseWithKind<Kind extends ServerResponseKind> = Extract<Response, { kind: Kind }>

export type SuccessfulResponse<T extends Response = Response> = Extract<T, { error: never }>

export type SuccessfulResponseWithKind<Kind extends ServerResponseKind> = Extract<SuccessfulResponse, { kind: Kind }>

export type ErrorResponse = Extract<Response, { error: Error }>

export type ErrorResponseWithKind<Kind extends ServerResponseKind> = Extract<ErrorResponse, { kind: Kind }>

export type ServerMethodMap = {
  response: (response: Response) => void
  configUpdated: (config?: ConfigData) => void
  getConfig: (opts: { id: string; returnPort: number }) => void
}

export type ClientMethodMap = {
  zeusConfig: (opts: { id: string; config: ConfigData }) => void
}
