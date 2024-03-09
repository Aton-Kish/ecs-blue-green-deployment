# ECS Blue/Green deployment

## セットアップ

Requirements:

- [Node.js](https://nodejs.org/) (v20.11.0 or higher)
- [ecspresso](https://github.com/kayac/ecspresso) (v2.3.2 or higher)

```shell
corepack enable
corepack pnpm install
```

## 環境構築

### CDKブートストラッピング

AWS環境（アカウントとリージョンの組み合わせ）に[CDKブートストラップ](https://docs.aws.amazon.com/ja_jp/cdk/v2/guide/bootstrapping.html)をおこなっていない場合は次のコマンドを実行します:

```shell
corepack pnpm cdk bootstrap
```

### CDKで`NetworkStack`をデプロイする

```shell
corepack pnpm cdk synth NetworkStack
corepack pnpm cdk diff NetworkStack
corepack pnpm cdk deploy NetworkStack
```

#### DNSの委任を完了する

DNS委任元にNSレコードを登録してください。登録する値は次のコマンドで取得できます:

```shell
SERVICE_NAME=$(cat cdk.json | jq -r .context.serviceName)
aws ssm get-parameter --query Parameter.Value --output text --name "/${SERVICE_NAME}/deployments/route53-hosted-zone-name-servers"
```

### CDKで`LoadBalancerStack`をデプロイする

```shell
corepack pnpm cdk synth LoadBalancerStack
corepack pnpm cdk diff LoadBalancerStack
corepack pnpm cdk deploy LoadBalancerStack
```

### CDKで`EcsSetupStack`をデプロイする

```shell
corepack pnpm cdk synth EcsSetupStack
corepack pnpm cdk diff EcsSetupStack
corepack pnpm cdk deploy EcsSetupStack
```

#### ECRに最初のイメージを登録する

```shell
SERVICE_NAME=$(cat cdk.json | jq -r .context.serviceName)
ECR_REPOSITORY_URI=$(aws ssm get-parameter --query Parameter.Value --output text --name "/${SERVICE_NAME}/deployments/ecr-repository-uri")
ECR_HOSTNAME="${ECR_REPOSITORY_URI%/*}"

COLOR="blue"
DATE="$(date --utc "+%Y-%m-%dT%H:%M:%SZ")"
IMAGE_TAG="latest"

docker image build --tag "${ECR_REPOSITORY_URI}:${IMAGE_TAG}" --build-arg COLOR="${COLOR}" --build-arg DATE="${DATE}" .
aws ecr get-login-password | docker login --username AWS --password-stdin "${ECR_HOSTNAME}"
docker image push "${ECR_REPOSITORY_URI}:${IMAGE_TAG}"
```

### ecspressoでECSサービスをデプロイする

```shell
export ECSPRESSO_AWS_REGION=$(aws configure get region)
export ECSPRESSO_ECS_CLUSTER_NAME=$(aws ssm get-parameter --query Parameter.Value --output text --name "/${SERVICE_NAME}/deployments/ecs-cluster-name")
export ECSPRESSO_ECS_SERVICE_NAME=$(aws ssm get-parameter --query Parameter.Value --output text --name "/${SERVICE_NAME}/deployments/ecs-service-name-application")
export ECSPRESSO_IMAGE_TAG="latest"

ecspresso --config ecspresso/ecspresso.yaml deploy --dry-run
ecspresso --config ecspresso/ecspresso.yaml deploy
```

環境変数を削除する場合は以下のコマンドを実行します:

```shell
unset ECSPRESSO_AWS_REGION
unset ECSPRESSO_ECS_CLUSTER_NAME
unset ECSPRESSO_ECS_SERVICE_NAME
unset ECSPRESSO_IMAGE_TAG
```

### CDKで`EcsAutoScalingStack`をデプロイする

```shell
corepack pnpm cdk synth EcsAutoScalingStack
corepack pnpm cdk diff EcsAutoScalingStack
corepack pnpm cdk deploy EcsAutoScalingStack
```

### ecspressoでECS Blue/Greenデプロイのためのタスク定義を生成する

```shell
export ECSPRESSO_AWS_REGION=$(aws configure get region)
export ECSPRESSO_ECS_CLUSTER_NAME=$(aws ssm get-parameter --query Parameter.Value --output text --name "/${SERVICE_NAME}/deployments/ecs-cluster-name")
export ECSPRESSO_ECS_SERVICE_NAME=$(aws ssm get-parameter --query Parameter.Value --output text --name "/${SERVICE_NAME}/deployments/ecs-service-name-application")

mkdir -p codedeploy
ecspresso --config ecspresso/ecspresso.yaml render taskdef | jq '.containerDefinitions[0].image |= "<IMAGE>"' | jq 'del(.ipcMode, .pidMode)' > codedeploy/taskdef.json
```

環境変数を削除する場合は以下のコマンドを実行します:

```shell
unset ECSPRESSO_AWS_REGION
unset ECSPRESSO_ECS_CLUSTER_NAME
unset ECSPRESSO_ECS_SERVICE_NAME
```

### CDKで`ReleasePipelineStack`をデプロイする

```shell
corepack pnpm cdk synth ReleasePipelineStack
corepack pnpm cdk diff ReleasePipelineStack
corepack pnpm cdk deploy ReleasePipelineStack
```

#### CodePipelineとGitHubを接続する

[AWSマネジメントコンソール](https://console.aws.amazon.com/codesuite/settings/connections)からGitHubとの接続を完了してください。

## testing

スナップショットを実行します:

```shell
corepack pnpm test
```

スナップショットを更新する際は次のコマンドを実行します:

```shell
corepack pnpm test -- --updateSnapshot
```
