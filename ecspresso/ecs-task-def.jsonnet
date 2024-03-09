local cdkJson = import '../cdk.json';
local serviceName = cdkJson.context.serviceName;

{
  family: '%(serviceName)s-application' % { serviceName: serviceName },

  requiresCompatibilities: ['FARGATE'],
  runtimePlatform: {
    cpuArchitecture: 'X86_64',
    operatingSystemFamily: 'LINUX',
  },
  networkMode: 'awsvpc',
  cpu: '256',
  memory: '512',
  taskRoleArn: '{{ ssm `/%(serviceName)s/deployments/iam-role-arn-ecs-task` }}' % { serviceName: serviceName },
  executionRoleArn: '{{ ssm `/%(serviceName)s/deployments/iam-role-arn-ecs-task-execution` }}' % { serviceName: serviceName },

  containerDefinitions: [
    {
      name: 'application',
      image: '{{ ssm `/%(serviceName)s/deployments/ecr-repository-uri` }}:{{ env `ECSPRESSO_IMAGE_TAG` `latest` }}' % { serviceName: serviceName },
      essential: true,
      portMappings: [
        {
          containerPort: cdkJson.context.application.port,
          protocol: 'tcp',
          appProtocol: 'http',
        },
      ],
      cpu: 0,
      logConfiguration: {
        logDriver: 'awslogs',
        options: {
          'awslogs-group': '{{ ssm `/%(serviceName)s/deployments/log-group-name-application` }}' % { serviceName: serviceName },
          'awslogs-region': '{{ must_env `ECSPRESSO_AWS_REGION` }}',
          'awslogs-stream-prefix': 'ecs',
        },
      },
    },
  ],
}
