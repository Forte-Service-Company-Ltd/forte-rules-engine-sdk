/// SPDX-License-Identifier: BUSL-1.1

import { Address, decodeAbiParameters, parseAbiParameters } from 'viem'
import {
  stringReplacement,
  RuleStruct,
  PT,
  TrackerOnChain,
  hexToFunctionString,
  CallingFunctionHashMapping,
  FunctionArgument,
  RuleMetadataStruct,
  ForeignCallOnChain,
  TrackerMetadataStruct,
  RuleDataAndJSON,
  RuleData,
  ForeignCallDataAndJSON,
  ForeignCallData,
  TrackerDataAndJSON,
  MappedTrackerDataAndJSON,
  TrackerData,
  MappedTrackerData,
} from '../modules/types'
import {
  CallingFunctionJSON,
  ForeignCallJSON,
  MappedTrackerJSON,
  RuleJSON,
  TrackerJSON,
  validateCallingFunctionJSON,
  validateMappedTrackerJSON,
  validateTrackerJSON,
} from '../modules/validation'
import { parseFunctionArguments } from './parsing-utilities'
import { isRight, unwrapEither } from '../modules/utils'

/**
 * @file reverse-parsing-logic.ts
 * @description This module provides set of parsing utilities used to convert back from the instruction set syntax
 * to the original human readable syntax
 *
 * @module parser
 *
 * @exports
 * - Functions for reverse parsing rule syntax, trackers, foreign calls, and converting between formats.
 *
 * @author @mpetersoCode55, @ShaneDuncan602, @TJ-Everett, @VoR0220
 *
 * @license BUSL-1.1
 *
 * @note This file is a critical component of the Rules Engine SDK, enabling the translation of human-readable
 *       rule definitions into machine-readable formats and vice versa.
 */

/**
 * Converts an instruction set back into a human-readable rule condition string.
 *
 * @param instructionSet - The instruction set to reverse parse.
 * @param placeHolderArray - An array of placeholders used in the instruction set.
 * @param stringReplacements - An array of string replacements for specific instructions.
 * @returns A human-readable rule condition string.
 */
