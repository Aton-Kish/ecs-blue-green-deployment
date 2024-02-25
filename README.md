# ECS Blue/Green deployment

## setting up

Requirements:

- [Node.js](https://nodejs.org/) (v20.11.0 or higher)
- [ecspresso](https://github.com/kayac/ecspresso) (v2.3.2 or higher)

```shell
corepack enable
corepack pnpm install
```

## bootstrapping

AWS環境（アカウントとリージョンの組み合わせ）に[CDKブートストラップ](https://docs.aws.amazon.com/ja_jp/cdk/v2/guide/bootstrapping.html)をおこなっていない場合は次のコマンドを実行します:

```shell
corepack pnpm cdk bootstrap
```

## deploy

### `NetworkStack`

```shell
corepack pnpm cdk synth NetworkStack
corepack pnpm cdk diff NetworkStack
corepack pnpm cdk deploy NetworkStack
```

#### DNS委任

DNS委任元にNSレコードを登録してください。登録する値は次のコマンドで取得できます:

```shell
SERVICE_NAME=$(cat cdk.json | jq -r .context.serviceName)
aws ssm get-parameter \
    --name "/${SERVICE_NAME}/deployments/route53-hosted-zone-name-servers" \
    --query Parameter.Value \
    --output text
```

### `LoadBalancerStack`

```shell
corepack pnpm cdk synth LoadBalancerStack
corepack pnpm cdk diff LoadBalancerStack
corepack pnpm cdk deploy LoadBalancerStack
```

### `EcsSetupStack`

```shell
corepack pnpm cdk synth EcsSetupStack
corepack pnpm cdk diff EcsSetupStack
corepack pnpm cdk deploy EcsSetupStack
```

## testing

スナップショットを実行します:

```shell
corepack pnpm test
```

スナップショットを更新する際は次のコマンドを実行します:

```shell
corepack pnpm test -- --updateSnapshot
```
