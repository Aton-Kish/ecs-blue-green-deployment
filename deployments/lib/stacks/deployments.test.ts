import * as cdk from 'aws-cdk-lib'
import { Template } from 'aws-cdk-lib/assertions'

import * as Deployments from './deployments'

// example test. To run these tests, uncomment this file along with the
// example resource in lib/deployments-stack.ts
test('SQS Queue Created', () => {
  const app = new cdk.App()
  // WHEN
  const stack = new Deployments.DeploymentsStack(app, 'MyTestStack')
  // THEN
  const template = Template.fromStack(stack)
  template.hasResourceProperties('AWS::SQS::Queue', {
    VisibilityTimeout: 300,
  })
})

test('Snapshot test', () => {
  const app = new cdk.App()
  const stack = new Deployments.DeploymentsStack(app, 'MyTestStack')
  const template = Template.fromStack(stack)

  expect(template.toJSON()).toMatchSnapshot()
})
