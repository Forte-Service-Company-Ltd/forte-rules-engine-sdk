/// SPDX-License-Identifier: BUSL-1.1
import { encodeAbiParameters, isAddress, keccak256, parseAbiParameters } from 'viem'
import {
  trackerIndexNameMapping,
  FCNameToID,
  EffectType,
  PlaceholderStruct,
  operandArray,
  EffectDefinition,
  FunctionArgument,
  TrackerArgument,
  RuleComponent,
  PTNamesTracker,
  Maybe,
} from '../modules/types'
import { convertHumanReadableToInstructionSet } from './internal-parsing-logic'
import { getRandom } from '../modules/utils'

/**
 * @file parsing-utilities.ts
 * @description This module provies utility functions that the rest of the parsing logic depends on.
 *
 * @module parser
 *
 * @exports
 * - Utilities for the main parsing logic
 *
 * @author @mpetersoCode55, @ShaneDuncan602, @TJ-Everett, @VoR0220
 *
 * @license BUSL-1.1
 *
 * @note This file is a critical component of the Rules Engine SDK, enabling the translation of human-readable
 *       rule definitions into machine-readable formats and vice versa.
 */

/**
 * Parses the function signature string and builds an array of argument placeholders.
 *
 * @param encodedValues - The encoded values string.
 * @param condition - Optional parameter for the condition statement of a rule
 * @returns An array of FunctionArgument.
 */
export function parseFunctionArguments(encodedValues: string, condition?: string): FunctionArgument[] {
  // handle empty args
  if (encodedValues === '') return []

  return encodedValues
    .trim()
    .split(',')
    .map((param, tIndex) => {
      const parts = param.trim().split(' ')
      const name = parts[1].trim()
      const rawType = parts[0].trim()
      if (PTNamesTracker.includes(rawType) && (condition == null || condition.includes(name))) {
        return {
          name,
          tIndex,
          rawType,
        }
      } else {
        return null
      }
    })
    .filter((p) => p != null)
}

/**
 * Parses tracker references in a rule condition string and adds them to the argument list.
 *
 * @param condition - The rule condition string.
 * @param names - An array of argument placeholders.
 * @param indexMap - A mapping of tracker IDs to their names and types.
 *
 * @returns an array of created Tracker objects.
 */
export function parseTrackers(
  condition: string,
  names: any[],
  indexMap: trackerIndexNameMapping[]
): [string, TrackerArgument[]] {
  const trRegex = /TR:[a-zA-Z]+/g
  const truRegex = /TRU:[a-zA-Z]+/g

  const matches = [...new Set(condition.match(trRegex) || [])]

  const trMappedRegex = /TR:[a-zA-Z]+\([^()]+\)/g
  const truMappedRegex = /TRU:[a-zA-Z]+\([^()]+\)/g
  const mappedMatches = condition.match(trMappedRegex) || []
  const mappedUpdateMatches = condition.match(truMappedRegex) || []
  const mappedMatchesSet = [...new Set([...mappedMatches, ...mappedUpdateMatches])]

  // replace mapped tracker parens syntx `trackerName(key) with pipe syntax `trackerName | key`
  const trCondition = mappedMatchesSet.reduce((acc, match) => {
    let initialSplit = match.split('(')[1]

    initialSplit = initialSplit.substring(0, initialSplit.length - 1)

    return acc.replace(match, initialSplit + ' | ' + match.split('(')[0])
  }, condition)

  const trackers: TrackerArgument[] = matches.map((name) => {
    let rawTypeTwo = 'address'
    let tIndex = 0
    const tracker = indexMap.find((index) => 'TR:' + index.name == name)
    if (tracker) {
      tIndex = tracker.id
      if (tracker.type == 0) {
        rawTypeTwo = 'address'
      } else if (tracker.type == 1) {
        rawTypeTwo = 'string'
      } else if (tracker.type == 3) {
        rawTypeTwo = 'bool'
      } else if (tracker.type == 5) {
        rawTypeTwo = 'bytes'
      } else {
        rawTypeTwo = 'uint256'
      }
    }
    return {
      name,
      tIndex,
      rawType: 'tracker',
      rawTypeTwo,
    }
  })

  const updateMatchesSet = [...new Set([...(condition.match(truRegex) || [])])]

  const updatedTrackers: TrackerArgument[] = updateMatchesSet
    .map((name: string): Maybe<TrackerArgument> => {
      let tIndex = 0
      name = name.replace('TRU:', 'TR:')
      const tracker = indexMap.find((index) => 'TR:' + index.name == name)
      if (tracker) {
        tIndex = tracker.id
      }
      if (![...names, ...trackers].some((item) => item.name == name)) {
        return {
          name,
          tIndex,
          rawType: 'tracker',
        }
      }

      return null
    })
    .filter((t) => t != null)

  return [trCondition, [...trackers, ...updatedTrackers]]
}

