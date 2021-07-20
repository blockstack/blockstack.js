import { Buffer } from '@stacks/common';
import * as blockstack from 'blockstack';
import * as bitcoin from 'bitcoinjs-lib';
import * as process from 'process';
import * as fs from 'fs';
import * as winston from 'winston';
import cors from 'cors';

import BN from 'bn.js';
import * as crypto from 'crypto';
import * as bip39 from 'bip39';
import express from 'express';
import * as path from 'path';
import { prompt } from 'inquirer';
import fetch from 'node-fetch';
import {
  makeSTXTokenTransfer,
  makeContractDeploy,
  makeContractCall,
  callReadOnlyFunction,
  broadcastTransaction,
  estimateTransfer,
  estimateContractDeploy,
  estimateContractFunctionCall,
  SignedTokenTransferOptions,
  ContractDeployOptions,
  SignedContractCallOptions,
  ReadOnlyFunctionOptions,
  ContractCallPayload,
  ClarityValue,
  ClarityAbi,
  getAbi,
  validateContractCall,
  PostConditionMode,
  cvToString,
  StacksTransaction,
  TxBroadcastResult,
  getAddressFromPrivateKey,
  TransactionVersion,
  AnchorMode,
} from '@stacks/transactions';

import { StacksMainnet, StacksTestnet } from '@stacks/network';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const c32check = require('c32check');

import { UserData } from '@stacks/auth';
import crossfetch from 'cross-fetch';

import { StackingClient, StackerInfo } from '@stacks/stacking';

import { FaucetsApi, AccountsApi, Configuration } from '@stacks/blockchain-api-client';

import { GaiaHubConfig } from '@stacks/storage';

import {
  getOwnerKeyInfo,
  getPaymentKeyInfo,
  getStacksWalletKeyInfo,
  getApplicationKeyInfo,
  extractAppKey,
  STX_WALLET_COMPATIBLE_SEED_STRENGTH,
  PaymentKeyInfoType,
  OwnerKeyInfoType,
  StacksKeyInfoType,
} from './keys';

import {
  CLI_ARGS,
  getCLIOpts,
  CLIOptAsString,
  CLIOptAsStringArray,
  CLIOptAsBool,
  checkArgs,
  loadConfig,
  makeCommandUsageString,
  makeAllCommandsList,
  USAGE,
  DEFAULT_CONFIG_PATH,
  DEFAULT_CONFIG_REGTEST_PATH,
  DEFAULT_CONFIG_TESTNET_PATH,
  ID_ADDRESS_PATTERN,
  STACKS_ADDRESS_PATTERN,
  DEFAULT_MAX_ID_SEARCH_INDEX,
} from './argparse';

import { encryptBackupPhrase, decryptBackupPhrase } from './encrypt';

import { CLINetworkAdapter, CLI_NETWORK_OPTS, getNetwork, NameInfoType } from './network';

import { gaiaAuth, gaiaConnect, gaiaUploadProfileAll, getGaiaAddressFromProfile } from './data';

import {
  JSONStringify,
  getPrivateKeyAddress,
  canonicalPrivateKey,
  decodePrivateKey,
  makeProfileJWT,
  getNameInfoEasy,
  getpass,
  getBackupPhrase,
  mkdirs,
  getIDAddress,
  IDAppKeys,
  getIDAppKeys,
  makePromptsFromArgList,
  parseClarityFunctionArgAnswers,
  ClarityFunctionArg,
  generateExplorerTxPageUrl,
  isTestnetAddress,
} from './utils';

import { handleAuth, handleSignIn } from './auth';

// global CLI options
let txOnly = false;
let estimateOnly = false;
let safetyChecks = true;
let receiveFeesPeriod = 52595;
let gracePeriod = 5000;
let noExit = false;
let maxIDSearchIndex = DEFAULT_MAX_ID_SEARCH_INDEX;

let BLOCKSTACK_TEST = !!process.env.BLOCKSTACK_TEST;

export function getMaxIDSearchIndex() {
  return maxIDSearchIndex;
}

export interface WhoisInfoType {
  address: string;
  blockchain: string;
  block_renewed_at: number;
  did: string;
  expire_block: number;
  grace_period: number;
  last_transaction_height: number;
  last_txid: string;
  owner_address: string;
  owner_script: string;
  renewal_deadline: number;
  resolver: string | null;
  status: string;
  zonefile: string | null;
  zonefile_hash: string | null;
}

/*
 * Sign a profile.
 * @path (string) path to the profile
 * @privateKey (string) the owner key (must be single-sig)
 */
// TODO: fix, network is never used
// @ts-ignore
function profileSign(network: CLINetworkAdapter, args: string[]): Promise<string> {
  const profilePath = args[0];
  const profileData = JSON.parse(fs.readFileSync(profilePath).toString());
  return Promise.resolve().then(() => makeProfileJWT(profileData, args[1]));
}

/*
 * Verify a profile with an address or public key
 * @path (string) path to the profile
 * @publicKeyOrAddress (string) public key or address
 */
function profileVerify(network: CLINetworkAdapter, args: string[]): Promise<string> {
  const profilePath = args[0];
  let publicKeyOrAddress = args[1];

  // need to coerce mainnet
  if (publicKeyOrAddress.match(ID_ADDRESS_PATTERN)) {
    publicKeyOrAddress = network.coerceMainnetAddress(publicKeyOrAddress.slice(3));
  }

  const profileString = fs.readFileSync(profilePath).toString();

  return Promise.resolve().then(() => {
    let profileToken = null;

    try {
      const profileTokens = JSON.parse(profileString);
      profileToken = profileTokens[0].token;
    } catch (e) {
      // might be a raw token
      profileToken = profileString;
    }

    if (!profileToken) {
      throw new Error(`Data at ${profilePath} does not appear to be a signed profile`);
    }

    const profile = blockstack.extractProfile(profileToken, publicKeyOrAddress);
    return JSONStringify(profile);
  });
}

/*
 * Store a signed profile for a name or an address.
 * * verify that the profile was signed by the name's owner address
 * * verify that the private key matches the name's owner address
 *
 * Assumes that the URI records are all Gaia hubs
 *
 * @nameOrAddress (string) name or address that owns the profile
 * @path (string) path to the signed profile token
 * @privateKey (string) owner private key for the name
 * @gaiaUrl (string) this is the write endpoint of the Gaia hub to use
 */
function profileStore(network: CLINetworkAdapter, args: string[]): Promise<string> {
  const nameOrAddress = args[0];
  const signedProfilePath = args[1];
  const privateKey = decodePrivateKey(args[2]);
  const gaiaHubUrl = args[3];

  const signedProfileData = fs.readFileSync(signedProfilePath).toString();

  const ownerAddress = getPrivateKeyAddress(network, privateKey);
  const ownerAddressMainnet = network.coerceMainnetAddress(ownerAddress);

  let nameInfoPromise: Promise<NameInfoType | null>;
  let name = '';

  if (nameOrAddress.startsWith('ID-')) {
    // ID-address
    nameInfoPromise = Promise.resolve().then(() => {
      return {
        address: nameOrAddress.slice(3),
      };
    });
  } else {
    // name; find the address
    nameInfoPromise = getNameInfoEasy(network, nameOrAddress);
    name = nameOrAddress;
  }

  const verifyProfilePromise = profileVerify(network, [
    signedProfilePath,
    `ID-${ownerAddressMainnet}`,
  ]);

  return Promise.all([nameInfoPromise, verifyProfilePromise])
    .then(([nameInfo, _verifiedProfile]: [NameInfoType | null, any]) => {
      if (
        safetyChecks &&
        (!nameInfo ||
          network.coerceAddress(nameInfo.address) !== network.coerceAddress(ownerAddress))
      ) {
        throw new Error(
          'Name owner address either could not be found, or does not match ' +
            `private key address ${ownerAddress}`
        );
      }
      return gaiaUploadProfileAll(network, [gaiaHubUrl], signedProfileData, args[2], name);
    })
    .then((gaiaUrls: { dataUrls?: string[] | null; error?: string | null }) => {
      if (gaiaUrls.hasOwnProperty('error')) {
        return JSONStringify({ dataUrls: gaiaUrls.dataUrls!, error: gaiaUrls.error! }, true);
      } else {
        return JSONStringify({ profileUrls: gaiaUrls.dataUrls! });
      }
    });
}