export function reverseParseInstructionSet(
  instructionSet: number[],
  placeHolderArray: string[],
  stringReplacements: stringReplacement[]
): string {
  var currentAction = -1
  var currentActionIndex = 0
  var currentMemAddress = 0
  var memAddressesMap = []
  var currentInstructionValues: any[] = []
  var retVal = ''
  var instructionNumber = 0
  var truUpdated = false
  var keyIndex = -1
  var valueIndex = -1
  var instructionCount = instructionSet.length
  for (var instruction of instructionSet) {
    if (currentAction == -1) {
      currentAction = Number(instruction)
      switch (currentAction) {
        case 0:
          currentActionIndex = 1
          break
        case 1:
          currentActionIndex = 1
          break
        case 2:
          currentActionIndex = 1
          break
        case 3:
          currentActionIndex = 2
          break
        case 4:
          currentActionIndex = 2
          break
        case 5:
          currentActionIndex = 2
          break
        case 6:
          currentActionIndex = 2
          break
        case 7:
          currentActionIndex = 2
          break
        case 8:
          currentActionIndex = 2
          break
        case 9:
          currentActionIndex = 2
          break
        case 10:
          currentActionIndex = 2
          break
        case 11:
          currentActionIndex = 2
          break
        case 12:
          currentActionIndex = 2
          break
        case 17:
          currentActionIndex = 3
          break
        case 18:
          currentActionIndex = 4
          break
        default:
          currentActionIndex = 2
          break
      }
    } else {
      switch (currentAction) {
        case 0:
          var found = false
          for (var raw of stringReplacements) {
            if (raw.instructionSetIndex == instructionNumber) {
              memAddressesMap.push({
                memAddr: currentMemAddress,
                value: raw.originalData,
              })
              found = true
              break
            }
          }
          if (!found) {
            memAddressesMap.push({
              memAddr: currentMemAddress,
              value: instruction,
            })
          }
          currentMemAddress += 1
          break
        case 1:
          for (var memValue of memAddressesMap) {
            if (memValue.memAddr == instruction) {
              currentInstructionValues.push(memValue.value)
            }
          }
          if (currentActionIndex == 1) {
            var currentString = 'NOT ' + currentInstructionValues[0]
            memAddressesMap.push({
              memAddr: currentMemAddress,
              value: currentString,
            })
            retVal = currentString
            currentMemAddress += 1
            currentInstructionValues = []
          }
          break
        case 2:
          memAddressesMap.push({
            memAddr: currentMemAddress,
            value: placeHolderArray[instruction],
          })
          keyIndex = instruction
          currentMemAddress += 1
          retVal = placeHolderArray[instruction]
          break
        case 3:
          retVal = arithmeticOperatorReverseInterpretation(
            instruction,
            currentMemAddress,
            memAddressesMap,
            currentActionIndex,
            currentInstructionValues,
            ' = '
          )
          if (currentActionIndex == 1) {
            currentMemAddress += 1
            currentInstructionValues = []
          }
          break
        case 4:
          if (currentActionIndex == 2) {
            valueIndex = instruction
          } else {
            var newMem = placeHolderArray[valueIndex] + '(' + placeHolderArray[keyIndex] + ')'
            memAddressesMap.push({
              memAddr: currentMemAddress,
              value: newMem,
            })
            currentMemAddress += 1
          }

          break
        case 5:
          retVal = arithmeticOperatorReverseInterpretation(
            instruction,
            currentMemAddress,
            memAddressesMap,
            currentActionIndex,
            currentInstructionValues,
            ' + '
          )
          if (currentActionIndex == 1) {
            currentMemAddress += 1
            currentInstructionValues = []
          }
          break
        case 6:
          retVal = arithmeticOperatorReverseInterpretation(
            instruction,
            currentMemAddress,
            memAddressesMap,
            currentActionIndex,
            currentInstructionValues,
            ' - '
          )
          if (currentActionIndex == 1) {
            currentMemAddress += 1
            currentInstructionValues = []
          }
          break
        case 7:
          retVal = arithmeticOperatorReverseInterpretation(
            instruction,
            currentMemAddress,
            memAddressesMap,
            currentActionIndex,
            currentInstructionValues,
            ' * '
          )
          if (currentActionIndex == 1) {
            currentMemAddress += 1
            currentInstructionValues = []
          }
          break
        case 8:
          retVal = arithmeticOperatorReverseInterpretation(
            instruction,
            currentMemAddress,
            memAddressesMap,
            currentActionIndex,
            currentInstructionValues,
            ' / '
          )
          if (currentActionIndex == 1) {
            currentMemAddress += 1
            currentInstructionValues = []
          }
          break
        case 9:
          retVal = arithmeticOperatorReverseInterpretation(
            instruction,
            currentMemAddress,
            memAddressesMap,
            currentActionIndex,
            currentInstructionValues,
            ' < '
          )
          if (currentActionIndex == 1) {
            currentMemAddress += 1
            currentInstructionValues = []
          }
          break
        case 10:
          retVal = arithmeticOperatorReverseInterpretation(
            instruction,
            currentMemAddress,
            memAddressesMap,
            currentActionIndex,
            currentInstructionValues,
            ' > '
          )
          if (currentActionIndex == 1) {
            currentMemAddress += 1
            currentInstructionValues = []
          }
          break
        case 11:
          retVal = arithmeticOperatorReverseInterpretation(
            instruction,
            currentMemAddress,
            memAddressesMap,
            currentActionIndex,
            currentInstructionValues,
            ' == '
          )
          if (currentActionIndex == 1) {
            currentMemAddress += 1
            currentInstructionValues = []
          }
          break
        case 12:
          retVal = logicalOperatorReverseInterpretation(
            instruction,
            currentMemAddress,
            memAddressesMap,
            currentActionIndex,
            currentInstructionValues,
            ' AND '
          )
          if (currentActionIndex == 1) {
            currentMemAddress += 1
            currentInstructionValues = []
          }
          break
        case 13:
          retVal = logicalOperatorReverseInterpretation(
            instruction,
            currentMemAddress,
            memAddressesMap,
            currentActionIndex,
            currentInstructionValues,
            ' OR '
          )
          if (currentActionIndex == 1) {
            currentMemAddress += 1
            currentInstructionValues = []
          }
          break
        case 14:
          retVal = arithmeticOperatorReverseInterpretation(
            instruction,
            currentMemAddress,
            memAddressesMap,
            currentActionIndex,
            currentInstructionValues,
            ' >= '
          )
          if (currentActionIndex == 1) {
            currentMemAddress += 1
            currentInstructionValues = []
          }
          break
        case 15:
          retVal = arithmeticOperatorReverseInterpretation(
            instruction,
            currentMemAddress,
            memAddressesMap,
            currentActionIndex,
            currentInstructionValues,
            ' <= '
          )
          if (currentActionIndex == 1) {
            currentMemAddress += 1
            currentInstructionValues = []
          }
          break
        case 16:
          retVal = arithmeticOperatorReverseInterpretation(
            instruction,
            currentMemAddress,
            memAddressesMap,
            currentActionIndex,
            currentInstructionValues,
            ' != '
          )
          if (currentActionIndex == 1) {
            currentMemAddress += 1
            currentInstructionValues = []
          }
          break
        case 17:
        case 18:
          if (!truUpdated) {
            var str = memAddressesMap[currentMemAddress - 1].value
            var memVal: any = str
              .replace('TR:', 'TRU:')
              .replace('-', '-=')
              .replace('+', '+=')
              .replace('*', '*=')
              .replace('/', '/=')
            truUpdated = true
            memAddressesMap.push({
              memAddr: currentMemAddress,
              value: memVal,
            })
          }
          if (currentActionIndex == 1) {
            currentMemAddress += 1
            currentInstructionValues = []
            truUpdated = false

            if (instructionNumber + 1 == instructionCount) {
              retVal = memAddressesMap[currentMemAddress - 1].value
            }
          }
          break

        default:
          console.log('unknown instruction')
          break
      }
      currentActionIndex -= 1
      if (currentActionIndex == 0) {
        currentAction = -1
      }
    }
    instructionNumber += 1
  }
  if (retVal.at(0) == '(') {
    retVal = retVal.substring(2, retVal.length - 2)
  }
  return retVal
}

