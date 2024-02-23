import * as cdk from 'aws-cdk-lib'
import * as sqs from 'aws-cdk-lib/aws-sqs'
import { Construct } from 'constructs'

export class DeploymentsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    // The code that defines your stack goes here

    // example resource
    const _queue = new sqs.Queue(this, 'DeploymentsQueue', {
      visibilityTimeout: cdk.Duration.seconds(300),
    })
  }
}