/*
 * Get the app private key(s) from a backup phrase and an ID-address
 * args:
 * @mnemonic (string) the 12-word phrase
 * @nameOrIDAddress (string) the name or ID-address
 * @appOrigin (string) the application's origin URL
 */
async function getAppKeys(network: CLINetworkAdapter, args: string[]): Promise<string> {
  const mnemonic = await getBackupPhrase(args[0]);
  const nameOrIDAddress = args[1];
  const origin = args[2];
  const idAddress = await getIDAddress(network, nameOrIDAddress);
  const networkInfo = await getApplicationKeyInfo(network, mnemonic, idAddress, origin);
  return JSONStringify(networkInfo);
}

/*
 * Get the owner private key(s) from a backup phrase
 * args:
 * @mnemonic (string) the 12-word phrase
 * @max_index (integer) (optional) the profile index maximum
 */
async function getOwnerKeys(network: CLINetworkAdapter, args: string[]): Promise<string> {
  const mnemonic = await getBackupPhrase(args[0]);
  let maxIndex = 1;
  if (args.length > 1 && !!args[1]) {
    maxIndex = parseInt(args[1]);
  }

  const keyInfo: OwnerKeyInfoType[] = [];
  for (let i = 0; i < maxIndex; i++) {
    keyInfo.push(await getOwnerKeyInfo(network, mnemonic, i));
  }

  return JSONStringify(keyInfo);
}

/*
 * Get the payment private key from a backup phrase
 * args:
 * @mnemonic (string) the 12-word phrase
 */
async function getPaymentKey(network: CLINetworkAdapter, args: string[]): Promise<string> {
  const mnemonic = await getBackupPhrase(args[0]);
  // keep the return value consistent with getOwnerKeys
  const keyObj = await getPaymentKeyInfo(network, mnemonic);
  const keyInfo: PaymentKeyInfoType[] = [];
  keyInfo.push(keyObj);
  return JSONStringify(keyInfo);
}

/*
 * Get the payment private key from a backup phrase used by the Stacks wallet
 * args:
 * @mnemonic (string) the 24-word phrase
 */
async function getStacksWalletKey(network: CLINetworkAdapter, args: string[]): Promise<string> {
  const mnemonic = await getBackupPhrase(args[0]);
  // keep the return value consistent with getOwnerKeys
  const keyObj = await getStacksWalletKeyInfo(network, mnemonic);
  const keyInfo: StacksKeyInfoType[] = [];
  keyInfo.push(keyObj);
  return JSONStringify(keyInfo);
}

/*
 * Make a private key and output it
 * args:
 * @mnemonic (string) OPTIONAL; the 12-word phrase
 */
async function makeKeychain(network: CLINetworkAdapter, args: string[]): Promise<string> {
  let mnemonic: string;
  if (args[0]) {
    mnemonic = await getBackupPhrase(args[0]);
  } else {
    // eslint-disable-next-line @typescript-eslint/await-thenable
    mnemonic = await bip39.generateMnemonic(
      STX_WALLET_COMPATIBLE_SEED_STRENGTH,
      crypto.randomBytes
    );
  }

  const stacksKeyInfo = await getStacksWalletKeyInfo(network, mnemonic);
  return JSONStringify({
    mnemonic: mnemonic,
    keyInfo: stacksKeyInfo,
  });
}

/*
 * Get an address's tokens and their balances.
 * Takes either a Bitcoin or Stacks address
 * args:
 * @address (string) the address
 */
function balance(network: CLINetworkAdapter, args: string[]): Promise<string> {
  let address = args[0];

  if (BLOCKSTACK_TEST) {
    // force testnet address if we're in regtest or testnet mode
    address = network.coerceAddress(address);
  }

  // temporary hack to use network config from stacks-transactions lib
  const txNetwork = network.isMainnet() ? new StacksMainnet() : new StacksTestnet();
  txNetwork.coreApiUrl = network.legacyNetwork.blockstackAPIUrl;

  return fetch(txNetwork.getAccountApiUrl(address))
    .then(response => {
      if (response.status === 404) {
        return Promise.reject({
          status: response.status,
          error: response.statusText,
        });
      }
      return response.json();
    })
    .then(response => {
      let balanceHex = response.balance;
      if (response.balance.startsWith('0x')) {
        balanceHex = response.balance.substr(2);
      }
      let lockedHex = response.locked;
      if (response.locked.startsWith('0x')) {
        lockedHex = response.locked.substr(2);
      }
      const unlockHeight = response.unlock_height;
      const balance = new BN(balanceHex, 16);
      const locked = new BN(lockedHex, 16);
      const res = {
        balance: balance.toString(10),
        locked: locked.toString(10),
        unlock_height: unlockHeight,
        nonce: response.nonce,
      };
      return Promise.resolve(JSONStringify(res));
    })
    .catch(error => error);
}

/*
 * Get a page of the account's history
 * args:
 * @address (string) the account address
 * @page (int) the page of the history to fetch (optional)
 */
function getAccountHistory(network: CLINetworkAdapter, args: string[]): Promise<string> {
  const address = c32check.c32ToB58(args[0]);

  if (args.length >= 2 && !!args[1]) {
    const page = parseInt(args[1]);
    return Promise.resolve()
      .then(() => {
        return network.getAccountHistoryPage(address, page);
      })
      .then(accountStates =>
        JSONStringify(
          accountStates.map((s: any) => {
            const new_s = {
              address: c32check.b58ToC32(s.address),
              credit_value: s.credit_value.toString(),
              debit_value: s.debit_value.toString(),
            };
            return new_s;
          })
        )
      );
  } else {
    // all pages
    let history: any[] = [];

    function getAllAccountHistoryPages(page: number): Promise<any[]> {
      return network.getAccountHistoryPage(address, page).then((results: any[]) => {
        if (results.length == 0) {
          return history;
        } else {
          history = history.concat(results);
          return getAllAccountHistoryPages(page + 1);
        }
      });
    }

    return getAllAccountHistoryPages(0).then((accountStates: any[]) =>
      JSONStringify(
        accountStates.map((s: any) => {
          const new_s = {
            address: c32check.b58ToC32(s.address),
            credit_value: s.credit_value.toString(),
            debit_value: s.debit_value.toString(),
          };
          return new_s;
        })
      )
    );
  }
}

// /*
//  * Get the account's state(s) at a particular block height
//  * args:
//  * @address (string) the account address
//  * @blockHeight (int) the height at which to query
//  */
// function getAccountAt(network: CLINetworkAdapter, args: string[]) : Promise<string> {
//   const address = c32check.c32ToB58(args[0]);
//   const blockHeight = parseInt(args[1]);

//   return Promise.resolve().then(() => {
//     return network.getAccountAt(address, blockHeight);
//   })
//     .then(accountStates => accountStates.map((s : any) => {
//       const new_s = {
//         address: c32check.b58ToC32(s.address),
//         credit_value: s.credit_value.toString(),
//         debit_value: s.debit_value.toString()
//       };
//       return new_s;
//     }))
//     .then(history => JSONStringify(history));
// }

// /*
//  * Sends BTC from one private key to another address
//  * args:
//  * @recipientAddress (string) the recipient's address
//  * @amount (string) the amount of BTC to send
//  * @privateKey (string) the private key that owns the BTC
//  */
// function sendBTC(network: CLINetworkAdapter, args: string[]) : Promise<string> {
//   const destinationAddress = args[0];
//   const amount = parseInt(args[1]);
//   const paymentKeyHex = decodePrivateKey(args[2]);

//   if (amount <= 5500) {
//     throw new Error('Invalid amount (must be greater than 5500)');
//   }

