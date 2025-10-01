/// SPDX-License-Identifier: BUSL-1.1
import { expect, test } from 'vitest'
import { EffectType, ForeignCallDefinition, pTypeEnum, RulesError, TrackerDefinition } from '../src/modules/types.js'
import {
  keccak256,
  hexToNumber,
  encodePacked,
  getAddress,
  toBytes,
  toHex,
  encodeAbiParameters,
  parseAbiParameters,
  decodeAbiParameters,
} from 'viem'
import {
  parseRuleSyntax,
  cleanInstructionSet,
  parseTrackerSyntax,
  parseForeignCallDefinition,
  parseMappedTrackerSyntax,
} from '../src/parsing/parser.js'
import { reverseParseInstructionSet } from '../src/parsing/reverse-parsing-logic.js'

test('Evaluates a simple syntax string (using only values and operators)', () => {
  /**
   * Original Syntax:
   * 3 + 4 > 5 AND (1 == 1 AND 2 == 2)
   *
   * Abtract Tree Syntax:
   * [AND,
   *  [">",
   *      ["+", "3", "4"],
   *      "5"]
   *  [AND,
   *      ["==", "1", "1"],
   *      ["==", "2", "2"]
   *  ]
   * ]
   *
   * Instruction Set Syntax:
   * [ 'N', 3, 'N', 4, '+', 0,
   *    1, 'N', 5, '>', 2, 3,
   *   'N', 1, 'N', 1, '==', 5,
   *    6, 'N', 2, 'N', 2, '==',
   *    8, 9, 'AND', 7, 10, 'AND',
   *    4, 11 ]
   */
  var expectedArray = [
    'N',
    3n,
    'N',
    3n,
    '==',
    0n,
    1n,
    'N',
    1n,
    'N',
    1n,
    '==',
    3n,
    4n,
    'N',
    2n,
    'N',
    2n,
    '==',
    6n,
    7n,
    'N',
    3n,
    'N',
    3n,
    '==',
    9n,
    10n,
    'AND',
    8n,
    11n,
    'OR',
    5n,
    12n,
    'AND',
    2n,
    13n,
  ]

  var ruleStringA = `{
  "condition": "3 == 3 AND (1 == 1 OR (2 == 2 AND 3 == 3))",
  "positiveEffects": ["revert"],
  "negativeEffects": [],
  "callingFunction": "addValue"
  }`
  var retVal = parseRuleSyntax(JSON.parse(ruleStringA), [], [], 'uint256 value, uint256 sAND', [], [])
  expect(retVal).not.toBeNull()
  expect(retVal!.instructionSet).toEqual(expectedArray)
})

test('Evaluates a simple syntax string (using only values and operators)', () => {
  /**
   * Original Syntax:
   * 3 + 4 > 5 AND (1 == 1 AND 2 == 2)
   *
   * Abtract Tree Syntax:
   * [AND,
   *  [">",
   *      ["+", "3", "4"],
   *      "5"]
   *  [AND,
   *      ["==", "1", "1"],
   *      ["==", "2", "2"]
   *  ]
   * ]
   *
   * Instruction Set Syntax:
   * [ 'N', 3, 'N', 4, '+', 0,
   *    1, 'N', 5, '>', 2, 3,
   *   'N', 1, 'N', 1, '==', 5,
   *    6, 'N', 2, 'N', 2, '==',
   *    8, 9, 'AND', 7, 10, 'AND',
   *    4, 11 ]
   */
  var expectedArray = [
    'PLH',
    0n,
    'PLH',
    1n,
    '+',
    0n,
    1n,
    'N',
    5n,
    '>',
    2n,
    3n,
    'PLH',
    1n,
    'N',
    1n,
    '==',
    5n,
    6n,
    'N',
    2n,
    'PLH',
    1n,
    '==',
    8n,
    9n,
    'AND',
    7n,
    10n,
    'AND',
    4n,
    11n,
  ]

  var ruleStringA = `{
  "condition": "value + sAND > 5 AND (sAND == 1 AND 2 == sAND)",
  "positiveEffects": ["revert"],
  "negativeEffects": [],
  "callingFunction": "addValue"
  }`
  var retVal = parseRuleSyntax(JSON.parse(ruleStringA), [], [], 'uint256 value, uint256 sAND', [], [])
  expect(retVal).not.toBeNull()
  expect(retVal!.instructionSet).toEqual(expectedArray)
})

test('Evaluates a simple syntax string with >= (using only values and operators)', () => {
  /**
   * Original Syntax:
   * 3 + 4 >= 5 AND (1 == 1 AND 2 == 2)
   *
   * Abtract Tree Syntax:
   * [AND,
   *  [">=",
   *      ["+", "3", "4"],
   *      "5"]
   *  [AND,
   *      ["==", "1", "1"],
   *      ["==", "2", "2"]
   *  ]
   * ]
   *
   * Instruction Set Syntax:
   * [ 'N', 3, 'N', 4, '+', 0,
   *    1, 'N', 5, '>=', 2, 3,
   *   'N', 1, 'N', 1, '==', 5,
   *    6, 'N', 2, 'N', 2, '==',
   *    8, 9, 'AND', 7, 10, 'AND',
   *    4, 11 ]
   */
  var expectedArray = [
    'PLH',
    0n,
    'PLH',
    1n,
    '+',
    0n,
    1n,
    'N',
    5n,
    '>=',
    2n,
    3n,
    'PLH',
    1n,
    'N',
    1n,
    '==',
    5n,
    6n,
    'N',
    2n,
    'PLH',
    1n,
    '==',
    8n,
    9n,
    'AND',
    7n,
    10n,
    'AND',
    4n,
    11n,
  ]

  var ruleStringA = `{
  "condition": "value + sAND >= 5 AND (sAND == 1 AND 2 == sAND)",
  "positiveEffects": ["revert"],
  "negativeEffects": [],
  "callingFunction": "addValue"
  }`
  var retVal = parseRuleSyntax(JSON.parse(ruleStringA), [], [], 'uint256 value, uint256 sAND', [], [])
  expect(retVal).not.toBeNull()
  expect(retVal!.instructionSet).toEqual(expectedArray)
})

test('Evaluates a simple syntax string with <= (using only values and operators)', () => {
  /**
   * Original Syntax:
   * 3 + 4 <= 5 AND (1 == 1 AND 2 == 2)
   *
   * Abtract Tree Syntax:
   * [AND,
   *  ["<=",
   *      ["+", "3", "4"],
   *      "5"]
   *  [AND,
   *      ["==", "1", "1"],
   *      ["==", "2", "2"]
   *  ]
   * ]
   *
   * Instruction Set Syntax:
   * [ 'N', 3, 'N', 4, '+', 0,
   *    1, 'N', 5, '<=', 2, 3,
   *   'N', 1, 'N', 1, '==', 5,
   *    6, 'N', 2, 'N', 2, '==',
   *    8, 9, 'AND', 7, 10, 'AND',
   *    4, 11 ]
   */
  var expectedArray = [
    'PLH',
    0n,
    'PLH',
    1n,
    '+',
    0n,
    1n,
    'N',
    5n,
    '<=',
    2n,
    3n,
    'PLH',
    1n,
    'N',
    1n,
    '==',
    5n,
    6n,
    'N',
    2n,
    'PLH',
    1n,
    '==',
    8n,
    9n,
    'AND',
    7n,
    10n,
    'AND',
    4n,
    11n,
  ]

  var ruleStringA = `{
  "condition": "value + sAND <= 5 AND (sAND == 1 AND 2 == sAND)",
  "positiveEffects": ["revert"],
  "negativeEffects": [],
  "callingFunction": "addValue"
  }`
  var retVal = parseRuleSyntax(JSON.parse(ruleStringA), [], [], 'uint256 value, uint256 sAND', [], [])
  expect(retVal).not.toBeNull()
  expect(retVal!.instructionSet).toEqual(expectedArray)
})

test('Reverse Interpretation for the: "Evaluates a simple syntax string (using only values and operators" test', () => {
  let instructionSet = [
    'N',
    3,
    'N',
    4,
    '+',
    0,
    1,
    'N',
    5,
    '>',
    2,
    3,
    'N',
    1,
    'N',
    1,
    '==',
    5,
    6,
    'N',
    2,
    'N',
    2,
    '==',
    8,
    9,
    'AND',
    7,
    10,
    'AND',
    4,
    11,
  ]
  var expectedString = '3 + 4 > 5 AND ( 1 == 1 AND 2 == 2 )'
  const cleanedInstructionSet = cleanInstructionSet(instructionSet)
  var placeholderArray = ['value', 'info', 'addr']
  var retVal = reverseParseInstructionSet(cleanedInstructionSet as number[], placeholderArray, [], 0)
  expect(retVal).toEqual(expectedString)
})

test('Reverse Interpretation for the: "Evaluates a simple syntax string involving a mapped tracker" test', () => {
  let instructionSet = ['PLH', 0n, 'PLHM', 1n, 0n, 'N', 1n, '==', 1n, 2n]
  var expectedString = 'TR:trackerOne(to) == 1'
  const cleanedInstructionSet = cleanInstructionSet(instructionSet)
  var placeholderArray = ['to', 'TR:trackerOne']
  var retVal = reverseParseInstructionSet(cleanedInstructionSet as number[], placeholderArray, [], 0)
  expect(retVal).toEqual(expectedString)
})

test('Reverse Interpretation for the: "Evaluates a simple effect involving a mapped tracker update (TRUM))" test', () => {
  let instructionSet = ['PLH', 0n, 'PLHM', 1n, 0n, 'N', 1n, '-', 1n, 2n, 'TRUM', 1n, 3n, 0n, 0n]
  var expectedString = 'TRU:testOne(to) -= 1'
  const cleanedInstructionSet = cleanInstructionSet(instructionSet)
  var placeholderArray = ['to', 'TR:testOne']
  var retVal = reverseParseInstructionSet(cleanedInstructionSet as number[], placeholderArray, [], 0)
  expect(retVal).toEqual(expectedString)
})