export const reverseParsePlaceholder = (
  placeholder: any,
  names: FunctionArgument[],
  foreignCalls: ForeignCallOnChain[],
  trackers: TrackerOnChain[],
  mappings: hexToFunctionString[]
): string => {
  if (placeholder.flags == 0x01) {
    const call = foreignCalls.find((call) => call.foreignCallIndex === placeholder.typeSpecificIndex)
    const map = mappings.find((map) => map.hex === call?.signature)
    return 'FC:' + map?.functionString.split('(')[0]
  } else if (placeholder.flags == 0x02) {
    const map = mappings.find((map) => map.index === placeholder.typeSpecificIndex)
    return 'TR:' + map?.functionString
  } else if (placeholder.flags == 0x04) {
    return 'GV:MSG_SENDER'
  } else if (placeholder.flags == 0x08) {
    return 'GV:BLOCK_TIMESTAMP'
  } else if (placeholder.flags == 0x0c) {
    return 'GV:MSG_DATA'
  } else if (placeholder.flags == 0x10) {
    return 'GV:BLOCK_NUMBER'
  } else if (placeholder.flags == 0x14) {
    return 'GV:TX_ORIGIN'
  } else {
    return names[placeholder.typeSpecificIndex].name
  }
}

/**
 * Decodes a hex-encoded string to human-readable text.
 * Handles both hex strings with '0x' prefix and without.
 *
 * @param hexString - The hex-encoded string to decode
 * @returns The decoded human-readable string
 */
function decodeHexString(hexString: string): string {
  // If it's already a regular string (not hex), return it as is
  if (!hexString.startsWith('0x') && !/^[0-9a-fA-F]+$/.test(hexString)) {
    return hexString
  }

  // Remove '0x' prefix if present
  const cleanHex = hexString.startsWith('0x') ? hexString.slice(2) : hexString

  try {
    // Convert hex to buffer and then to string, removing null padding
    const decoded = Buffer.from(cleanHex, 'hex').toString('utf8').replace(/\0+$/, '')
    return decoded || hexString // Return original if decoding results in empty string
  } catch (error) {
    // If decoding fails, return the original string
    return hexString
  }
}