//   let paymentKey;
//   if (typeof paymentKeyHex === 'string') {
//     // single-sig
//     paymentKey = blockstack.PubkeyHashSigner.fromHexString(paymentKeyHex);
//   }
//   else {
//     // multi-sig or segwit
//     paymentKey = paymentKeyHex;
//   }

//   const txPromise = blockstack.transactions.makeBitcoinSpend(destinationAddress, paymentKey, amount, !hasKeys(paymentKeyHex))
//     .catch((e : Error) => {
//       if (e.name === 'InvalidAmountError') {
//         return JSONStringify({
//           'status': false,
//           'error': e.message
//         }, true);
//       }
//       else {
//         throw e;
//       }
//     });

//   if (txOnly) {
//     return txPromise;
//   }
//   else {
//     return txPromise.then((tx : string) => {
//       return network.broadcastTransaction(tx);
//     })
//       .then((txid : string) => {
//         return txid;
//       });
//   }
// }

/*
 * Send tokens from one account private key to another account's address.
 * args:
 * @recipientAddress (string) the recipient's account address
 * @tokenAmount (int) the number of tokens to send
 * @fee (int) the transaction fee to be paid
 * @nonce (int) integer nonce needs to be incremented after each transaction from an account
 * @privateKey (string) the hex-encoded private key to use to send the tokens
 * @memo (string) OPTIONAL: a 34-byte memo to include
 */
async function sendTokens(network: CLINetworkAdapter, args: string[]): Promise<string> {
  const recipientAddress = args[0];
  const tokenAmount = new BN(args[1]);
  const fee = new BN(args[2]);
  const nonce = new BN(args[3]);
  const privateKey = args[4];

  let memo = '';

  if (args.length > 4 && !!args[5]) {
    memo = args[5];
  }

  // temporary hack to use network config from stacks-transactions lib
  const txNetwork = network.isMainnet() ? new StacksMainnet() : new StacksTestnet();
  txNetwork.coreApiUrl = network.legacyNetwork.blockstackAPIUrl;

  const options: SignedTokenTransferOptions = {
    recipient: recipientAddress,
    amount: tokenAmount,
    senderKey: privateKey,
    fee,
    nonce,
    memo,
    network: txNetwork,
    anchorMode: AnchorMode.Any,
  };

  const tx: StacksTransaction = await makeSTXTokenTransfer(options);

  if (estimateOnly) {
    return estimateTransfer(tx, txNetwork).then(cost => {
      return cost.toString(10);
    });
  }

  if (txOnly) {
    return Promise.resolve(tx.serialize().toString('hex'));
  }

  return broadcastTransaction(tx, txNetwork)
    .then((response: TxBroadcastResult) => {
      if (response.hasOwnProperty('error')) {
        return response;
      }
      return {
        txid: `0x${tx.txid()}`,
        transaction: generateExplorerTxPageUrl(tx.txid(), txNetwork),
      };
    })
    .catch(error => {
      return error.toString();
    });
}

/*
 * Depoly a Clarity smart contract.
 * args:
 * @source (string) path to the contract source file
 * @contractName (string) the name of the contract
 * @fee (int) the transaction fee to be paid
 * @nonce (int) integer nonce needs to be incremented after each transaction from an account
 * @privateKey (string) the hex-encoded private key to use to send the tokens
 */
async function contractDeploy(network: CLINetworkAdapter, args: string[]): Promise<string> {
  const sourceFile = args[0];
  const contractName = args[1];
  const fee = new BN(args[2]);
  const nonce = new BN(args[3]);
  const privateKey = args[4];

  const source = fs.readFileSync(sourceFile).toString();

  // temporary hack to use network config from stacks-transactions lib
  const txNetwork = network.isMainnet() ? new StacksMainnet() : new StacksTestnet();
  txNetwork.coreApiUrl = network.legacyNetwork.blockstackAPIUrl;

  const options: ContractDeployOptions = {
    contractName,
    codeBody: source,
    senderKey: privateKey,
    fee,
    nonce,
    network: txNetwork,
    postConditionMode: PostConditionMode.Allow,
    anchorMode: AnchorMode.Any,
  };

  const tx = await makeContractDeploy(options);

  if (estimateOnly) {
    return estimateContractDeploy(tx, txNetwork).then(cost => {
      return cost.toString(10);
    });
  }

  if (txOnly) {
    return Promise.resolve(tx.serialize().toString('hex'));
  }

  return broadcastTransaction(tx, txNetwork)
    .then(response => {
      if (response.hasOwnProperty('error')) {
        return response;
      }
      return {
        txid: `0x${tx.txid()}`,
        transaction: generateExplorerTxPageUrl(tx.txid(), txNetwork),
      };
    })
    .catch(error => {
      return error.toString();
    });
}

/*
 * Call a Clarity smart contract function.
 * args:
 * @contractAddress (string) the address of the contract
 * @contractName (string) the name of the contract
 * @functionName (string) the name of the function to call
 * @fee (int) the transaction fee to be paid
 * @nonce (int) integer nonce needs to be incremented after each transaction from an account
 * @privateKey (string) the hex-encoded private key to use to send the tokens
 */
async function contractFunctionCall(network: CLINetworkAdapter, args: string[]): Promise<string> {
  const contractAddress = args[0];
  const contractName = args[1];
  const functionName = args[2];
  const fee = new BN(args[3]);
  const nonce = new BN(args[4]);
  const privateKey = args[5];

  // temporary hack to use network config from stacks-transactions lib
  const txNetwork = network.isMainnet() ? new StacksMainnet() : new StacksTestnet();
  txNetwork.coreApiUrl = network.legacyNetwork.blockstackAPIUrl;

  let abi: ClarityAbi;
  let abiArgs: ClarityFunctionArg[];
  let functionArgs: ClarityValue[] = [];

  return getAbi(contractAddress, contractName, txNetwork)
    .then(responseAbi => {
      abi = responseAbi;
      const filtered = abi.functions.filter(fn => fn.name === functionName);
      if (filtered.length === 1) {
        abiArgs = filtered[0].args;
        return makePromptsFromArgList(abiArgs);
      } else {
        return null;
      }
    })
    .then(prompts => prompt(prompts!))
    .then(answers => {
      functionArgs = parseClarityFunctionArgAnswers(answers, abiArgs);

      const options: SignedContractCallOptions = {
        contractAddress,
        contractName,
        functionName,
        functionArgs,
        senderKey: privateKey,
        fee,
        nonce,
        network: txNetwork,
        postConditionMode: PostConditionMode.Allow,
        anchorMode: AnchorMode.Any,
      };

      return makeContractCall(options);
    })
    .then(tx => {
      if (!validateContractCall(tx.payload as ContractCallPayload, abi)) {
        throw new Error('Failed to validate function arguments against ABI');
      }

      if (estimateOnly) {
        return estimateContractFunctionCall(tx, txNetwork).then(cost => {
          return cost.toString(10);
        });
      }

      if (txOnly) {
        return Promise.resolve(tx.serialize().toString('hex'));
      }

      return broadcastTransaction(tx, txNetwork)
        .then(response => {
          if (response.hasOwnProperty('error')) {
            return response;
          }
          return {
            txid: `0x${tx.txid()}`,
            transaction: generateExplorerTxPageUrl(tx.txid(), txNetwork),
          };
        })
        .catch(error => {
          return error.toString();
        });
    });
}

/*
 * Call a read-only Clarity smart contract function.
 * args:
 * @contractAddress (string) the address of the contract
 * @contractName (string) the name of the contract
 * @functionName (string) the name of the function to call
 * @senderAddress (string) the sender address
 */
