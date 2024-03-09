import { App, Aspects, CliCredentialsStackSynthesizer } from 'aws-cdk-lib'
import { Annotations, Match, Template } from 'aws-cdk-lib/assertions'
import { AwsSolutionsChecks } from 'cdk-nag'

import CdkJson from '../../cdk.json'

import { NetworkStack } from './network'

import type { Context } from '../types/context'
import type { Stack } from 'aws-cdk-lib'

const context = CdkJson.context as unknown as Context

describe('NetworkStack', () => {
  let app: App
  let stack: Stack

  beforeAll(() => {
    app = new App()
    Aspects.of(app).add(new AwsSolutionsChecks())

    stack = new NetworkStack(app, 'NetworkStack', {
      context,
      synthesizer: new CliCredentialsStackSynthesizer(),
    })
  })

  test('no unsuppressed warnings', () => {
    const warnings = Annotations.fromStack(stack).findWarning(
      '*',
      Match.stringLikeRegexp('AwsSolutions-.*'),
    )
    expect(warnings).toHaveLength(0)
  })

  test('no unsuppressed errors', () => {
    const errors = Annotations.fromStack(stack).findError(
      '*',
      Match.stringLikeRegexp('AwsSolutions-.*'),
    )
    expect(errors).toHaveLength(0)
  })

  test('snapshot test', () => {
    const template = Template.fromStack(stack)
    expect(template.toJSON()).toMatchSnapshot()
  })
})
