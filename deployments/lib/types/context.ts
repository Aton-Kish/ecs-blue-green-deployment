export interface Context {
  serviceName: string
  network: ContextNetwork
}

export interface ContextNetwork {
  vpcCidrBlock: string
  publicSubnetCidrBlocks: Array<string>
  privateSubnetCidrBlocks: Array<string>
  natGateways: number
}
