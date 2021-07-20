import { encodeStacksDid, buildDidDoc } from '../../src/utils/'
import { buildResolve } from '../../src/'
import * as chai from 'chai'
import { testNames, testSubdomains } from '../integration/data'
import { compressPublicKey, publicKeyToAddress, randomBytes } from '@stacks/transactions'
import { getKeyPair } from './registrar/utils'
import { BNS_CONTRACT_DEPLOY_TXID, OffChainAddressVersion } from '../../src/constants'
import { StacksMainnet, StacksMocknet } from '@stacks/network'
import { identity } from 'ramda'
import { DIDResolutionError, DIDResolutionErrorCodes } from '../../src/errors'

const getTestDids = () => {
  try {
    const { onChainDids, offChainDids } = require('./artifacts.json')
    return { onChainDids, offChainDids }
  } catch {
    console.error('No DIDs found in artifacts.json, make sure to run yarn test:setup')
    process.exit(0)
  }
}

var chaiAsPromised = require('chai-as-promised')

chai.use(chaiAsPromised)
chai.should()

const mocknetResolve = buildResolve(new StacksMocknet())

describe('did:stack:v2 resolver', () => {
  const { simple, revoked, rotated } = getTestDids().onChainDids
  describe('On-chain DIDs', () => {
    test('correctly resolves newly created DID', async () => {
      const didDoc = await mocknetResolve(simple)

      // expect(didDoc.service).toHaveLength(1)
      // expect(didDoc.service[0].serviceEndpoint).toContain('https://ipfs.jolocom.io')

      return expect(didDoc).toStrictEqual(
        buildDidDoc({
          did: simple,
          publicKey: testNames.simple.keypair.publicKey.data.toString('hex'),
        })
      )
    })

    test('Should correctly resolve DID after the key was rotated', async () => {
      const didDoc = await mocknetResolve(rotated)

      return expect(didDoc).toStrictEqual(
        buildDidDoc({
          did: rotated,
          publicKey: testNames.rotated.newKeypair.publicKey.data.toString('hex'),
        })
      )
    })

    test('Should fail to resolve DID after name was revoked', async () => {
      return expect(mocknetResolve(revoked)).rejects.toStrictEqual(
        new DIDResolutionError(
          DIDResolutionErrorCodes.DIDDeactivated,
          'Underlying BNS name revoked'
        )
      )
    })

    test('Should correctly resolve DID based on migrated BNS name', async () => {
      const testAddr = 'SPWA58Z5C5JJW2TTJEM8VZA71NJW2KXXB2HA1V16'
      const testDid = encodeStacksDid({
        address: testAddr,
        anchorTxId: BNS_CONTRACT_DEPLOY_TXID.main,
      }).cata(_ => '', identity)

      const mainnetResolve = buildResolve(new StacksMainnet())
      const didDoc = await mainnetResolve(testDid)

      expect(didDoc.id).toBe(testDid)
    })

    test('Fails to resolve DID based on migrated name if BNS name not found', async () => {
      const testAddr = 'SP2P3MPMNHXKJG9BDA2W95NQK0C4W9XVXXAG753NG'
      const testDid = encodeStacksDid({
        address: testAddr,
        anchorTxId: BNS_CONTRACT_DEPLOY_TXID.main,
      }).cata(_ => '', identity)

      const mainnetResolve = buildResolve(new StacksMainnet())
      expect(mainnetResolve(testDid)).rejects.toMatchSnapshot()
    })

    it('Should fail to resolve DID based on expired name', async () => {
      const testAddr = 'SP15XBGYRVMKF1TWPXE6A3M0T2A87VYSVF9VFSZ1A'
      const testDid = encodeStacksDid({
        address: testAddr,
        anchorTxId: BNS_CONTRACT_DEPLOY_TXID.main,
      }).cata(_ => '', identity)

      const mainnetResolve = buildResolve(new StacksMainnet())

      return expect(mainnetResolve(testDid)).rejects.toStrictEqual(
        new DIDResolutionError(DIDResolutionErrorCodes.DIDExpired, 'Underlying BNS name expired')
      )
    })
  })

  describe('Off-chain DIDs', () => {
    const { simple, rotated, revoked } = getTestDids().offChainDids

    test('correctly resolve off-chain DID', async () => {
      const compressedPublicKey = compressPublicKey(testSubdomains.simple.keypair.publicKey.data)

      const didDoc = await mocknetResolve(simple)

      return expect(didDoc).toStrictEqual(
        buildDidDoc({
          did: simple,
          publicKey: compressedPublicKey.data.toString('hex'),
        })
      )
    })

    test('correctly resolve a off-chain DID after key rotation', async () => {
      const compressedPublicKey = compressPublicKey(
        testSubdomains.rotated.newKeypair.publicKey.data
      )

      const didDoc = await mocknetResolve(rotated)

      return expect(didDoc).toStrictEqual(
        buildDidDoc({
          did: rotated,
          publicKey: compressedPublicKey.data.toString('hex'),
        })
      )
    })

    test('correctly fails to resolve a off-chain DID after it was revoked', async () => {
      return expect(mocknetResolve(revoked)).rejects.toStrictEqual(
        new DIDResolutionError(
          DIDResolutionErrorCodes.InvalidSignedProfileToken,
          'Token issuer public key does not match the verifying value'
        )
      )
    })

    test('fails to resolve non-existent valid DID', async () => {
      const mockTxId = '0x' + randomBytes(32).toString('hex')
      const randomAddress = publicKeyToAddress(
        OffChainAddressVersion.testnet,
        getKeyPair().publicKey
      )

      return expect(
        mocknetResolve(
          encodeStacksDid({ address: randomAddress, anchorTxId: mockTxId }).cata(_ => '', identity)
        )
      ).rejects.toStrictEqual(
        new DIDResolutionError(
          DIDResolutionErrorCodes.InvalidAnchorTx,
          `could not find transaction by ID ${mockTxId}`
        )
      )
    })
  })
})
