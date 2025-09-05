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
  FCNameToID,
  ForeignCallDefinition,
  ForeignCallEncodedIndex,
  MappedTrackerDefinition,
  matchArray,
  Maybe,
  operandArray,
  PT,
  RuleComponent,
  RuleDefinition,
  trackerArrayType,
  TrackerDefinition,
  trackerIndexNameMapping,
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
  foreignCallNameToID: FCNameToID[],
  indexMap: trackerIndexNameMapping[],
  additionalForeignCalls: string[],
  syntax: string
): [string, RuleComponent[]] {
  let components: RuleComponent[] = [...parseFunctionArguments(encodedValues, syntax)]
  let [updatedSyntax, effectCalls] = parseForeignCalls(
    syntax,
    components,
    foreignCallNameToID,
    indexMap,
    additionalForeignCalls
  )
  components = [...components, ...effectCalls]

  const [finalSyntax, effectTrackers] = parseTrackers(updatedSyntax, components, indexMap)

  const gvEComponents = parseGlobalVariables(finalSyntax)

  return [finalSyntax, [...components, ...effectTrackers, ...gvEComponents]]
}

function getProcessedEffects(
  encodedValues: string,
  foreignCallNameToID: FCNameToID[],
  indexMap: trackerIndexNameMapping[],
  additionalEffectForeignCalls: string[],
  effects: string[]
): [string[], RuleComponent[][]] {
  return effects.reduce(
    (acc: [string[], RuleComponent[][]], effect) => {
      const [updatedEffect, effectCalls] = processSyntax(
        encodedValues,
        foreignCallNameToID,
        indexMap,
        additionalEffectForeignCalls,
        effect
      )
      acc[0].push(updatedEffect)
      acc[1].push(effectCalls)
      return acc
    },
    [[], []]
  )
}

/**
 * Parses the rule syntax and converts it into a raw instruction set.
 *
 * @param syntax - The JSON representation of the rule syntax.
 * @param indexMap - A mapping of tracker IDs to their names and types.
 * @param foreignCallNameToID - A mapping of foreign call names to their IDs.
 * @returns An object containing the instruction set, raw data, positive effects, negative effects,
 *          placeholders, and effect placeholders.
 */

export function parseRuleSyntax(
  syntax: RuleJSON,
  indexMap: trackerIndexNameMapping[],
  foreignCallNameToID: FCNameToID[],
  encodedValues: string,
  additionalForeignCalls: string[],
  additionalEffectForeignCalls: string[]
): RuleDefinition {
  const [condition, ruleComponents] = processSyntax(
    encodedValues,
    foreignCallNameToID,
    indexMap,
    additionalForeignCalls,
    removeExtraParenthesis(syntax.condition)
  )

  const placeHolders = buildPlaceholderList(ruleComponents)

  const [processedPositiveEffects, positiveEffectComponents] = getProcessedEffects(
    encodedValues,
    foreignCallNameToID,
    indexMap,
    additionalEffectForeignCalls,
    syntax.positiveEffects
  )

  const [processedNegativeEffects, negativeEffectComponents] = getProcessedEffects(
    encodedValues,
    foreignCallNameToID,
    indexMap,
    additionalEffectForeignCalls,
    syntax.negativeEffects
  )

  const positiveEffectNames = cleanseForeignCallLists([...positiveEffectComponents]);
  let positiveEffectPlaceHolders = buildPlaceholderList(positiveEffectNames);
  positiveEffectPlaceHolders = [...new Set(positiveEffectPlaceHolders)];

  const negativeEffectNames = cleanseForeignCallLists([...negativeEffectComponents]);
  let negativeEffectPlaceHolders = buildPlaceholderList(negativeEffectNames);
  negativeEffectPlaceHolders = [...new Set(negativeEffectPlaceHolders)];

  const positiveEffects = processedPositiveEffects.map(
    (effect) => parseEffect(effect, positiveEffectNames, positiveEffectPlaceHolders, indexMap)
  );
  const negativeEffects = processedNegativeEffects.map((effect) =>
    parseEffect(effect, negativeEffectNames, negativeEffectPlaceHolders, indexMap)
  );

  const conditionInstructionSet = convertHumanReadableToInstructionSet(
    condition,
    ruleComponents,
    indexMap,
    placeHolders
  )

  const excludeArray: string[] = ruleComponents.map((name) => name.name)
  excludeArray.push(...matchArray)
  excludeArray.push(...operandArray)

  const instructionSet = buildRawData(conditionInstructionSet, excludeArray)

  positiveEffects.forEach((effect) => (effect.instructionSet = buildRawData(effect.instructionSet, excludeArray)))

  negativeEffects.forEach((effect) => (effect.instructionSet = buildRawData(effect.instructionSet, excludeArray)))

  return {
    instructionSet,
    positiveEffects,
    negativeEffects,
    placeHolders,
    positiveEffectPlaceHolders,
    negativeEffectPlaceHolders
  };

}

