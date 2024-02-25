#!/usr/bin/env node

import 'source-map-support/register'

import { App, Aspects, CliCredentialsStackSynthesizer } from 'aws-cdk-lib'
import { AwsSolutionsChecks } from 'cdk-nag'

import { EcsSetupStack } from '../lib/stacks/ecs-setup'
import { LoadBalancerStack } from '../lib/stacks/load-balancer'
import { NetworkStack } from '../lib/stacks/network'

import type { Context } from '../lib/types/context'

const app = new App()
Aspects.of(app).add(new AwsSolutionsChecks())

const context: Context = {
  serviceName: app.node.getContext('serviceName'),
  network: app.node.getContext('network'),
  domainName: app.node.getContext('domainName'),
  application: app.node.getContext('application'),
}

new NetworkStack(app, 'NetworkStack', {
  stackName: `${context.serviceName}-network-stack`,
  context,
  synthesizer: new CliCredentialsStackSynthesizer(),
})

new LoadBalancerStack(app, 'LoadBalancerStack', {
  stackName: `${context.serviceName}-load-balancer-stack`,
  context,
  synthesizer: new CliCredentialsStackSynthesizer(),
})

new EcsSetupStack(app, 'EcsSetupStack', {
  stackName: `${context.serviceName}-ecs-setup-stack`,
  context,
  synthesizer: new CliCredentialsStackSynthesizer(),
})