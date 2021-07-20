# @stacks/did-resolver

This repository includes the implementation for the Stack v2 DID resolver, as well as the corresponding `did:stack:v2` [DID method specification](./docs/DID_Method_Spec.md). As outlined in the specification, this module relies on an instance of the [BNS](https://docs.stacks.co/build-apps/references/bns) smart contract, as well as the Atlas peer network to perform DID resolution.

## Installation

To install the resolver you can simply run:

```
npm install @stacks/did-resolver
```

## Usage examples
Using the provided module to resolve Stacks DID anchored on the main network is quite simple, and can be achieved as follows:

```typescript
import { resolve } from "@stacks/did-resolver";

const did = 'did:stack:v2:SPWA58Z5C5JJW2TTJEM8VZA71NJW2KXXB2HA1V16-d8a9a4528ae833e1894eee676af8d218f8facbf95e166472df2c1a64219b5dfb'

const didDocument = await resolve(did);
// didDocument now contains the corresponding Did Document in JSON form.
```

In the example above, the resolution happens against the Stacks main network. The Stacks deployment used for resolution (e.g. test network, local mock network) can be configured by instantiating a new resolver as follows:

```typescript
import { getResolver } from "@stacks/did-resolver";
import { StacksTestnet } from "@stacks/network"

const resolve = getResolver(new StacksTestnet())

// Example testnet DID, does not resolve to a DID document
const testnetDid = 'did:stack:v2:STB53GD600EMEM74DFMA0B61JN8D8C4VE5477MXR-55bb3a37f9b2e8c58905c95099d5fc21aa47d073a918f3b30cc5abe4e3be44c6'

const didDocument = await resolve(did);
```

## Local development

First clone the `stacks.js` repository locally, install all all dependencies, and navigate to the `did-resolver` package:

```bash

git clone https://github.com/blockstack/stacks.js.git

cd stacks.js

npm install

npm run bootstrap

cd packages/did-resolver
```

### Running the tests

The unit tests included with this repository can be run using the `npm run test` command (`npm run test:watch` can be used to rerun all tests when relevant source files are changed). These tests can run offline, and do not depend on any additional infrastructure.

In addition to the unit tests, a set of integration / e2e tests are included in this repository as well. These tests rely on a local [Stacks 2.0 blockchain mocknet deployment](https://github.com/blockstack/stacks-blockchain-api/#quick-start) to register and resolve a number of test DIDs. In order to run the tests, first start the aforementioned mocknet instance in a different terminal window using:

``` bash
docker run -p 3999:3999 blockstack/stacks-blockchain-api-standalone mocknet
```

Once the Stacks 2.0 node has started, you can run the following commands from the `did-resovler` folder to test the resolution of on-chain and off-chain DIDs:

``` bash
# Will register a number of test DIDs on the mock network. This process will take a minute and only needs to run once.
npm run test:setup

# Once the setup is complete, you can run
npm run test:integration
```

Lastly, in case you would like to run both the unit and integration tests (and get a combined code coverage report), you can run `npm run test:all`. Please keep in mind that this will run the `npm run test:integration` command, and therefore assumes `npm run test:setup` has been run.
