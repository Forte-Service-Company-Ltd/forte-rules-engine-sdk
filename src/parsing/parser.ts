/// SPDX-License-Identifier: BUSL-1.1
import {
  encodePacked,
  toHex,
  encodeAbiParameters,
  parseAbiParameters,
  stringToBytes,
  getAddress,
  keccak256,
} from 'viem'
import {
  EffectDefinition,
  NameToID,
  ForeignCallDefinition,
  ForeignCallEncodedIndex,
  InstructionSet,
  MappedTrackerDefinition,
  matchArray,
  Maybe,
  operandArray,
  PlaceholderStruct,
  PT,
  RuleComponent,
  RuleDefinition,
  trackerArrayType,
  TrackerDefinition,
  RawData,
} from '../modules/types'
import { convertHumanReadableToInstructionSet } from './internal-parsing-logic'
import {
  removeExtraParenthesis,
  parseFunctionArguments,
  parseTrackers,
  buildRawData,
  parseForeignCalls,
  buildPlaceholderList,
  parseEffect,
  cleanseForeignCallLists,
  parseGlobalVariables,
} from './parsing-utilities'

import {
  CallingFunctionJSON,
  ForeignCallJSON,
  MappedTrackerJSON,
  PType,
  RuleJSON,
  splitFunctionInput,
  TrackerJSON,
} from '../modules/validation'
import tr from 'zod/v4/locales/tr.cjs'

/**
 * @file parser.ts
 * @description This module provides a external facing parsing functions for the Rules Engine SDK.
 *              It includes functions for parsing rule syntax, trackers, foreign calls, and converting
 *              human-readable conditions into instruction sets.
 *              Additionally, it supports reverse parsing of instruction sets back into human-readable syntax.
 *
 * @module parser
 *
 * @exports
 * - Functions for parsing rule syntax, trackers, foreign calls, and converting between formats.
 *
 * @author @mpetersoCode55, @ShaneDuncan602, @TJ-Everett, @VoR0220
 *
 * @license BUSL-1.1
 *
 * @note This file is a critical component of the Rules Engine SDK, enabling the translation of human-readable
 *       rule definitions into machine-readable formats and vice versa.
 */

export function processSyntax(
  encodedValues: string,
  foreignCallNameToID: NameToID[],
  trackerNameToID: NameToID[],
  additionalForeignCalls: string[],
  syntax: string
): [string, RuleComponent[]] {
  let components: RuleComponent[] = [...parseFunctionArguments(encodedValues, syntax)]
  let [updatedSyntax, effectCalls] = parseForeignCalls(
    syntax,
    components,
    foreignCallNameToID,
    trackerNameToID,
    additionalForeignCalls
  )
  components = [...components, ...effectCalls]

  const [finalSyntax, effectTrackers] = parseTrackers(updatedSyntax, components, trackerNameToID)
  const gvEComponents = parseGlobalVariables(finalSyntax)

  return [finalSyntax, [...components, ...effectTrackers, ...gvEComponents]]
}

function getProcessedEffects(
  encodedValues: string,
  foreignCallNameToID: NameToID[],
  trackerNameToID: NameToID[],
  additionalEffectForeignCalls: string[],
  effects: string[]
): Maybe<[EffectDefinition[], PlaceholderStruct[]]> {
  var retVal = effects.reduce(
    (acc: [string[], RuleComponent[][]], effect) => {
      const [updatedEffect, effectCalls] = processSyntax(
        encodedValues,
        foreignCallNameToID,
        trackerNameToID,
        additionalEffectForeignCalls,
        effect
      )
      acc[0].push(updatedEffect)
      acc[1].push(effectCalls)
      return acc
    },
    [[], []]
  )
  const efectNames = cleanseForeignCallLists(retVal[1])
  let effectPlaceHolders = buildPlaceholderList(efectNames)
  effectPlaceHolders = [...new Set(effectPlaceHolders)]

  var positiveEffects = []
  for (var effect of retVal[0]) {
    var parsed = parseEffect(effect, efectNames, effectPlaceHolders, trackerNameToID)
    if (parsed == null) {
      return null
    } else {
      positiveEffects.push(parsed)
    }
  }

  return [positiveEffects as EffectDefinition[], effectPlaceHolders]
}

