export interface Context {
  serviceName: string
  network: ContextNetwork
  domainName: ContextDomainName
  application: ContextApplication
  pipeline: ContextPipeline
}

export interface ContextNetwork {
  vpcCidrBlock: string
  publicSubnetCidrBlocks: Array<string>
  privateSubnetCidrBlocks: Array<string>
  natGateways: number
}

export interface ContextDomainName {
  hostedZone: string
  application: string
}

export interface ContextApplication {
  port: number
  autoScaling: ContextApplicationAutoScaling
}

export interface ContextApplicationAutoScaling {
  minCapacity: number
  maxCapacity: number
  cpuTargetValue: number
}

export interface ContextPipeline {
  github: ContextPipelineGitHub
}

export interface ContextPipelineGitHub {
  owner: string
  repo: string
}
