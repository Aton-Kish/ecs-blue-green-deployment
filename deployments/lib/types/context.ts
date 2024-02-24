export interface Context {
  serviceName: string
  network: ContextNetwork
  domainName: ContextDomainName
  application: ContextApplication
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

export interface ContextApplication {
  port: number
}