/**
 * Parses the rule syntax and converts it into a raw instruction set.
 *
 * @param syntax - The JSON representation of the rule syntax.
 * @param trackerNameToID - A mapping of tracker IDs to their names and types.
 * @param foreignCallNameToID - A mapping of foreign call names to their IDs.
 * @returns An object containing the instruction set, raw data, positive effects, negative effects,
 *          placeholders, and effect placeholders.
 */

export function parseRuleSyntax(
  syntax: RuleJSON,
  trackerNameToID: NameToID[],
  foreignCallNameToID: NameToID[],
  encodedValues: string,
  additionalForeignCalls: string[],
  additionalEffectForeignCalls: string[]
): Maybe<RuleDefinition> {
  const [condition, ruleComponents] = processSyntax(
    encodedValues,
    foreignCallNameToID,
    trackerNameToID,
    additionalForeignCalls,
    removeExtraParenthesis(syntax.Condition)
  )

  const placeHolders = buildPlaceholderList(ruleComponents)

  const processedEffect = getProcessedEffects(
    encodedValues,
    foreignCallNameToID,
    trackerNameToID,
    additionalEffectForeignCalls,
    syntax.PositiveEffects
  )
  if (processedEffect == null) {
    return null
  }
  const [positiveEffects, positiveEffectPlaceHolders] = processedEffect

  var retE = getProcessedEffects(
    encodedValues,
    foreignCallNameToID,
    trackerNameToID,
    additionalEffectForeignCalls,
    syntax.NegativeEffects
  )
  if (retE == null) {
    return null
  }
  const [negativeEffects, negativeEffectPlaceHolders] = retE

  const conditionInstructionSet = convertHumanReadableToInstructionSet(
    condition,
    ruleComponents,
    trackerNameToID,
    placeHolders
  )

  const excludeArray: string[] = ruleComponents.map((name) => name.name)
  excludeArray.push(...matchArray)
  excludeArray.push(...operandArray)
  var rawData: RawData = {
    instructionSetIndex: [],
    dataValues: [],
    argumentTypes: [],
  }
  const instructionSet = buildRawData(conditionInstructionSet, excludeArray, rawData, 0)
  if (instructionSet == null) {
    return null
  }
  var typeCount = 1
  positiveEffects.forEach((effect) => {
    var instructionSet = buildRawData(effect.instructionSet, excludeArray, rawData, typeCount)
    typeCount += 1
    if (instructionSet == null) {
      return null
    }
    effect.instructionSet = instructionSet
  })
  negativeEffects.forEach((effect) => {
    var instructionSet = buildRawData(effect.instructionSet, excludeArray, rawData, typeCount)
    typeCount += 1
    if (instructionSet == null) {
      return null
    }
    effect.instructionSet = instructionSet
  })

  return {
    instructionSet,
    rawData,
    positiveEffects,
    negativeEffects,
    placeHolders,
    positiveEffectPlaceHolders,
    negativeEffectPlaceHolders,
    ruleIndex: 0,
  }
}

export function parseMappedTrackerSyntax(syntax: MappedTrackerJSON): MappedTrackerDefinition {
  let keyType = syntax.KeyType
  let valueType = syntax.ValueType
  var trackerArrayValueType: number = 0 // Default to VOID type
  var trackerInitialKeys: any[] = encodeTrackerData(syntax.InitialKeys, keyType)
  var trackerInitialValues: any[] = encodeTrackerData(syntax.InitialValues, valueType)
  const keyTypeEnum = (PT.find((_pt) => _pt.name == keyType) ?? PT[4]).enumeration
  const valueTypeEnum = (PT.find((_pt) => _pt.name == valueType) ?? PT[4]).enumeration
  // Determine trackerArrayType based on valueType
  if (valueType === 'uint256[]') {
    trackerArrayValueType = trackerArrayType.UINT_ARRAY
  } else if (valueType === 'address[]') {
    trackerArrayValueType = trackerArrayType.ADDR_ARRAY
  } else if (valueType === 'bytes[]') {
    trackerArrayValueType = trackerArrayType.BYTES_ARRAY
  } else if (valueType === 'bool[]') {
    trackerArrayValueType = trackerArrayType.VOID
  } else if (valueType === 'string[]') {
    trackerArrayValueType = trackerArrayType.STR_ARRAY
  } else {
    trackerArrayValueType = trackerArrayType.VOID
  }

  return {
    name: syntax.Name,
    keyType: keyTypeEnum,
    valueType: valueTypeEnum,
    initialKeys: trackerInitialKeys,
    initialValues: trackerInitialValues,
    arrayValueType: trackerArrayValueType,
  }
}

