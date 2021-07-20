import {
  makeRandomPrivKey,
  getPublicKey,
  StacksPrivateKey,
  StacksPublicKey,
  createStacksPrivateKey,
  isCompressed,
  compressPublicKey,
} from '@stacks/transactions'
import { StacksNetwork } from '@stacks/network'
import { fetchTransactionById } from '../../../src/api'
import Future, { chain, resolve, reject, FutureInstance } from 'fluture'
import { getApiUrl } from '../../../src/utils/'
const FormData = require('form-data')

export type StacksKeyPair = {
  privateKey: StacksPrivateKey
  publicKey: StacksPublicKey
}

export const getKeyPair = (privateKey?: string | Buffer): StacksKeyPair => {
  const priv = privateKey ? createStacksPrivateKey(privateKey) : makeRandomPrivKey()

  const publicKey = getPublicKey(priv)
  return {
    privateKey: priv,
    publicKey: isCompressed(publicKey) ? publicKey : compressPublicKey(publicKey.data),
  }
}

export const waitForConfirmation = (
  txId: string,
  network: StacksNetwork,
  delay: number = 3000
): FutureInstance<Error, {}> =>
  wait(delay)
    .pipe(chain(() => fetchTransactionById(getApiUrl(network), txId)))
    .pipe(
      chain(tx => {
        if (tx.tx_status === 'pending') {
          return waitForConfirmation(txId, network)
        }

        if (tx.tx_status === 'success') {
          return resolve(tx)
        }

        return reject(new Error(`Tx failed, ${tx.tx_status} ${txId}`))
      })
    )

export const wait = (ms: number): FutureInstance<never, void> => {
  return Future((_, res) => {
    const t = setTimeout(res, ms)
    return () => clearTimeout(t)
  })
}

export const storeTokenFile = async (data: {}) => {
  const fd = new FormData()
  fd.append('file', Buffer.from(JSON.stringify([data])))

  const res = await fetch(`https://ipfs.jolocom.io/api/v0/add?pin=false`, {
    method: 'POST',
    //@ts-ignore
    body: fd,
  })
  const { Hash } = await res.json()
  return `https://ipfs.jolocom.io/api/v0/cat/${Hash}`
}
