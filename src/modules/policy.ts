/// SPDX-License-Identifier: BUSL-1.1

import { toFunctionSelector, Address, getAddress } from 'viem'

import { Config, readContract, simulateContract, waitForTransactionReceipt, writeContract } from '@wagmi/core'

import {
  parseCallingFunction,
  parseForeignCallDefinition,
  parseMappedTrackerSyntax,
  parseTrackerSyntax,
} from '../parsing/parser'
import {
  RulesEnginePolicyContract,
  RulesEngineComponentContract,
  NameToID,
  ForeignCallOnChain,
  TrackerOnChain,
  hexToFunctionString,
  RulesEngineRulesContract,
  RulesEngineForeignCallContract,
  PolicyMetadataStruct,
  Maybe,
  ForeignCallEncodedIndex,
  TrackerMetadataStruct,
  ContractBlockParameters,
  convertToVersionStruct,
  SUPPORTEDVERSION,
} from './types'
import { createForeignCall, getAllForeignCalls, getForeignCallMetadata, updateForeignCall } from './foreign-calls'
import { createRule, getRuleMetadata, getAllRules, updateRule } from './rules'
import { createMappedTracker, getAllTrackers, getTrackerMetadata, updateMappedTracker, updateTracker } from './trackers'
import { sleep } from './contract-interaction-utils'
import {
  createCallingFunction,
  getCallingFunctionMetadata,
  getCallingFunctions,
  updateCallingFunction,
} from './calling-functions'
import { createTracker } from './trackers'
import {
  convertOnChainRuleStructToString,
  convertForeignCallStructsToStrings,
  convertTrackerStructsToStrings,
} from '../parsing/reverse-parsing-logic'

import {
  CallingFunctionJSON,
  getRulesErrorMessages,
  PolicyJSON,
  validatePolicyJSON,
  createCallingFunctionLookupMaps,
  resolveCallingFunction,
  ForeignCallJSON,
} from './validation'
import { isLeft, unwrapEither } from './utils'
import { ru } from 'zod/v4/locales/index.cjs'

/**
 * @file policy.ts
 * @description This module provides a comprehensive set of functions for interacting with the Policies within the Rules Engine smart contracts.
 *              It includes functionality for creating, updating, retrieving, and deleting policies.
 *
 * @module policy
 *
 * @dependencies
 * - `viem`: Provides utilities for encoding/decoding data and interacting with Ethereum contracts.
 * - `parser`: Contains helper functions for parsing rule syntax, trackers, and foreign calls.
 * - `@wagmi/core`: Provides utilities for simulating, reading, and writing to Ethereum contracts.
 * - `config`: Provides configuration for interacting with the blockchain.
 *
 *
 * @author @mpetersoCode55, @ShaneDuncan602, @TJ-Everett, @VoR0220
 *
 * @license BUSL-1.1
 *
 * @note This file is a critical component of the Rules Engine SDK, enabling seamless integration with the Rules Engine smart contracts.
 */

/**
 * Creates a policy in the Rules Engine, including rules, trackers, and foreign calls.
 *
 * @param rulesEnginePolicyContract - The contract instance for interacting with the Rules Engine Policy.
 * @param rulesEngineRulesContract - The contract instance for interacting with the Rules Engine Rules.
 * @param rulesEngineComponentContract - The contract instance for interacting with the Rules Engine Component.
 * @param policySyntax - The JSON string representing the policy syntax.
 * @returns The ID of the newly created policy.
 */
export const createPolicy = async (
  config: Config,
  rulesEnginePolicyContract: RulesEnginePolicyContract,
  rulesEngineRulesContract: RulesEngineRulesContract,
  rulesEngineComponentContract: RulesEngineComponentContract,
  rulesEngineForeignCallContract: RulesEngineForeignCallContract,
  confirmationCount: number,
  policySyntax?: string
): Promise<{
  callingFunctions: { functionId: number; transactionHash: `0x${string}` }[]
  trackers: { trackerId: number; transactionHash: `0x${string}` }[]
  foreignCalls: { foreignCallId: number; transactionHash: `0x${string}` }[]
  rules: { ruleId: number; transactionHash: `0x${string}` }[]
  policyId: number
  transactionHash: `0x${string}`
}> => {
  var fcIds: NameToID[] = []
  var trackerIds: NameToID[] = []

  let callingFunctions: string[] = []
  let callingFunctionParamSets: any[] = []
  let allFunctionMappings: hexToFunctionString[] = []
  var nonDuplicatedCallingFunctions: CallingFunctionJSON[] = []
  var policyId = -1
  var transactionHash: `0x${string}` = '0x0'

  if (policySyntax !== undefined) {
    const validatedPolicyJSON = validatePolicyJSON(policySyntax)
    if (isLeft(validatedPolicyJSON)) {
      throw new Error(getRulesErrorMessages(unwrapEither(validatedPolicyJSON)))
    }
    const policyJSON = unwrapEither(validatedPolicyJSON)

    const addPolicy = await simulateContract(config, {
      address: rulesEnginePolicyContract.address,
      abi: rulesEnginePolicyContract.abi,
      functionName: 'createPolicy',
      args: [1, policyJSON.Policy, policyJSON.Description],
    })
    transactionHash = await writeContract(config, {
      ...addPolicy.request,
      account: config.getClient().account,
    })
    const transactionReceipt = await waitForTransactionReceipt(config, {
      confirmations: confirmationCount,
      hash: transactionHash,
    })

    policyId = addPolicy.result
    let callingFunctionResults
    try {
      callingFunctionResults = await buildCallingFunctions(
        config,
        rulesEnginePolicyContract,
        rulesEngineComponentContract,
        callingFunctions,
        policyJSON,
        policyId,
        callingFunctionParamSets,
        allFunctionMappings,
        nonDuplicatedCallingFunctions,
        confirmationCount,
        true
      )
    } catch (err) {
      throw err
    }

    // Create lookup maps for O(1) resolution instead of O(n) find operations
    const lookupMaps = createCallingFunctionLookupMaps(nonDuplicatedCallingFunctions)

    /**
     * Helper function to resolve calling function name to full signature.
     * Uses the lookup maps for O(1) performance.
     */
    const resolveFunction = (callingFunctionRef: string): string => {
      return resolveCallingFunction(callingFunctionRef, lookupMaps)
    }

    let trackerResults
    try {
      trackerResults = await buildTrackers(
        config,
        rulesEnginePolicyContract,
        rulesEngineComponentContract,
        trackerIds,
        policyJSON,
        policyId,
        confirmationCount,
        true
      )
    } catch (err) {
      throw err
    }

    let foreignCallResults
    try {
      foreignCallResults = await buildForeignCalls(
        config,
        rulesEnginePolicyContract,
        rulesEngineComponentContract,
        rulesEngineForeignCallContract,
        callingFunctions,
        policyJSON,
        policyId,
        callingFunctionParamSets,
        fcIds,
        trackerIds,
        resolveFunction,
        confirmationCount,
        true
      )
    } catch (err) {
      throw err
    }

    let rulesResults
    try {
      rulesResults = await buildRules(
        config,
        rulesEnginePolicyContract,
        rulesEngineComponentContract,
        rulesEngineForeignCallContract,
        rulesEngineRulesContract,
        callingFunctions,
        policyJSON,
        policyId,
        fcIds,
        trackerIds,
        resolveFunction,
        confirmationCount,
        true
      )
    } catch (err) {
      throw err
    }

    return {
      callingFunctions: callingFunctionResults,
      trackers: trackerResults,
      foreignCalls: foreignCallResults,
      rules: rulesResults.transactionHashes,
      policyId,
      transactionHash,
    }
  }
  return {
    callingFunctions: [],
    trackers: [],
    foreignCalls: [],
    rules: [],
    policyId: -1,
    transactionHash: '0x0',
  }
}

