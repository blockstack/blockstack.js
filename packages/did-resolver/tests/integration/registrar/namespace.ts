import {
  buildPreorderNamespaceTx,
  buildRevealNamespaceTx,
  buildReadyNamespaceTx,
} from '@stacks/bns'
import { StacksNetwork } from '@stacks/network'
import { StacksKeyPair, waitForConfirmation } from './utils'
import {
  TransactionSigner,
  broadcastTransaction,
  getAddressFromPublicKey,
  TransactionVersion,
} from '@stacks/transactions'
import { priceFunction, lifetime, STX_TO_BURN } from './constants'
import { promise } from 'fluture'

const preorderNamespace = async (
  namespace: string,
  network: StacksNetwork,
  keyPair: StacksKeyPair,
  salt = 'salt'
) => {
  return buildPreorderNamespaceTx({
    namespace,
    salt,
    stxToBurn: STX_TO_BURN,
    publicKey: keyPair.publicKey.data.toString('hex'),
    network,
  }).then(async tx => {
    const s = new TransactionSigner(tx)
    s.signOrigin(keyPair.privateKey)

    return broadcastTransaction(tx, network).then(txId =>
      promise(waitForConfirmation(txId as string, network))
    )
  })
}

const revealNamespace = (
  namespace: string,
  network: StacksNetwork,
  keyPair: StacksKeyPair,
  salt = 'salt'
) =>
  buildRevealNamespaceTx({
    namespace,
    salt,
    priceFunction,
    lifetime,
    namespaceImportAddress: getAddressFromPublicKey(
      keyPair.publicKey.data,
      TransactionVersion.Testnet
    ),
    publicKey: keyPair.publicKey.data.toString('hex'),
    network,
  }).then(async tx => {
    const s = new TransactionSigner(tx)
    s.signOrigin(keyPair.privateKey)
    return broadcastTransaction(tx, network).then(txId =>
      promise(waitForConfirmation(txId as string, network))
    )
  })

const readyNamespace = (namespace: string, network: StacksNetwork, keyPair: StacksKeyPair) =>
  buildReadyNamespaceTx({
    network,
    namespace,
    publicKey: keyPair.publicKey.data.toString('hex'),
  }).then(async tx => {
    const s = new TransactionSigner(tx)
    s.signOrigin(keyPair.privateKey)

    return broadcastTransaction(tx, network).then(txId =>
      promise(waitForConfirmation(txId as string, network))
    )
  })

export const registerNamespace = async (
  namespace: string,
  network: StacksNetwork,
  keyPair: StacksKeyPair
) => {
  await preorderNamespace(namespace, network, keyPair)
  await revealNamespace(namespace, network, keyPair)
  await readyNamespace(namespace, network, keyPair)
}