async function readOnlyContractFunctionCall(
  network: CLINetworkAdapter,
  args: string[]
): Promise<string> {
  const contractAddress = args[0];
  const contractName = args[1];
  const functionName = args[2];
  const senderAddress = args[3];

  // temporary hack to use network config from stacks-transactions lib
  const txNetwork = network.isMainnet() ? new StacksMainnet() : new StacksTestnet();
  txNetwork.coreApiUrl = network.legacyNetwork.blockstackAPIUrl;

  let abi: ClarityAbi;
  let abiArgs: ClarityFunctionArg[];
  let functionArgs: ClarityValue[] = [];

  return getAbi(contractAddress, contractName, txNetwork)
    .then(responseAbi => {
      abi = responseAbi;
      const filtered = abi.functions.filter(fn => fn.name === functionName);
      if (filtered.length === 1) {
        abiArgs = filtered[0].args;
        return makePromptsFromArgList(abiArgs);
      } else {
        return null;
      }
    })
    .then(prompts => prompt(prompts!))
    .then(answers => {
      functionArgs = parseClarityFunctionArgAnswers(answers, abiArgs);

      const options: ReadOnlyFunctionOptions = {
        contractAddress,
        contractName,
        functionName,
        functionArgs,
        senderAddress,
        network: txNetwork,
      };

      return callReadOnlyFunction(options);
    })
    .then(returnValue => {
      return cvToString(returnValue);
    })
    .catch(error => {
      return error.toString();
    });
}

// /*
//  * Get the number of confirmations of a txid.
//  * args:
//  * @txid (string) the transaction ID as a hex string
//  */
// function getConfirmations(network: CLINetworkAdapter, args: string[]) : Promise<string> {
//   const txid = args[0];
//   return Promise.all([network.getBlockHeight(), network.getTransactionInfo(txid)])
//     .then(([blockHeight, txInfo]) => {
//       return JSONStringify({
//         'blockHeight': txInfo.block_height,
//         'confirmations': blockHeight - txInfo.block_height + 1
//       });
//     })
//     .catch((e) => {
//       if (e.message.toLowerCase() === 'unconfirmed transaction') {
//         return JSONStringify({
//           'blockHeight': 'unconfirmed',
//           'confirmations': 0
//         });
//       }
//       else {
//         throw e;
//       }
//     });
// }

/*
 * Get the address of a private key
 * args:
 * @private_key (string) the hex-encoded private key or key bundle
 */
function getKeyAddress(network: CLINetworkAdapter, args: string[]): Promise<string> {
  const privateKey = decodePrivateKey(args[0]);
  return Promise.resolve().then(() => {
    const addr = getPrivateKeyAddress(network, privateKey);
    return JSONStringify({
      BTC: addr,
      STACKS: c32check.b58ToC32(addr),
    });
  });
}

/*
 * Get a file from Gaia.
 * args:
 * @username (string) the blockstack ID of the user who owns the data
 * @origin (string) the application origin
 * @path (string) the file to read
 * @appPrivateKey (string) OPTIONAL: the app private key to decrypt/verify with
 * @decrypt (string) OPTINOAL: if '1' or 'true', then decrypt
 * @verify (string) OPTIONAL: if '1' or 'true', then search for and verify a signature file
 *  along with the data
 */
function gaiaGetFile(network: CLINetworkAdapter, args: string[]): Promise<string | Buffer> {
  const username = args[0];
  const origin = args[1];
  const path = args[2];
  let appPrivateKey = args[3];
  let decrypt = false;
  let verify = false;

  if (!!appPrivateKey && args.length > 4 && !!args[4]) {
    decrypt = args[4].toLowerCase() === 'true' || args[4].toLowerCase() === '1';
  }

  if (!!appPrivateKey && args.length > 5 && !!args[5]) {
    verify = args[5].toLowerCase() === 'true' || args[5].toLowerCase() === '1';
  }

  if (!appPrivateKey) {
    // make a fake private key (it won't be used)
    appPrivateKey = 'fda1afa3ff9ef25579edb5833b825ac29fae82d03db3f607db048aae018fe882';
  }

  // force mainnet addresses
  blockstack.config.network.layer1 = bitcoin.networks.bitcoin;
  return gaiaAuth(network, appPrivateKey, null)
    .then((_userData: UserData) =>
      blockstack.getFile(path, {
        decrypt: decrypt,
        verify: verify,
        app: origin,
        username: username,
      })
    )
    .then((data: ArrayBuffer | Buffer | string) => {
      if (data instanceof ArrayBuffer) {
        return Buffer.from(data);
      } else {
        return data;
      }
    });
}

/*
 * Put a file into a Gaia hub
 * args:
 * @hubUrl (string) the URL to the write endpoint of the gaia hub
 * @appPrivateKey (string) the private key used to authenticate to the gaia hub
 * @dataPath (string) the path (on disk) to the data to store
 * @gaiaPath (string) the path (in Gaia) where the data will be stored
 * @encrypt (string) OPTIONAL: if '1' or 'true', then encrypt the file
 * @sign (string) OPTIONAL: if '1' or 'true', then sign the file and store the signature too.
 */
function gaiaPutFile(network: CLINetworkAdapter, args: string[]): Promise<string> {
  const hubUrl = args[0];
  const appPrivateKey = args[1];
  const dataPath = args[2];
  const gaiaPath = path.normalize(args[3].replace(/^\/+/, ''));

  let encrypt = false;
  let sign = false;

  if (args.length > 4 && !!args[4]) {
    encrypt = args[4].toLowerCase() === 'true' || args[4].toLowerCase() === '1';
  }
  if (args.length > 5 && !!args[5]) {
    sign = args[5].toLowerCase() === 'true' || args[5].toLowerCase() === '1';
  }

  const data = fs.readFileSync(dataPath);

  // force mainnet addresses
  // TODO
  blockstack.config.network.layer1 = bitcoin.networks.bitcoin;
  return gaiaAuth(network, appPrivateKey, hubUrl)
    .then((_userData: UserData) => {
      return blockstack.putFile(gaiaPath, data, { encrypt: encrypt, sign: sign });
    })
    .then((url: string) => {
      return JSONStringify({ urls: [url] });
    });
}

/*
 * Delete a file in a Gaia hub
 * args:
 * @hubUrl (string) the URL to the write endpoint of the gaia hub
 * @appPrivateKey (string) the private key used to authenticate to the gaia hub
 * @gaiaPath (string) the path (in Gaia) to delete
 * @wasSigned (string) OPTIONAL: if '1' or 'true'.  Delete the signature file as well.
 */
function gaiaDeleteFile(network: CLINetworkAdapter, args: string[]): Promise<string> {
  const hubUrl = args[0];
  const appPrivateKey = args[1];
  const gaiaPath = path.normalize(args[2].replace(/^\/+/, ''));

  let wasSigned = false;

  if (args.length > 3 && !!args[3]) {
    wasSigned = args[3].toLowerCase() === 'true' || args[3].toLowerCase() === '1';
  }

  // force mainnet addresses
  // TODO
  blockstack.config.network.layer1 = bitcoin.networks.bitcoin;
  return gaiaAuth(network, appPrivateKey, hubUrl)
    .then((_userData: UserData) => {
      return blockstack.deleteFile(gaiaPath, { wasSigned: wasSigned });
    })
    .then(() => {
      return JSONStringify('ok');
    });
}

/*
 * List files in a Gaia hub
 * args:
 * @hubUrl (string) the URL to the write endpoint of the gaia hub
 * @appPrivateKey (string) the private key used to authenticate to the gaia hub
 */
function gaiaListFiles(network: CLINetworkAdapter, args: string[]): Promise<string> {
  const hubUrl = args[0];
  const appPrivateKey = args[1];

  // force mainnet addresses
  // TODO
  let count = 0;
  blockstack.config.network.layer1 = bitcoin.networks.bitcoin;
  return gaiaAuth(network, canonicalPrivateKey(appPrivateKey), hubUrl)
    .then((_userData: UserData) => {
      return blockstack.listFiles((name: string) => {
        // print out incrementally
        console.log(name);
        count += 1;
        return true;
      });
    })
    .then(() => JSONStringify(count));
}

/*
 * Group array items into batches
 */
