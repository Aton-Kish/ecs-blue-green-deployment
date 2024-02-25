import {
  RemovalPolicy,
  Stack,
  aws_ec2 as ec2,
  aws_ecr as ecr,
  aws_ecs as ecs,
  aws_iam as iam,
  aws_logs as logs,
} from 'aws-cdk-lib'
import { NagSuppressions } from 'cdk-nag'

import { SsmParameterStore } from '../resources/ssm-parameter-store'

import type { BaseStackProps } from '../types/stack'
import type { Construct } from 'constructs'

export interface EcsSetupStackProps extends BaseStackProps {}

export class EcsSetupStack extends Stack {
  #ssmParameterStore: SsmParameterStore

  constructor(scope: Construct, id: string, props: EcsSetupStackProps) {
    super(scope, id, props)

    this.#ssmParameterStore = new SsmParameterStore(
      this,
      props.context.serviceName,
    )

    /*
     * ECR
     */
    const ecrRepository = new ecr.Repository(this, 'EcrRepository', {
      removalPolicy: RemovalPolicy.DESTROY,
    })

    this.#ssmParameterStore.createStringParameter(
      'EcrRepositoryUri',
      ecrRepository.repositoryUri,
    )

    /*
     * ECS
     */
    const vpcId = this.#ssmParameterStore.StringParameter('VpcId')
    const vpcAvailabilityZones = this.#ssmParameterStore.StringListParameter(
      'VpcAvailabilityZones',
    )
    const subnetIdsPublic =
      this.#ssmParameterStore.StringListParameter('SubnetIdsPublic')
    const subnetIdsPrivate =
      this.#ssmParameterStore.StringListParameter('SubnetIdsPrivate')
    const vpc = ec2.Vpc.fromVpcAttributes(this, 'Vpc', {
      vpcId: vpcId,
      availabilityZones: vpcAvailabilityZones,
      publicSubnetIds: subnetIdsPublic,
      privateSubnetIds: subnetIdsPrivate,
    })

    const ecsCluster = new ecs.Cluster(this, 'EcsCluster', {
      vpc: vpc,
      containerInsights: true,
    })

    this.#ssmParameterStore.createStringParameter(
      'EcsClusterName',
      ecsCluster.clusterName,
    )
    // NOTE: ecs service will be created later
    this.#ssmParameterStore.createStringParameter(
      'EcsServiceNameApplication',
      `${props.context.serviceName}-application`,
    )

    const iamRoleEcsTask = new iam.Role(this, 'IamRoleEcsTask', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    })
    const iamRoleEcsTaskExecution = new iam.Role(
      this,
      'IamRoleEcsTaskExecution',
      {
        assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
        managedPolicies: [
          iam.ManagedPolicy.fromAwsManagedPolicyName(
            'service-role/AmazonECSTaskExecutionRolePolicy',
          ),
        ],
      },
    )

    NagSuppressions.addResourceSuppressions(iamRoleEcsTaskExecution, [
      { id: 'AwsSolutions-IAM4', reason: 'use recommended policy' },
    ])

    this.#ssmParameterStore.createStringParameter(
      'IamRoleArnEcsTask',
      iamRoleEcsTask.roleArn,
    )
    this.#ssmParameterStore.createStringParameter(
      'IamRoleArnEcsTaskExecution',
      iamRoleEcsTaskExecution.roleArn,
    )

    /*
     * CloudWatch Logs
     */
    const logGroupApplication = new logs.LogGroup(this, 'LogGroupApplication', {
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: RemovalPolicy.DESTROY,
    })

    this.#ssmParameterStore.createStringParameter(
      'LogGroupNameApplication',
      logGroupApplication.logGroupName,
    )
  }
}
