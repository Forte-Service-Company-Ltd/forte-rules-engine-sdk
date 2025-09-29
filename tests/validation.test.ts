import { expect, test } from 'vitest'
import {
  validateRuleJSON,
  validateForeignCallJSON,
  validateTrackerJSON,
  validatePolicyJSON,
  safeParseJson,
  formatParenConditionGroups,
  validateCondition,
  validateMappedTrackerJSON,
} from '../src/modules/validation'
import { isLeft, isRight, unwrapEither } from '../src/modules/utils'
import { RulesError } from '../src/modules/types'

const ruleJSON = `{
        "Name": "Rule A",
        "Description": "Rule A Description",
				"condition": "3 + 4 > 5 AND (1 == 1 AND 2 == 2)",
				"positiveEffects": ["revert"],
				"negativeEffects": [],
				"callingFunction": "addValue(uint256 value)"
				}`

const fcJSON = `{
					"name": "Simple Foreign Call",
					"address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
					"function": "testSig(address,string,uint256)",
					"returnType": "uint256",
					"valuesToPass": "0, 1, 2",
          "mappedTrackerKeyValues": "",
					"callingFunction": "transfer(address to, uint256 value)"
					}`

const trackerJSON = `{
							"name": "Simple String Tracker",
							"type": "uint256",
							"initialValue": "4"
					}`

const mappedTrackerJSON = `{
    "name": "Simple bool Tracker",
    "keyType": "uint256",
    "valueType": "uint256",
    "initialKeys": ["0", "1", "2"],
    "initialValues": ["1", "2", "3"]
  }`

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

var policyJSONFull = `
    {
    "Policy": "Test Full Policy",
    "Description": "Test Policy Description",
    "PolicyType": "open",
    "CallingFunctions": [
      {
        "name": "transfer(address to, uint256 value)",
        "functionSignature": "transfer(address to, uint256 value)",
        "encodedValues": "address to, uint256 value"
      },
      {
        "name": "mint(address to, uint256 value)",
        "functionSignature": "mint(address to, uint256 value)",
        "encodedValues": "address to, uint256 value"
      }
    ],
    "ForeignCalls": [
      {
          "name": "SimpleForeignCall",
          "address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
          "function": "testSig(address)",
          "returnType": "uint256",
          "valuesToPass": "to",
          "mappedTrackerKeyValues": "",
          "callingFunction": "transfer(address to, uint256 value)"
      },
      {
          "name": "SimpleForeignCall",
          "address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
          "function": "testSig2(address)",
          "returnType": "uint256",
          "valuesToPass": "to",
          "mappedTrackerKeyValues": "",
          "callingFunction": "mint(address to, uint256 value)"
      }
    ],
    "Trackers": [
      {
          "name": "SimpleStringTracker",
          "type": "string",
          "initialValue": "test"
      },
      {
          "name": "SimpleUint256Tracker2",
          "type": "uint256",
          "initialValue": "0"
      }
    ],
	"MappedTrackers": [
    {
      "name": "SimpleMappedTracker",
      "keyType": "uint256",
      "valueType": "uint256",
      "initialKeys": ["0", "1", "2"],
      "initialValues": ["1", "2", "3"]
    },
    {
      "name": "SimpleMappedTracker2",
      "keyType": "uint256",
      "valueType": "uint256",
      "initialKeys": ["0", "1", "2"],
      "initialValues": ["1", "2", "3"]
    }
  ],
    "Rules": [
      {
          "Name": "Rule A",
          "Description": "Rule A Description",
          "condition": "FC:SimpleForeignCall > 500 AND (TR:SimpleStringTracker == 'test' OR TR:SimpleMappedTracker(to) > 100)",
          "positiveEffects": ["emit Success"],
          "negativeEffects": ["revert()"],
          "callingFunction": "transfer(address to, uint256 value)"
      },
      {
          "Name": "Rule B",
          "Description": "Rule B Description",
          "condition": "FC:SimpleForeignCall > 500",
          "positiveEffects": ["TR:SimpleStringTracker2(to) +=1", "TRU:SimpleMappedTracker2(to) +=1"],
          "negativeEffects": ["revert()"],
          "callingFunction": "mint(address to, uint256 value)"
      }
    ]
  }`

test('Can validate rule JSON', () => {
  const parsedRule = validateRuleJSON(ruleJSON)
  expect(isRight(parsedRule)).toBeTruthy()
  if (isRight(parsedRule)) {
    const rule = unwrapEither(parsedRule)

    expect(rule.callingFunction).toEqual(JSON.parse(ruleJSON).callingFunction)
  }
})

test('Can validate rule JSON missing name and description', () => {
  const parsedJSON = JSON.parse(ruleJSON)
  delete parsedJSON.Name
  delete parsedJSON.Description
  const parsedRule = validateRuleJSON(JSON.stringify(parsedJSON))
  expect(isRight(parsedRule)).toBeTruthy()
  if (isRight(parsedRule)) {
    const rule = unwrapEither(parsedRule)

    expect(rule.callingFunction).toEqual(JSON.parse(ruleJSON).callingFunction)
  }
})

test('Can validate rule JSON missing name and description undefined', () => {
  const parsedJSON = JSON.parse(ruleJSON)
  parsedJSON.Name = undefined
  parsedJSON.Description = undefined
  const parsedRule = validateRuleJSON(JSON.stringify(parsedJSON))
  expect(isRight(parsedRule)).toBeTruthy()
  if (isRight(parsedRule)) {
    const rule = unwrapEither(parsedRule)

    expect(rule.callingFunction).toEqual(JSON.parse(ruleJSON).callingFunction)
  }
})

test('Can catch all missing required fields in rule JSON', () => {
  const parsedRule = validateRuleJSON('{}')
  expect(isLeft(parsedRule)).toBeTruthy()
  if (isLeft(parsedRule)) {
    const errors = unwrapEither(parsedRule)

    expect(errors.length).toEqual(4)
    expect(errors[0].message).toEqual('Rule Invalid input: expected string, received undefined: Field condition')
    expect(errors[1].message).toEqual('Rule Invalid input: expected array, received undefined: Field positiveEffects')
    expect(errors[2].message).toEqual('Rule Invalid input: expected array, received undefined: Field negativeEffects')
    expect(errors[3].message).toEqual('Rule Invalid input: expected string, received undefined: Field callingFunction')
  }
})

test('Can catch duplicate calling function names', () => {
  const parsedPolicy = JSON.parse(policyJSONFull)
  parsedPolicy.CallingFunctions.push({ ...parsedPolicy.CallingFunctions[0] })

  const parsedRule = validatePolicyJSON(JSON.stringify(parsedPolicy))
  expect(isLeft(parsedRule)).toBeTruthy()
  if (isLeft(parsedRule)) {
    const errors = unwrapEither(parsedRule)

    expect(errors.length).toEqual(1)
    expect(errors[0].message).toEqual('Policy Names cannot be duplicated')
  }
})

