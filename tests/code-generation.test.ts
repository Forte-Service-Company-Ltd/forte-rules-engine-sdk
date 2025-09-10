/// SPDX-License-Identifier: BUSL-1.1
import { expect, test } from 'vitest'
import { generateModifier } from '../src/codeGeneration/generate-solidity'
import { contractHasSecurityOverride, injectModifier } from '../src/codeGeneration/inject-modifier'
import * as fs from 'fs'
import { policyModifierGeneration } from '../src/codeGeneration/code-modification-script'

test('Code Modification test)', () => {
  policyModifierGeneration('./tests/testPolicy.json', './tests/testOutput/TestContract.sol', [])

  fs.readFile('tests/testOutput/TestContract.sol', 'utf-8', (err, data) => {
    if (err) {
      console.error('Error reading file:', err)
      return
    }

    expect(data.includes('checkRulesBeforetransfer(')).toBeTruthy()
  })
})

test('Code Generation test)', () => {
  const policyJSON = `
        {
        "Policy": "Test Policy",
        "Description": "Test Policy Description",
        "PolicyType": "open",
        "CallingFunctions": [
            {
              "name": "transfer(address to, uint256 value)",
              "functionSignature": "transfer(address to, uint256 value)",
              "encodedValues": "address to, uint256 value"
            }
        ],
        "ForeignCalls": [
            {
                "name": "Simple Foreign Call",
                "address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
                "function": "testSig(address)",
                "returnType": "uint256",
                "valuesToPass": "to",
                "mappedTrackerKeyValues": "",
                "callingFunction": "transfer(address to, uint256 value)"
            }
        ], 
        "Trackers": [
        {
            "name": "Simple String Tracker",
            "type": "string",
            "initialValue": "test" 
        }
        ],
        "MappedTrackers": [],
        "Rules": [
            {
                "Name": "Rule A",
                "Description": "Rule A Description",
                "condition": "value > 500",
                "positiveEffects": ["emit Success"],
                "negativeEffects": ["revert()"],
                "callingFunction": "transfer(address to, uint256 value)"
            }
        ]
        }`

  generateModifier(policyJSON, 'tests/testOutput/testFileA.sol')
  injectModifier(
    'transfer',
    'address to, uint256 value, uint256 somethinElse',
    'tests/testOutput/UserContract.sol',
    'tests/testOutput/diff.diff',
    'tests/testOutput/testFileA.sol'
  )
  expect(fs.existsSync('tests/testOutput/diff.diff')).toBeTruthy()
  expect(fs.existsSync('tests/testOutput/testFileA.sol')).toBeTruthy()

  fs.readFile('tests/testOutput/UserContract.sol', 'utf-8', (err, data) => {
    if (err) {
      console.error('Error reading file:', err)
      return
    }

    expect(data.includes('checkRulesBeforetransfer(')).toBeTruthy()

    expect(data.includes('setCallingContractAdmin(')).toBeTruthy()
  })
})

test('Security override detection', () => {
  const singleLineDeclaration = 'function setCallingContractAdmin(address callingContractAdmin) public {}'
  const multiLineDeclaration = `function setCallingContractAdmin(address callingContractAdmin) public {
  }`

  const singleLineDetected = contractHasSecurityOverride(singleLineDeclaration)
  const multiLineDetected = contractHasSecurityOverride(multiLineDeclaration)
  const noDeclarationDetected = contractHasSecurityOverride('function someOtherFunction() public {}')

  expect(singleLineDetected).toBe(true)
  expect(multiLineDetected).toBe(true)
  expect(noDeclarationDetected).toBe(false)
})
