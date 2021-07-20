import { getTokenFileUrl } from '@stacks/profile'
import { eitherToFuture, fetchAndVerifySignedToken } from './'
import 'isomorphic-fetch'
import { Right, Left, Either } from 'monet'
import { chain, map } from 'fluture'
import { DIDResolutionError, DIDResolutionErrorCodes } from '../errors'
import { b58ToC32, c32ToB58 } from 'c32check'
const { parseZoneFile } = require('zone-file')

/**
 * Will parse the TXT resource records included in a zone file and attempt to find the
 * nested zone file for the specified subdomain
 */

export const findSubdomainZoneFileByName = (
  nameZonefile: string,
  subdomain: string
): Either<Error, { zonefile: string; owner: string }> => {
  const parsedZoneFile = parseZoneFile(nameZonefile)

  if (parsedZoneFile.txt) {
    const match = parsedZoneFile.txt.find((arg: { name: string }) => {
      return arg.name === subdomain
    })

    if (match) {
      const { owner, zonefile } = parseZoneFileTXT(match.txt)
      return Right({
        owner: b58ToC32(owner),
        zonefile: Buffer.from(zonefile, 'base64').toString('ascii'),
      })
    }
  }

  return Left(
    new DIDResolutionError(
      DIDResolutionErrorCodes.MissingZoneFile,
      'No zone file found for subdomain'
    )
  )
}

/**
 * Will parse the TXT resource records included in a zone file and attempt to find the
 * nested zone file for the specified owner
 */

export const findSubdomainZoneFileByOwner = (
  nameZonefile: string,
  owner: string
): Either<
  Error,
  {
    zonefile: string
    fqn: string
  }
> => {
  const parsedZf = parseZoneFile(nameZonefile)

  if (parsedZf.txt) {
    const match = parsedZf.txt.find((arg: { txt: string[] }) => {
      // Please note, 0 is the bitcoin version, equivalent to the 22 (base10) Stacks version byte
      return parseZoneFileTXT(arg.txt).owner === c32ToB58(owner, 0)
    })

    if (match) {
      const subdomainZoneFile = Buffer.from(
        parseZoneFileTXT(match.txt).zonefile,
        'base64'
      ).toString('ascii')

      return Right({
        fqn: parseZoneFile(subdomainZoneFile).$origin,
        zonefile: subdomainZoneFile,
      })
    }
  }

  return Left(
    new DIDResolutionError(
      DIDResolutionErrorCodes.MissingZoneFile,
      'No zone file found for subdomain'
    )
  )
}

export const parseZoneFileTXT = (entries: string[]) =>
  entries.reduce(
    (parsed, current) => {
      const [prop, value] = current.split('=')

      if (prop.startsWith('zf')) {
        return { ...parsed, zonefile: `${parsed.zonefile}${value}` }
      }

      return { ...parsed, [prop]: value }
    },
    { zonefile: '', owner: '', seqn: '0' }
  )

/**
 * Given a zone file for a BNS name, and the c32 encoded Stacks address expected name owner, this function will
 * extract the profile token URL, fetch the referenced profile token JWS, verify the associated signature,
 * and return the public key as well as the profile token URL in case signature verifiction succeeds
 */

export const getPublicKeyUsingZoneFile = (zf: string, ownerAddress: string) =>
  eitherToFuture(extractTokenFileUrl(zf)).pipe(
    chain(tokenUrl =>
      fetchAndVerifySignedToken(tokenUrl, ownerAddress).pipe(
        map(publicKey => ({ publicKey, tokenUrl }))
      )
    )
  )

const extractTokenFileUrl = (zoneFile: string): Either<Error, string> => {
  try {
    const url = getTokenFileUrl(parseZoneFile(zoneFile))
    return url
      ? Right(url)
      : Left(
          new DIDResolutionError(
            DIDResolutionErrorCodes.InvalidZonefile,
            'Missing URI resource record in zone file'
          )
        )
  } catch (e) {
    return Left(e)
  }
}