export const reverseParseEffect = (effect: any, placeholders: string[]): string => {
  if (effect.effectType == 0) {
    const decodedText = decodeHexString(effect.text)
    return "revert('" + decodedText + "')"
  } else if (effect.effectType == 1) {
    const decodedText = decodeHexString(effect.text)
    return 'emit ' + '"' + decodedText + '"'
  } else {
    return reverseParseInstructionSet(effect.instructionSet, placeholders, [])
  }
}

/**
 * Convert on-chain RuleStruct + metadata into a { data, json } pair.
 *
 * Builds a human-readable `RuleJSON` and a `RuleData` that includes the id,
 * by reverse-parsing the condition and effects and resolving placeholders.
 *
 * @param functionString - Calling function signature for the rule JSON.
 * @param encodedValues - Encoded calling-function args used to derive names.
 * @param ruleS - On-chain RuleStruct (instructionSet, placeholders, effects).
 * @param ruleM - Rule metadata (name, description).
 * @param foreignCalls - Foreign calls referenced by placeholders.
 * @param trackers - Trackers referenced by placeholders.
 * @param mappings - Hex-to-function mappings to resolve signatures.
 * @param ruleId - Optional id to include in the returned RuleData.
 * @returns RuleDataAndJSON: { data: RuleData, json: RuleJSON }.
 *
 * The function processes the `RuleStruct` object to:
 * - Extract placeholder names and append them to `plhArray`.
 * - Parse and format positive and negative effects into strings.
 * - Reverse parse the rule's instruction set to generate a condition string.
 * - Populate the `ruleJSON` object with the processed data.
 */
export function convertRuleStructToString(
  functionString: string,
  encodedValues: string,
  ruleS: RuleStruct,
  ruleM: RuleMetadataStruct,
  foreignCalls: ForeignCallOnChain[],
  trackers: TrackerOnChain[],
  mappings: hexToFunctionString[],
  ruleId?: number
): RuleDataAndJSON {
  var rJSON: RuleJSON = {
    Name: ruleM.ruleName,
    Description: ruleM.ruleDescription,
    condition: '',
    positiveEffects: [],
    negativeEffects: [],
    callingFunction: '',
  }

  var names = parseFunctionArguments(encodedValues)

  const plhArray = ruleS.placeHolders.map((placeholder) =>
    reverseParsePlaceholder(placeholder, names, foreignCalls, trackers, mappings)
  )

  rJSON.condition = reverseParseInstructionSet(ruleS!.instructionSet, plhArray, [])
  rJSON.callingFunction = functionString

  const posEffectPlhArray = ruleS.positiveEffectPlaceHolders.map((placeholder) =>
    reverseParsePlaceholder(placeholder, names, foreignCalls, trackers, mappings)
  )

  const negEffectPlhArray = ruleS.negativeEffectPlaceHolders.map((placeholder) =>
    reverseParsePlaceholder(placeholder, names, foreignCalls, trackers, mappings)
  )
  rJSON.positiveEffects = ruleS.posEffects.map((effect) => reverseParseEffect(effect, posEffectPlhArray))
  rJSON.negativeEffects = ruleS.negEffects.map((effect) => reverseParseEffect(effect, negEffectPlhArray))

  const ruleData: RuleData = {
    id: Number(ruleId),
    ...rJSON,
  }

  return { data: ruleData, json: rJSON }
}

/**
 * Convert on-chain foreign call entries into { data, json } pairs.
 *
 * Resolves function signatures and return types using `callingFunctionMappings`
 * and `PT`, and maps each on-chain entry to the ForeignCallJSON shape along
 * with an id-bearing ForeignCallData.
 *
 * The output string format is:
 * `Foreign Call <index> --> <foreignCallAddress> --> <functionSignature> --> <returnType> --> <parameterTypes>`
 *
 * Example:
 * ```
 * Foreign Call 1 --> 0x1234567890abcdef --> myFunction(uint256) --> uint256 --> uint256, string
 * ```
 * @param foreignCallsOnChain - On-chain foreign call entries.
 * @param callingFunctionMappings - Hex-to-function mappings for signatures and arg encodings.
 * @returns Array of ForeignCallDataAndJSON.
 */
