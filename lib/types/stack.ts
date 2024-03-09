import type { Context } from './context'
import type { CliCredentialsStackSynthesizer, StackProps } from 'aws-cdk-lib'

export interface BaseStackProps extends StackProps {
  context: Context
  synthesizer: CliCredentialsStackSynthesizer
}