test('Evaluates a complex effect involving a mapped tracker update (TRUM))', () => {
  var instructionSet = [
    'PLH',
    0n,
    'PLHM',
    1n,
    0n,
    'N',
    1n,
    '-',
    1n,
    2n,
    'TRUM',
    1n,
    3n,
    0n,
    0n,
    'PLH',
    0n,
    'PLHM',
    2n,
    5n,
    'N',
    1n,
    '-',
    6n,
    7n,
    'TRUM',
    2n,
    8n,
    5n,
    0n,
    'AND',
    4n,
    9n,
  ]

  var ruleStringA = `{
    "condition": " 1 == 1",
      "positiveEffects": [" TRU:testOne(to) -= 1 AND TRU:testTwo(to) -= 1"],
        "negativeEffects": [],
          "callingFunction": "addValue"
  } `

  const cleanedInstructionSet = cleanInstructionSet(instructionSet)
  var placeholderArray = ['to', 'TR:testOne', 'TR:testTwo']
  var retVal = reverseParseInstructionSet(cleanedInstructionSet as number[], placeholderArray, [], 0)
  expect(retVal).toEqual('TRU:testOne(to) -= 1 AND TRU:testTwo(to) -= 1')
})

test('Reverse Interpretation for the: "Evaluates a simple effect involving a tracker update (TRU))" test', () => {
  let instructionSet = ['PLH', 1n, 'N', 1n, '-', 0n, 1n, 'TRU', 1n, 2n, 0n]
  var expectedString = 'TRU:testOne -= 1'
  const cleanedInstructionSet = cleanInstructionSet(instructionSet)
  var placeholderArray = ['value', 'TR:testOne']
  var retVal = reverseParseInstructionSet(cleanedInstructionSet as number[], placeholderArray, [], 0)
  expect(retVal).toEqual(expectedString)
})

test('Reverse Interpretation for the: "Evaluates a second effect involving a tracker update (TRU))" test', () => {
  let instructionSet = ['PLH', 1n, 'PLH', 0n, '=', 0, 1, 'TRU', 1, 2, 0]
  var expectedString = 'TRU:testOne = value'
  const cleanedInstructionSet = cleanInstructionSet(instructionSet)
  var placeholderArray = ['value', 'TR:testOne']
  var retVal = reverseParseInstructionSet(cleanedInstructionSet as number[], placeholderArray, [], 0)
  expect(retVal).toEqual(expectedString)
})

test('Evaluates a complex syntax string (using only values and operators)', () => {
  /*
   * Original Syntax:
   * ( 1 + 1 == 2 ) AND ( 3 + 4 > 5 AND (1 == 1 AND 2 == 2) ) AND (4 == 4)
   *
   * Abstract Tree Syntax:
   * [AND,
   *  [1 + 1 == 2],
   *  [AND,
   *      [AND,
   *          [3 + 4 > 5],
   *          [AND,
   *              [2 == 2],
   *              [1 == 1],
   *          ]
   *      ],
   *      [4 == 4]
   *  ]
   * ]
   *
   * Instruction Set Syntax:
   * [ 'N', 1, 'N', 1, '+', 0, 1, 'N',
   *    2, '==', 2, 3, 'N', 3, 'N', 4,
   *   '+', 5, 6, 'N', 5, '>', 7, 8,
   *   'N', 1, 'N', 1, '==', 10, 11, 'N',
   *    2, 'N', 2, '==', 13, 14, 'AND', 12,
   *    15, 'AND', 9, 16, 'N', 4, 'N', 4,
   *   '==', 18, 19, 'AND', 17, 20, 'AND', 4,
   *    21 ]
   */
  var expectedArray = [
    'N',
    1n,
    'N',
    1n,
    '+',
    0n,
    1n,
    'N',
    2n,
    '==',
    2n,
    3n,
    'N',
    3n,
    'N',
    4n,
    '+',
    5n,
    6n,
    'N',
    5n,
    '>',
    7n,
    8n,
    'N',
    1n,
    'N',
    1n,
    '==',
    10n,
    11n,
    'N',
    2n,
    'N',
    2n,
    '==',
    13n,
    14n,
    'AND',
    12n,
    15n,
    'AND',
    9n,
    16n,
    'AND',
    4n,
    17n,
  ]

  var ruleStringA = `{
      "condition": "( 1 + 1 == 2 ) AND ( 3 + 4 > 5 AND (1 == 1 AND 2 == 2) ) ",
      "positiveEffects": ["revert"],
      "negativeEffects": [],
      "callingFunction": "addValue"
     }`

  var retVal = parseRuleSyntax(JSON.parse(ruleStringA), [], [], 'uint256 value', [], [])
  expect(retVal).not.toBeNull()
  expect(retVal!.instructionSet).toEqual(expectedArray)
})

test('Reverse Interpretation for the: "Evaluates a complex syntax string (using only values and operators)" test', () => {
  let instructionSet = [
    'N',
    1,
    'N',
    1,
    '+',
    0,
    1,
    'N',
    2,
    '==',
    2,
    3,
    'N',
    3,
    'N',
    4,
    '+',
    5,
    6,
    'N',
    5,
    '>',
    7,
    8,
    'N',
    1,
    'N',
    1,
    '==',
    10,
    11,
    'N',
    2,
    'N',
    2,
    '==',
    13,
    14,
    'AND',
    12,
    15,
    'AND',
    9,
    16,
    'N',
    4,
    'N',
    4,
    '==',
    18,
    19,
    'AND',
    17,
    20,
    'AND',
    4,
    21,
  ]
  var expectedString = '1 + 1 == 2 AND ( ( 3 + 4 > 5 AND ( 1 == 1 AND 2 == 2 ) ) AND 4 == 4 )'
  const cleanedInstructionSet = cleanInstructionSet(instructionSet)
  var placeholderArray: any[] = []
  var retVal = reverseParseInstructionSet(cleanedInstructionSet as number[], placeholderArray, [], 0)
  expect(retVal).toEqual(expectedString)
})

test('Evaluates a simple syntax string (using AND + OR operators)', () => {
  /*
   * Original Syntax:
   * (3 + 4 > 5 AND 5 == 5) OR (1 == 1 OR 2 == 3)
   *
   * Abstract Tree Syntax:
   * [OR,
   *  [AND,
   *    [>,
   *      [+, 3, 4] ,5],
   *    [==, 5, 5]],
   *  [OR,
   *    [==, 1, 1],
   *    [==, 2, 3]
   *  ]
   * ]
   *
   * Instruction Set Syntax:
   * [ 'N', 3, 'N', 4, '+', 0, 1,
   *   'N', 5, '>', 2, 3, 'N', 5,
   *   'N', 5, '==', 5, 6, 'AND', 4,
   *    7, 'N', 1, 'N', 1, '==', 9,
   *    10, 'N', 2, 'N', 3, '==', 12,
   *    13, 'OR', 11, 14, 'OR', 8, 15 ]
   */
  var expectedArray = [
    'N',
    3n,
    'N',
    4n,
    '+',
    0n,
    1n,
    'N',
    5n,
    '>',
    2n,
    3n,
    'N',
    5n,
    'N',
    5n,
    '==',
    5n,
    6n,
    'AND',
    4n,
    7n,
    'N',
    1n,
    'N',
    1n,
    '==',
    9n,
    10n,
    'N',
    2n,
    'N',
    3n,
    '==',
    12n,
    13n,
    'OR',
    11n,
    14n,
    'OR',
    8n,
    15n,
  ]

  var ruleStringA = `{
    "condition": "(3 + 4 > 5 AND 5 == 5) OR (1 == 1 OR 2 == 3)",
      "positiveEffects": ["revert"],
        "negativeEffects": [],
          "callingFunction": "addValue"
  } `

  var retVal = parseRuleSyntax(JSON.parse(ruleStringA), [], [], 'uint256 value', [], [])
  expect(retVal).not.toBeNull()
  expect(retVal!.instructionSet).toEqual(expectedArray)
})

test('Reverse Interpretation for the: "Evaluates a simple syntax string (using AND + OR operators)" test', () => {
  let instructionSet = [
    'N',
    3,
    'N',
    4,
    '+',
    0,
    1,
    'N',
    5,
    '>',
    2,
    3,
    'N',
    5,
    'N',
    5,
    '==',
    5,
    6,
    'AND',
    4,
    7,
    'N',
    1,
    'N',
    1,
    '==',
    9,
    10,
    'N',
    2,
    'N',
    3,
    '==',
    12,
    13,
    'OR',
    11,
    14,
    'OR',
    8,
    15,
  ]
  var expectedString = '( 3 + 4 > 5 AND 5 == 5 ) OR ( 1 == 1 OR 2 == 3 )'
  const cleanedInstructionSet = cleanInstructionSet(instructionSet)
  var placeholderArray: any[] = []
  var retVal = reverseParseInstructionSet(cleanedInstructionSet as number[], placeholderArray, [], 0)
  expect(retVal).toEqual(expectedString)
})

test('Evaluates a simple syntax string (using AND + OR operators and function parameters)', () => {
  /*
   * Original Syntax:
   * (value + 4 > 5 AND 5 == 5) OR (info == "test" OR addr == '0x1234567')  --> revert --> addValue(uint256 value, string info, address addr)
   *
   * Abstract Tree Syntax:
   * [OR,
   *  [AND,
   *    [>,
   *      [+, "value", 4], 5],
   *    [==, 5, 5]],
   *  [OR,
   *    [==, "info", "test"],
   *    [==, "addr", '0x1234567']
   *  ]
   * ]
   *
   * Instruction Set Syntax:
   * [ 'PLH', 0, 0, 'N',
   *    4, '+', 0, 1,
   *   'N', 5, '>', 2,
   *    3, 'N', 5, 'N',
   *    5, '==', 5, 6,
   *   'AND', 4, 7, 'PLH',
   *    1, 0, 'test', '==',
   *    9, 10, 'PLH',  2,
   *    0, "'0x1234567'", '==', 12,
   *    13, 'OR', 11, 14,
   *   'OR', 8, 15 ]
   */
  var expectedArray = [
    'PLH',
    0n,
    'N',
    4n,
    '+',
    0n,
    1n,
    'N',
    5n,
    '>',
    2n,
    3n,
    'N',
    5n,
    'N',
    5n,
    '==',
    5n,
    6n,
    'AND',
    4n,
    7n,
    'PLH',
    1n,
    'N',
    BigInt(keccak256(encodeAbiParameters(parseAbiParameters('string'), ['test']))),
    '==',
    9n,
    10n,
    'PLH',
    2n,
    'N',
    BigInt('0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC'),
    '==',
    12n,
    13n,
    'OR',
    11n,
    14n,
    'OR',
    8n,
    15n,
  ]

  var ruleStringA = `{
    "condition": "(value + 4 > 5 AND 5 == 5) OR (info == \\"test\\" OR addr == 0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC)",
      "positiveEffects": ["revert"],
        "negativeEffects": [],
          "callingFunction": "addValue"
  } `

  var retVal = parseRuleSyntax(JSON.parse(ruleStringA), [], [], 'uint256 value, string info, address addr', [], [])
  expect(retVal).not.toBeNull()
  expect(retVal!.instructionSet).toEqual(expectedArray)
})

