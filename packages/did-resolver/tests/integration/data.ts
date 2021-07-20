import { getKeyPair } from './registrar/utils'

const keyPairFromHexPrivKey = (priv: string) => getKeyPair(Buffer.from(priv, 'hex'))

// The pre-fueled keys are sourced from here:
// https://github.com/blockstack/stacks-blockchain-api/blob/master/stacks-blockchain/Stacks-mocknet.toml

export const testNamespace = {
  name: 'testdids',
  keyPair: keyPairFromHexPrivKey(
    'e75dcb66f84287eaf347955e94fa04337298dbd95aa0dbb985771104ef1913db01'
  ),
}

export const testNames = {
  simple: {
    name: 'simple',
    keypair: keyPairFromHexPrivKey(
      'cb3df38053d132895220b9ce471f6b676db5b9bf0b4adefb55f2118ece2478df01'
    ),
  },
  revoked: {
    name: 'revoked',
    keypair: keyPairFromHexPrivKey(
      '21d43d2ae0da1d9d04cfcaac7d397a33733881081f0b2cd038062cf0ccbb752601'
    ),
  },
  rotated: {
    name: 'rotated',
    keypair: keyPairFromHexPrivKey(
      'c71700b07d520a8c9731e4d0f095aa6efb91e16e25fb27ce2b72e7b698f8127a01'
    ),
    newKeypair: keyPairFromHexPrivKey(
      'c71811b07d520a8c9731e4d0f095aa6efb91e16e25fb27ce2b72e7b698f8127a01'
    ),
  },
}

// The keypairs need not be fueled for off-chain DID registration
export const testSubdomains = {
  simple: {
    name: 'simple',
    keypair: keyPairFromHexPrivKey('a'.repeat(64)),
  },
  revoked: {
    name: 'revoked',
    keypair: keyPairFromHexPrivKey('b'.repeat(64)),
  },
  rotated: {
    name: 'rotated',
    keypair: keyPairFromHexPrivKey('c'.repeat(64)),
    newKeypair: keyPairFromHexPrivKey('d'.repeat(64)),
  },
}