export function convertForeignCallStructsToStrings(
  foreignCallsOnChain: ForeignCallOnChain[],
  callingFunctionMappings: hexToFunctionString[],
  names: string[]
): ForeignCallDataAndJSON[] {
  const foreignCalls: ForeignCallDataAndJSON[] = foreignCallsOnChain.map((call, iter) => {
    const functionMeta = callingFunctionMappings.find((mapping) => mapping.hex === call.signature)

    const returnTypeString = PT.find((pType) => pType.enumeration == call.returnType)?.name

    const callingFunction = callingFunctionMappings.find((mapping) => mapping.hex == call.callingFunctionSelector)
    const inputs: ForeignCallJSON = {
      name: names[iter],
      address: call.foreignCallAddress as Address,
      function: functionMeta?.functionString || '',
      returnType: returnTypeString || 'string',
      valuesToPass: functionMeta?.encodedValues || '',
      mappedTrackerKeyValues: '',
      callingFunction: callingFunction?.functionString || '',
    }

    const foreignCallData: ForeignCallData = {
      id: Number(call.foreignCallIndex),
      ...inputs,
    }

    return {
      data: foreignCallData,
      json: inputs,
    }
  })

  return foreignCalls
}

function retrieveDecoded(type: number, key: string): string {
  if (type == 0) {
    return decodeAbiParameters(parseAbiParameters('address'), key as `0x${string}`)[0].toLowerCase()
  } else if (type == 1) {
    return decodeAbiParameters(parseAbiParameters('string'), key as `0x${string}`)[0]
  } else if (type == 2) {
    return String(Number(key))
  } else if (type == 3) {
    return Number(key) == 0 ? 'false' : 'true'
  } else {
    return key
  }
}

/**
 * Convert on-chain tracker entries into JSON + data pairs.
 *
 * - Non-mapped trackers are validated by `validateTrackerJSON`.
 * - Mapped trackers are validated by `validateMappedTrackerJSON`.
 * Keys/values are decoded according to pType.
 *
 * @param trackers - On-chain tracker entries.
 * @param trackerNames - Metadata for non-mapped trackers (names/initial values).
 * @param mappedTrackerNames - Metadata for mapped trackers (names/keys/values).
 * @returns Object with { Trackers, MappedTrackers } arrays.
 */
export function convertTrackerStructsToStrings(
  trackers: TrackerOnChain[],
  trackerNames: TrackerMetadataStruct[],
  mappedTrackerNames: TrackerMetadataStruct[]
): {
  Trackers: TrackerDataAndJSON[]
  MappedTrackers: MappedTrackerDataAndJSON[]
} {
  const Trackers: TrackerDataAndJSON[] = trackers
    .filter((tracker) => !tracker.mapped)
    .map((tracker, iter) => {
      const trackerType = PT.find((pt) => pt.enumeration === tracker.pType)?.name || 'string'

      var initialValue = retrieveDecoded(tracker.pType, trackerNames[iter].initialValue)

      const inputs: TrackerJSON = {
        name: trackerNames[iter].trackerName,
        type: trackerType,
        initialValue: initialValue,
      }
      const validatedInputs = validateTrackerJSON(JSON.stringify(inputs))
      if (isRight(validatedInputs)) {
        const trackerJSON = unwrapEither(validatedInputs)
        const trackerData: TrackerData = {
          id: Number(tracker.trackerIndex),
          ...trackerJSON,
        }

        return { data: trackerData, json: trackerJSON }
      } else {
        throw new Error(`Invalid tracker input: ${JSON.stringify(validatedInputs.left)}`)
      }
    })
  const MappedTrackers: MappedTrackerDataAndJSON[] = trackers
    .filter((tracker) => tracker.mapped)
    .map((tracker, iter) => {
      const valueType = PT.find((pt) => pt.enumeration === tracker.pType)?.name || 'string'
      const keyType = PT.find((pt) => pt.enumeration === tracker.trackerKeyType)?.name || 'string'

      var keys = []

      for (var key of mappedTrackerNames[iter].initialKeys) {
        var decodedKey = retrieveDecoded(tracker.trackerKeyType, key)

        keys.push(decodedKey)
      }

      var values = []
      for (var key of mappedTrackerNames[iter].initialValues) {
        var decodedValue = retrieveDecoded(tracker.pType, key)
        values.push(decodedValue)
      }

      const inputs: MappedTrackerJSON = {
        name: mappedTrackerNames[iter].trackerName,
        valueType,
        keyType,
        initialKeys: keys,
        initialValues: values,
      }
      const validatedInputs = validateMappedTrackerJSON(JSON.stringify(inputs))
      if (isRight(validatedInputs)) {
        const mappedTrackerJSON = unwrapEither(validatedInputs)
        const mappedTrackerData: MappedTrackerData = {
          id: Number(tracker.trackerIndex),
          ...mappedTrackerJSON,
        }
        return { data: mappedTrackerData, json: mappedTrackerJSON }
      } else {
        throw new Error(`Invalid mapped tracker input: ${JSON.stringify(validatedInputs.left)}`)
      }
    })
  return {
    Trackers,
    MappedTrackers,
  }
}