const buildCallingFunctions = async (
  config: Config,
  rulesEnginePolicyContract: RulesEnginePolicyContract,
  rulesEngineComponentContract: RulesEngineComponentContract,
  callingFunctions: string[],
  policyJSON: PolicyJSON,
  policyId: number,
  callingFunctionParamSets: string[][],
  allFunctionMappings: any[],
  nonDuplicatedCallingFunctions: CallingFunctionJSON[],
  confirmationCount: number,
  create: boolean
): Promise<{ functionId: number; transactionHash: `0x${string}` }[]> => {
  var fsSelectors = []
  var fsIds = []
  var emptyRules = []
  var existingIds = []
  var transactionHashes: { functionId: number; transactionHash: `0x${string}` }[] = []
  if (policyId > 0) {
    var existingCallingFunctions = await getCallingFunctions(config, rulesEngineComponentContract, policyId)
    for (var callingFunc of existingCallingFunctions) {
      existingIds.push(callingFunc.signature)
    }
  }
  for (var callingFunctionJSON of policyJSON.CallingFunctions) {
    var callingFunction = callingFunctionJSON.FunctionSignature
    if (!callingFunctions.includes(callingFunction)) {
      let result: { functionId: number; transactionHash: `0x${string}` }
      if (existingIds.includes(toFunctionSelector(callingFunction))) {
        result = await updateCallingFunction(
          config,
          rulesEngineComponentContract,
          policyId,
          callingFunction,
          callingFunctionJSON.Name,
          callingFunctionJSON.EncodedValues,
          confirmationCount
        )
      } else {
        result = await createCallingFunction(
          config,
          rulesEngineComponentContract,
          policyId,
          callingFunction,
          callingFunctionJSON.Name,
          callingFunctionJSON.EncodedValues,
          confirmationCount
        )
      }
      if (result.functionId != -1) {
        transactionHashes.push(result)
        nonDuplicatedCallingFunctions.push(callingFunctionJSON)
        callingFunctions.push(callingFunction)
        callingFunctionParamSets.push(parseCallingFunction(callingFunctionJSON))
        allFunctionMappings.push({
          hex: toFunctionSelector(callingFunction),
          functionString: callingFunction,
          encodedValues: callingFunctionJSON.EncodedValues,
          index: -1,
        })
        var selector = toFunctionSelector(callingFunction)
        fsSelectors.push(selector)
        fsIds.push(result.functionId)
        emptyRules.push([])
      } else {
        if (create) {
          var deleteVerification = await deletePolicy(config, rulesEnginePolicyContract, policyId, confirmationCount)
          if (deleteVerification.result == -1) {
            throw new Error(
              `Invalid calling function syntax: ${JSON.stringify(
                callingFunction
              )} Failed to delete policy. Partial Policy with id: ${policyId} exists`
            )
          } else {
            throw new Error(`Invalid calling function syntax: ${JSON.stringify(callingFunction)} Policy Deleted`)
          }
        } else {
          throw new Error(`Invalid calling function syntax: ${JSON.stringify(callingFunction)}`)
        }
      }
    } else {
      console.log('Policy JSON contained a duplicate calling function, the duplicate was not created')
    }
  }

  await updatePolicyInternal(
    config,
    rulesEnginePolicyContract,
    policyId,
    fsSelectors,
    emptyRules,
    policyJSON.Policy,
    policyJSON.Description,
    confirmationCount
  )

  return transactionHashes
}

const buildTrackers = async (
  config: Config,
  rulesEnginePolicyContract: RulesEnginePolicyContract,
  rulesEngineComponentContract: RulesEngineComponentContract,
  trackerIds: NameToID[],
  policyJSON: PolicyJSON,
  policyId: number,
  confirmationCount: number,
  create: boolean
): Promise<{ trackerId: number; transactionHash: `0x${string}` }[]> => {
  var transactionHashes: { trackerId: number; transactionHash: `0x${string}` }[] = []

  if (policyJSON.Trackers != null) {
    for (var tracker of policyJSON.Trackers) {
      const parsedTracker = parseTrackerSyntax(tracker)
      let result: { trackerId: number; transactionHash: `0x${string}` }
      if (tracker.Id !== undefined) {
        result = await updateTracker(
          config,
          rulesEngineComponentContract,
          policyId,
          tracker.Id,
          JSON.stringify(tracker),
          confirmationCount
        )
      } else {
        result = await createTracker(
          config,
          rulesEngineComponentContract,
          policyId,
          JSON.stringify(tracker),
          confirmationCount
        )
      }
      if (result.trackerId != -1) {
        transactionHashes.push(result)
        var struc: NameToID = {
          id: result.trackerId,
          name: parsedTracker.name,
          type: parsedTracker.type,
        }
        trackerIds.push(struc)
      } else {
        if (create) {
          var deleteVerification = await deletePolicy(config, rulesEnginePolicyContract, policyId, confirmationCount)
          if (deleteVerification.result == -1) {
            throw new Error(
              `Invalid tracker syntax: ${JSON.stringify(tracker)}
              Failed to delete policy. Partial Policy with id: ${policyId} exists`
            )
          } else {
            throw new Error(`Invalid tracker syntax: ${JSON.stringify(tracker)} Policy Deleted`)
          }
        } else {
          throw new Error(`Invalid tracker syntax: ${JSON.stringify(tracker)}`)
        }
      }
    }
  }

  if (policyJSON.MappedTrackers != null) {
    for (var mTracker of policyJSON.MappedTrackers) {
      const parsedTracker = parseMappedTrackerSyntax(mTracker)
      let trId = -1
      let trackerTransactionHash: `0x${string}` = '0x0'
      if (mTracker.Id !== undefined) {
        const trackerResult = await updateMappedTracker(
          config,
          rulesEngineComponentContract,
          policyId,
          JSON.stringify(mTracker),
          mTracker.Id,
          confirmationCount
        )
        trId = trackerResult.trackerId
        trackerTransactionHash = trackerResult.transactionHash
      } else {
        const trackerResult = await createMappedTracker(
          config,
          rulesEngineComponentContract,
          policyId,
          JSON.stringify(mTracker),
          confirmationCount
        )
        trId = trackerResult.trackerId
        trackerTransactionHash = trackerResult.transactionHash
      }
      if (trId != -1) {
        var struc: NameToID = {
          id: trId,
          name: parsedTracker.name,
          type: parsedTracker.valueType,
        }
        trackerIds.push(struc)
        transactionHashes.push({ trackerId: trId, transactionHash: trackerTransactionHash })
      } else {
        throw new Error(`Invalid mapped tracker syntax: ${JSON.stringify(mTracker)}`)
      }
    }
  }

  return transactionHashes
}