export function parseGlobalVariables(condition: string): RuleComponent[] {
  const fcRegex = /GV:[a-zA-Z]+[^\s]+/g

  // Convert matches iterator to array to process all at once
  const matches = condition.matchAll(fcRegex)
  const matchesArray: RegExpExecArray[] = [...matches]
  const gvExpressions = ['GV:BLOCK_TIMESTAMP', 'GV:MSG_DATA', 'GV:MSG_SENDER', 'GV:BLOCK_NUMBER', 'GV:TX_ORIGIN']
  const components: RuleComponent[] = matchesArray
    .filter((name) => gvExpressions.includes(name[0]))
    .map((name) => {
      return { name: name[0], tIndex: 0, rawType: 'Global' }
    })

  return components
}

/**
 * Parses a condition string to identify and process foreign call (FC) expressions.
 * Replaces each FC expression with a unique placeholder and updates the `names` array
 * with metadata about the processed expressions.
 *
 * @param condition - The input condition string containing potential FC expressions.
 * @param names - An array to store metadata about the processed FC expressions, including
 *                their placeholders, indices, and types.
 * @param foreignCallNameToID - An array mapping foreign call names to their corresponding IDs.
 * @returns The updated condition string with FC expressions replaced by placeholders
 *          and an array of created ForeignCall
 *
 * @remarks
 * - FC expressions are identified using the regular expression `/FC:[a-zA-Z]+[^\s]+/g`.
 * - If an FC expression is already present in the `names` array, its existing placeholder
 *   is reused.
 * - Each new FC expression is assigned a unique placeholder in the format `FC:<getRandom()>`.
 */
export function parseForeignCalls(
  condition: string,
  names: any[],
  foreignCallNameToID: FCNameToID[],
  indexMap: FCNameToID[],
  additionalForeignCalls: string[]
): [string, RuleComponent[]] {
  // Use a regular expression to find all FC expressions
  const fcRegex = /FC:[a-zA-Z]+[^\s]+/g
  const matches = Array.from(condition.matchAll(fcRegex))

  const parsed = additionalForeignCalls.reduce(
    (acc: { condition: string; components: RuleComponent[] }, additional: string) => {
      const additionalMatch = matches.find((match) => match[0].trim() == additional.trim())
      if (additionalMatch) {
        if (names.indexOf(additionalMatch) !== -1) {
          let ph = names[names.indexOf(additionalMatch)].fcPlaceholder
          acc.condition = acc.condition.replace(additionalMatch[0], ph)
        } else {
          // Create a unique placeholder for this FC expression
          let placeholder = `FC:${getRandom()}`
          const existing = names.find((n) => n.name == additionalMatch[0])
          if (existing) {
            placeholder = existing.fcPlaceholder
          }
          acc.condition = acc.condition.replace(additionalMatch[0], placeholder)
          if (!existing) {
            var index = 0

            const fcMap = foreignCallNameToID.find((fc) => 'FC:' + fc.name.trim() == additionalMatch[0].trim())

            if (fcMap) {
              index = fcMap.id
            }
            acc.components.push({
              name: additionalMatch[0],
              tIndex: index,
              rawType: 'foreign call',
              fcPlaceholder: placeholder,
            })
          }
        }
      } else {
        const existing = names.find((n) => n.name == additional.trim().split('(')[0])
        if (!existing) {
          var index = 0
          const fcMap = foreignCallNameToID.find((fc) => 'FC:' + fc.name.trim() == additional.trim().split('(')[0])
          if (fcMap) {
            index = fcMap.id
          }
          if (additional.includes('TR:')) {
            const [updatedSyntax, trackers] = parseTrackers(' ' + additional + ' ', names, indexMap)
            acc.components.push(...trackers)
          } else {
            acc.components.push({
              name: additional.trim().split('(')[0],
              tIndex: index,
              rawType: 'foreign call',
              fcPlaceholder: 'noPH',
            })
          }
        }
      }
      return acc
    },
    { condition, components: [] }
  )

  return [parsed.condition, parsed.components]
}

