export interface Context {
  serviceName: string
  network: ContextNetwork
  domainName: ContextDomainName
}

export interface ContextNetwork {
  vpcCidrBlock: string
  publicSubnetCidrBlocks: Array<string>
  privateSubnetCidrBlocks: Array<string>
  natGateways: number
}

export interface ContextDomainName {
  hostedZone: string
}
