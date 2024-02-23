import { Stack, aws_ec2 as ec2 } from 'aws-cdk-lib'

import { SsmParameterStore } from '../resources/ssm-parameter-store'

import type { BaseStackProps } from '../types/stack'
import type { Construct } from 'constructs'

export interface NetworkStackProps extends BaseStackProps {}

export class NetworkStack extends Stack {
  #ssmParameterStore: SsmParameterStore

  constructor(scope: Construct, id: string, props: NetworkStackProps) {
    super(scope, id, props)

    this.#ssmParameterStore = new SsmParameterStore(
      this,
      props.context.serviceName,
    )

    const vpc = new ec2.Vpc(this, 'Vpc', {
      vpcName: `${props.context.serviceName}-vpc`,
      ipAddresses: ec2.IpAddresses.cidr(props.context.network.vpcCidrBlock),
      maxAzs: props.context.network.publicSubnetCidrBlocks.length,
      subnetConfiguration: [
        { name: 'Public', subnetType: ec2.SubnetType.PUBLIC },
        {
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
      ],
      natGateways: props.context.network.natGateways,
    })
    for (let i = 0; i < vpc.publicSubnets.length; i++) {
      const cfnSubnet = vpc.publicSubnets[i].node.findChild(
        'Subnet',
      ) as ec2.CfnSubnet
      cfnSubnet.addPropertyOverride(
        'CidrBlock',
        props.context.network.publicSubnetCidrBlocks[i],
      )
    }
    for (let i = 0; i < vpc.privateSubnets.length; i++) {
      const cfnSubnet = vpc.privateSubnets[i].node.findChild(
        'Subnet',
      ) as ec2.CfnSubnet
      cfnSubnet.addPropertyOverride(
        'CidrBlock',
        props.context.network.privateSubnetCidrBlocks[i],
      )
    }

    this.#ssmParameterStore.createStringParameter('VpcId', vpc.vpcId)
    this.#ssmParameterStore.createStringListParameter(
      'VpcAvailabilityZones',
      vpc.availabilityZones,
    )
    this.#ssmParameterStore.createStringListParameter(
      'SubnetIdsPublic',
      vpc.publicSubnets.map((subnet) => subnet.subnetId),
    )
    this.#ssmParameterStore.createStringListParameter(
      'SubnetIdsPrivate',
      vpc.privateSubnets.map((subnet) => subnet.subnetId),
    )
  }
}