export function cleanseForeignCallLists(doubleArray: any[]): any[] {
  var iterToSkip = 0
  for (var innerArray of doubleArray) {
    for (var value of innerArray) {
      if (value.fcPlaceholder != 'noPH' && value.rawType == 'foreign call') {
        var secondLoopIter = 0
        for (var secondLoopArray of doubleArray) {
          if (secondLoopIter == iterToSkip) {
            secondLoopIter += 1
            continue
          } else {
            var thirdLoopIter = 0
            var itersToRemove = []
            for (var innerValue of secondLoopArray) {
              if (innerValue.fcPlaceholder == 'noPH' && innerValue.name == value.name) {
                itersToRemove.push(thirdLoopIter)
              }
              thirdLoopIter += 1
            }
            for (var fourthLoopIter of itersToRemove) doubleArray[secondLoopIter].splice(fourthLoopIter, 1)
          }
          secondLoopIter += 1
        }
      }
    }
    iterToSkip += 1
  }
  var finalizedArray = []
  for (var innerArray of doubleArray) {
    for (var value of innerArray) {
      finalizedArray.push(value)
    }
  }

  var toRemove = []
  var iterToSkip = 0
  for (var passOne of finalizedArray) {
    var secondIter = 0
    for (var passTwo of finalizedArray) {
      if (secondIter > iterToSkip) {
        if (passOne.name == passTwo.name) {
          toRemove.push(secondIter)
        }
      }
      secondIter += 1
    }
    iterToSkip += 1
  }

  toRemove = [...new Set(toRemove)]
  toRemove.sort((a, b) => a - b)
  var reduceCount = 0
  for (var secondRemoval of toRemove) {
    finalizedArray.splice(secondRemoval - reduceCount, 1)
    reduceCount += 1
  }
  return finalizedArray
}

/**
 * Build the placeholder struct array from the names array
 *
 * @param names - array in the SDK internal format for placeholders
 * @returns Placeholder array in the chain specific format
 */
export function buildPlaceholderList(names: any[]): PlaceholderStruct[] {
  var placeHolders: PlaceholderStruct[] = []
  for (var name of names) {
    var flags = 0x0
    var placeHolderEnum = 0
    var tracker = false
    if (name.rawType == 'address') {
      placeHolderEnum = 0
    } else if (name.rawType == 'string') {
      placeHolderEnum = 1
    } else if (name.rawType == 'uint256') {
      placeHolderEnum = 2
    } else if (name.rawType == 'bool') {
      placeHolderEnum = 3
    } else if (name.rawType == 'bytes') {
      placeHolderEnum = 5
    } else if (name.rawType == 'uint256[]' || name.rawType == 'address[]' || name.rawType == 'bool[]') {
      placeHolderEnum = 6
    } else if (name.rawType == 'string[]' || name.rawType == 'bytes[]') {
      placeHolderEnum = 7
    } else if (name.rawType == 'tracker') {
      if ((name as any).rawTypeTwo == 'address') {
        placeHolderEnum = 0
      } else if ((name as any).rawTypeTwo == 'string') {
        placeHolderEnum = 1
      } else if ((name as any).rawTypeTwo == 'bool') {
        placeHolderEnum = 3
      } else if ((name as any).rawTypeTwo == 'bytes') {
        placeHolderEnum = 5
      } else {
        placeHolderEnum = 2
      }
      tracker = true
    } else if (name.rawType == 'Global') {
      if (name.name == 'GV:MSG_SENDER') {
        flags = 0x04
      } else if (name.name == 'GV:BLOCK_TIMESTAMP') {
        flags = 0x08
      } else if (name.name == 'GV:MSG_DATA') {
        flags = 0x0c
      } else if (name.name == 'GV:BLOCK_NUMBER') {
        flags = 0x10
      } else if (name.name == 'GV:TX_ORIGIN') {
        flags = 0x14
      }
    }

    if (flags == 0x00) {
      flags = name.rawType == 'foreign call' ? 0x01 : tracker ? 0x02 : 0x00
    }

    var placeHolder: PlaceholderStruct = {
      pType: placeHolderEnum,
      typeSpecificIndex: name.tIndex,
      mappedTrackerKey: encodeAbiParameters(parseAbiParameters('uint256'), [BigInt(1)]),
      flags,
    }
    placeHolders.push(placeHolder)
  }
  return placeHolders
}

