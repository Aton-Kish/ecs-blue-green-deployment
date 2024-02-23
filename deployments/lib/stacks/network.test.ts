import { App, CliCredentialsStackSynthesizer } from 'aws-cdk-lib'
import { Template } from 'aws-cdk-lib/assertions'

import CdkJson from '../../cdk.json'

import { NetworkStack } from './network'

import type { Context } from '../types/context'

const context = CdkJson.context as unknown as Context

test('snapshot test', () => {
  const app = new App()
  const stack = new NetworkStack(app, 'NetworkStack', {
    context,
    synthesizer: new CliCredentialsStackSynthesizer(),
  })
  const template = Template.fromStack(stack)
  expect(template.toJSON()).toMatchSnapshot()
})
