import { aws_ssm as ssm } from 'aws-cdk-lib'

import type { Context } from '../types/context'
import type { Stack } from 'aws-cdk-lib'

const ssmParameterNameSuffix = {
  VpcId: 'vpc-id',
  VpcAvailabilityZones: 'vpc-azs',
  SubnetIdsPublic: 'subnet-ids-public',
  SubnetIdsPrivate: 'subnet-ids-private',
  SecurityGroupIdAlb: 'security-group-id-alb',
  SecurityGroupIdEcs: 'security-group-id-ecs',
  Route53HostedZoneId: 'route53-hosted-zone-id',
  Route53HostedZoneName: 'route53-hosted-zone-name',
  AcmCertificateArn: 'acm-certificate-arn',
  AlbArn: 'alb-arn',
  AlbCanonicalHostedZoneId: 'alb-canonical-hosted-zone-id',
  AlbDnsName: 'alb-dns-name',
  AlbListenerArnProd: 'alb-listener-arn-prod',
  AlbListenerArnTest: 'alb-listener-arn-test',
  AlbTargetGroupArnBlue: 'alb-target-group-arn-blue',
  AlbTargetGroupArnGreen: 'alb-target-group-arn-green',
} as const
export type SsmParameterId = keyof typeof ssmParameterNameSuffix

export interface SsmParameterStoreProps {
  context: Context
}

export class SsmParameterStore {
  #stack: Stack
  #serviceName: string

  constructor(stack: Stack, serviceName: string) {
    this.#stack = stack
    this.#serviceName = serviceName
  }

  #parameterName(id: SsmParameterId) {
    return `/${this.#serviceName}/deployments/${ssmParameterNameSuffix[id]}`
  }

  get #description() {
    return `created by ${this.#stack.stackName}`
  }

  createStringParameter(id: SsmParameterId, value: string) {
    return new ssm.StringParameter(this.#stack, `SsmStringParameter${id}`, {
      parameterName: this.#parameterName(id),
      description: this.#description,
      stringValue: value,
    })
  }

  createStringListParameter(id: SsmParameterId, value: Array<string>) {
    return new ssm.StringListParameter(
      this.#stack,
      `SsmStringListParameter${id}`,
      {
        parameterName: this.#parameterName(id),
        description: this.#description,
        stringListValue: value,
      },
    )
  }

  StringParameter(id: SsmParameterId) {
    return ssm.StringParameter.valueForTypedStringParameterV2(
      this.#stack,
      this.#parameterName(id),
    )
  }

  StringListParameter(id: SsmParameterId) {
    return ssm.StringListParameter.valueForTypedListParameter(
      this.#stack,
      this.#parameterName(id),
    )
  }
}