/**
 * Parses an effect string and extracts its type, text, instruction set, parameter type,
 * and parameter value. The function supports three types of effects: "emit", "revert",
 * and general expressions.
 *
 * @param effect - The effect string to parse.
 * @param names - An array of names used for interpreting expressions.
 * @param placeholders - An array to store placeholder structures extracted during parsing.
 * @param indexMap - A mapping of tracker index names used for interpreting expressions.
 *
 * @returns An object containing:
 * - `type`: The type of the effect (e.g., `EffectType.REVERT`, `EffectType.EVENT`, or `EffectType.EXPRESSION`).
 * - `text`: The extracted text of the effect.
 * - `instructionSet`: An array of instructions for expression effects.
 * - `pType`: The parameter type (0 for address, 1 for string, 2 for numeric).
 * - `parameterValue`: The extracted parameter value (address, string, or numeric).
 */
export function parseEffect(
  effect: string,
  names: any[],
  placeholders: PlaceholderStruct[],
  indexMap: trackerIndexNameMapping[]
): Maybe<EffectDefinition> {
  var effectType = EffectType.REVERT
  var effectText = ''
  var effectInstructionSet: any[] = []
  const revertTextPattern = /(revert)\("([^"]*)"\)/
  var pType = 2
  var parameterValue: any = 0
  if (effect.includes('emit')) {
    effectType = EffectType.EVENT
    var placeHolder = effect.replace('emit ', '').trim()
    var spli = placeHolder.split(', ')
    if (spli.length > 1) {
      effectText = spli[0]
      if (isAddress(spli[1].trim())) {
        pType = 0
        parameterValue = spli[1].trim()
      } else if (!isNaN(Number(spli[1].trim()))) {
        pType = 2
        parameterValue = BigInt(spli[1].trim())
      } else {
        pType = 1
        parameterValue = spli[1].trim()
      }
    } else {
      effectText = spli[0]
    }
    // Regex check ^".*"$
    const quotesCheck = /^".*"$/g
    let str: string = effectText
    if (str.match(quotesCheck) == null) {
      return null
    } else {
      effectText = str.slice(1, -1)
    }
  } else if (effect.includes('revert')) {
    effectType = EffectType.REVERT
    const match = effect.match(revertTextPattern)
    effectText = match ? match[2] : ''
  } else {
    effectType = EffectType.EXPRESSION
    var instructionSet = convertHumanReadableToInstructionSet(effect, names, indexMap, placeholders)
    effectInstructionSet = instructionSet
  }

  return {
    type: effectType,
    text: effectText,
    instructionSet: effectInstructionSet,
    pType,
    parameterValue,
  }
}

/**
 * Processes an instruction set to build raw data entries, excluding specified strings,
 * and converts certain elements into hashed or numeric representations.
 *
 * @param instructionSet - An array of instructions to process. Elements can be strings or numbers.
 * @param excludeArray - An array of strings to exclude from processing.
 * @returns An object containing:
 *          - `instructionSetIndex`: An array of indices in the instruction set corresponding to processed elements.
 *          - `argumentTypes`: An array of argument types (e.g., 1 for strings).
 *          - `dataValues`: An array of byte arrays representing the processed data values.
 */
