export enum DIDParseErrorCodes {
  InvalidVersionByte = 'InvalidVersionByte',
  InvalidAddress = 'InvalidAddress,',
  InvalidTransactionId = 'InvalidTransactionId,',
  InvalidNSI = 'InvalidNSI',
  IncorrectMethodIdentifier = 'IncorrectMethodIdentifier,',
}

export enum DIDResolutionErrorCodes {
  InvalidMigrationTx = 'InvalidMigrationTx',
  NoMigratedNamesFound = 'NoMigratedNamesFound',
  MigratedOwnerMissmatch = 'MigratedOwnerMissmatch',
  InvalidAnchorTx = 'InvalidAnchorTx',
  MissingZoneFile = 'MissingZoneFile',
  InvalidZonefile = 'InvalidZonefile',
  InvalidSignedProfileToken = 'InvalidSignedProfileToken',
  DIDExpired = 'DIDExpired',
  DIDDeactivated = 'DIDDeactivated',
}

export class DIDResolutionError extends Error {
  public constructor(code: DIDResolutionErrorCodes, message?: string) {
    super(`${code}: ${message ? message : ''}`)
  }
}

export class DIDParseError extends Error {
  public constructor(code: DIDParseErrorCodes, message?: string) {
    super(`${code}: ${message ? message : ''}`)
  }
}
