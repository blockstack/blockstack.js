/* @flow */

import {
  getOrSetLocalGaiaHubConnection, getFullReadUrl,
  connectToGaiaHub, uploadToGaiaHub, getBucketUrl,
  BLOCKSTACK_GAIA_HUB_LABEL, type GaiaHubConfig
} from './hub'
// export { type GaiaHubConfig } from './hub'

import {
  encryptECIES, decryptECIES, signECDSA, verifyECDSA
} from '../encryption'
import { getPublicKeyFromPrivate, publicKeyToAddress } from '../keys'
import { lookupProfile } from '../profiles'
import {
  InvalidStateError,
  SignatureVerificationError
} from '../errors'
import { Logger } from '../logger'

import type { UserSession } from '../auth/userSession'

const SIGNATURE_FILE_SUFFIX = '.sig'

/**
 * Fetch the public read URL of a user file for the specified app.
 * @param {String} path - the path to the file to read
 * @param {String} username - The Blockstack ID of the user to look up
 * @param {String} appOrigin - The app origin
 * @param {String} [zoneFileLookupURL=null] - The URL
 * to use for zonefile lookup. If falsey, this will use the
 * blockstack.js's getNameInfo function instead.
 * @return {Promise} that resolves to the public read URL of the file
 * or rejects with an error
 */
