import { toMainnetAddress, encodeFQN, decodeFQN } from '../../src/utils'

test('Correctly parses on-chain stacks DID', () => {
  const onChainMainnet = 'SPB53GD600EMEM74DFMA0B61JN8D8C4VE7D2ZSJ9'
  const onChainTestnet = 'STB53GD600EMEM74DFMA0B61JN8D8C4VE5477MXR'
  const offChainMainnet = 'SHB53GD600EMEM74DFMA0B61JN8D8C4VE6DHF2QF'
  const offChainTestnet = 'SJB53GD600EMEM74DFMA0B61JN8D8C4VE4M8NJRP'

  expect(toMainnetAddress(offChainMainnet)).toBe(onChainMainnet)
  expect(toMainnetAddress(offChainTestnet)).toBe(onChainMainnet)
  expect(toMainnetAddress(onChainMainnet)).toBe(onChainMainnet)
  expect(toMainnetAddress(onChainTestnet)).toBe(onChainMainnet)

  const unknownVersionByte = 'S5B53GD600EMEM74DFMA0B61JN8D8C4VE4C2YSMV'
  expect(() => toMainnetAddress(unknownVersionByte)).toThrow()
})

test('Correctly encodes FQN', () => {
  const nameInfo = {
    name: 'test',
    namespace: 'com',
  }

  expect(encodeFQN(nameInfo)).toEqual('test.com')
  expect(encodeFQN({ ...nameInfo, subdomain: 'example' })).toEqual('example.test.com')
})

test('Correctly decodes FQN', () => {
  const fqnWithSubdomain = 'example.test.com'
  const fqn = 'test.com'

  expect(decodeFQN('.com').left().message).toEqual('Invalid FQN')

  expect(decodeFQN(fqn).right()).toEqual({
    name: 'test',
    namespace: 'com',
  })

  expect(decodeFQN(fqnWithSubdomain).right()).toEqual({
    subdomain: 'example',
    name: 'test',
    namespace: 'com',
  })
})
