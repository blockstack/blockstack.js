import { BNS_CONTRACT_DEPLOY_TXID } from '../../src/constants'
import { DIDParseErrorCodes } from '../../src/errors'
import { encodeStacksDid, isMigratedOnChainDid, parseStacksDID } from '../../src/utils'

test('Correctly parses on-chain DID', () => {
  const mainnetAddr = 'SPWA58Z5C5JJW2TTJEM8VZA71NJW2KXXB2HA1V16'
  const txId = 'd8a9a4528ae833e1894eee676af8d218f8facbf95e166472df2c1a64219b5dfb'

  const parsedMainnetDid = parseStacksDID(`did:stack:v2:${mainnetAddr}-${txId}`).right()

  expect(parsedMainnetDid.address).toEqual(mainnetAddr)
  expect(parsedMainnetDid.anchorTxId).toEqual(txId)
  expect(parsedMainnetDid.metadata).toEqual({
    deployment: 'main',
    type: 'onChain',
  })

  const testnetAddr = 'STB53GD600EMEM74DFMA0B61JN8D8C4VE5477MXR'
  const parsedTestnetDid = parseStacksDID(`did:stack:v2:${testnetAddr}-${txId}`).right()

  expect(parsedTestnetDid.address).toEqual(testnetAddr)
  expect(parsedTestnetDid.anchorTxId).toEqual(txId)
  expect(parsedTestnetDid.metadata).toEqual({
    deployment: 'test',
    type: 'onChain',
  })
})

test('Correctly parses off-chain DID', () => {
  const mainnetAddr = 'SHB53GD600EMEM74DFMA0B61JN8D8C4VE6DHF2QF'
  const txId = 'ca2c2398b017d6d4c0e3e58b3807a648ebd5e15e1e1ce98649bab7bda044cf37'

  const parsedMainnetDid = parseStacksDID(`did:stack:v2:${mainnetAddr}-${txId}`).right()
  expect(parsedMainnetDid.address).toEqual(mainnetAddr)
  expect(parsedMainnetDid.anchorTxId).toEqual(txId)
  expect(parsedMainnetDid.metadata).toEqual({
    deployment: 'main',
    type: 'offChain',
  })

  const testAddr = 'SJB53GD600EMEM74DFMA0B61JN8D8C4VE4M8NJRP'
  const parsedTestnetDid = parseStacksDID(`did:stack:v2:${testAddr}-${txId}`).right()

  expect(parsedTestnetDid.address).toEqual(testAddr)
  expect(parsedTestnetDid.anchorTxId).toEqual(txId)
  expect(parsedTestnetDid.metadata).toEqual({
    deployment: 'test',
    type: 'offChain',
  })
})

test('Fails to parse mallformed DIDs', () => {
  const addr = 'SHB53GD600EMEM74DFMA0B61JN8D8C4VE6DHF2QF'
  const txId = 'ca2c2398b017d6d4c0e3e58b3807a648ebd5e15e1e1ce98649bab7bda044cf37'

  const withInvalidDidMethod = `did:stack:v1:${addr}-${txId}`
  expect(parseStacksDID(withInvalidDidMethod).left().message).toContain(
    DIDParseErrorCodes.IncorrectMethodIdentifier
  )

  const withInvalidAddr = `did:stack:v2:${addr.substr(1)}-${txId}`
  expect(parseStacksDID(withInvalidAddr).left().message).toContain(
    DIDParseErrorCodes.InvalidAddress
  )

  const withInvalidTxId = `did:stack:v2:${addr}-${txId.substr(1)}`
  expect(parseStacksDID(withInvalidTxId).left().message).toContain(
    DIDParseErrorCodes.InvalidTransactionId
  )

  const addrWithInvalidVersionByte = 'S5B53GD600EMEM74DFMA0B61JN8D8C4VE4C2YSMV'
  const withInvalidVersionByte = `did:stack:v2:${addrWithInvalidVersionByte}-${txId}`
  expect(parseStacksDID(withInvalidVersionByte).left().message).toContain(
    DIDParseErrorCodes.InvalidVersionByte
  )

  expect(parseStacksDID('did:stack:v2:').left().message).toContain(DIDParseErrorCodes.InvalidNSI)
  expect(parseStacksDID(`did:stack:v2:${addr}`).left().message).toContain(
    DIDParseErrorCodes.InvalidTransactionId
  )
})

test('Correctly assembles DID based on address and txId', () => {
  const address = 'SHB53GD600EMEM74DFMA0B61JN8D8C4VE6DHF2QF'
  const anchorTxId = 'ca2c2398b017d6d4c0e3e58b3807a648ebd5e15e1e1ce98649bab7bda044cf37'

  expect(
    encodeStacksDid({
      address,
      anchorTxId,
    }).right()
  ).toEqual(`did:stack:v2:${address}-${anchorTxId}`)
})

test('Fails to assemble DID based given mallformed address or txId', () => {
  const address = 'SHB53GD600EMEM74DFMA0B61JN8D8C4VE6DHF2QF'
  const anchorTxId = 'ca2c2398b017d6d4c0e3e58b3807a648ebd5e15e1e1ce98649bab7bda044cf37'

  expect(
    encodeStacksDid({
      address: '',
      anchorTxId,
    }).left().message
  ).toContain(DIDParseErrorCodes.InvalidAddress)

  expect(
    encodeStacksDid({
      address,
      anchorTxId: '',
    }).left().message
  ).toContain(DIDParseErrorCodes.InvalidTransactionId)
})

test('Correctly determines if a DID is based on on-chain name', () => {
  const address = 'SHB53GD600EMEM74DFMA0B61JN8D8C4VE6DHF2QF'
  const migratedMainnetDid = `did:stack:v2:${address}-${BNS_CONTRACT_DEPLOY_TXID.main}`
  const migratedTestnetDid = `did:stack:v2:${address}-${BNS_CONTRACT_DEPLOY_TXID.test}`

  expect(isMigratedOnChainDid(migratedMainnetDid)).toBe(true)
  expect(isMigratedOnChainDid(migratedTestnetDid)).toBe(true)

  const randomTxId = 'a'.repeat(64)
  const regularDid = `did:stack:v2:${address}-${randomTxId}`
  expect(isMigratedOnChainDid(regularDid)).toBe(false)
})
