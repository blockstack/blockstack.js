import { DIDResolutionErrorCodes } from '../../src/errors'
import { findSubdomainZoneFileByName, findSubdomainZoneFileByOwner } from '../../src/utils/zonefile'
import { testZoneFile } from './data/zonefile.data'

test('Correctly finds the zonefile for subdomain given the subdomain owner', () => {
  expect(
    findSubdomainZoneFileByOwner(testZoneFile, 'SPVP414ACB1H517G9D23P0QRDT64X9QG03C4CPBW').right()
  ).toMatchSnapshot()
  expect(
    findSubdomainZoneFileByOwner(testZoneFile, 'SPB53GD600EMEM74DFMA0B61JN8D8C4VE7D2ZSJ9').left()
      .message
  ).toContain(DIDResolutionErrorCodes.MissingZoneFile)
})

test('Correctly finds the zonefile for subdomain given the domain name', () => {
  expect(findSubdomainZoneFileByName(testZoneFile, 'htdhtfkihtdkhtd').right()).toMatchSnapshot()
  expect(findSubdomainZoneFileByName(testZoneFile, 'InvalidName').left().message).toContain(
    DIDResolutionErrorCodes.MissingZoneFile
  )
})