test('Can catch duplicate Foreign Call names', () => {
  const parsedPolicy = JSON.parse(policyJSONFull)
  parsedPolicy.ForeignCalls.push({ ...parsedPolicy.ForeignCalls[0] })

  const parsedRule = validatePolicyJSON(JSON.stringify(parsedPolicy))
  expect(isLeft(parsedRule)).toBeTruthy()
  if (isLeft(parsedRule)) {
    const errors = unwrapEither(parsedRule)

    expect(errors.length).toEqual(1)
    expect(errors[0].message).toEqual('Policy Names cannot be duplicated')
  }
})

test('Can catch duplicate Tracker names', () => {
  const parsedPolicy = JSON.parse(policyJSONFull)
  parsedPolicy.Trackers.push({ ...parsedPolicy.Trackers[0] })

  const parsedRule = validatePolicyJSON(JSON.stringify(parsedPolicy))
  expect(isLeft(parsedRule)).toBeTruthy()
  if (isLeft(parsedRule)) {
    const errors = unwrapEither(parsedRule)

    expect(errors.length).toEqual(1)
    expect(errors[0].message).toEqual('Policy Names cannot be duplicated')
  }
})

test('Can catch duplicate Mapped Tracker names', () => {
  const parsedPolicy = JSON.parse(policyJSONFull)
  parsedPolicy.MappedTrackers.push({ ...parsedPolicy.MappedTrackers[0] })

  const parsedRule = validatePolicyJSON(JSON.stringify(parsedPolicy))
  expect(isLeft(parsedRule)).toBeTruthy()
  if (isLeft(parsedRule)) {
    const errors = unwrapEither(parsedRule)

    expect(errors.length).toEqual(1)
    expect(errors[0].message).toEqual('Policy Names cannot be duplicated')
  }
})

test('Can validate duplicate Rule names', () => {
  const parsedPolicy = JSON.parse(policyJSONFull)
  parsedPolicy.Rules[0].name = parsedPolicy.Rules[1].name

  const parsedRule = validatePolicyJSON(JSON.stringify(parsedPolicy))
  expect(isRight(parsedRule)).toBeTruthy()
})

test('Can catch all wrong input types for fields in rule JSON', () => {
  const invalidJSON = `{
        "Name": "Rule A",
        "Description": "Rule A Description",
				"condition": 1,
				"positiveEffects": "foo",
				"negativeEffects": "bar",
				"callingFunction": 1,
				"encodedValues": 1
				}`
  const parsedRule = validateRuleJSON(invalidJSON)
  expect(isLeft(parsedRule)).toBeTruthy()
  if (isLeft(parsedRule)) {
    const errors = unwrapEither(parsedRule)

    expect(errors.length).toEqual(4)
    expect(errors[0].message).toEqual('Rule Invalid input: expected string, received number: Field condition')
    expect(errors[1].message).toEqual('Rule Invalid input: expected array, received string: Field positiveEffects')
    expect(errors[2].message).toEqual('Rule Invalid input: expected array, received string: Field negativeEffects')
    expect(errors[3].message).toEqual('Rule Invalid input: expected string, received number: Field callingFunction')
  }
})

test('Can return error if rule JSON is invalid', () => {
  let invalidRuleJSON = JSON.parse(ruleJSON)
  delete invalidRuleJSON.condition // Remove condition to make it invalid
  const parsedRule = validateRuleJSON(JSON.stringify(invalidRuleJSON))
  expect(isLeft(parsedRule)).toBeTruthy()
  if (isLeft(parsedRule)) {
    const errors = unwrapEither(parsedRule)
    expect(errors.length).toEqual(1)
    expect(errors[0].message).toEqual('Rule Invalid input: expected string, received undefined: Field condition')
  }
})

test('Can return multiple errors if rule JSON is invalid', () => {
  let invalidRuleJSON = JSON.parse(ruleJSON)
  delete invalidRuleJSON.condition // Remove condition to make it invalid
  delete invalidRuleJSON.callingFunction // Remove callingFunction to make it invalid
  const parsedRule = validateRuleJSON(JSON.stringify(invalidRuleJSON))
  expect(isLeft(parsedRule)).toBeTruthy()
  if (isLeft(parsedRule)) {
    const errors = unwrapEither(parsedRule)
    expect(errors.length).toEqual(2)
    expect(errors[0].message).toEqual('Rule Invalid input: expected string, received undefined: Field condition')
    expect(errors[1].message).toEqual('Rule Invalid input: expected string, received undefined: Field callingFunction')
  }
})

test('Can validate foreign call JSON', () => {
  const parsedFC = validateForeignCallJSON(fcJSON)
  expect(isRight(parsedFC)).toBeTruthy()
  if (isRight(parsedFC)) {
    const fc = unwrapEither(parsedFC)

    expect(fc.valuesToPass).toEqual(JSON.parse(fcJSON).valuesToPass)
  }
})

test('Can catch all missing required fields in foreign call JSON', () => {
  const parsedFC = validateForeignCallJSON('{}')
  expect(isLeft(parsedFC)).toBeTruthy()
  if (isLeft(parsedFC)) {
    const errors = unwrapEither(parsedFC)

    expect(errors.length).toEqual(7)
    expect(errors[0].message).toEqual('Foreign Call Invalid input: expected string, received undefined: Field name')
    expect(errors[1].message).toEqual('Foreign Call Invalid input: expected string, received undefined: Field function')
    expect(errors[2].message).toEqual('Foreign Call Invalid input: expected string, received undefined: Field address')
    expect(errors[3].message).toEqual('Foreign Call Unsupported return type: Field returnType')
    expect(errors[4].message).toEqual(
      'Foreign Call Invalid input: expected string, received undefined: Field valuesToPass'
    )
    expect(errors[5].message).toEqual(
      'Foreign Call Invalid input: expected string, received undefined: Field mappedTrackerKeyValues'
    )
    expect(errors[6].message).toEqual(
      'Foreign Call Invalid input: expected string, received undefined: Field callingFunction'
    )
  }
})

test('Can catch all wrong inputs for fields in foreign call JSON', () => {
  const invalidJSON = `{
					"name": 1,
					"address": 1,
					"function": 1,
					"returnType": 1,
					"valuesToPass": 1,
          "mappedTrackerKeyValues": 1,
					"callingFunction": 1
					}`
  const parsedFC = validateForeignCallJSON(invalidJSON)
  expect(isLeft(parsedFC)).toBeTruthy()
  if (isLeft(parsedFC)) {
    const errors = unwrapEither(parsedFC)

    expect(errors.length).toEqual(7)
    expect(errors[0].message).toEqual('Foreign Call Invalid input: expected string, received number: Field name')
    expect(errors[1].message).toEqual('Foreign Call Invalid input: expected string, received number: Field function')
    expect(errors[2].message).toEqual('Foreign Call Invalid input: expected string, received number: Field address')
    expect(errors[3].message).toEqual('Foreign Call Unsupported return type: Field returnType')
    expect(errors[4].message).toEqual(
      'Foreign Call Invalid input: expected string, received number: Field valuesToPass'
    )
    expect(errors[5].message).toEqual(
      'Foreign Call Invalid input: expected string, received number: Field mappedTrackerKeyValues'
    )
    expect(errors[6].message).toEqual(
      'Foreign Call Invalid input: expected string, received number: Field callingFunction'
    )
  }
})

