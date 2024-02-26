import {
  Stack,
  aws_applicationautoscaling as applicationautoscaling,
} from 'aws-cdk-lib'

import { SsmParameterStore } from '../resources/ssm-parameter-store'

import type { BaseStackProps } from '../types/stack'
import type { Construct } from 'constructs'

export interface EcsAutoScalingStackProps extends BaseStackProps {}

export class EcsAutoScalingStack extends Stack {
  #ssmParameterStore: SsmParameterStore

  constructor(scope: Construct, id: string, props: EcsAutoScalingStackProps) {
    super(scope, id, props)

    this.#ssmParameterStore = new SsmParameterStore(
      this,
      props.context.serviceName,
    )

    const ecsClusterName =
      this.#ssmParameterStore.stringParameter('EcsClusterName')
    const ecsServiceNameApplication = this.#ssmParameterStore.stringParameter(
      'EcsServiceNameApplication',
    )

    const applicationAutoScalingScalableTarget =
      new applicationautoscaling.ScalableTarget(
        this,
        'ApplicationAutoScalingScalableTarget',
        {
          serviceNamespace: applicationautoscaling.ServiceNamespace.ECS,
          resourceId: `service/${ecsClusterName}/${ecsServiceNameApplication}`,
          scalableDimension: 'ecs:service:DesiredCount',
          minCapacity: props.context.application.autoScaling.minCapacity,
          maxCapacity: props.context.application.autoScaling.maxCapacity,
        },
      )

    new applicationautoscaling.TargetTrackingScalingPolicy(
      this,
      'ApplicationAutoScalingTargetTrackingScalingPolicyEcsServiceAverageCpuUtilization',
      {
        scalingTarget: applicationAutoScalingScalableTarget,
        predefinedMetric:
          applicationautoscaling.PredefinedMetric
            .ECS_SERVICE_AVERAGE_CPU_UTILIZATION,
        targetValue: props.context.application.autoScaling.cpuTargetValue,
      },
    )
  }
}