export function buildRawData(instructionSet: any[], excludeArray: string[]): Maybe<number[]> {
  try {
    var retVal = instructionSet.map((instruction) => {
      // Only capture values that aren't naturally numbers
      if (!isNaN(Number(instruction))) {
        return BigInt(instruction)
      } else if (!excludeArray.includes(instruction.trim())) {
        instruction = instruction.trim()
        if (instruction == 'true') {
          return 1n
        } else if (instruction == 'false') {
          return 0n
        } else if (!operandArray.includes(instruction)) {
          // Regex check ^".*"$
          const quotesCheck = /^".*"$/g
          let str: string = instruction
          if (str.match(quotesCheck) == null) {
            throw new Error('Strings must be in quotes')
          } else {
            instruction = str.slice(1, -1)
          }

          // Convert the string or bytes to a keccak256 hash then to a uint256
          return BigInt(
            keccak256(
              encodeAbiParameters(parseAbiParameters(instruction.startsWith('0x') ? 'bytes' : 'string'), [instruction])
            )
          )
        } else {
          return instruction
        }
      } else {
        return instruction
      }
    })
    return retVal
  } catch (exception) {
    return null
  }
}

/**
 * Cleans a given string by removing line breaks, reducing multiple spaces to a single space,
 * and trimming leading and trailing whitespace.
 *
 * @param str - The input string to be cleaned.
 * @returns The cleaned string with normalized whitespace.
 */
export function cleanString(str: string): string {
  return str
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Cleans up a given string by removing unnecessary parentheses and replacing specific patterns
 * with placeholders for later restoration. The function processes two types of patterns:
 * 1. Substrings starting with "FC:".
 * 2. Parentheses containing logical operators ("AND" or "OR").
 *
 * The function performs the following steps:
 * - Identifies and replaces "FC:" patterns with temporary placeholders.
 * - Iteratively removes or replaces parentheses based on their content.
 * - Restores the replaced placeholders back into the string.
 *
 * @param strToClean - The input string to be cleaned of extra parentheses.
 * @returns The cleaned string with unnecessary parentheses removed and original patterns restored.
 */
export function removeExtraParenthesis(strToClean: string): string {
  var holders: string[] = []
  var fcHolder: string[] = []
  var trHolder: string[] = []
  var iter = 0
  var trIter = 0
  while (strToClean.includes('FC:')) {
    var initialIndex = strToClean.lastIndexOf('FC:')
    var closingIndex = strToClean.indexOf(' ', initialIndex)
    var sub = strToClean.substring(initialIndex, closingIndex + 1)
    fcHolder.push(sub)
    var replacement = 'fcRep:' + iter
    iter += 1
    strToClean = strToClean.replace(sub, replacement)
  }

  const trMappedRegex = /TR:[a-zA-Z]+\([^()]+\)/g

  var mappedMatches = strToClean.match(trMappedRegex)
  if (mappedMatches != null) {
    var uniq = [...new Set(mappedMatches)]
    for (var match of uniq!) {
      trHolder.push(match)
      var replacement = 'trRep:' + trIter
      trIter += 1
      strToClean = strToClean.replace(match, replacement)
    }
  }

  iter = 0
  while (strToClean.includes('(')) {
    var initialIndex = strToClean.lastIndexOf('(')
    var closingIndex = strToClean.indexOf(')', initialIndex)
    var sub = strToClean.substring(initialIndex, closingIndex + 1)
    var removed = false

    if (sub.includes('AND') || sub.includes('OR') || sub.includes('NOT')) {
      holders.push(sub)
      var replacement = 'rep:' + iter
      iter += 1
      strToClean = strToClean.replace(sub, replacement)
    } else {
      removed = true
      strToClean = strToClean.substring(0, initialIndex) + '' + strToClean.substring(initialIndex + 1)
      strToClean = strToClean.substring(0, closingIndex - 1) + '' + strToClean.substring(closingIndex)
    }
  }

  var replaceCount = 0
  while (replaceCount < holders.length) {
    iter = 0
    for (var hold of holders) {
      var str = 'rep:' + iter
      if (strToClean.includes(str)) {
        strToClean = strToClean.replace(str, holders[iter])
        replaceCount += 1
      }
      iter += 1
    }
  }
  iter = 0
  for (var hold of fcHolder) {
    var str = 'fcRep:' + iter
    strToClean = strToClean.replace(str, fcHolder[iter])
    iter += 1
  }
  iter = 0
  for (var hold of trHolder) {
    var str = 'trRep:' + iter
    strToClean = strToClean.replace(str, trHolder[iter])
    iter += 1
  }
  return strToClean
}
