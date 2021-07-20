import { compose } from 'ramda'
import { hexToCV, cvToValue } from '@stacks/transactions'
import { stripHexPrefixIfPresent } from './'
import { BNS_ADDRESSES } from '../constants'
import { Left, Right, Either } from 'monet'
import { DIDType, StacksDID } from '../types'
import { DIDResolutionError, DIDResolutionErrorCodes } from '../errors'

export const hexToAscii = (hex: string) =>
  Buffer.from(stripHexPrefixIfPresent(hex), 'hex').toString('ascii')

type TransactionArguments = {
  name: string
  namespace: string
  zonefileHash: string
}

/**
 * Will ensure that the supplied Stacks Transaction object is a valid inception / anchor transaction for
 * the supplied Stacks DID
 * The verification rules vary depending on whether a on-chain or an off-chain DID is supplied.
 *
 * Please reffer to sections 3.1 and 3.2 of the DID Method specification for additonal details
 */

export const parseAndValidateTransaction =
  (did: StacksDID) =>
  (tx: any): Either<Error, TransactionArguments> => {
    const validDidInceptionEvents = {
      [DIDType.offChain]: ['name-import', 'name-update'],
      [DIDType.onChain]: ['name-register', 'name-import'],
    }

    if (tx.tx_status !== 'success') {
      return Left(
        new DIDResolutionError(
          DIDResolutionErrorCodes.InvalidAnchorTx,
          'Name anchor transaction status must be "success"'
        )
      )
    }

    const contractCallData = tx.contract_call

    if (tx.tx_type !== 'contract_call' || !contractCallData) {
      return Left(
        new DIDResolutionError(
          DIDResolutionErrorCodes.InvalidAnchorTx,
          'Name anchor transaction must encode contract call'
        )
      )
    }

    if (BNS_ADDRESSES[did.metadata.deployment] !== contractCallData.contract_id) {
      return Left(
        new DIDResolutionError(
          DIDResolutionErrorCodes.InvalidAnchorTx,
          'Name anchor transaction must be destined to the BNS contract'
        )
      )
    }

    const calledFunction = contractCallData['function_name']

    if (!validDidInceptionEvents[did.metadata.type].includes(calledFunction)) {
      return Left(
        new DIDResolutionError(
          DIDResolutionErrorCodes.InvalidAnchorTx,
          'Name anchor transaction references invalid function call'
        )
      )
    }

    return extractContractCallArgs(contractCallData.function_args)
  }

/**
 * Extracts the namespace, name, and zonefile-hash arguments from a valid DID inception / anchor Stacks transaction objectect
 * Returns the name, namespace, and zonefile-hash encoded in valid inception event.
 */

const extractContractCallArgs = (functionArgs: Array<any>): Either<Error, TransactionArguments> => {
  const relevantArguments = ['name', 'namespace', 'zonefile-hash']

  const {
    name,
    namespace,
    'zonefile-hash': zonefileHash,
  } = functionArgs.reduce((parsed, current) => {
    if (relevantArguments.includes(current.name)) {
      return { ...parsed, [current.name]: current.hex }
    }
    return parsed
  }, {})

  if (!name || !namespace || !zonefileHash) {
    return Left(
      new DIDResolutionError(
        DIDResolutionErrorCodes.InvalidAnchorTx,
        'Name anchor transaction does not include expected arguments'
      )
    )
  }

  const hexEncodedValues = [name, namespace, zonefileHash].map(
    compose(cvToValue, hexToCV, stripHexPrefixIfPresent)
  )

  const [nameArg, namespaceArg, zonefileHashArg] = hexEncodedValues

  return Right({
    name: hexToAscii(nameArg),
    namespace: hexToAscii(namespaceArg),
    zonefileHash: stripHexPrefixIfPresent(zonefileHashArg),
  })
}
