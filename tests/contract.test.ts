/// SPDX-License-Identifier: BUSL-1.1
import { getAddress, toFunctionSelector, toHex } from 'viem'
import { expect, test, describe, beforeAll, beforeEach } from 'vitest'
import { DiamondAddress, connectConfig, createTestConfig, foundryAccountAddress } from '../src/config'
import {
  getRulesEnginePolicyContract,
  getRulesEngineComponentContract,
  getRulesEngineRulesContract,
  getRulesEngineAdminContract,
  getRulesEngineForeignCallContract,
} from '../src/modules/contract-interaction-utils'
import {
  createForeignCall,
  deleteForeignCall,
  updateForeignCall,
  getForeignCall,
  getAllForeignCalls,
} from '../src/modules/foreign-calls'
import { createCallingFunction, deleteCallingFunction, getCallingFunctions } from '../src/modules/calling-functions'
import {
  createPolicy,
  updatePolicy,
  deletePolicy,
  getPolicy,
  policyExists,
  isClosedPolicy,
  closePolicy,
  openPolicy,
  isClosedPolicySubscriber,
  removeClosedPolicySubscriber,
  cementPolicy,
  isCementedPolicy,
  getPolicyMetadata,
  setPolicies,
  appendPolicy,
} from '../src/modules/policy'
import { createRule, getAllRules, updateRule, deleteRule, getRuleMetadata } from '../src/modules/rules'
import {
  createTracker,
  updateTracker,
  getTracker,
  getAllTrackers,
  deleteTracker,
  getTrackerToRuleIds,
  getTrackerMetadata,
} from '../src/modules/trackers'
import { sleep } from '../src/modules/contract-interaction-utils'
import { Config, getBlockNumber } from '@wagmi/core'
import { confirmNewPolicyAdmin, isPolicyAdmin, proposeNewPolicyAdmin } from '../src/modules/admin'
import { trackerArrayType } from '../src/modules/types'
import { PolicyJSON, validatePolicyJSON } from '../src/modules/validation'

// Hardcoded address of the diamond in diamondDeployedAnvilState.json
var config: Config
var client: any
var secondUserConfig: Config
var secondUserClient: any

// Take snapshot
export const takeSnapshot = async () => {
  const snapshotId = await client.snapshot()
  return snapshotId
}

// Revert to snapshot
export const revertToSnapshot = async (snapshotId: any) => {
  await client.revert({ id: snapshotId })
}

// Reusable assertion for Policy data vs. input JSON
function assertPolicyDataMatchesInput(policyData: PolicyJSON, input: any) {
  // Top-level fields
  expect(policyData.Policy).toEqual(input.Policy)
  expect(policyData.Description).toEqual(input.Description)
  expect(policyData.PolicyType).toEqual(input.PolicyType)

  // CallingFunctions
  expect(policyData.CallingFunctions.length).toEqual(input.CallingFunctions.length)
  for (let i = 0; i < input.CallingFunctions.length; i++) {
    const cfIn = input.CallingFunctions[i]
    const cfData = policyData.CallingFunctions[i]
    expect(cfData.functionSignature).toEqual(cfIn.functionSignature)
    expect(cfData.encodedValues).toEqual(cfIn.encodedValues)
    expect(cfData.name).toEqual(cfIn.name)
  }

  // ForeignCalls
  expect(policyData.ForeignCalls.length).toEqual(input.ForeignCalls.length)
  for (let i = 0; i < input.ForeignCalls.length; i++) {
    const fcIn = input.ForeignCalls[i]
    const fcData = policyData.ForeignCalls[i]
    expect(fcData.name).toEqual(fcIn.name)
    expect(fcData.function).toEqual(fcIn.function)
    expect(getAddress(fcData.address)).toEqual(getAddress(fcIn.address))
    expect(fcData.returnType).toEqual(fcIn.returnType)
    expect(fcData.valuesToPass).toEqual(fcIn.valuesToPass)
    expect(fcData.mappedTrackerKeyValues).toEqual(fcIn.mappedTrackerKeyValues)
    expect(fcData.callingFunction).toEqual(fcIn.callingFunction)
  }

  // Trackers
  expect(policyData.Trackers.length).toEqual(input.Trackers.length)
  for (let i = 0; i < input.Trackers.length; i++) {
    const trIn = input.Trackers[i]
    const trData = policyData.Trackers[i]
    expect(trData.name).toEqual(trIn.name)
    expect(trData.type).toEqual(trIn.type)
    expect(trData.initialValue).toEqual(trIn.initialValue)
  }

  // MappedTrackers
  expect(policyData.MappedTrackers.length).toEqual(input.MappedTrackers.length)
  for (let i = 0; i < input.MappedTrackers.length; i++) {
    const mIn = input.MappedTrackers[i]
    const mData = policyData.MappedTrackers[i]
    expect(mData.name).toEqual(mIn.name)
    expect(mData.keyType).toEqual(mIn.keyType)
    expect(mData.valueType).toEqual(mIn.valueType)
    expect(mData.initialKeys).toEqual(mIn.initialKeys)
    expect(mData.initialValues).toEqual(mIn.initialValues)
  }

  // Rules
  expect(policyData.Rules.length).toEqual(input.Rules.length)
  for (let i = 0; i < input.Rules.length; i++) {
    const ruleIn = input.Rules[i]
    const ruleData = policyData.Rules[i]
    expect(ruleData.Name).toEqual(ruleIn.Name)
    expect(ruleData.Description).toEqual(ruleIn.Description)
    expect(ruleData.condition).toEqual(ruleIn.condition)
    expect(ruleData.callingFunction).toEqual(ruleIn.callingFunction)
    expect(ruleData.positiveEffects).toEqual(ruleIn.positiveEffects)
    expect(ruleData.negativeEffects).toEqual(ruleIn.negativeEffects)
  }
}