export function getUserAppFileUrl(path: string, username: string, appOrigin: string,
                                  zoneFileLookupURL: ?string = null) {
  return lookupProfile(username, zoneFileLookupURL)
    .then((profile) => {
      if (profile.hasOwnProperty('apps')) {
        if (profile.apps.hasOwnProperty(appOrigin)) {
          return profile.apps[appOrigin]
        } else {
          return null
        }
      } else {
        return null
      }
    })
    .then((bucketUrl) => {
      if (bucketUrl) {
        const bucket = bucketUrl.replace(/\/?(\?|#|$)/, '/$1')
        return `${bucket}${path}`
      } else {
        return null
      }
    })
}

/**
 * Encrypts the data provided with the app public key.
 * @param {UserSession} caller - the instance calling this method
 * @param {String|Buffer} content - data to encrypt
 * @param {Object} [options=null] - options object
 * @param {String} options.publicKey - the hex string of the ECDSA public
 * key to use for encryption. If not provided, will use user's appPrivateKey.
 * @return {String} Stringified ciphertext object
 * @private
 */
export function encryptContentImpl(caller: UserSession,
                                   content: string | Buffer,
                                   options?: {publicKey?: string}) {
  const defaults = { publicKey: null }
  const opt = Object.assign({}, defaults, options)
  if (!opt.publicKey) {
    const userData = caller.loadUserData()
    const privateKey = userData.appPrivateKey
    opt.publicKey = getPublicKeyFromPrivate(privateKey)
  }

  const cipherObject = encryptECIES(opt.publicKey, content)
  return JSON.stringify(cipherObject)
}

/**
 * Decrypts data encrypted with `encryptContent` with the
 * transit private key.
 * @param {UserSession} caller - the instance calling this method
 * @param {String|Buffer} content - encrypted content.
 * @param {Object} [options=null] - options object
 * @param {String} options.privateKey - the hex string of the ECDSA private
 * key to use for decryption. If not provided, will use user's appPrivateKey.
 * @return {String|Buffer} decrypted content.
 * @private
 */
export function decryptContentImpl(caller: UserSession,
                                   content: string,
                                   options?: {privateKey?: ?string}) {
  const defaults = { privateKey: null }
  const opt = Object.assign({}, defaults, options)
  let privateKey = opt.privateKey
  if (!privateKey) {
    privateKey = caller.loadUserData().appPrivateKey
  }

  try {
    const cipherObject = JSON.parse(content)
    return decryptECIES(privateKey, cipherObject)
  } catch (err) {
    if (err instanceof SyntaxError) {
      throw new Error('Failed to parse encrypted content JSON. The content may not '
                      + 'be encrypted. If using getFile, try passing { decrypt: false }.')
    } else {
      throw err
    }
  }
}

/* Get the gaia address used for servicing multiplayer reads for the given
 * (username, app) pair.
 * @private
 */
function getGaiaAddress(caller: UserSession,
                        app: string, username: ?string, zoneFileLookupURL: ?string) {
  return Promise.resolve()
    .then(() => {
      if (username) {
        return getUserAppFileUrl('/', username, app, zoneFileLookupURL)
      } else {
        return getOrSetLocalGaiaHubConnection(caller)
          .then(gaiaHubConfig => getFullReadUrl('/', gaiaHubConfig))
      }
    })
    .then((fileUrl) => {
      const matches = fileUrl.match(/([13][a-km-zA-HJ-NP-Z0-9]{26,35})/)
      if (!matches) {
        throw new Error('Failed to parse gaia address')
      }
      return matches[matches.length - 1]
    })
}

/* Handle fetching the contents from a given path. Handles both
 *  multi-player reads and reads from own storage.
 * @private
 */
function getFileContents(caller: UserSession,
                         path: string, app: string, username: ?string, zoneFileLookupURL: ?string,
                         forceText: boolean) : Promise<?string | ?ArrayBuffer> {
  return Promise.resolve()
    .then(() => {
      if (username) {
        return getUserAppFileUrl(path, username, app, zoneFileLookupURL)
      } else {
        return getOrSetLocalGaiaHubConnection(caller)
          .then(gaiaHubConfig => getFullReadUrl(path, gaiaHubConfig))
      }
    })
    .then(readUrl => new Promise((resolve, reject) => {
      if (!readUrl) {
        reject(null)
      } else {
        resolve(readUrl)
      }
    }))
    .then(readUrl => fetch(readUrl))
    .then((response) => {
      if (response.status !== 200) {
        if (response.status === 404) {
          Logger.debug(`getFile ${path} returned 404, returning null`)
          return null
        } else {
          throw new Error(`getFile ${path} failed with HTTP status ${response.status}`)
        }
      }
      const contentType = response.headers.get('Content-Type')
      if (forceText || contentType === null
          || contentType.startsWith('text')
          || contentType === 'application/json') {
        return response.text()
      } else {
        return response.arrayBuffer()
      }
    })
}

/* Handle fetching an unencrypted file, its associated signature
 *  and then validate it. Handles both multi-player reads and reads
 *  from own storage.
 * @private
 */
function getFileSignedUnencrypted(caller: UserSession, path: string, opt: {
  username?: ?string,
  app: string,
  zoneFileLookupURL?: ?string
}) {
  // future optimization note:
  //    in the case of _multi-player_ reads, this does a lot of excess
  //    profile lookups to figure out where to read files
  //    do browsers cache all these requests if Content-Cache is set?
  return Promise.all(
    [getFileContents(caller, path, opt.app, opt.username, opt.zoneFileLookupURL, false),
     getFileContents(caller, `${path}${SIGNATURE_FILE_SUFFIX}`, opt.app, opt.username,
                     opt.zoneFileLookupURL, true),
     getGaiaAddress(caller, opt.app, opt.username, opt.zoneFileLookupURL)]
  )
    .then(([fileContents, signatureContents, gaiaAddress]) => {
      if (!fileContents) {
        return fileContents
      }
      if (!gaiaAddress) {
        throw new SignatureVerificationError('Failed to get gaia address for verification of: '
                                             + `${path}`)
      }
      if (!signatureContents || typeof signatureContents !== 'string') {
        throw new SignatureVerificationError('Failed to obtain signature for file: '
                                             + `${path} -- looked in ${path}${SIGNATURE_FILE_SUFFIX}`)
      }
      let signature
      let publicKey
      try {
        const sigObject = JSON.parse(signatureContents)
        signature = sigObject.signature
        publicKey = sigObject.publicKey
      } catch (err) {
        if (err instanceof SyntaxError) {
          throw new Error('Failed to parse signature content JSON '
                          + `(path: ${path}${SIGNATURE_FILE_SUFFIX})`
                          + ' The content may be corrupted.')
        } else {
          throw err
        }
      }
      const signerAddress = publicKeyToAddress(publicKey)
      if (gaiaAddress !== signerAddress) {
        throw new SignatureVerificationError(`Signer pubkey address (${signerAddress}) doesn't`
                                             + ` match gaia address (${gaiaAddress})`)
      } else if (!verifyECDSA(Buffer.from(fileContents), publicKey, signature)) {
        throw new SignatureVerificationError(
          'Contents do not match ECDSA signature: '
            + `path: ${path}, signature: ${path}${SIGNATURE_FILE_SUFFIX}`
        )
      } else {
        return fileContents
      }
    })
}


/* Handle signature verification and decryption for contents which are
 *  expected to be signed and encrypted. This works for single and
 *  multiplayer reads. In the case of multiplayer reads, it uses the
 *  gaia address for verification of the claimed public key.
 * @private
 */
function handleSignedEncryptedContents(caller: UserSession, path: string, storedContents: string,
                                       app: string, username: ?string, zoneFileLookupURL: ?string) {
  const appPrivateKey = caller.loadUserData().appPrivateKey
  const appPublicKey = getPublicKeyFromPrivate(appPrivateKey)

  let addressPromise
  if (username) {
    addressPromise = getGaiaAddress(caller, app, username, zoneFileLookupURL)
  } else {
    const address = publicKeyToAddress(appPublicKey)
    addressPromise = Promise.resolve(address)
  }

  return addressPromise.then((address) => {
    if (!address) {
      throw new SignatureVerificationError('Failed to get gaia address for verification of: '
                                           + `${path}`)
    }
    let sigObject
    try {
      sigObject = JSON.parse(storedContents)
    } catch (err) {
      if (err instanceof SyntaxError) {
        throw new Error('Failed to parse encrypted, signed content JSON. The content may not '
                        + 'be encrypted. If using getFile, try passing'
                        + ' { verify: false, decrypt: false }.')
      } else {
        throw err
      }
    }
    const signature = sigObject.signature
    const signerPublicKey = sigObject.publicKey
    const cipherText = sigObject.cipherText
    const signerAddress = publicKeyToAddress(signerPublicKey)

    if (!signerPublicKey || !cipherText || !signature) {
      throw new SignatureVerificationError(
        'Failed to get signature verification data from file:'
          + ` ${path}`
      )
    } else if (signerAddress !== address) {
      throw new SignatureVerificationError(`Signer pubkey address (${signerAddress}) doesn't`
                                           + ` match gaia address (${address})`)
    } else if (!verifyECDSA(cipherText, signerPublicKey, signature)) {
      throw new SignatureVerificationError('Contents do not match ECDSA signature in file:'
                                           + ` ${path}`)
    } else {
      return caller.decryptContent(cipherText)
    }
  })
}

/**
 * Retrieves the specified file from the app's data store.
 * @param {UserSession} caller - instance calling this method
 * @param {String} path - the path to the file to read
 * @param {Object} [options=null] - options object
 * @param {Boolean} [options.decrypt=true] - try to decrypt the data with the app private key
 * @param {String} options.username - the Blockstack ID to lookup for multi-player storage
 * @param {Boolean} options.verify - Whether the content should be verified, only to be used
 * when `putFile` was set to `sign = true`
 * @param {String} options.app - the app to lookup for multi-player storage -
 * defaults to current origin
 * @param {String} [options.zoneFileLookupURL=null] - The URL
 * to use for zonefile lookup. If falsey, this will use the
 * blockstack.js's getNameInfo function instead.
 * @returns {Promise} that resolves to the raw data in the file
 * or rejects with an error
 * @private
 */
export function getFileImpl(caller: UserSession, path: string, options?: {
    decrypt?: boolean,
    verify?: boolean,
    username?: string,
    app?: string,
    zoneFileLookupURL?: ?string
  }) {
  const appConfig = caller.session.appConfig
  if (!appConfig) {
    throw new InvalidStateError('Missing AppConfig')
  }
  const defaults = {
    decrypt: true,
    verify: false,
    username: null,
    app: appConfig.appDomain,
    zoneFileLookupURL: null
  }

  const opt = Object.assign({}, defaults, options)

  // in the case of signature verification, but no
  //  encryption expected, need to fetch _two_ files.
  if (opt.verify && !opt.decrypt) {
    return getFileSignedUnencrypted(caller, path, opt)
  }

  return getFileContents(caller, path, opt.app, opt.username, opt.zoneFileLookupURL, !!opt.decrypt)
    .then((storedContents) => {
      if (storedContents === null) {
        return storedContents
      } else if (opt.decrypt && !opt.verify) {
        if (typeof storedContents !== 'string') {
          throw new Error('Expected to get back a string for the cipherText')
        }
        return decryptContentImpl(caller, storedContents)
      } else if (opt.decrypt && opt.verify) {
        if (typeof storedContents !== 'string') {
          throw new Error('Expected to get back a string for the cipherText')
        }
        return handleSignedEncryptedContents(caller, path, storedContents,
                                             opt.app, opt.username, opt.zoneFileLookupURL)
      } else if (!opt.verify && !opt.decrypt) {
        return storedContents
      } else {
        throw new Error('Should be unreachable.')
      }
    })
}

/**
 * Stores the data provided in the app's data store to to the file specified.
 * @param {UserSession} caller - instance calling this method
 * @param {String} path - the path to store the data in
 * @param {String|Buffer} content - the data to store in the file
 * @param {Object} [options=null] - options object
 * @param {Boolean|String} [options.encrypt=true] - encrypt the data with the app private key
 *                                                  or the provided public key
 * @param {Boolean} [options.sign=false] - sign the data using ECDSA on SHA256 hashes with
 *                                         the app private key
 * @return {Promise} that resolves if the operation succeed and rejects
 * if it failed
 * @private
 */
export function putFileImpl(caller: UserSession, path: string, content: string | Buffer, options?: {
  encrypt?: boolean | string,
  sign?: boolean
  }) {
  const defaults = {
    encrypt: true,
    sign: false
  }

  const opt = Object.assign({}, defaults, options)

  let contentType = 'text/plain'
  if (typeof (content) !== 'string') {
    contentType = 'application/octet-stream'
  }

  // First, let's figure out if we need to get public/private keys,
  //  or if they were passed in

  let privateKey = ''
  let publicKey = ''
  if (opt.sign) {
    if (typeof (opt.sign) === 'string') {
      privateKey = opt.sign
    } else {
      privateKey = caller.loadUserData().appPrivateKey
    }
  }
  if (opt.encrypt) {
    if (typeof (opt.encrypt) === 'string') {
      publicKey = opt.encrypt
    } else {
      if (!privateKey) {
        privateKey = caller.loadUserData().appPrivateKey
      }
      publicKey = getPublicKeyFromPrivate(privateKey)
    }
  }

  // In the case of signing, but *not* encrypting,
  //   we perform two uploads. So the control-flow
  //   here will return there.
  if (!opt.encrypt && opt.sign) {
    const signatureObject = signECDSA(privateKey, content)
    const signatureContent = JSON.stringify(signatureObject)
    return getOrSetLocalGaiaHubConnection(caller)
      .then(gaiaHubConfig => Promise.all([
        uploadToGaiaHub(path, content, gaiaHubConfig, contentType),
        uploadToGaiaHub(`${path}${SIGNATURE_FILE_SUFFIX}`,
                        signatureContent, gaiaHubConfig, 'application/json')]))
      .then(fileUrls => fileUrls[0])
  }

  // In all other cases, we only need one upload.
  if (opt.encrypt && !opt.sign) {
    content = encryptContentImpl(caller, content, { publicKey })
    contentType = 'application/json'
  } else if (opt.encrypt && opt.sign) {
    const cipherText = encryptContentImpl(caller, content, { publicKey })
    const signatureObject = signECDSA(privateKey, cipherText)
    const signedCipherObject = {
      signature: signatureObject.signature,
      publicKey: signatureObject.publicKey,
      cipherText
    }
    content = JSON.stringify(signedCipherObject)
    contentType = 'application/json'
  }
  return getOrSetLocalGaiaHubConnection(caller)
    .then(gaiaHubConfig => uploadToGaiaHub(path, content, gaiaHubConfig, contentType))
}

/**
 * Get the app storage bucket URL
 * @param {String} gaiaHubUrl - the gaia hub URL
 * @param {String} appPrivateKey - the app private key used to generate the app address
 * @returns {Promise} That resolves to the URL of the app index file
 * or rejects if it fails
 */
export function getAppBucketUrl(gaiaHubUrl: string, appPrivateKey: string) {
  return getBucketUrl(gaiaHubUrl, appPrivateKey)
}

/**
 * Loop over the list of files in a Gaia hub, and run a callback on each entry.
 * Not meant to be called by external clients.
 * @param {GaiaHubConfig} hubConfig - the Gaia hub config
 * @param {String | null} page - the page ID
 * @param {number} callCount - the loop count
 * @param {number} fileCount - the number of files listed so far
 * @param {function} callback - the callback to invoke on each file.  If it returns a falsey
 *  value, then the loop stops.  If it returns a truthy value, the loop continues.
 * @returns {Promise} that resolves to the number of files listed.
 * @private
 */
function listFilesLoop(hubConfig: GaiaHubConfig,
                       page: string | null,
                       callCount: number,
                       fileCount: number,
                       callback: (name: string) => boolean) : Promise<number> {
  if (callCount > 65536) {
    // this is ridiculously huge, and probably indicates
    // a faulty Gaia hub anyway (e.g. on that serves endless data)
    throw new Error('Too many entries to list')
  }

  let httpStatus
  const pageRequest = JSON.stringify({ page })

  const fetchOptions = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': `${pageRequest.length}`,
      Authorization: `bearer ${hubConfig.token}`
    },
    body: pageRequest
  }

  return fetch(`${hubConfig.server}/list-files/${hubConfig.address}`, fetchOptions)
    .then((response) => {
      httpStatus = response.status
      if (httpStatus >= 400) {
        throw new Error(`listFiles failed with HTTP status ${httpStatus}`)
      }
      return response.text()
    })
    .then(responseText => JSON.parse(responseText))
    .then((responseJSON) => {
      const entries = responseJSON.entries
      const nextPage = responseJSON.page
      if (entries === null || entries === undefined) {
        // indicates a misbehaving Gaia hub or a misbehaving driver
        // (i.e. the data is malformed)
        throw new Error('Bad listFiles response: no entries')
      }
      for (let i = 0; i < entries.length; i++) {
        const rc = callback(entries[i])
        if (!rc) {
          // callback indicates that we're done
          return Promise.resolve(fileCount + i)
        }
      }
      if (nextPage && entries.length > 0) {
        // keep going -- have more entries
        return listFilesLoop(
          hubConfig, nextPage, callCount + 1, fileCount + entries.length, callback
        )
      } else {
        // no more entries -- end of data
        return Promise.resolve(fileCount)
      }
    })
}

/**
 * List the set of files in this application's Gaia storage bucket.
 * @param {UserSession} caller - instance calling this method
 * @param {function} callback - a callback to invoke on each named file that
 * returns `true` to continue the listing operation or `false` to end it
 * @return {Promise} that resolves to the number of files listed
 * @private
 */
export function listFilesImpl(caller: UserSession,
                              callback: (name: string) => boolean) : Promise<number> {
  return getOrSetLocalGaiaHubConnection(caller)
    .then(gaiaHubConfig => listFilesLoop(gaiaHubConfig, null, 0, 0, callback))
}

export { connectToGaiaHub, uploadToGaiaHub, BLOCKSTACK_GAIA_HUB_LABEL }