test('Can catch foreign call function with no parameters', () => {
  const invalidNoParamsFC = `{
    "name": "NoParamCall",
    "address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
    "function": "testSig()",
    "returnType": "uint256",
    "valuesToPass": "",
    "mappedTrackerKeyValues": "",
    "callingFunction": "transfer(address to, uint256 value)"
  }`
  const parsed = validateForeignCallJSON(invalidNoParamsFC)
  // Empty params should be valid
  expect(isRight(parsed)).toBeTruthy()
})

test('Fails validation when function has undefined parameters (no parens)', () => {
  const invalidNoParens = `{
    "name": "BadCall",
    "address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
    "function": "testSig",
    "returnType": "uint256",
    "valuesToPass": "",
    "mappedTrackerKeyValues": "",
    "callingFunction": "transfer(address to, uint256 value)"
  }`
  const parsed = validateForeignCallJSON(invalidNoParens)
  expect(isLeft(parsed)).toBeTruthy()
  if (isLeft(parsed)) {
    const errors = unwrapEither(parsed)
    expect(errors[0].message).toEqual('Foreign Call Unsupported argument type: Field function')
  }
})

test('Can catch foreign call function with no parenthesis', () => {
  const invalidNoParamsFC = `{
    "name": "NoParamCall",
    "address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
    "function": "testSig",
    "returnType": "uint256",
    "valuesToPass": "",
    "mappedTrackerKeyValues": "",
    "callingFunction": "transfer(address to, uint256 value)"
  }`
  const parsed = validateForeignCallJSON(invalidNoParamsFC)
  expect(isLeft(parsed)).toBeTruthy()
  if (isLeft(parsed)) {
    const errors = unwrapEither(parsed)
    expect(errors[0].message).toEqual('Foreign Call Unsupported argument type: Field function')
  }
})

test('Can return errors if foreign call JSON is invalid', () => {
  const invalidFCJSON = JSON.parse(fcJSON)
  invalidFCJSON.name = 100 // Change name to a number to make it invalid
  const parsedFC = validateForeignCallJSON(JSON.stringify(invalidFCJSON))
  expect(isLeft(parsedFC)).toBeTruthy()
  if (isLeft(parsedFC)) {
    const errors = unwrapEither(parsedFC)
    expect(errors.length).toEqual(1)
    expect(errors[0].message).toEqual('Foreign Call Invalid input: expected string, received number: Field name')
  }
})

test('Can return multiple errors if foreign call JSON is invalid', () => {
  const invalidFCJSON = JSON.parse(fcJSON)
  invalidFCJSON.name = 100 // Change name to a number to make it invalid
  delete invalidFCJSON.valuesToPass // Remove valuesToPass to make it invalid
  const parsedFC = validateForeignCallJSON(JSON.stringify(invalidFCJSON))
  expect(isLeft(parsedFC)).toBeTruthy()
  if (isLeft(parsedFC)) {
    const errors = unwrapEither(parsedFC)
    expect(errors.length).toEqual(2)
    expect(errors[0].message).toEqual('Foreign Call Invalid input: expected string, received number: Field name')
    expect(errors[1].message).toEqual(
      'Foreign Call Invalid input: expected string, received undefined: Field valuesToPass'
    )
  }
})

test('Can validate foreign call JSON with void return type', () => {
  const fcWithVoidReturn = `{
    "name": "VoidReturnCall",
    "address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
    "function": "testSig(uint256)",
    "returnType": "void",
    "valuesToPass": "value",
    "mappedTrackerKeyValues": "",
    "callingFunction": "transfer(address to, uint256 value)"
  }`
  const parsed = validateForeignCallJSON(fcWithVoidReturn)
  expect(isRight(parsed)).toBeTruthy()
  if (isRight(parsed)) {
    const fc = unwrapEither(parsed)
    expect(fc.returnType).toEqual('void')
  }
})

test('Can validate tracker JSON', () => {
  const parsedJSON = JSON.parse(trackerJSON)
  const parsedTracker = validateTrackerJSON(trackerJSON)
  expect(isRight(parsedTracker)).toBeTruthy()
  if (isRight(parsedTracker)) {
    const tracker = unwrapEither(parsedTracker)

    expect(tracker.name).toEqual(parsedJSON.name)
  }
})

test('Can validate array tracker JSON', () => {
  const parsedJSON = JSON.parse(trackerJSON)
  const parsedTracker = validateTrackerJSON(trackerJSON)
  expect(isRight(parsedTracker)).toBeTruthy()
  if (isRight(parsedTracker)) {
    const tracker = unwrapEither(parsedTracker)

    expect(tracker.name).toEqual(parsedJSON.name)
  }
})

test('Can catch all missing required fields in tracker JSON', () => {
  const parsedTracker = validateTrackerJSON('{}')
  expect(isLeft(parsedTracker)).toBeTruthy()
  if (isLeft(parsedTracker)) {
    const errors = unwrapEither(parsedTracker)

    expect(errors.length).toEqual(3)
    expect(errors[0].message).toEqual('Tracker Invalid input: expected string, received undefined: Field name')
    expect(errors[1].message).toEqual('Tracker Unsupported type: Field type')
    expect(errors[2].message).toEqual('Tracker Invalid input: Field initialValue')
  }
})

test('Can catch all wrong inputs for fields in tracker JSON', () => {
  const invalidJSON = `{
							"name": 1,
							"type": 1,
							"initialValue": 1
					}`
  const parsedTracker = validateTrackerJSON(invalidJSON)
  expect(isLeft(parsedTracker)).toBeTruthy()
  if (isLeft(parsedTracker)) {
    const errors = unwrapEither(parsedTracker)

    expect(errors.length).toEqual(3)
    expect(errors[0].message).toEqual('Tracker Invalid input: expected string, received number: Field name')
    expect(errors[1].message).toEqual('Tracker Unsupported type: Field type')
    expect(errors[2].message).toEqual('Tracker Invalid input: Field initialValue')
  }
})

test('Can return error if tracker JSON is invalid', () => {
  const invalidTrackerJSON = JSON.parse(trackerJSON)
  invalidTrackerJSON.name = 23 // Change name to a number to make it invalid
  const parsedTracker = validateTrackerJSON(JSON.stringify(invalidTrackerJSON))
  expect(isLeft(parsedTracker)).toBeTruthy()
  if (isLeft(parsedTracker)) {
    const errors = unwrapEither(parsedTracker)
    expect(errors.length).toEqual(1)
    expect(errors[0].message).toEqual('Tracker Invalid input: expected string, received number: Field name')
  }
})