describe('Rules Engine Interactions', async () => {
  const rulesEngineContract: `0x${string}` = DiamondAddress
  // Vanity address for now, lets try to eventually deploy a real token contract and use that here instead
  const policyApplicant: `0x${string}` = getAddress('0xDeadBeefDeadBeefDeadBeefDeadBeefDeadBeef')
  let snapshotId: `0x${string}`
  config = await createTestConfig()
  client = config.getClient({ chainId: config.chains[0].id })
  secondUserConfig = await createTestConfig(false)
  secondUserClient = secondUserConfig.getClient({
    chainId: secondUserConfig.chains[0].id,
  })

  let emptyPolicyJSON = `
        {
        "Policy": "Test Policy",
        "Description": "This is a test policy",
        "PolicyType": "open",
        "CallingFunctions": [

        ],
        "ForeignCalls": [

        ],
        "Trackers": [

        ],
        "MappedTrackers": [],
        "Rules": [
            ]
            }`

  beforeAll(async () => {
    await connectConfig(config, 0)
    await connectConfig(secondUserConfig, 0)
    snapshotId = await takeSnapshot()
  })

  beforeEach(async () => {
    await revertToSnapshot(snapshotId)
  })

  const options = {
    timeout: 999999,
  }
  test('Can create a new rule', options, async () => {
    var result = await createPolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      getRulesEngineRulesContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client),
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      1,
      emptyPolicyJSON
    )

    let updatedPolicyJSON = `
          {
          "Policy": "Test Policy",
          "Description": "This is a test policy",
          "PolicyType": "open",
          "CallingFunctions": [{
            "name": "addValue",
            "functionSignature": "addValue(uint256 value)",
            "encodedValues": "uint256 value"
          }
          ],
          "ForeignCalls": [

          ],
          "Trackers": [

          ],
          "MappedTrackers": [],
          "Rules": [{
            "Name": "rule A",
            "Description": "rule A Description",
            "condition": "3 + 4 > 5 AND (1 == 1 AND 2 == 2)",
            "positiveEffects": ["revert"],
            "negativeEffects": [],
            "callingFunction": "addValue"
          }
              ]
              }`

    await updatePolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      getRulesEngineRulesContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client),
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      1,
      updatedPolicyJSON,
      result.policyId
    )
    var rules = await getAllRules(config, getRulesEngineRulesContract(rulesEngineContract, client), result.policyId)
    expect(rules?.length).toEqual(1)
  })
  test('Can retrieve Rule Metadata', options, async () => {
    var result = await createPolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      getRulesEngineRulesContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client),
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      1,
      emptyPolicyJSON
    )
    let updatedPolicyJSON = `
          {
          "Policy": "Test Policy",
          "Description": "This is a test policy",
          "PolicyType": "open",
          "CallingFunctions": [{
            "name": "addValue",
            "functionSignature": "addValue(uint256 value)",
            "encodedValues": "uint256 value"
          }
          ],
          "ForeignCalls": [

          ],
          "Trackers": [

          ],
          "MappedTrackers": [],
          "Rules": [{
            "Name": "rule A",
            "Description": "rule A Description",
            "condition": "3 + 4 > 5 AND (1 == 1 AND 2 == 2)",
            "positiveEffects": ["revert"],
            "negativeEffects": [],
            "callingFunction": "addValue"
          }
              ]
              }`

    await updatePolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      getRulesEngineRulesContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client),
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      1,
      updatedPolicyJSON,
      result.policyId
    )
    var meta = await getRuleMetadata(
      config,
      getRulesEngineRulesContract(rulesEngineContract, client),
      result.policyId,
      1
    )
    expect(meta?.ruleName).toEqual('rule A')
    expect(meta?.ruleDescription).toEqual('rule A Description')
  })
  test('Can delete a calling function', options, async () => {
    var result = await createPolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      getRulesEngineRulesContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client),
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      1,
      emptyPolicyJSON
    )
    let updatedPolicyJSON = `
          {
          "Policy": "Test Policy",
          "Description": "This is a test policy",
          "PolicyType": "open",
          "CallingFunctions": [{
            "name": "addValue",
            "functionSignature": "addValue(uint256 value)",
            "encodedValues": "uint256 value"
          }
          ],
          "ForeignCalls": [

          ],
          "Trackers": [

          ],
          "MappedTrackers": [],
          "Rules": [{
            "Name": "rule A",
            "Description": "rule A Description",
            "condition": "3 + 4 > 5 AND (1 == 1 AND 2 == 2)",
            "positiveEffects": ["revert"],
            "negativeEffects": [],
            "callingFunction": "addValue"
          }
              ]
              }`

    await updatePolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      getRulesEngineRulesContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client),
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      1,
      updatedPolicyJSON,
      result.policyId
    )
    var rules = await getAllRules(config, getRulesEngineRulesContract(rulesEngineContract, client), result.policyId)
    expect(rules?.length).toEqual(1)
    await deleteCallingFunction(
      config,
      getRulesEngineComponentContract(rulesEngineContract, client),
      result.policyId,
      toFunctionSelector('addValue(uint256 value)'),
      1
    )
    var newRules = await getAllRules(config, getRulesEngineRulesContract(rulesEngineContract, client), result.policyId)
    expect(newRules?.length).toEqual(0)
  })
  test('Can update an existing rule', options, async () => {
    var result = await createPolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      getRulesEngineRulesContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client),
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      1,
      emptyPolicyJSON
    )
    let updatedPolicyJSON = `
          {
          "Policy": "Test Policy",
          "Description": "This is a test policy",
          "PolicyType": "open",
          "CallingFunctions": [{
            "name": "addValue",
            "functionSignature": "addValue(uint256 value)",
            "encodedValues": "uint256 value"
          }
          ],
          "ForeignCalls": [

          ],
          "Trackers": [

          ],
          "MappedTrackers": [],
          "Rules": [{
            "Name": "rule A",
            "Description": "rule A Description",
            "condition": "3 + 4 > 5 AND (1 == 1 AND 2 == 2)",
            "positiveEffects": ["revert"],
            "negativeEffects": [],
            "callingFunction": "addValue"
          }
              ]
              }`

    await updatePolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      getRulesEngineRulesContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client),
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      1,
      updatedPolicyJSON,
      result.policyId
    )
    var rules = await getAllRules(config, getRulesEngineRulesContract(rulesEngineContract, client), result.policyId)
    expect(rules?.length).toEqual(1)
    var ruleStringB = `{
                    "Name": "rule A",
                    "Description": "rule A Description",
                    "condition": "3 + 4 > 5 AND (value == 1 AND 2 == 2)",
                    "positiveEffects": ["revert"],
                    "negativeEffects": [],
                    "callingFunction": "addValue"
                    }`
    var updatedRuleId = await updateRule(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      getRulesEngineRulesContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client),
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      result.policyId,
      1,
      ruleStringB,
      [
        { id: 1, name: 'testCall', type: 0 },
        { id: 2, name: 'testCallTwo', type: 0 },
      ],
      [],
      1
    )
    expect(updatedRuleId.ruleId).toEqual(1n)
    expect(updatedRuleId.transactionHash).toMatch(/^0x[a-fA-F0-9]{64}$/)
  })
  test('Can delete a rule', options, async () => {
    var result = await createPolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      getRulesEngineRulesContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client),
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      1,
      emptyPolicyJSON
    )
    let updatedPolicyJSON = `
          {
          "Policy": "Test Policy",
          "Description": "This is a test policy",
          "PolicyType": "open",
          "CallingFunctions": [{
            "name": "addValue",
            "functionSignature": "addValue(uint256 value)",
            "encodedValues": "uint256 value"
          }
          ],
          "ForeignCalls": [

          ],
          "Trackers": [

          ],
          "MappedTrackers": [],
          "Rules": [{
            "Name": "rule A",
            "Description": "rule A Description",
            "condition": "3 + 4 > 5 AND (1 == 1 AND 2 == 2)",
            "positiveEffects": ["revert"],
            "negativeEffects": [],
            "callingFunction": "addValue"
          }
              ]
              }`

    await updatePolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      getRulesEngineRulesContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client),
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      1,
      updatedPolicyJSON,
      result.policyId
    )

    var rules = await getAllRules(config, getRulesEngineRulesContract(rulesEngineContract, client), result.policyId)
    expect(rules?.length).toEqual(1)
    await deleteRule(config, getRulesEngineRulesContract(rulesEngineContract, client), result.policyId, 1, 1)
    var rules = await getAllRules(config, getRulesEngineRulesContract(rulesEngineContract, client), result.policyId)
    expect(rules?.length).toEqual(1)
    expect(rules?.[0]?.[0]?.instructionSet?.length ?? 0).toEqual(0)
  })
  test('Can create a new foreign call', options, async () => {
    var result = await createPolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      getRulesEngineRulesContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client),
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      1,
      emptyPolicyJSON
    )

    let updatedPolicyJSON = `
          {
          "Policy": "Test Policy",
          "Description": "This is a test policy",
          "PolicyType": "open",
          "CallingFunctions": [{
            "name": "someFunction",
            "functionSignature": "someFunction(address to, string someString, uint256 value)",
            "encodedValues": "address to, string someString, uint256 value"
          }
          ],
          "ForeignCalls": [

          ],
          "Trackers": [

          ],
          "MappedTrackers": [],
          "Rules": [{
            "Name": "rule A",
            "Description": "rule A Description",
            "condition": "3 + 4 > 5 AND (1 == 1 AND 2 == 2)",
            "positiveEffects": ["revert"],
            "negativeEffects": [],
            "callingFunction": "someFunction"
          }
              ]
              }`

    await updatePolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      getRulesEngineRulesContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client),
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      1,
      updatedPolicyJSON,
      result.policyId
    )

    var fcSyntax = `{
                    "name": "Simple Foreign Call",
                    "address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
                    "function": "testSig(address,string,uint256)",
                    "returnType": "uint256",
                    "valuesToPass": "to, someString, value",
                    "mappedTrackerKeyValues": "",
                    "callingFunction": "someFunction"
                    }`
    var fcId = await createForeignCall(
      config,
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client),
      getRulesEnginePolicyContract(rulesEngineContract, client),
      result.policyId,
      fcSyntax,
      1
    )
    expect(fcId.foreignCallId).toBeGreaterThan(0)
    expect(fcId.transactionHash).toMatch(/^0x[a-fA-F0-9]{64}$/)
    var fcRetrieve = await getForeignCall(
      config,
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      result.policyId,
      fcId.foreignCallId
    )
    expect(fcRetrieve?.foreignCallIndex).toEqual(fcId.foreignCallId)
    var fcAllRetrieve = await getAllForeignCalls(
      config,
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      result.policyId
    )
    expect(fcAllRetrieve?.length).toEqual(1)
  })

  test('Can create a new foreign call with a static array type', options, async () => {
    var result = await createPolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      getRulesEngineRulesContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client),
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      1,
      emptyPolicyJSON
    )

    let updatedPolicyJSON = `
          {
          "Policy": "Test Policy",
          "Description": "This is a test policy",
          "PolicyType": "open",
          "CallingFunctions": [{
            "name": "someFunction",
            "functionSignature": "someFunction(address to, string someString, uint256[] values)",
            "encodedValues": "address to, string someString, uint256[] values"
          }
          ],
          "ForeignCalls": [

          ],
          "Trackers": [

          ],
          "MappedTrackers": [],
          "Rules": [{
            "Name": "rule A",
            "Description": "rule A Description",
            "condition": "3 + 4 > 5 AND (1 == 1 AND 2 == 2)",
            "positiveEffects": ["revert"],
            "negativeEffects": [],
            "callingFunction": "someFunction"
          }
              ]
              }`

    await updatePolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      getRulesEngineRulesContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client),
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      1,
      updatedPolicyJSON,
      result.policyId
    )

    var fcSyntax = `{
                      "name": "Simple Foreign Call",
                      "address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
                      "function": "testSig(address,string,uint256[])",
                      "returnType": "uint256",
                      "valuesToPass": "to, someString, values",
                      "mappedTrackerKeyValues": "",
                      "callingFunction": "someFunction"
                      }`
    var fcId = await createForeignCall(
      config,
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client),
      getRulesEnginePolicyContract(rulesEngineContract, client),
      result.policyId,
      fcSyntax,
      1
    )
    expect(fcId.foreignCallId).toBeGreaterThan(0)
    expect(fcId.transactionHash).toMatch(/^0x[a-fA-F0-9]{64}$/)
    var fcRetrieve = await getForeignCall(
      config,
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      result.policyId,
      fcId.foreignCallId
    )
    expect(fcRetrieve?.foreignCallIndex).toEqual(fcId.foreignCallId)
    expect(fcRetrieve?.parameterTypes[2]).toEqual(6)
  })

  test('Can delete a foreign call', options, async () => {
    var result = await createPolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      getRulesEngineRulesContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client),
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      1,
      emptyPolicyJSON
    )
    let updatedPolicyJSON = `
          {
          "Policy": "Test Policy",
          "Description": "This is a test policy",
          "PolicyType": "open",
          "CallingFunctions": [{
            "name": "someFunction",
            "functionSignature": "someFunction(address to, string someString, uint256[] values)",
            "encodedValues": "address to, string someString, uint256[] values"
          }
          ],
          "ForeignCalls": [

          ],
          "Trackers": [

          ],
          "MappedTrackers": [],
          "Rules": [{
            "Name": "rule A",
            "Description": "rule A Description",
            "condition": "3 + 4 > 5 AND (1 == 1 AND 2 == 2)",
            "positiveEffects": ["revert"],
            "negativeEffects": [],
            "callingFunction": "someFunction"
          }
              ]
              }`

    await updatePolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      getRulesEngineRulesContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client),
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      1,
      updatedPolicyJSON,
      result.policyId
    )
    var fcSyntax = `{
                              "name": "Simple Foreign Call",
                              "address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
                              "function": "testSig(address)",
                              "returnType": "uint256",
                              "valuesToPass": "to",
                              "mappedTrackerKeyValues": "",
                              "callingFunction": "someFunction"
                          }`
    var fcId = await createForeignCall(
      config,
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client),
      getRulesEnginePolicyContract(rulesEngineContract, client),
      result.policyId,
      fcSyntax,
      1
    )
    expect(fcId.foreignCallId).toBeGreaterThan(0)
    expect(fcId.transactionHash).toMatch(/^0x[a-fA-F0-9]{64}$/)
    var fcRetrieve = await getForeignCall(
      config,
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      result.policyId,
      fcId.foreignCallId
    )
    expect(fcRetrieve?.foreignCallIndex).toEqual(fcId.foreignCallId)
    var fcAllRetrieve = await getAllForeignCalls(
      config,
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      result.policyId
    )
    expect(fcAllRetrieve?.length).toEqual(1)
    var ret = await deleteForeignCall(
      config,
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      result.policyId,
      fcId.foreignCallId,
      1
    )
    expect(ret).toEqual(0)
    fcAllRetrieve = await getAllForeignCalls(
      config,
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      result.policyId
    )
    expect(fcAllRetrieve?.length).toEqual(1)
    expect(fcAllRetrieve![0].set).toEqual(false)
  })
  test('Can update an existing foreign call', options, async () => {
    var result = await createPolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      getRulesEngineRulesContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client),
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      1,
      emptyPolicyJSON
    )
    let updatedPolicyJSON = `
          {
          "Policy": "Test Policy",
          "Description": "This is a test policy",
          "PolicyType": "open",
          "CallingFunctions": [{
            "name": "someFunction",
            "functionSignature": "someFunction(address to, string someString, uint256[] values)",
            "encodedValues": "address to, string someString, uint256[] values"
          }
          ],
          "ForeignCalls": [

          ],
          "Trackers": [

          ],
          "MappedTrackers": [],
          "Rules": [{
            "Name": "rule A",
            "Description": "rule A Description",
            "condition": "3 + 4 > 5 AND (1 == 1 AND 2 == 2)",
            "positiveEffects": ["revert"],
            "negativeEffects": [],
            "callingFunction": "someFunction"
          }
              ]
              }`

    await updatePolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      getRulesEngineRulesContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client),
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      1,
      updatedPolicyJSON,
      result.policyId
    )
    var fcSyntax = `{
                          "name": "Simple Foreign Call",
                          "address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
                          "function": "testSig(address)",
                          "returnType": "uint256",
                          "valuesToPass": "to",
                          "mappedTrackerKeyValues": "",
                          "callingFunction": "someFunction"
                      }`
    var fcId = await createForeignCall(
      config,
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client),
      getRulesEnginePolicyContract(rulesEngineContract, client),
      result.policyId,
      fcSyntax,
      1
    )
    var fcRetrieve = await getForeignCall(
      config,
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      result.policyId,
      fcId.foreignCallId
    )
    expect(fcRetrieve?.foreignCallIndex).toEqual(fcId.foreignCallId)
    var fcAllRetrieve = await getAllForeignCalls(
      config,
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      result.policyId
    )
    expect(fcAllRetrieve?.length).toEqual(1)
    var updatedSyntax = `{
                          "name": "Simple Foreign Call",
                          "address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
                          "function": "testSig(address)",
                          "returnType": "uint256",
                          "valuesToPass": "to",
                          "mappedTrackerKeyValues": "",
                          "callingFunction": "someFunction"
                      }`
    var updatedId = await updateForeignCall(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client),
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      result.policyId,
      fcId.foreignCallId,
      updatedSyntax,
      1
    )
    expect(updatedId.foreignCallId).toEqual(fcId.foreignCallId)
    expect(updatedId.transactionHash).toMatch(/^0x[a-fA-F0-9]{64}$/)
  })
  test('Can create a new tracker', options, async () => {
    var trSyntax = `{
                          "name": "Simple String Tracker",
                          "type": "uint256",
                          "initialValue": "4"
                      }`
    var result = await createPolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      getRulesEngineRulesContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client),
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      1,
      emptyPolicyJSON
    )
    expect(result.policyId).toBeGreaterThan(0)
    var trId = await createTracker(
      config,
      getRulesEngineComponentContract(rulesEngineContract, client),
      result.policyId,
      trSyntax,
      1
    )
    expect(trId.trackerId).toBeGreaterThan(0)
    expect(trId.transactionHash).toMatch(/^0x[a-fA-F0-9]{64}$/)
    var trAllRetrieve = await getAllTrackers(
      config,
      getRulesEngineComponentContract(rulesEngineContract, client),
      result.policyId
    )
    expect(trAllRetrieve?.length).toEqual(1)
    var trRetrieve = await getTracker(
      config,
      getRulesEngineComponentContract(rulesEngineContract, client),
      result.policyId,
      trId.trackerId
    )
    expect(trRetrieve?.trackerValue).toEqual('0x0000000000000000000000000000000000000000000000000000000000000004')
  })
  test('Can delete a tracker', options, async () => {
    var trSyntax = `{
                      "name": "Simple String Tracker",
                      "type": "uint256",
                      "initialValue": "4"
                      }`
    var result = await createPolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      getRulesEngineRulesContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client),
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      1,
      emptyPolicyJSON
    )
    expect(result.policyId).toBeGreaterThan(0)
    var trId = await createTracker(
      config,
      getRulesEngineComponentContract(rulesEngineContract, client),
      result.policyId,
      trSyntax,
      1
    )
    expect(trId.trackerId).toBeGreaterThan(0)
    expect(trId.transactionHash).toMatch(/^0x[a-fA-F0-9]{64}$/)
    var trAllRetrieve = await getAllTrackers(
      config,
      getRulesEngineComponentContract(rulesEngineContract, client),
      result.policyId
    )
    expect(trAllRetrieve?.length).toEqual(1)
    var trRetrieve = await getTracker(
      config,
      getRulesEngineComponentContract(rulesEngineContract, client),
      result.policyId,
      trId.trackerId
    )
    expect(trRetrieve?.trackerValue).toEqual('0x0000000000000000000000000000000000000000000000000000000000000004')
    await deleteTracker(config, getRulesEngineComponentContract(rulesEngineContract, client), result.policyId, trId.trackerId, 1)
    var trAllRetrieve = await getAllTrackers(
      config,
      getRulesEngineComponentContract(rulesEngineContract, client),
      result.policyId
    )
    while (true) {
      if (trAllRetrieve![0].set) {
        await sleep(1000)
        trAllRetrieve = await getAllTrackers(
          config,
          getRulesEngineComponentContract(rulesEngineContract, client),
          result.policyId
        )
      } else {
        break
      }
    }
    expect(trAllRetrieve![0].set).toEqual(false)
  })
  test('Can update an existing tracker', options, async () => {
    var trSyntax = `{
                      "name": "Simple String Tracker",
                      "type": "uint256",
                      "initialValue": "4"
                      }`
    var result = await createPolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      getRulesEngineRulesContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client),
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      1,
      emptyPolicyJSON
    )
    expect(result.policyId).toBeGreaterThan(0)
    var trId = await createTracker(
      config,
      getRulesEngineComponentContract(rulesEngineContract, client),
      result.policyId,
      trSyntax,
      1
    )
    expect(trId.trackerId).toBeGreaterThan(0)
    expect(trId.transactionHash).toMatch(/^0x[a-fA-F0-9]{64}$/)
    var trAllRetrieve = await getAllTrackers(
      config,
      getRulesEngineComponentContract(rulesEngineContract, client),
      result.policyId
    )
    expect(trAllRetrieve?.length).toEqual(1)
    var trRetrieve = await getTracker(
      config,
      getRulesEngineComponentContract(rulesEngineContract, client),
      result.policyId,
      trId.trackerId
    )
    expect(trRetrieve?.trackerValue).toEqual('0x0000000000000000000000000000000000000000000000000000000000000004')
    var updatedSyntax = `{
                    "name": "Simple String Tracker",
                    "type": "uint256",
                    "initialValue": "5"
                    }`
    var updateResult = await updateTracker(
      config,
      getRulesEngineComponentContract(rulesEngineContract, client),
      result.policyId,
      trId.trackerId,
      updatedSyntax,
      1
    )
    expect(updateResult.trackerId).toEqual(trId.trackerId)
    expect(updateResult.transactionHash).toMatch(/^0x[a-fA-F0-9]{64}$/)
    var updatedTRRetrieve = await getTracker(
      config,
      getRulesEngineComponentContract(rulesEngineContract, client),
      result.policyId,
      trId.trackerId
    )
    expect(updatedTRRetrieve?.trackerValue).toEqual(
      '0x0000000000000000000000000000000000000000000000000000000000000005'
    )
  })
  test('Can link a tracker to a rule and retrieve rule IDs', options, async () => {
    var policyJSON = `
              {
              "Policy": "Test Policy",
              "Description": "Test Policy Description",
              "PolicyType": "open",
              "CallingFunctions": [
                {
                  "name": "transfer",
                  "functionSignature": "transfer(address to, uint256 value)",
                  "encodedValues": "address to, uint256 value"
                }
              ],
              "ForeignCalls": [
                  {
                      "name": "testSig",
                      "function": "testSig(address)",
                      "address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
                      "returnType": "uint256",
                      "valuesToPass": "to",
                      "mappedTrackerKeyValues": "",
                      "callingFunction": "transfer"
                  }
              ],
              "Trackers": [
              {
                  "name": "testTracker",
                  "type": "string",
                  "initialValue": "test"
              }
              ],
              "MappedTrackers": [],
              "Rules": [
                  {
                      "Name": "Rule A",
                      "Description": "Rule A Description",
                      "condition": "TR:testTracker > 500",
                      "positiveEffects": ["emit \\"Success\\""],
                      "negativeEffects": ["revert()"],
                      "callingFunction": "transfer"
                  }
              ]
              }`
    var result = await createPolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      getRulesEngineRulesContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client),
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      1,
      policyJSON
    )
    expect(result.policyId).toBeGreaterThan(0)

    var resultTR = await getAllTrackers(
      config,
      getRulesEngineComponentContract(rulesEngineContract, client),
      result.policyId
    )
    expect(resultTR?.length).toEqual(1)

    var trId = resultTR![0].trackerIndex
    var ruleIds = await getTrackerToRuleIds(
      config,
      getRulesEngineComponentContract(rulesEngineContract, client),
      result.policyId,
      trId
    )
    expect(ruleIds.length).toEqual(1)
  })
  test('Can retrieve a full simple policy', options, async () => {
    var policyJSON = `
                      {
                      "Policy": "Test Policy",
                      "Description": "Test Policy Description",
                      "PolicyType": "open",
                      "CallingFunctions": [
                        {
                          "name": "transfer",
                          "functionSignature": "transfer(address to, uint256 value)",
                          "encodedValues": "address to, uint256 value"
                        }
                      ],
                      "ForeignCalls": [],
                      "Trackers": [
                      {
                          "name": "testTracker",
                          "type": "string",
                          "initialValue": "1000"
                      }
                      ],
                      "MappedTrackers": [],
                      "Rules": [
                          {
                              "Name": "Rule A",
                              "Description": "Rule A Description",
                              "condition": "value > 500",
                              "positiveEffects": ["revert(\\\"Positive\\\")"],
                              "negativeEffects": ["revert(\\\"Negative\\\")"],
                              "callingFunction": "transfer"
                          }
                      ]
                      }`

    var result = await createPolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      getRulesEngineRulesContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client),
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      1,
      policyJSON
    )
    expect(result.policyId).toBeGreaterThanOrEqual(0)
    var resultFC = await getAllForeignCalls(
      config,
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      result.policyId
    )

    expect(resultFC?.length).toEqual(0)
    var resultTR = await getAllTrackers(
      config,
      getRulesEngineComponentContract(rulesEngineContract, client),
      result.policyId
    )
    expect(resultTR?.length).toEqual(1)
    var retVal = await getPolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      getRulesEngineRulesContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client),
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      result.policyId
    )

    expect(retVal).toBeDefined()

    const input = JSON.parse(policyJSON)
    input.Trackers[0].initialValue = '1000'
    input.Rules[0].negativeEffects = ["revert('Negative')"]
    input.Rules[0].positiveEffects = ["revert('Positive')"]

    // Verify Policy data mirrors input fields
    assertPolicyDataMatchesInput(retVal!, input)
  })

  test('Can retrieve a full policy', options, async () => {
    var policyJSON = `
                     {
                     "Policy": "Test Policy",
                     "Description": "Test Policy Description",
                     "PolicyType": "open",
                     "CallingFunctions": [
                       {
                         "name": "transfer",
                         "functionSignature": "transfer(address to, uint256 value, bool someValue)",
                         "encodedValues": "address to, uint256 value, bool someValue"
                       }
                     ],
                     "ForeignCalls": [
                       {
                           "name": "AnotherTestForeignCall",
                           "address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
                           "function": "AnotherTestForeignCall(address)",
                           "returnType": "uint256",
                           "valuesToPass": "to",
                           "mappedTrackerKeyValues": "",
                           "callingFunction": "transfer"
                       },
                       {
                           "name": "ATestForeignCall",
                           "address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
                           "function": "ATestForeignCall(address, uint256)",
                           "returnType": "uint256",
                           "valuesToPass": "FC:AnotherTestForeignCall, TR:trackerOne",
                           "mappedTrackerKeyValues": "",
                           "callingFunction": "transfer"
                       }

                     ],
                     "Trackers": [
                     {
                      "name": "trackerOne",
                      "type": "uint256",
                      "initialValue": "123"
                      }],
                     "MappedTrackers": [
                         {
                          "name": "mappedTrackerOne",
                          "keyType": "address",
                          "valueType": "uint256",
                          "initialKeys": ["0xb7f8bc63bbcad18155201308c8f3540b07f84f5e"],
                          "initialValues": ["1"]
                          }],
                     "Rules": [
                         {
                             "Name": "Rule A",
                             "Description": "Rule A Description",
                             "condition": "FC:ATestForeignCall > 1000 AND someValue == true",
                             "positiveEffects": ["emit \\"Success\\"", "FC:AnotherTestForeignCall", "TRU:mappedTrackerOne(to) += 1"],
                             "negativeEffects": ["revert(\\"Negative\\")", "TRU:trackerOne += 12"],
                             "callingFunction": "transfer"
                         }
                     ]
                     }`

    var result = await createPolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      getRulesEngineRulesContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client),
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      1,
      policyJSON
    )
    // console.log('Created policy with ID:', result.policyId)
    expect(result.policyId).toBeGreaterThanOrEqual(0)
    var resultFC = await getAllForeignCalls(
      config,
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      result.policyId
    )

    expect(resultFC?.length).toEqual(2)
    var resultTR = await getAllTrackers(
      config,
      getRulesEngineComponentContract(rulesEngineContract, client),
      result.policyId
    )
    expect(resultTR?.length).toEqual(2)
    var retVal = await getPolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      getRulesEngineRulesContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client),
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      result.policyId
    )
    const input = JSON.parse(policyJSON)
    const componentContract = getRulesEngineComponentContract(rulesEngineContract, client)
    const callingFunctions = await getCallingFunctions(config, componentContract, result.policyId)

    expect(callingFunctions[0].parameterTypes.length).toEqual(input.CallingFunctions[0].encodedValues.split(',').length)

    expect(retVal).toBeDefined()

    input.Rules[0].negativeEffects[0] = "revert('Negative')"

    // // Verify Policy data mirrors input fields
    assertPolicyDataMatchesInput(retVal!, input)
  })

  test('Can retrieve policy metadata', options, async () => {
    var policyJSON = `
                          {
                          "Policy": "Test Policy",
                          "Description": "Test Policy Description",
                          "PolicyType": "open",
                          "CallingFunctions": [
                            {
                              "name": "transfer",
                              "functionSignature": "transfer(address to, uint256 value)",
                              "encodedValues": "address to, uint256 value"
                            }
                          ],
                          "ForeignCalls": [
                              {
                                  "name": "testSig",
                                  "function": "testSig(address)",
                                  "address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
                                  "returnType": "uint256",
                                  "valuesToPass": "to",
                                  "mappedTrackerKeyValues": "",
                                  "callingFunction": "transfer"
                              }
                          ],
                          "Trackers": [
                          {
                              "name": "testTracker",
                              "type": "string",
                              "initialValue": "test"
                          }
                          ],
                          "MappedTrackers": [],
                          "Rules": [
                              {
                                  "Name": "Rule A",
                                  "Description": "Rule A Description",
                                  "condition": "TR:testTracker > 500",
                                  "positiveEffects": ["emit \\"Success\\""],
                                  "negativeEffects": ["revert()"],
                                  "callingFunction": "transfer"
                              }
                          ]
                          }`

    var result = await createPolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      getRulesEngineRulesContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client),
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      1,
      policyJSON
    )
    expect(result.policyId).toBeGreaterThanOrEqual(0)
    var retVal = await getPolicyMetadata(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      result.policyId
    )
    expect(retVal?.policyName).toEqual('Test Policy')
    expect(retVal?.policyDescription).toEqual('Test Policy Description')
  })

  test('Can retrieve historical metadata', options, async () => {
    var policyJSON = `
                        {
                        "Policy": "Test Policy",
                        "Description": "Test Policy Description",
                        "PolicyType": "open",
                        "CallingFunctions": [
                          {
                            "name": "transfer",
                            "functionSignature": "transfer(address to, uint256 value)",
                            "encodedValues": "address to, uint256 value"
                          }
                        ],
                        "ForeignCalls": [
                            {
                                "name": "testSig",
                                "function": "testSig(address)",
                                "address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
                                "returnType": "uint256",
                                "valuesToPass": "to",
                                "mappedTrackerKeyValues": "",
                                "callingFunction": "transfer"
                            }
                        ],
                        "Trackers": [
                        {
                            "name": "testTracker",
                            "type": "string",
                            "initialValue": "test"
                        }
                        ],
                        "MappedTrackers": [],
                        "Rules": [
                            {
                                "Name": "Rule A",
                                "Description": "Rule A Description",
                                "condition": "TR:testTracker > 500",
                                "positiveEffects": ["emit \\"Success\\""],
                                "negativeEffects": ["revert()"],
                                "callingFunction": "transfer"
                            }
                        ]
                        }`

    var result = await createPolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      getRulesEngineRulesContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client),
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      1,
      policyJSON
    )

    const blockNumber = await getBlockNumber(config)

    expect(result.policyId).toBeGreaterThanOrEqual(0)
    var retVal = await getPolicyMetadata(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      result.policyId
    )
    expect(retVal?.policyName).toEqual('Test Policy')
    expect(retVal?.policyDescription).toEqual('Test Policy Description')
    var updatedPolicyJSON = `
                        {
                        "Policy": "Updated Policy",
                        "Description": "Updated Policy Description",
                        "PolicyType": "open",
                        "CallingFunctions": [
                          {
                            "name": "transfer",
                            "functionSignature": "transfer(address to, uint256 value)",
                            "encodedValues": "address to, uint256 value"
                          }
                        ],
                        "ForeignCalls": [
                            {
                                "Id": 1,
                                "name": "testSig",
                                "function": "testSig(address)",
                                "address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
                                "returnType": "uint256",
                                "valuesToPass": "to",
                                "mappedTrackerKeyValues": "",
                                "callingFunction": "transfer"
                            }
                        ],
                        "Trackers": [
                        {
                            "Id": 1,
                            "name": "testTracker",
                            "type": "string",
                            "initialValue": "test"
                        }
                        ],
                        "MappedTrackers": [],
                        "Rules": [
                            {
                                "Id": 1,
                                "Name": "Rule A",
                                "Description": "Rule A Description",
                                "condition": "TR:testTracker > 500",
                                "positiveEffects": ["emit \\"Success\\""],
                                "negativeEffects": ["revert()"],
                                "callingFunction": "transfer"
                            }
                        ]
                        }`
    var updateResult = await updatePolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      getRulesEngineRulesContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client),
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      1,
      updatedPolicyJSON,
      result.policyId
    )
    var updatedMetadata = await getPolicyMetadata(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      result.policyId
    )
    expect(updatedMetadata?.policyName).toEqual('Updated Policy')
    expect(updatedMetadata?.policyDescription).toEqual('Updated Policy Description')

    var historicalMetadata = await getPolicyMetadata(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      result.policyId,
      { blockNumber }
    )
    expect(historicalMetadata?.policyName).toEqual('Test Policy')
    expect(historicalMetadata?.policyDescription).toEqual('Test Policy Description')
  })

  test('Can check if a policy exists', options, async () => {
    var policyJSON = `
                  {
                  "Policy": "Test Policy",
                  "Description": "Test Policy Description",
                  "PolicyType": "open",
                  "CallingFunctions": [
                    {
                      "name": "transfer",
                      "functionSignature": "transfer(address to, uint256 value)",
                      "encodedValues": "address to, uint256 value"
                    }
                  ],
                  "ForeignCalls": [
                  {
                          "name": "testSigTwo",
                          "address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
                          "function": "testSigTwo(uint256)",
                          "returnType": "uint256",
                          "valuesToPass": "TR:SimpleStringTracker",
                          "mappedTrackerKeyValues": "",
                          "callingFunction": "transfer"
                  },{
                          "name": "testSig",
                          "address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
                          "function": "testSig(uint256)",
                          "returnType": "uint256",
                          "valuesToPass": "FC:testSigTwo",
                          "mappedTrackerKeyValues": "",
                          "callingFunction": "transfer"
                      }
                  ],
                  "Trackers": [
                  {
                      "name": "SimpleStringTracker",
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
                          "positiveEffects": ["emit \\"Success\\""],
                          "negativeEffects": ["revert()"],
                          "callingFunction": "transfer"
                      }
                      ]
                      }`
    var result = await createPolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      getRulesEngineRulesContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client),
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      1,
      policyJSON
    )
    var exists = await policyExists(config, getRulesEnginePolicyContract(rulesEngineContract, client), result.policyId)
    expect(exists).toEqual(true)
  })
  test('Can delete a full policy', options, async () => {
    var policyJSON = `
                            {
                            "Policy": "Test Policy",
                            "Description": "Test Policy Description",
                            "PolicyType": "open",
                            "CallingFunctions": [
                              {
                                "name": "transfer",
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
                                    "callingFunction": "transfer"
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
                                    "positiveEffects": ["emit \\"Success\\""],
                                    "negativeEffects": ["revert()"],
                                    "callingFunction": "transfer"
                                }
                            ]
                            }`
    var result = await createPolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      getRulesEngineRulesContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client),
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      1,
      policyJSON
    )
    expect(result.policyId).toBeGreaterThan(0)
    await sleep(4000)

      await deletePolicy(config, getRulesEnginePolicyContract(rulesEngineContract, client), result.policyId, 1)
      await sleep(4000)
      var rules = (await getAllRules(
        config,
        getRulesEngineRulesContract(rulesEngineContract, client),
        result.policyId
      )) as any
      expect(rules?.length).toEqual(0)
      var trAllRetrieve = await getAllTrackers(
        config,
        getRulesEngineComponentContract(rulesEngineContract, client),
        result.policyId
      )
      expect(trAllRetrieve?.length).toEqual(1)
      expect(trAllRetrieve![0].set).toEqual(false)
      var fcAllRetrieve = await getAllForeignCalls(
        config,
        getRulesEngineForeignCallContract(rulesEngineContract, client),
        result.policyId
      )
      expect(fcAllRetrieve?.length).toEqual(1)
      expect(fcAllRetrieve![0].set).toEqual(false)
    }
  )
  test('Can check if address is admin', async () => {
    var policyJSON = `
                          {
                          "Policy": "Test Policy",
                          "Description": "Test Policy Description",
                          "PolicyType": "open",
                          "CallingFunctions": [
                              {
                                "name": "transfer",
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
                                  "callingFunction": "transfer"
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
                                  "positiveEffects": ["emit \\"Success\\""],
                                  "negativeEffects": ["revert()"],
                                  "callingFunction": "transfer"
                              }
                              ]
                              }`
    var result = await createPolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      getRulesEngineRulesContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client),
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      1,
      policyJSON
    )
    var admin = await isPolicyAdmin(
      config,
      getRulesEngineAdminContract(rulesEngineContract, client),
      result.policyId,
      getAddress(foundryAccountAddress)
    )
    expect(admin).toEqual(true)
  }, 150000)
  test('Cannot create duplicate calling functions', options, async () => {
    var policyJSON = `
                              {
                              "Policy": "Test Policy",
                              "Description": "Test Policy Description",
                              "PolicyType": "open",
                              "CallingFunctions": [
                                {
                                  "name": "transfer",
                                  "functionSignature": "transfer(address to, uint256 value)",
                                  "encodedValues": "address to, uint256 value"
                                }
                              ],
                              "ForeignCalls": [
                                  {
                                      "name": "testSig",
                                      "function": "testSig(address)",
                                      "address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
                                      "returnType": "uint256",
                                      "valuesToPass": "to",
                                      "mappedTrackerKeyValues": "",
                                      "callingFunction": "transfer"
                                  }
                              ],
                              "Trackers": [
                              {
                                  "name": "testTracker",
                                  "type": "string",
                                  "initialValue": "test"
                              }
                              ],
                              "MappedTrackers": [],
                              "Rules": [
                                  {
                                      "Name": "Rule A",
                                      "Description": "Rule A Description",
                                      "condition": "TR:testTracker > 500",
                                      "positiveEffects": ["emit \\"Success\\""],
                                      "negativeEffects": ["revert()"],
                                      "callingFunction": "transfer"
                                  }
                              ]
                              }`

    var result = await createPolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      getRulesEngineRulesContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client),
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      1,
      policyJSON
    )
    expect(result.policyId).toBeGreaterThan(0)
    var callingFunctions = await getCallingFunctions(
      config,
      getRulesEngineComponentContract(rulesEngineContract, client),
      result.policyId
    )
    expect(callingFunctions.length).toEqual(1)
  })

  test('Cannot create duplicate trackers', options, async () => {
    var policyJSON = `
                    {
                    "Policy": "Test Policy",
                    "Description": "Test Policy Description",
                    "PolicyType": "open",
                    "CallingFunctions": [
                      {
                        "name": "transfer",
                        "functionSignature": "transfer(address to, uint256 value)",
                        "encodedValues": "address to, uint256 value"
                      }
                    ],
                    "ForeignCalls": [
                    {
                            "name": "testSigTwo",
                            "address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
                            "function": "testSigTwo(uint256)",
                            "returnType": "uint256",
                            "valuesToPass": "value",
                            "mappedTrackerKeyValues": "",
                            "callingFunction": "transfer"
                    },{
                            "name": "testSig",
                            "address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
                            "function": "testSig(uint256)",
                            "returnType": "uint256",
                            "valuesToPass": "FC:testSigTwo",
                            "mappedTrackerKeyValues": "",
                            "callingFunction": "transfer"
                        }
                    ],
                    "Trackers": [
                    {
                            "name": "testTracker",
                            "type": "uint256",
                            "initialValue": "4"
                    }
                    ],
                    "MappedTrackers": [],
                    "Rules": [
                        {
                            "Name": "Rule A",
                            "Description": "Rule A Description",
                            "condition": "value > 500",
                            "positiveEffects": ["emit \\"Success\\""],
                            "negativeEffects": ["revert()"],
                            "callingFunction": "transfer"
                        }
                        ]
                        }`

    var result = await createPolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      getRulesEngineRulesContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client),
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      1,
      policyJSON
    )
    expect(result.policyId).toBeGreaterThan(0)
    var callingFunctions = await getAllTrackers(
      config,
      getRulesEngineComponentContract(rulesEngineContract, client),
      result.policyId
    )
    expect(callingFunctions.length).toEqual(1)

    var trSyntax = `{
                            "name": "testTracker",
                            "type": "uint256",
                            "initialValue": "4"
                        }`
    var trId = await createTracker(
      config,
      getRulesEngineComponentContract(rulesEngineContract, client),
      result.policyId,
      trSyntax,
      1
    )
    expect(trId.trackerId).toEqual(-1)
    expect(trId.transactionHash).toEqual("0x0")
  })

  test('Cannot create duplicate foreign calls', options, async () => {
    var policyJSON = `
                  {
                  "Policy": "Test Policy",
                  "Description": "Test Policy Description",
                  "PolicyType": "open",
                  "CallingFunctions": [
                    {
                      "name": "transfer",
                      "functionSignature": "transfer(address to, uint256 value)",
                      "encodedValues": "address to, uint256 value"
                    }
                  ],
                  "ForeignCalls": [
                      {
                          "name": "testSig",
                          "function": "testSig(address)",
                          "address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
                          "returnType": "uint256",
                          "valuesToPass": "to",
                          "mappedTrackerKeyValues": "",
                          "callingFunction": "transfer"
                      }
                  ],
                  "Trackers": [
                  {
                      "name": "testTracker",
                      "type": "string",
                      "initialValue": "test"
                  }
                  ],
                  "MappedTrackers": [],
                  "Rules": [
                      {
                          "Name": "Rule A",
                          "Description": "Rule A Description",
                          "condition": "TR:testTracker > 500",
                          "positiveEffects": ["emit \\"Success\\""],
                          "negativeEffects": ["revert()"],
                          "callingFunction": "transfer"
                      }
                  ]
                  }`
    var result = await createPolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      getRulesEngineRulesContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client),
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      1,
      policyJSON
    )
    expect(result.policyId).toBeGreaterThan(0)
    var callingFunctions = await getAllTrackers(
      config,
      getRulesEngineComponentContract(rulesEngineContract, client),
      result.policyId
    )
    expect(callingFunctions.length).toEqual(1)

    var trSyntax = `{
                          "name": "testSig",
                          "function": "testSig(address)",
                          "address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
                          "returnType": "uint256",
                          "valuesToPass": "to",
                          "mappedTrackerKeyValues": "",
                          "callingFunction": "transfer"
                        }`
    var trId = await createForeignCall(
      config,
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client),
      getRulesEnginePolicyContract(rulesEngineContract, client),
      result.policyId,
      trSyntax,
      1
    )
    expect(trId.foreignCallId).toEqual(-1)
    expect(trId.transactionHash).toEqual("0x0")
  })
  test('Can update a policies admin', options, async () => {
    var policyJSON = `
                          {
                          "Policy": "Test Policy",
                          "Description": "Test Policy Description",
                          "PolicyType": "open",
                          "CallingFunctions": [
                              {
                                "name": "transfer",
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
                                  "callingFunction": "transfer"
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
                                  "positiveEffects": ["emit \\"Success\\""],
                                  "negativeEffects": ["revert()"],
                                  "callingFunction": "transfer"
                              }
                              ]
                              }`
    var result = await createPolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      getRulesEngineRulesContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client),
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      1,
      policyJSON
    )
    proposeNewPolicyAdmin(
      config,
      getRulesEngineAdminContract(rulesEngineContract, client),
      result.policyId,
      getAddress('0x70997970C51812dc3A010C7d01b50e0d17dc79C8'),
      1
    )
    await sleep(5000)
    await confirmNewPolicyAdmin(
      secondUserConfig,
      getRulesEngineAdminContract(rulesEngineContract, secondUserClient),
      result.policyId,
      1
    )
    await sleep(5000)
    var admin = await isPolicyAdmin(
      config,
      getRulesEngineAdminContract(rulesEngineContract, client),
      result.policyId,
      getAddress('0x70997970C51812dc3A010C7d01b50e0d17dc79C8')
    )
    expect(admin).toEqual(true)
  })
  test('Can cement a policy', options, async () => {
    var policyJSON = `
                        {
                        "Policy": "Test Policy",
                        "Description": "Test Policy Description",
                        "PolicyType": "open",
                        "CallingFunctions": [
                          {
                            "name": "transfer",
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
                                "callingFunction": "transfer"
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
                                "positiveEffects": ["emit \\"Success\\""],
                                "negativeEffects": ["revert()"],
                                "callingFunction": "transfer"
                            }
                            ]
                            }`
    var result = await createPolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      getRulesEngineRulesContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client),
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      1,
      policyJSON
    )

    var isCemented = await isCementedPolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      result.policyId
    )
    expect(isCemented).toEqual(false)
    var admin = await isPolicyAdmin(
      config,
      getRulesEngineAdminContract(rulesEngineContract, client),
      result.policyId,
      getAddress('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266')
    )
    expect(admin).toEqual(true)
    await cementPolicy(config, getRulesEnginePolicyContract(rulesEngineContract, client), result.policyId, 1)
    await sleep(5000)
    isCemented = await isCementedPolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      result.policyId
    )
  })
  test('Can manipulate closed subscriber list for a policy', options, async () => {
    var policyJSON = `
                        {
                        "Policy": "Test Policy",
                        "Description": "Test Policy Description",
                        "PolicyType": "open",
                        "CallingFunctions": [
                            {
                              "name": "transfer",
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
                                "callingFunction": "transfer"
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
                                "positiveEffects": ["emit \\"Success\\""],
                                "negativeEffects": ["revert()"],
                                "callingFunction": "transfer"
                            }
                            ]
                            }`
    var result = await createPolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      getRulesEngineRulesContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client),
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      1,
      policyJSON
    )

    await closePolicy(config, getRulesEnginePolicyContract(rulesEngineContract, client), result.policyId, 1)
    var isClosed = await isClosedPolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      result.policyId
    )
    expect(isClosed).toEqual(true)

    var isSubscriber = await isClosedPolicySubscriber(
      config,
      getRulesEngineComponentContract(rulesEngineContract, client),
      result.policyId,
      getAddress('0x70997970C51812dc3A010C7d01b50e0d17dc79C8')
    )

    expect(isSubscriber).toEqual(false)

    await removeClosedPolicySubscriber(
      config,
      getRulesEngineComponentContract(rulesEngineContract, client),
      result.policyId,
      getAddress('0x70997970C51812dc3A010C7d01b50e0d17dc79C8'),
      1
    )

    var isSubscriber = await isClosedPolicySubscriber(
      config,
      getRulesEngineComponentContract(rulesEngineContract, client),
      result.policyId,
      getAddress('0x70997970C51812dc3A010C7d01b50e0d17dc79C8')
    )

    expect(isSubscriber).toEqual(false)
  })

  test('Can retrieve tracker array value types', options, async () => {
    var policyJSON = `
                             {
                             "Policy": "Test Policy",
                             "Description": "Test Policy Description",
                             "PolicyType": "open",
                             "CallingFunctions": [
                               {
                                 "name": "transfer",
                                 "functionSignature": "transfer(address to, uint256 value)",
                                 "encodedValues": "address to, uint256 value"
                               }
                             ],
                             "ForeignCalls": [
                               {
                                   "name": "AnotherTestForeignCall",
                                   "address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
                                   "function": "AnotherTestForeignCall(address)",
                                   "returnType": "uint256",
                                   "valuesToPass": "to",
                                   "mappedTrackerKeyValues": "",
                                   "callingFunction": "transfer"
                               },
                               {
                                   "name": "ATestForeignCall",
                                   "address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
                                   "function": "ATestForeignCall(address, uint256)",
                                   "returnType": "uint256",
                                   "valuesToPass": "FC:AnotherTestForeignCall, TR:trackerOne",
                                   "mappedTrackerKeyValues": "",
                                   "callingFunction": "transfer"
                               }

                             ],
                             "Trackers": [
                             {
                              "name": "trackerOne",
                              "type": "uint256[]",
                              "initialValue": ["123"]
                              }],
                             "MappedTrackers": [
                                 {
                                  "name": "mappedTrackerOne",
                                  "keyType": "address",
                                  "valueType": "uint256[]",
                                  "initialKeys": ["0xb7f8bc63bbcad18155201308c8f3540b07f84f5e"],
                                  "initialValues": [["1"]]
                                  }],
                             "Rules": [
                                 {
                                     "Name": "Rule A",
                                     "Description": "Rule A Description",
                                     "condition": "FC:ATestForeignCall > 1000",
                                     "positiveEffects": ["emit \\"Success\\"", "FC:AnotherTestForeignCall", "TRU:mappedTrackerOne(to) += 1"],
                                     "negativeEffects": ["revert(\\\"Negative\\\")", "TRU:trackerOne += 12"],
                                     "callingFunction": "transfer"
                                 }
                             ]
                             }`
    validatePolicyJSON(policyJSON)
    var result = await createPolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      getRulesEngineRulesContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client),
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      1,
      policyJSON
    )
    expect(result.policyId).toBeGreaterThan(0)
    var resultTR = await getAllTrackers(
      config,
      getRulesEngineComponentContract(rulesEngineContract, client),
      result.policyId
    )
    expect(resultTR?.length).toEqual(2)
    var trackerMetadata = await getTrackerMetadata(
      config,
      getRulesEngineComponentContract(rulesEngineContract, client),
      result.policyId,
      1 // Tracker ID for testTracker
    )
    var mappedTrackerMetadata = await getTrackerMetadata(
      config,
      getRulesEngineComponentContract(rulesEngineContract, client),
      result.policyId,
      2 // Tracker ID for mappedTrackerOne
    )

    expect(trackerMetadata.arrayType).toEqual(trackerArrayType.UINT_ARRAY)
    expect(mappedTrackerMetadata.arrayType).toEqual(trackerArrayType.UINT_ARRAY)
  })

  test('Can create rules with custom ordering', async () => {
    var policyJSON = `{
                    "Policy": "Test Rule Ordering",
                    "Description": "Test that rules are created in specified order",
                    "PolicyType": "open",
                    "CallingFunctions": [
                      {
                        "name": "transfer",
                        "functionSignature": "transfer(address to, uint256 value)",
                        "encodedValues": "address to, uint256 value"
                      }
                    ],
                    "ForeignCalls": [],
                    "Trackers": [],
                    "MappedTrackers": [],
                    "Rules": [
                      {
                        "Name": "Rule C - Should be Third",
                        "Description": "Third rule by order",
                        "condition": "value > 300",
                        "positiveEffects": ["emit \\"RuleC\\""],
                        "negativeEffects": ["revert()"],
                        "callingFunction": "transfer",
                        "order": 3
                      },
                      {
                        "Name": "Rule A - Should be First",
                        "Description": "First rule by order",
                        "condition": "value > 100",
                        "positiveEffects": ["emit \\"RuleA\\""],
                        "negativeEffects": ["revert()"],
                        "callingFunction": "transfer",
                        "order": 1
                      },
                      {
                        "Name": "Rule B - Should be Second",
                        "Description": "Second rule by order",
                        "condition": "value > 200",
                        "positiveEffects": ["emit \\"RuleB\\""],
                        "negativeEffects": ["revert()"],
                        "callingFunction": "transfer",
                        "order": 2
                      }
                    ]
                  }`

    var result = await createPolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      getRulesEngineRulesContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client),
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      1,
      policyJSON
    )
    expect(result.policyId).toBeGreaterThan(0)

    // Retrieve the policy to verify rule order
    var retVal = await getPolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      getRulesEngineRulesContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client),
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      result.policyId
    )

    expect(retVal).toBeDefined()
    expect(retVal!.Policy).toBeDefined()

    const parsed = retVal
    expect(parsed).toBeDefined()
    expect(parsed!.Rules).toHaveLength(3)

    // Verify that rules are in the correct order based on the 'order' field
    expect(parsed!.Rules[0].Name).toEqual('Rule A - Should be First')
    expect(parsed!.Rules[1].Name).toEqual('Rule B - Should be Second')
    expect(parsed!.Rules[2].Name).toEqual('Rule C - Should be Third')

    // Also verify descriptions are preserved
    expect(parsed!.Rules[0].Description).toEqual('First rule by order')
    expect(parsed!.Rules[1].Description).toEqual('Second rule by order')
    expect(parsed!.Rules[2].Description).toEqual('Third rule by order')
  }, 1000000) // 100 second timeout

  test('Can create policy with foreign calls having empty parameters and void return type', options, async () => {
    var policyJSON = `{
        "Policy": "Empty Params and Void Return Test",
        "Description": "Test policy with foreign calls: one with no params, one with uint256 param and void return",
        "PolicyType": "open",
        "CallingFunctions": [
          {
            "name": "transfer",
            "functionSignature": "transfer(address to, uint256 value)",
            "encodedValues": "address to, uint256 value"
          }
        ],
        "ForeignCalls": [
          {
            "name": "EmptyParamCall",
            "address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
            "function": "checkStatus()",
            "returnType": "bool",
            "valuesToPass": "",
            "mappedTrackerKeyValues": "",
            "callingFunction": "transfer"
          },
          {
            "name": "VoidReturnCall",
            "address": "0xb7f8bc63bbcad18155201308c8f3540b07f84f5e",
            "function": "updateCounter(uint256)",
            "returnType": "void",
            "valuesToPass": "value",
            "mappedTrackerKeyValues": "",
            "callingFunction": "transfer"
          }
        ],
        "Trackers": [
          {
            "name": "statusTracker",
            "type": "bool",
            "initialValue": "true"
          }
        ],
        "MappedTrackers": [],
        "Rules": [
          {
            "Name": "Empty Param and Void Return Rule",
            "Description": "Test rule using both foreign calls",
            "condition": "FC:EmptyParamCall == true",
            "positiveEffects": ["emit \\"Status OK\\""],
            "negativeEffects": ["revert()"],
            "callingFunction": "transfer"
          }
        ]
      }`

    var result = await createPolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      getRulesEngineRulesContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client),
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      1,
      policyJSON
    )

    expect(result.policyId).toBeGreaterThan(0)

    // Verify foreign calls were created correctly
    var resultFC = await getAllForeignCalls(
      config,
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      result.policyId
    )

    expect(resultFC?.length).toEqual(2)

    // Verify the policy can be retrieved and parsed
    var retVal = await getPolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      getRulesEngineRulesContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client),
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      result.policyId
    )

    expect(retVal).toBeDefined()

    const parsed = retVal!
    const input = JSON.parse(policyJSON)

    expect(parsed).toBeDefined()
    expect(parsed.ForeignCalls).toHaveLength(2)

    // Verify empty parameter foreign call
    const emptyParamFC = parsed.ForeignCalls.find((fc: any) => fc.name === 'EmptyParamCall')
    expect(emptyParamFC).toBeDefined()
    expect(emptyParamFC!.function).toEqual('checkStatus()')
    expect(emptyParamFC!.returnType).toEqual('bool')
    expect(emptyParamFC!.valuesToPass).toEqual('')

    // Verify void return foreign call
    const voidReturnFC = parsed.ForeignCalls.find((fc: any) => fc.name === 'VoidReturnCall')
    expect(voidReturnFC).toBeDefined()
    expect(voidReturnFC!.function).toEqual('updateCounter(uint256)')
    expect(voidReturnFC!.returnType).toEqual('void')
    expect(voidReturnFC!.valuesToPass).toEqual('value')

    // Verify Policy data mirrors input fields (excluding exact effects matching due to encoding)
    const inputJson = JSON.parse(policyJSON)
    expect(retVal).toBeDefined()
    expect(parsed.Rules.length).toEqual(inputJson.Rules.length)
    expect(parsed.Rules[0].Name).toEqual(inputJson.Rules[0].Name)
    expect(parsed.Rules[0].Description).toEqual(inputJson.Rules[0].Description)
    expect(parsed.Rules[0].condition).toEqual(inputJson.Rules[0].condition)
    expect(parsed.Rules[0].callingFunction).toEqual(inputJson.Rules[0].callingFunction)
  })

  test('Receive Error for incorrectly formated rule.', async () => {
    let failingPolicyJSON = `
            {
            "Policy": "Test Policy",
            "Description": "This is a test policy",
            "PolicyType": "open",
            "CallingFunctions": [{
              "name": "addValue",
              "functionSignature": "addValue(uint256 value)",
              "encodedValues": "uint256 value"
            }
            ],
            "ForeignCalls": [
            ],
            "Trackers": [

            ],
            "MappedTrackers": [],
            "Rules": [{
              "Name": "rule A",
              "Description": "rule A Description",
              "condition": "value == test",
              "positiveEffects": ["revert"],
              "negativeEffects": [],
              "callingFunction": "addValue"
            }
                ]
                }`
    await expect(
      createPolicy(
        config,
        getRulesEnginePolicyContract(rulesEngineContract, client),
        getRulesEngineRulesContract(rulesEngineContract, client),
        getRulesEngineComponentContract(rulesEngineContract, client),
        getRulesEngineForeignCallContract(rulesEngineContract, client),
        1,
        failingPolicyJSON
      )
    ).rejects.toThrow('Invalid rule syntax:')
  }, 1000000)

  test('Receive Error for incorrectly formated Calling Function.', async () => {
    let failingPolicyJSON = `
            {
            "Policy": "Test Policy",
            "Description": "This is a test policy",
            "PolicyType": "open",
            "CallingFunctions": [{
              "name": "addValue",
              "functionSignature": "addValue uin",
              "encodedValues": "uint256 value"
            }
            ],
            "ForeignCalls": [

            ],
            "Trackers": [

            ],
            "MappedTrackers": [],
            "Rules": [{
              "Name": "rule A",
              "Description": "rule A Description",
              "condition": "value == 1234",
              "positiveEffects": ["revert"],
              "negativeEffects": [],
              "callingFunction": "addValue"
            }
                ]
                }`
    await expect(
      createPolicy(
        config,
        getRulesEnginePolicyContract(rulesEngineContract, client),
        getRulesEngineRulesContract(rulesEngineContract, client),
        getRulesEngineComponentContract(rulesEngineContract, client),
        getRulesEngineForeignCallContract(rulesEngineContract, client),
        1,
        failingPolicyJSON
      )
    ).rejects.toThrow('Unable to normalize signature')
  }, 1000000)

  test('Receive Error for incorrectly formated Foreign Call.', async () => {
    let failingPolicyJSON = `
            {
            "Policy": "Test Policy",
            "Description": "This is a test policy",
            "PolicyType": "open",
            "CallingFunctions": [{
              "name": "addValue",
              "functionSignature": "addValue(uint256 value)",
              "encodedValues": "uint256 value"
            }
            ],
            "ForeignCalls": [
              {
                  "name": "AnotherTestForeignCall",
                  "address": "1234",
                  "function": "AnotherTestForeignCall(uint256)",
                  "returnType": "uint256",
                  "valuesToPass": "value",
                  "mappedTrackerKeyValues": "",
                  "callingFunction": "addValue"
              }
            ],
            "Trackers": [

            ],
            "MappedTrackers": [],
            "Rules": [{
              "Name": "rule A",
              "Description": "rule A Description",
              "condition": "value == 1234",
              "positiveEffects": ["revert"],
              "negativeEffects": [],
              "callingFunction": "addValue"
            }
                ]
                }`
    await expect(
      createPolicy(
        config,
        getRulesEnginePolicyContract(rulesEngineContract, client),
        getRulesEngineRulesContract(rulesEngineContract, client),
        getRulesEngineComponentContract(rulesEngineContract, client),
        getRulesEngineForeignCallContract(rulesEngineContract, client),
        1,
        failingPolicyJSON
      )
    ).rejects.toThrow('Policy Address is invalid')
  }, 1000000)

  test('Receive Error for incorrectly formated Tracker.', async () => {
    let failingPolicyJSON = `
            {
            "Policy": "Test Policy",
            "Description": "This is a test policy",
            "PolicyType": "open",
            "CallingFunctions": [{
              "name": "addValue",
              "functionSignature": "addValue(uint256 value)",
              "encodedValues": "uint256 value"
            }
            ],
            "ForeignCalls": [
              {
                  "name": "AnotherTestForeignCall",
                  "address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
                  "function": "AnotherTestForeignCall(uint256)",
                  "returnType": "uint256",
                  "valuesToPass": "value",
                  "mappedTrackerKeyValues": "",
                  "callingFunction": "addValue"
              }
            ],
            "Trackers": [
              {
                "name": "Simple String Tracker",
                "type": "uin",
                "initialValue": "test"
            }
            ],
            "MappedTrackers": [],
            "Rules": [{
              "Name": "rule A",
              "Description": "rule A Description",
              "condition": "value == 1234",
              "positiveEffects": ["revert"],
              "negativeEffects": [],
              "callingFunction": "addValue"
            }
                ]
                }`
    await expect(
      createPolicy(
        config,
        getRulesEnginePolicyContract(rulesEngineContract, client),
        getRulesEngineRulesContract(rulesEngineContract, client),
        getRulesEngineComponentContract(rulesEngineContract, client),
        getRulesEngineForeignCallContract(rulesEngineContract, client),
        1,
        failingPolicyJSON
      )
    ).rejects.toThrow('Policy Unsupported type: Field')
  }, 1000000)
  test('Receive Error for incorrectly formated Mapped Tracker.', async () => {
    let failingPolicyJSON = `
            {
            "Policy": "Test Policy",
            "Description": "This is a test policy",
            "PolicyType": "open",
            "CallingFunctions": [{
              "name": "addValue",
              "functionSignature": "addValue(uint256 value)",
              "encodedValues": "uint256 value"
            }
            ],
            "ForeignCalls": [
              {
                  "name": "AnotherTestForeignCall",
                  "address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
                  "function": "AnotherTestForeignCall(uint256)",
                  "returnType": "uint256",
                  "valuesToPass": "value",
                  "mappedTrackerKeyValues": "",
                  "callingFunction": "addValue"
              }
            ],
            "Trackers": [
              {
                "name": "Simple String Tracker",
                "type": "string",
                "initialValue": "test"
            }
            ],
            "MappedTrackers": [
              {
              "name": "mappedTrackerOne",
              "keyType": "address",
              "valueType": "uin[]",
              "initialKeys": ["0xb7f8bc63bbcad18155201308c8f3540b07f84f5e"],
              "initialValues": [["1"]]
              }],
            "Rules": [{
              "Name": "rule A",
              "Description": "rule A Description",
              "condition": "value == 1234",
              "positiveEffects": ["revert"],
              "negativeEffects": [],
              "callingFunction": "addValue"
            }
                ]
                }`
    await expect(
      createPolicy(
        config,
        getRulesEnginePolicyContract(rulesEngineContract, client),
        getRulesEngineRulesContract(rulesEngineContract, client),
        getRulesEngineComponentContract(rulesEngineContract, client),
        getRulesEngineForeignCallContract(rulesEngineContract, client),
        1,
        failingPolicyJSON
      )
    ).rejects.toThrow('Policy Unsupported type: Field Mapped')
  }, 1000000)

  test('Functions return transaction hashes', async () => {
    // Test createPolicy returns transaction hash
    var policyJSON = `{
      "Policy": "Transaction Hash Test Policy",
      "Description": "Test policy to verify transaction hash is returned",
      "PolicyType": "open",
      "CallingFunctions": [
        {
          "name": "transfer",
          "functionSignature": "transfer(address to, uint256 value)",
          "encodedValues": "address to, uint256 value"
        }
      ],
      "ForeignCalls": [],
      "Trackers": [],
      "MappedTrackers": [],
      "Rules": []
    }`

    var createResult = await createPolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      getRulesEngineRulesContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client),
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      1,
      policyJSON
    )
    
    expect(createResult.policyId).toBeGreaterThan(0)
    expect(createResult.transactionHash).toBeDefined()
    expect(createResult.transactionHash).toMatch(/^0x[a-fA-F0-9]{64}$/)

    // Test closePolicy returns transaction hash and result
    var closeResult = await closePolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      createResult.policyId,
      1
    )
    
    expect(closeResult.result).toBe(0)
    expect(closeResult.transactionHash).toBeDefined()
    expect(closeResult.transactionHash).toMatch(/^0x[a-fA-F0-9]{64}$/)

    // Test openPolicy returns transaction hash and result
    var openResult = await openPolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      createResult.policyId,
      1
    )
    
    expect(openResult.result).toBe(0)
    expect(openResult.transactionHash).toBeDefined()
    expect(openResult.transactionHash).toMatch(/^0x[a-fA-F0-9]{64}$/)

    // Test deletePolicy returns transaction hash and result
    var deleteResult = await deletePolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      createResult.policyId,
      1
    )
    
    expect(deleteResult.result).toBe(0)
    expect(deleteResult.transactionHash).toBeDefined()
    expect(deleteResult.transactionHash).toMatch(/^0x[a-fA-F0-9]{64}$/)
  }, 60000) // 60 second timeout

  test('CreatePolicy returns comprehensive transaction hashes for all components', async () => {
    // Test createPolicy with all component types to verify individual transaction hash collection
    var comprehensivePolicyJSON = `{
      "Policy": "Comprehensive Transaction Hash Test Policy",
      "Description": "Test policy to verify individual transaction hashes are captured for all components",
      "PolicyType": "open",
      "CallingFunctions": [
        {
          "name": "transfer",
          "functionSignature": "transfer(address to, uint256 value)",
          "encodedValues": "address to, uint256 value"
        },
        {
          "name": "approve",
          "functionSignature": "approve(address spender, uint256 amount)",
          "encodedValues": "address spender, uint256 amount"
        }
      ],
      "ForeignCalls": [
        {
          "name": "TestForeignCall",
          "address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
          "function": "testFunction(uint256)",
          "returnType": "uint256",
          "valuesToPass": "value",
          "mappedTrackerKeyValues": "",
          "callingFunction": "transfer"
        }
      ],
      "Trackers": [
        {
          "name": "TestTracker",
          "type": "uint256",
          "initialValue": "0"
        }
      ],
      "MappedTrackers": [],
      "Rules": [
        {
          "Name": "Test Rule",
          "Description": "A test rule",
          "condition": "FC:TestForeignCall > 100",
          "positiveEffects": ["emit \\"Rule triggered\\""],
          "negativeEffects": ["revert()"],
          "callingFunction": "transfer"
        }
      ]
    }`

    var createResult = await createPolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      getRulesEngineRulesContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client),
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      1,
      comprehensivePolicyJSON
    )
    
    // Verify basic policy creation
    expect(createResult.policyId).toBeGreaterThan(0)
    expect(createResult.transactionHash).toBeDefined()
    expect(createResult.transactionHash).toMatch(/^0x[a-fA-F0-9]{64}$/)

    // Verify individual transaction hash arrays are present and properly structured
    expect(createResult.callingFunctions).toBeInstanceOf(Array)
    expect(createResult.trackers).toBeInstanceOf(Array)
    expect(createResult.foreignCalls).toBeInstanceOf(Array)
    expect(createResult.rules).toBeInstanceOf(Array)

    // Verify calling functions transaction hashes
    expect(createResult.callingFunctions.length).toBeGreaterThan(0)
    createResult.callingFunctions.forEach(cf => {
      // functionId is actually a function selector (hex string)
      expect(typeof cf.functionId).toBe('string')
      expect(cf.functionId).toMatch(/^0x[a-fA-F0-9]{8}$/) // Function selector format
      expect(cf.transactionHash).toMatch(/^0x[a-fA-F0-9]{64}$/)
    })

    // Verify trackers transaction hashes
    expect(createResult.trackers.length).toBeGreaterThan(0)
    createResult.trackers.forEach(tr => {
      // trackerId should be a number
      expect(['number', 'bigint'].includes(typeof tr.trackerId)).toBe(true)
      if (typeof tr.trackerId === 'number') {
        expect(tr.trackerId).toBeGreaterThan(0)
      } else if (typeof tr.trackerId === 'bigint') {
        expect(tr.trackerId > 0n).toBe(true)
      }
      expect(tr.transactionHash).toMatch(/^0x[a-fA-F0-9]{64}$/)
    })

    // Verify foreign calls transaction hashes
    expect(createResult.foreignCalls.length).toBeGreaterThan(0)
    createResult.foreignCalls.forEach(fc => {
      // foreignCallId should be a number
      expect(['number', 'bigint'].includes(typeof fc.foreignCallId)).toBe(true)
      if (typeof fc.foreignCallId === 'number') {
        expect(fc.foreignCallId).toBeGreaterThan(0)
      } else if (typeof fc.foreignCallId === 'bigint') {
        expect(fc.foreignCallId > 0n).toBe(true)
      }
      expect(fc.transactionHash).toMatch(/^0x[a-fA-F0-9]{64}$/)
    })

    // Verify rules transaction hashes
    expect(createResult.rules.length).toBeGreaterThan(0)
    createResult.rules.forEach(rule => {
      // ruleId should be a number
      expect(['number', 'bigint'].includes(typeof rule.ruleId)).toBe(true)
      if (typeof rule.ruleId === 'number') {
        expect(rule.ruleId).toBeGreaterThan(0)
      } else if (typeof rule.ruleId === 'bigint') {
        expect(rule.ruleId > 0n).toBe(true)
      }
      expect(rule.transactionHash).toMatch(/^0x[a-fA-F0-9]{64}$/)
    })

    // Verify that transaction hashes are unique (basic sanity check)
    const allHashes = [
      createResult.transactionHash,
      ...createResult.callingFunctions.map(cf => cf.transactionHash),
      ...createResult.trackers.map(tr => tr.transactionHash),
      ...createResult.foreignCalls.map(fc => fc.transactionHash),
      ...createResult.rules.map(rule => rule.transactionHash)
    ]
    const uniqueHashes = new Set(allHashes)
    expect(uniqueHashes.size).toBeGreaterThan(1) // Should have multiple unique transaction hashes
  }, 60000) // 60 second timeout
})