const getBigIntForBool = (value: string): bigint => {
  if (value == 'true') {
    return 1n
  } else {
    return 0n
  }
}

const getEncodedString = (value: string): string => {
  const interim = BigInt(keccak256(encodeAbiParameters(parseAbiParameters('string'), [value])))
  return encodePacked(['uint256'], [BigInt(interim)])
}

const getEncodedBytes = (value: string): string => {
  var interim = BigInt(
    keccak256(encodeAbiParameters(parseAbiParameters('bytes'), [toHex(stringToBytes(String(value)))]))
  )
  return encodePacked(['uint256'], [BigInt(interim)])
}

const getEncodedAddress = (value: string): string => {
  const validatedAddress = getAddress(value)
  var address = encodeAbiParameters(parseAbiParameters('address'), [validatedAddress])

  return address
}

function encodeTrackerData(valueSet: any[], keyType: string): any[] {
  // const values: any[] = [];
  const values: any[] = valueSet.map((val) => {
    if (keyType == 'uint256[]') {
      const values = val.map((v: string) => encodePacked(['uint256'], [BigInt(v)]))
      return encodeAbiParameters(parseAbiParameters(['bytes[]']), [values])
    } else if (keyType == 'address[]') {
      const values = val.map((v: string) => getEncodedAddress(v))
      return encodeAbiParameters(parseAbiParameters(['bytes[]']), [values])
    } else if (keyType == 'bytes[]') {
      const values = val.map((v: string) => toHex(stringToBytes(String(v))))
      return encodeAbiParameters(parseAbiParameters(['bytes[]']), [values])
    } else if (keyType == 'bool[]') {
      const values = val.map((v: string) => getBigIntForBool(v))
      return encodePacked(['uint256[]'], [values])
    } else if (keyType == 'string[]') {
      const values = val.map((v: string) => getEncodedString(v))
      return encodeAbiParameters(parseAbiParameters(['bytes[]']), [values])
    } else if (keyType == 'uint256') {
      return encodePacked(['uint256'], [BigInt(val)])
    } else if (keyType == 'address') {
      return getEncodedAddress(val)
    } else if (keyType == 'bytes') {
      return getEncodedBytes(val)
    } else if (keyType == 'bool') {
      return getBigIntForBool(val as string)
    } else {
      return getEncodedString(val)
    }
  })

  return values
}

/**
 * Parses the tracker syntax and validates its type and default value.
 *
 * @param syntax - The JSON representation of the tracker syntax.
 * @returns Either an object containing the tracker's name, type, and encoded default value if successful or an error
 */
