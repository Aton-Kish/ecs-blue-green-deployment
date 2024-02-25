# ECS Blue/Green deployment

## setting up

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