function batchify<T>(input: T[], batchSize: number = 50): T[][] {
  const output = [];
  let currentBatch = [];
  for (let i = 0; i < input.length; i++) {
    currentBatch.push(input[i]);
    if (currentBatch.length >= batchSize) {
      output.push(currentBatch);
      currentBatch = [];
    }
  }
  if (currentBatch.length > 0) {
    output.push(currentBatch);
  }
  return output;
}

/*
 * Dump all files from a Gaia hub bucket to a directory on disk.
 * args:
 * @nameOrIDAddress (string) the name or ID address that owns the bucket to dump
 * @appOrigin (string) the application for which to dump data
 * @hubUrl (string) the URL to the write endpoint of the gaia hub
 * @mnemonic (string) the 12-word phrase or ciphertext
 * @dumpDir (string) the directory to hold the dumped files
 */
function gaiaDumpBucket(network: CLINetworkAdapter, args: string[]): Promise<string> {
  const nameOrIDAddress = args[0];
  const appOrigin = args[1];
  const hubUrl = args[2];
  const mnemonicOrCiphertext = args[3];
  let dumpDir = args[4];

  if (dumpDir.length === 0) {
    throw new Error('Invalid directory (not given)');
  }
  if (dumpDir[0] !== '/') {
    // relative path.  make absolute
    const cwd = fs.realpathSync('.');
    dumpDir = path.normalize(`${cwd}/${dumpDir}`);
  }

  mkdirs(dumpDir);

  function downloadFile(hubConfig: GaiaHubConfig, fileName: string): Promise<void> {
    const gaiaReadUrl = `${hubConfig.url_prefix.replace(/\/+$/, '')}/${hubConfig.address}`;
    const fileUrl = `${gaiaReadUrl}/${fileName}`;
    const destPath = `${dumpDir}/${fileName.replace(/\//g, '\\x2f')}`;

    console.log(`Download ${fileUrl} to ${destPath}`);
    return fetch(fileUrl)
      .then((resp: any) => {
        if (resp.status !== 200) {
          throw new Error(`Bad status code for ${fileUrl}: ${resp.status}`);
        }

        // javascript can be incredibly stupid at fetching data despite being a Web language...
        const contentType = resp.headers.get('Content-Type');
        if (
          contentType === null ||
          contentType.startsWith('text') ||
          contentType === 'application/json'
        ) {
          return resp.text();
        } else {
          return resp.arrayBuffer();
        }
      })
      .then((filebytes: Buffer | ArrayBuffer) => {
        return new Promise((resolve, reject) => {
          try {
            fs.writeFileSync(destPath, Buffer.from(filebytes), { encoding: null, mode: 0o660 });
            resolve();
          } catch (e) {
            reject(e);
          }
        });
      });
  }

  // force mainnet addresses
  // TODO: better way of doing this
  blockstack.config.network.layer1 = bitcoin.networks.bitcoin;

  const fileNames: string[] = [];
  let gaiaHubConfig: GaiaHubConfig;
  let appPrivateKey: string;
  let ownerPrivateKey: string;

  return getIDAppKeys(network, nameOrIDAddress, appOrigin, mnemonicOrCiphertext)
    .then((keyInfo: IDAppKeys) => {
      appPrivateKey = keyInfo.appPrivateKey;
      ownerPrivateKey = keyInfo.ownerPrivateKey;
      return gaiaAuth(network, appPrivateKey, hubUrl, ownerPrivateKey);
    })
    .then((_userData: UserData) => {
      return gaiaConnect(network, hubUrl, appPrivateKey);
    })
    .then((hubConfig: GaiaHubConfig) => {
      gaiaHubConfig = hubConfig;
      return blockstack.listFiles(name => {
        fileNames.push(name);
        return true;
      });
    })
    .then((fileCount: number) => {
      console.log(`Download ${fileCount} files...`);
      const fileBatches: string[][] = batchify(fileNames);
      let filePromiseChain: Promise<any> = Promise.resolve();
      for (let i = 0; i < fileBatches.length; i++) {
        const filePromises = fileBatches[i].map(fileName => downloadFile(gaiaHubConfig, fileName));
        const batchPromise = Promise.all(filePromises);
        filePromiseChain = filePromiseChain.then(() => batchPromise);
      }

      return filePromiseChain.then(() => JSONStringify(fileCount));
    });
}

/*
 * Restore all of the files in a Gaia bucket dump to a new Gaia hub
 * args:
 * @nameOrIDAddress (string) the name or ID address that owns the bucket to dump
 * @appOrigin (string) the origin of the app for which to restore data
 * @hubUrl (string) the URL to the write endpoint of the new gaia hub
 * @mnemonic (string) the 12-word phrase or ciphertext
 * @dumpDir (string) the directory to hold the dumped files
 */
function gaiaRestoreBucket(network: CLINetworkAdapter, args: string[]): Promise<string> {
  const nameOrIDAddress = args[0];
  const appOrigin = args[1];
  const hubUrl = args[2];
  const mnemonicOrCiphertext = args[3];
  let dumpDir = args[4];

  if (dumpDir.length === 0) {
    throw new Error('Invalid directory (not given)');
  }
  if (dumpDir[0] !== '/') {
    // relative path.  make absolute
    const cwd = fs.realpathSync('.');
    dumpDir = path.normalize(`${cwd}/${dumpDir}`);
  }

  const fileList = fs.readdirSync(dumpDir);
  const fileBatches = batchify(fileList, 10);

  let appPrivateKey: string;
  let ownerPrivateKey: string;

  // force mainnet addresses
  // TODO better way of doing this
  blockstack.config.network.layer1 = bitcoin.networks.bitcoin;

  return getIDAppKeys(network, nameOrIDAddress, appOrigin, mnemonicOrCiphertext)
    .then((keyInfo: IDAppKeys) => {
      appPrivateKey = keyInfo.appPrivateKey;
      ownerPrivateKey = keyInfo.ownerPrivateKey;
      return gaiaAuth(network, appPrivateKey, hubUrl, ownerPrivateKey);
    })
    .then((_userData: UserData) => {
      let uploadPromise: Promise<any> = Promise.resolve();
      for (let i = 0; i < fileBatches.length; i++) {
        const uploadBatchPromises = fileBatches[i].map((fileName: string) => {
          const filePath = path.join(dumpDir, fileName);
          const dataBuf = fs.readFileSync(filePath);
          const gaiaPath = fileName.replace(/\\x2f/g, '/');
          return blockstack
            .putFile(gaiaPath, dataBuf, { encrypt: false, sign: false })
            .then((url: string) => {
              console.log(`Uploaded ${fileName} to ${url}`);
            });
        });
        uploadPromise = uploadPromise.then(() => Promise.all(uploadBatchPromises));
      }
      return uploadPromise;
    })
    .then(() => JSONStringify(fileList.length));
}

/*
 * Set the Gaia hub for an application for a blockstack ID.
 * args:
 * @blockstackID (string) the blockstack ID of the user
 * @profileHubUrl (string) the URL to the write endpoint of the user's profile gaia hub
 * @appOrigin (string) the application's Origin
 * @hubUrl (string) the URL to the write endpoint of the app's gaia hub
 * @mnemonic (string) the 12-word backup phrase, or the ciphertext of it
 */