export function parseTrackerSyntax(syntax: TrackerJSON): TrackerDefinition {
  let trackerType = syntax.Type

  var trackerInitialValue: any
  var trackerValueType: number

  if (trackerType == 'string[]') {
    trackerInitialValue = encodeAbiParameters(parseAbiParameters('string[]'), [syntax.InitialValue as string[]])
    trackerValueType = trackerArrayType.STR_ARRAY
  } else if (trackerType == 'bool[]') {
    const encoded = (syntax.InitialValue as string[]).map((val) => getBigIntForBool(val))
    trackerInitialValue = encodePacked(['uint256[]'], [encoded])
    trackerValueType = trackerArrayType.BOOL_ARRAY
  } else if (trackerType == 'bytes[]') {
    const values = (syntax.InitialValue as string[]).map((val) => toHex(stringToBytes(String(val))))
    trackerInitialValue = encodeAbiParameters(parseAbiParameters('bytes[]'), [values])
    trackerValueType = trackerArrayType.BYTES_ARRAY
  } else if (trackerType == 'address[]') {
    trackerInitialValue = (syntax.InitialValue as string[]).map(getEncodedAddress)
    trackerValueType = trackerArrayType.ADDR_ARRAY
  } else if (trackerType == 'uint256[]') {
    const values = (syntax.InitialValue as string[]).map((val) => BigInt(val))
    trackerInitialValue = encodePacked(['uint256[]'], [values])
    trackerValueType = trackerArrayType.UINT_ARRAY
  } else if (trackerType == 'uint256') {
    trackerInitialValue = encodePacked(['uint256'], [BigInt(syntax.InitialValue as string)])
    trackerValueType = trackerArrayType.VOID
  } else if (trackerType == 'address') {
    trackerInitialValue = getEncodedAddress(syntax.InitialValue as string)
    trackerValueType = trackerArrayType.VOID
  } else if (trackerType == 'bytes') {
    trackerInitialValue = getEncodedBytes(syntax.InitialValue as string)
    trackerValueType = trackerArrayType.VOID
  } else if (trackerType == 'bool') {
    trackerInitialValue = encodePacked(['uint256'], [getBigIntForBool(syntax.InitialValue as string)])
    trackerValueType = trackerArrayType.VOID
  } else {
    trackerInitialValue = encodeAbiParameters(parseAbiParameters('string'), [syntax.InitialValue as string])

    trackerValueType = trackerArrayType.VOID
  }
  var trackerTypeEnum = 0
  trackerTypeEnum = PT.find((pt) => pt.name === trackerType)?.enumeration ?? 4

  return {
    name: syntax.Name,
    type: trackerTypeEnum,
    initialValue: trackerInitialValue,
    arrayValueType: trackerValueType,
  }
}

export function getFCEncodedIndex(
  foreignCallNameToID: NameToID[],
  trackerNameToID: NameToID[],
  functionArguments: string[],
  encodedIndex: string
): Maybe<ForeignCallEncodedIndex> {
  if (encodedIndex.includes('FC:')) {
    const fcMap = foreignCallNameToID.find((fc) => 'FC:' + fc.name.trim() === encodedIndex.trim())
    if (fcMap) {
      return { eType: 1, index: fcMap.id }
    }
  } else if (encodedIndex.includes('TR:')) {
    const trMap = trackerNameToID.find((tr) => 'TR:' + tr.name.trim() === encodedIndex.trim())
    if (trMap) {
      if (trMap.type == 1) {
        return { eType: 4, index: trMap.id }
      } else {
        return { eType: 2, index: trMap.id }
      }
    }
  } else {
    const argIndex = functionArguments.findIndex((arg) => arg.trim() === encodedIndex.trim())
    if (argIndex !== -1) {
      return { eType: 0, index: argIndex }
    }
  }
  return null
}

/**
 * Parses the foreign call definition and validates its structure.
 *
 * @param syntax - The JSON representation of the foreign call definition.
 * @returns Either an object containing the foreign call's name, address, function, return type, parameter types, and encoded indices if successful or an error.
 */
