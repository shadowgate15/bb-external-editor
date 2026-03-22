import { Division } from '@ns'

export enum ServerResponseKind {
  CreateCorporation = 'createCorporation',
  GetDivision = 'getDivision',
  ExpandIndustry = 'expandIndustry',
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

export type CreateCorporation = ServerResponse<ServerResponseKind.CreateCorporation, boolean>

export type GetDivision = ServerResponse<ServerResponseKind.GetDivision, Division | null>

export type ExpandIndustry = ServerResponse<ServerResponseKind.ExpandIndustry, void>

export type Response = CreateCorporation | GetDivision | ExpandIndustry

export type ResponseWithKind<Kind extends ServerResponseKind> = Extract<Response, { kind: Kind }>

export type SuccessfulResponse = Extract<Response, { error: never }>

export type SuccessfulResponseWithKind<Kind extends ServerResponseKind> = Extract<SuccessfulResponse, { kind: Kind }>

export type ErrorResponse = Extract<Response, { error: Error }>

export type ErrorResponseWithKind<Kind extends ServerResponseKind> = Extract<ErrorResponse, { kind: Kind }>

export type ServerMethodMap = {
  response: (response: Response) => void
}
