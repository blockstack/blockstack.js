import {
  createRejectedFuture,
  decodeFQN,
  eitherToFuture,
  getApiUrl,
  buildDidDoc,
  parseStacksDID,
  isMigratedOnChainDid,
  findSubdomainZoneFileByName,
  mapDidToName,
  FQN,
  getPublicKeyUsingZoneFile,
} from './utils/'
import { fetchNameInfo, getCurrentBlockNumber, NameInfo } from './api'
import { chain, resolve as fResolve, promise, map } from 'fluture'
import { mapDidToMigratedName } from './migrated/migrated'
import { Either, Right } from 'monet'
import { StacksMainnet, StacksNetwork } from '@stacks/network'
import { DIDResolutionError, DIDResolutionErrorCodes } from './errors'
import { DIDType, StacksDID } from './types'

/**
 * Given a BNS name, will query a Stacks blockchain client for the latest
 * associated state, and ensure that the name has not been revoked, and
 * that the expire_block is lower than the current block height.
 */

const ensureNotRevokedOrExpired = (fqn: string, network: StacksNetwork) =>
  eitherToFuture(decodeFQN(fqn)).pipe(
    chain(decodedFqn =>
      fetchNameInfo(network, decodedFqn).pipe(
        chain(nameInfo =>
          nameInfo.status === 'name-revoke'
            ? createRejectedFuture<Error, { nameInfo: NameInfo; fqn: FQN }>(
                new DIDResolutionError(
                  DIDResolutionErrorCodes.DIDDeactivated,
                  'Underlying BNS name revoked'
                )
              )
            : getCurrentBlockNumber(getApiUrl(network)).pipe(
                chain(currentBlock =>
                  nameInfo.expire_block > currentBlock
                    ? createRejectedFuture<Error, { nameInfo: NameInfo; fqn: FQN }>(
                        new DIDResolutionError(
                          DIDResolutionErrorCodes.DIDExpired,
                          'Underlying BNS name expired'
                        )
                      )
                    : fResolve({
                        fqn: decodedFqn,
                        nameInfo,
                      })
                )
              )
        )
      )
    )
  )

/**
 * Given an on-chain / off-chain BNS name, the corresponding DID, and the associated zone file,
 * will fetch the profile token refernced in the zone file, verify the signature, and return
 * the associated public key if the verification succeeded.
 */

const getPublicKeyForName = (did: StacksDID, decodedFqn: FQN, nameRecord: NameInfo) =>
  eitherToFuture(
    did.metadata.type === DIDType.offChain
      ? findSubdomainZoneFileByName(nameRecord.zonefile, decodedFqn.subdomain || '')
      : (Right({ zonefile: nameRecord.zonefile, owner: nameRecord.address }) as Either<
          Error,
          { zonefile: string; owner: string }
        >)
  ).pipe(chain(v => getPublicKeyUsingZoneFile(v.zonefile, v.owner)))

/**
 * Returns a function resolving a Stacks DID to the corresponding DID document,
 * configured to resolve against the specified {@link StacksNetwork}.
 */

export const buildResolve =
  (stacksNetwork: StacksNetwork = new StacksMainnet()) =>
  (did: string) =>
    promise(
      eitherToFuture(parseStacksDID(did)).pipe(
        chain(parsedDID =>
          (isMigratedOnChainDid(parsedDID)
            ? mapDidToMigratedName(parsedDID, stacksNetwork)
            : mapDidToName(parsedDID, stacksNetwork)
          )
            .pipe(
              chain(mappedName =>
                ensureNotRevokedOrExpired(mappedName, stacksNetwork).pipe(
                  chain(({ nameInfo, fqn }) => getPublicKeyForName(parsedDID, fqn, nameInfo))
                )
              )
            )
            .pipe(map(({ publicKey }) => buildDidDoc({ publicKey, did })))
        )
      )
    )
