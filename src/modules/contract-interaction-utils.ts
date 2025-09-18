/// SPDX-License-Identifier: BUSL-1.1
import { getContract, Address, toHex, encodeAbiParameters, parseAbiParameters, stringToBytes, getAddress } from 'viem'

import { parseRuleSyntax, cleanInstructionSet, buildForeignCallList, buildTrackerList } from '../parsing/parser'

import {
  EffectStruct,
  EffectStructs,
  FCNameToID,
  Maybe,
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
  RuleStruct,
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
export function buildARuleStruct(
  ruleSyntax: RuleJSON,
  foreignCallNameToID: FCNameToID[],
  effect: EffectStructs,
  trackerNameToID: FCNameToID[],
  encodedValues: string,
  additionalForeignCalls: string[],
  additionalEffectForeignCalls: string[]
): Maybe<RuleStruct> {
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
  var rawData = {
    instructionSetIndex: [],
    argumentTypes: [],
    dataValues: [],
  }
  const instructionSet = cleanInstructionSet(output.instructionSet)
  const rule = {
    instructionSet,
    rawData: rawData,
    placeHolders: output.placeHolders,
    positiveEffectPlaceHolders: output.positiveEffectPlaceHolders,
    negativeEffectPlaceHolders: output.negativeEffectPlaceHolders,
    ruleIndex: 0,
    posEffects: effect.positiveEffects,
    negEffects: effect.negativeEffects,
  }
  return rule
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
export function buildAnEffectStruct(
  ruleSyntax: RuleJSON,
  trackerNameToID: FCNameToID[],
  foreignCallNameToID: FCNameToID[],
  encodedValues: string,
  additionalForeignCalls: string[],
  additionalEffectForeignCalls: string[]
): Maybe<EffectStructs> {
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
  var pEffects: EffectStruct[] = []
  var nEffects: EffectStruct[] = []

  console.log('PEFFECTS', output.positiveEffects)

  for (var pEffect of output.positiveEffects) {
    const instructionSet = cleanInstructionSet(pEffect.instructionSet)
    var param: any

    if (pEffect.pType == 0) {
      // address
      param = encodeAbiParameters(parseAbiParameters('address'), [getAddress(String(pEffect.parameterValue))])
    } else if (pEffect.pType == 1) {
      // string
      param = encodeAbiParameters(parseAbiParameters('string'), [String(pEffect.parameterValue)])
    } else if (pEffect.pType == 5) {
      // bytes
      param = encodeAbiParameters(parseAbiParameters('bytes'), [toHex(stringToBytes(String(pEffect.parameterValue)))])
    } else {
      // uint
      param = encodeAbiParameters(parseAbiParameters('uint256'), [BigInt(pEffect.parameterValue)])
    }

    const effect = {
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
    var param: any
    if (nEffect.pType == 0) {
      // address
      param = encodeAbiParameters(parseAbiParameters('address'), [getAddress(String(nEffect.parameterValue))])
    } else if (nEffect.pType == 1) {
      // string
      param = encodeAbiParameters(parseAbiParameters('string'), [String(nEffect.parameterValue)])
    } else if (nEffect.pType == 5) {
      // bytes
      param = encodeAbiParameters(parseAbiParameters('bytes'), [toHex(stringToBytes(String(nEffect.parameterValue)))])
    } else {
      // uint
      param = encodeAbiParameters(parseAbiParameters('uint256'), [BigInt(nEffect.parameterValue)])
    }
    const instructionSet = cleanInstructionSet(nEffect.instructionSet)
    console.log(pEffect)
    const effect = {
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

  return { positiveEffects: pEffects, negativeEffects: nEffects }
}
