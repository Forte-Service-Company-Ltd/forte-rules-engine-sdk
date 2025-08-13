#!/usr/bin/env ts-node
/// SPDX-License-Identifier: BUSL-1.1
import { policyModifierGeneration } from '../src/codeGeneration/code-modification-script'

/**
 * Command-line script to generate policy modifiers
 * Usage: tsx script/generate-policy-modifiers.ts <config-path> <output-file> <file-path-1> [file-path-2] ...
 */
function main() {
  // Parse command line arguments
  const args = process.argv.slice(2)
  console.log(`Arguments received: ${args.join(', ')}`)

  if (args.length < 3) {
    console.error(
      'Usage: tsx script/generate-policy-modifiers.ts <config-path> <output-file> <file-path-1> [file-path-2] ...'
    )
    console.error('')
    console.error('Arguments:')
    console.error('  config-path   Path to the policy JSON configuration file')
    console.error('  output-file   Path where the generated modifier file will be saved')
    console.error('  file-path-*   One or more Solidity (.sol) files to process')
    console.error('')
    console.error('Example:')
    console.error(
      '  tsx script/generate-policy-modifiers.ts policy.json src/RulesEngineIntegration.sol src/ExampleContract.sol'
    )
    process.exit(1)
  }

  const configPath = args[0]
  const outputFile = args[1]
  const filePaths = args.slice(2) // All remaining arguments are file paths

  try {
    policyModifierGeneration(configPath, outputFile, filePaths)
  } catch (error) {
    console.error('Error generating policy modifiers:', error)
    process.exit(1)
  }
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  main()
}