test('Creates a simple uint256 tracker', () => {
  var str = `{
    "name": "Simple Int Tracker",
      "type": "uint256",
        "initialValue": "14"
  } `
  var retVal = parseTrackerSyntax(JSON.parse(str))

  expect(retVal.name).toEqual('Simple Int Tracker')
  expect(retVal.type).toEqual(pTypeEnum.UINT256)
  expect(retVal.initialValue).toEqual(encodeAbiParameters(parseAbiParameters('uint256'), [BigInt(14)]))
})

test('Creates a simple bool tracker', () => {
  var str = `{
    "name": "Simple bool Tracker",
      "type": "bool",
        "initialValue": "true"
  } `
  var retVal = parseTrackerSyntax(JSON.parse(str))
  expect(retVal.name).toEqual('Simple bool Tracker')
  expect(retVal.type).toEqual(pTypeEnum.BOOL)
  expect(retVal.initialValue).toEqual(encodeAbiParameters(parseAbiParameters('uint256'), [BigInt(1)]))
})

test('Creates a simple mapped tracker', () => {
  var str = `{
    "name": "Simple bool Tracker",
      "keyType": "uint256",
        "valueType": "uint256",
          "initialKeys": [0, 1, 2],
            "initialValues": [1, 2, 3]
  } `
  var retVal = parseMappedTrackerSyntax(JSON.parse(str))
  expect(retVal.name).toEqual('Simple bool Tracker')
  expect(retVal.keyType).toEqual(2)
  expect(retVal.valueType).toEqual(2)
  expect(retVal.initialKeys[0]).toEqual(encodePacked(['uint256'], [BigInt(0)]))
  expect(retVal.initialKeys[1]).toEqual(encodePacked(['uint256'], [BigInt(1)]))
  expect(retVal.initialKeys[2]).toEqual(encodePacked(['uint256'], [BigInt(2)]))
  expect(retVal.initialValues[0]).toEqual(encodePacked(['uint256'], [BigInt(1)]))
  expect(retVal.initialValues[1]).toEqual(encodePacked(['uint256'], [BigInt(2)]))
  expect(retVal.initialValues[2]).toEqual(encodePacked(['uint256'], [BigInt(3)]))
})

test('Creates a simple mapped tracker with a string value', () => {
  var str = `{
    "name": "Simple bool Tracker",
      "keyType": "uint256",
        "valueType": "string",
          "initialKeys": [0, 1, 2],
            "initialValues": ["Test", "Test Two", "Test Three"]
  } `
  var retVal = parseMappedTrackerSyntax(JSON.parse(str))
  expect(retVal.name).toEqual('Simple bool Tracker')
  expect(retVal.keyType).toEqual(2)
  expect(retVal.valueType).toEqual(1)
  expect(retVal.initialKeys[0]).toEqual(encodePacked(['uint256'], [BigInt(0)]))
  expect(retVal.initialKeys[1]).toEqual(encodePacked(['uint256'], [BigInt(1)]))
  expect(retVal.initialKeys[2]).toEqual(encodePacked(['uint256'], [BigInt(2)]))
  expect(retVal.initialValues[0]).toEqual('0x931dbaf3028ef6a59401824972e5ff2185985e313cf0a22def98b9627cbfb737')
  expect(retVal.initialValues[1]).toEqual('0x2578558fdfb44c8c485359293fa18d22bd9eb6bd60a474970adacacb46164d02')
  expect(retVal.initialValues[2]).toEqual('0x316e555747bdaabd3553c23c61a3d25280a3b3c4b5ed77bc8e9b109a3d57b6c5')
})

test('Reverse Interpretation for the: "Evaluates a simple syntax string (using AND + OR operators and function parameters)" test', () => {
  let instructionSet = [
    'PLH',
    0,
    'N',
    4,
    '+',
    0,
    1,
    'N',
    5,
    '>',
    2,
    3,
    'N',
    5,
    'N',
    5,
    '==',
    5,
    6,
    'AND',
    4,
    7,
    'PLH',
    1,
    'N',
    1234,
    '==',
    9,
    10,
    'PLH',
    2,
    'N',
    '0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC',
    '==',
    12,
    13,
    'OR',
    11,
    14,
    'OR',
    8,
    15,
  ]
  var expectedString =
    '( value + 4 > 5 AND 5 == 5 ) OR ( info == "test" OR addr == 0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC )'
  const cleanedInstructionSet = cleanInstructionSet(instructionSet)
  var placeholderArray = ['value', 'info', 'addr']
  var retVal = reverseParseInstructionSet(
    cleanedInstructionSet as number[],
    placeholderArray,
    [{ instructionSetIndex: 25, originalData: 'test', type: 0 }],
    0
  )
  expect(retVal).toEqual(expectedString)
})

test('Creates a simple address tracker', () => {
  var str = `{
    "name": "Simple Address Tracker",
      "type": "address",
        "initialValue": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC"
  } `
  var retVal = parseTrackerSyntax(JSON.parse(str))
  expect(retVal.name).toEqual('Simple Address Tracker')
  expect(retVal.type).toEqual(pTypeEnum.ADDRESS)
  expect(retVal.initialValue).toEqual(
    encodeAbiParameters(parseAbiParameters('address'), ['0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC'])
  )
})

test('Creates a simple string tracker', () => {
  var str = `{
    "name": "Simple String Tracker",
      "type": "string",
        "initialValue": "test"
  } `

  var retVal = parseTrackerSyntax(JSON.parse(str))
  var decodedValue = decodeAbiParameters(parseAbiParameters('string'), retVal.initialValue as `0x${string}`)[0]
  expect(retVal.name).toEqual('Simple String Tracker')
  expect(retVal.type).toEqual(pTypeEnum.STRING)
  expect(decodedValue).toEqual('test')
})

test('Creates a simple foreign call', () => {
  var str = `{
  "name": "Simple Foreign Call",
  "address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
  "function": "testSig(address,string,uint256)",
  "returnType": "uint256",
  "valuesToPass": "to, FC:testSigTwo, TR:thisTracker",
  "mappedTrackerKeyValues": ""
  }`

  var retVal = parseForeignCallDefinition(
    JSON.parse(str),
    [
      {
        id: 1,
        name: 'testSigTwo',
        type: 1,
      },
    ],
    [
      {
        id: 1,
        name: 'thisTracker',
        type: 1,
      },
    ],
    ['to', 'someString', 'value']
  )
  expect(retVal.name).toEqual('Simple Foreign Call')
  expect(retVal.address).toEqual(getAddress('0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC'))
  expect(retVal.function).toEqual('testSig(address,string,uint256)')
  expect(retVal.returnType).toEqual(2)
  expect(retVal.encodedIndices[1].eType).toEqual(1)
})

test('Evaluates a simple syntax string with a Foreign Call', () => {
  /*
   * Original Syntax:
   * FC:leaderboard > 100 AND value == 100 --> revert --> transfer(address to, uint256 value) --> address to, uint256 value
   *
   * Abstract Tree Syntax:
   *  [AND,
   *    [>,
   *      [FC:leaderboard, "to"], 100],
   *    [==, "value", 100],
   * ]
   *
   * Instruction Set Syntax:
   * [ 'PLH, 0,
   *   'N', 100,
   *   '>', 0, 1,
   *   'PLH', 1,
   *   'N', 100,
   *   '==', 3, 4,
   *   'AND', 2, 5,
   */
  let expectedArray = ['PLH', 1n, 'N', 100n, '>', 0n, 1n, 'PLH', 0n, 'N', 100n, '==', 3n, 4n, 'AND', 2n, 5n]
  var ruleStringA = `{
    "condition": "FC:leaderboard > 100 AND value == 100 ",
      "positiveEffects": ["revert"],
        "negativeEffects": [],
          "callingFunction": "transfer"
  } `

  let retVal = parseRuleSyntax(
    JSON.parse(ruleStringA),
    [],
    [{ id: 1, name: 'leaderboard', type: 0 }],
    'address to, uint256 value',
    ['FC:leaderboard'],
    []
  )
  expect(retVal).not.toBeNull()
  expect(retVal!.instructionSet).toEqual(expectedArray)
})

test('Evaluates a simple syntax string with a Foreign Call and !=', () => {
  /*
   * Original Syntax:
   * FC:leaderboard > 100 AND value == 100 --> revert --> transfer(address to, uint256 value) --> address to, uint256 value
   *
   * Abstract Tree Syntax:
   *  [AND,
   *    [>,
   *      [FC:leaderboard, "to"], 100],
   *    [==, "value", 100],
   * ]
   *
   * Instruction Set Syntax:
   * [ 'PLH, 0,
   *   'N', 100,
   *   '>', 0, 1,
   *   'PLH', 1,
   *   'N', 100,
   *   '==', 3, 4,
   *   'AND', 2, 5,
   */
  let expectedArray = ['PLH', 1n, 'N', 100n, '>', 0n, 1n, 'PLH', 0n, 'N', 100n, '!=', 3n, 4n, 'AND', 2n, 5n]
  var ruleStringA = `{
    "condition": "FC:leaderboard > 100 AND value != 100 ",
      "positiveEffects": ["revert"],
        "negativeEffects": [],
          "callingFunction": "transfer"
  } `

  let retVal = parseRuleSyntax(
    JSON.parse(ruleStringA),
    [],
    [{ id: 1, name: 'leaderboard', type: 0 }],
    'address to, uint256 value',
    ['FC:leaderboard'],
    []
  )
  expect(retVal).not.toBeNull()
  expect(retVal!.instructionSet).toEqual(expectedArray)
})

test('Reverse Interpretation for the: "Evaluates a simple syntax string with a Foreign Call" test', () => {
  let instructionSet = ['PLH', 0, 'N', 100, '>', 0, 1, 'PLH', 1, 'N', 100, '==', 3, 4, 'AND', 2, 5]
  var expectedString = 'FC:leaderboard > 100 AND value == 100'
  const cleanedInstructionSet = cleanInstructionSet(instructionSet)
  var placeholderArray = ['FC:leaderboard', 'value']
  var retVal = reverseParseInstructionSet(cleanedInstructionSet as number[], placeholderArray, [], 0)
  expect(retVal).toEqual(expectedString)
})

