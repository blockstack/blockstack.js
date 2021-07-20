import { StacksMocknet, StacksNetwork } from '@stacks/network'
import {
  preorderAndRegisterName,
  registerNamespace,
  rekeyName,
  revokeName,
} from './registrar/index'
revokeName
import { registerSubdomain, rekeySubdomain, revokeSubdomain } from './registrar/subdomains'
import { encodeStacksDid, decodeFQN, eitherToFuture, encodeFQN } from '../../src/utils/'
import { fetchNameInfo } from '../../src/api'
import { chain, map, promise } from 'fluture'
import { testNames, testNamespace, testSubdomains } from './data'
import { writeFileSync } from 'fs'
import { wait } from './registrar/utils'
import { identity } from 'ramda'
var path = require('path')

const network = new StacksMocknet()

/**
 * Helper method which will register 3 BNS names on a locally running mocknet instance
 * The 3 names correspond to 3 DID lifecycle cases.
 * The first one is registered, we expect DID resolution to work
 * The second one is registered and then revoked, we expect DID resolution to fail
 * The third one is registered and then transferred, we expect DID resolution to return the latest keys
 *
 */

export const setupNames = async () => {
  // First register the namespace
  await registerNamespace(testNamespace.name, network, testNamespace.keyPair)

  // Now register the three names
  const DIDs = await Promise.all(
    Object.entries(testNames).map(([_, data]) =>
      preorderAndRegisterName(data.name, testNamespace.name, network, data.keypair)
        .then(did => ({
          [data.name]: did.cata(e => e.message, identity),
        }))
        .then()
    )
  ).then(dids => dids.reduce((acc, current) => ({ ...acc, ...current }), {}))

  // Revoke one of the names
  await revokeName(testNames.revoked.name, testNamespace.name, testNames.revoked.keypair, network)

  // Rotate the key for one of the names
  await rekeyName(
    testNames.rotated.name,
    testNamespace.name,
    testNames.rotated.keypair,
    testNames.rotated.newKeypair,
    network
  )

  return DIDs
}

/**
 * Helper method which will register 3 BNS subdomains using a locally running mocknet instance
 * The 3 names correspond to 3 off-chain DID lifecycle test cases.
 * The first one is registered, we expect DID resolution to work
 * The second one is registered and then revoked, we expect DID resolution to fail
 * The third one is registered and then transferred, we expect DID resolution to return the latest keys
 */

export const setupSubdomains = async () => {
  // Register the three subdomains
  // The 2.5 sec waiting periods scattered around are there to ensure we wait a bit for
  // the new zone file to propagate. If we try to query a Stacks node for it right away / too soon,
  // we might get an empty string.

  const offChainDids = await Object.entries(testSubdomains).reduce(
    async (acc, [_, { name: subdomain, keypair }]) =>
      acc.then(v =>
        promise(wait(2500)).then(() =>
          registerSubdomain(
            encodeFQN({
              subdomain,
              name: testNames.simple.name,
              namespace: testNamespace.name,
            }),
            testNames.simple.keypair,
            { ownerKeyPair: keypair },
            network
          ).then(did => {
            return {
              ...v,
              ...{ [subdomain]: did.cata(e => e.message, identity) },
            }
          })
        )
      ),
    Promise.resolve({})
  )

  await promise(wait(2500))

  await revokeSubdomain(
    encodeFQN({
      name: testNames.simple.name,
      namespace: testNamespace.name,
      subdomain: testSubdomains.revoked.name,
    }),
    testNames.simple.keypair,
    network
  )

  await promise(wait(2500))

  await rekeySubdomain(
    encodeFQN({
      name: testNames.simple.name,
      namespace: testNamespace.name,
      subdomain: testSubdomains.rotated.name,
    }),
    testNames.simple.keypair,
    {
      newOwnerKeyPair: testSubdomains.rotated.newKeypair,
    },
    network
  )

  await promise(wait(2500))

  return offChainDids
}

export const setup = async () => {
  console.log('Setting up on-chain names')
  const onChainDids = await setupNames()

  console.log('Setting up off-chain names')
  const offChainDids = await setupSubdomains()

  writeFileSync(
    path.join(__dirname, 'artifacts.json'),
    JSON.stringify({
      onChainDids,
      offChainDids,
    })
  )

  console.log('done, you can run "npm run test:integration" now')
}

export const getDIDFromName = (fqn: string, network: StacksNetwork) => {
  return eitherToFuture(decodeFQN(fqn))
    .pipe(chain(fqn => fetchNameInfo(network, fqn)))
    .pipe(map(({ address, last_txid }) => encodeStacksDid({ address, anchorTxId: last_txid })))
}

setup()