async function gaiaSetHub(network: CLINetworkAdapter, args: string[]): Promise<string> {
  network.setCoerceMainnetAddress(true);

  const blockstackID = args[0];
  const ownerHubUrl = args[1];
  const appOrigin = args[2];
  const hubUrl = args[3];
  const mnemonicPromise = getBackupPhrase(args[4]);

  const nameInfoPromise = getNameInfoEasy(network, blockstackID).then(
    (nameInfo: NameInfoType | null) => {
      if (!nameInfo) {
        throw new Error('Name not found');
      }
      return nameInfo;
    }
  );

  const profilePromise = blockstack.lookupProfile(blockstackID);

  const [nameInfo, nameProfile, mnemonic]: [NameInfoType, any, string] = await Promise.all([
    nameInfoPromise,
    profilePromise,
    mnemonicPromise,
  ]);

  if (!nameProfile) {
    throw new Error('No profile found');
  }
  if (!nameInfo) {
    throw new Error('Name not found');
  }
  if (!nameInfo.zonefile) {
    throw new Error('No zone file found');
  }

  if (!nameProfile.apps) {
    nameProfile.apps = {};
  }

  // get owner ID-address
  const ownerAddress = network.coerceMainnetAddress(nameInfo.address);
  const idAddress = `ID-${ownerAddress}`;

  // get owner and app key info
  const appKeyInfo = await getApplicationKeyInfo(network, mnemonic, idAddress, appOrigin);
  const ownerKeyInfo = await getOwnerKeyInfo(network, mnemonic, appKeyInfo.ownerKeyIndex);

  // do we already have an address set for this app?
  let existingAppAddress: string | null = null;
  let appPrivateKey: string;
  try {
    existingAppAddress = getGaiaAddressFromProfile(network, nameProfile, appOrigin);
    appPrivateKey = extractAppKey(network, appKeyInfo, existingAppAddress);
  } catch (e) {
    console.log(`No profile application entry for ${appOrigin}`);
    appPrivateKey = extractAppKey(network, appKeyInfo);
  }

  appPrivateKey = `${canonicalPrivateKey(appPrivateKey)}01`;
  const appAddress = network.coerceMainnetAddress(getPrivateKeyAddress(network, appPrivateKey));

  if (existingAppAddress && appAddress !== existingAppAddress) {
    throw new Error(`BUG: ${existingAppAddress} !== ${appAddress}`);
  }

  const profile = nameProfile;
  const ownerPrivateKey = ownerKeyInfo.privateKey;

  const ownerGaiaHubPromise = gaiaConnect(network, ownerHubUrl, ownerPrivateKey);
  const appGaiaHubPromise = gaiaConnect(network, hubUrl, appPrivateKey);

  const [ownerHubConfig, appHubConfig]: [GaiaHubConfig, GaiaHubConfig] = await Promise.all([
    ownerGaiaHubPromise,
    appGaiaHubPromise,
  ]);

  if (!ownerHubConfig.url_prefix) {
    throw new Error('Invalid owner hub config: no url_prefix defined');
  }

  if (!appHubConfig.url_prefix) {
    throw new Error('Invalid app hub config: no url_prefix defined');
  }

  const gaiaReadUrl = appHubConfig.url_prefix.replace(/\/+$/, '');

  const newAppEntry: Record<string, string> = {};
  newAppEntry[appOrigin] = `${gaiaReadUrl}/${appAddress}/`;

  const apps = Object.assign({}, profile.apps ? profile.apps : {}, newAppEntry);
  profile.apps = apps;

  // sign the new profile
  const signedProfile = makeProfileJWT(profile, ownerPrivateKey);
  const profileUrls: {
    dataUrls?: string[] | null;
    error?: string | null;
  } = await gaiaUploadProfileAll(
    network,
    [ownerHubUrl],
    signedProfile,
    ownerPrivateKey,
    blockstackID
  );

  if (profileUrls.error) {
    return JSONStringify({
      error: profileUrls.error,
    });
  } else {
    return JSONStringify({
      profileUrls: profileUrls.dataUrls!,
    });
  }
}

/*
 * Convert an address between mainnet and testnet, and between
 * base58check and c32check.
 * args:
 * @address (string) the input address.  can be in any format
 */