test('Evaluate a complex syntax string with multiple foreign calls', () => {
  /*
  * Original Syntax:
  * (FC:isAllowed == 1 AND sender == 0xdeadbeefdeadbeef) OR (FC:isSuperCoolGuy AND (FC:isRich == 1) AND (FC:creditRisk < 500 )) -> revert --> “transfer(address to, uint256 value)” --> address to, uint256 value
  *
  * Abstract Tree Syntax:
  *  [OR,
  *    [AND,
  *      [==, "FC:isAllowed", 1],
  *      [==, "to", 0xdeadbeefdeadbeef]],
  *    [AND,
  *      [==, "FC:isSuperCoolGuy", 1],
  *      [AND,
  *        [==, "FC:isRich", 1],
  *        [<, "FC:creditRisk", 500]]]
  * ]
  *
  * Instruction Set Syntax:
  * [
  * 'PLH', 0,
  *  'N', 1,
  * '==', 0, 1,
  * 'PLH', 1,
  * 'N', 0xdeadbeefdeadbeef, '==',
  * 3, 4, 'AND',
  * 2, 5, 'PLH',
  * 2, 'PLH', 3,
  * 'N', 1,
  * '==', 8, 9,
  * 'AND', 7, 10,
  * 'PLH', 4, 'N', 500,
  * '<', 12, 13,
  * 'AND', 11, 14,
  * 'OR', 6, 15
  ]
  */

  let expectedArray = [
    'PLH',
    1n,
    'N',
    1n,
    '==',
    0n,
    1n,
    'PLH',
    0n,
    'N',
    BigInt('0xdeadbeefdeadbeef'),
    '==',
    3n,
    4n,
    'AND',
    2n,
    5n,
    'PLH',
    2n,
    'PLH',
    3n,
    'N',
    1n,
    '==',
    8n,
    9n,
    'AND',
    7n,
    10n,
    'PLH',
    4n,
    'N',
    500n,
    '<',
    12n,
    13n,
    'AND',
    11n,
    14n,
    'OR',
    6n,
    15n,
  ]

  var ruleStringA = `{
    "condition": "( FC:isAllowed == 1 AND to == 0xdeadbeefdeadbeef ) OR ( (FC:isSuperCoolGuy AND FC:isRich == 1) AND FC:creditRisk < 500 )",
      "positiveEffects": ["revert"],
        "negativeEffects": [],
          "callingFunction": "transfer"
  } `
  let retVal = parseRuleSyntax(
    JSON.parse(ruleStringA),
    [],
    [
      { id: 1, name: 'isAllowed', type: 0 },
      { id: 2, name: 'isSuperCoolGuy', type: 0 },
      { id: 3, name: 'isRich', type: 0 },
      { id: 4, name: 'creditRisk', type: 0 },
    ],
    'address to, uint256 value',
    ['FC:isAllowed', 'FC:isSuperCoolGuy', 'FC:isRich', 'FC:creditRisk'],
    []
  )
  expect(retVal).not.toBeNull()
  expect(retVal!.instructionSet).toEqual(expectedArray)
})

test('Reverse Interpretation for the: "Evaluates a simple syntax string with a Foreign Call" test', () => {
  let instructionSet = [
    'PLH',
    0,
    'N',
    1,
    '==',
    0,
    1,
    'PLH',
    1,
    'N',
    0xdeadbeefdeadbeef,
    '==',
    3,
    4,
    'AND',
    2,
    5,
    'PLH',
    2,
    'PLH',
    3,
    'N',
    1,
    '==',
    8,
    9,
    'AND',
    7,
    10,
    'PLH',
    4,
    'N',
    500,
    '<',
    12,
    13,
    'AND',
    11,
    14,
    'OR',
    6,
    15,
  ]
  var expectedString =
    '( FC:isAllowed == 1 AND to == 16045690984833335000 ) OR ( ( FC:isSuperCoolGuy AND FC:isRich == 1 ) AND FC:creditRisk < 500 )'
  const cleanedInstructionSet = cleanInstructionSet(instructionSet)
  var placeholderArray = ['FC:isAllowed', 'to', 'FC:isSuperCoolGuy', 'FC:isRich', 'FC:creditRisk']
  var retVal = reverseParseInstructionSet(cleanedInstructionSet as number[], placeholderArray, [], 0)
  expect(retVal).toEqual(expectedString)
})

test('Evaluate complex expression with placeholders', () => {
  /*
   * Original Syntax:
   * (to == 1 AND sender == 0xdeadbeefdeadbeef) OR (value == 1 AND to == 1 AND value < 500) -> revert --> “transfer(address to, uint256 value)” --> address to, uint256 value
   *
   * Abstract Tree Syntax:
   *  [OR,
   *    [AND,
   *      [==, "to", 1],
   *      [==, "sender", 0xdeadbeefdeadbeef]],
   *    [AND,
   *      [==, "value", 1],
   *      [AND,
   *        [==, "to", 1],
   *        [<, "value", 500]]]
   * ]
   *
   * Instruction Set Syntax:
   * [
   *  'PLH', 0,
   *  'N', 1,
   *  '==', 0, 1,
   *  'PLH', 1,
   *  'N', 0xdeadbeefdeadbeef, '==',
   *  3, 4, 'AND',
   *  2, 5, 'PLH',
   *  2, 'PLH', 3,
   *  'N', 1,
   *  '==', 8, 9,
   *  'AND', 7, 10,
   *  'PLH', 4, 'N', 500,
   *  '<', 12, 13,
   *  'AND', 11, 14,
   *  'OR', 6, 15
   *]
   */
  let expectedArray = [
    'PLH',
    0n,
    'N',
    1n,
    '==',
    0n,
    1n,
    'PLH',
    0n,
    'N',
    BigInt('0xdeadbeefdeadbeef'),
    '==',
    3n,
    4n,
    'AND',
    2n,
    5n,
    'PLH',
    1n,
    'N',
    1n,
    '==',
    7n,
    8n,
    'PLH',
    0n,
    'N',
    1n,
    '==',
    10n,
    11n,
    'AND',
    9n,
    12n,
    'PLH',
    1n,
    'N',
    500n,
    '<',
    14n,
    15n,
    'AND',
    13n,
    16n,
    'OR',
    6n,
    17n,
  ]
  var ruleStringA = `{
    "condition": "( to == 1 AND to == 0xdeadbeefdeadbeef ) OR (( value == 1 AND to == 1) AND value < 500 )",
      "positiveEffects": ["revert"],
        "negativeEffects": [],
          "callingFunction": "transfer"
  } `
  let retVal = parseRuleSyntax(JSON.parse(ruleStringA), [], [], 'address to, uint256 value', [], [])
  expect(retVal).not.toBeNull()
  expect(retVal!.instructionSet).toEqual(expectedArray)
})

test('Reverse Interpretation for the: "Evaluate complex expression with placeholders" test', () => {
  let instructionSet = [
    'PLH',
    0,
    'N',
    1,
    '==',
    0,
    1,
    'PLH',
    1,
    'N',
    '0xdeadbeefdeadbeef',
    '==',
    3,
    4,
    'AND',
    2,
    5,
    'PLH',
    2,
    'N',
    1,
    '==',
    7,
    8,
    'PLH',
    3,
    'N',
    1,
    '==',
    10,
    11,
    'AND',
    9,
    12,
    'PLH',
    4,
    'N',
    500,
    '<',
    14,
    15,
    'AND',
    13,
    16,
    'OR',
    6,
    17,
  ]
  var expectedString = '( to == 1 AND sender == 0xdeadbeefdeadbeef ) OR ( ( value == 1 AND to == 1 ) AND value < 500 )'
  const cleanedInstructionSet = cleanInstructionSet(instructionSet)
  var placeholderArray = ['to', 'sender', 'value', 'to', 'value']
  var retVal = reverseParseInstructionSet(cleanedInstructionSet as number[], placeholderArray, [], 0)
  expect(retVal).toEqual(expectedString)
})

test('Evaluates a simple syntax string (using AND + OR operators, trackers and function parameters)', () => {
  /*
   * Original Syntax:
   * (FC:isAllowed + 4 > 5 AND TR:testOne == 5) OR (info == TR:testTwo OR TR:testOne == 0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC)  --> revert --> addValue(uint256 value, string info, address addr)
   *
   * Abstract Tree Syntax:
   * [OR,
   *  [AND,
   *    [>,
   *      [+, "FC:isAllowed", 4], 5],
   *    [==, TR:testOne, 5]],
   *  [OR,
   *    [==, "info", TR:testTwo],
   *    [==, TR:testOne, '0x1234567']
   *  ]
   * ]
   *
   * Instruction Set Syntax:
   * 'PLH', 0, 'N',
   *  4, '+', 0, 1,
   * 'N', 5, '>', 2,
   *  3, 'PLH', 1, 'N',
   *  5, '==', 5, 6,
   * 'AND', 4, 7, 'PLH',
   *  2, 'PLH', 3, '==',
   *  9, 10, 'PLH', 4, 'N', 0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC, '==', 12,
   *  13, 'OR', 11, 14,
   * 'OR', 8, 15
   */
  var expectedArray = [
    'PLH',
    1n,
    'N',
    4n,
    '+',
    0n,
    1n,
    'N',
    5n,
    '>',
    2n,
    3n,
    'PLH',
    2n,
    'N',
    5n,
    '==',
    5n,
    6n,
    'AND',
    4n,
    7n,
    'PLH',
    0n,
    'PLH',
    3n,
    '==',
    9n,
    10n,
    'PLH',
    2n,
    'N',
    BigInt('0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC'),
    '==',
    12n,
    13n,
    'OR',
    11n,
    14n,
    'OR',
    8n,
    15n,
  ]

  var ruleStringA = `{
    "condition": "(FC:isAllowed + 4 > 5 AND TR:testOne == 5) OR (info == TR:testTwo OR TR:testOne == 0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC)",
      "positiveEffects": ["revert"],
        "negativeEffects": [],
          "callingFunction": "addValue"
  } `

  var retVal = parseRuleSyntax(
    JSON.parse(ruleStringA),
    [
      { id: 1, name: 'testOne', type: 0 },
      { id: 2, name: 'testTwo', type: 0 },
    ],
    [{ id: 3, name: 'isAllowed', type: 0 }],
    'uint256 value, string info, address addr',
    ['FC:isAllowed'],
    []
  )
  expect(retVal).not.toBeNull()
  expect(retVal!.instructionSet).toEqual(expectedArray)
})