/**
 * Validate and convert calling function entries to JSON.
 *
 * @param callingFunctions - Array of calling function hash mappings.
 * @returns Array of validated CallingFunctionJSON objects.
 */
export function convertCallingFunctionToStrings(callingFunctions: CallingFunctionHashMapping[]): CallingFunctionJSON[] {
  const callingFunctionJsons: CallingFunctionJSON[] = callingFunctions.map((callingFunction) => {
    const validatedInputs = validateCallingFunctionJSON(JSON.stringify(callingFunction))
    if (isRight(validatedInputs)) {
      return unwrapEither(validatedInputs)
    } else {
      throw new Error(`Invalid calling function input: ${JSON.stringify(validatedInputs.left)}`)
    }
  })
  return callingFunctionJsons
}

/**
 * Interprets an arithmetic operation in reverse by mapping memory addresses to their values
 * and constructing a string representation of the operation.
 *
 * @param instruction - The memory address of the instruction to interpret.
 * @param currentMemAddress - The current memory address where the result will be stored.
 * @param memAddressesMap - An array of objects mapping memory addresses to their values.
 * @param currentActionIndex - The index of the current action being processed.
 * @param currentInstructionValues - An array to store the values of the current instruction.
 * @param symbol - The arithmetic operator symbol (e.g., "+", "-", "*", "/") to use in the operation.
 * @returns The string representation of the arithmetic operation if `currentActionIndex` is 1, otherwise an empty string.
 */
function arithmeticOperatorReverseInterpretation(
  instruction: number,
  currentMemAddress: number,
  memAddressesMap: any[],
  currentActionIndex: number,
  currentInstructionValues: any[],
  symbol: string
): string {
  for (var memValue of memAddressesMap) {
    if (memValue.memAddr == instruction) {
      currentInstructionValues.push(memValue.value)
    }
  }
  if (currentActionIndex == 1) {
    var currentString = currentInstructionValues[0] + symbol + currentInstructionValues[1]
    memAddressesMap.push({ memAddr: currentMemAddress, value: currentString })
    return currentString
  }
  return ''
}

/**
 * Interprets a logical operation in reverse by mapping memory addresses to their values
 * and constructing a string representation of the operation.
 *
 * @param instruction - The memory address of the instruction to interpret.
 * @param currentMemAddress - The current memory address where the result will be stored.
 * @param memAddressesMap - An array of objects mapping memory addresses to their values.
 * @param currentActionIndex - The index of the current action being processed.
 * @param currentInstructionValues - An array to store the values of the current instruction.
 * @param symbol - The logical operator symbol (e.g., "&&", "||") used in the operation.
 * @returns The string representation of the logical operation if `currentActionIndex` is 1,
 *          otherwise an empty string.
 */
function logicalOperatorReverseInterpretation(
  instruction: number,
  currentMemAddress: number,
  memAddressesMap: any[],
  currentActionIndex: number,
  currentInstructionValues: any[],
  symbol: string
): string {
  for (var memValue of memAddressesMap) {
    if (memValue.memAddr == instruction) {
      currentInstructionValues.push(memValue.value)
    }
  }
  if (currentActionIndex == 1) {
    var currentString = '( ' + currentInstructionValues[0] + symbol + currentInstructionValues[1] + ' )'
    memAddressesMap.push({ memAddr: currentMemAddress, value: currentString })
    return currentString
  }
  return ''
}
