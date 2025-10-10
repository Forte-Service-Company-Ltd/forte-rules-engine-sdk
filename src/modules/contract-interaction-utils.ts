/// SPDX-License-Identifier: BUSL-1.1
import { getContract, Address, toHex, encodeAbiParameters, parseAbiParameters, stringToBytes, getAddress } from 'viem'

import { parseRuleSyntax, cleanInstructionSet, buildForeignCallList, buildTrackerList } from '../parsing/parser'

import {
  NameToID,
  EffectOnChain,
  EffectDefinition,
  EffectsOnChain,
  Maybe,
  RuleOnChain,
  RulesEngineAdminABI,
  RulesEngineAdminContract,
  RulesEngineComponentABI,
  RulesEngineComponentContract,
  RulesEngineForeignCallABI,
  RulesEngineForeignCallContract,
  RulesEnginePolicyABI,
  RulesEnginePolicyContract,
  RulesEngineRulesABI,
  RulesEngineRulesContract,
} from './types'
import { RuleJSON } from './validation'

/**
 * @file ContractInteractionUtils.ts
 * @description This module provides a set of utility functions to aid in interacting with the Rules Engine smart contracts.
 *
 * @module ContractInteractionUtils
 *
 * @dependencies
 * - `viem`: Provides utilities for encoding/decoding data and interacting with Ethereum contracts.
 * - `Parser`: Contains helper functions for parsing rule syntax, trackers, and foreign calls.
 * - `generateSolidity`: Handles the generation of Solidity modifiers.
 * - `injectModifier`: Handles the injection of modifiers into Solidity contracts.
 * - `@wagmi/core`: Provides utilities for simulating, reading, and writing to Ethereum contracts.
 * - `config`: Provides configuration for interacting with the blockchain.
 *
 * @types
 * - `RulesEnginePolicyContract`: Represents the contract instance for interacting with the Rules Engine Policy.
 * - `RulesEngineComponentContract`: Represents the contract instance for interacting with the Rules Engine Component.
 *
 * @author @mpetersoCode55, @ShaneDuncan602, @TJ-Everett, @VoR0220
 *
 * @license BUSL-1.1
 *
 * @note This file is a critical component of the Rules Engine SDK, enabling seamless integration with the Rules Engine smart contracts.
 */

//TODO: Make the client usages type specific
export const getRulesEnginePolicyContract = (address: Address, client: any): RulesEnginePolicyContract =>
  getContract({
    address,
    abi: RulesEnginePolicyABI,
    client,
  })

export const getRulesEngineRulesContract = (address: Address, client: any): RulesEngineRulesContract =>
  getContract({
    address,
    abi: RulesEngineRulesABI,
    client,
  })

export const getRulesEngineComponentContract = (address: Address, client: any): RulesEngineComponentContract =>
  getContract({
    address,
    abi: RulesEngineComponentABI,
    client,
  })

export const getRulesEngineAdminContract = (address: Address, client: any): RulesEngineAdminContract =>
  getContract({
    address,
    abi: RulesEngineAdminABI,
    client,
  })

export const getRulesEngineForeignCallContract = (address: Address, client: any): RulesEngineForeignCallContract =>
  getContract({
    address,
    abi: RulesEngineForeignCallABI,
    client,
  })

/**
 * Pauses the execution of an asynchronous function for a specified duration.
 *
 * @param ms - The number of milliseconds to sleep before resolving the promise.
 * @returns A promise that resolves after the specified duration.
 */
export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 *
 * Helper Functions
 *
 */

/**
 * Constructs a rule structure based on the provided policy ID, rule syntax, foreign call mappings,
 * effect data, and tracker mappings. This function processes the rule syntax to generate a structured
 * representation of the rule, including placeholders, effects, and associated metadata.
 *
 * @param ruleSyntax - The JSON representation of the rule syntax, including conditions and effects.
 * @param foreignCallNameToID - An array of mappings between foreign call names and their corresponding IDs.
 * @param effect - An object containing the positive and negative effects of the rule.
 * @param trackerNameToID - An array of mappings between tracker names and their corresponding IDs.
 *
 * @returns A structured representation of the rule, including its instruction set, placeholders,
 *          effect placeholders, and associated effects.
 */
export function buildAnOnChainRule(
  ruleSyntax: RuleJSON,
  foreignCallNameToID: NameToID[],
  effect: EffectsOnChain,
  trackerNameToID: NameToID[],
  encodedValues: string,
  additionalForeignCalls: string[],
  additionalEffectForeignCalls: string[]
): Maybe<RuleOnChain> {
  var output = parseRuleSyntax(
    ruleSyntax,
    trackerNameToID,
    foreignCallNameToID,
    encodedValues,
    additionalForeignCalls,
    additionalEffectForeignCalls
  )
  if (output == null) {
    return null
  }

  const instructionSet = cleanInstructionSet(output.instructionSet)
  const rule = {
    instructionSet,
    rawData: output.rawData,
    placeHolders: output.placeHolders,
    positiveEffectPlaceHolders: output.positiveEffectPlaceHolders,
    negativeEffectPlaceHolders: output.negativeEffectPlaceHolders,
    ruleIndex: 0,
    posEffects: effect.posEffects,
    negEffects: effect.negEffects,
  }
  return rule
}