test('Reverse Interpretation for the: "Evaluates a simple syntax string (using AND + OR operators, trackers and function parameters)" test', () => {
  var instructionSet = [
    'PLH',
    0,
    'N',
    4,
    '+',
    0,
    1,
    'N',
    5,
    '>',
    2,
    3,
    'PLH',
    1,
    'N',
    5,
    '==',
    5,
    6,
    'AND',
    4,
    7,
    'PLH',
    2,
    'PLH',
    3,
    '==',
    9,
    10,
    'PLH',
    4,
    'N',
    '0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC',
    '==',
    12,
    13,
    'OR',
    11,
    14,
    'OR',
    8,
    15,
  ]
  var expectedString =
    '( FC:isAllowed + 4 > 5 AND TR:testOne == 5 ) OR ( info == TR:testTwo OR TR:testOne == 0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC )'
  const cleanedInstructionSet = cleanInstructionSet(instructionSet)
  var placeholderArray = ['FC:isAllowed', 'TR:testOne', 'info', 'TR:testTwo', 'TR:testOne']
  var retVal = reverseParseInstructionSet(cleanedInstructionSet as number[], placeholderArray, [], 0)
  expect(retVal).toEqual(expectedString)
})

test('Evaluate a simple syntax string for a revert effect', () => {
  var ruleStringA = `{
    "condition": "(TR:simpleTrackler  + 2 == 5) AND (value < 10000)",
      "positiveEffects": ["revert"],
        "negativeEffects": [],
          "callingFunction": "addValue"
  } `
  var retVal = parseRuleSyntax(JSON.parse(ruleStringA), [], [], 'uint256 value', [], [])
  expect(retVal).not.toBeNull()
  expect(retVal!.positiveEffects[0].type).toBe(EffectType.REVERT)
  expect(retVal!.positiveEffects[0].instructionSet).toEqual([])
})

test('Evaluate a simple syntax string for a revert effect with message', () => {
  var ruleStringA = `{
    "condition": "(TR:simpleTrackler + 2 == 5) AND (value < 10000)",
      "positiveEffects": ["revert(\\"Didn\'t pass the sniff test\\")"],
  "negativeEffects": [],
        "callingFunction": "addValue"
  } `
  var str = `(TR: simpleTrackler + 2 == 5) AND(value < 10000)-- > revert("Didn't pass the sniff test")-- > addValue(uint256 value)-- > uint256 value`
  var retVal = parseRuleSyntax(JSON.parse(ruleStringA), [], [], 'uint256 value', [], [])
  expect(retVal).not.toBeNull()
  expect(retVal!.positiveEffects[0].type).toBe(EffectType.REVERT)
  expect(retVal!.positiveEffects[0].text).toEqual("Didn't pass the sniff test")
  expect(retVal!.positiveEffects[0].instructionSet).toEqual([])
})

test('Evaluate a simple syntax string for a event effect', () => {
  var ruleStringA = `{
    "condition": "(TR:simpleTrackler + 2 == 5) AND (value < 10000)",
      "positiveEffects": ["emit \\"Something wrong\\""],
        "negativeEffects": [],
          "callingFunction": "addValue"
  } `
  var retVal = parseRuleSyntax(JSON.parse(ruleStringA), [], [], 'uint256 value', [], [])
  expect(retVal).not.toBeNull()
  expect(retVal!.positiveEffects[0].type).toBe(EffectType.EVENT)
  expect(retVal!.positiveEffects[0].text).toEqual('Something wrong')
  expect(retVal!.positiveEffects[0].instructionSet).toEqual([])
})

test('Evaluate a simple syntax string for a event effect without text', () => {
  var ruleStringA = `{
    "condition": "(TR:simpleTrackler + 2 == 5) AND (value < 10000)",
      "positiveEffects": ["emit \\"Goodvibes\\""],
        "negativeEffects": [],
          "callingFunction": "addValue(uint256 value)"
  } `
  var retVal = parseRuleSyntax(JSON.parse(ruleStringA), [], [], 'uint256 value', [], [])
  expect(retVal).not.toBeNull()
  expect(retVal!.positiveEffects[0].type).toBe(EffectType.EVENT)
  expect(retVal!.positiveEffects[0].text).toEqual('Goodvibes')
  expect(retVal!.positiveEffects[0].instructionSet).toEqual([])
})

test('Evaluate a simple syntax string that contains a positive and negative effect', () => {
  var ruleStringA = `{
    "condition": "(TR:simpleTrackler + 2 == 5) AND (value < 10000)",
      "positiveEffects": ["emit \\"Goodvibes\\""],
        "negativeEffects": ["revert"],
          "callingFunction": "addValue"
  } `
  var retVal = parseRuleSyntax(JSON.parse(ruleStringA), [], [], 'uint256 value', [], [])
  expect(retVal).not.toBeNull()
  expect(retVal!.positiveEffects[0].type).toBe(EffectType.EVENT)
  expect(retVal!.positiveEffects[0].text).toEqual('Goodvibes')
  expect(retVal!.positiveEffects[0].instructionSet).toEqual([])
  expect(retVal!.negativeEffects[0].type).toBe(EffectType.REVERT)
  expect(retVal!.negativeEffects[0].text).toEqual('')
  expect(retVal!.negativeEffects[0].instructionSet).toEqual([])
})

test('Evaluate a simple syntax string that contains multiple positive effects and a negative effect', () => {
  var ruleStringA = `{
    "condition": "(TR:simpleTrackler + 2 == 5) AND (value < 10000)",
      "positiveEffects": ["emit \\"Goodvibes\\"", "emit \\"OtherGoodvibes\\""],
        "negativeEffects": ["revert"],
          "callingFunction": "addValue"
  } `
  var retVal = parseRuleSyntax(JSON.parse(ruleStringA), [], [], 'uint256 value', [], [])
  expect(retVal).not.toBeNull()
  expect(retVal!.positiveEffects[0].type).toBe(EffectType.EVENT)
  expect(retVal!.positiveEffects[0].text).toEqual('Goodvibes')
  expect(retVal!.positiveEffects[0].instructionSet).toEqual([])
  expect(retVal!.positiveEffects[1].type).toBe(EffectType.EVENT)
  expect(retVal!.positiveEffects[1].text).toEqual('OtherGoodvibes')
  expect(retVal!.positiveEffects[1].instructionSet).toEqual([])
  expect(retVal!.negativeEffects[0].type).toBe(EffectType.REVERT)
  expect(retVal!.negativeEffects[0].text).toEqual('')
  expect(retVal!.negativeEffects[0].instructionSet).toEqual([])
})

test('Evaluate a simple syntax string that contains multiple positive and negative effects', () => {
  var ruleStringA = `{
    "condition": "(TR:simpleTrackler + 2 == 5) AND (value < 10000)",
      "positiveEffects": ["emit \\"Goodvibes\\"", "emit \\"OtherGoodvibes\\""],
        "negativeEffects": ["emit \\"badVibes\\"", "FC:updateOracle AND FC:alert"],
          "callingFunction": "addValue"
  } `
  var retVal = parseRuleSyntax(
    JSON.parse(ruleStringA),
    [{ id: 1, name: 'simpleTrackler', type: 0 }],
    [
      { id: 2, name: 'updateOracle', type: 0 },
      { id: 3, name: 'alert', type: 0 },
    ],
    'uint256 value',
    [],
    ['FC:updateOracle', 'FC:alert']
  )
  expect(retVal).not.toBeNull()
  expect(retVal!.positiveEffects[0].type).toBe(EffectType.EVENT)
  expect(retVal!.positiveEffects[0].text).toEqual('Goodvibes')
  expect(retVal!.positiveEffects[0].instructionSet).toEqual([])
  expect(retVal!.positiveEffects[1].type).toBe(EffectType.EVENT)
  expect(retVal!.positiveEffects[1].text).toEqual('OtherGoodvibes')
  expect(retVal!.positiveEffects[1].instructionSet).toEqual([])
  expect(retVal!.negativeEffects[0].type).toBe(EffectType.EVENT)
  expect(retVal!.negativeEffects[0].text).toEqual('badVibes')
  expect(retVal!.negativeEffects[0].instructionSet).toEqual([])
  expect(retVal!.negativeEffects[1].type).toBe(EffectType.EXPRESSION)
  expect(retVal!.negativeEffects[1].text).toEqual('')
  expect(retVal!.negativeEffects[1].instructionSet).toEqual(['PLH', 0n, 'PLH', 1n, 'AND', 0n, 1n])
  expect(retVal!.negativeEffectPlaceHolders.length).toEqual(2)
  expect(retVal!.negativeEffectPlaceHolders[0].flags).toEqual(0x1)
  expect(retVal!.negativeEffectPlaceHolders[1].pType).toEqual(0)
})

test('Evaluate a simple syntax string for an event effect with an instruction set', () => {
  var ruleStringA = `{
    "condition": "(TR:simpleTrackler + 2 == 5) AND (value < 10000)",
      "positiveEffects": ["FC:updateOracle AND FC:alert"],
        "negativeEffects": ["FC:alert"],
          "callingFunction": "addValue"
  } `
  var retVal = parseRuleSyntax(
    JSON.parse(ruleStringA),
    [{ id: 1, name: 'simpleTrackler', type: 0 }],
    [
      { id: 1, name: 'updateOracle', type: 0 },
      { id: 2, name: 'alert', type: 0 },
    ],
    'uint256 value',
    [],
    ['FC:updateOracle', 'FC:alert']
  )
  expect(retVal).not.toBeNull()
  expect(retVal!.positiveEffects[0].type).toBe(EffectType.EXPRESSION)
  expect(retVal!.positiveEffects[0].text).toEqual('')
  expect(retVal!.positiveEffects[0].instructionSet).toEqual(['PLH', 0n, 'PLH', 1n, 'AND', 0n, 1n])
})
test('Simple Reverse Interpretation', () => {
  var numbers = [0, 1, 0, 2, 5, 0, 1, 0, 3, 11, 2, 3, 0, 1, 2, 0, 11, 5, 6, 12, 4, 7]
  var placeholderArray = ['value']
  var retVal = reverseParseInstructionSet(numbers, placeholderArray, [], 0)
  expect(retVal).not.toBeNull()
  expect(retVal).toEqual('1 + 2 == 3 AND 1 == value')
})

