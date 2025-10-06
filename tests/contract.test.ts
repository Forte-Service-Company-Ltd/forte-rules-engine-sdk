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
    expect(cfData.FunctionSignature).toEqual(cfIn.FunctionSignature)
    expect(cfData.EncodedValues).toEqual(cfIn.EncodedValues)
    expect(cfData.Name).toEqual(cfIn.Name)
  }

  // ForeignCalls
  expect(policyData.ForeignCalls.length).toEqual(input.ForeignCalls.length)
  for (let i = 0; i < input.ForeignCalls.length; i++) {
    const fcIn = input.ForeignCalls[i]
    const fcData = policyData.ForeignCalls[i]
    expect(fcData.Name).toEqual(fcIn.Name)
    expect(fcData.Function).toEqual(fcIn.Function)
    expect(getAddress(fcData.Address)).toEqual(getAddress(fcIn.Address))
    expect(fcData.ReturnType).toEqual(fcIn.ReturnType)
    expect(fcData.ValuesToPass).toEqual(fcIn.ValuesToPass)
    expect(fcData.MappedTrackerKeyValues).toEqual(fcIn.MappedTrackerKeyValues)
    expect(fcData.CallingFunction).toEqual(fcIn.CallingFunction)
  }

  // Trackers
  expect(policyData.Trackers.length).toEqual(input.Trackers.length)
  for (let i = 0; i < input.Trackers.length; i++) {
    const trIn = input.Trackers[i]
    const trData = policyData.Trackers[i]
    expect(trData.Name).toEqual(trIn.Name)
    expect(trData.Type).toEqual(trIn.Type)
    expect(trData.InitialValue).toEqual(trIn.InitialValue)
  }

  // MappedTrackers
  expect(policyData.MappedTrackers.length).toEqual(input.MappedTrackers.length)
  for (let i = 0; i < input.MappedTrackers.length; i++) {
    const mIn = input.MappedTrackers[i]
    const mData = policyData.MappedTrackers[i]
    expect(mData.Name).toEqual(mIn.Name)
    expect(mData.KeyType).toEqual(mIn.KeyType)
    expect(mData.ValueType).toEqual(mIn.ValueType)
    expect(mData.InitialKeys).toEqual(mIn.InitialKeys)
    expect(mData.InitialValues).toEqual(mIn.InitialValues)
  }

  // Rules
  expect(policyData.Rules.length).toEqual(input.Rules.length)
  for (let i = 0; i < input.Rules.length; i++) {
    const ruleIn = input.Rules[i]
    const ruleData = policyData.Rules[i]
    expect(ruleData.Name).toEqual(ruleIn.Name)
    expect(ruleData.Description).toEqual(ruleIn.Description)
    expect(ruleData.Condition).toEqual(ruleIn.Condition)
    expect(ruleData.CallingFunction).toEqual(ruleIn.CallingFunction)
    expect(ruleData.PositiveEffects).toEqual(ruleIn.PositiveEffects)
    expect(ruleData.NegativeEffects).toEqual(ruleIn.NegativeEffects)
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
            "Name": "addValue",
            "FunctionSignature": "addValue(uint256 value)",
            "EncodedValues": "uint256 value"
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
            "Condition": "3 + 4 > 5 AND (1 == 1 AND 2 == 2)",
            "PositiveEffects": ["revert"],
            "NegativeEffects": [],
            "CallingFunction": "addValue"
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
            "Name": "addValue",
            "FunctionSignature": "addValue(uint256 value)",
            "EncodedValues": "uint256 value"
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
            "Condition": "3 + 4 > 5 AND (1 == 1 AND 2 == 2)",
            "PositiveEffects": ["revert"],
            "NegativeEffects": [],
            "CallingFunction": "addValue"
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
            "Name": "addValue",
            "FunctionSignature": "addValue(uint256 value)",
            "EncodedValues": "uint256 value"
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
            "Condition": "3 + 4 > 5 AND (1 == 1 AND 2 == 2)",
            "PositiveEffects": ["revert"],
            "NegativeEffects": [],
            "CallingFunction": "addValue"
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
            "Name": "addValue",
            "FunctionSignature": "addValue(uint256 value)",
            "EncodedValues": "uint256 value"
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
            "Condition": "3 + 4 > 5 AND (1 == 1 AND 2 == 2)",
            "PositiveEffects": ["revert"],
            "NegativeEffects": [],
            "CallingFunction": "addValue"
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
                    "Condition": "3 + 4 > 5 AND (value == 1 AND 2 == 2)",
                    "PositiveEffects": ["revert"],
                    "NegativeEffects": [],
                    "CallingFunction": "addValue"
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
            "Name": "addValue",
            "FunctionSignature": "addValue(uint256 value)",
            "EncodedValues": "uint256 value"
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
            "Condition": "3 + 4 > 5 AND (1 == 1 AND 2 == 2)",
            "PositiveEffects": ["revert"],
            "NegativeEffects": [],
            "CallingFunction": "addValue"
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
            "Name": "someFunction",
            "FunctionSignature": "someFunction(address to, string someString, uint256 value)",
            "EncodedValues": "address to, string someString, uint256 value"
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
            "Condition": "3 + 4 > 5 AND (1 == 1 AND 2 == 2)",
            "PositiveEffects": ["revert"],
            "NegativeEffects": [],
            "CallingFunction": "someFunction"
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
                    "Name": "Simple Foreign Call",
                    "Address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
                    "Function": "testSig(address,string,uint256)",
                    "ReturnType": "uint256",
                    "ValuesToPass": "to, someString, value",
                    "MappedTrackerKeyValues": "",
                    "CallingFunction": "someFunction"
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
            "Name": "someFunction",
            "FunctionSignature": "someFunction(address to, string someString, uint256[] values)",
            "EncodedValues": "address to, string someString, uint256[] values"
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
            "Condition": "3 + 4 > 5 AND (1 == 1 AND 2 == 2)",
            "PositiveEffects": ["revert"],
            "NegativeEffects": [],
            "CallingFunction": "someFunction"
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
                      "Name": "Simple Foreign Call",
                      "Address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
                      "Function": "testSig(address,string,uint256[])",
                      "ReturnType": "uint256",
                      "ValuesToPass": "to, someString, values",
                      "MappedTrackerKeyValues": "",
                      "CallingFunction": "someFunction"
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
            "Name": "someFunction",
            "FunctionSignature": "someFunction(address to, string someString, uint256[] values)",
            "EncodedValues": "address to, string someString, uint256[] values"
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
            "Condition": "3 + 4 > 5 AND (1 == 1 AND 2 == 2)",
            "PositiveEffects": ["revert"],
            "NegativeEffects": [],
            "CallingFunction": "someFunction"
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
                              "Name": "Simple Foreign Call",
                              "Address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
                              "Function": "testSig(address)",
                              "ReturnType": "uint256",
                              "ValuesToPass": "to",
                              "MappedTrackerKeyValues": "",
                              "CallingFunction": "someFunction"
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
            "Name": "someFunction",
            "FunctionSignature": "someFunction(address to, string someString, uint256[] values)",
            "EncodedValues": "address to, string someString, uint256[] values"
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
            "Condition": "3 + 4 > 5 AND (1 == 1 AND 2 == 2)",
            "PositiveEffects": ["revert"],
            "NegativeEffects": [],
            "CallingFunction": "someFunction"
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
                          "Name": "Simple Foreign Call",
                          "Address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
                          "Function": "testSig(address)",
                          "ReturnType": "uint256",
                          "ValuesToPass": "to",
                          "MappedTrackerKeyValues": "",
                          "CallingFunction": "someFunction"
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
                          "Name": "Simple Foreign Call",
                          "Address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
                          "Function": "testSig(address)",
                          "ReturnType": "uint256",
                          "ValuesToPass": "to",
                          "MappedTrackerKeyValues": "",
                          "CallingFunction": "someFunction"
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
                          "Name": "Simple String Tracker",
                          "Type": "uint256",
                          "InitialValue": "4"
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
                      "Name": "Simple String Tracker",
                      "Type": "uint256",
                      "InitialValue": "4"
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
    await deleteTracker(
      config,
      getRulesEngineComponentContract(rulesEngineContract, client),
      result.policyId,
      trId.trackerId,
      1
    )
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
                      "Name": "Simple String Tracker",
                      "Type": "uint256",
                      "InitialValue": "4"
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
                    "Name": "Simple String Tracker",
                    "Type": "uint256",
                    "InitialValue": "5"
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
                  "Name": "transfer",
                  "FunctionSignature": "transfer(address to, uint256 value)",
                  "EncodedValues": "address to, uint256 value"
                }
              ],
              "ForeignCalls": [
                  {
                      "Name": "testSig",
                      "Function": "testSig(address)",
                      "Address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
                      "ReturnType": "uint256",
                      "ValuesToPass": "to",
                      "MappedTrackerKeyValues": "",
                      "CallingFunction": "transfer"
                  }
              ],
              "Trackers": [
              {
                  "Name": "testTracker",
                  "Type": "string",
                  "InitialValue": "test"
              }
              ],
              "MappedTrackers": [],
              "Rules": [
                  {
                      "Name": "Rule A",
                      "Description": "Rule A Description",
                      "Condition": "TR:testTracker > 500",
                      "PositiveEffects": ["emit \\"Success\\""],
                      "NegativeEffects": ["revert()"],
                      "CallingFunction": "transfer"
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
                          "Name": "transfer",
                          "FunctionSignature": "transfer(address to, uint256 value)",
                          "EncodedValues": "address to, uint256 value"
                        }
                      ],
                      "ForeignCalls": [],
                      "Trackers": [
                      {
                          "Name": "testTracker",
                          "Type": "string",
                          "InitialValue": "1000"
                      }
                      ],
                      "MappedTrackers": [],
                      "Rules": [
                          {
                              "Name": "Rule A",
                              "Description": "Rule A Description",
                              "Condition": "value > 500",
                              "PositiveEffects": ["revert(\\"Positive\\")"],
                              "NegativeEffects": ["revert(\\"Negative\\")"],
                              "CallingFunction": "transfer"
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
    input.Rules[0].NegativeEffects = ["revert('Negative')"]
    input.Rules[0].PositiveEffects = ["revert('Positive')"]

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
                           "Name": "transfer",
                           "FunctionSignature": "transfer(address to, uint256 value, bool someValue)",
                           "EncodedValues": "address to, uint256 value, bool someValue"
                         }
                       ],
                       "ForeignCalls": [
                         {
                             "Name": "AnotherTestForeignCall",
                             "Address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
                             "Function": "AnotherTestForeignCall(address)",
                             "ReturnType": "uint256",
                             "ValuesToPass": "to",
                             "MappedTrackerKeyValues": "",
                             "CallingFunction": "transfer"
                         },
                         {
                             "Name": "ATestForeignCall",
                             "Address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
                             "Function": "ATestForeignCall(address, uint256)",
                             "ReturnType": "uint256",
                             "ValuesToPass": "FC:AnotherTestForeignCall, TR:trackerOne",
                             "MappedTrackerKeyValues": "",
                             "CallingFunction": "transfer"
                         }

                       ],
                       "Trackers": [
                       {
                        "Name": "trackerOne",
                        "Type": "uint256",
                        "InitialValue": "123"
                        }],
                       "MappedTrackers": [
                           {
                            "Name": "mappedTrackerOne",
                            "KeyType": "address",
                            "ValueType": "uint256",
                            "InitialKeys": ["0xb7f8bc63bbcad18155201308c8f3540b07f84f5e"],
                            "InitialValues": ["1"]
                            }],
                       "Rules": [
                           {
                               "Name": "Rule A",
                               "Description": "Rule A Description",
                               "Condition": "GV:TX_ORIGIN == GV:BLOCK_TIMESTAMP AND ( GV:MSG_DATA == 2 AND ( someValue == true AND GV:BLOCK_NUMBER == 4 ) )",
                               "PositiveEffects": ["emit \\"Success\\"", "FC:AnotherTestForeignCall", "TRU:mappedTrackerOne(to) += 1"],
                               "NegativeEffects": ["revert(\\"Negative\\")", "TRU:trackerOne += 12"],
                               "CallingFunction": "transfer"
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

    expect(callingFunctions[0].parameterTypes.length).toEqual(input.CallingFunctions[0].EncodedValues.split(',').length)

    expect(retVal).toBeDefined()

    input.Rules[0].NegativeEffects[0] = "revert('Negative')"

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
                                  "Name": "transfer",
                                  "FunctionSignature": "transfer(address to, uint256 value)",
                                  "EncodedValues": "address to, uint256 value"
                                }
                              ],
                              "ForeignCalls": [
                                  {
                                      "Name": "testSig",
                                      "Function": "testSig(address)",
                                      "Address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
                                      "ReturnType": "uint256",
                                      "ValuesToPass": "to",
                                      "MappedTrackerKeyValues": "",
                                      "CallingFunction": "transfer"
                                  }
                              ],
                              "Trackers": [
                              {
                                  "Name": "testTracker",
                                  "Type": "string",
                                  "InitialValue": "test"
                              }
                              ],
                              "MappedTrackers": [],
                              "Rules": [
                                  {
                                      "Name": "Rule A",
                                      "Description": "Rule A Description",
                                      "Condition": "TR:testTracker > 500",
                                      "PositiveEffects": ["emit \\"Success\\""],
                                      "NegativeEffects": ["revert()"],
                                      "CallingFunction": "transfer"
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
                                "Name": "transfer",
                                "FunctionSignature": "transfer(address to, uint256 value)",
                                "EncodedValues": "address to, uint256 value"
                              }
                            ],
                            "ForeignCalls": [
                                {
                                    "Name": "testSig",
                                    "Function": "testSig(address)",
                                    "Address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
                                    "ReturnType": "uint256",
                                    "ValuesToPass": "to",
                                    "MappedTrackerKeyValues": "",
                                    "CallingFunction": "transfer"
                                }
                            ],
                            "Trackers": [
                            {
                                "Name": "testTracker",
                                "Type": "string",
                                "InitialValue": "test"
                            }
                            ],
                            "MappedTrackers": [],
                            "Rules": [
                                {
                                    "Name": "Rule A",
                                    "Description": "Rule A Description",
                                    "Condition": "TR:testTracker > 500",
                                    "PositiveEffects": ["emit \\"Success\\""],
                                    "NegativeEffects": ["revert()"],
                                    "CallingFunction": "transfer"
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
                                "Name": "transfer",
                                "FunctionSignature": "transfer(address to, uint256 value)",
                                "EncodedValues": "address to, uint256 value"
                              }
                            ],
                            "ForeignCalls": [
                                {
                                    "Id": 1,
                                    "Name": "testSig",
                                    "Function": "testSig(address)",
                                    "Address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
                                    "ReturnType": "uint256",
                                    "ValuesToPass": "to",
                                    "MappedTrackerKeyValues": "",
                                    "CallingFunction": "transfer"
                                }
                            ],
                            "Trackers": [
                            {
                                "Id": 1,
                                "Name": "testTracker",
                                "Type": "string",
                                "InitialValue": "test"
                            }
                            ],
                            "MappedTrackers": [],
                            "Rules": [
                                {
                                    "Id": 1,
                                    "Name": "Rule A",
                                    "Description": "Rule A Description",
                                    "Condition": "TR:testTracker > 500",
                                    "PositiveEffects": ["emit \\"Success\\""],
                                    "NegativeEffects": ["revert()"],
                                    "CallingFunction": "transfer"
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
                          "Name": "transfer",
                          "FunctionSignature": "transfer(address to, uint256 value)",
                          "EncodedValues": "address to, uint256 value"
                        }
                      ],
                      "ForeignCalls": [
                      {
                              "Name": "testSigTwo",
                              "Address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
                              "Function": "testSigTwo(uint256)",
                              "ReturnType": "uint256",
                              "ValuesToPass": "TR:SimpleStringTracker",
                              "MappedTrackerKeyValues": "",
                              "CallingFunction": "transfer"
                      },{
                              "Name": "testSig",
                              "Address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
                              "Function": "testSig(uint256)",
                              "ReturnType": "uint256",
                              "ValuesToPass": "FC:testSigTwo",
                              "MappedTrackerKeyValues": "",
                              "CallingFunction": "transfer"
                          }
                      ],
                      "Trackers": [
                      {
                          "Name": "SimpleStringTracker",
                          "Type": "string",
                          "InitialValue": "test"
                      }
                      ],
                      "MappedTrackers": [],
                      "Rules": [
                          {
                              "Name": "Rule A",
                              "Description": "Rule A Description",
                              "Condition": "value > 500",
                              "PositiveEffects": ["emit \\"Success\\""],
                              "NegativeEffects": ["revert()"],
                              "CallingFunction": "transfer"
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
                                    "Name": "transfer",
                                    "FunctionSignature": "transfer(address to, uint256 value)",
                                    "EncodedValues": "address to, uint256 value"
                                  }
                                ],
                                "ForeignCalls": [
                                    {
                                        "Name": "Simple Foreign Call",
                                        "Address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
                                        "Function": "testSig(address)",
                                        "ReturnType": "uint256",
                                        "ValuesToPass": "to",
                                        "MappedTrackerKeyValues": "",
                                        "CallingFunction": "transfer"
                                    }
                                ],
                                "Trackers": [
                                {
                                    "Name": "Simple String Tracker",
                                    "Type": "string",
                                    "InitialValue": "test"
                                }
                                ],
                                "MappedTrackers": [],
                                "Rules": [
                                    {
                                        "Name": "Rule A",
                                        "Description": "Rule A Description",
                                        "Condition": "value > 500",
                                        "PositiveEffects": ["emit \\"Success\\""],
                                        "NegativeEffects": ["revert()"],
                                        "CallingFunction": "transfer"
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
  })
  test('Can check if address is admin', async () => {
    var policyJSON = `
                              {
                              "Policy": "Test Policy",
                              "Description": "Test Policy Description",
                              "PolicyType": "open",
                              "CallingFunctions": [
                                  {
                                    "Name": "transfer",
                                    "FunctionSignature": "transfer(address to, uint256 value)",
                                    "EncodedValues": "address to, uint256 value"
                                  }
                              ],
                              "ForeignCalls": [
                                  {
                                      "Name": "Simple Foreign Call",
                                      "Address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
                                      "Function": "testSig(address)",
                                      "ReturnType": "uint256",
                                      "ValuesToPass": "to",
                                      "MappedTrackerKeyValues": "",
                                      "CallingFunction": "transfer"
                                  }
                              ],
                              "Trackers": [
                              {
                                  "Name": "Simple String Tracker",
                                  "Type": "string",
                                  "InitialValue": "test"
                              }
                              ],
                              "MappedTrackers": [],
                              "Rules": [
                                  {
                                      "Name": "Rule A",
                                      "Description": "Rule A Description",
                                      "Condition": "value > 500",
                                      "PositiveEffects": ["emit \\"Success\\""],
                                      "NegativeEffects": ["revert()"],
                                      "CallingFunction": "transfer"
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
                                      "Name": "transfer",
                                      "FunctionSignature": "transfer(address to, uint256 value)",
                                      "EncodedValues": "address to, uint256 value"
                                    }
                                  ],
                                  "ForeignCalls": [
                                      {
                                          "Name": "testSig",
                                          "Function": "testSig(address)",
                                          "Address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
                                          "ReturnType": "uint256",
                                          "ValuesToPass": "to",
                                          "MappedTrackerKeyValues": "",
                                          "CallingFunction": "transfer"
                                      }
                                  ],
                                  "Trackers": [
                                  {
                                      "Name": "testTracker",
                                      "Type": "string",
                                      "InitialValue": "test"
                                  }
                                  ],
                                  "MappedTrackers": [],
                                  "Rules": [
                                      {
                                          "Name": "Rule A",
                                          "Description": "Rule A Description",
                                          "Condition": "TR:testTracker > 500",
                                          "PositiveEffects": ["emit \\"Success\\""],
                                          "NegativeEffects": ["revert()"],
                                          "CallingFunction": "transfer"
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
                            "Name": "transfer",
                            "FunctionSignature": "transfer(address to, uint256 value)",
                            "EncodedValues": "address to, uint256 value"
                          }
                        ],
                        "ForeignCalls": [
                        {
                                "Name": "testSigTwo",
                                "Address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
                                "Function": "testSigTwo(uint256)",
                                "ReturnType": "uint256",
                                "ValuesToPass": "value",
                                "MappedTrackerKeyValues": "",
                                "CallingFunction": "transfer"
                        },{
                                "Name": "testSig",
                                "Address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
                                "Function": "testSig(uint256)",
                                "ReturnType": "uint256",
                                "ValuesToPass": "FC:testSigTwo",
                                "MappedTrackerKeyValues": "",
                                "CallingFunction": "transfer"
                            }
                        ],
                        "Trackers": [
                        {
                                "Name": "testTracker",
                                "Type": "uint256",
                                "InitialValue": "4"
                        }
                        ],
                        "MappedTrackers": [],
                        "Rules": [
                            {
                                "Name": "Rule A",
                                "Description": "Rule A Description",
                                "Condition": "value > 500",
                                "PositiveEffects": ["emit \\"Success\\""],
                                "NegativeEffects": ["revert()"],
                                "CallingFunction": "transfer"
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
                                "Name": "testTracker",
                                "Type": "uint256",
                                "InitialValue": "4"
                            }`
    var trId = await createTracker(
      config,
      getRulesEngineComponentContract(rulesEngineContract, client),
      result.policyId,
      trSyntax,
      1
    )
    expect(trId.trackerId).toEqual(-1)
    expect(trId.transactionHash).toEqual('0x0')
  })

  test('Cannot create duplicate foreign calls', options, async () => {
    var policyJSON = `
                      {
                      "Policy": "Test Policy",
                      "Description": "Test Policy Description",
                      "PolicyType": "open",
                      "CallingFunctions": [
                        {
                          "Name": "transfer",
                          "FunctionSignature": "transfer(address to, uint256 value)",
                          "EncodedValues": "address to, uint256 value"
                        }
                      ],
                      "ForeignCalls": [
                          {
                              "Name": "testSig",
                              "Function": "testSig(address)",
                              "Address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
                              "ReturnType": "uint256",
                              "ValuesToPass": "to",
                              "MappedTrackerKeyValues": "",
                              "CallingFunction": "transfer"
                          }
                      ],
                      "Trackers": [
                      {
                          "Name": "testTracker",
                          "Type": "string",
                          "InitialValue": "test"
                      }
                      ],
                      "MappedTrackers": [],
                      "Rules": [
                          {
                              "Name": "Rule A",
                              "Description": "Rule A Description",
                              "Condition": "TR:testTracker > 500",
                              "PositiveEffects": ["emit \\"Success\\""],
                              "NegativeEffects": ["revert()"],
                              "CallingFunction": "transfer"
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
                              "Name": "testSig",
                              "Function": "testSig(address)",
                              "Address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
                              "ReturnType": "uint256",
                              "ValuesToPass": "to",
                              "MappedTrackerKeyValues": "",
                              "CallingFunction": "transfer"
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
    expect(trId.transactionHash).toEqual('0x0')
  })
  test('Can update a policies admin', options, async () => {
    var policyJSON = `
                              {
                              "Policy": "Test Policy",
                              "Description": "Test Policy Description",
                              "PolicyType": "open",
                              "CallingFunctions": [
                                  {
                                    "Name": "transfer",
                                    "FunctionSignature": "transfer(address to, uint256 value)",
                                    "EncodedValues": "address to, uint256 value"
                                  }
                              ],
                              "ForeignCalls": [
                                  {
                                      "Name": "Simple Foreign Call",
                                      "Address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
                                      "Function": "testSig(address)",
                                      "ReturnType": "uint256",
                                      "ValuesToPass": "to",
                                      "MappedTrackerKeyValues": "",
                                      "CallingFunction": "transfer"
                                  }
                              ],
                              "Trackers": [
                              {
                                  "Name": "Simple String Tracker",
                                  "Type": "string",
                                  "InitialValue": "test"
                              }
                              ],
                              "MappedTrackers": [],
                              "Rules": [
                                  {
                                      "Name": "Rule A",
                                      "Description": "Rule A Description",
                                      "Condition": "value > 500",
                                      "PositiveEffects": ["emit \\"Success\\""],
                                      "NegativeEffects": ["revert()"],
                                      "CallingFunction": "transfer"
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
                                "Name": "transfer",
                                "FunctionSignature": "transfer(address to, uint256 value)",
                                "EncodedValues": "address to, uint256 value"
                              }
                            ],
                            "ForeignCalls": [
                                {
                                    "Name": "Simple Foreign Call",
                                    "Address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
                                    "Function": "testSig(address)",
                                    "ReturnType": "uint256",
                                    "ValuesToPass": "to",
                                    "MappedTrackerKeyValues": "",
                                    "CallingFunction": "transfer"
                                }
                            ],
                            "Trackers": [
                            {
                                "Name": "Simple String Tracker",
                                "Type": "string",
                                "InitialValue": "test"
                            }
                            ],
                            "MappedTrackers": [],
                            "Rules": [
                                {
                                    "Name": "Rule A",
                                    "Description": "Rule A Description",
                                    "Condition": "value > 500",
                                    "PositiveEffects": ["emit \\"Success\\""],
                                    "NegativeEffects": ["revert()"],
                                    "CallingFunction": "transfer"
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
                                  "Name": "transfer",
                                  "FunctionSignature": "transfer(address to, uint256 value)",
                                  "EncodedValues": "address to, uint256 value"
                                }
                            ],
                            "ForeignCalls": [
                                {
                                    "Name": "Simple Foreign Call",
                                    "Address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
                                    "Function": "testSig(address)",
                                    "ReturnType": "uint256",
                                    "ValuesToPass": "to",
                                    "MappedTrackerKeyValues": "",
                                    "CallingFunction": "transfer"
                                }
                            ],
                            "Trackers": [
                            {
                                "Name": "Simple String Tracker",
                                "Type": "string",
                                "InitialValue": "test"
                            }
                            ],
                            "MappedTrackers": [],
                            "Rules": [
                                {
                                    "Name": "Rule A",
                                    "Description": "Rule A Description",
                                    "Condition": "value > 500",
                                    "PositiveEffects": ["emit \\"Success\\""],
                                    "NegativeEffects": ["revert()"],
                                    "CallingFunction": "transfer"
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
                                     "Name": "transfer",
                                     "FunctionSignature": "transfer(address to, uint256 value)",
                                     "EncodedValues": "address to, uint256 value"
                                   }
                                 ],
                                 "ForeignCalls": [
                                   {
                                       "Name": "AnotherTestForeignCall",
                                       "Address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
                                       "Function": "AnotherTestForeignCall(address)",
                                       "ReturnType": "uint256",
                                       "ValuesToPass": "to",
                                       "MappedTrackerKeyValues": "",
                                       "CallingFunction": "transfer"
                                   },
                                   {
                                       "Name": "ATestForeignCall",
                                       "Address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
                                       "Function": "ATestForeignCall(address, uint256)",
                                       "ReturnType": "uint256",
                                       "ValuesToPass": "FC:AnotherTestForeignCall, TR:trackerOne",
                                       "MappedTrackerKeyValues": "",
                                       "CallingFunction": "transfer"
                                   }

                                 ],
                                 "Trackers": [
                                 {
                                  "Name": "trackerOne",
                                  "Type": "uint256[]",
                                  "InitialValue": ["123"]
                                  }],
                                 "MappedTrackers": [
                                     {
                                      "Name": "mappedTrackerOne",
                                      "KeyType": "address",
                                      "ValueType": "uint256[]",
                                      "InitialKeys": ["0xb7f8bc63bbcad18155201308c8f3540b07f84f5e"],
                                      "InitialValues": [["1"]]
                                      }],
                                 "Rules": [
                                     {
                                         "Name": "Rule A",
                                         "Description": "Rule A Description",
                                         "Condition": "FC:ATestForeignCall > 1000",
                                         "PositiveEffects": ["emit \\"Success\\"", "FC:AnotherTestForeignCall", "TRU:mappedTrackerOne(to) += 1"],
                                         "NegativeEffects": ["revert(\\\"Negative\\\")", "TRU:trackerOne += 12"],
                                         "CallingFunction": "transfer"
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
                            "Name": "transfer",
                            "FunctionSignature": "transfer(address to, uint256 value)",
                            "EncodedValues": "address to, uint256 value"
                          }
                        ],
                        "ForeignCalls": [],
                        "Trackers": [],
                        "MappedTrackers": [],
                        "Rules": [
                          {
                            "Name": "Rule C - Should be Third",
                            "Description": "Third rule by order",
                            "Condition": "value > 300",
                            "PositiveEffects": ["emit \\"RuleC\\""],
                            "NegativeEffects": ["revert()"],
                            "CallingFunction": "transfer",
                            "Order": 3
                          },
                          {
                            "Name": "Rule A - Should be First",
                            "Description": "First rule by order",
                            "Condition": "value > 100",
                            "PositiveEffects": ["emit \\"RuleA\\""],
                            "NegativeEffects": ["revert()"],
                            "CallingFunction": "transfer",
                            "Order": 1
                          },
                          {
                            "Name": "Rule B - Should be Second",
                            "Description": "Second rule by order",
                            "Condition": "value > 200",
                            "PositiveEffects": ["emit \\"RuleB\\""],
                            "NegativeEffects": ["revert()"],
                            "CallingFunction": "transfer",
                            "Order": 2
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
                "Name": "transfer",
                "FunctionSignature": "transfer(address to, uint256 value)",
                "EncodedValues": "address to, uint256 value"
              }
            ],
            "ForeignCalls": [
              {
                "Name": "EmptyParamCall",
                "Address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
                "Function": "checkStatus()",
                "ReturnType": "bool",
                "ValuesToPass": "",
                "MappedTrackerKeyValues": "",
                "CallingFunction": "transfer"
              },
              {
                "Name": "VoidReturnCall",
                "Address": "0xb7f8bc63bbcad18155201308c8f3540b07f84f5e",
                "Function": "updateCounter(uint256)",
                "ReturnType": "void",
                "ValuesToPass": "value",
                "MappedTrackerKeyValues": "",
                "CallingFunction": "transfer"
              }
            ],
            "Trackers": [
              {
                "Name": "statusTracker",
                "Type": "bool",
                "InitialValue": "true"
              }
            ],
            "MappedTrackers": [],
            "Rules": [
              {
                "Name": "Empty Param and Void Return Rule",
                "Description": "Test rule using both foreign calls",
                "Condition": "FC:EmptyParamCall == true",
                "PositiveEffects": ["emit \\"Status OK\\""],
                "NegativeEffects": ["revert()"],
                "CallingFunction": "transfer"
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
    const emptyParamFC = parsed.ForeignCalls.find((fc: any) => fc.Name === 'EmptyParamCall')
    expect(emptyParamFC).toBeDefined()
    expect(emptyParamFC!.Function).toEqual('checkStatus()')
    expect(emptyParamFC!.ReturnType).toEqual('bool')
    expect(emptyParamFC!.ValuesToPass).toEqual('')

    // Verify void return foreign call
    const voidReturnFC = parsed.ForeignCalls.find((fc: any) => fc.Name === 'VoidReturnCall')
    expect(voidReturnFC).toBeDefined()
    expect(voidReturnFC!.Function).toEqual('updateCounter(uint256)')
    expect(voidReturnFC!.ReturnType).toEqual('void')
    expect(voidReturnFC!.ValuesToPass).toEqual('value')

    // Verify Policy data mirrors input fields (excluding exact effects matching due to encoding)
    const inputJson = JSON.parse(policyJSON)
    expect(retVal).toBeDefined()
    expect(parsed.Rules.length).toEqual(inputJson.Rules.length)
    expect(parsed.Rules[0].Name).toEqual(inputJson.Rules[0].Name)
    expect(parsed.Rules[0].Description).toEqual(inputJson.Rules[0].Description)
    expect(parsed.Rules[0].Condition).toEqual(inputJson.Rules[0].Condition)
    expect(parsed.Rules[0].CallingFunction).toEqual(inputJson.Rules[0].CallingFunction)
  })

  test('Receive Error for incorrectly formated rule.', async () => {
    let failingPolicyJSON = `
                {
                "Policy": "Test Policy",
                "Description": "This is a test policy",
                "PolicyType": "open",
                "CallingFunctions": [{
                  "Name": "addValue",
                  "FunctionSignature": "addValue(uint256 value)",
                  "EncodedValues": "uint256 value"
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
                  "Condition": "value == test",
                  "PositiveEffects": ["revert"],
                  "NegativeEffects": [],
                  "CallingFunction": "addValue"
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
                  "Name": "addValue",
                  "FunctionSignature": "addValue uin",
                  "EncodedValues": "uint256 value"
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
                  "Condition": "value == 1234",
                  "PositiveEffects": ["revert"],
                  "NegativeEffects": [],
                  "CallingFunction": "addValue"
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
                  "Name": "addValue",
                  "FunctionSignature": "addValue(uint256 value)",
                  "EncodedValues": "uint256 value"
                }
                ],
                "ForeignCalls": [
                  {
                      "Name": "AnotherTestForeignCall",
                      "Address": "1234",
                      "Function": "AnotherTestForeignCall(uint256)",
                      "ReturnType": "uint256",
                      "ValuesToPass": "value",
                      "MappedTrackerKeyValues": "",
                      "CallingFunction": "addValue"
                  }
                ],
                "Trackers": [

                ],
                "MappedTrackers": [],
                "Rules": [{
                  "Name": "rule A",
                  "Description": "rule A Description",
                  "Condition": "value == 1234",
                  "PositiveEffects": ["revert"],
                  "NegativeEffects": [],
                  "CallingFunction": "addValue"
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
                  "Name": "addValue",
                  "FunctionSignature": "addValue(uint256 value)",
                  "EncodedValues": "uint256 value"
                }
                ],
                "ForeignCalls": [
                  {
                      "Name": "AnotherTestForeignCall",
                      "Address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
                      "Function": "AnotherTestForeignCall(uint256)",
                      "ReturnType": "uint256",
                      "ValuesToPass": "value",
                      "MappedTrackerKeyValues": "",
                      "CallingFunction": "addValue"
                  }
                ],
                "Trackers": [
                  {
                    "Name": "Simple String Tracker",
                    "Type": "uin",
                    "InitialValue": "test"
                }
                ],
                "MappedTrackers": [],
                "Rules": [{
                  "Name": "rule A",
                  "Description": "rule A Description",
                  "Condition": "value == 1234",
                  "PositiveEffects": ["revert"],
                  "NegativeEffects": [],
                  "CallingFunction": "addValue"
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
                  "Name": "addValue",
                  "FunctionSignature": "addValue(uint256 value)",
                  "EncodedValues": "uint256 value"
                }
                ],
                "ForeignCalls": [
                  {
                      "Name": "AnotherTestForeignCall",
                      "Address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
                      "Function": "AnotherTestForeignCall(uint256)",
                      "ReturnType": "uint256",
                      "ValuesToPass": "value",
                      "MappedTrackerKeyValues": "",
                      "CallingFunction": "addValue"
                  }
                ],
                "Trackers": [
                  {
                    "Name": "Simple String Tracker",
                    "Type": "string",
                    "InitialValue": "test"
                }
                ],
                "MappedTrackers": [
                  {
                  "Name": "mappedTrackerOne",
                  "KeyType": "address",
                  "ValueType": "uin[]",
                  "InitialKeys": ["0xb7f8bc63bbcad18155201308c8f3540b07f84f5e"],
                  "InitialValues": [["1"]]
                  }],
                "Rules": [{
                  "Name": "rule A",
                  "Description": "rule A Description",
                  "Condition": "value == 1234",
                  "PositiveEffects": ["revert"],
                  "NegativeEffects": [],
                  "CallingFunction": "addValue"
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
              "Name": "transfer",
              "FunctionSignature": "transfer(address to, uint256 value)",
              "EncodedValues": "address to, uint256 value"
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
              "Name": "transfer",
              "FunctionSignature": "transfer(address to, uint256 value)",
              "EncodedValues": "address to, uint256 value"
            },
            {
              "Name": "approve",
              "FunctionSignature": "approve(address spender, uint256 amount)",
              "EncodedValues": "address spender, uint256 amount"
            }
          ],
          "ForeignCalls": [
            {
              "Name": "TestForeignCall",
              "Address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
              "Function": "testFunction(uint256)",
              "ReturnType": "uint256",
              "ValuesToPass": "value",
              "MappedTrackerKeyValues": "",
              "CallingFunction": "transfer"
            }
          ],
          "Trackers": [
            {
              "Name": "TestTracker",
              "Type": "uint256",
              "InitialValue": "0"
            }
          ],
          "MappedTrackers": [],
          "Rules": [
            {
              "Name": "Test Rule",
              "Description": "A test rule",
              "Condition": "FC:TestForeignCall > 100",
              "PositiveEffects": ["emit \\"Rule triggered\\""],
              "NegativeEffects": ["revert()"],
              "CallingFunction": "transfer"
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
    createResult.callingFunctions.forEach((cf) => {
      // functionId is actually a function selector (hex string)
      expect(typeof cf.functionId).toBe('string')
      expect(cf.functionId).toMatch(/^0x[a-fA-F0-9]{8}$/) // Function selector format
      expect(cf.transactionHash).toMatch(/^0x[a-fA-F0-9]{64}$/)
    })

    // Verify trackers transaction hashes
    expect(createResult.trackers.length).toBeGreaterThan(0)
    createResult.trackers.forEach((tr) => {
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
    createResult.foreignCalls.forEach((fc) => {
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
    createResult.rules.forEach((rule) => {
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
      ...createResult.callingFunctions.map((cf) => cf.transactionHash),
      ...createResult.trackers.map((tr) => tr.transactionHash),
      ...createResult.foreignCalls.map((fc) => fc.transactionHash),
      ...createResult.rules.map((rule) => rule.transactionHash),
    ]
    const uniqueHashes = new Set(allHashes)
    expect(uniqueHashes.size).toBeGreaterThan(1) // Should have multiple unique transaction hashes
  }, 60000) // 60 second timeout

  test('Can create and use bytes tracker in policy rules', options, async () => {
    const bytesTrackerPolicyJSON = `{
        "Policy": "Bytes Tracker Test Policy",
        "Description": "Test policy with bytes tracker functionality",
        "PolicyType": "open",
        "CallingFunctions": [
          {
            "Name": "addData",
            "Function": "addData(bytes data)",
            "FunctionSignature": "addData(bytes)",
            "EncodedValues": "bytes data"
          }
        ],
        "ForeignCalls": [],
        "Trackers": [
          {
            "Name": "dataTracker",
            "Type": "bytes",
            "InitialValue": "0xdeadbeef"
          }
        ],
        "MappedTrackers": [],
        "Rules": [
          {
            "Name": "Data Rule",
            "Description": "Rule that uses bytes tracker in condition",
            "Condition": "TR:dataTracker == \\"0xdeadbeef\\"",
            "PositiveEffects": ["TR:dataTracker = \\"0xdeadbeefdeadbeef\\""],
            "NegativeEffects": ["revert(\\"Data comparison failed\\")"],
            "CallingFunction": "addData"
          }
        ]
      }`

    console.log('Creating policy with bytes tracker and rule...')

    // Create policy with bytes tracker and rule
    const createResult = await createPolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      getRulesEngineRulesContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client),
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      1,
      bytesTrackerPolicyJSON
    )

    expect(createResult.policyId).toBeGreaterThan(0)
    expect(createResult.transactionHash).toMatch(/^0x[a-fA-F0-9]{64}$/)
    console.log('Policy created successfully with ID:', createResult.policyId)

    // Verify tracker was created successfully
    expect(createResult.trackers.length).toBe(1)
    expect(createResult.trackers[0].trackerId).toBeGreaterThan(0)
    expect(createResult.trackers[0].transactionHash).toMatch(/^0x[a-fA-F0-9]{64}$/)
    console.log('Bytes tracker created:', createResult.trackers[0])

    // Retrieve the created tracker to verify its properties
    const trackerDetails = await getTracker(
      config,
      getRulesEngineComponentContract(rulesEngineContract, client),
      createResult.policyId,
      createResult.trackers[0].trackerId
    )

    expect(trackerDetails).not.toBeNull()
    expect(trackerDetails?.pType).toBe(5) // pTypeEnum.BYTES
    expect(trackerDetails?.mapped).toBe(false)
    console.log('Bytes tracker verified - type:', trackerDetails?.pType)

    // Verify tracker metadata
    const trackerMetadata = await getTrackerMetadata(
      config,
      getRulesEngineComponentContract(rulesEngineContract, client),
      createResult.policyId,
      createResult.trackers[0].trackerId
    )

    expect(trackerMetadata?.trackerName).toBe('dataTracker')
    console.log('Tracker metadata verified:', trackerMetadata?.trackerName)

    // Verify rule was created with bytes tracker reference
    expect(createResult.rules.length).toBe(1)
    expect(createResult.rules[0].ruleId).toBeGreaterThan(0)
    expect(createResult.rules[0].transactionHash).toMatch(/^0x[a-fA-F0-9]{64}$/)
    console.log('Rule created with bytes tracker reference:', createResult.rules[0])

    // Retrieve rule metadata to verify it references the bytes tracker
    const ruleMetadata = await getRuleMetadata(
      config,
      getRulesEngineRulesContract(rulesEngineContract, client),
      createResult.policyId,
      createResult.rules[0].ruleId
    )

    expect(ruleMetadata).not.toBeNull()
    expect(ruleMetadata?.ruleName).toBe('Data Rule')
    console.log('Rule metadata verified:', ruleMetadata?.ruleName)

    // Test creating an additional bytes tracker with different data
    const additionalBytesTracker = `{
        "Name": "anotherDataTracker",
        "Type": "bytes",
        "InitialValue": "different data"
      }`

    console.log('Creating additional bytes tracker...')
    const additionalTrackerId = await createTracker(
      config,
      getRulesEngineComponentContract(rulesEngineContract, client),
      createResult.policyId,
      additionalBytesTracker,
      1
    )

    expect(additionalTrackerId.trackerId).toBeGreaterThan(0)
    expect(additionalTrackerId.transactionHash).toMatch(/^0x[a-fA-F0-9]{64}$/)
    console.log('Additional bytes tracker created:', additionalTrackerId)

    // Verify the additional tracker
    const additionalTrackerDetails = await getTracker(
      config,
      getRulesEngineComponentContract(rulesEngineContract, client),
      createResult.policyId,
      additionalTrackerId.trackerId
    )

    expect(additionalTrackerDetails).not.toBeNull()
    expect(additionalTrackerDetails?.pType).toBe(5) // pTypeEnum.BYTES

    // Verify we can get all trackers including our bytes trackers
    const allTrackers = await getAllTrackers(
      config,
      getRulesEngineComponentContract(rulesEngineContract, client),
      createResult.policyId
    )

    expect(allTrackers.length).toBe(2)
    const bytesTrackers = allTrackers.filter((tracker) => tracker.pType === 5)
    expect(bytesTrackers.length).toBe(2)
    console.log('All bytes trackers verified:', bytesTrackers.length)

    // Test updating a bytes tracker
    const updatedBytesTracker = `{
        "Name": "dataTracker",
        "Type": "bytes",
        "InitialValue": "updated test data"
      }`

    console.log('Updating bytes tracker...')
    const updateResult = await updateTracker(
      config,
      getRulesEngineComponentContract(rulesEngineContract, client),
      createResult.policyId,
      createResult.trackers[0].trackerId,
      updatedBytesTracker,
      1
    )

    expect(updateResult.trackerId).toBeGreaterThan(0)
    expect(updateResult.transactionHash).toMatch(/^0x[a-fA-F0-9]{64}$/)
    console.log('Bytes tracker updated successfully:', updateResult)

    // Verify the update worked
    const updatedTrackerDetails = await getTracker(
      config,
      getRulesEngineComponentContract(rulesEngineContract, client),
      createResult.policyId,
      createResult.trackers[0].trackerId
    )

    expect(updatedTrackerDetails).not.toBeNull()
    expect(updatedTrackerDetails?.pType).toBe(5) // Still bytes type
    console.log('Bytes tracker update verified successfully')

    console.log('✅ All bytes tracker functionality verified successfully!')
  })

  test('Can create and use string tracker in policy rules', options, async () => {
    const stringTrackerPolicyJSON = `{
        "Policy": "String Tracker Test Policy",
        "Description": "Test policy with string tracker functionality",
        "PolicyType": "open",
        "CallingFunctions": [
          {
            "Name": "setMessage",
            "Function": "setMessage(string message)",
            "FunctionSignature": "setMessage(string)",
            "EncodedValues": "string message"
          }
        ],
        "ForeignCalls": [],
        "Trackers": [
          {
            "Name": "messageTracker",
            "Type": "string",
            "InitialValue": "hello world"
          }
        ],
        "MappedTrackers": [],
        "Rules": [
          {
            "Name": "Message Rule",
            "Description": "Rule that uses string tracker in condition",
            "Condition": "TR:messageTracker != TR:messageTracker",
            "PositiveEffects": ["emit \\"String comparison works\\""],
            "NegativeEffects": ["revert(\\"String comparison failed\\")"],
            "CallingFunction": "setMessage"
          }
        ]
      }`

    console.log('Creating policy with string tracker and rule...')

    // Create policy with string tracker and rule
    const createResult = await createPolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      getRulesEngineRulesContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client),
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      1,
      stringTrackerPolicyJSON
    )

    expect(createResult.policyId).toBeGreaterThan(0)
    expect(createResult.transactionHash).toMatch(/^0x[a-fA-F0-9]{64}$/)
    console.log('Policy created successfully with ID:', createResult.policyId)

    // Verify tracker was created successfully
    expect(createResult.trackers.length).toBe(1)
    expect(createResult.trackers[0].trackerId).toBeGreaterThan(0)
    expect(createResult.trackers[0].transactionHash).toMatch(/^0x[a-fA-F0-9]{64}$/)
    console.log('String tracker created:', createResult.trackers[0])

    // Retrieve the created tracker to verify its properties
    const trackerDetails = await getTracker(
      config,
      getRulesEngineComponentContract(rulesEngineContract, client),
      createResult.policyId,
      createResult.trackers[0].trackerId
    )

    expect(trackerDetails).not.toBeNull()
    expect(trackerDetails?.pType).toBe(1) // pTypeEnum.STRING
    expect(trackerDetails?.mapped).toBe(false)
    console.log('String tracker verified - type:', trackerDetails?.pType)

    // Verify tracker metadata
    const trackerMetadata = await getTrackerMetadata(
      config,
      getRulesEngineComponentContract(rulesEngineContract, client),
      createResult.policyId,
      createResult.trackers[0].trackerId
    )

    expect(trackerMetadata?.trackerName).toBe('messageTracker')
    console.log('Tracker metadata verified:', trackerMetadata?.trackerName)

    // Verify rule was created with string tracker reference
    expect(createResult.rules.length).toBe(1)
    expect(createResult.rules[0].ruleId).toBeGreaterThan(0)
    expect(createResult.rules[0].transactionHash).toMatch(/^0x[a-fA-F0-9]{64}$/)
    console.log('Rule created with string tracker reference:', createResult.rules[0])

    // Retrieve rule metadata to verify it references the string tracker
    const ruleMetadata = await getRuleMetadata(
      config,
      getRulesEngineRulesContract(rulesEngineContract, client),
      createResult.policyId,
      createResult.rules[0].ruleId
    )

    expect(ruleMetadata).not.toBeNull()
    expect(ruleMetadata?.ruleName).toBe('Message Rule')
    console.log('Rule metadata verified:', ruleMetadata?.ruleName)

    // Test creating an additional string tracker with different data
    const additionalStringTracker = `{
        "Name": "anotherMessageTracker",
        "Type": "string",
        "InitialValue": "different message"
      }`

    console.log('Creating additional string tracker...')
    const additionalTrackerId = await createTracker(
      config,
      getRulesEngineComponentContract(rulesEngineContract, client),
      createResult.policyId,
      additionalStringTracker,
      1
    )

    expect(additionalTrackerId.trackerId).toBeGreaterThan(0)
    expect(additionalTrackerId.transactionHash).toMatch(/^0x[a-fA-F0-9]{64}$/)
    console.log('Additional string tracker created:', additionalTrackerId)

    // Verify the additional tracker
    const additionalTrackerDetails = await getTracker(
      config,
      getRulesEngineComponentContract(rulesEngineContract, client),
      createResult.policyId,
      additionalTrackerId.trackerId
    )

    expect(additionalTrackerDetails).not.toBeNull()
    expect(additionalTrackerDetails?.pType).toBe(1) // pTypeEnum.STRING

    // Verify we can get all trackers including our string trackers
    const allTrackers = await getAllTrackers(
      config,
      getRulesEngineComponentContract(rulesEngineContract, client),
      createResult.policyId
    )

    expect(allTrackers.length).toBe(2)
    const stringTrackers = allTrackers.filter((tracker) => tracker.pType === 1)
    expect(stringTrackers.length).toBe(2)
    console.log('All string trackers verified:', stringTrackers.length)

    // Test updating a string tracker
    const updatedStringTracker = `{
        "Name": "messageTracker",
        "Type": "string",
        "InitialValue": "updated hello world"
      }`

    console.log('Updating string tracker...')
    const updateResult = await updateTracker(
      config,
      getRulesEngineComponentContract(rulesEngineContract, client),
      createResult.policyId,
      createResult.trackers[0].trackerId,
      updatedStringTracker,
      1
    )

    expect(updateResult.trackerId).toBeGreaterThan(0)
    expect(updateResult.transactionHash).toMatch(/^0x[a-fA-F0-9]{64}$/)
    console.log('String tracker updated successfully:', updateResult)

    // Verify the update worked
    const updatedTrackerDetails = await getTracker(
      config,
      getRulesEngineComponentContract(rulesEngineContract, client),
      createResult.policyId,
      createResult.trackers[0].trackerId
    )

    expect(updatedTrackerDetails).not.toBeNull()
    expect(updatedTrackerDetails?.pType).toBe(1) // Still string type
    console.log('String tracker update verified successfully')

    console.log('✅ All string tracker functionality verified successfully!')
  })
})