const buildForeignCalls = async (
  config: Config,
  rulesEnginePolicyContract: RulesEnginePolicyContract,
  rulesEngineComponentContract: RulesEngineComponentContract,
  rulesEngineForeignCallContract: RulesEngineForeignCallContract,
  callingFunctions: string[],
  policyJSON: PolicyJSON,
  policyId: number,
  callingFunctionParamSets: string[][],
  fcIds: NameToID[],
  trackerIds: NameToID[],
  resolveFunction: any,
  confirmationCount: number,
  create: boolean
): Promise<{ foreignCallId: number; transactionHash: `0x${string}` }[]> => {
  var transactionHashes: { foreignCallId: number; transactionHash: `0x${string}` }[] = []

  if (policyJSON.ForeignCalls != null) {
    for (var foreignCall of policyJSON.ForeignCalls) {
      const resolvedForeignCallFunction = resolveFunction(foreignCall.CallingFunction)
      try {
        // Find the calling function and its encoded values using the resolved function name
        let callingFunctionIndex = callingFunctions.findIndex((cf) => cf.trim() === resolvedForeignCallFunction.trim())
        let encodedValues: string[]

        if (callingFunctionIndex === -1) {
          // Calling function not found in current update, check if it exists from previous updates
          const existingCallingFunctions = await getCallingFunctions(config, rulesEngineComponentContract, policyId)
          const existingFunction = existingCallingFunctions.find((cf) => {
            // Try to match by function selector
            try {
              const selector = toFunctionSelector(resolvedForeignCallFunction)
              return cf.signature === selector
            } catch {
              return false
            }
          })

          if (!existingFunction) {
            if (create) {
              var deleteVerification = await deletePolicy(
                config,
                rulesEnginePolicyContract,
                policyId,
                confirmationCount
              )
              if (deleteVerification.result == -1) {
                throw new Error(
                  `Calling function not found: ${resolvedForeignCallFunction}
               Failed to delete policy. Partial Policy with id: ${policyId} exists`
                )
              } else {
                throw new Error(`Calling function not found: ${resolvedForeignCallFunction} Policy Deleted`)
              }
            } else {
              throw new Error(`Calling function not found: ${resolvedForeignCallFunction}`)
            }
          }

          // Use the existing function's parameter types as encoded values
          encodedValues = existingFunction.parameterTypes.map(String)
        } else {
          encodedValues = callingFunctionParamSets[callingFunctionIndex]
        }

        // Create a copy of the foreign call with the resolved calling function name
        const resolvedForeignCall = {
          ...foreignCall,
          callingFunction: foreignCall.CallingFunction,
        }

        const fcStruct = parseForeignCallDefinition(resolvedForeignCall, fcIds, trackerIds, encodedValues)
        let result: { foreignCallId: number; transactionHash: `0x${string}` }
        if (foreignCall.Id !== undefined) {
          result = await updateForeignCall(
            config,
            rulesEnginePolicyContract,
            rulesEngineComponentContract,
            rulesEngineForeignCallContract,
            policyId,
            foreignCall.Id,
            JSON.stringify(resolvedForeignCall),
            confirmationCount
          )
        } else {
          result = await createForeignCall(
            config,
            rulesEngineForeignCallContract,
            rulesEngineComponentContract,
            rulesEnginePolicyContract,
            policyId,
            JSON.stringify(resolvedForeignCall),
            confirmationCount
          )
        }

        // Only add successfully created foreign calls to the mapping
        if (result.foreignCallId !== -1) {
          transactionHashes.push(result)
          var struc: NameToID = {
            id: result.foreignCallId,
            name: fcStruct.Name.split('(')[0],
            type: 0,
          }
          fcIds.push(struc)
        } else {
          if (create) {
            var deleteVerification = await deletePolicy(config, rulesEnginePolicyContract, policyId, confirmationCount)
            if (deleteVerification.result == -1) {
              throw new Error(
                `Invalid foreign call syntax: ${JSON.stringify(foreignCall)}
               Failed to delete policy. Partial Policy with id: ${policyId} exists`
              )
            } else {
              throw new Error(`Invalid foreign call syntax: ${JSON.stringify(foreignCall)}Policy Deleted`)
            }
          } else {
            throw new Error(`Invalid foreign call syntax: ${JSON.stringify(foreignCall)}`)
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)

        // Re-throw self-reference validation errors to fail the policy creation
        if (errorMessage.includes('cannot reference itself')) {
          if (create) {
            var deleteVerification = await deletePolicy(config, rulesEnginePolicyContract, policyId, confirmationCount)
            if (deleteVerification.result == -1) {
              throw new Error(errorMessage + 'Failed to delete policy. Partial Policy with id: ${policyId} exists')
            } else {
              throw new Error(errorMessage + 'Policy Deleted')
            }
          } else {
            throw error
          }
        }

        // For other errors, log and continue (existing behavior)
        console.error(`Skipping foreign call ${foreignCall.Name}: ${errorMessage}`)
      }
    }
  }

  return transactionHashes
}

const buildRules = async (
  config: Config,
  rulesEnginePolicyContract: RulesEnginePolicyContract,
  rulesEngineComponentContract: RulesEngineComponentContract,
  rulesEngineForeignCallContract: RulesEngineForeignCallContract,
  rulesEngineRulesContract: RulesEngineRulesContract,
  callingFunctions: string[],
  policyJSON: PolicyJSON,
  policyId: number,
  fcIds: NameToID[],
  trackerIds: NameToID[],
  resolveFunction: any,
  confirmationCount: number,
  create: boolean
): Promise<{ transactionHashes: { ruleId: number; transactionHash: `0x${string}` }[]; policyId: number }> => {
  let ruleIds = []
  let ruleToCallingFunction = new Map<string, number[]>()
  let rulesDoubleMapping = []
  let callingFunctionSelectors = []
  var transactionHashes: { ruleId: number; transactionHash: `0x${string}` }[] = []
  // Sort rules by order field if provided, otherwise maintain original order
  const sortedRules = [...policyJSON.Rules].sort((a, b) => {
    const orderA = a.Order !== undefined ? a.Order : Number.MAX_SAFE_INTEGER
    const orderB = b.Order !== undefined ? b.Order : Number.MAX_SAFE_INTEGER
    return orderA - orderB
  })

  for (var rule of sortedRules) {
    let result: { ruleId: number; transactionHash: `0x${string}` }
    if (rule.Id !== undefined) {
      result = await updateRule(
        config,
        rulesEnginePolicyContract,
        rulesEngineRulesContract,
        rulesEngineComponentContract,
        rulesEngineForeignCallContract,
        policyId,
        rule.Id,
        JSON.stringify(rule),
        fcIds,
        trackerIds,
        confirmationCount
      )
    } else {
      result = await createRule(
        config,
        rulesEnginePolicyContract,
        rulesEngineRulesContract,
        rulesEngineComponentContract,
        rulesEngineForeignCallContract,
        policyId,
        JSON.stringify(rule),
        fcIds,
        trackerIds,
        confirmationCount
      )
    }

    if (result.ruleId == -1) {
      if (create) {
        var deleteVerification = await deletePolicy(config, rulesEnginePolicyContract, policyId, confirmationCount)
        if (deleteVerification.result == -1) {
          throw new Error(
            `Invalid rule syntax: ${JSON.stringify(
              rule
            )} Failed to delete policy. Partial Policy with id: ${policyId} exists`
          )
        } else {
          throw new Error(`Invalid rule syntax: ${JSON.stringify(rule)} Policy Deleted`)
        }
      } else {
        throw new Error(`Invalid rule syntax: ${JSON.stringify(rule)}`)
      }
    }
    transactionHashes.push(result)
    ruleIds.push(result.ruleId)
    const resolvedCallingFunction = resolveFunction(rule.CallingFunction)
    if (ruleToCallingFunction.has(resolvedCallingFunction)) {
      ruleToCallingFunction.get(resolvedCallingFunction)?.push(result.ruleId)
    } else {
      ruleToCallingFunction.set(resolvedCallingFunction, [result.ruleId])
    }
  }
  for (var cf of callingFunctions) {
    if (ruleToCallingFunction.has(cf)) {
      rulesDoubleMapping.push(ruleToCallingFunction.get(cf))
    } else {
      rulesDoubleMapping.push([])
    }
    callingFunctionSelectors.push(toFunctionSelector(cf))
  }

  policyId = await updatePolicyInternal(
    config,
    rulesEnginePolicyContract,
    policyId,
    callingFunctionSelectors,
    rulesDoubleMapping,
    policyJSON.Policy,
    policyJSON.Description,
    confirmationCount
  )

  return { transactionHashes, policyId }
}

/**
 * Updates a policy in the Rules Engine, including rules, trackers, and foreign calls.
 *
 * @param rulesEnginePolicyContract - The contract instance for interacting with the Rules Engine Policy.
 * @param rulesEngineRulesContract - The contract instance for interacting with the Rules Engine Rules.
 * @param rulesEngineComponentContract - The contract instance for interacting with the Rules Engine Component.
 * @param policySyntax - The JSON string representing the policy syntax.
 * @param policyId - the ID of the policy to be updated
 * @returns The ID of the updated policy.
 */
export const updatePolicy = async (
  config: Config,
  rulesEnginePolicyContract: RulesEnginePolicyContract,
  rulesEngineRulesContract: RulesEngineRulesContract,
  rulesEngineComponentContract: RulesEngineComponentContract,
  rulesEngineForeignCallContract: RulesEngineForeignCallContract,
  confirmationCount: number,
  policySyntax: string,
  policyId: number
): Promise<{
  callingFunctions: { functionId: number; transactionHash: `0x${string}` }[]
  trackers: { trackerId: number; transactionHash: `0x${string}` }[]
  foreignCalls: { foreignCallId: number; transactionHash: `0x${string}` }[]
  rules: { ruleId: number; transactionHash: `0x${string}` }[]
  policyId: number
}> => {
  var fcIds: NameToID[] = []
  var trackerIds: NameToID[] = []
  let callingFunctions: string[] = []
  let callingFunctionParamSets: any[] = []
  let allFunctionMappings: hexToFunctionString[] = []
  var nonDuplicatedCallingFunctions: CallingFunctionJSON[] = []
  if (policySyntax !== undefined) {
    const validatedPolicyJSON = validatePolicyJSON(policySyntax)
    if (isLeft(validatedPolicyJSON)) {
      throw new Error(getRulesErrorMessages(unwrapEither(validatedPolicyJSON)))
    }
    const policyJSON = unwrapEither(validatedPolicyJSON)
    let callingFunctionResults
    try {
      callingFunctionResults = await buildCallingFunctions(
        config,
        rulesEnginePolicyContract,
        rulesEngineComponentContract,
        callingFunctions,
        policyJSON,
        policyId,
        callingFunctionParamSets,
        allFunctionMappings,
        nonDuplicatedCallingFunctions,
        confirmationCount,
        false
      )
    } catch (err) {
      throw err
    }

    // Create lookup maps for O(1) resolution instead of O(n) find operations
    const lookupMaps = createCallingFunctionLookupMaps(nonDuplicatedCallingFunctions)

    /**
     * Helper function to resolve calling function name to full signature.
     * Uses the lookup maps for O(1) performance.
     */
    const resolveFunction = (callingFunctionRef: string): string => {
      return resolveCallingFunction(callingFunctionRef, lookupMaps)
    }

    let trackerResults
    try {
      trackerResults = await buildTrackers(
        config,
        rulesEnginePolicyContract,
        rulesEngineComponentContract,
        trackerIds,
        policyJSON,
        policyId,
        confirmationCount,
        false
      )
    } catch (err) {
      throw err
    }

    let foreignCallResults
    try {
      foreignCallResults = await buildForeignCalls(
        config,
        rulesEnginePolicyContract,
        rulesEngineComponentContract,
        rulesEngineForeignCallContract,
        callingFunctions,
        policyJSON,
        policyId,
        callingFunctionParamSets,
        fcIds,
        trackerIds,
        resolveFunction,
        confirmationCount,
        false
      )
    } catch (err) {
      throw err
    }

    let rulesResults
    try {
      rulesResults = await buildRules(
        config,
        rulesEnginePolicyContract,
        rulesEngineComponentContract,
        rulesEngineForeignCallContract,
        rulesEngineRulesContract,
        callingFunctions,
        policyJSON,
        policyId,
        fcIds,
        trackerIds,
        resolveFunction,
        confirmationCount,
        false
      )
    } catch (err) {
      throw err
    }

    return {
      callingFunctions: callingFunctionResults,
      trackers: trackerResults,
      foreignCalls: foreignCallResults,
      rules: rulesResults.transactionHashes,
      policyId: rulesResults.policyId,
    }
  }
  return {
    callingFunctions: [],
    trackers: [],
    foreignCalls: [],
    rules: [],
    policyId: -1,
  }
}

/**
 * Updates an existing policy in the Rules Engine.
 *
 * @param config - The configuration object containing network and wallet information.
 * @param rulesEnginePolicyContract - The contract instance for interacting with the Rules Engine Policy.
 * @param policyId - The ID of the policy to update.
 * @param signatures - The function signatures associated with the policy.
 * @param ids - The IDs of the rules associated with the policy.
 * @param ruleIds - The mapping of rules to calling functions.
 * @returns The result of the policy update if successful, or -1 if an error occurs.
 */
const updatePolicyInternal = async (
  config: Config,
  rulesEnginePolicyContract: RulesEnginePolicyContract,
  policyId: number,
  signatures: any[],
  ruleIds: any[],
  policyName: string,
  policyDescription: string,
  confirmationCount: number
): Promise<number> => {
  var updatePolicy
  while (true) {
    try {
      updatePolicy = await simulateContract(config, {
        address: rulesEnginePolicyContract.address,
        abi: rulesEnginePolicyContract.abi,
        functionName: 'updatePolicy',
        args: [policyId, signatures, ruleIds, 1, policyName, policyDescription],
      })
      break
    } catch (error) {
      // TODO: Look into replacing this loop/sleep with setTimeout
      await sleep(1000)
    }
  }
  if (updatePolicy != null) {
    const returnHash = await writeContract(config, {
      ...updatePolicy.request,
      account: config.getClient().account,
    })
    await waitForTransactionReceipt(config, {
      confirmations: confirmationCount,
      hash: returnHash,
    })

    return updatePolicy.result
  }

  return -1
}

/**
 * Sets the policies applied to a specific contract address.
 *
 * @param config - The configuration object containing network and wallet information.
 * @param rulesEnginePolicyContract - The contract instance for interacting with the Rules Engine Policy.
 * @param policyIds - The list of IDs of all of the policies that will be applied to the contract
 * @param contractAddressForPolicy - The address of the contract to which the policy will be applied.
 */
export const setPolicies = async (
  config: Config,
  rulesEnginePolicyContract: RulesEnginePolicyContract,
  policyIds: [number],
  contractAddressForPolicy: Address,
  confirmationCount: number
): Promise<{ transactionHash: `0x${string}` }> => {
  var applyPolicy
  while (true) {
    try {
      applyPolicy = await simulateContract(config, {
        address: rulesEnginePolicyContract.address,
        abi: rulesEnginePolicyContract.abi,
        functionName: 'applyPolicy',
        args: [contractAddressForPolicy, policyIds],
      })
      break
    } catch (error) {
      // TODO: Look into replacing this loop/sleep with setTimeout
      await sleep(1000)
    }
  }

  if (applyPolicy != null) {
    const transactionHash = await writeContract(config, {
      ...applyPolicy.request,
      account: config.getClient().account,
    })
    await waitForTransactionReceipt(config, {
      confirmations: confirmationCount,
      hash: transactionHash,
    })
    return { transactionHash }
  }
  return { transactionHash: '0x0' as `0x${string}` }
}

/**
 * Unsets the policies applied to a specific contract address.
 *
 * @param config - The configuration object containing network and wallet information.
 * @param rulesEnginePolicyContract - The contract instance for interacting with the Rules Engine Policy.
 * @param policyIds - The list of IDs of all of the policies that will be applied to the contract
 * @param contractAddressForPolicy - The address of the contract to which the policy will be applied.
 */
export const unsetPolicies = async (
  config: Config,
  rulesEnginePolicyContract: RulesEnginePolicyContract,
  policyIds: [number],
  contractAddressForPolicy: Address,
  confirmationCount: number
): Promise<{ transactionHash: `0x${string}` }> => {
  var applyPolicy
  while (true) {
    try {
      applyPolicy = await simulateContract(config, {
        address: rulesEnginePolicyContract.address,
        abi: rulesEnginePolicyContract.abi,
        functionName: 'unapplyPolicy',
        args: [contractAddressForPolicy, policyIds],
      })
      break
    } catch (error) {
      // TODO: Look into replacing this loop/sleep with setTimeout
      await sleep(1000)
    }
  }

  if (applyPolicy != null) {
    const returnHash = await writeContract(config, {
      ...applyPolicy.request,
      account: config.getClient().account,
    })
    await waitForTransactionReceipt(config, {
      confirmations: confirmationCount,
      hash: returnHash,
    })
    return { transactionHash: returnHash }
  }

  return { transactionHash: '0x0' as `0x${string}` }
}

/**
 * Appends a policy to the list of policies applied to a specific contract address.
 *
 * @param config - The configuration object containing network and wallet information.
 * @param rulesEnginePolicyContract - The contract instance for interacting with the Rules Engine Policy.
 * @param policyId - The ID of the policy to apply.
 * @param contractAddressForPolicy - The address of the contract to which the policy will be applied.
 */
export const appendPolicy = async (
  config: Config,
  rulesEnginePolicyContract: RulesEnginePolicyContract,
  policyId: number,
  contractAddressForPolicy: Address,
  confirmationCount: number
): Promise<{ transactionHash: `0x${string}` }> => {
  const retrievePolicies = await readContract(config, {
    address: rulesEnginePolicyContract.address,
    abi: rulesEnginePolicyContract.abi,
    functionName: 'getAppliedPolicyIds',
    args: [contractAddressForPolicy],
  })

  let policyResult = retrievePolicies as [number]
  policyResult.push(policyId)

  return setPolicies(config, rulesEnginePolicyContract, policyResult, contractAddressForPolicy, confirmationCount)
}

/**
 * Deletes a policy from the Rules Engine.
 *
 * @param config - The configuration object containing network and wallet information.
 * @param rulesEnginePolicyContract - The contract instance for interacting with the Rules Engine Policy.
 * @param policyId - The ID of the policy to delete.
 * @returns Object with `result` (`0` if successful, `-1` if an error occurs) and `transactionHash`.
 */
export const deletePolicy = async (
  config: Config,
  rulesEnginePolicyContract: RulesEnginePolicyContract,
  policyId: number,
  confirmationCount: number
): Promise<{ result: number; transactionHash: `0x${string}` }> => {
  var addFC
  try {
    addFC = await simulateContract(config, {
      address: rulesEnginePolicyContract.address,
      abi: rulesEnginePolicyContract.abi,
      functionName: 'deletePolicy',
      args: [policyId],
    })
  } catch (err) {
    throw new Error(`Failed to simulate delete policy transaction: ${err}`)
  }

  if (addFC != null) {
    const transactionHash = await writeContract(config, {
      ...addFC.request,
      account: config.getClient().account,
    })
    await waitForTransactionReceipt(config, {
      confirmations: confirmationCount,
      hash: transactionHash,
    })

    return { result: 0, transactionHash }
  }

  throw new Error('Failed to delete policy: simulation returned null')
}

const getFunctionArgument = (encodedArgs: string, index: number): string => {
  const args = encodedArgs.split(', ')
  const arg = args[index]
  if (!arg) throw new Error(`No argument found at index ${index}`)
  return arg.split(' ')[1] // Remove type information
}

const getForeignCallArgument = (foreignCallNames: string[], index: number): string => {
  let name = foreignCallNames[Number(BigInt(index) - 1n)]
  name = name.split('(')[0]
  if (!name) throw new Error(`No argument found at index ${index}`)
  return `FC:${name}`
}

const getTrackerArgument = (trackerNames: TrackerMetadataStruct[], index: number): string => {
  let name = trackerNames[Number(BigInt(index) - 1n)].trackerName
  name = name.split('(')[0]
  if (!name) throw new Error(`No argument found at index ${index}`)
  return `TR:${name}`
}

const reverseParseEncodedArg = (
  encodedArgs: string,
  foreignCallNames: string[],
  encoded: ForeignCallEncodedIndex,
  trackerNames: TrackerMetadataStruct[]
): string => {
  switch (encoded.eType) {
    case 0:
      return getFunctionArgument(encodedArgs, encoded.index)
    case 1:
      return getForeignCallArgument(foreignCallNames, encoded.index)
    case 2:
      return getTrackerArgument(trackerNames, encoded.index)
      return ''
    default:
      throw new Error(`Unknown encoded argument type: ${encoded.eType}`)
  }
}

const reverseParseEncodedArgs = (
  callingArgs: string,
  foreignCallNames: string[],
  encoded: ForeignCallEncodedIndex[],
  trackerNames: TrackerMetadataStruct[]
): string => {
  return encoded.map((enc) => reverseParseEncodedArg(callingArgs, foreignCallNames, enc, trackerNames)).join(', ')
}

/**
 * Retrieves the version of the Rules Engine for a compatibility check.
 *
 * @param config - The configuration object containing network and wallet information.
 * @param rulesEnginePolicyContract - The contract instance for interacting with the Rules Engine Policy.
 * @returns A string representation of the Rules Engine version.
 */
export const getRulesEngineVersion = async (
  config: Config,
  rulesEnginePolicyContract: RulesEnginePolicyContract
): Promise<string> => {
  try {
    const retrievePolicy = await readContract(config, {
      address: rulesEnginePolicyContract.address,
      abi: rulesEnginePolicyContract.abi,
      functionName: 'version',
      args: [],
    })
    return retrievePolicy as string
  } catch (error) {
    console.error(error)
    return ''
  }
}

export const getVersionCompatible = async (
  config: Config,
  rulesEnginePolicyContract: RulesEnginePolicyContract
): Promise<boolean> => {
  const reVersion = await getRulesEngineVersion(config, rulesEnginePolicyContract)
  const comparisonStruct = convertToVersionStruct(reVersion)
  return (
    comparisonStruct.major === SUPPORTEDVERSION.major &&
    (comparisonStruct.minor === SUPPORTEDVERSION.minor || SUPPORTEDVERSION.minor === '*') &&
    (comparisonStruct.tertiary === SUPPORTEDVERSION.tertiary || SUPPORTEDVERSION.tertiary === '*')
  )
}

/**
 * Retrieves the full policy, including rules, trackers, and foreign calls.
 *
 * @param config - The configuration object containing network and wallet information.
 * @param rulesEnginePolicyContract - The contract instance for interacting with the Rules Engine Policy.
 * @param rulesEngineRulesContract - The contract instance for interacting with the Rules Engine Rules.
 * @param rulesEngineComponentContract - The contract instance for interacting with the Rules Engine Component.
 * @param rulesEngineForeignCallContract - The contract instance for interacting with the Rules Engine Foreign Calls.
 * @param policyId - The ID of the policy to retrieve.
 * @param blockParams - Optional parameters to specify block number or tag for the contract read operation.
 * @returns A PolicyResult object containing both the policy object and JSON string, or an empty string if an error occurs.
 */
export const getPolicy = async (
  config: Config,
  rulesEnginePolicyContract: RulesEnginePolicyContract,
  rulesEngineRulesContract: RulesEngineRulesContract,
  rulesEngineComponentContract: RulesEngineComponentContract,
  rulesEngineForeignCallContract: RulesEngineForeignCallContract,
  policyId: number,
  blockParams?: ContractBlockParameters
): Promise<Maybe<PolicyJSON>> => {
  var allFunctionMappings: hexToFunctionString[] = []
  const callingFunctionsJSON: CallingFunctionJSON[] = []
  try {
    const retrievePolicy = await readContract(config, {
      address: rulesEnginePolicyContract.address,
      abi: rulesEnginePolicyContract.abi,
      functionName: 'getPolicy',
      args: [policyId],
      ...blockParams,
    })

    const policyMeta = await getPolicyMetadata(config, rulesEnginePolicyContract, policyId, blockParams)
    if (policyMeta == null) {
      throw new Error(`Policy with ID ${policyId} does not exist.`)
    }

    let policyResult = retrievePolicy as any
    let callingFunctions: any = policyResult[0]
    let ruleIds2DArray: any = policyResult[1]
    const PolicyType = await isClosedPolicy(config, rulesEnginePolicyContract, policyId, blockParams)

    var iter = 1
    for (var _cfId of callingFunctions) {
      var mapp = await getCallingFunctionMetadata(config, rulesEngineComponentContract, policyId, _cfId, blockParams)
      var newMapping: hexToFunctionString = {
        hex: mapp.signature,
        functionString: mapp.callingFunction,
        encodedValues: mapp.encodedValues,
        index: iter,
        name: mapp.name,
      }
      allFunctionMappings.push(newMapping)
      var callingFunctionJSON: CallingFunctionJSON = {
        Name: mapp.name,
        FunctionSignature: mapp.callingFunction,
        EncodedValues: mapp.encodedValues,
      }

      callingFunctionsJSON.push(callingFunctionJSON)
      iter++
    }

    var trackers: TrackerOnChain[] = await getAllTrackers(config, rulesEngineComponentContract, policyId, blockParams)

    var trackerNames: TrackerMetadataStruct[] = []
    var mappedTrackerNames: TrackerMetadataStruct[] = []
    for (var tracker of trackers) {
      var meta = await getTrackerMetadata(
        config,
        rulesEngineComponentContract,
        policyId,
        tracker.trackerIndex,
        blockParams
      )
      if (tracker.mapped) {
        mappedTrackerNames.push(meta)
      } else {
        trackerNames.push(meta)
      }
      var newMapping: hexToFunctionString = {
        hex: '',
        functionString: meta.trackerName,
        encodedValues: '',
        index: tracker.trackerIndex,
      }
      allFunctionMappings.push(newMapping)
    }

    const trackerJSONs = convertTrackerStructsToStrings(trackers, trackerNames, mappedTrackerNames)

    var foreignCalls: ForeignCallOnChain[] = await getAllForeignCalls(
      config,
      rulesEngineForeignCallContract,
      policyId,
      blockParams
    )
    var foreignCallNames: string[] = []
    for (var fc of foreignCalls) {
      var name = await getForeignCallMetadata(
        config,
        rulesEngineForeignCallContract,
        policyId,
        fc.foreignCallIndex,
        blockParams
      )

      var daData = getCallingFunctionMetadata(
        config,
        rulesEngineComponentContract,
        policyId,
        fc.callingFunctionSelector,
        blockParams
      )

      foreignCallNames.push(name.name)
      const encodedValues = reverseParseEncodedArgs(
        (await daData).encodedValues,
        foreignCallNames,
        fc.encodedIndices,
        trackerNames
      )
      var newMapping: hexToFunctionString = {
        hex: fc.signature,
        functionString: name.functionSignature,
        encodedValues,
        index: fc.foreignCallIndex,
        name: name.name, // Required for foreign calls to enable proper reverse interpretation
      }
      allFunctionMappings.push(newMapping)
    }
    const callStrings: ForeignCallJSON[] = convertForeignCallStructsToStrings(
      foreignCalls,
      allFunctionMappings,
      foreignCallNames
    )

    var iter = 0
    var ruleIndexIter = 0
    var ruleJSONObjs = []

    const allRulesFromContract = await getAllRules(config, rulesEngineRulesContract, policyId, blockParams)

    for (var innerArray of ruleIds2DArray) {
      var functionString = ''
      var encodedValues: string = ''
      var fs = callingFunctions[iter]
      for (var mapping of allFunctionMappings) {
        if (mapping.hex == fs) {
          functionString = mapping.name || ''
          encodedValues = mapping.encodedValues
          break
        }
      }

      // Use the index to get rules from getAllRules result
      const rulesForThisFunction = allRulesFromContract?.[iter] || []
      for (let ruleIndex = 0; ruleIndex < rulesForThisFunction.length; ruleIndex++) {
        const actualRuleId = rulesForThisFunction[ruleIndex].ruleIndex //ruleIndexIter + 1 // Rule IDs start from 1
        const ruleS = rulesForThisFunction[ruleIndex]
        ruleIndexIter++

        const ruleM = await getRuleMetadata(config, rulesEngineRulesContract, policyId, actualRuleId, blockParams)
        if (ruleS != null && ruleM != null) {
          ruleJSONObjs.push(
            convertOnChainRuleStructToString(
              functionString,
              encodedValues,
              ruleS,
              ruleM,
              foreignCalls,
              trackers,
              allFunctionMappings,
              actualRuleId
            )
          )
        }
      }
      iter++
    }

    var policyJSON: PolicyJSON = {
      Id: policyId,
      Policy: policyMeta.policyName,
      Description: policyMeta.policyDescription,
      PolicyType: PolicyType ? 'closed' : 'open',
      CallingFunctions: callingFunctionsJSON,
      ForeignCalls: callStrings,
      Trackers: trackerJSONs.Trackers,
      MappedTrackers: trackerJSONs.MappedTrackers,
      Rules: ruleJSONObjs,
    }

    return policyJSON
  } catch (error) {
    console.error(error)
    return null
  }
}

/**
 * Retrieves the metadata for a policy from the Rules Engine Policy Contract based on the provided policy ID.
 *
 * @param config - The configuration object containing network and wallet information.
 * @param rulesEnginePolicyContract - The contract instance containing the address and ABI for interaction.
 * @param policyId - The ID of the policy.
 * @param blockParams - Optional parameters to specify block number or tag for the contract read operation.
 * @returns A promise that resolves to the policy metadata result if successful, or `null` if an error occurs.
 *
 * @throws Will log an error to the console if the contract interaction fails.
 */
export const getPolicyMetadata = async (
  config: Config,
  rulesEnginePolicyContract: RulesEnginePolicyContract,
  policyId: number,
  blockParams?: ContractBlockParameters
): Promise<Maybe<PolicyMetadataStruct>> => {
  try {
    const getMeta = await readContract(config, {
      address: rulesEnginePolicyContract.address,
      abi: rulesEnginePolicyContract.abi,
      functionName: 'getPolicyMetadata',
      args: [policyId],
      ...blockParams,
    })

    let ruleResult = getMeta as PolicyMetadataStruct
    return ruleResult
  } catch (error) {
    console.error(error)
    return null
  }
}

/**
 * Checks if a policy exists in the Rules Engine.
 * @param config - The configuration object containing network and wallet information.
 * @param rulesEnginePolicyContract - The contract instance for interacting with the Rules Engine Policy.
 * @param policyId - The ID of the policy to check.
 * @param blockParams - Optional parameters to specify block number or tag for the contract read operation.
 * @returns True if the policy exists, false otherwise.
 */
export async function policyExists(
  config: Config,
  rulesEnginePolicyContract: RulesEnginePolicyContract,
  policyId: number,
  blockParams?: ContractBlockParameters
): Promise<boolean> {
  try {
    let policyExists = await readContract(config, {
      address: rulesEnginePolicyContract.address,
      abi: rulesEnginePolicyContract.abi,
      functionName: 'getPolicy',
      args: [policyId],
      ...blockParams,
    })
    if ((policyExists as any)[0] != null && (policyExists as any)[1] != null) {
      return true
    }
    return false
  } catch (error) {
    return false
  }
}

/**
 * Retrieves the IDs of all of the policies that have been applied to a contract address.
 * @param config - The configuration object containing network and wallet information.
 * @param rulesEnginePolicyContract - The contract instance for interacting with the Rules Engine Policy.
 * @param address - The address to check.
 * @param blockParams - Optional parameters to specify block number or tag for the contract read operation.
 * @returns array of all of the policy ids applied to the contract
 */
export async function getAppliedPolicyIds(
  config: Config,
  rulesEnginePolicyContract: RulesEnginePolicyContract,
  address: string,
  blockParams?: ContractBlockParameters
): Promise<number[]> {
  try {
    let appliedPolicies = await readContract(config, {
      address: rulesEnginePolicyContract.address,
      abi: rulesEnginePolicyContract.abi,
      functionName: 'getAppliedPolicyIds',
      args: [getAddress(address)],
      ...blockParams,
    })
    return appliedPolicies as number[]
  } catch (error) {
    return []
  }
}

/**
 * Retrieves whether a policy is open or closed.
 * @param config - The configuration object containing network and wallet information.
 * @param rulesEnginePolicyContract - The contract instance for interacting with the Rules Engine Policy.
 * @param policyId - The ID of the policy to check.
 * @param blockParams - Optional parameters to specify block number or tag for the contract read operation.
 * @returns True if the policy is closed, false otherwise
 */
export async function isClosedPolicy(
  config: Config,
  rulesEnginePolicyContract: RulesEnginePolicyContract,
  policyId: number,
  blockParams?: ContractBlockParameters
): Promise<boolean> {
  try {
    let isClosed = await readContract(config, {
      address: rulesEnginePolicyContract.address,
      abi: rulesEnginePolicyContract.abi,
      functionName: 'isClosedPolicy',
      args: [policyId],
      ...blockParams,
    })
    return isClosed as boolean
  } catch (error) {
    return false
  }
}

/**
 * Retrieves whether a policy is disabled.
 * @param config - The configuration object containing network and wallet information.
 * @param rulesEnginePolicyContract - The contract instance for interacting with the Rules Engine Policy.
 * @param policyId - The ID of the policy to check.
 * @param blockParams - Optional parameters to specify block number or tag for the contract read operation.
 * @returns True if the policy is disabled, false otherwise
 */
export async function isDisabledPolicy(
  config: Config,
  rulesEnginePolicyContract: RulesEnginePolicyContract,
  policyId: number,
  blockParams?: ContractBlockParameters
): Promise<boolean> {
  try {
    let isClosed = await readContract(config, {
      address: rulesEnginePolicyContract.address,
      abi: rulesEnginePolicyContract.abi,
      functionName: 'isDisabledPolicy',
      args: [policyId],
      ...blockParams,
    })
    return isClosed as boolean
  } catch (error) {
    return false
  }
}

/**
 * Closes a policy on the Rules Engine.
 *
 * @param config - The configuration object containing network and wallet information.
 * @param rulesEnginePolicyContract - The contract instance for interacting with the Rules Engine Policy.
 * @param policyId - The ID of the policy to close.
 * @returns Object with `result` (`0` if successful, `-1` if an error occurs) and `transactionHash`.
 */
export const closePolicy = async (
  config: Config,
  rulesEnginePolicyContract: RulesEnginePolicyContract,
  policyId: number,
  confirmationCount: number
): Promise<{ result: number; transactionHash: `0x${string}` }> => {
  var addFC
  try {
    addFC = await simulateContract(config, {
      address: rulesEnginePolicyContract.address,
      abi: rulesEnginePolicyContract.abi,
      functionName: 'closePolicy',
      args: [policyId],
    })
  } catch (err) {
    throw new Error(`Failed to simulate close policy transaction: ${err}`)
  }

  if (addFC != null) {
    const transactionHash = await writeContract(config, {
      ...addFC.request,
      account: config.getClient().account,
    })
    await waitForTransactionReceipt(config, {
      confirmations: confirmationCount,
      hash: transactionHash,
    })

    return { result: 0, transactionHash }
  }

  throw new Error('Failed to close policy: simulation returned null')
}

/**
 * Opens a policy on the Rules Engine.
 *
 * @param config - The configuration object containing network and wallet information.
 * @param rulesEnginePolicyContract - The contract instance for interacting with the Rules Engine Policy.
 * @param policyId - The ID of the policy to open.
 * @returns Object with `result` (`0` if successful, `-1` if an error occurs) and `transactionHash`.
 */
export const openPolicy = async (
  config: Config,
  rulesEnginePolicyContract: RulesEnginePolicyContract,
  policyId: number,
  confirmationCount: number
): Promise<{ result: number; transactionHash: `0x${string}` }> => {
  var addFC
  try {
    addFC = await simulateContract(config, {
      address: rulesEnginePolicyContract.address,
      abi: rulesEnginePolicyContract.abi,
      functionName: 'openPolicy',
      args: [policyId],
    })
  } catch (err) {
    throw new Error(`Failed to simulate open policy transaction: ${err}`)
  }

  if (addFC != null) {
    const transactionHash = await writeContract(config, {
      ...addFC.request,
      account: config.getClient().account,
    })
    await waitForTransactionReceipt(config, {
      confirmations: confirmationCount,
      hash: transactionHash,
    })

    return { result: 0, transactionHash }
  }

  throw new Error('Failed to open policy: simulation returned null')
}

/**
 * Retrieves whether an address is a possible subscriber to the closed policy.
 * @param config - The configuration object containing network and wallet information.
 * @param rulesEngineComponentContract - The contract instance for interacting with the Rules Engine Components.
 * @param policyId - The ID of the policy to check.
 * @param subscriber - The address to check
 * @param blockParams - Optional parameters to specify block number or tag for the contract read operation.
 * @returns True if the address is a subscriber to the closed policy, false otherwise
 */
export async function isClosedPolicySubscriber(
  config: Config,
  rulesEngineComponentContract: RulesEngineComponentContract,
  policyId: number,
  subscriber: Address,
  blockParams?: ContractBlockParameters
): Promise<boolean> {
  try {
    let isClosed = await readContract(config, {
      address: rulesEngineComponentContract.address,
      abi: rulesEngineComponentContract.abi,
      functionName: 'isClosedPolicySubscriber',
      args: [policyId, subscriber],
      ...blockParams,
    })
    return isClosed as boolean
  } catch (error) {
    return false
  }
}

/**
 * Adds a subscriber to the closed policy.
 *
 * @param config - The configuration object containing network and wallet information.
 * @param rulesEngineComponentContract - The contract instance for interacting with the Rules Engine Components.
 * @param policyId - The ID of the policy to add to.
 * @returns Object with `result` (`0` if successful, `-1` if an error occurs) and `transactionHash`.
 */
export const addClosedPolicySubscriber = async (
  config: Config,
  rulesEngineComponentContract: RulesEngineComponentContract,
  policyId: number,
  subscriber: Address,
  confirmationCount: number
): Promise<{ result: number; transactionHash: `0x${string}` }> => {
  var addFC
  try {
    addFC = await simulateContract(config, {
      address: rulesEngineComponentContract.address,
      abi: rulesEngineComponentContract.abi,
      functionName: 'addClosedPolicySubscriber',
      args: [policyId, subscriber],
    })
  } catch (err) {
    throw new Error(`Failed to simulate add closed policy subscriber transaction: ${err}`)
  }

  if (addFC != null) {
    const transactionHash = await writeContract(config, {
      ...addFC.request,
      account: config.getClient().account,
    })
    await waitForTransactionReceipt(config, {
      confirmations: confirmationCount,
      hash: transactionHash,
    })

    return { result: 0, transactionHash }
  }

  throw new Error('Failed to add closed policy subscriber: simulation returned null')
}

/**
 * Removes a subscriber from the closed policy.
 *
 * @param config - The configuration object containing network and wallet information.
 * @param rulesEngineComponentContract - The contract instance for interacting with the Rules Engine Components.
 * @param policyId - The ID of the policy to remove from.
 * @param subscriber - The address of the subscriber to remove.
 * @returns Object with `result` (`0` if successful, `-1` if an error occurs) and `transactionHash`.
 */
export const removeClosedPolicySubscriber = async (
  config: Config,
  rulesEngineComponentContract: RulesEngineComponentContract,
  policyId: number,
  subscriber: Address,
  confirmationCount: number
): Promise<{ result: number; transactionHash: `0x${string}` }> => {
  var addFC
  try {
    addFC = await simulateContract(config, {
      address: rulesEngineComponentContract.address,
      abi: rulesEngineComponentContract.abi,
      functionName: 'removeClosedPolicySubscriber',
      args: [policyId, subscriber],
    })
  } catch (err) {
    throw new Error(`Failed to simulate remove closed policy subscriber transaction: ${err}`)
  }

  if (addFC != null) {
    const transactionHash = await writeContract(config, {
      ...addFC.request,
      account: config.getClient().account,
    })
    await waitForTransactionReceipt(config, {
      confirmations: confirmationCount,
      hash: transactionHash,
    })

    return { result: 0, transactionHash }
  }

  throw new Error('Failed to remove closed policy subscriber: simulation returned null')
}

/**
 * Cements a policy on the Rules Engine.
 *
 * @param config - The configuration object containing network and wallet information.
 * @param rulesEnginePolicyContract - The contract instance for interacting with the Rules Engine Policy.
 * @param policyId - The ID of the policy to cement.
 * @returns Object with `result` (`0` if successful, `-1` if an error occurs) and `transactionHash`.
 */
export const cementPolicy = async (
  config: Config,
  rulesEnginePolicyContract: RulesEnginePolicyContract,
  policyId: number,
  confirmationCount: number
): Promise<{ result: number; transactionHash: `0x${string}` }> => {
  var addFC
  try {
    addFC = await simulateContract(config, {
      address: rulesEnginePolicyContract.address,
      abi: rulesEnginePolicyContract.abi,
      functionName: 'cementPolicy',
      args: [policyId],
    })
  } catch (err) {
    throw new Error(`Failed to simulate cement policy transaction: ${err}`)
  }

  if (addFC != null) {
    const transactionHash = await writeContract(config, {
      ...addFC.request,
      account: config.getClient().account,
    })
    await waitForTransactionReceipt(config, {
      confirmations: confirmationCount,
      hash: transactionHash,
    })

    return { result: 0, transactionHash }
  }

  throw new Error('Failed to cement policy: simulation returned null')
}

/**
 * Disables a policy on the Rules Engine.
 *
 * @param config - The configuration object containing network and wallet information.
 * @param rulesEnginePolicyContract - The contract instance for interacting with the Rules Engine Policy.
 * @param policyId - The ID of the policy to disable.
 * @returns `0` if successful, `-1` if an error occurs.
 */
export const disablePolicy = async (
  config: Config,
  rulesEnginePolicyContract: RulesEnginePolicyContract,
  policyId: number,
  confirmationCount: number
): Promise<{ result: number; transactionHash: `0x${string}` }> => {
  var addFC
  try {
    addFC = await simulateContract(config, {
      address: rulesEnginePolicyContract.address,
      abi: rulesEnginePolicyContract.abi,
      functionName: 'disablePolicy',
      args: [policyId],
    })
  } catch (err) {
    return { result: -1, transactionHash: '0x0' as `0x${string}` }
  }

  if (addFC != null) {
    const returnHash = await writeContract(config, {
      ...addFC.request,
      account: config.getClient().account,
    })
    await waitForTransactionReceipt(config, {
      confirmations: confirmationCount,
      hash: returnHash,
    })
    return { result: 0, transactionHash: returnHash }
  }

  return { result: 0, transactionHash: '0x0' as `0x${string}` }
}

/**
 * Retrieves whether a policy is cemented.
 * @param config - The configuration object containing network and wallet information.
 * @param rulesEnginePolicyContract - The contract instance for interacting with the Rules Engine Policy.
 * @param policyId - The ID of the policy to check.
 * @param blockParams - Optional parameters to specify block number or tag for the contract read operation.
 * @returns True if the policy is cemented, false otherwise
 */
export const isCementedPolicy = async (
  config: Config,
  rulesEnginePolicyContract: RulesEnginePolicyContract,
  policyId: number,
  blockParams?: ContractBlockParameters
): Promise<boolean> => {
  try {
    const retrievePolicy = await readContract(config, {
      address: rulesEnginePolicyContract.address,
      abi: rulesEnginePolicyContract.abi,
      functionName: 'isCementedPolicy',
      args: [policyId],
      ...blockParams,
    })

    return retrievePolicy as boolean
  } catch (err) {
    return false
  }
}