test('Evaluates a simple effect involving a tracker update (TRU))', () => {
  var expectedArray = ['PLH', 0n, 'N', 1n, '-', 0n, 1n, 'TRU', 4n, 2n, 0n]

  var ruleStringA = `{
    "condition": " value > 5 ",
      "positiveEffects": [" TRU:testOne -= 1 "],
        "negativeEffects": [],
          "callingFunction": "addValue"
  } `

  var str = 'value > 5  --> TRU:testOne -= value --> addValue(uint256 value, string info, address addr)'
  var retVal = parseRuleSyntax(
    JSON.parse(ruleStringA),
    [{ id: 4, name: 'testOne', type: 0 }],
    [],
    'uint256 value, string info, address addr',
    [],
    []
  )
  expect(retVal).not.toBeNull()
  expect(retVal!.positiveEffects[0].instructionSet).toEqual(expectedArray)
  expect(retVal!.positiveEffectPlaceHolders.length).toEqual(1)
  expect(retVal!.positiveEffectPlaceHolders[0].flags).toEqual(0x02)
})

test('Multiple copies of the same placeholder test', () => {
  var expectedArray = [
    'PLH',
    0n,
    'N',
    4n,
    '+',
    0n,
    1n,
    'N',
    5n,
    '>',
    2n,
    3n,
    'PLH',
    0n,
    'N',
    5n,
    '==',
    5n,
    6n,
    'OR',
    4n,
    7n,
    'PLH',
    0n,
    'PLH',
    1n,
    '==',
    9n,
    10n,
    'OR',
    8n,
    11n,
  ]

  var ruleStringA = `{
    "condition": "(value + 4 > 5 OR value == 5) OR value == TR:testTwo",
      "positiveEffects": ["revert"],
        "negativeEffects": [],
          "callingFunction": "addValue"
  } `

  var retVal = parseRuleSyntax(
    JSON.parse(ruleStringA),
    [{ id: 1, name: 'testTwo', type: 0 }],
    [],
    'uint256 value, string info, address addr',
    [],
    []
  )
  expect(retVal).not.toBeNull()
  expect(retVal!.instructionSet).toEqual(expectedArray)
})

test('Extraneous paraenthesis', () => {
  var expectedArray = [
    'PLH',
    0n,
    'N',
    4n,
    '+',
    0n,
    1n,
    'N',
    5n,
    '>',
    2n,
    3n,
    'PLH',
    0n,
    'N',
    5n,
    '==',
    5n,
    6n,
    'OR',
    4n,
    7n,
    'PLH',
    0n,
    'PLH',
    1n,
    '==',
    9n,
    10n,
    'OR',
    8n,
    11n,
  ]

  var ruleStringA = `{
    "condition": "(((value + 4 > 5) OR value == 5)) OR ((value == TR:testTwo))",
      "positiveEffects": ["revert"],
        "negativeEffects": [],
          "callingFunction": "addValue"
  } `
  var retVal = parseRuleSyntax(
    JSON.parse(ruleStringA),
    [{ id: 1, name: 'testTwo', type: 0 }],
    [],
    'uint256 value, string info, address addr',
    [],
    []
  )
  expect(retVal).not.toBeNull()
  expect(retVal!.instructionSet).toEqual(expectedArray)
})

test('Evaluates a syntax string that includes keywords in variable names and raw string values', () => {
  /**
   * Original Syntax:
   * value + sAND > 5 AND (lORe == 1 AND bORe test == lORe)
   *
   * [
   *  'PLH', 0,
   *  'PLH', 1,
   *  '+',   0,
   *  1,     'N',
   *  5,     '>',
   *  2,     3,
   *  'PLH', 2,
   *  'N',   1,
   *  '==',  5,
   *  6,     parseInt(keccak256('bORe test')),
   *  'PLH', 2,
   *  '==',  8,
   *  9,     'AND',
   *  7,     10,
   *  'AND', 4,
   *   11
   * ]
   */

  var expectedArray = [
    'PLH',
    0n,
    'PLH',
    1n,
    '+',
    0n,
    1n,
    'N',
    5n,
    '>',
    2n,
    3n,
    'PLH',
    2n,
    'N',
    1n,
    '==',
    5n,
    6n,
    'N',
    BigInt(keccak256(encodeAbiParameters(parseAbiParameters('string'), ['bORe test']))),
    'PLH',
    2n,
    '==',
    8n,
    9n,
    'AND',
    7n,
    10n,
    'AND',
    4n,
    11n,
  ]

  var ruleStringA = `{
    "condition": "value + sAND > 5 AND (lORe == 1 AND \\"bORe test\\" == lORe)",
      "positiveEffects": ["revert"],
        "negativeEffects": [],
          "callingFunction": "addValue"
  } `

  var str =
    'value + sAND > 5 AND (lORe == 1 AND bORe test == lORe) --> revert --> addValue(uint256 value, uint256 sAND, address lORe)'
  var retVal = parseRuleSyntax(JSON.parse(ruleStringA), [], [], 'uint256 value, uint256 sAND, address lORe', [], [])
  expect(retVal).not.toBeNull()
  expect(retVal!.instructionSet).toEqual(expectedArray)
})

test('Ensure that the parser can handle FC in various parts of a string', () => {
  var expectedArray = [
    'PLH',
    0n,
    'N',
    BigInt(keccak256(encodeAbiParameters(parseAbiParameters('string'), ['FCalert']))),
    '==',
    0n,
    1n,
  ]

  var ruleStringA = `{
    "condition": "(FC:updateOracle == \\"FCalert\\")",
      "positiveEffects": ["revert"],
        "negativeEffects": [],
          "callingFunction": "addValue"
  } `

  var retVal = parseRuleSyntax(
    JSON.parse(ruleStringA),
    [],
    [{ id: 1, name: 'updateOracle', type: 0 }],
    '',
    ['FC:updateOracle'],
    []
  )
  expect(retVal).not.toBeNull()
  expect(retVal!.instructionSet).toEqual(expectedArray)
})

test('Evaluates a simple syntax string involving a NOT operation', () => {
  /**
   * Original Syntax:
   * 3 + 4 > 5 AND (1 == 1 AND 2 == 2)
   *
   * Abtract Tree Syntax:
   * [AND,
   *  [">",
   *      ["+", "3", "4"],
   *      "5"]
   *  [AND,
   *      ["==", "1", "1"],
   *      ["==", "2", "2"]
   *  ]
   * ]
   *
   * Instruction Set Syntax:
   * [ 'N', 3, 'N', 4, '+', 0,
   *    1, 'N', 5, '>', 2, 3,
   *   'N', 1, 'N', 1, '==', 5,
   *    6, 'N', 2, 'N', 2, '==',
   *    8, 9, 'AND', 7, 10, 'AND',
   *    4, 11 ]
   */
  var expectedArray = [
    'N',
    3n,
    'N',
    3n,
    '==',
    0n,
    1n,
    'N',
    1n,
    'N',
    1n,
    '==',
    3n,
    4n,
    'N',
    2n,
    'N',
    2n,
    '==',
    6n,
    7n,
    'N',
    3n,
    'N',
    3n,
    '==',
    9n,
    10n,
    'AND',
    8n,
    11n,
    'OR',
    5n,
    12n,
    'NOT',
    13n,
    'AND',
    2n,
    14n,
  ]

  var ruleStringA = `{
    "condition": "3 == 3 AND ( NOT (1 == 1 OR (2 == 2 AND 3 == 3)))",
      "positiveEffects": ["revert"],
        "negativeEffects": [],
          "callingFunction": "addValue"
  } `
  var retVal = parseRuleSyntax(JSON.parse(ruleStringA), [], [], 'uint256 value, uint256 sAND', [], [])
  expect(retVal).not.toBeNull()
  expect(retVal!.instructionSet).toEqual(expectedArray)
})

test('Evaluates a simple syntax string involving a NOT operation', () => {
  /**
   * Original Syntax:
   * 3 + 4 > 5 AND (1 == 1 AND 2 == 2)
   *
   * Abtract Tree Syntax:
   * [AND,
   *  [">",
   *      ["+", "3", "4"],
   *      "5"]
   *  [AND,
   *      ["==", "1", "1"],
   *      ["==", "2", "2"]
   *  ]
   * ]
   *
   * Instruction Set Syntax:
   * [ 'N', 3, 'N', 4, '+', 0,
   *    1, 'N', 5, '>', 2, 3,
   *   'N', 1, 'N', 1, '==', 5,
   *    6, 'N', 2, 'N', 2, '==',
   *    8, 9, 'AND', 7, 10, 'AND',
   *    4, 11 ]
   */
  var expectedArray = ['PLH', 0n, 'N', 1n, '==', 0n, 1n, 'PLH', 1n, 'N', 2n, '==', 3n, 4n, 'AND', 2n, 5n, 'NOT', 6n]

  var ruleStringA = `{
    "condition": "NOT (TR:trackerOne == 1 AND TR:trackerTwo == 2)",
      "positiveEffects": ["revert"],
        "negativeEffects": [],
          "callingFunction": "addValue"
  } `
  var retVal = parseRuleSyntax(
    JSON.parse(ruleStringA),
    [
      { id: 1, name: 'trackerOne', type: 0 },
      { id: 2, name: 'trackerTwo', type: 0 },
    ],
    [],
    'uint256 value, uint256 sAND',
    [],
    []
  )
  expect(retVal).not.toBeNull()
  expect(retVal!.instructionSet).toEqual(expectedArray)
})

