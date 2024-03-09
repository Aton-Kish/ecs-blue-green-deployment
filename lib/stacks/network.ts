import assert from 'assert'

import { Stack, aws_ec2 as ec2, aws_route53 as route53 } from 'aws-cdk-lib'
import { NagSuppressions } from 'cdk-nag'

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

    /*
     * VPC
     */
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

    NagSuppressions.addResourceSuppressions(vpc, [
      {
        id: 'AwsSolutions-VPC7',
        reason: 'VPC Flow Logs is not required',
      },
    ])

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

    /*
     * Security Group
     */
    const securityGroupAlb = new ec2.SecurityGroup(this, 'SecurityGroupAlb', {
      vpc: vpc,
      allowAllOutbound: false,
    })
    const securityGroupEcs = new ec2.SecurityGroup(this, 'SecurityGroupEcs', {
      vpc: vpc,
      allowAllOutbound: false,
    })

    securityGroupAlb.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      'allow HTTPS access from internet',
    )
    securityGroupAlb.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(8443),
      'allow test access from internet',
    )
    securityGroupAlb.addEgressRule(
      ec2.Peer.securityGroupId(securityGroupEcs.securityGroupId),
      ec2.Port.tcp(props.context.application.port),
      'allow application access to ECS',
    )

    // NOTE: avoid a circular reference
    new ec2.CfnSecurityGroupIngress(
      this,
      'SecurityGroupEcsIngressApplicationAccessFromAlb',
      {
        groupId: securityGroupEcs.securityGroupId,
        ipProtocol: 'tcp',
        fromPort: props.context.application.port,
        toPort: props.context.application.port,
        sourceSecurityGroupId: securityGroupAlb.securityGroupId,
        description: 'allow application access from ALB',
      },
    )
    securityGroupEcs.addEgressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      'allow HTTPS access to internet',
    )

    NagSuppressions.addResourceSuppressions(securityGroupAlb, [
      {
        id: 'AwsSolutions-EC23',
        reason: 'allow HTTPS access from internet',
      },
    ])

    this.#ssmParameterStore.createStringParameter(
      'SecurityGroupIdAlb',
      securityGroupAlb.securityGroupId,
    )
    this.#ssmParameterStore.createStringParameter(
      'SecurityGroupIdEcs',
      securityGroupEcs.securityGroupId,
    )

    /*
     * Route53
     */
    const route53HostedZone = new route53.HostedZone(
      this,
      'Route53HostedZone',
      {
        zoneName: props.context.domainName.hostedZone,
      },
    )
    assert(route53HostedZone.hostedZoneNameServers != null)

    this.#ssmParameterStore.createStringParameter(
      'Route53HostedZoneId',
      route53HostedZone.hostedZoneId,
    )
    this.#ssmParameterStore.createStringParameter(
      'Route53HostedZoneName',
      route53HostedZone.zoneName,
    )
    this.#ssmParameterStore.createStringListParameter(
      'Route53HostedZoneNameServers',
      route53HostedZone.hostedZoneNameServers,
    )
  }
}
