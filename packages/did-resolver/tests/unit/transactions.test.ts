import { validNameRegisterTx, validNameUpdateTx } from './data/transactions.data'
import { encodeStacksDid, parseAndValidateTransaction, parseStacksDID } from '../../src/utils'
import { DIDResolutionErrorCodes } from '../../src/errors'

test('Correctly handles name register TX', () => {
  const did = encodeStacksDid({
    address: validNameRegisterTx.sender_address,
    anchorTxId: validNameRegisterTx.tx_id,
  })
    .flatMap(parseStacksDID)
    .right()

  expect(parseAndValidateTransaction(did)(validNameRegisterTx).right()).toEqual({
    name: 'anwaar',
    namespace: 'btc',
    zonefileHash: 'd5bc76f71d4d765f2bddcab0abca61895de0731c',
  })

  const offChainAddr = 'SHB53GD600EMEM74DFMA0B61JN8D8C4VE6DHF2QF'
  const offChainDid = encodeStacksDid({
    address: offChainAddr,
    anchorTxId: validNameRegisterTx.tx_id,
  })
    .flatMap(parseStacksDID)
    .right()

  // Name register transactions cannot be used to incept an off-chain DID
  expect(parseAndValidateTransaction(offChainDid)(validNameRegisterTx).left().message).toContain(
    DIDResolutionErrorCodes.InvalidAnchorTx
  )
})

test('Correctly handles name update TX', () => {
  const offChainAddr = 'SHB53GD600EMEM74DFMA0B61JN8D8C4VE6DHF2QF'
  const did = encodeStacksDid({
    address: offChainAddr,
    anchorTxId: validNameUpdateTx.tx_id,
  })
    .flatMap(parseStacksDID)
    .right()

  expect(parseAndValidateTransaction(did)(validNameUpdateTx).right()).toEqual({
    name: 'credit-suisse',
    namespace: 'btc',
    zonefileHash: '0bca2efa91e1771850f8b3536bfb08a603c38906',
  })

  const onChainDid = encodeStacksDid({
    address: validNameUpdateTx.sender_address,
    anchorTxId: validNameRegisterTx.tx_id,
  })
    .flatMap(parseStacksDID)
    .right()

  // Name update transactions cannot be used to incept an on-chain DID
  expect(parseAndValidateTransaction(onChainDid)(validNameUpdateTx).left().message).toContain(
    DIDResolutionErrorCodes.InvalidAnchorTx
  )
})

test('Correctly fails to parse name register TX if status is not success', () => {
  const did = encodeStacksDid({
    address: validNameRegisterTx.sender_address,
    anchorTxId: validNameRegisterTx.tx_id,
  })
    .flatMap(parseStacksDID)
    .right()

  const invalidTxStatus = Object.assign({}, validNameRegisterTx, { tx_status: 'pending' })
  expect(parseAndValidateTransaction(did)(invalidTxStatus).left().message).toContain(
    DIDResolutionErrorCodes.InvalidAnchorTx
  )

  const invalidTxType = Object.assign({}, validNameRegisterTx, { tx_type: 'token-transfer' })
  expect(parseAndValidateTransaction(did)(invalidTxType).left().message).toContain(
    DIDResolutionErrorCodes.InvalidAnchorTx
  )

  const invalidContractId = Object.assign({}, validNameRegisterTx, {
    contract_call: { contract_id: validNameRegisterTx.sender_address },
  })
  expect(parseAndValidateTransaction(did)(invalidContractId).left().message).toContain(
    DIDResolutionErrorCodes.InvalidAnchorTx
  )

  const invalidFunctionCalled = Object.assign({}, validNameRegisterTx)
  invalidFunctionCalled.contract_call = {
    ...invalidFunctionCalled.contract_call,
    function_name: 'name-revoke',
  }
  expect(parseAndValidateTransaction(did)(invalidFunctionCalled).left().message).toContain(
    DIDResolutionErrorCodes.InvalidAnchorTx
  )

  const missingCallArgs = Object.assign({}, validNameRegisterTx)
  missingCallArgs.contract_call = { ...missingCallArgs.contract_call, function_args: [] }
  expect(parseAndValidateTransaction(did)(missingCallArgs).left().message).toContain(
    DIDResolutionErrorCodes.InvalidAnchorTx
  )
})