test('Evaluates a simple syntax string involving a NOT operation', () => {
  /**
   * Original Syntax:
   * 3 + 4 > 5 AND (1 == 1 AND 2 == 2)
   *
   * Abtract Tree Syntax:
   * [AND,
   *  [">",
   *      ["+", "3", "4"],
   *      "5"]
   *  [AND,
   *      ["==", "1", "1"],
   *      ["==", "2", "2"]
   *  ]
   * ]
   *
   * Instruction Set Syntax:
   * [ 'N', 3, 'N', 4, '+', 0,
   *    1, 'N', 5, '>', 2, 3,
   *   'N', 1, 'N', 1, '==', 5,
   *    6, 'N', 2, 'N', 2, '==',
   *    8, 9, 'AND', 7, 10, 'AND',
   *    4, 11 ]
   */
  var expectedArray = [
    'PLH',
    0n,
    'N',
    1n,
    '==',
    0n,
    1n,
    'PLH',
    1n,
    'N',
    2n,
    '==',
    3n,
    4n,
    'N',
    1n,
    'N',
    1n,
    '==',
    6n,
    7n,
    'NOT',
    8n,
    'AND',
    5n,
    9n,
    'OR',
    2n,
    10n,
  ]

  var ruleStringA = `{
    "condition": "TR:trackerOne == 1 OR (TR:trackerTwo == 2 AND ( NOT (1 == 1)))",
      "positiveEffects": ["revert"],
        "negativeEffects": [],
          "callingFunction": "addValue"
  } `
  var retVal = parseRuleSyntax(
    JSON.parse(ruleStringA),
    [
      { id: 1, name: 'trackerOne', type: 0 },
      { id: 2, name: 'trackerTwo', type: 0 },
      { id: 2, name: 'trackerThree', type: 2 },
    ],
    [],
    'uint256 value, uint256 sAND',
    [],
    []
  )
  expect(retVal).not.toBeNull()
  expect(retVal!.instructionSet).toEqual(expectedArray)
})

test('Evaluates a simple syntax string involving a boolean variable', () => {
  /**
   * Original Syntax:
   * 3 + 4 > 5 AND (1 == 1 AND 2 == 2)
   *
   * Abtract Tree Syntax:
   * [AND,
   *  [">",
   *      ["+", "3", "4"],
   *      "5"]
   *  [AND,
   *      ["==", "1", "1"],
   *      ["==", "2", "2"]
   *  ]
   * ]
   *
   * Instruction Set Syntax:
   * [ 'N', 3, 'N', 4, '+', 0,
   *    1, 'N', 5, '>', 2, 3,
   *   'N', 1, 'N', 1, '==', 5,
   *    6, 'N', 2, 'N', 2, '==',
   *    8, 9, 'AND', 7, 10, 'AND',
   *    4, 11 ]
   */
  var expectedArray = ['PLH', 0n, 'N', 1n, '==', 0n, 1n]

  var ruleStringA = `{
    "condition": "value == true",
      "positiveEffects": ["revert"],
        "negativeEffects": [],
          "functionSignature": "addValue"
  } `
  var retVal = parseRuleSyntax(
    JSON.parse(ruleStringA),
    [
      { id: 1, name: 'trackerOne', type: 0 },
      { id: 2, name: 'trackerTwo', type: 0 },
    ],
    [],
    'bool value, uint256 sAND',
    [],
    []
  )
  expect(retVal).not.toBeNull()
  expect(retVal!.instructionSet).toEqual(expectedArray)
})

test('Evaluates a simple syntax string involving a boolean tracker', () => {
  /**
   * Original Syntax:
   * 3 + 4 > 5 AND (1 == 1 AND 2 == 2)
   *
   * Abtract Tree Syntax:
   * [AND,
   *  [">",
   *      ["+", "3", "4"],
   *      "5"]
   *  [AND,
   *      ["==", "1", "1"],
   *      ["==", "2", "2"]
   *  ]
   * ]
   *
   * Instruction Set Syntax:
   * [ 'N', 3, 'N', 4, '+', 0,
   *    1, 'N', 5, '>', 2, 3,
   *   'N', 1, 'N', 1, '==', 5,
   *    6, 'N', 2, 'N', 2, '==',
   *    8, 9, 'AND', 7, 10, 'AND',
   *    4, 11 ]
   */
  var expectedArray = ['PLH', 0n, 'N', 1n, '==', 0n, 1n]

  var ruleStringA = `{
    "condition": "TR:trackerOne == true",
      "positiveEffects": ["revert"],
        "negativeEffects": [],
          "functionSignature": "addValue"
  } `
  var retVal = parseRuleSyntax(
    JSON.parse(ruleStringA),
    [
      { id: 1, name: 'trackerOne', type: 3 },
      { id: 2, name: 'trackerTwo', type: 0 },
    ],
    [],
    'bool value, uint256 sAND',
    [],
    []
  )
  expect(retVal).not.toBeNull()
  expect(retVal!.instructionSet).toEqual(expectedArray)
})

test('Evaluates a simple syntax string involving a mapped tracker', () => {
  /**
   * Original Syntax:
   * 3 + 4 > 5 AND (1 == 1 AND 2 == 2)
   *
   * Abtract Tree Syntax:
   * [AND,
   *  [">",
   *      ["+", "3", "4"],
   *      "5"]
   *  [AND,
   *      ["==", "1", "1"],
   *      ["==", "2", "2"]
   *  ]
   * ]
   *
   * Instruction Set Syntax:
   * [ 'N', 3, 'N', 4, '+', 0,
   *    1, 'N', 5, '>', 2, 3,
   *   'N', 1, 'N', 1, '==', 5,
   *    6, 'N', 2, 'N', 2, '==',
   *    8, 9, 'AND', 7, 10, 'AND',
   *    4, 11 ]
   */
  var expectedArray = ['PLH', 0n, 'PLHM', 1n, 0n, 'N', 1n, '==', 1n, 2n]

  var ruleStringA = `{
    "condition": "TR:trackerOne(to) == true",
      "positiveEffects": ["revert"],
        "negativeEffects": [],
          "functionSignature": "addValue"
  } `
  var retVal = parseRuleSyntax(
    JSON.parse(ruleStringA),
    [
      { id: 1, name: 'trackerOne', type: 3 },
      { id: 2, name: 'trackerTwo', type: 0 },
    ],
    [],
    'address to, uint256 sAND',
    [],
    []
  )
  expect(retVal).not.toBeNull()
  expect(retVal!.instructionSet).toEqual(expectedArray)
})

test('Evaluates a simple effect involving a mapped tracker update (TRUM))', () => {
  var expectedArray = ['PLH', 0n, 'PLHM', 1n, 0n, 'N', 1n, '-', 1n, 2n, 'TRUM', 1n, 3n, 0n, 0n]

  var ruleStringA = `{
    "condition": " 1 == 1",
      "positiveEffects": [" TRU:testOne(to) -= 1 "],
        "negativeEffects": [],
          "callingFunction": "addValue"
  } `

  var retVal = parseRuleSyntax(
    JSON.parse(ruleStringA),
    [
      { id: 1, name: 'testOne', type: 3 },
      { id: 2, name: 'testTwo', type: 3 },
    ],
    [],
    'uint256 value, address to',
    [],
    []
  )
  expect(retVal).not.toBeNull()
  expect(retVal!.positiveEffects[0].instructionSet).toEqual(expectedArray)
  expect(retVal!.positiveEffectPlaceHolders.length).toEqual(2)
})

test('Evaluates a simple effect involving a mapped tracker with string value update (TRUM))', () => {
  const expectedEffect0 = ['PLH', 0n, 'PLHM', 1n, 0n, 'PLH', 1n, '-', 1n, 2n, 'TRUM', 1n, 3n, 0n, 1n]

  const expectedEffect1 = ['PLH', 0n, 'PLHM', 2n, 0n, 'PLH', 3n, '+', 1n, 2n, 'TRUM', 2n, 3n, 0n, 1n]

  var ruleStringA = `{
    "condition": " 1 == 1",
      "positiveEffects": [" TRU:testOne(to) -= FC:getStringValue ", " TRU:testTwo(to) += FC:getBytesValue "],
        "negativeEffects": [],
          "callingFunction": "addValue"
  } `

  var retVal = parseRuleSyntax(
    JSON.parse(ruleStringA),
    [
      { id: 1, name: 'testOne', type: 1 },
      { id: 2, name: 'testTwo', type: 5 },
    ],
    [
      {
        id: 1,
        name: 'getStringValue',
        type: 1,
      },
      {
        id: 2,
        name: 'getBytesValue',
        type: 5,
      },
    ],
    'uint256 value, address to',
    [],
    ['FC:getStringValue', 'FC:getBytesValue']
  )
  expect(retVal).not.toBeNull()
  expect(retVal!.positiveEffects[0].instructionSet).toEqual(expectedEffect0)
  expect(retVal!.positiveEffects[1].instructionSet).toEqual(expectedEffect1)
  expect(retVal!.positiveEffectPlaceHolders.length).toEqual(5)
})

test('Evaluates a complex effect involving a mapped tracker update (TRUM))', () => {
  var expectedArray = [
    'PLH',
    0n,
    'PLHM',
    1n,
    0n,
    'N',
    1n,
    '-',
    1n,
    2n,
    'TRUM',
    1n,
    3n,
    0n,
    0n,
    'PLH',
    0n,
    'PLHM',
    2n,
    5n,
    'N',
    1n,
    '-',
    6n,
    7n,
    'TRUM',
    2n,
    8n,
    5n,
    0n,
    'AND',
    4n,
    9n,
  ]

  var ruleStringA = `{
    "condition": " 1 == 1",
      "positiveEffects": [" TRU:testOne(to) -= 1 AND TRU:testTwo(to) -= 1"],
        "negativeEffects": [],
          "callingFunction": "addValue"
  } `

  var retVal = parseRuleSyntax(
    JSON.parse(ruleStringA),
    [
      { id: 1, name: 'testOne', type: 3 },
      { id: 2, name: 'testTwo', type: 3 },
    ],
    [],
    'uint256 value, address to',
    [],
    []
  )
  expect(retVal).not.toBeNull()
  expect(retVal!.positiveEffects[0].instructionSet).toEqual(expectedArray)
})

test('Evaluates another complex effect involving a mapped tracker update (TRUM))', () => {
  var expectedArray = ['PLH', 1n, 'PLHM', 2n, 0n, 'PLH', 0n, '-', 1n, 2n, 'TRUM', 2n, 3n, 0n, 0n]

  var ruleStringA = `{
    "condition": " 1 == 1",
      "positiveEffects": [" TRU:testTwo(to) -= value "],
        "negativeEffects": [],
          "callingFunction": "addValue"
  } `

  var retVal = parseRuleSyntax(
    JSON.parse(ruleStringA),
    [
      { id: 1, name: 'testOne', type: 3 },
      { id: 2, name: 'testTwo', type: 3 },
    ],
    [],
    'uint256 value, address to',
    [],
    []
  )
  expect(retVal).not.toBeNull()
  expect(retVal!.positiveEffects[0].instructionSet).toEqual(expectedArray)
  expect(retVal!.positiveEffectPlaceHolders.length).toEqual(3)
})

