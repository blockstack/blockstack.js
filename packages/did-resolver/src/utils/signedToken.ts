import { Right, Left, Either } from 'monet'
import { verifyProfileToken } from '@stacks/profile/dist'
import { eitherToFuture } from './'
import { chain, map } from 'fluture'
import { DIDResolutionError, DIDResolutionErrorCodes } from '../errors'
import { AddressVersion } from '@stacks/transactions'
import { c32addressDecode, c32address } from 'c32check/lib/address'
import { versionByteToDidType } from '../constants'
import { DIDParseError, DIDParseErrorCodes } from '../errors'
import { fetchJSON } from '../api'

/**
 * Given a token URL (i.e. the URI record listed in a zone file), and the owner of the name described
 * by the zone file, will fetch the associated profile token JWS, verify it and return the associated public key
 */

export const fetchAndVerifySignedToken = (tokenUrl: string, ownerAddress: string) =>
  fetchSignedToken(tokenUrl)
    .pipe(map(verifyTokenAndGetPubKey(ownerAddress)))
    .pipe(chain(eitherToFuture))

/**
 * When verifying a signed profile token, the included public key is converted to a mainnet c32 encoded
 * address and compared with the expected owner passed as an argument.
 * @see https://github.com/blockstack/stacks.js/blob/master/packages/profile/src/profileTokens.ts#L75
 *
 * This means that the address encoded in the DID needs to be encoded using a mainnet version byte before
 * it can be passed to the verifyProfileToken function.
 *
 * @note Function is exported for testing purposes only
 * @private
 *
 * This helper function will re-encode the passed c32 address accordingly
 */

export const toMainnetAddress = (address: string) => {
  const [version, hash] = c32addressDecode(address)
  const didMetadata = versionByteToDidType[version]

  if (didMetadata) {
    return c32address(AddressVersion.MainnetSingleSig, hash)
  }

  throw new DIDParseError(DIDParseErrorCodes.InvalidVersionByte)
}

/**
 * Helper function, makes a GET request to the supplied endpoint.
 * Assumes the response is an array containing one JSON Web Token.
 *
 * @returns the JWT at the URL if found
 */

const fetchSignedToken = (endpoint: string) => fetchJSON<any[]>(endpoint).pipe(map(el => el[0]))

const verifyTokenAndGetPubKey =
  (owner: string) =>
  ({ token }: { token: string }): Either<Error, string> => {
    try {
      const { payload } = verifyProfileToken(token, toMainnetAddress(owner))
      //@ts-ignore
      return Right(payload.subject.publicKey)
    } catch (e) {
      return Left(
        new DIDResolutionError(DIDResolutionErrorCodes.InvalidSignedProfileToken, e.message)
      )
    }
  }