function addressConvert(network: CLINetworkAdapter, args: string[]): Promise<string> {
  const addr = args[0];
  let b58addr: string;
  let testnetb58addr: string;

  if (addr.match(STACKS_ADDRESS_PATTERN)) {
    b58addr = c32check.c32ToB58(addr);
  } else if (addr.match(/[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+/)) {
    b58addr = addr;
  } else {
    throw new Error(`Unrecognized address ${addr}`);
  }

  if (isTestnetAddress(b58addr)) {
    testnetb58addr = b58addr;
  } else if (network.isTestnet()) {
    testnetb58addr = network.coerceAddress(b58addr);
  }

  return Promise.resolve().then(() => {
    const mainnetb58addr = network.coerceMainnetAddress(b58addr);
    const result: any = {
      mainnet: {
        STACKS: c32check.b58ToC32(mainnetb58addr),
        BTC: mainnetb58addr,
      },
      testnet: undefined,
    };

    if (testnetb58addr) {
      result.testnet = {
        STACKS: c32check.b58ToC32(testnetb58addr),
        BTC: testnetb58addr,
      };
    }

    return JSONStringify(result);
  });
}

/*
 * Run an authentication daemon on a given port.
 * args:
 * @gaiaHubUrl (string) the write endpoint of your app Gaia hub, where app data will be stored
 * @mnemonic (string) your 12-word phrase, optionally encrypted.  If encrypted, then
 * a password will be prompted.
 * @profileGaiaHubUrl (string) the write endpoint of your profile Gaia hub, where your profile
 *   will be stored (optional)
 * @port (number) the port to listen on (optional)
 */
function authDaemon(network: CLINetworkAdapter, args: string[]): Promise<string> {
  const gaiaHubUrl = args[0];
  const mnemonicOrCiphertext = args[1];
  let port = 3000; // default port
  let profileGaiaHub = gaiaHubUrl;

  if (args.length > 2 && !!args[2]) {
    profileGaiaHub = args[2];
  }

  if (args.length > 3 && !!args[3]) {
    port = parseInt(args[3]);
  }

  if (port < 0 || port > 65535) {
    return Promise.resolve().then(() => JSONStringify({ error: 'Invalid port' }));
  }

  const mnemonicPromise = getBackupPhrase(mnemonicOrCiphertext);

  return mnemonicPromise
    .then((mnemonic: string) => {
      noExit = true;

      // load up all of our identity addresses, profiles, profile URLs, and Gaia connections
      const authServer = express();
      authServer.use(cors());

      authServer.get(/^\/auth\/*$/, (req: express.Request, res: express.Response) => {
        void handleAuth(network, mnemonic, gaiaHubUrl, profileGaiaHub, port, req, res);
      });

      authServer.get(/^\/signin\/*$/, (req: express.Request, res: express.Response) => {
        void handleSignIn(network, mnemonic, gaiaHubUrl, profileGaiaHub, req, res);
      });

      authServer.listen(port, () => console.log(`Authentication server started on ${port}`));
      return 'Press Ctrl+C to exit';
    })
    .catch((e: Error) => {
      return JSONStringify({ error: e.message });
    });
}

/*
 * Encrypt a backup phrase
 * args:
 * @backup_phrase (string) the 12-word phrase to encrypt
 * @password (string) the password (will be interactively prompted if not given)
 */
// TODO: fix: network is never used
// @ts-ignore
function encryptMnemonic(network: CLINetworkAdapter, args: string[]): Promise<string> {
  const mnemonic = args[0];
  if (mnemonic.split(/ +/g).length !== 12) {
    throw new Error('Invalid backup phrase: must be 12 words');
  }

  const passwordPromise: Promise<string> = new Promise((resolve, reject) => {
    let pass = '';
    if (args.length === 2 && !!args[1]) {
      pass = args[1];
      resolve(pass);
    } else {
      if (!process.stdin.isTTY) {
        // password must be given as an argument
        const errMsg = 'Password argument required on non-interactive mode';
        reject(new Error(errMsg));
      } else {
        // prompt password
        getpass('Enter password: ', (pass1: string) => {
          getpass('Enter password again: ', (pass2: string) => {
            if (pass1 !== pass2) {
              const errMsg = 'Passwords do not match';
              reject(new Error(errMsg));
            } else {
              resolve(pass1);
            }
          });
        });
      }
    }
  });

  return passwordPromise
    .then((pass: string) => encryptBackupPhrase(mnemonic, pass))
    .then((cipherTextBuffer: Buffer) => cipherTextBuffer.toString('base64'))
    .catch((e: Error) => {
      return JSONStringify({ error: e.message });
    });
}

/* Decrypt a backup phrase
 * args:
 * @encrypted_backup_phrase (string) the encrypted base64-encoded backup phrase
 * @password 9string) the password (will be interactively prompted if not given)
 */
// TODO: fix: network is never used
// @ts-ignore
function decryptMnemonic(network: CLINetworkAdapter, args: string[]): Promise<string> {
  const ciphertext = args[0];

  const passwordPromise: Promise<string> = new Promise((resolve, reject) => {
    if (args.length === 2 && !!args[1]) {
      const pass = args[1];
      resolve(pass);
    } else {
      if (!process.stdin.isTTY) {
        // password must be given
        reject(new Error('Password argument required in non-interactive mode'));
      } else {
        // prompt password
        getpass('Enter password: ', p => {
          resolve(p);
        });
      }
    }
  });

  return passwordPromise
    .then((pass: string) => decryptBackupPhrase(Buffer.from(ciphertext, 'base64'), pass))
    .catch((e: Error) => {
      return JSONStringify({
        error:
          'Failed to decrypt (wrong password or corrupt ciphertext), ' + `details: ${e.message}`,
      });
    });
}

async function stackingStatus(network: CLINetworkAdapter, args: string[]): Promise<string> {
  const stxAddress = args[0];

  const txNetwork = network.isMainnet() ? new StacksMainnet() : new StacksTestnet();
  const stacker = new StackingClient(stxAddress, txNetwork);

  return stacker
    .getStatus()
    .then((status: StackerInfo) => {
      if (status.stacked) {
        return {
          amount_microstx: status.details.amount_microstx,
          first_reward_cycle: status.details.first_reward_cycle,
          lock_period: status.details.lock_period,
          unlock_height: status.details.unlock_height,
          pox_address: {
            version: status.details.pox_address.version.toString('hex'),
            hashbytes: status.details.pox_address.hashbytes.toString('hex'),
          },
        };
      } else {
        return 'Account not actively participating in Stacking';
      }
    })
    .catch((error: any) => {
      return error.toString();
    });
}

async function canStack(network: CLINetworkAdapter, args: string[]): Promise<string> {
  const amount = new BN(args[0]);
  const cycles = Number(args[1]);
  const poxAddress = args[2];
  const stxAddress = args[3];

  const txNetwork = network.isMainnet() ? new StacksMainnet() : new StacksTestnet();

  const apiConfig = new Configuration({
    fetchApi: crossfetch,
    basePath: txNetwork.coreApiUrl,
  });
  const accounts = new AccountsApi(apiConfig);

  const balancePromise = accounts.getAccountBalance({
    principal: stxAddress,
  });

  const stacker = new StackingClient(stxAddress, txNetwork);

  const poxInfoPromise = stacker.getPoxInfo();

  const stackingEligiblePromise = stacker.canStack({ poxAddress, cycles });

  return Promise.all([balancePromise, poxInfoPromise, stackingEligiblePromise])
    .then(([balance, poxInfo, stackingEligible]) => {
      const minAmount = new BN(poxInfo.min_amount_ustx);
      const balanceBN = new BN(balance.stx.balance);

      if (minAmount.gt(amount)) {
        throw new Error(
          `Stacking amount less than required minimum of ${minAmount.toString()} microstacks`
        );
      }

      if (amount.gt(balanceBN)) {
        throw new Error(
          `Stacking amount greater than account balance of ${balanceBN.toString()} microstacks`
        );
      }

      if (!stackingEligible.eligible) {
        throw new Error(`Account cannot participate in stacking. ${stackingEligible.reason}`);
      }

      return stackingEligible;
    })
    .catch(error => {
      return error;
    });
}

async function stack(network: CLINetworkAdapter, args: string[]): Promise<string> {
  const amount = new BN(args[0]);
  const cycles = Number(args[1]);
  const poxAddress = args[2];
  const privateKey = args[3];

  // let fee = new BN(0);
  // let nonce = new BN(0);

  // if (args.length > 3 && !!args[4]) {
  //   fee = new BN(args[4]);
  // }

  // if (args.length > 4 && !!args[5]) {
  //   nonce = new BN(args[5]);
  // }

  const txNetwork = network.isMainnet() ? new StacksMainnet() : new StacksTestnet();
  const txVersion = txNetwork.isMainnet() ? TransactionVersion.Mainnet : TransactionVersion.Testnet;

  const apiConfig = new Configuration({
    fetchApi: crossfetch,
    basePath: txNetwork.coreApiUrl,
  });
  const accounts = new AccountsApi(apiConfig);

  const stxAddress = getAddressFromPrivateKey(privateKey, txVersion);

  const balancePromise = accounts.getAccountBalance({
    principal: stxAddress,
  });

  const stacker = new StackingClient(stxAddress, txNetwork);

  const poxInfoPromise = stacker.getPoxInfo();

  const coreInfoPromise = stacker.getCoreInfo();

  const stackingEligiblePromise = stacker.canStack({ poxAddress, cycles });

  return Promise.all([balancePromise, poxInfoPromise, coreInfoPromise, stackingEligiblePromise])
    .then(([balance, poxInfo, coreInfo, stackingEligible]) => {
      const minAmount = new BN(poxInfo.min_amount_ustx);
      const balanceBN = new BN(balance.stx.balance);
      const burnChainBlockHeight = coreInfo.burn_block_height;
      const startBurnBlock = burnChainBlockHeight + 3;

      if (minAmount.gt(amount)) {
        throw new Error(
          `Stacking amount less than required minimum of ${minAmount.toString()} microstacks`
        );
      }

      if (amount.gt(balanceBN)) {
        throw new Error(
          `Stacking amount greater than account balance of ${balanceBN.toString()} microstacks`
        );
      }

      if (!stackingEligible.eligible) {
        throw new Error(`Account cannot participate in stacking. ${stackingEligible.reason}`);
      }

      return stacker.stack({
        amountMicroStx: amount,
        poxAddress,
        cycles,
        privateKey,
        burnBlockHeight: startBurnBlock,
      });
    })
    .then((response: TxBroadcastResult) => {
      if (response.hasOwnProperty('error')) {
        return response;
      }
      return {
        txid: `0x${response.txid}`,
        transaction: generateExplorerTxPageUrl(response.txid, txNetwork),
      };
    })
    .catch(error => {
      return error;
    });
}

function faucetCall(_: CLINetworkAdapter, args: string[]): Promise<string> {
  const address = args[0];
  // console.log(address);

  const apiConfig = new Configuration({
    fetchApi: crossfetch,
    basePath: 'https://stacks-node-api.testnet.stacks.co',
  });

  const faucets = new FaucetsApi(apiConfig);

  return faucets
    .runFaucetStx({ address })
    .then((faucetTx: any) => {
      return JSONStringify({
        txid: faucetTx.txId!,
        transaction: generateExplorerTxPageUrl(faucetTx.txId!.replace(/^0x/, ''), new StacksTestnet()),
      });
    })
    .catch((error: any) => error.toString());
}

/* Print out all documentation on usage in JSON
 */
type DocsArgsType = {
  name: string;
  type: string;
  value: string;
  format: string;
};

type FormattedDocsType = {
  command: string;
  args: DocsArgsType[];
  usage: string;
  group: string;
};

function printDocs(_network: CLINetworkAdapter, _args: string[]): Promise<string> {
  return Promise.resolve().then(() => {
    const formattedDocs: FormattedDocsType[] = [];
    const commandNames: string[] = Object.keys(CLI_ARGS.properties);
    for (let i = 0; i < commandNames.length; i++) {
      const commandName = commandNames[i];
      const args: DocsArgsType[] = [];
      const usage = CLI_ARGS.properties[commandName].help;
      const group = CLI_ARGS.properties[commandName].group;

      for (let j = 0; j < CLI_ARGS.properties[commandName].items.length; j++) {
        const argItem = CLI_ARGS.properties[commandName].items[j];
        args.push({
          name: argItem.name,
          type: argItem.type,
          value: argItem.realtype,
          format: argItem.pattern ? argItem.pattern : '.+',
        } as DocsArgsType);
      }

      formattedDocs.push({
        command: commandName,
        args: args,
        usage: usage,
        group: group,
      } as FormattedDocsType);
    }
    return JSONStringify(formattedDocs);
  });
}

type CommandFunction = (network: CLINetworkAdapter, args: string[]) => Promise<string | Buffer>;

/*
 * Decrypt a backup phrase
 * args:
 * @p
/*
 * Global set of commands
 */
const COMMANDS: Record<string, CommandFunction> = {
  authenticator: authDaemon,
  // 'announce': announce,
  balance: balance,
  can_stack: canStack,
  call_contract_func: contractFunctionCall,
  call_read_only_contract_func: readOnlyContractFunctionCall,
  convert_address: addressConvert,
  decrypt_keychain: decryptMnemonic,
  deploy_contract: contractDeploy,
  docs: printDocs,
  encrypt_keychain: encryptMnemonic,
  gaia_deletefile: gaiaDeleteFile,
  gaia_dump_bucket: gaiaDumpBucket,
  gaia_getfile: gaiaGetFile,
  gaia_listfiles: gaiaListFiles,
  gaia_putfile: gaiaPutFile,
  gaia_restore_bucket: gaiaRestoreBucket,
  gaia_sethub: gaiaSetHub,
  get_address: getKeyAddress,
  get_account_history: getAccountHistory,
  get_app_keys: getAppKeys,
  get_owner_keys: getOwnerKeys,
  get_payment_key: getPaymentKey,
  get_stacks_wallet_key: getStacksWalletKey,
  make_keychain: makeKeychain,
  profile_sign: profileSign,
  profile_store: profileStore,
  profile_verify: profileVerify,
  // 'send_btc': sendBTC,
  send_tokens: sendTokens,
  stack: stack,
  stacking_status: stackingStatus,
  faucet: faucetCall,
};

/*
 * CLI main entry point
 */
export function CLIMain() {
  const argv = process.argv;
  const opts = getCLIOpts(argv);

  const cmdArgs: any = checkArgs(
    CLIOptAsStringArray(opts, '_') ? CLIOptAsStringArray(opts, '_')! : []
  );
  if (!cmdArgs.success) {
    if (cmdArgs.error) {
      console.log(cmdArgs.error);
    }
    if (cmdArgs.usage) {
      if (cmdArgs.command) {
        console.log(makeCommandUsageString(cmdArgs.command));
        console.log('Use "help" to list all commands.');
      } else {
        console.log(USAGE);
        console.log(makeAllCommandsList());
      }
    }
    process.exit(1);
  } else {
    txOnly = CLIOptAsBool(opts, 'x');
    estimateOnly = CLIOptAsBool(opts, 'e');
    safetyChecks = !CLIOptAsBool(opts, 'U');
    receiveFeesPeriod = opts['N'] ? parseInt(CLIOptAsString(opts, 'N')!) : receiveFeesPeriod;
    gracePeriod = opts['G'] ? parseInt(CLIOptAsString(opts, 'N')!) : gracePeriod;
    maxIDSearchIndex = opts['M'] ? parseInt(CLIOptAsString(opts, 'M')!) : maxIDSearchIndex;

    const debug = CLIOptAsBool(opts, 'd');
    const consensusHash = CLIOptAsString(opts, 'C');
    const integration_test = CLIOptAsBool(opts, 'i');
    const testnet = CLIOptAsBool(opts, 't');
    const localnet = CLIOptAsBool(opts, 'l');

    const magicBytes = CLIOptAsString(opts, 'm');
    const apiUrl = CLIOptAsString(opts, 'H');
    const transactionBroadcasterUrl = CLIOptAsString(opts, 'T');
    const nodeAPIUrl = CLIOptAsString(opts, 'I');
    const utxoUrl = CLIOptAsString(opts, 'X');
    const bitcoindUsername = CLIOptAsString(opts, 'u');
    const bitcoindPassword = CLIOptAsString(opts, 'p');

    if (integration_test) {
      BLOCKSTACK_TEST = integration_test;
    }

    const configPath = CLIOptAsString(opts, 'c')
      ? CLIOptAsString(opts, 'c')
      : integration_test
      ? DEFAULT_CONFIG_REGTEST_PATH
      : testnet
      ? DEFAULT_CONFIG_TESTNET_PATH
      : DEFAULT_CONFIG_PATH;

    const namespaceBurnAddr = CLIOptAsString(opts, 'B');
    const feeRate = CLIOptAsString(opts, 'F') ? parseInt(CLIOptAsString(opts, 'F')!) : 0;
    const priceToPay = CLIOptAsString(opts, 'P') ? CLIOptAsString(opts, 'P') : '0';
    const priceUnits = CLIOptAsString(opts, 'D');

    const networkType = testnet
      ? 'testnet'
      : localnet
      ? 'localnet'
      : integration_test
      ? 'regtest'
      : 'mainnet';

    const configData = loadConfig(configPath!, networkType);

    if (debug) {
      configData.logConfig.level = 'debug';
    } else {
      configData.logConfig.level = 'info';
    }
    if (bitcoindUsername) {
      configData.bitcoindUsername = bitcoindUsername;
    }
    if (bitcoindPassword) {
      configData.bitcoindPassword = bitcoindPassword;
    }

    if (utxoUrl) {
      configData.utxoServiceUrl = utxoUrl;
    }

    winston.configure({
      level: configData.logConfig.level,
      transports: [new winston.transports.Console(configData.logConfig)],
    });

    const cliOpts: CLI_NETWORK_OPTS = {
      consensusHash: consensusHash ? consensusHash : null,
      feeRate: feeRate ? feeRate : null,
      namespaceBurnAddress: namespaceBurnAddr ? namespaceBurnAddr : null,
      priceToPay: priceToPay ? priceToPay : null,
      priceUnits: priceUnits ? priceUnits : null,
      receiveFeesPeriod: receiveFeesPeriod ? receiveFeesPeriod : null,
      gracePeriod: gracePeriod ? gracePeriod : null,
      altAPIUrl: apiUrl ? apiUrl : configData.blockstackAPIUrl,
      altTransactionBroadcasterUrl: transactionBroadcasterUrl
        ? transactionBroadcasterUrl
        : configData.broadcastServiceUrl,
      nodeAPIUrl: nodeAPIUrl ? nodeAPIUrl : configData.blockstackNodeUrl,
    };

    // wrap command-line options
    const wrappedNetwork = getNetwork(
      configData,
      !!BLOCKSTACK_TEST || !!integration_test || !!testnet || !!localnet
    );
    const blockstackNetwork = new CLINetworkAdapter(wrappedNetwork, cliOpts);
    if (magicBytes) {
      // blockstackNetwork.MAGIC_BYTES = magicBytes;
    }

    // blockstack.config.network = blockstackNetwork;
    blockstack.config.logLevel = 'error';

    if (cmdArgs.command === 'help') {
      console.log(makeCommandUsageString(cmdArgs.args[0]));
      process.exit(0);
    }

    const method = COMMANDS[cmdArgs.command];
    let exitcode = 0;

    method(blockstackNetwork, cmdArgs.args)
      .then((result: string | Buffer) => {
        try {
          // if this is a JSON object with 'status', set the exit code
          if (result instanceof Buffer) {
            return result;
          } else {
            const resJson: any = JSON.parse(result);
            if (resJson.hasOwnProperty('status') && !resJson.status) {
              exitcode = 1;
            }
            return result;
          }
        } catch (e) {
          return result;
        }
      })
      .then((result: string | Buffer) => {
        if (result instanceof Buffer) {
          process.stdout.write(result);
        } else {
          console.log(result);
        }
      })
      .then(() => {
        if (!noExit) {
          process.exit(exitcode);
        }
      })
      .catch((e: Error) => {
        console.error(e.stack);
        console.error(e.message);
        if (!noExit) {
          process.exit(1);
        }
      });
  }
}

/* test only exports */
export const testables =
  process.env.NODE_ENV === 'test'
    ? {
        addressConvert,
      }
    : undefined;