/**
 * Encodes a parameter value based on its type for contract interaction.
 *
 * @param pType - The parameter type (0: address, 1: string, 3: bool, 5: bytes, default: uint256).
 * @param parameterValue - The value to encode.
 * @param dynamicParam - Whether the parameter is dynamic (resolved by contract).
 * @returns The encoded parameter as a hex string or '0x' for dynamic/empty parameters.
 */
function encodeEffectParameter(pType: number, parameterValue: any, dynamicParam: boolean): string {
  // For dynamic parameters, don't encode the parameterValue - let the contract resolve it
  if (dynamicParam) {
    return '0x'
  }

  if (parameterValue !== null && parameterValue !== undefined) {
    if (pType == 0) {
      // address
      return encodeAbiParameters(parseAbiParameters('address'), [getAddress(String(parameterValue))])
    } else if (pType == 1) {
      // string
      return encodeAbiParameters(parseAbiParameters('string'), [String(parameterValue)])
    } else if (pType == 3) {
      // bool
      return encodeAbiParameters(parseAbiParameters('bool'), [Boolean(parameterValue)])
    } else if (pType == 5) {
      // bytes
      return encodeAbiParameters(parseAbiParameters('bytes'), [toHex(stringToBytes(String(parameterValue)))])
    } else {
      // uint
      return encodeAbiParameters(parseAbiParameters('uint256'), [BigInt(parameterValue)])
    }
  } else {
    // No parameter - use empty bytes
    return '0x'
  }
}

/**
 * Builds a structured representation of positive and negative effects based on the provided rule syntax and tracker mappings.
 *
 * @param ruleSyntax - The JSON representation of the rule syntax to parse.
 * @param trackerNameToID - An array mapping tracker names to their corresponding IDs.
 * @param foreignCallNameToID - An array mapping foreign call names to their corresponding IDs.
 * @returns An object containing arrays of positive and negative effects, each represented as structured objects.
 *
 * The returned object has the following structure:
 * - `positiveEffects`: An array of objects representing the positive effects.
 * - `negativeEffects`: An array of objects representing the negative effects.
 *
 * Each effect object includes:
 * - `valid`: A boolean indicating whether the effect is valid.
 * - `dynamicParam`: A boolean indicating whether the parameter is dynamic.
 * - `effectType`: The type of the effect.
 * - `pType`: The parameter type (e.g., address, string, bytes, uint).
 * - `param`: The encoded parameter value.
 * - `text`: A hexadecimal representation of the effect's text.
 * - `errorMessage`: The error message associated with the effect.
 * - `instructionSet`: The cleaned instruction set for the effect.
 */
export function buildOnChainEffects(
  ruleSyntax: RuleJSON,
  trackerNameToID: NameToID[],
  foreignCallNameToID: NameToID[],
  encodedValues: string,
  additionalForeignCalls: string[],
  additionalEffectForeignCalls: string[]
): Maybe<EffectsOnChain> {
  var output = parseRuleSyntax(
    ruleSyntax,
    trackerNameToID,
    foreignCallNameToID,
    encodedValues,
    additionalForeignCalls,
    additionalEffectForeignCalls
  )
  if (output == null) {
    return null
  }
  var pEffects: EffectOnChain[] = []
  var nEffects: EffectOnChain[] = []

  for (var pEffect of output.positiveEffects) {
    const instructionSet = cleanInstructionSet(pEffect.instructionSet)
    const param = encodeEffectParameter(pEffect.pType, pEffect.parameterValue, pEffect.dynamicParam)

    const effect: EffectOnChain = {
      valid: true,
      dynamicParam: pEffect.dynamicParam,
      effectType: pEffect.type,
      pType: pEffect.pType,
      param: param,
      text: toHex(stringToBytes(pEffect.text, { size: 32 })),
      errorMessage: pEffect.text,
      instructionSet,
      eventPlaceholderIndex: pEffect.eventPlaceholderIndex,
    }
    pEffects.push(effect)
  }
  for (var nEffect of output.negativeEffects) {
    const param = encodeEffectParameter(nEffect.pType, nEffect.parameterValue, nEffect.dynamicParam)
    const instructionSet = cleanInstructionSet(nEffect.instructionSet)
    
    const effect: EffectOnChain = {
      valid: true,
      dynamicParam: nEffect.dynamicParam,
      effectType: nEffect.type,
      pType: nEffect.pType,
      param: param,
      text: toHex(stringToBytes(nEffect.text, { size: 32 })),
      errorMessage: nEffect.text,
      instructionSet,
      eventPlaceholderIndex: nEffect.eventPlaceholderIndex,
    }
    nEffects.push(effect)
  }

  return { posEffects: pEffects, negEffects: nEffects }
}
