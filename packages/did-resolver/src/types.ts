export enum DIDType {
  onChain = 'onChain',
  offChain = 'offChain',
}

export enum StacksNetworkDeployment {
  test = 'test',
  main = 'main',
}

export type StacksDID = {
  prefix: 'did:stack:v2'
  address: string
  anchorTxId: string
  metadata: {
    type: DIDType
    deployment: StacksNetworkDeployment
  }
}
