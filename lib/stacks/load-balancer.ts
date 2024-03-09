import {
  Stack,
  aws_certificatemanager as acm,
  aws_ec2 as ec2,
  aws_elasticloadbalancingv2 as elbv2,
  aws_route53 as route53,
  aws_route53_targets as route53Targets,
} from 'aws-cdk-lib'
import { NagSuppressions } from 'cdk-nag'

import { SsmParameterStore } from '../resources/ssm-parameter-store'

import type { BaseStackProps } from '../types/stack'
import type { Construct } from 'constructs'

export interface LoadBalancerStackProps extends BaseStackProps {}

export class LoadBalancerStack extends Stack {
  #ssmParameterStore: SsmParameterStore

  constructor(scope: Construct, id: string, props: LoadBalancerStackProps) {
    super(scope, id, props)

    this.#ssmParameterStore = new SsmParameterStore(
      this,
      props.context.serviceName,
    )

    /*
     * ACM
     */
    const route53HostedZoneId = this.#ssmParameterStore.stringParameter(
      'Route53HostedZoneId',
    )
    const route53HostedZoneName = this.#ssmParameterStore.stringParameter(
      'Route53HostedZoneName',
    )
    const route53HostedZone = route53.HostedZone.fromHostedZoneAttributes(
      this,
      'Route53HostedZone',
      {
        hostedZoneId: route53HostedZoneId,
        zoneName: route53HostedZoneName,
      },
    )

    const acmCertificate = new acm.Certificate(this, 'AcmCertificate', {
      domainName: `*.${props.context.domainName.hostedZone}`,
      validation: acm.CertificateValidation.fromDns(route53HostedZone),
    })

    this.#ssmParameterStore.createStringParameter(
      'AcmCertificateArn',
      acmCertificate.certificateArn,
    )

    /*
     * ALB
     */
    const vpcId = this.#ssmParameterStore.stringParameter('VpcId')
    const vpcAvailabilityZones = this.#ssmParameterStore.stringListParameter(
      'VpcAvailabilityZones',
    )
    const subnetIdsPublic =
      this.#ssmParameterStore.stringListParameter('SubnetIdsPublic')
    const subnetIdsPrivate =
      this.#ssmParameterStore.stringListParameter('SubnetIdsPrivate')
    const vpc = ec2.Vpc.fromVpcAttributes(this, 'Vpc', {
      vpcId: vpcId,
      availabilityZones: vpcAvailabilityZones,
      publicSubnetIds: subnetIdsPublic,
      privateSubnetIds: subnetIdsPrivate,
    })

    const securityGroupIdAlb =
      this.#ssmParameterStore.stringParameter('SecurityGroupIdAlb')
    const securityGroupAlb = ec2.SecurityGroup.fromSecurityGroupId(
      this,
      'SecurityGroupAlb',
      securityGroupIdAlb,
    )

    const albTargetGroupBlue = new elbv2.ApplicationTargetGroup(
      this,
      'AlbTargetGroupBlue',
      {
        targetType: elbv2.TargetType.IP,
        protocol: elbv2.ApplicationProtocol.HTTP,
        port: props.context.application.port,
        vpc: vpc,
        protocolVersion: elbv2.ApplicationProtocolVersion.HTTP1,
      },
    )
    const albTargetGroupGreen = new elbv2.ApplicationTargetGroup(
      this,
      'AlbTargetGroupGreen',
      {
        targetType: elbv2.TargetType.IP,
        protocol: elbv2.ApplicationProtocol.HTTP,
        port: props.context.application.port,
        vpc: vpc,
        protocolVersion: elbv2.ApplicationProtocolVersion.HTTP1,
      },
    )

    const alb = new elbv2.ApplicationLoadBalancer(this, 'Alb', {
      internetFacing: true,
      ipAddressType: elbv2.IpAddressType.IPV4,
      vpc: vpc,
      securityGroup: securityGroupAlb,
    })

    const albListenerProd = alb.addListener('AlbListenerProd', {
      protocol: elbv2.ApplicationProtocol.HTTPS,
      port: 443,
      defaultAction: elbv2.ListenerAction.forward([albTargetGroupBlue]),
      certificates: [acmCertificate],
      open: false,
    })
    const albListenerTest = alb.addListener('AlbListenerTest', {
      protocol: elbv2.ApplicationProtocol.HTTPS,
      port: 8443,
      defaultAction: elbv2.ListenerAction.forward([albTargetGroupGreen]),
      certificates: [acmCertificate],
      open: false,
    })

    NagSuppressions.addResourceSuppressions(alb, [
      {
        id: 'AwsSolutions-ELB2',
        reason: 'ALB access logging is not required',
      },
    ])

    this.#ssmParameterStore.createStringParameter('AlbArn', alb.loadBalancerArn)
    this.#ssmParameterStore.createStringParameter(
      'AlbCanonicalHostedZoneId',
      alb.loadBalancerCanonicalHostedZoneId,
    )
    this.#ssmParameterStore.createStringParameter(
      'AlbDnsName',
      alb.loadBalancerDnsName,
    )
    this.#ssmParameterStore.createStringParameter(
      'AlbListenerArnProd',
      albListenerProd.listenerArn,
    )
    this.#ssmParameterStore.createStringParameter(
      'AlbListenerArnTest',
      albListenerTest.listenerArn,
    )
    this.#ssmParameterStore.createStringParameter(
      'AlbTargetGroupArnBlue',
      albTargetGroupBlue.targetGroupArn,
    )
    this.#ssmParameterStore.createStringParameter(
      'AlbTargetGroupArnGreen',
      albTargetGroupGreen.targetGroupArn,
    )

    /*
     * Route53
     */
    new route53.RecordSet(this, 'Route53RecordSet', {
      zone: route53HostedZone,
      recordName: `${props.context.domainName.application}.`,
      recordType: route53.RecordType.A,
      target: route53.RecordTarget.fromAlias(
        new route53Targets.LoadBalancerTarget(alb),
      ),
    })
  }
}