export function parseForeignCallDefinition(
  syntax: ForeignCallJSON,
  foreignCallNameToID: NameToID[],
  trackerNameToID: NameToID[],
  functionArguments: string[]
): ForeignCallDefinition {
  // Validate that the foreign call doesn't reference itself
  const selfReferences = syntax.ValuesToPass.split(',')
    .map((val) => val.trim())
    .filter((val) => val.startsWith('FC:'))
    .map((val) => val.substring(3).trim())
    .filter((fcName) => fcName === syntax.Name)

  if (selfReferences.length > 0) {
    throw new Error(
      `Foreign call "${syntax.Name}" cannot reference itself in valuesToPass. ` +
        `Self-referential foreign calls are not allowed as they would create infinite loops.`
    )
  }

  // Also check mapped tracker key values for self-references
  if (syntax.MappedTrackerKeyValues && syntax.MappedTrackerKeyValues.trim() !== '') {
    const mappedSelfReferences = syntax.MappedTrackerKeyValues.split(',')
      .map((val) => val.trim())
      .filter((val) => val.startsWith('FC:'))
      .map((val) => val.substring(3).trim())
      .filter((fcName) => fcName === syntax.Name)

    if (mappedSelfReferences.length > 0) {
      throw new Error(
        `Foreign call "${syntax.Name}" cannot reference itself in mappedTrackerKeyValues. ` +
          `Self-referential foreign calls are not allowed as they would create infinite loops.`
      )
    }
  }

  const EncodedIndices = syntax.ValuesToPass.split(',')
    .map((encodedIndex) => getFCEncodedIndex(foreignCallNameToID, trackerNameToID, functionArguments, encodedIndex))
    .filter((encoded) => encoded !== null)

  var MappedTrackerKeyIndices: ForeignCallEncodedIndex[] = []
  if (syntax.MappedTrackerKeyValues == '') {
  } else {
    MappedTrackerKeyIndices = syntax.MappedTrackerKeyValues.split(',')
      .map((encodedIndex) => getFCEncodedIndex(foreignCallNameToID, trackerNameToID, functionArguments, encodedIndex))
      .filter((encoded) => encoded !== null)
  }

  const ReturnType: number = PType.indexOf(syntax.ReturnType)

  var ParameterTypes: number[] = splitFunctionInput(syntax.Function).map((val) => determinePTEnumeration(val))

  // Validate that the number of encoded indices matches the expected parameter count
  const expectedParamCount = ParameterTypes.length
  const actualIndicesCount = EncodedIndices.length

  if (actualIndicesCount !== expectedParamCount) {
    throw new Error(
      `Parameter count mismatch for foreign call "${syntax.Name}": ` +
        `expected ${expectedParamCount} parameters but got ${actualIndicesCount} encoded indices. ` +
        `This usually means some dependencies (FC: references) failed to be created.`
    )
  }

  return {
    ...syntax,
    ReturnType,
    ParameterTypes,
    EncodedIndices,
    MappedTrackerKeyIndices,
  }
}

export function determinePTEnumeration(name: string): number {
  return PT.find((pt) => name === pt.name)?.enumeration ?? 4
}

export function parseCallingFunction(syntax: CallingFunctionJSON): string[] {
  return syntax.EncodedValues.split(', ').map((val) => val.trim().split(' ')[1])
}

/**
 * Builds a list of foreign call names from a rule condition string.
 *
 * @param condition - The rule condition string.
 * @returns An array of foreign call names.
 */
export function buildForeignCallList(condition: string): string[] {
  // Use a regular expression to find all FC expressions
  const fcRegex = /FC:[a-zA-Z]+[^\s]+/g
  return Array.from(condition.matchAll(fcRegex)).map((match) => match[0].split(':')[1])
}

/**
 * Builds a list of tracker names from a rule condition string.
 *
 * @param condition - The rule condition string.
 * @returns An array of tracker names.
 */
export function buildTrackerList(condition: string): string[] {
  const trRegex = /TR:[a-zA-Z]+/g
  const truRegex = /TRU:[a-zA-Z]+/g
  var matches = condition.match(trRegex) || []
  var truMatches = condition.match(truRegex) || []

  const trNames = matches.map((match) => match.replace('TR:', ''))
  const truNames = truMatches.map((match) => match.replace('TRU:', ''))

  return [...trNames, ...truNames]
}

/**
 * Cleans the instruction set by replacing string representations of operators with their numeric equivalents.
 *
 * @param instructionSet - The instruction set to clean.
 */
export function cleanInstructionSet(instructionSet: InstructionSet): number[] {
  return instructionSet.map((instruction) => {
    if (instruction == 'N') {
      return 0
    } else if (instruction == 'NOT') {
      return 1
    } else if (instruction == 'PLH') {
      return 2
    } else if (instruction == '=') {
      return 3
    } else if (instruction == 'PLHM') {
      return 4
    } else if (instruction == '+') {
      return 5
    } else if (instruction == '-') {
      return 6
    } else if (instruction == '*') {
      return 7
    } else if (instruction == '/') {
      return 8
    } else if (instruction == '<') {
      return 9
    } else if (instruction == '>') {
      return 10
    } else if (instruction == '==') {
      return 11
    } else if (instruction == 'AND') {
      return 12
    } else if (instruction == 'OR') {
      return 13
    } else if (instruction == '>=') {
      return 14
    } else if (instruction == '<=') {
      return 15
    } else if (instruction == '!=') {
      return 16
    } else if (instruction == 'TRU') {
      return 17
    } else if (instruction == 'TRUM') {
      return 18
    }
    return instruction
  }) as number[]
}

export { parseFunctionArguments }
