import { StacksNetwork } from '@stacks/network'
import { chain, map, resolve } from 'fluture'
import { fetchTransactionById, fetchZoneFileForName } from '../api'
import { DIDType, StacksDID } from '../types'
import {
  findSubdomainZoneFileByOwner,
  eitherToFuture,
  getApiUrl,
  parseAndValidateTransaction,
  encodeFQN,
  getPublicKeyUsingZoneFile,
} from './'

/**
 * Given an on-chain or off-chain (not migrated) Stacks DID, will attempt to map it to it's corresponding BNS name
 * as defined in section 3.3 of the DID method specification
 * @see ../../docs/DID_Method_Spec.md
 */

export const mapDidToName = (did: StacksDID, network: StacksNetwork) =>
  getNameRecordForDID(did, network).pipe(
    chain(({ zonefile, fqn }) =>
      getPublicKeyUsingZoneFile(zonefile, did.address).pipe(map(_ => fqn))
    )
  )

const getNameRecordForDID = (did: StacksDID, network: StacksNetwork) =>
  fetchTransactionById(getApiUrl(network), did.anchorTxId)
    .pipe(map(parseAndValidateTransaction(did)))
    .pipe(chain(eitherToFuture))
    .pipe(
      chain(({ name, namespace, zonefileHash }) =>
        fetchZoneFileForName(getApiUrl(network), { name, namespace, zonefileHash }).pipe(
          chain(zonefile =>
            did.metadata.type === DIDType.offChain
              ? eitherToFuture(findSubdomainZoneFileByOwner(zonefile, did.address))
              : resolve({ fqn: encodeFQN({ name, namespace }), zonefile })
          )
        )
      )
    )