test('Can return multiple errors if tracker JSON is invalid', () => {
  const invalidTrackerJSON = JSON.parse(trackerJSON)
  invalidTrackerJSON.name = 23 // Change name to a number to make it invalid
  delete invalidTrackerJSON.initialValue // Remove initialValue to make it invalid
  const parsedTracker = validateTrackerJSON(JSON.stringify(invalidTrackerJSON))
  expect(isLeft(parsedTracker)).toBeTruthy()
  if (isLeft(parsedTracker)) {
    const errors = unwrapEither(parsedTracker)
    expect(errors.length).toEqual(2)
    expect(errors[0].message).toEqual('Tracker Invalid input: expected string, received number: Field name')
    expect(errors[1].message).toEqual('Tracker Invalid input: Field initialValue')
  }
})

test('Can validate mapped tracker JSON', () => {
  const parsedJSON = JSON.parse(mappedTrackerJSON)
  const parsedTracker = validateMappedTrackerJSON(mappedTrackerJSON)
  expect(isRight(parsedTracker)).toBeTruthy()
  if (isRight(parsedTracker)) {
    const tracker = unwrapEither(parsedTracker)

    expect(tracker.name).toEqual(parsedJSON.name)
  }
})

test('Can validate policy JSON', () => {
  const parsedPolicy = validatePolicyJSON(policyJSON)
  expect(isRight(parsedPolicy)).toBeTruthy()
  if (isRight(parsedPolicy)) {
    const policy = unwrapEither(parsedPolicy)
    expect(policy.Policy).toEqual(JSON.parse(policyJSON).Policy)
  }
})

test('Can validate policy JSON with missing name and description', () => {
  const defaultValue = ''
  const parsedInput = JSON.parse(policyJSON)
  delete parsedInput.Policy
  delete parsedInput.Description
  const parsedPolicy = validatePolicyJSON(JSON.stringify(parsedInput))
  expect(isRight(parsedPolicy)).toBeTruthy()
  if (isRight(parsedPolicy)) {
    const policy = unwrapEither(parsedPolicy)
    expect(policy.Policy).toEqual(defaultValue)
  }
})

test('Can validate policy JSON with missing name and description undefined', () => {
  const defaultValue = ''
  const parsedInput = JSON.parse(policyJSON)
  parsedInput.Policy = undefined
  parsedInput.Description = undefined
  const parsedPolicy = validatePolicyJSON(JSON.stringify(parsedInput))
  expect(isRight(parsedPolicy)).toBeTruthy()
  if (isRight(parsedPolicy)) {
    const policy = unwrapEither(parsedPolicy)
    expect(policy.Policy).toEqual(defaultValue)
  }
})

test('Can validate full policy JSON', () => {
  const parsedPolicy = validatePolicyJSON(policyJSONFull)
  expect(isRight(parsedPolicy)).toBeTruthy()
  if (isRight(parsedPolicy)) {
    const policy = unwrapEither(parsedPolicy)
    expect(policy.Policy).toEqual(JSON.parse(policyJSONFull).Policy)
  }
})

test('Can catch missing calling function in foreign call in policy JSON', () => {
  const parsedInput = JSON.parse(policyJSONFull)
  parsedInput.ForeignCalls[0].callingFunction = 'transferTo(uint256 value)'
  const parsedPolicy = validatePolicyJSON(JSON.stringify(parsedInput))
  expect(isRight(parsedPolicy)).toBeFalsy()
  if (isLeft(parsedPolicy)) {
    const errors = unwrapEither(parsedPolicy)
    expect(errors[0].message).toEqual('Policy Invalid reference call')
  }
})

test('Can catch missing foreign call in condition in policy JSON', () => {
  const parsedInput = JSON.parse(policyJSONFull)
  parsedInput.Rules[0].condition =
    "FC:SimpleForeignCallMissing > 500 AND (TR:SimpleStringTracker == 'test' OR TR:SimpleMappedTracker(to) > 100)"
  const parsedPolicy = validatePolicyJSON(JSON.stringify(parsedInput))
  expect(isRight(parsedPolicy)).toBeFalsy()
  if (isLeft(parsedPolicy)) {
    const errors = unwrapEither(parsedPolicy)
    expect(errors[0].message).toEqual('Policy Invalid reference call')
  }
})

test('Can catch missing tracker in condition in policy JSON', () => {
  const parsedInput = JSON.parse(policyJSONFull)
  parsedInput.Rules[0].condition =
    "FC:SimpleForeignCall > 500 AND (TR:SimpleStringTrackerMissing == 'test' OR TR:SimpleMappedTracker(to) > 100)"
  const parsedPolicy = validatePolicyJSON(JSON.stringify(parsedInput))
  expect(isRight(parsedPolicy)).toBeFalsy()
  if (isLeft(parsedPolicy)) {
    const errors = unwrapEither(parsedPolicy)
    expect(errors[0].message).toEqual('Policy Invalid reference call')
  }
})

test('Can catch missing mapped tracker in condition in policy JSON', () => {
  const parsedInput = JSON.parse(policyJSONFull)
  parsedInput.Rules[0].condition =
    "FC:SimpleForeignCall > 500 AND (TR:SimpleStringTracker == 'test' OR TR:SimpleMappedTrackerMissing(to) > 100)"
  const parsedPolicy = validatePolicyJSON(JSON.stringify(parsedInput))
  expect(isRight(parsedPolicy)).toBeFalsy()
  if (isLeft(parsedPolicy)) {
    const errors = unwrapEither(parsedPolicy)
    expect(errors[0].message).toEqual('Policy Invalid reference call')
  }
})

test('Can catch missing calling function encoded value in foreign call valueToPass in policy JSON', () => {
  const parsedInput = JSON.parse(policyJSONFull)
  parsedInput.ForeignCalls[0].valuesToPass = 'transferTo'
  const parsedPolicy = validatePolicyJSON(JSON.stringify(parsedInput))
  expect(isRight(parsedPolicy)).toBeFalsy()
  if (isLeft(parsedPolicy)) {
    const errors = unwrapEither(parsedPolicy)
    expect(errors[0].message).toEqual('Policy Invalid reference call')
  }
})

test('Can catch all missing required fields in policy JSON', () => {
  const parsedPolicy = validatePolicyJSON('{}')
  expect(isLeft(parsedPolicy)).toBeTruthy()
  if (isLeft(parsedPolicy)) {
    const errors = unwrapEither(parsedPolicy)

    expect(errors.length).toEqual(6)
    expect(errors[0].message).toEqual('Policy Invalid input: expected string, received undefined: Field PolicyType')
    expect(errors[1].message).toEqual(
      'Policy Invalid input: expected array, received undefined: Field CallingFunctions'
    )
    expect(errors[2].message).toEqual('Policy Invalid input: expected array, received undefined: Field ForeignCalls')
    expect(errors[3].message).toEqual('Policy Invalid input: expected array, received undefined: Field Trackers')
    expect(errors[4].message).toEqual('Policy Invalid input: expected array, received undefined: Field MappedTrackers')
    expect(errors[5].message).toEqual('Policy Invalid input: expected array, received undefined: Field Rules')
  }
})