export function parseMappedTrackerSyntax(syntax: MappedTrackerJSON): MappedTrackerDefinition {
  let keyType = syntax.keyType
  let valueType = syntax.valueType
  var trackerArrayValueType: number = 0 // Default to VOID type
  var trackerInitialKeys: any[] = encodeTrackerData(syntax.initialKeys, keyType)
  var trackerInitialValues: any[] = encodeTrackerData(syntax.initialValues, valueType)
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
    name: syntax.name,
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
  let trackerType = syntax.type

  var trackerInitialValue: any
  var trackerValueType: number

  if (trackerType == 'string[]') {
    trackerInitialValue = encodeAbiParameters(parseAbiParameters('string[]'), [syntax.initialValue as string[]])
    trackerValueType = trackerArrayType.STR_ARRAY
  } else if (trackerType == 'bool[]') {
    const encoded = (syntax.initialValue as string[]).map((val) => getBigIntForBool(val))
    trackerInitialValue = encodePacked(['uint256[]'], [encoded])
    trackerValueType = trackerArrayType.BOOL_ARRAY
  } else if (trackerType == 'bytes[]') {
    const values = (syntax.initialValue as string[]).map((val) => toHex(stringToBytes(String(val))))
    trackerInitialValue = encodeAbiParameters(parseAbiParameters('bytes[]'), [values])
    trackerValueType = trackerArrayType.BYTES_ARRAY
  } else if (trackerType == 'address[]') {
    trackerInitialValue = (syntax.initialValue as string[]).map(getEncodedAddress)
    trackerValueType = trackerArrayType.ADDR_ARRAY
  } else if (trackerType == 'uint256[]') {
    const values = (syntax.initialValue as string[]).map((val) => BigInt(val))
    trackerInitialValue = encodePacked(['uint256[]'], [values])
    trackerValueType = trackerArrayType.UINT_ARRAY
  } else if (trackerType == 'uint256') {
    trackerInitialValue = encodePacked(['uint256'], [BigInt(syntax.initialValue as string)])
    trackerValueType = trackerArrayType.VOID
  } else if (trackerType == 'address') {
    trackerInitialValue = getEncodedAddress(syntax.initialValue as string)
    trackerValueType = trackerArrayType.VOID
  } else if (trackerType == 'bytes') {
    trackerInitialValue = encodeAbiParameters(parseAbiParameters('bytes'), [
      toHex(stringToBytes(String(syntax.initialValue))),
    ])
    trackerValueType = trackerArrayType.VOID
  } else if (trackerType == 'bool') {
    trackerInitialValue = encodePacked(['uint256'], [getBigIntForBool(syntax.initialValue as string)])
    trackerValueType = trackerArrayType.VOID
  } else {
    trackerInitialValue = encodeAbiParameters(parseAbiParameters('string'), [syntax.initialValue as string])

    trackerValueType = trackerArrayType.VOID
  }
  var trackerTypeEnum = 0
  trackerTypeEnum = PT.find((pt) => pt.name === trackerType)?.enumeration ?? 4

  return {
    name: syntax.name,
    type: trackerTypeEnum,
    initialValue: trackerInitialValue,
    arrayValueType: trackerValueType,
  }
}

export function getFCEncodedIndex(
  foreignCallNameToID: FCNameToID[],
  indexMap: FCNameToID[],
  functionArguments: string[],
  encodedIndex: string
): Maybe<ForeignCallEncodedIndex> {
  if (encodedIndex.includes('FC:')) {
    const fcMap = foreignCallNameToID.find((fc) => 'FC:' + fc.name.trim() === encodedIndex.trim())
    if (fcMap) {
      return { eType: 1, index: fcMap.id }
    }
  } else if (encodedIndex.includes('TR:')) {
    const trMap = indexMap.find((tr) => 'TR:' + tr.name.trim() === encodedIndex.trim())
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
  foreignCallNameToID: FCNameToID[],
  indexMap: FCNameToID[],
  functionArguments: string[]
): ForeignCallDefinition {
  const encodedIndices = syntax.valuesToPass
    .split(',')
    .map((encodedIndex) => getFCEncodedIndex(foreignCallNameToID, indexMap, functionArguments, encodedIndex))
    .filter((encoded) => encoded !== null)

  var mappedTrackerKeyIndices: ForeignCallEncodedIndex[] = []
  if (syntax.mappedTrackerKeyValues == '') {
  } else {
    mappedTrackerKeyIndices = syntax.mappedTrackerKeyValues
      .split(',')
      .map((encodedIndex) => getFCEncodedIndex(foreignCallNameToID, indexMap, functionArguments, encodedIndex))
      .filter((encoded) => encoded !== null)
  }

  const returnType: number = PType.indexOf(syntax.returnType)

  var parameterTypes: number[] = splitFunctionInput(syntax.function).map((val) => determinePTEnumeration(val))

  return {
    ...syntax,
    returnType,
    parameterTypes,
    encodedIndices,
    mappedTrackerKeyIndices,
  }
}

export function determinePTEnumeration(name: string): number {
  return PT.find((pt) => name === pt.name)?.enumeration ?? 4
}

export function parseCallingFunction(syntax: CallingFunctionJSON): string[] {
  return syntax.encodedValues.split(', ').map((val) => val.trim().split(' ')[1])
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
export function cleanInstructionSet(instructionSet: any[]): any[] {
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
  })
}

export { parseFunctionArguments }