test('Evaluates a third complex effect involving a mapped tracker update (TRUM))', () => {
  var expectedArray = ['PLH', 0n, 'PLHM', 1n, 0n, 'PLH', 1n, '-', 1n, 2n, 'TRUM', 1n, 3n, 0n, 0n]

  var ruleStringA = `{
    "condition": " 1 == 1",
      "positiveEffects": [" TRU:testOne(to) -= FC:foreignCallEx"],
        "negativeEffects": [],
          "callingFunction": "addValue"
  } `

  var retVal = parseRuleSyntax(
    JSON.parse(ruleStringA),
    [
      { id: 1, name: 'testOne', type: 3 },
      { id: 2, name: 'testTwo', type: 3 },
    ],
    [
      {
        id: 1,
        name: 'foreignCallEx',
        type: 0,
      },
    ],
    'uint256 value, address to',
    [],
    ['FC:foreignCallEx']
  )
  expect(retVal).not.toBeNull()
  expect(retVal!.positiveEffects[0].instructionSet).toEqual(expectedArray)
})

test('Evaluates a fourth complex effect involving a mapped tracker update (TRUM))', () => {
  var expectedArray = ['PLH', 2n, 'PLHM', 1n, 0n, 'N', 1n, '-', 1n, 2n, 'TRUM', 1n, 3n, 0n, 0n]

  var ruleStringA = `{
    "condition": " 1 == 1",
      "positiveEffects": [],
        "negativeEffects": [" TRU:testOne(GV:BLOCK_NUMBER) -= 1"],
          "callingFunction": "addValue"
  } `

  var retVal = parseRuleSyntax(
    JSON.parse(ruleStringA),
    [
      { id: 1, name: 'testOne', type: 3 },
      { id: 2, name: 'testTwo', type: 3 },
    ],
    [
      {
        id: 1,
        name: 'foreignCallEx',
        type: 0,
      },
    ],
    'uint256 value, address to',
    [],
    ['FC:foreignCallEx']
  )
  expect(retVal).not.toBeNull()
  expect(retVal!.negativeEffects[0].instructionSet).toEqual(expectedArray)
})

test('Creates a simple foreign call with a boolean return', () => {
  var str = `{
  "name": "Simple Foreign Call",
  "address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
  "function": "testSig(address,string,uint256)",
  "returnType": "bool",
  "valuesToPass": "to, someString, value",
  "mappedTrackerKeyValues": "",
  "callingFunction": "someFunction(address to, string someString, uint256 value)"
  }`

  var retVal = parseForeignCallDefinition(JSON.parse(str), [], [], ['to', 'someString', 'value'])
  expect(retVal.name).toEqual('Simple Foreign Call')
  expect(retVal.address).toEqual(getAddress('0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC'))
  expect(retVal.function).toEqual('testSig(address,string,uint256)')
  expect(retVal.returnType).toEqual(3)
})

test('Creates a foreign call using a mapped tracker as a parameter', () => {
  var str = `{
  "name": "Simple Foreign Call",
  "address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
  "function": "testSig(address,string,uint256)",
  "returnType": "bool",
  "valuesToPass": "TR:someTracker, someString, value",
  "mappedTrackerKeyValues": "value",
  "callingFunction": "someFunction(address to, string someString, uint256 value)"
  }`

  var retVal = parseForeignCallDefinition(
    JSON.parse(str),
    [],
    [
      {
        id: 1,
        name: 'someTracker',
        type: 3,
      },
    ],
    ['to', 'someString', 'value']
  )
  expect(retVal.mappedTrackerKeyIndices.length).toEqual(1)
  expect(retVal.mappedTrackerKeyIndices[0].eType).toEqual(0)
  expect(retVal.mappedTrackerKeyIndices[0].index).toEqual(2)
})

test('Evaluates a syntax string that includes the Block Number Global Variable', () => {
  var ruleStringA = `{
    "condition": "value + GV:BLOCK_NUMBER > 5 AND (1 == 1)",
      "positiveEffects": ["revert"],
        "negativeEffects": [],
          "callingFunction": "addValue"
  } `

  var retVal = parseRuleSyntax(JSON.parse(ruleStringA), [], [], 'uint256 value, uint256 sAND, address lORe', [], [])
  expect(retVal).not.toBeNull()
  expect(retVal!.placeHolders[1].flags).toEqual(0x10)
})

test('Evaluates a syntax string that includes the Msg Sender Global Variable', () => {
  var ruleStringA = `{
    "condition": "lORe == GV:MSG_SENDER",
      "positiveEffects": ["revert"],
        "negativeEffects": [],
          "callingFunction": "addValue"
  } `

  var retVal = parseRuleSyntax(JSON.parse(ruleStringA), [], [], 'uint256 value, uint256 sAND, address lORe', [], [])
  expect(retVal).not.toBeNull()
  expect(retVal!.placeHolders[1].flags).toEqual(0x04)
})

test('Evaluates a syntax string that includes the Block Timestamp Global Variable', () => {
  var ruleStringA = `{
    "condition": "value > GV:BLOCK_TIMESTAMP",
      "positiveEffects": ["revert"],
        "negativeEffects": [],
          "callingFunction": "addValue"
  } `

  var retVal = parseRuleSyntax(JSON.parse(ruleStringA), [], [], 'uint256 value, uint256 sAND, address lORe', [], [])
  expect(retVal).not.toBeNull()
  expect(retVal!.placeHolders[1].flags).toEqual(0x08)
})

test('Evaluates a syntax string that includes the Block Timestamp Global Variable', () => {
  var ruleStringA = `{
    "condition": "value == GV:MSG_DATA",
      "positiveEffects": ["revert"],
        "negativeEffects": [],
          "callingFunction": "addValue"
  } `

  var retVal = parseRuleSyntax(JSON.parse(ruleStringA), [], [], 'bytes value, uint256 sAND, address lORe', [], [])
  expect(retVal).not.toBeNull()
  expect(retVal!.placeHolders[1].flags).toEqual(0x0c)
})

test('Evaluates a syntax string that includes the Tx Origin Global Variable', () => {
  var ruleStringA = `{
    "condition": "lORe == GV:TX_ORIGIN",
      "positiveEffects": ["revert"],
        "negativeEffects": [],
          "callingFunction": "addValue"
  } `

  var retVal = parseRuleSyntax(JSON.parse(ruleStringA), [], [], 'bytes value, uint256 sAND, address lORe', [], [])
  expect(retVal).not.toBeNull()
  expect(retVal!.placeHolders[1].flags).toEqual(0x14)
})

test('Foreign call self-reference validation - should throw error for self-reference in valuesToPass', () => {
  const selfReferencingForeignCall = {
    name: 'SelfReferencingCall',
    address: '0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC' as `0x${string}`,
    function: 'SelfReferencingCall(uint256)',
    returnType: 'uint256',
    valuesToPass: 'FC:SelfReferencingCall',
    mappedTrackerKeyValues: '',
    callingFunction: 'transfer(address to, uint256 value)',
  }

  expect(() => {
    parseForeignCallDefinition(selfReferencingForeignCall, [], [], ['value'])
  }).toThrow(
    'Foreign call "SelfReferencingCall" cannot reference itself in valuesToPass. Self-referential foreign calls are not allowed as they would create infinite loops.'
  )
})

test('Foreign call self-reference validation - should throw error for self-reference in mappedTrackerKeyValues', () => {
  const selfReferencingForeignCall = {
    name: 'SelfReferencingCall',
    address: '0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC' as `0x${string}`,
    function: 'SelfReferencingCall(uint256)',
    returnType: 'uint256',
    valuesToPass: 'to',
    mappedTrackerKeyValues: 'FC:SelfReferencingCall',
    callingFunction: 'transfer(address to, uint256 value)',
  }

  expect(() => {
    parseForeignCallDefinition(selfReferencingForeignCall, [], [], ['to'])
  }).toThrow(
    'Foreign call "SelfReferencingCall" cannot reference itself in mappedTrackerKeyValues. Self-referential foreign calls are not allowed as they would create infinite loops.'
  )
})

test('Foreign call self-reference validation - should allow valid foreign call references', () => {
  const validForeignCall = {
    name: 'ValidCall',
    address: '0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC' as `0x${string}`,
    function: 'ValidCall(uint256)',
    returnType: 'uint256',
    valuesToPass: 'FC:AnotherCall',
    mappedTrackerKeyValues: '',
    callingFunction: 'transfer(address to, uint256 value)',
  }

  expect(() => {
    parseForeignCallDefinition(validForeignCall, [{ id: 1, name: 'AnotherCall', type: 1 }], [], ['value'])
  }).not.toThrow()
})

test('Test Parsing Event Effect with Dynamic Parameter', () => {
  var ruleStringA = `{
    "condition": "lORe == GV:TX_ORIGIN",
      "positiveEffects": ["revert"],
        "negativeEffects": [" emit \\"Test Event\\", sAND"],
          "callingFunction": "addValue"
  } `

  var retVal = parseRuleSyntax(JSON.parse(ruleStringA), [], [], 'bytes value, uint256 sAND, address lORe', [], [])
})

test('Should parse foreign call with empty parameters correctly', () => {
  const fcJSON = {
    name: "EmptyParamCall",
    address: "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC" as const,
    function: "testSig()",
    returnType: "uint256" as const,
    valuesToPass: "",
    mappedTrackerKeyValues: "",
    callingFunction: "transfer(address to, uint256 value)"
  }

  const result = parseForeignCallDefinition(fcJSON, [], [], [])
  expect(result.parameterTypes).toEqual([]) // Should be empty array, not [4] (VOID)
  expect(result.returnType).toBe(2) // uint256
})

test('Should parse foreign call with void return type correctly', () => {
  const fcJSON = {
    name: "VoidReturnCall",
    address: "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC" as const,
    function: "testSig(uint256)",
    returnType: "void" as const,
    valuesToPass: "value",
    mappedTrackerKeyValues: "",
    callingFunction: "transfer(address to, uint256 value)"
  }

  const result = parseForeignCallDefinition(fcJSON, [], [], ['value'])
  expect(result.parameterTypes).toEqual([2]) // uint256
  expect(result.returnType).toBe(4) // void
})
