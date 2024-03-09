import {
  Arn,
  CfnElement,
  RemovalPolicy,
  Stack,
  aws_codebuild as codebuild,
  aws_codedeploy as codedeploy,
  aws_codepipeline as codepipeline,
  aws_codepipeline_actions as codepipelineActions,
  aws_codestarconnections as codestarconnections,
  aws_ec2 as ec2,
  aws_ecs as ecs,
  aws_elasticloadbalancingv2 as elbv2,
  aws_iam as iam,
  aws_logs as logs,
  aws_s3 as s3,
} from 'aws-cdk-lib'
import { NagSuppressions } from 'cdk-nag'

import { SsmParameterStore } from '../resources/ssm-parameter-store'

import type { BaseStackProps } from '../types/stack'
import type { Construct } from 'constructs'

export interface ReleasePipelineStackProps extends BaseStackProps {}

export class ReleasePipelineStack extends Stack {
  #ssmParameterStore: SsmParameterStore

  constructor(scope: Construct, id: string, props: ReleasePipelineStackProps) {
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
    const ecsServiceArnApplication = Arn.format(
      {
        service: 'ecs',
        resource: 'service',
        resourceName: `${ecsClusterName}/${ecsServiceNameApplication}`,
      },
      this,
    )

    /*
     * CodeBuild
     */
    const logGroupCodeBuildProject = new logs.LogGroup(
      this,
      'LogGroupCodeBuildProject',
      {
        retention: logs.RetentionDays.ONE_WEEK,
        removalPolicy: RemovalPolicy.DESTROY,
      },
    )

    const codeBuildProject = new codebuild.PipelineProject(
      this,
      'CodeBuildProject',
      {
        environment: {
          buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
          privileged: true,
          computeType: codebuild.ComputeType.SMALL,
          environmentVariables: {
            SSM_PARAMETER_NAME_ECR_REPOSITORY_URI: {
              type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
              value: this.#ssmParameterStore.parameterName('EcrRepositoryUri'),
            },
            SSM_PARAMETER_NAME_ECS_CLUSTER_NAME: {
              type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
              value: this.#ssmParameterStore.parameterName('EcsClusterName'),
            },
            SSM_PARAMETER_NAME_ECS_SERVICE_NAME_APPLICATION: {
              type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
              value: this.#ssmParameterStore.parameterName(
                'EcsServiceNameApplication',
              ),
            },
            SSM_PARAMETER_NAME_ALB_TARGET_GROUP_ARN_BLUE: {
              type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
              value: this.#ssmParameterStore.parameterName(
                'AlbTargetGroupArnBlue',
              ),
            },
            SSM_PARAMETER_NAME_ALB_TARGET_GROUP_ARN_GREEN: {
              type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
              value: this.#ssmParameterStore.parameterName(
                'AlbTargetGroupArnGreen',
              ),
            },
          },
        },
        buildSpec: codebuild.BuildSpec.fromObjectToYaml({
          version: '0.2',
          env: {
            shell: 'bash',
          },
          phases: {
            install: {
              'runtime-versions': {
                nodejs: '20',
              },
            },
            pre_build: {
              commands: [
                'ECR_REPOSITORY_URI="$(aws ssm get-parameter --name "${SSM_PARAMETER_NAME_ECR_REPOSITORY_URI}" --query Parameter.Value --output text)"',
                'ECR_HOSTNAME="${ECR_REPOSITORY_URI%/*}"',
                'ECS_CLUSTER_NAME="$(aws ssm get-parameter --name "${SSM_PARAMETER_NAME_ECS_CLUSTER_NAME}" --query Parameter.Value --output text)"',
                'ECS_SERVICE_NAME_APPLICATION="$(aws ssm get-parameter --name "${SSM_PARAMETER_NAME_ECS_SERVICE_NAME_APPLICATION}" --query Parameter.Value --output text)"',
                'ALB_TARGET_GROUP_ARN_BLUE="$(aws ssm get-parameter --name "${SSM_PARAMETER_NAME_ALB_TARGET_GROUP_ARN_BLUE}" --query Parameter.Value --output text)"',
                'ALB_TARGET_GROUP_ARN_GREEN="$(aws ssm get-parameter --name "${SSM_PARAMETER_NAME_ALB_TARGET_GROUP_ARN_GREEN}" --query Parameter.Value --output text)"',
                'ALB_TARGET_GROUP_ARN_ASSOCIATED_WITH_ECS="$(aws ecs describe-services --cluster "${ECS_CLUSTER_NAME}" --services "${ECS_SERVICE_NAME_APPLICATION}" --query services[].loadBalancers[].targetGroupArn --output text)"',
                'test "${ALB_TARGET_GROUP_ARN_ASSOCIATED_WITH_ECS}" == "${ALB_TARGET_GROUP_ARN_BLUE}" && COLOR="green" || :',
                'test "${ALB_TARGET_GROUP_ARN_ASSOCIATED_WITH_ECS}" == "${ALB_TARGET_GROUP_ARN_GREEN}" && COLOR="blue" || :',
                'DATE="$(date --utc "+%Y-%m-%dT%H:%M:%SZ")"',
                'IMAGE_TAG="${CODEBUILD_RESOLVED_SOURCE_VERSION}"',
              ],
            },
            build: {
              commands: [
                'docker image build --tag "${ECR_REPOSITORY_URI}:${IMAGE_TAG}" --build-arg COLOR="${COLOR}" --build-arg DATE="${DATE}" .',
              ],
            },
            post_build: {
              commands: [
                'aws ecr get-login-password | docker login --username AWS --password-stdin "${ECR_HOSTNAME}"',
                'docker image push "${ECR_REPOSITORY_URI}:${IMAGE_TAG}"',
                'echo {} | jq --arg IMAGE_URI "${ECR_REPOSITORY_URI}:${IMAGE_TAG}" \'.ImageURI = $IMAGE_URI\' > codedeploy/imageDetail.json',
              ],
            },
          },
          artifacts: {
            'base-directory': 'codedeploy',
            files: ['appspec.yaml', 'taskdef.json', 'imageDetail.json'],
          },
        }),
        logging: {
          cloudWatch: {
            logGroup: logGroupCodeBuildProject,
          },
        },
      },
    )
    codeBuildProject.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['ssm:GetParameter'],
        resources: [
          this.#ssmParameterStore.parameterArn('EcrRepositoryUri'),
          this.#ssmParameterStore.parameterArn('EcsClusterName'),
          this.#ssmParameterStore.parameterArn('EcsServiceNameApplication'),
          this.#ssmParameterStore.parameterArn('AlbTargetGroupArnBlue'),
          this.#ssmParameterStore.parameterArn('AlbTargetGroupArnGreen'),
        ],
      }),
    )
    codeBuildProject.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['ecs:DescribeServices'],
        resources: [ecsServiceArnApplication],
      }),
    )
    codeBuildProject.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['ecr:GetAuthorizationToken'],
        resources: ['*'],
      }),
    )
    codeBuildProject.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'ecr:CompleteLayerUpload',
          'ecr:UploadLayerPart',
          'ecr:InitiateLayerUpload',
          'ecr:BatchCheckLayerAvailability',
          'ecr:PutImage',
        ],
        resources: [
          this.#ssmParameterStore.stringParameter('EcrRepositoryArn'),
        ],
      }),
    )

    NagSuppressions.addResourceSuppressions(codeBuildProject, [
      {
        id: 'AwsSolutions-CB3',
        reason: 'it is necessary to build docker image',
      },
      {
        id: 'AwsSolutions-CB4',
        reason: 'kms encryption is not required',
      },
    ])

    /*
     * CodeDeploy
     */
    const codeDeployApplication = new codedeploy.EcsApplication(
      this,
      'CodeDeployApplication',
    )

    const ecsServiceApplication = ecs.FargateService.fromServiceArnWithCluster(
      this,
      'EcsServiceApplication',
      ecsServiceArnApplication,
    )

    const albTargetGroupArnBlue = this.#ssmParameterStore.stringParameter(
      'AlbTargetGroupArnBlue',
    )
    const albTargetGroupArnGreen = this.#ssmParameterStore.stringParameter(
      'AlbTargetGroupArnGreen',
    )
    const albTargetGroupBlue =
      elbv2.ApplicationTargetGroup.fromTargetGroupAttributes(
        this,
        'AlbTargetGroupBlue',
        {
          targetGroupArn: albTargetGroupArnBlue,
        },
      )
    const albTargetGroupGreen =
      elbv2.ApplicationTargetGroup.fromTargetGroupAttributes(
        this,
        'AlbTargetGroupGreen',
        {
          targetGroupArn: albTargetGroupArnGreen,
        },
      )

    const securityGroupIdEcs =
      this.#ssmParameterStore.stringParameter('SecurityGroupIdEcs')
    const securityGroupEcs = ec2.SecurityGroup.fromSecurityGroupId(
      this,
      'SecurityGroupEcs',
      securityGroupIdEcs,
    )

    const albListenerArnProd =
      this.#ssmParameterStore.stringParameter('AlbListenerArnProd')
    const albListenerArnTest =
      this.#ssmParameterStore.stringParameter('AlbListenerArnTest')
    const albListenerProd =
      elbv2.ApplicationListener.fromApplicationListenerAttributes(
        this,
        'AlbListenerProd',
        {
          listenerArn: albListenerArnProd,
          securityGroup: securityGroupEcs,
        },
      )
    const albListenerTest =
      elbv2.ApplicationListener.fromApplicationListenerAttributes(
        this,
        'AlbListenerTest',
        {
          listenerArn: albListenerArnTest,
          securityGroup: securityGroupEcs,
        },
      )

    const iamRoleCodeDeployDeploymentGroup = new iam.Role(
      this,
      'IamRoleCodeDeployDeploymentGroup',
      {
        assumedBy: new iam.ServicePrincipal('codedeploy.amazonaws.com'),
        managedPolicies: [
          iam.ManagedPolicy.fromAwsManagedPolicyName('AWSCodeDeployRoleForECS'),
        ],
      },
    )

    NagSuppressions.addResourceSuppressions(iamRoleCodeDeployDeploymentGroup, [
      {
        id: 'AwsSolutions-IAM4',
        appliesTo: [
          'Policy::arn:<AWS::Partition>:iam::aws:policy/AWSCodeDeployRoleForECS',
        ],
        reason: 'use recommended policy',
      },
    ])

    const codeDeployDeploymentGroup = new codedeploy.EcsDeploymentGroup(
      this,
      'CodeDeployDeploymentGroup',
      {
        application: codeDeployApplication,
        role: iamRoleCodeDeployDeploymentGroup,
        service: ecsServiceApplication,
        blueGreenDeploymentConfig: {
          listener: albListenerProd,
          testListener: albListenerTest,
          blueTargetGroup: albTargetGroupBlue,
          greenTargetGroup: albTargetGroupGreen,
        },
        deploymentConfig: codedeploy.EcsDeploymentConfig.ALL_AT_ONCE,
        autoRollback: {
          failedDeployment: false,
          stoppedDeployment: false,
          deploymentInAlarm: false,
        },
      },
    )

    this.#ssmParameterStore.createStringParameter(
      'CodeDeployApplicationName',
      codeDeployApplication.applicationName,
    )
    this.#ssmParameterStore.createStringParameter(
      'CodeDeployDeploymentGroupName',
      codeDeployDeploymentGroup.deploymentGroupName,
    )

    /*
     * CodePipeline
     */
    const codeStarConnectionGitHub = new codestarconnections.CfnConnection(
      this,
      'CodeStarConnectionGitHub',
      {
        connectionName: `${props.context.serviceName}-github`,
        providerType: 'GitHub',
      },
    )

    const s3BucketArtifact = new s3.Bucket(this, 'S3BucketArtifact', {
      removalPolicy: RemovalPolicy.DESTROY,
      enforceSSL: true,
    })

    NagSuppressions.addResourceSuppressions(s3BucketArtifact, [
      {
        id: 'AwsSolutions-S1',
        reason: 'server access logs is not required',
      },
    ])

    const codePipelineArtifactSource = new codepipeline.Artifact('source')
    const codePipelineArtifactDeploy = new codepipeline.Artifact('deploy')

    const codePipelineSourceAction =
      new codepipelineActions.CodeStarConnectionsSourceAction({
        actionName: 'source',
        output: codePipelineArtifactSource,
        connectionArn: codeStarConnectionGitHub.attrConnectionArn,
        owner: props.context.pipeline.github.owner,
        repo: props.context.pipeline.github.repo,
        branch: 'feature/init',
      })
    const codePipelineBuildAction = new codepipelineActions.CodeBuildAction({
      actionName: 'build',
      project: codeBuildProject,
      input: codePipelineArtifactSource,
      outputs: [codePipelineArtifactDeploy],
    })
    const codePipelineDeployAction =
      new codepipelineActions.CodeDeployEcsDeployAction({
        actionName: 'deploy',
        deploymentGroup: codeDeployDeploymentGroup,
        appSpecTemplateFile: new codepipeline.ArtifactPath(
          codePipelineArtifactDeploy,
          'appspec.yaml',
        ),
        taskDefinitionTemplateFile: new codepipeline.ArtifactPath(
          codePipelineArtifactDeploy,
          'taskdef.json',
        ),
        containerImageInputs: [{ input: codePipelineArtifactDeploy }],
      })

    const codePipeline = new codepipeline.Pipeline(this, 'CodePipeline', {
      pipelineType: codepipeline.PipelineType.V2,
      artifactBucket: s3BucketArtifact,
      triggers: [
        {
          providerType: codepipeline.ProviderType.CODE_STAR_SOURCE_CONNECTION,
          gitConfiguration: {
            sourceAction: codePipelineSourceAction,
            pushFilter: [
              {
                tagsIncludes: ['*'],
                tagsExcludes: [],
              },
            ],
          },
        },
      ],
      stages: [
        {
          stageName: 'source',
          actions: [codePipelineSourceAction],
        },
        {
          stageName: 'build',
          actions: [codePipelineBuildAction],
        },
        {
          stageName: 'deploy',
          actions: [codePipelineDeployAction],
        },
      ],
    })

    const logicalIdCodeBuildProject = this.getLogicalId(
      codeBuildProject.node.defaultChild as CfnElement,
    )
    const logicalIdS3BucketArtifact = this.getLogicalId(
      s3BucketArtifact.node.defaultChild as CfnElement,
    )

    const iamPolicyCodeBuildProject = codeBuildProject.node
      .findChild('Role')
      .node.findChild('DefaultPolicy') as iam.Policy
    NagSuppressions.addResourceSuppressions(iamPolicyCodeBuildProject, [
      {
        id: 'AwsSolutions-IAM5',
        appliesTo: [
          `Resource::arn:<AWS::Partition>:logs:<AWS::Region>:<AWS::AccountId>:log-group:/aws/codebuild/<${logicalIdCodeBuildProject}>:*`,
        ],
        reason: 'writing logs is restricted to a specific CodeBuild project',
      },
      {
        id: 'AwsSolutions-IAM5',
        appliesTo: [
          `Resource::arn:<AWS::Partition>:codebuild:<AWS::Region>:<AWS::AccountId>:report-group/<${logicalIdCodeBuildProject}>-*`,
        ],
        reason:
          'writing build reports is restricted to a specific CodeBuild project',
      },
      {
        id: 'AwsSolutions-IAM5',
        appliesTo: ['Resource::*'],
        reason: '`ecr:GetAuthorizationToken` can not be restricted by resource',
      },
      {
        id: 'AwsSolutions-IAM5',
        appliesTo: [
          'Action::s3:Abort*',
          'Action::s3:DeleteObject*',
          'Action::s3:GetBucket*',
          'Action::s3:GetObject*',
          'Action::s3:List*',
        ],
        reason:
          'the operation is restricted to the S3 bucket for CodePipeline artifacts',
      },
      {
        id: 'AwsSolutions-IAM5',
        appliesTo: [`Resource::<${logicalIdS3BucketArtifact}.Arn>/*`],
        reason: 'it is necessary to operate on any S3 object',
      },
    ])

    const iamPolicyCodePipeline = codePipeline.node
      .findChild('Role')
      .node.findChild('DefaultPolicy') as iam.Policy
    NagSuppressions.addResourceSuppressions(iamPolicyCodePipeline, [
      {
        id: 'AwsSolutions-IAM5',
        appliesTo: [
          'Action::s3:Abort*',
          'Action::s3:DeleteObject*',
          'Action::s3:GetBucket*',
          'Action::s3:GetObject*',
          'Action::s3:List*',
        ],
        reason:
          'the operation is restricted to the S3 bucket for CodePipeline artifacts',
      },
      {
        id: 'AwsSolutions-IAM5',
        appliesTo: [`Resource::<${logicalIdS3BucketArtifact}.Arn>/*`],
        reason: 'it is necessary to operate on any S3 object',
      },
    ])

    const iamPolicyCodePipelineSourceAction = codePipeline.node
      .findChild('source')
      .node.findChild('source')
      .node.findChild('CodePipelineActionRole')
      .node.findChild('DefaultPolicy') as iam.Policy
    NagSuppressions.addResourceSuppressions(iamPolicyCodePipelineSourceAction, [
      {
        id: 'AwsSolutions-IAM5',
        appliesTo: [
          'Action::s3:Abort*',
          'Action::s3:DeleteObject*',
          'Action::s3:GetBucket*',
          'Action::s3:GetObject*',
          'Action::s3:List*',
        ],
        reason:
          'the operation is restricted to the S3 bucket for CodePipeline artifacts',
      },
      {
        id: 'AwsSolutions-IAM5',
        appliesTo: [`Resource::<${logicalIdS3BucketArtifact}.Arn>/*`],
        reason: 'it is necessary to operate on any S3 object',
      },
    ])

    const iamPolicyCodePipelineDeployAction = codePipeline.node
      .findChild('deploy')
      .node.findChild('deploy')
      .node.findChild('CodePipelineActionRole')
      .node.findChild('DefaultPolicy') as iam.Policy
    NagSuppressions.addResourceSuppressions(iamPolicyCodePipelineDeployAction, [
      {
        id: 'AwsSolutions-IAM5',
        appliesTo: ['Resource::*'],
        reason:
          '`ecs:RegisterTaskDefinition` can not be restricted by resource; `iam:PassRole` is restricted to `ecs-tasks.amazonaws.com` only',
      },
      {
        id: 'AwsSolutions-IAM5',
        appliesTo: [
          'Action::s3:GetBucket*',
          'Action::s3:GetObject*',
          'Action::s3:List*',
        ],
        reason:
          'the operation is restricted to the S3 bucket for CodePipeline artifacts',
      },
      {
        id: 'AwsSolutions-IAM5',
        appliesTo: [`Resource::<${logicalIdS3BucketArtifact}.Arn>/*`],
        reason: 'it is necessary to operate on any S3 object',
      },
    ])
  }
}
