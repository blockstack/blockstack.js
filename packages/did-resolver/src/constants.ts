import { AddressVersion } from '@stacks/transactions'
import { DIDType, StacksNetworkDeployment } from './types'

/**
 * These constants are referenced, and further explained in the DID method specification document
 * @see ../docs/DID_Method_Spec.md
 */

export const DID_METHOD_PREFIX = 'did:stack:v2'

/*
 * If a subdomain has been transferred to this address (i.e. this addresss is listed as the current owner),
 * it is considered revoked (the derived DID is therefore considered deactivated).
 */

export const SUBDOMAIN_REVOKED_ADDR = '1111111111111111111114oLvT2'

/**
 * The BNS contract is deployed at these addresses
 */

export const BNS_ADDRESSES = {
  main: 'SP000000000000000000002Q6VF78.bns',
  test: 'ST000000000000000000002AMW42H.bns',
}

/*
 * In order to correctly resolve migrated names, a helper clairty contract was defined and deployed.
 * The contract calls the "resolve-principal" function defined on the BNS contract,
 * at-block height 1 (at this point the BNS contract state only contains migrated names),
 * to map the address to a migrted name
 */

export const GENESIS_RESOLVER_ADDRESSES = {
  main: 'SPPJE6KB9CNCVTS9RAFHY1RSXAH381W8RKJDM9J9.BNS-migrated-helper',
  test: 'STPJE6KB9CNCVTS9RAFHY1RSXAH381W8RJQV1YCB.BNS-migrated-helper',
}

/**
 * The ID of the Stacks transaction in which the BNS contract was deployed.
 * Used to represent DIDs based on migrated BNS names. In case the DID contins this transaction ID
 * as part of it's NSI, the mapping to a BNS name happens via a call to a helper contract
 * @see - https://github.com/jolocom/stacks-did-resolver/blob/main/docs/DID_Method_Spec.md#35-migration-from-legacy-stack-v1-dids
 */

export const BNS_CONTRACT_DEPLOY_TXID = {
  test: '55bb3a37f9b2e8c58905c95099d5fc21aa47d073a918f3b30cc5abe4e3be44c6',
  main: 'd8a9a4528ae833e1894eee676af8d218f8facbf95e166472df2c1a64219b5dfb',
}

/**
 * Version bytes used to denote off-chain DIDs. As documented here:
 * @see https://github.com/jolocom/stacks-did-resolver/blob/main/docs/DID_Method_Spec.md#22-address-encoding
 */

export const OffChainAddressVersion = {
  mainnet: 17,
  testnet: 18,
}

export const versionByteToDidType = {
  [AddressVersion.MainnetSingleSig]: {
    type: DIDType.onChain,
    deployment: StacksNetworkDeployment.main,
  },
  [AddressVersion.TestnetSingleSig]: {
    type: DIDType.onChain,
    deployment: StacksNetworkDeployment.test,
  },
  [OffChainAddressVersion.mainnet]: {
    type: DIDType.offChain,
    deployment: StacksNetworkDeployment.main,
  },
  [OffChainAddressVersion.testnet]: {
    type: DIDType.offChain,
    deployment: StacksNetworkDeployment.test,
  },
}