test('Can catch all wrong inputs for fields in policy JSON', () => {
  const invalidJSON = `
		{
		"Policy": 1,
    "Description": "Test",
		"PolicyType": 1,
		"CallingFunctions": "mop",
		"ForeignCalls": "foo",
		"Trackers": "bar",
		"Rules": "baz"
		}`
  const parsedPolicy = validatePolicyJSON(invalidJSON)
  expect(isLeft(parsedPolicy)).toBeTruthy()
  if (isLeft(parsedPolicy)) {
    const errors = unwrapEither(parsedPolicy)

    expect(errors.length).toEqual(7)
    expect(errors[0].message).toEqual('Policy Invalid input: expected string, received number: Field Policy')
    expect(errors[1].message).toEqual('Policy Invalid input: expected string, received number: Field PolicyType')
    expect(errors[2].message).toEqual('Policy Invalid input: expected array, received string: Field CallingFunctions')
    expect(errors[3].message).toEqual('Policy Invalid input: expected array, received string: Field ForeignCalls')
    expect(errors[4].message).toEqual('Policy Invalid input: expected array, received string: Field Trackers')
    expect(errors[6].message).toEqual('Policy Invalid input: expected array, received string: Field Rules')
  }
})

test('Can return error if policy JSON is invalid', () => {
  const invalidPolicyJSON = JSON.parse(policyJSON)
  invalidPolicyJSON.Policy = 123 // Change Policy to a number to make it invalid
  const parsedPolicy = validatePolicyJSON(JSON.stringify(invalidPolicyJSON))
  expect(isLeft(parsedPolicy)).toBeTruthy()
  if (isLeft(parsedPolicy)) {
    const errors = unwrapEither(parsedPolicy)
    expect(errors[0].message).toEqual('Policy Invalid input: expected string, received number: Field Policy')
  }
})

test('Can return multiple errors if policy JSON is invalid', () => {
  const invalidPolicyJSON = JSON.parse(policyJSON)
  invalidPolicyJSON.Policy = 123 // Change Policy to a number to make it invalid
  delete invalidPolicyJSON.PolicyType // Remove PolicyType to make it invalid
  const parsedPolicy = validatePolicyJSON(JSON.stringify(invalidPolicyJSON))
  expect(isLeft(parsedPolicy)).toBeTruthy()
  if (isLeft(parsedPolicy)) {
    const errors = unwrapEither(parsedPolicy)
    expect(errors[0].message).toEqual('Policy Invalid input: expected string, received number: Field Policy')
    expect(errors[1].message).toEqual('Policy Invalid input: expected string, received undefined: Field PolicyType')
  }
})

test('Tests Foreign Call  incorrect format for address', () => {
  var str = `{
		"name": "Simple Foreign Call",
		"address": "test",
		"function": "testSig(address,string,uint256)",
		"returnType": "uint256",
		"valuesToPass": "0, 1, 2"
		}`

  var retVal = unwrapEither(validateForeignCallJSON(str)) as RulesError[]
  expect(retVal[0].message).toEqual('Foreign Call Address is invalid: Field address')
})

test('Tests Foreign Call unsupported return type', () => {
  var str = `{
		"name": "Simple Foreign Call",
		"address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
		"function": "testSig(address,string,uint256)",
		"returnType": "notAnInt",
		"valuesToPass": "0, 1, 2"
		}`
  var retVal = unwrapEither(validateForeignCallJSON(str)) as RulesError[]
  expect(retVal[0].message).toEqual('Foreign Call Unsupported return type: Field returnType')
})

test('Tests Foreign Call unsupported argument type', () => {
  var str = `{
		"name": "Simple Foreign Call",
		"address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
		"function": "testSig(address,notAnInt,uint256)",
		"returnType": "uint256",
		"valuesToPass": "0, 1, 2"
		}`

  var retVal = unwrapEither(validateForeignCallJSON(str)) as RulesError[]
  expect(retVal[0].message).toEqual('Foreign Call Unsupported argument type: Field function')
})

test('Tests Tracker unsupported type', () => {
  var str = `{
				"name": "Simple String Tracker",
				"type": "book",
				"initialValue": "test"
				}`
  var retVal = unwrapEither(validateTrackerJSON(str)) as RulesError[]
  expect(retVal[0].message).toEqual('Tracker Unsupported type: Field type')
})

test('Tests can safely parse json', () => {
  const str = `{
				"type": 1,
				"name": "foo"
				}`
  const retVal = safeParseJson(str)
  expect(isRight(retVal)).toBeTruthy()
  const parsed = unwrapEither(retVal) as any
  expect(parsed.type).toEqual(1)
  expect(parsed.name).toEqual('foo')
})

test('Tests can return error when parsing invalid json', () => {
  const str = `{
				"type": 1,
				"name": "foo",
				}`
  const retVal = safeParseJson(str)
  expect(isLeft(retVal)).toBeTruthy()
  const parsed = unwrapEither(retVal) as RulesError[]
  expect(parsed[0].message).toEqual('Failed to parse JSON')
})

test('Tests formatParenConditionGroups', () => {
  const str = `FC:GetValue > 500 AND (FC:GetValue < 100 OR FC:GetValue > 200)`
  const groups = formatParenConditionGroups(str)
  expect(groups.finalGroups.length).toEqual(2)
})

test('Tests formatParenConditionGroups nested second group', () => {
  const str = `FC:GetValue > 500 AND (FC:GetValue < 100 OR (FC:GetValue > 200 AND TR:TestTracker > 100)) `
  const groups = formatParenConditionGroups(str)
  expect(groups.finalGroups.length).toEqual(3)
})

test('Tests formatParenConditionGroups single group', () => {
  const str = `FC:GetValue > 500`
  const groups = formatParenConditionGroups(str)
  expect(groups.finalGroups.length).toEqual(1)
})

test('Tests formatParenConditionGroups nested first group', () => {
  const str = `(FC:GetValue < 100 OR (FC:GetValue > 200 AND TR:TestTracker > 100)) AND FC:GetValue > 500`
  const groups = formatParenConditionGroups(str)
  expect(groups.finalGroups.length).toEqual(3)
})

test('Tests formatParenConditionGroups nested both groups', () => {
  const str = `(FC:GetValue < 100 OR (FC:GetValue > 200 AND TR:TestTracker > 100)) AND (TR:TestTracker > 400 AND (FC:GetValue > 500 AND FC:GetRole == "Admin"))`
  const groups = formatParenConditionGroups(str)
  expect(groups.finalGroups.length).toEqual(5)
})

test('Tests formatParenConditionGroups catches missing paren', () => {
  const str = `(FC:GetValue < 100 OR (FC:GetValue > 200 AND TR:TestTracker > 100) AND FC:GetValue > 500`
  const isValid = validateCondition(str)

  expect(isValid).toBeFalsy()
})

test('Tests formatParenConditionGroups catches multiple AND operators', () => {
  const str = `(FC:GetValue < 100 OR (FC:GetValue > 200 AND TR:TestTracker > 100)) AND FC:GetValue > 500 AND FC:GetScore > 100`
  const isValid = validateCondition(str)

  expect(isValid).toBeFalsy()
})

