import { eitherToFuture, encodeFQN, hexToAscii } from '../utils/'
import { StacksDID } from '../types'
import { chain, encaseP, FutureInstance, map } from 'fluture'
import { StacksNetwork } from '@stacks/network'
import { DIDResolutionError, DIDResolutionErrorCodes } from '../errors'
import { Right, Left, Either } from 'monet'
import { GENESIS_RESOLVER_ADDRESSES } from '../constants'
import {
  makeRandomPrivKey,
  getPublicKey,
  getAddressFromPublicKey,
  callReadOnlyFunction,
  ReadOnlyFunctionOptions,
  ClarityValue,
  standardPrincipalCV,
  TupleCV,
  ResponseOkCV,
  cvToString,
  ClarityType,
} from '@stacks/transactions'

/**
 * The Stacks V1 blockchain implemented BNS through first-order name operations. In Stacks V2,
 * BNS is instead implemented through a smart-contract loaded during the genesis block.
 *
 * All names registered using the first iteration of the BNS were included in the initial BNS contract state,
 * and are therefore resolvable using the new BNS approach.
 *
 * @see https://docs.stacks.co/build-apps/references/bns
 */

export const mapDidToMigratedName = (did: StacksDID, network: StacksNetwork) =>
  mapOwnerToMigratedName(did.address, network)

/**
 * Given a Stacks address, will attempt to map it to a migrated BNS name
 * as described in section 3.5 of the DID method specification.
 */

const mapOwnerToMigratedName = (
  ownerAddress: string,
  network: StacksNetwork
): FutureInstance<Error, string> => {
  const proxyResolver = network.isMainnet()
    ? GENESIS_RESOLVER_ADDRESSES.main
    : GENESIS_RESOLVER_ADDRESSES.test

  const [contractAddress, contractName] = proxyResolver.split('.')

  const senderAddress = getAddressFromPublicKey(getPublicKey(makeRandomPrivKey()).data)

  const options = {
    contractAddress,
    contractName,
    functionName: 'get-migrated-names',
    functionArgs: [standardPrincipalCV(ownerAddress)],
    network,
    senderAddress,
  }

  return encaseP<Error, ClarityValue, ReadOnlyFunctionOptions>(callReadOnlyFunction)(options)
    .pipe(
      map((result): Either<Error, string> => {
        if (result.type === ClarityType.ResponseOk) {
          const { name, namespace } = (result as ResponseOkCV<TupleCV>).value.data

          return Right(
            encodeFQN({
              name: hexToAscii(cvToString(name)),
              namespace: hexToAscii(cvToString(namespace)),
            })
          )
        }

        return Left(
          new DIDResolutionError(
            DIDResolutionErrorCodes.NoMigratedNamesFound,
            `No names owned by ${ownerAddress} found at BNS inception`
          )
        )
      })
    )
    .pipe(chain(eitherToFuture))
}
