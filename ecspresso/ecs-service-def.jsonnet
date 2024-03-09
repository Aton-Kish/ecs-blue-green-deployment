local cdkJson = import '../cdk.json';
local serviceName = cdkJson.context.serviceName;

{
  launchType: 'FARGATE',
  platformFamily: 'Linux',
  platformVersion: 'LATEST',

  schedulingStrategy: 'REPLICA',
  desiredCount: 1,
  deploymentController: {
    type: 'CODE_DEPLOY',
  },

  networkConfiguration: {
    awsvpcConfiguration: {
      subnets: [
        '{{ ssm `/%(serviceName)s/deployments/subnet-ids-private` %(index)d }}' % { serviceName: serviceName, index: i }
        for i in std.range(0, std.length(cdkJson.context.network.privateSubnetCidrBlocks) - 1)
      ],
      securityGroups: [
        '{{ ssm `/%(serviceName)s/deployments/security-group-id-ecs` }}' % { serviceName: serviceName },
      ],
      assignPublicIp: 'DISABLED',
    },
  },

  loadBalancers: [
    {

      containerName: 'application',
      containerPort: cdkJson.context.application.port,
      targetGroupArn: '{{ ssm `/%(serviceName)s/deployments/alb-target-group-arn-blue` }}' % { serviceName: serviceName },
    },
  ],
  healthCheckGracePeriodSeconds: 0,

  enableECSManagedTags: true,
}