test('Tests formatParenConditionGroups catches multiple OR operators', () => {
  const str = `(FC:GetValue < 100 OR (FC:GetValue > 200 AND TR:TestTracker > 100)) OR FC:GetValue > 500 OR FC:GetScore > 100`
  const isValid = validateCondition(str)

  expect(isValid).toBeFalsy()
})

test('Tests formatPrenConditionGroups catches AND and OR operators', () => {
  const str = `(FC:GetValue < 100 OR (FC:GetValue > 200 AND TR:TestTracker > 100)) OR FC:GetValue > 500 OR FC:GetScore > 100`
  const isValid = validateCondition(str)

  expect(isValid).toBeFalsy()
})

const ADDRESS_ARRAY = [
  '0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC',
  '0xdadB0d80178819F2319190D340ce9A924f783711',
  '0x870585E3AF9dA7ff5dcd8f897EA0756f60F69cc1',
]

const BYTES_ARRAY = ['0x1234', '0x5678', '0x7890']

const STRING_ARRAY = ['test', 'an', 'arrayTracker']

const UINT_KEYS = ['1', '2', '3']

test('Tests can validate all Tracker types', () => {
  const pTypesTestInputs = [
    {
      pType: 'address',
      success: '0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC',
      failure: 'test',
    },
    {
      pType: 'string',
      success: 'test',
      failure: 123,
    },
    {
      pType: 'uint256',
      success: '123',
      failure: 'test',
    },
    {
      pType: 'bool',
      success: 'true',
      failure: 123,
    },
    {
      pType: 'bytes',
      success: '0x1234',
      failure: 123,
    },
    {
      pType: 'address[]',
      success: ADDRESS_ARRAY,
      failure: ['0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC', '0xdadB0d80178819F2319190D340ce9A924f783711', 'test'],
    },
    {
      pType: 'uint256[]',
      success: ['123', '456', '78'],
      failure: ['123', '45', 'test'],
    },
    {
      pType: 'bool[]',
      success: ['true', 'false', 'true'],
      failure: ['true', 'false', null],
    },
    {
      pType: 'string[]',
      success: STRING_ARRAY,
      failure: ['0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC', '0xdadB0d80178819F2319190D340ce9A924f783711', 123],
    },
    {
      pType: 'bytes[]',
      success: BYTES_ARRAY,
      failure: ['0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC', '0xdadB0d80178819F2319190D340ce9A924f783711', 123],
    },
  ]
  const testTracker = JSON.parse(trackerJSON)

  pTypesTestInputs.forEach((input) => {
    testTracker.type = input.pType
    testTracker.initialValue = input.success
    const trackerJSONSuccess = JSON.stringify(testTracker)
    const parsedTrackerSuccess = validateTrackerJSON(trackerJSONSuccess)

    expect(
      isRight(parsedTrackerSuccess),
      `Tracker Validation Failed for type: ${input.pType} and initial value ${input.success}`
    ).toBeTruthy()

    testTracker.type = input.pType
    testTracker.initialValue = input.failure
    const trackerJSONFailure = JSON.stringify(testTracker)
    const parsedTrackerFailure = validateTrackerJSON(trackerJSONFailure)

    expect(
      isLeft(parsedTrackerFailure),
      `Tracker Validation Passed for type: ${input.pType} and initial value ${input.failure}`
    ).toBeTruthy()
  })
})

test('Tests can validate all Mapped Tracker initial value types', () => {
  const pTypesTestInputs = [
    {
      pType: 'address',
      success: [UINT_KEYS, ADDRESS_ARRAY],
      failure: [['1'], ['test']],
    },
    {
      pType: 'string',
      success: [UINT_KEYS, STRING_ARRAY],
      failure: [
        ['1', '2', '3'],
        ['test', 'an', 123],
      ],
    },
    {
      pType: 'uint256',
      success: [UINT_KEYS, ['123', '456', '789']],
      failure: [UINT_KEYS, ['1', '2', 'test']],
    },
    {
      pType: 'bool',
      success: [UINT_KEYS, ['true', 'false', 'false']],
      failure: [UINT_KEYS, ['false', 'true', null]],
    },
    {
      pType: 'bytes',
      success: [UINT_KEYS, BYTES_ARRAY],
      failure: [UINT_KEYS, ['0x1234', '0x5678', 123]],
    },
    {
      pType: 'address[]',
      success: [UINT_KEYS, [ADDRESS_ARRAY, ADDRESS_ARRAY, ADDRESS_ARRAY]],
      failure: [
        UINT_KEYS,
        [
          ADDRESS_ARRAY,
          ADDRESS_ARRAY,
          ['0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC', '0xdadB0d80178819F2319190D340ce9A924f783711', 'test'],
        ],
      ],
    },
    {
      pType: 'uint256[]',
      success: [
        UINT_KEYS,
        [
          ['123', '456', '78'],
          ['1293', '4656', '278'],
          ['23', '45', '9'],
        ],
      ],
      failure: [
        UINT_KEYS,
        [
          ['123', '456', '78'],
          ['1293', '4656', '278'],
          ['23', '45', 'test'],
        ],
      ],
    },
    {
      pType: 'bool[]',
      success: [
        UINT_KEYS,
        [
          ['true', 'false', 'true'],
          ['true', 'false', 'true'],
          ['true', 'false', 'true'],
        ],
      ],
      failure: [
        UINT_KEYS,
        [
          ['true', 'false', 'true'],
          ['true', 'false', 'true'],
          ['true', 'false', null],
        ],
      ],
    },
    {
      pType: 'string[]',
      success: [UINT_KEYS, [STRING_ARRAY, STRING_ARRAY, STRING_ARRAY]],
      failure: [UINT_KEYS, [STRING_ARRAY, STRING_ARRAY, ['test', 'an', 123]]],
    },
    {
      pType: 'bytes[]',
      success: [UINT_KEYS, [BYTES_ARRAY, BYTES_ARRAY, BYTES_ARRAY]],
      failure: [UINT_KEYS, [BYTES_ARRAY, BYTES_ARRAY, ['0x1234', '0x5678', 12]]],
    },
  ]
  const testTracker = JSON.parse(mappedTrackerJSON)

  pTypesTestInputs.forEach((input) => {
    testTracker.valueType = input.pType
    testTracker.initialKeys = input.success[0]
    testTracker.initialValues = input.success[1]
    const trackerJSONSuccess = JSON.stringify(testTracker)
    const parsedTrackerSuccess = validateMappedTrackerJSON(trackerJSONSuccess)

    expect(
      isRight(parsedTrackerSuccess),
      `Tracker Validation Failed for type: ${input.pType} and initial value ${input.success}`
    ).toBeTruthy()

    testTracker.valueType = input.pType
    testTracker.initialKeys = input.failure[0]
    testTracker.initialValues = input.failure[1]
    const trackerJSONFailure = JSON.stringify(testTracker)
    const parsedTrackerFailure = validateMappedTrackerJSON(trackerJSONFailure)

    expect(
      isLeft(parsedTrackerFailure),
      `Tracker Validation Passed for type: ${input.pType} and initial value ${input.failure}`
    ).toBeTruthy()
  })
})

