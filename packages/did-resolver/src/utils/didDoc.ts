import { DIDDocument } from 'did-resolver'
const b58 = require('bs58')

export const buildDidDoc = ({
  did,
  publicKey,
}: //tokenUrl,
{
  did: string
  publicKey: string
  tokenUrl?: string
}): DIDDocument => {
  // const serviceEndpSection = tokenUrl ? { service: [buildServiceEndpointSection(tokenUrl)] } : {}

  return {
    //...serviceEndpSection,
    '@context': 'https://www.w3.org/ns/did/v1',
    id: did,
    verificationMethod: [
      {
        id: `${did}#signing`,
        controller: `${did}`,
        type: 'EcdsaSecp256k1VerificationKey2019',
        publicKeyBase58: b58.encode(Buffer.from(publicKey, 'hex')),
      },
    ],
    authentication: [`${did}#signing`],
    assertionMethod: [`${did}#signing`],
  }
}

// const buildServiceEndpointSection = (gaiaHubUrl: string) => {
//   return {
//     type: 'GaiaHub',
//     id: '#gaiaStorageHub',
//     serviceEndpoint: gaiaHubUrl,
//   }
// }
