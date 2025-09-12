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
import { RulesEngine } from '../src/modules/rules-engine'
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
  isClosedPolicySubscriber,
  removeClosedPolicySubscriber,
  cementPolicy,
  isCementedPolicy,
  getPolicyMetadata,
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
import { PolicyData, trackerArrayType } from '../src/modules/types'
import { validatePolicyJSON } from '../src/modules/validation'

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
function assertPolicyDataMatchesInput(policyData: PolicyData, input: any) {
  // Top-level fields
  expect(policyData.name).toEqual(input.Policy)
  expect(policyData.description).toEqual(input.Description)
  expect(policyData.policyType).toEqual(input.PolicyType)

  // CallingFunctions
  expect(policyData.callingFunctions.length).toEqual(input.CallingFunctions.length)
  for (let i = 0; i < input.CallingFunctions.length; i++) {
    const cfIn = input.CallingFunctions[i]
    const cfData = policyData.callingFunctions[i]
    expect(cfData.functionSignature).toEqual(cfIn.functionSignature)
    expect(cfData.encodedValues).toEqual(cfIn.encodedValues)
    expect(cfData.name).toEqual(cfIn.name)
  }

  // ForeignCalls
  expect(policyData.foreignCalls.length).toEqual(input.ForeignCalls.length)
  for (let i = 0; i < input.ForeignCalls.length; i++) {
    const fcIn = input.ForeignCalls[i]
    const fcData = policyData.foreignCalls[i]
    expect(fcData.name).toEqual(fcIn.name)
    expect(fcData.function).toEqual(fcIn.function)
    expect(getAddress(fcData.address)).toEqual(getAddress(fcIn.address))
    expect(fcData.returnType).toEqual(fcIn.returnType)
    expect(fcData.valuesToPass).toEqual(fcIn.valuesToPass)
    expect(fcData.mappedTrackerKeyValues).toEqual(fcIn.mappedTrackerKeyValues)
    expect(fcData.callingFunction).toEqual(fcIn.callingFunction)
  }

  // Trackers
  expect(policyData.trackers.length).toEqual(input.Trackers.length)
  for (let i = 0; i < input.Trackers.length; i++) {
    const trIn = input.Trackers[i]
    const trData = policyData.trackers[i]
    expect(trData.name).toEqual(trIn.name)
    expect(trData.type).toEqual(trIn.type)
    expect(trData.initialValue).toEqual(trIn.initialValue)
  }

  // MappedTrackers
  expect(policyData.mappedTrackers.length).toEqual(input.MappedTrackers.length)
  for (let i = 0; i < input.MappedTrackers.length; i++) {
    const mIn = input.MappedTrackers[i]
    const mData = policyData.mappedTrackers[i]
    expect(mData.name).toEqual(mIn.name)
    expect(mData.keyType).toEqual(mIn.keyType)
    expect(mData.valueType).toEqual(mIn.valueType)
    expect(mData.initialKeys).toEqual(mIn.initialKeys)
    expect(mData.initialValues).toEqual(mIn.initialValues)
  }

  // Rules
  expect(policyData.rules.length).toEqual(input.Rules.length)
  for (let i = 0; i < input.Rules.length; i++) {
    const ruleIn = input.Rules[i]
    const ruleData = policyData.rules[i]
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
  test('Can create a rules engine object', async () => {
    var re = await RulesEngine.create(rulesEngineContract, config, client)
    expect(re).not.toBeNull()
  })
  test('Can create a new rule', async () => {
    var result = await createPolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      getRulesEngineRulesContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client),
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      1,
      emptyPolicyJSON
    )
    var callingFunction = 'addValue(uint256 value)'
    const fsId = await createCallingFunction(
      config,
      getRulesEngineComponentContract(rulesEngineContract, client),
      result.policyId,
      callingFunction,
      'uint256 value',
      1
    )
    var ruleStringA = `{
        "Name": "rule A",
        "Description": "rule A Description",
        "condition": "3 + 4 > 5 AND (1 == 1 AND 2 == 2)",
        "positiveEffects": ["revert"],
        "negativeEffects": [],
        "callingFunction": "addValue(uint256 value)"
        }`
    var ruleId = await createRule(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      getRulesEngineRulesContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client),
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      result.policyId,
      ruleStringA,
      [
        { id: 1, name: 'testCall', type: 0 },
        { id: 2, name: 'testCallTwo', type: 0 },
      ],
      [],
      1
    )
    expect(ruleId).toBeGreaterThan(0)
    var selector = toFunctionSelector(callingFunction)
    await updatePolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      result.policyId,
      [selector],
      [[ruleId]],
      'Test Policy',
      'This is a test policy',
      1
    )
    var rules = await getAllRules(config, getRulesEngineRulesContract(rulesEngineContract, client), result.policyId)
    expect(rules?.length).toEqual(1)
  })
  test('Can retrieve Rule Metadata', async () => {
    var result = await createPolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      getRulesEngineRulesContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client),
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      1,
      emptyPolicyJSON
    )
    var callingFunction = 'addValue(uint256 value)'
    const fsId = await createCallingFunction(
      config,
      getRulesEngineComponentContract(rulesEngineContract, client),
      result.policyId,
      callingFunction,
      'uint256 value',
      1
    )
    var ruleStringA = `{
        "Name": "rule A",
        "Description": "rule A Description",
        "condition": "3 + 4 > 5 AND (1 == 1 AND 2 == 2)",
        "positiveEffects": ["revert"],
        "negativeEffects": [],
        "callingFunction": "addValue(uint256 value)"
        }`
    var ruleId = await createRule(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      getRulesEngineRulesContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client),
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      result.policyId,
      ruleStringA,
      [
        { id: 1, name: 'testCall', type: 0 },
        { id: 2, name: 'testCallTwo', type: 0 },
      ],
      [],
      1
    )
    expect(ruleId).toBeGreaterThan(0)
    var selector = toFunctionSelector(callingFunction)
    await updatePolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      result.policyId,
      [selector],
      [[ruleId]],
      'Test Policy',
      'This is a test policy',
      1
    )
    var meta = await getRuleMetadata(
      config,
      getRulesEngineRulesContract(rulesEngineContract, client),
      result.policyId,
      ruleId
    )
    expect(meta?.ruleName).toEqual('rule A')
    expect(meta?.ruleDescription).toEqual('rule A Description')
  })
  test('Can delete a calling function', async () => {
    var result = await createPolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      getRulesEngineRulesContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client),
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      1,
      emptyPolicyJSON
    )
    var callingFunction = 'addValue(uint256 value)'
    const fsId = await createCallingFunction(
      config,
      getRulesEngineComponentContract(rulesEngineContract, client),
      result.policyId,
      callingFunction,
      'uint256 value',
      1
    )
    var ruleStringA = `{
                "Name": "rule A",
                "Description": "rule A Description",
                "condition": "3 + 4 > 5 AND (1 == 1 AND 2 == 2)",
                "positiveEffects": ["revert"],
                "negativeEffects": [],
                "callingFunction": "addValue(uint256 value)"
                }`
    var ruleId = await createRule(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      getRulesEngineRulesContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client),
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      result.policyId,
      ruleStringA,
      [
        { id: 1, name: 'testCall', type: 0 },
        { id: 2, name: 'testCallTwo', type: 0 },
      ],
      [],
      1
    )
    expect(ruleId).toBeGreaterThan(0)
    var selector = toFunctionSelector(callingFunction)
    await updatePolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      result.policyId,
      [selector],
      [[ruleId]],
      'Test Policy',
      'This is a test policy',
      1
    )
    var rules = await getAllRules(config, getRulesEngineRulesContract(rulesEngineContract, client), result.policyId)
    expect(rules?.length).toEqual(1)
    await deleteCallingFunction(
      config,
      getRulesEngineComponentContract(rulesEngineContract, client),
      result.policyId,
      fsId,
      1
    )
    var newRules = await getAllRules(config, getRulesEngineRulesContract(rulesEngineContract, client), result.policyId)
    expect(newRules?.length).toEqual(0)
  })
  test('Can update an existing rule', async () => {
    var result = await createPolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      getRulesEngineRulesContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client),
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      1,
      emptyPolicyJSON
    )
    var callingFunction = 'addValue(uint256 value)'
    const fsId = await createCallingFunction(
      config,
      getRulesEngineComponentContract(rulesEngineContract, client),
      result.policyId,
      callingFunction,
      'uint256 value',
      1
    )
    var ruleStringA = `{
            "Name": "rule A",
            "Description": "rule A Description",
            "condition": "3 + 4 > 5 AND (1 == 1 AND 2 == 2)",
            "positiveEffects": ["revert"],
            "negativeEffects": [],
            "callingFunction": "addValue(uint256 value)"
            }`
    var ruleId = await createRule(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      getRulesEngineRulesContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client),
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      result.policyId,
      ruleStringA,
      [],
      [
        { id: 1, name: 'testCall', type: 0 },
        { id: 2, name: 'testCallTwo', type: 0 },
      ],
      1
    )
    expect(ruleId).toBeGreaterThan(0)
    var selector = toFunctionSelector(callingFunction)
    await updatePolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      result.policyId,
      [selector],
      [[ruleId]],
      'Test Policy',
      'This is a test policy',
      1
    )
    var rules = await getAllRules(config, getRulesEngineRulesContract(rulesEngineContract, client), result.policyId)
    expect(rules?.length).toEqual(1)
    var ruleStringB = `{
            "Name": "rule A",
            "Description": "rule A Description",
            "condition": "3 + 4 > 5 AND (value == 1 AND 2 == 2)",
            "positiveEffects": ["revert"],
            "negativeEffects": [],
            "callingFunction": "addValue(uint256 value)"
            }`
    var updatedRuleId = await updateRule(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      getRulesEngineRulesContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client),
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      result.policyId,
      ruleId,
      ruleStringB,
      [
        { id: 1, name: 'testCall', type: 0 },
        { id: 2, name: 'testCallTwo', type: 0 },
      ],
      [],
      1
    )
    expect(updatedRuleId).toEqual(ruleId)
  })
  test('Can delete a rule', async () => {
    var result = await createPolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      getRulesEngineRulesContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client),
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      1,
      emptyPolicyJSON
    )
    var callingFunction = 'addValue(uint256 value)'
    const fsId = await createCallingFunction(
      config,
      getRulesEngineComponentContract(rulesEngineContract, client),
      result.policyId,
      callingFunction,
      'uint256 value',
      1
    )
    var ruleStringA = `{
            "Name": "rule A",
            "Description": "rule A Description",
            "condition": "3 + 4 > 5 AND (1 == 1 AND 2 == 2)",
            "positiveEffects": ["revert"],
            "negativeEffects": [],
            "callingFunction": "addValue(uint256 value)"
            }`
    var ruleId = await createRule(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      getRulesEngineRulesContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client),
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      result.policyId,
      ruleStringA,
      [
        { id: 1, name: 'testCall', type: 0 },
        { id: 2, name: 'testCallTwo', type: 0 },
      ],
      [],
      1
    )
    expect(ruleId).toBeGreaterThan(0)
    var selector = toFunctionSelector(callingFunction)
    await updatePolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      result.policyId,
      [selector],
      [[ruleId]],
      'Test Policy',
      'This is a test policy',
      1
    )

    var rules = await getAllRules(config, getRulesEngineRulesContract(rulesEngineContract, client), result.policyId)
    expect(rules?.length).toEqual(1)
    await deleteRule(config, getRulesEngineRulesContract(rulesEngineContract, client), result.policyId, ruleId, 1)
    var rules = await getAllRules(config, getRulesEngineRulesContract(rulesEngineContract, client), result.policyId)
    expect(rules?.length).toEqual(1)
    expect(rules?.[0]?.[0]?.instructionSet?.length ?? 0).toEqual(0)
  })
  test('Can create a new foreign call', async () => {
    var result = await createPolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      getRulesEngineRulesContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client),
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      1,
      emptyPolicyJSON
    )

    var callingFunction = 'someFunction(address to, string someString, uint256 value)'
    const fsId = await createCallingFunction(
      config,
      getRulesEngineComponentContract(rulesEngineContract, client),
      result.policyId,
      callingFunction,
      'address to, string someString, uint256 value',
      1
    )

    var selector = toFunctionSelector(callingFunction)
    await updatePolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      result.policyId,
      [selector],
      [[]],
      'Test Policy',
      'This is a test policy',
      1
    )

    var fcSyntax = `{
            "name": "Simple Foreign Call",
            "address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
            "function": "testSig(address,string,uint256)",
            "returnType": "uint256",
            "valuesToPass": "to, someString, value",
            "mappedTrackerKeyValues": "",
            "callingFunction": "someFunction(address to, string someString, uint256 value)"
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
      fcId
    )
    expect(fcRetrieve?.foreignCallIndex).toEqual(fcId)
    var fcAllRetrieve = await getAllForeignCalls(
      config,
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      result.policyId
    )
    expect(fcAllRetrieve?.length).toEqual(1)
  })

  test('Can create a new foreign call with a static array type', async () => {
    var result = await createPolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      getRulesEngineRulesContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client),
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      1,
      emptyPolicyJSON
    )

    var callingFunction = 'someFunction(address to, string someString, uint256[] values)'
    const fsId = await createCallingFunction(
      config,
      getRulesEngineComponentContract(rulesEngineContract, client),
      result.policyId,
      callingFunction,
      'address to, string someString, uint256[] values',
      1
    )

    var selector = toFunctionSelector(callingFunction)
    await updatePolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      result.policyId,
      [selector],
      [[]],
      'Test Policy',
      'This is a test policy',
      1
    )

    var fcSyntax = `{
              "name": "Simple Foreign Call",
              "address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
              "function": "testSig(address,string,uint256[])",
              "returnType": "uint256",
              "valuesToPass": "to, someString, values",
              "mappedTrackerKeyValues": "",
              "callingFunction": "someFunction(address to, string someString, uint256[] values)"
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
      fcId
    )
    expect(fcRetrieve?.foreignCallIndex).toEqual(fcId)
    expect(fcRetrieve?.parameterTypes[2]).toEqual(6)
  })

  test('Can delete a foreign call', async () => {
    var result = await createPolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      getRulesEngineRulesContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client),
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      1,
      emptyPolicyJSON
    )
    var callingFunction = 'someFunction(address to, string someString, uint256 value)'
    const fsId = await createCallingFunction(
      config,
      getRulesEngineComponentContract(rulesEngineContract, client),
      result.policyId,
      callingFunction,
      'address to, string someString, uint256 value',
      1
    )

    var selector = toFunctionSelector(callingFunction)
    await updatePolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      result.policyId,
      [selector],
      [[]],
      'Test Policy',
      'This is a test policy',
      1
    )
    var fcSyntax = `{
                      "name": "Simple Foreign Call",
                      "address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
                      "function": "testSig(address)",
                      "returnType": "uint256",
                      "valuesToPass": "to",
                      "mappedTrackerKeyValues": "",
                      "callingFunction": "someFunction(address to, string someString, uint256 value)"
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
      fcId
    )
    expect(fcRetrieve?.foreignCallIndex).toEqual(fcId)
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
      fcId,
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
  test('Can update an existing foreign call', async () => {
    var result = await createPolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      getRulesEngineRulesContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client),
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      1,
      emptyPolicyJSON
    )
    var callingFunction = 'someFunction(address to, string someString, uint256 value)'
    const fsId = await createCallingFunction(
      config,
      getRulesEngineComponentContract(rulesEngineContract, client),
      result.policyId,
      callingFunction,
      'address to, string someString, uint256 value',
      1
    )

    var selector = toFunctionSelector(callingFunction)
    await updatePolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      result.policyId,
      [selector],
      [[]],
      'Test Policy',
      'This is a test policy',
      1
    )
    var fcSyntax = `{
                  "name": "Simple Foreign Call",
                  "address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
                  "function": "testSig(address)",
                  "returnType": "uint256",
                  "valuesToPass": "to",
                  "mappedTrackerKeyValues": "",
                  "callingFunction": "someFunction(address to, string someString, uint256 value)"
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
      fcId
    )
    expect(fcRetrieve?.foreignCallIndex).toEqual(fcId)
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
                  "callingFunction": "someFunction(address to, string someString, uint256 value)"
              }`
    var updatedId = await updateForeignCall(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client),
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      result.policyId,
      fcId,
      updatedSyntax,
      1
    )
    expect(updatedId).toEqual(fcId)
  })
  test('Can create a new tracker', async () => {
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
      trId
    )
    expect(trRetrieve?.trackerValue).toEqual('0x0000000000000000000000000000000000000000000000000000000000000004')
  })
  test('Can delete a tracker', async () => {
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
      trId
    )
    expect(trRetrieve?.trackerValue).toEqual('0x0000000000000000000000000000000000000000000000000000000000000004')
    await deleteTracker(config, getRulesEngineComponentContract(rulesEngineContract, client), result.policyId, trId, 1)
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
  test('Can update an existing tracker', async () => {
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
      trId
    )
    expect(trRetrieve?.trackerValue).toEqual('0x0000000000000000000000000000000000000000000000000000000000000004')
    var updatedSyntax = `{
              "name": "Simple String Tracker",
              "type": "uint256",
              "initialValue": "5"
              }`
    await updateTracker(
      config,
      getRulesEngineComponentContract(rulesEngineContract, client),
      result.policyId,
      trId,
      updatedSyntax,
      1
    )
    var updatedTRRetrieve = await getTracker(
      config,
      getRulesEngineComponentContract(rulesEngineContract, client),
      result.policyId,
      trId
    )
    expect(updatedTRRetrieve?.trackerValue).toEqual(
      '0x0000000000000000000000000000000000000000000000000000000000000005'
    )
  })
  test('Can link a tracker to a rule and retrieve rule IDs', async () => {
    var policyJSON = `
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
              "name": "testSig(address)",
              "function": "testSig(address)",
              "address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
              "returnType": "uint256",
              "valuesToPass": "to",
              "mappedTrackerKeyValues": "",
              "callingFunction": "transfer(address to, uint256 value)"
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
              "positiveEffects": ["emit Success"],
              "negativeEffects": ["revert()"],
              "callingFunction": "transfer(address to, uint256 value)"
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
  test('Can retrieve a full simple policy', async () => {
    var policyJSON = `
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
                      "callingFunction": "transfer(address to, uint256 value)"
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
    expect(retVal!.Policy).toBeDefined()

    const parsed = retVal?.JSON ? JSON.parse(retVal?.JSON) : null

    const input = JSON.parse(policyJSON)
    input.Trackers[0].initialValue = '1000'
    input.Rules[0].negativeEffects = ["revert('Negative')"]
    input.Rules[0].positiveEffects = ["revert('Positive')"]

    expect(parsed).toEqual(input)
    expect(parsed.Policy).toEqual(input.Policy)

    // Verify Policy data mirrors input fields
    assertPolicyDataMatchesInput(retVal?.Policy!, input)
  })

  test('Can retrieve a full policy', async () => {
    var policyJSON = `
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
                     "name": "AnotherTestForeignCall",
                     "address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
                     "function": "AnotherTestForeignCall(address)",
                     "returnType": "uint256",
                     "valuesToPass": "to",
                     "mappedTrackerKeyValues": "",
                     "callingFunction": "transfer(address to, uint256 value)"
                 },
                 {
                     "name": "ATestForeignCall",
                     "address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
                     "function": "ATestForeignCall(address, uint256)",
                     "returnType": "uint256",
                     "valuesToPass": "FC:AnotherTestForeignCall, TR:trackerOne",
                     "mappedTrackerKeyValues": "",
                     "callingFunction": "transfer(address to, uint256 value)"
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
                       "condition": "FC:ATestForeignCall > 1000",
                       "positiveEffects": ["emit Success", "FC:AnotherTestForeignCall", "TRU:mappedTrackerOne(to) += 1"],
                       "negativeEffects": ["revert(\\\"Negative\\\")", "TRU:trackerOne += 12"],
                       "callingFunction": "transfer(address to, uint256 value)"
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
    console.log('Created policy with ID:', result.policyId)
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
    expect(retVal!.Policy).toBeDefined()

    const parsed = retVal?.JSON ? JSON.parse(retVal?.JSON) : null

    // TODOupdate the input to match known limitations with the reverse parser
    input.ForeignCalls[0].function = input.ForeignCalls[0].name
    input.ForeignCalls[1].function = input.ForeignCalls[1].name

    input.Rules[0].negativeEffects[0] = "revert('Negative')"

    expect(parsed).toEqual(input)
    expect(parsed.Policy).toEqual(input.Policy)
    // Verify Policy data mirrors input fields
    assertPolicyDataMatchesInput(retVal?.Policy!, input)
  })

  test('Can retrieve policy metadata', async () => {
    var policyJSON = `
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
                        "name": "testSig(address)",
                        "function": "testSig(address)",
                        "address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
                        "returnType": "uint256",
                        "valuesToPass": "to",
                        "mappedTrackerKeyValues": "",
                        "callingFunction": "transfer(address to, uint256 value)"
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
                        "positiveEffects": ["emit Success"],
                        "negativeEffects": ["revert()"],
                        "callingFunction": "transfer(address to, uint256 value)"
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

  test('Can retrieve historical metadata', async () => {
    var policyJSON = `
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
                        "name": "testSig(address)",
                        "function": "testSig(address)",
                        "address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
                        "returnType": "uint256",
                        "valuesToPass": "to",
                        "mappedTrackerKeyValues": "",
                        "callingFunction": "transfer(address to, uint256 value)"
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
                        "positiveEffects": ["emit Success"],
                        "negativeEffects": ["revert()"],
                        "callingFunction": "transfer(address to, uint256 value)"
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
    var updateResult = await updatePolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      result.policyId,
      [],
      [],
      'Updated Policy',
      'Updated Policy Description',
      1
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

  test('Can check if a policy exists', async () => {
    var policyJSON = `
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
              "name": "testSigTwo",
              "address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
              "function": "testSigTwo(uint256)",
              "returnType": "uint256",
              "valuesToPass": "TR:SimpleStringTracker",
              "mappedTrackerKeyValues": "to",
              "callingFunction": "transfer(address to, uint256 value)"
      },{
              "name": "testSig(address)",
              "address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
              "function": "testSig(uint256)",
              "returnType": "uint256",
              "valuesToPass": "FC:testSigTwo",
              "mappedTrackerKeyValues": "",
              "callingFunction": "transfer(address to, uint256 value)"
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
              "positiveEffects": ["emit Success"],
              "negativeEffects": ["revert()"],
              "callingFunction": "transfer(address to, uint256 value)"
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
  test(
    'Can delete a full policy',
    async () => {
      var policyJSON = `
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
    },
    { timeout: 15000 }
  )
  test('Can check if address is admin', async () => {
    var policyJSON = `
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
  })
  test('Can update a policies admin', options, async () => {
    var policyJSON = `
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
                   "name": "transfer(address to, uint256 value)",
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
                     "callingFunction": "transfer(address to, uint256 value)"
                 },
                 {
                     "name": "ATestForeignCall",
                     "address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
                     "function": "ATestForeignCall(address, uint256)",
                     "returnType": "uint256",
                     "valuesToPass": "FC:AnotherTestForeignCall, TR:trackerOne",
                     "mappedTrackerKeyValues": "",
                     "callingFunction": "transfer(address to, uint256 value)"
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
                       "positiveEffects": ["emit Success", "FC:AnotherTestForeignCall", "TRU:mappedTrackerOne(to) += 1"],
                       "negativeEffects": ["revert(\\\"Negative\\\")", "TRU:trackerOne += 12"],
                       "callingFunction": "transfer(address to, uint256 value)"
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
          "name": "transfer(address to, uint256 value)",
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
          "positiveEffects": ["emit RuleC"],
          "negativeEffects": ["revert()"],
          "callingFunction": "transfer(address to, uint256 value)",
          "order": 3
        },
        {
          "Name": "Rule A - Should be First",
          "Description": "First rule by order", 
          "condition": "value > 100",
          "positiveEffects": ["emit RuleA"],
          "negativeEffects": ["revert()"],
          "callingFunction": "transfer(address to, uint256 value)",
          "order": 1
        },
        {
          "Name": "Rule B - Should be Second",
          "Description": "Second rule by order",
          "condition": "value > 200", 
          "positiveEffects": ["emit RuleB"],
          "negativeEffects": ["revert()"],
          "callingFunction": "transfer(address to, uint256 value)",
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

    const parsed = retVal?.JSON ? JSON.parse(retVal?.JSON) : null
    expect(parsed).toBeDefined()
    expect(parsed.Rules).toHaveLength(3)

    // Verify that rules are in the correct order based on the 'order' field
    expect(parsed.Rules[0].Name).toEqual('Rule A - Should be First')
    expect(parsed.Rules[1].Name).toEqual('Rule B - Should be Second')
    expect(parsed.Rules[2].Name).toEqual('Rule C - Should be Third')

    // Also verify descriptions are preserved
    expect(parsed.Rules[0].Description).toEqual('First rule by order')
    expect(parsed.Rules[1].Description).toEqual('Second rule by order')
    expect(parsed.Rules[2].Description).toEqual('Third rule by order')
  }, 30000) // Increased timeout for GitHub Actions CI environment

  test("Should reject policy with self-referencing foreign call", async () => {
    var selfReferencingPolicyJSON = `
               {
               "Policy": "Self-Referencing Policy",
               "Description": "Policy with a self-referencing foreign call",
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
                     "name": "SelfReferencingCall",
                     "address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
                     "function": "SelfReferencingCall(uint256)",
                     "returnType": "uint256",
                     "valuesToPass": "FC:SelfReferencingCall",
                     "mappedTrackerKeyValues": "",
                     "callingFunction": "transfer(address to, uint256 value)"
                 }
               ],
               "Trackers": [],
               "MappedTrackers": [],
               "Rules": []
               }`;

    try {
      await createPolicy(
        config,
        getRulesEnginePolicyContract(rulesEngineContract, client),
        getRulesEngineRulesContract(rulesEngineContract, client),
        getRulesEngineComponentContract(rulesEngineContract, client),
        getRulesEngineForeignCallContract(rulesEngineContract, client),
        1,
        selfReferencingPolicyJSON
      );
      expect.fail("Policy creation should have failed due to self-referencing foreign call");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain("cannot reference itself");
      expect((error as Error).message).toContain("Self-referential foreign calls are not allowed");
    }
  }, 30000); // Increased timeout for GitHub Actions CI environment



  test("Can create policy with name-only references in rules and foreign calls", async () => {
    var policyJSON = `
      {
      "Policy": "Name Reference Test Policy",
      "Description": "Test Policy with name-only references",
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
              "name": "testNameRef",
              "address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
              "function": "testNameRef(uint256)",
              "returnType": "uint256",
              "valuesToPass": "value",
              "mappedTrackerKeyValues": "",
              "callingFunction": "transfer"
          }
      ],
      "Trackers": [],
      "MappedTrackers": [],
      "Rules": [
          {
              "Name": "Rule with Name Reference",
              "Description": "Rule using name-only reference",
              "condition": "value > 500",
              "positiveEffects": ["emit Success"],
              "negativeEffects": ["revert()"],
              "callingFunction": "transfer"
          }
          ]
          }`;
    var result = await createPolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      getRulesEngineRulesContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client),
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      1,
      policyJSON
    );
    expect(result.policyId).toBeGreaterThan(0);
    var resultFC = await getAllForeignCalls(
      config,
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      result.policyId
    );

    expect(resultFC?.length).toEqual(1);
  }, 30000); // Increased timeout for GitHub Actions CI environment

});