test('Tests can validate all Mapped Tracker initial key types', () => {
  const pTypesTestInputs = [
    {
      pType: 'address',
      success: [ADDRESS_ARRAY, ['123', '456', '78']],
      failure: [
        ['0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC', '0xdadB0d80178819F2319190D340ce9A924f783711', '1'],
        ['123', '456', '78'],
      ],
    },
    {
      pType: 'string',
      success: [STRING_ARRAY, ['123', '456', '78']],
      failure: [
        ['test', 'an', 123],
        ['123', '456', '78'],
      ],
    },
    {
      pType: 'uint256',
      success: [
        ['1', '23', '67'],
        ['123', '456', '78'],
      ],
      failure: [
        ['1', '23', 'test'],
        ['123', '456', '78'],
      ],
    },
    {
      pType: 'bool',
      success: [
        ['true', 'false'],
        ['123', '456'],
      ],
      failure: [
        ['true', null],
        ['123', '78'],
      ],
    },
    {
      pType: 'bytes',
      success: [BYTES_ARRAY, ['123', '456', '78']],
      failure: [
        ['0x1234', '0x5678', 1],
        ['123', '456', '78'],
      ],
    },
  ]
  const testTracker = JSON.parse(mappedTrackerJSON)

  pTypesTestInputs.forEach((input) => {
    testTracker.keyType = input.pType
    testTracker.initialKeys = input.success[0]
    testTracker.initialValues = input.success[1]
    const trackerJSONSuccess = JSON.stringify(testTracker)
    const parsedTrackerSuccess = validateMappedTrackerJSON(trackerJSONSuccess)

    expect(
      isRight(parsedTrackerSuccess),
      `Mapped Tracker Validation Failed for type: ${input.pType} and initial key ${input.success}`
    ).toBeTruthy()

    testTracker.keyType = input.pType
    testTracker.initialKeys = input.failure[0]
    testTracker.initialValues = input.failure[1]
    const trackerJSONFailure = JSON.stringify(testTracker)
    const parsedTrackerFailure = validateMappedTrackerJSON(trackerJSONFailure)

    expect(
      isLeft(parsedTrackerFailure),
      `Mapped Tracker Validation Passed for type: ${input.pType} and initial key ${input.failure}`
    ).toBeTruthy()
  })
})

test('Tests can catch Mapped Tracker invalid key type', () => {
  const pTypesTestInputs = ['address[]', 'string[]', 'uint256[]', 'bool[]', 'bytes[]']
  const testTracker = JSON.parse(mappedTrackerJSON)

  pTypesTestInputs.forEach((input) => {
    testTracker.keyType = input
    const trackerJSONFailure = JSON.stringify(testTracker)
    const parsedTrackerFailure = validateMappedTrackerJSON(trackerJSONFailure)

    expect(isLeft(parsedTrackerFailure), `Mapped Tracker Validation Passed for keytype: ${input}`).toBeTruthy()
  })
})

test('Tests can catch all unequal mapped tracker initial keys and values length', () => {
  const testTracker = JSON.parse(mappedTrackerJSON)

  testTracker.initialKeys.push('100')

  const parsedTracker = validateMappedTrackerJSON(JSON.stringify(testTracker))

  expect(
    isLeft(parsedTracker),
    `Mapped Tracker Validation Passed for unequal initial keys and values length`
  ).toBeTruthy()
})

test('Tests can catch mapped tracker duplicate keys', () => {
  const testTracker = JSON.parse(mappedTrackerJSON)

  testTracker.initialKeys.push('1')
  testTracker.initialValues.push('100')

  const parsedTracker = validateMappedTrackerJSON(JSON.stringify(testTracker))
  expect(isLeft(parsedTracker), `Mapped Tracker Validation Passed with duplicate keys`).toBeTruthy()
})

test('Allows using any parameter name from calling function in valuesToPass', () => {
  const input = JSON.parse(policyJSONFull)
  // Ensure the first foreign call can reference the second parameter name 'value'
  input.ForeignCalls[0].valuesToPass = 'value'
  const parsed = validatePolicyJSON(JSON.stringify(input))
  expect(isRight(parsed)).toBeTruthy()
})

test('Allows referencing third parameter from calling function in valuesToPass', () => {
  const policy = {
    Policy: 'Param Index Policy',
    Description: 'Checks third param in valuesToPass',
    PolicyType: 'open',
    CallingFunctions: [
      {
        name: 'transfer(address to, uint256 value, address spender)',
        functionSignature: 'transfer(address to, uint256 value, address spender)',
        encodedValues: 'address to, uint256 value, address spender',
      },
    ],
    ForeignCalls: [
      {
        name: 'UseSpender',
        address: '0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC',
        function: 'testSig(address)',
        returnType: 'uint256',
        valuesToPass: 'spender',
        mappedTrackerKeyValues: '',
        callingFunction: 'transfer(address to, uint256 value, address spender)',
      },
    ],
    Trackers: [
      {
        name: 'SimpleString',
        type: 'string',
        initialValue: 'x',
      },
    ],
    MappedTrackers: [],
    Rules: [
      {
        Name: 'R',
        Description: 'D',
        condition: '1 == 1',
        positiveEffects: ['emit E'],
        negativeEffects: [],
        callingFunction: 'transfer(address to, uint256 value, address spender)',
      },
    ],
  }
  const parsed = validatePolicyJSON(JSON.stringify(policy))
  expect(isRight(parsed)).toBeTruthy()
})

test('Validates mapped and unmapped trackers in valuesToPass with mappedTrackerKeyValues (including TRU)', () => {
  const policy = {
    Policy: 'Tracker ValuesToPass Policy',
    Description: 'Checks TR and TRU mapped/unmapped in valuesToPass',
    PolicyType: 'open',
    CallingFunctions: [
      {
        name: 'transfer(address to, uint256 value)',
        functionSignature: 'transfer(address to, uint256 value)',
        encodedValues: 'address to, uint256 value',
      },
    ],
    ForeignCalls: [
      {
        name: 'UseTrackers',
        address: '0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC',
        function: 'testSig(string,uint256,string)',
        returnType: 'uint256',
        valuesToPass: 'TR:SimpleString, TR:SimpleMapped(to)',
        mappedTrackerKeyValues: 'to',
        callingFunction: 'transfer(address to, uint256 value)',
      },
    ],
    Trackers: [{ name: 'SimpleString', type: 'string', initialValue: 'hello' }],
    MappedTrackers: [
      {
        name: 'SimpleMapped',
        keyType: 'address',
        valueType: 'uint256',
        initialKeys: ['0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC'],
        initialValues: ['1'],
      },
    ],
    Rules: [
      {
        Name: 'R',
        Description: 'D',
        condition: '1 == 1',
        positiveEffects: ['emit E'],
        negativeEffects: [],
        callingFunction: 'transfer(address to, uint256 value)',
      },
    ],
  }
  const parsed = validatePolicyJSON(JSON.stringify(policy))
  expect(isRight(parsed)).toBeTruthy()
})

