#!/usr/bin/env node

import 'source-map-support/register'

import { App, CliCredentialsStackSynthesizer } from 'aws-cdk-lib'

import { NetworkStack } from '../lib/stacks/network'

import type { Context } from '../lib/types/context'

const app = new App()

const context: Context = {
  serviceName: app.node.getContext('serviceName'),
  network: app.node.getContext('network'),
}

new NetworkStack(app, 'NetworkStack', {
  stackName: `${context.serviceName}-network-stack`,
  context,
  synthesizer: new CliCredentialsStackSynthesizer(),
})
