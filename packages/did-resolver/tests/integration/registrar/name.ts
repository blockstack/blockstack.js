import {
  buildPreorderNameTx,
  buildRegisterNameTx,
  buildTransferNameTx,
  buildRevokeNameTx,
} from '@stacks/bns'
import { StacksNetwork } from '@stacks/network'
import { encodeFQN, encodeStacksDid } from '../../../src/utils/'
import { StacksKeyPair, waitForConfirmation, wait, storeTokenFile } from './utils'
import {
  TransactionSigner,
  broadcastTransaction,
  getAddressFromPublicKey,
  TransactionVersion,
  publicKeyToAddress,
  AddressVersion,
} from '@stacks/transactions'

import { promise, chain, map } from 'fluture'
import { makeProfileZoneFile, Profile, signProfileToken, wrapProfileToken } from '@stacks/profile'
import { STX_TO_BURN } from './constants'

const preorderName = (
  name: string,
  namespace: string,
  keyPair: StacksKeyPair,
  network: StacksNetwork,
  salt = 'salt'
) =>
  buildPreorderNameTx({
    fullyQualifiedName: encodeFQN({ name, namespace }),
    salt,
    stxToBurn: STX_TO_BURN,
    network,
    publicKey: keyPair.publicKey.data.toString('hex'),
  }).then(async tx => {
    const signer = new TransactionSigner(tx)
    signer.signOrigin(keyPair.privateKey)

    return broadcastTransaction(tx, network).then(txId =>
      promise(waitForConfirmation(txId as string, network))
    )
  })

const registerName = (
  name: string,
  namespace: string,
  keyPair: StacksKeyPair,
  zonefile: string,
  network: StacksNetwork,
  salt = 'salt'
) =>
  buildRegisterNameTx({
    fullyQualifiedName: encodeFQN({ name, namespace }),
    publicKey: keyPair.publicKey.data.toString('hex'),
    salt,
    zonefile,
    network,
  }).then(async tx => {
    const signer = new TransactionSigner(tx)
    signer.signOrigin(keyPair.privateKey)

    return broadcastTransaction(tx, network, Buffer.from(zonefile)).then(txId =>
      promise(waitForConfirmation(txId as string, network).pipe(chain(() => wait(5000)))).then(
        () => txId as string
      )
    )
  })

export const rekeyName = async (
  name: string,
  namespace: string,
  currentKeyPair: StacksKeyPair,
  newKeyPair: StacksKeyPair,
  network: StacksNetwork
) => {
  const fqn = encodeFQN({ name, namespace })

  const signed = signProfileToken(new Profile(), newKeyPair.privateKey.data.toString('hex'))
  const zf = makeProfileZoneFile(fqn, await storeTokenFile(wrapProfileToken(signed)))

  const newOwnerAddress = getAddressFromPublicKey(
    newKeyPair.publicKey.data,
    TransactionVersion.Testnet
  )

  return buildTransferNameTx({
    fullyQualifiedName: fqn,
    newOwnerAddress,
    network,
    zonefile: zf,
    publicKey: currentKeyPair.publicKey.data.toString('hex'),
  }).then(async tx => {
    const signer = new TransactionSigner(tx)
    signer.signOrigin(currentKeyPair.privateKey)

    return broadcastTransaction(tx, network, Buffer.from(zf)).then(txId =>
      promise(
        waitForConfirmation(txId as string, network)
          .pipe(chain(() => wait(5000)))
          .pipe(map(() => txId))
      )
    )
  })
}

/**
 * Returns the DID for the newly registered name
 */

export const preorderAndRegisterName = async (
  name: string,
  namespace: string,
  network: StacksNetwork,
  keyPair: StacksKeyPair
) => {
  const fqn = encodeFQN({ name, namespace })
  await preorderName(name, namespace, keyPair, network)

  const signed = signProfileToken(new Profile(), keyPair.privateKey.data.toString('hex'))

  const zf = makeProfileZoneFile(fqn, await storeTokenFile(wrapProfileToken(signed)))

  return registerName(name, namespace, keyPair, zf, network).then(txId =>
    encodeStacksDid({
      address: publicKeyToAddress(AddressVersion.TestnetSingleSig, keyPair.publicKey),
      anchorTxId: txId,
    })
  )
}

export const revokeName = async (
  name: string,
  namespace: string,
  keyPair: StacksKeyPair,
  network: StacksNetwork
) =>
  buildRevokeNameTx({
    fullyQualifiedName: encodeFQN({
      name,
      namespace,
    }),

    publicKey: keyPair.publicKey.data.toString('hex'),
    network,
  }).then(async tx => {
    const s = new TransactionSigner(tx)
    s.signOrigin(keyPair.privateKey)

    return broadcastTransaction(tx, network).then(txId =>
      promise(waitForConfirmation(txId as string, network)).then(() => txId)
    )
  })