test("Policy JSON validation should fail when some rules have order and others don't", () => {
  const policy = {
    Policy: "Rule Ordering Test Policy",
    Description: "Test mixed rule ordering",
    PolicyType: "open",
    CallingFunctions: [
      {
        name: "transfer(address to, uint256 value)",
        functionSignature: "transfer(address to, uint256 value)",
        encodedValues: "address to, uint256 value",
      },
    ],
    ForeignCalls: [],
    Trackers: [],
    MappedTrackers: [],
    Rules: [
      {
        Name: "Rule A",
        Description: "First rule with order",
        condition: "1 == 1",
        positiveEffects: ["emit Success"],
        negativeEffects: [],
        callingFunction: "transfer(address to, uint256 value)",
        order: 1,
      },
      {
        Name: "Rule B",
        Description: "Second rule without order",
        condition: "2 == 2",
        positiveEffects: ["emit Success"],
        negativeEffects: [],
        callingFunction: "transfer(address to, uint256 value)",
        // No order field - this should cause validation to fail
      },
    ],
  };
  
  const parsed = validatePolicyJSON(JSON.stringify(policy));
  expect(isLeft(parsed)).toBeTruthy();
  
  if (isLeft(parsed)) {
    const errors = unwrapEither(parsed);
    expect(errors.some(err => err.message.includes('Rule ordering validation failed'))).toBeTruthy();
  }
});

test("Policy JSON validation should pass when all rules have order", () => {
  const policy = {
    Policy: "Rule Ordering Test Policy",
    Description: "Test all rules with ordering",
    PolicyType: "open",
    CallingFunctions: [
      {
        name: "transfer(address to, uint256 value)",
        functionSignature: "transfer(address to, uint256 value)",
        encodedValues: "address to, uint256 value",
      },
    ],
    ForeignCalls: [],
    Trackers: [],
    MappedTrackers: [],
    Rules: [
      {
        Name: "Rule A",
        Description: "First rule",
        condition: "1 == 1",
        positiveEffects: ["emit Success"],
        negativeEffects: [],
        callingFunction: "transfer(address to, uint256 value)",
        order: 2,
      },
      {
        Name: "Rule B",
        Description: "Second rule",
        condition: "2 == 2",
        positiveEffects: ["emit Success"],
        negativeEffects: [],
        callingFunction: "transfer(address to, uint256 value)",
        order: 1,
      },
    ],
  };
  
  const parsed = validatePolicyJSON(JSON.stringify(policy));
  expect(isRight(parsed)).toBeTruthy();
});

test("Policy JSON validation should pass when no rules have order", () => {
  const policy = {
    Policy: "Rule Ordering Test Policy",
    Description: "Test no rule ordering",
    PolicyType: "open",
    CallingFunctions: [
      {
        name: "transfer(address to, uint256 value)",
        functionSignature: "transfer(address to, uint256 value)",
        encodedValues: "address to, uint256 value",
      },
    ],
    ForeignCalls: [],
    Trackers: [],
    MappedTrackers: [],
    Rules: [
      {
        Name: "Rule A",
        Description: "First rule",
        condition: "1 == 1",
        positiveEffects: ["emit Success"],
        negativeEffects: [],
        callingFunction: "transfer(address to, uint256 value)",
      },
      {
        Name: "Rule B",
        Description: "Second rule",
        condition: "2 == 2",
        positiveEffects: ["emit Success"],
        negativeEffects: [],
        callingFunction: "transfer(address to, uint256 value)",
      },
    ],
  };
  
  const parsed = validatePolicyJSON(JSON.stringify(policy));
  expect(isRight(parsed)).toBeTruthy();
});

test("Policy JSON validation should fail when rules have duplicate order values", () => {
  const policy = {
    Policy: "Rule Ordering Test Policy",
    Description: "Test duplicate order values",
    PolicyType: "open",
    CallingFunctions: [
      {
        name: "transfer(address to, uint256 value)",
        functionSignature: "transfer(address to, uint256 value)",
        encodedValues: "address to, uint256 value",
      },
    ],
    ForeignCalls: [],
    Trackers: [],
    MappedTrackers: [],
    Rules: [
      {
        Name: "Rule A",
        Description: "First rule",
        condition: "1 == 1",
        positiveEffects: ["emit Success"],
        negativeEffects: [],
        callingFunction: "transfer(address to, uint256 value)",
        order: 1,
      },
      {
        Name: "Rule B",
        Description: "Second rule with same order",
        condition: "2 == 2",
        positiveEffects: ["emit Success"],
        negativeEffects: [],
        callingFunction: "transfer(address to, uint256 value)",
        order: 1, // Duplicate order value
      },
    ],
  };
  
  const parsed = validatePolicyJSON(JSON.stringify(policy));
  expect(isLeft(parsed)).toBeTruthy();
  
  if (isLeft(parsed)) {
    const errors = unwrapEither(parsed);
    expect(errors.some(err => err.message.includes('Rule ordering validation failed'))).toBeTruthy();
  }
});

test("Policy JSON validation handles null values robustly", () => {
  // This test demonstrates that our validation logic treats null == undefined
  // even though Zod schema will reject null values at the schema level
  const policy = {
    Policy: "Rule Ordering Test Policy", 
    Description: "Test null order robustness",
    PolicyType: "open",
    CallingFunctions: [
      {
        name: "transfer(address to, uint256 value)",
        functionSignature: "transfer(address to, uint256 value)",
        encodedValues: "address to, uint256 value",
      },
    ],
    ForeignCalls: [],
    Trackers: [],
    MappedTrackers: [],
    Rules: [
      {
        Name: "Rule A",
        Description: "Rule with no order field",
        condition: "1 == 1",
        positiveEffects: ["emit Success"],
        negativeEffects: [],
        callingFunction: "transfer(address to, uint256 value)",
        // No order field (undefined)
      },
      {
        Name: "Rule B", 
        Description: "Rule with null order",
        condition: "2 == 2",
        positiveEffects: ["emit Success"],
        negativeEffects: [],
        callingFunction: "transfer(address to, uint256 value)",
        order: null, // This will fail Zod validation, but our logic treats null == undefined
      },
    ],
  };
  
  // This will fail at Zod schema validation level since z.number().optional() doesn't allow null
  // But our custom validation logic now uses null-safe comparisons (rule.order == null)
  const parsed = validatePolicyJSON(JSON.stringify(policy));
  expect(isLeft(parsed)).toBeTruthy(); // Fails due to Zod schema, not our custom validation
  
  if (isLeft(parsed)) {
    const errors = unwrapEither(parsed);
    // Should NOT contain our custom rule ordering error since both rules have "no order" (null == undefined)
    expect(errors.some(err => err.message.includes('Rule ordering validation failed'))).toBeFalsy();
  }
});
