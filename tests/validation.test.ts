import { expect, test } from 'vitest'
import {
  validateRuleJSON,
  validateForeignCallJSON,
  validateTrackerJSON,
  validatePolicyJSON,
  safeParseJson,
  validateMappedTrackerJSON,
  validateCallingFunctionExists,
  CallingFunctionJSON,
} from '../src/modules/validation'
import { isLeft, isRight, unwrapEither } from '../src/modules/utils'
import { RulesError } from '../src/modules/types'

const ruleJSON = `{
        "Name": "Rule A",
        "Description": "Rule A Description",
				"Condition": "3 + 4 > 5 AND (1 == 1 AND 2 == 2)",
				"PositiveEffects": ["revert"],
				"NegativeEffects": [],
				"CallingFunction": "addValue"
				}`

const fcJSON = `{
					"Name": "Simple Foreign Call",
					"Address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
					"Function": "testSig(address,string,uint256)",
					"ReturnType": "uint256",
					"ValuesToPass": "0, 1, 2",
          "MappedTrackerKeyValues": "",
					"CallingFunction": "transfer"
					}`

const trackerJSON = `{
							"Name": "Simple String Tracker",
							"Type": "uint256",
							"InitialValue": "4"
					}`

const mappedTrackerJSON = `{
    "Name": "Simple bool Tracker",
    "KeyType": "uint256",
    "ValueType": "uint256",
    "InitialKeys": ["0", "1", "2"],
    "InitialValues": ["1", "2", "3"]
  }`

var policyJSON = `
    {
    "Policy": "Test Policy",
    "Description": "Test Policy Description",
    "PolicyType": "open",
    "CallingFunctions": [
      {
        "Name": "transfer",
        "FunctionSignature": "transfer(address to, uint256 value)",
        "EncodedValues": "address to, uint256 value"
      }
    ],
    "ForeignCalls": [
        {
            "Name": "Simple Foreign Call",
            "Address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
            "Function": "testSig(address)",
            "ReturnType": "uint256",
            "ValuesToPass": "to",
            "MappedTrackerKeyValues": "",
            "CallingFunction": "transfer"
        }
    ],
    "Trackers": [
    {
        "Name": "Simple String Tracker",
        "Type": "string",
        "InitialValue": "test"
    }
    ],
	"MappedTrackers": [],
    "Rules": [
        {
            "Name": "Rule A",
            "Description": "Rule A Description",
            "Condition": "value > 500",
            "PositiveEffects": ["emit Success"],
            "NegativeEffects": ["revert()"],
            "CallingFunction": "transfer"
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
        "Name": "transfer",
        "FunctionSignature": "transfer(address to, uint256 value)",
        "EncodedValues": "address to, uint256 value"
      },
      {
        "Name": "mint",
        "FunctionSignature": "mint(address to, uint256 value)",
        "EncodedValues": "address to, uint256 value"
      }
    ],
    "ForeignCalls": [
      {
          "Name": "SimpleForeignCall",
          "Address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
          "Function": "testSig(address)",
          "ReturnType": "uint256",
          "ValuesToPass": "to",
          "MappedTrackerKeyValues": "",
          "CallingFunction": "transfer"
      },
      {
          "Name": "SimpleForeignCall",
          "Address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
          "Function": "testSig2(address)",
          "ReturnType": "uint256",
          "ValuesToPass": "to",
          "MappedTrackerKeyValues": "",
          "CallingFunction": "mint"
      }
    ],
    "Trackers": [
      {
          "Name": "SimpleStringTracker",
          "Type": "string",
          "InitialValue": "test"
      },
      {
          "Name": "SimpleUint256Tracker2",
          "Type": "uint256",
          "InitialValue": "0"
      }
    ],
	"MappedTrackers": [
    {
      "Name": "SimpleMappedTracker",
      "KeyType": "uint256",
      "ValueType": "uint256",
      "InitialKeys": ["0", "1", "2"],
      "InitialValues": ["1", "2", "3"]
    },
    {
      "Name": "SimpleMappedTracker2",
      "KeyType": "uint256",
      "ValueType": "uint256",
      "InitialKeys": ["0", "1", "2"],
      "InitialValues": ["1", "2", "3"]
    }
  ],
    "Rules": [
      {
          "Name": "Rule A",
          "Description": "Rule A Description",
          "Condition": "FC:SimpleForeignCall > 500 AND (TR:SimpleStringTracker == 'test' OR TR:SimpleMappedTracker(to) > 100)",
          "PositiveEffects": ["emit Success"],
          "NegativeEffects": ["revert()"],
          "CallingFunction": "transfer"
      },
      {
          "Name": "Rule B",
          "Description": "Rule B Description",
          "Condition": "FC:SimpleForeignCall > 500",
          "PositiveEffects": ["TR:SimpleStringTracker2(to) +=1", "TRU:SimpleMappedTracker2(to) +=1"],
          "NegativeEffects": ["revert()"],
          "CallingFunction": "mint"
      }
    ]
  }`

test('Can validate rule JSON', () => {
  const parsedRule = validateRuleJSON(ruleJSON)
  expect(isRight(parsedRule)).toBeTruthy()
  if (isRight(parsedRule)) {
    const rule = unwrapEither(parsedRule)

    expect(rule.CallingFunction).toEqual(JSON.parse(ruleJSON).CallingFunction)
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

    expect(rule.CallingFunction).toEqual(JSON.parse(ruleJSON).CallingFunction)
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

    expect(rule.CallingFunction).toEqual(JSON.parse(ruleJSON).CallingFunction)
  }
})

test('Can catch all missing required fields in rule JSON', () => {
  const parsedRule = validateRuleJSON('{}')
  expect(isLeft(parsedRule)).toBeTruthy()
  if (isLeft(parsedRule)) {
    const errors = unwrapEither(parsedRule)

    expect(errors.length).toEqual(4)
    expect(errors[0].message).toEqual('Rule Invalid input: expected string, received undefined: Field Condition')
    expect(errors[1].message).toEqual('Rule Invalid input: expected array, received undefined: Field PositiveEffects')
    expect(errors[2].message).toEqual('Rule Invalid input: expected array, received undefined: Field NegativeEffects')
    expect(errors[3].message).toEqual('Rule Invalid input: expected string, received undefined: Field CallingFunction')
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
				"Condition": 1,
				"PositiveEffects": "foo",
				"NegativeEffects": "bar",
				"CallingFunction": 1,
				"EncodedValues": 1
				}`
  const parsedRule = validateRuleJSON(invalidJSON)
  expect(isLeft(parsedRule)).toBeTruthy()
  if (isLeft(parsedRule)) {
    const errors = unwrapEither(parsedRule)

    expect(errors.length).toEqual(4)
    expect(errors[0].message).toEqual('Rule Invalid input: expected string, received number: Field Condition')
    expect(errors[1].message).toEqual('Rule Invalid input: expected array, received string: Field PositiveEffects')
    expect(errors[2].message).toEqual('Rule Invalid input: expected array, received string: Field NegativeEffects')
    expect(errors[3].message).toEqual('Rule Invalid input: expected string, received number: Field CallingFunction')
  }
})

test('Can return error if rule JSON is invalid', () => {
  let invalidRuleJSON = JSON.parse(ruleJSON)
  delete invalidRuleJSON.Condition // Remove condition to make it invalid
  const parsedRule = validateRuleJSON(JSON.stringify(invalidRuleJSON))
  expect(isLeft(parsedRule)).toBeTruthy()
  if (isLeft(parsedRule)) {
    const errors = unwrapEither(parsedRule)
    expect(errors.length).toEqual(1)
    expect(errors[0].message).toEqual('Rule Invalid input: expected string, received undefined: Field Condition')
  }
})

test('Can return multiple errors if rule JSON is invalid', () => {
  let invalidRuleJSON = JSON.parse(ruleJSON)
  delete invalidRuleJSON.Condition // Remove condition to make it invalid
  delete invalidRuleJSON.CallingFunction // Remove callingFunction to make it invalid
  const parsedRule = validateRuleJSON(JSON.stringify(invalidRuleJSON))
  expect(isLeft(parsedRule)).toBeTruthy()
  if (isLeft(parsedRule)) {
    const errors = unwrapEither(parsedRule)
    expect(errors.length).toEqual(2)
    expect(errors[0].message).toEqual('Rule Invalid input: expected string, received undefined: Field Condition')
    expect(errors[1].message).toEqual('Rule Invalid input: expected string, received undefined: Field CallingFunction')
  }
})

test('Can validate foreign call JSON', () => {
  const parsedFC = validateForeignCallJSON(fcJSON)
  expect(isRight(parsedFC)).toBeTruthy()
  if (isRight(parsedFC)) {
    const fc = unwrapEither(parsedFC)

    expect(fc.ValuesToPass).toEqual(JSON.parse(fcJSON).ValuesToPass)
  }
})

test('Can catch all missing required fields in foreign call JSON', () => {
  const parsedFC = validateForeignCallJSON('{}')
  expect(isLeft(parsedFC)).toBeTruthy()
  if (isLeft(parsedFC)) {
    const errors = unwrapEither(parsedFC)

    expect(errors.length).toEqual(7)
    expect(errors[0].message).toEqual('Foreign Call Invalid input: expected string, received undefined: Field Name')
    expect(errors[1].message).toEqual('Foreign Call Invalid input: expected string, received undefined: Field Function')
    expect(errors[2].message).toEqual('Foreign Call Invalid input: expected string, received undefined: Field Address')
    expect(errors[3].message).toEqual('Foreign Call Unsupported return type: Field ReturnType')
    expect(errors[4].message).toEqual(
      'Foreign Call Invalid input: expected string, received undefined: Field ValuesToPass'
    )
    expect(errors[5].message).toEqual(
      'Foreign Call Invalid input: expected string, received undefined: Field MappedTrackerKeyValues'
    )
    expect(errors[6].message).toEqual(
      'Foreign Call Invalid input: expected string, received undefined: Field CallingFunction'
    )
  }
})

test('Can catch all wrong inputs for fields in foreign call JSON', () => {
  const invalidJSON = `{
					"Name": 1,
					"Address": 1,
					"Function": 1,
					"ReturnType": 1,
					"ValuesToPass": 1,
          "MappedTrackerKeyValues": 1,
					"CallingFunction": 1
					}`
  const parsedFC = validateForeignCallJSON(invalidJSON)
  expect(isLeft(parsedFC)).toBeTruthy()
  if (isLeft(parsedFC)) {
    const errors = unwrapEither(parsedFC)

    expect(errors.length).toEqual(7)
    expect(errors[0].message).toEqual('Foreign Call Invalid input: expected string, received number: Field Name')
    expect(errors[1].message).toEqual('Foreign Call Invalid input: expected string, received number: Field Function')
    expect(errors[2].message).toEqual('Foreign Call Invalid input: expected string, received number: Field Address')
    expect(errors[3].message).toEqual('Foreign Call Unsupported return type: Field ReturnType')
    expect(errors[4].message).toEqual(
      'Foreign Call Invalid input: expected string, received number: Field ValuesToPass'
    )
    expect(errors[5].message).toEqual(
      'Foreign Call Invalid input: expected string, received number: Field MappedTrackerKeyValues'
    )
    expect(errors[6].message).toEqual(
      'Foreign Call Invalid input: expected string, received number: Field CallingFunction'
    )
  }
})

test('Can catch foreign call function with no parameters', () => {
  const invalidNoParamsFC = `{
    "Name": "NoParamCall",
    "Address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
    "Function": "testSig()",
    "ReturnType": "uint256",
    "ValuesToPass": "",
    "MappedTrackerKeyValues": "",
    "CallingFunction": "transfer"
  }`
  const parsed = validateForeignCallJSON(invalidNoParamsFC)
  // Empty params should be valid
  expect(isRight(parsed)).toBeTruthy()
})

test('Fails validation when function has undefined parameters (no parens)', () => {
  const invalidNoParens = `{
    "Name": "BadCall",
    "Address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
    "Function": "testSig",
    "ReturnType": "uint256",
    "ValuesToPass": "",
    "MappedTrackerKeyValues": "",
    "CallingFunction": "transfer"
  }`
  const parsed = validateForeignCallJSON(invalidNoParens)
  expect(isLeft(parsed)).toBeTruthy()
  if (isLeft(parsed)) {
    const errors = unwrapEither(parsed)
    expect(errors[0].message).toEqual('Foreign Call Unsupported argument type: Field Function')
  }
})

test('Can catch foreign call function with no parenthesis', () => {
  const invalidNoParamsFC = `{
    "Name": "NoParamCall",
    "Address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
    "Function": "testSig",
    "ReturnType": "uint256",
    "ValuesToPass": "",
    "MappedTrackerKeyValues": "",
    "CallingFunction": "transfer"
  }`
  const parsed = validateForeignCallJSON(invalidNoParamsFC)
  expect(isLeft(parsed)).toBeTruthy()
  if (isLeft(parsed)) {
    const errors = unwrapEither(parsed)
    expect(errors[0].message).toEqual('Foreign Call Unsupported argument type: Field Function')
  }
})

test('Can return errors if foreign call JSON is invalid', () => {
  const invalidFCJSON = JSON.parse(fcJSON)
  invalidFCJSON.Name = 100 // Change name to a number to make it invalid
  const parsedFC = validateForeignCallJSON(JSON.stringify(invalidFCJSON))
  expect(isLeft(parsedFC)).toBeTruthy()
  if (isLeft(parsedFC)) {
    const errors = unwrapEither(parsedFC)
    expect(errors.length).toEqual(1)
    expect(errors[0].message).toEqual('Foreign Call Invalid input: expected string, received number: Field Name')
  }
})

test('Can return multiple errors if foreign call JSON is invalid', () => {
  const invalidFCJSON = JSON.parse(fcJSON)
  invalidFCJSON.Name = 100 // Change name to a number to make it invalid
  delete invalidFCJSON.ValuesToPass // Remove valuesToPass to make it invalid
  const parsedFC = validateForeignCallJSON(JSON.stringify(invalidFCJSON))
  expect(isLeft(parsedFC)).toBeTruthy()
  if (isLeft(parsedFC)) {
    const errors = unwrapEither(parsedFC)
    expect(errors.length).toEqual(2)
    expect(errors[0].message).toEqual('Foreign Call Invalid input: expected string, received number: Field Name')
    expect(errors[1].message).toEqual(
      'Foreign Call Invalid input: expected string, received undefined: Field ValuesToPass'
    )
  }
})

test('Can validate foreign call JSON with void return type', () => {
  const fcWithVoidReturn = `{
    "Name": "VoidReturnCall",
    "Address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
    "Function": "testSig(uint256)",
    "ReturnType": "void",
    "ValuesToPass": "value",
    "MappedTrackerKeyValues": "",
    "CallingFunction": "transfer"
  }`
  const parsed = validateForeignCallJSON(fcWithVoidReturn)
  expect(isRight(parsed)).toBeTruthy()
  if (isRight(parsed)) {
    const fc = unwrapEither(parsed)
    expect(fc.ReturnType).toEqual('void')
  }
})

test('Can validate tracker JSON', () => {
  const parsedJSON = JSON.parse(trackerJSON)
  const parsedTracker = validateTrackerJSON(trackerJSON)
  expect(isRight(parsedTracker)).toBeTruthy()
  if (isRight(parsedTracker)) {
    const tracker = unwrapEither(parsedTracker)

    expect(tracker.Name).toEqual(parsedJSON.Name)
  }
})

test('Can validate array tracker JSON', () => {
  const parsedJSON = JSON.parse(trackerJSON)
  const parsedTracker = validateTrackerJSON(trackerJSON)
  expect(isRight(parsedTracker)).toBeTruthy()
  if (isRight(parsedTracker)) {
    const tracker = unwrapEither(parsedTracker)

    expect(tracker.Name).toEqual(parsedJSON.Name)
  }
})

test('Can catch all missing required fields in tracker JSON', () => {
  const parsedTracker = validateTrackerJSON('{}')
  expect(isLeft(parsedTracker)).toBeTruthy()
  if (isLeft(parsedTracker)) {
    const errors = unwrapEither(parsedTracker)

    expect(errors.length).toEqual(3)
    expect(errors[0].message).toEqual('Tracker Invalid input: expected string, received undefined: Field Name')
    expect(errors[1].message).toEqual('Tracker Unsupported type: Field Type')
    expect(errors[2].message).toEqual('Tracker Invalid input: Field InitialValue')
  }
})

test('Can catch all wrong inputs for fields in tracker JSON', () => {
  const invalidJSON = `{
							"Name": 1,
							"Type": 1,
							"InitialValue": 1
					}`
  const parsedTracker = validateTrackerJSON(invalidJSON)
  expect(isLeft(parsedTracker)).toBeTruthy()
  if (isLeft(parsedTracker)) {
    const errors = unwrapEither(parsedTracker)

    expect(errors.length).toEqual(3)
    expect(errors[0].message).toEqual('Tracker Invalid input: expected string, received number: Field Name')
    expect(errors[1].message).toEqual('Tracker Unsupported type: Field Type')
    expect(errors[2].message).toEqual('Tracker Invalid input: Field InitialValue')
  }
})

test('Can return error if tracker JSON is invalid', () => {
  const invalidTrackerJSON = JSON.parse(trackerJSON)
  invalidTrackerJSON.Name = 23 // Change name to a number to make it invalid
  const parsedTracker = validateTrackerJSON(JSON.stringify(invalidTrackerJSON))
  expect(isLeft(parsedTracker)).toBeTruthy()
  if (isLeft(parsedTracker)) {
    const errors = unwrapEither(parsedTracker)
    expect(errors.length).toEqual(1)
    expect(errors[0].message).toEqual('Tracker Invalid input: expected string, received number: Field Name')
  }
})

test('Can return multiple errors if tracker JSON is invalid', () => {
  const invalidTrackerJSON = JSON.parse(trackerJSON)
  invalidTrackerJSON.Name = 23 // Change name to a number to make it invalid
  delete invalidTrackerJSON.InitialValue // Remove initialValue to make it invalid
  const parsedTracker = validateTrackerJSON(JSON.stringify(invalidTrackerJSON))
  expect(isLeft(parsedTracker)).toBeTruthy()
  if (isLeft(parsedTracker)) {
    const errors = unwrapEither(parsedTracker)
    expect(errors.length).toEqual(2)
    expect(errors[0].message).toEqual('Tracker Invalid input: expected string, received number: Field Name')
    expect(errors[1].message).toEqual('Tracker Invalid input: Field InitialValue')
  }
})

test('Can validate mapped tracker JSON', () => {
  const parsedJSON = JSON.parse(mappedTrackerJSON)
  const parsedTracker = validateMappedTrackerJSON(mappedTrackerJSON)
  expect(isRight(parsedTracker)).toBeTruthy()
  if (isRight(parsedTracker)) {
    const tracker = unwrapEither(parsedTracker)

    expect(tracker.Name).toEqual(parsedJSON.Name)
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
  parsedInput.ForeignCalls[0].CallingFunction = 'transferTo(uint256 value)'
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
		"Name": "Simple Foreign Call",
		"Address": "test",
		"Function": "testSig(address,string,uint256)",
		"ReturnType": "uint256",
		"ValuesToPass": "0, 1, 2"
		}`

  var retVal = unwrapEither(validateForeignCallJSON(str)) as RulesError[]
  expect(retVal[0].message).toEqual('Foreign Call Address is invalid: Field Address')
})

test('Tests Foreign Call unsupported return type', () => {
  var str = `{
		"Name": "Simple Foreign Call",
		"Address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
		"Function": "testSig(address,string,uint256)",
		"ReturnType": "notAnInt",
		"ValuesToPass": "0, 1, 2"
		}`
  var retVal = unwrapEither(validateForeignCallJSON(str)) as RulesError[]
  expect(retVal[0].message).toEqual('Foreign Call Unsupported return type: Field ReturnType')
})

test('Tests Foreign Call unsupported argument type', () => {
  var str = `{
		"Name": "Simple Foreign Call",
		"Address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
		"Function": "testSig(address,notAnInt,uint256)",
		"ReturnType": "uint256",
		"ValuesToPass": "0, 1, 2"
		}`

  var retVal = unwrapEither(validateForeignCallJSON(str)) as RulesError[]
  expect(retVal[0].message).toEqual('Foreign Call Unsupported argument type: Field Function')
})

test('Tests Tracker unsupported type', () => {
  var str = `{
				"Name": "Simple String Tracker",
				"Type": "book",
				"InitialValue": "test"
				}`
  var retVal = unwrapEither(validateTrackerJSON(str)) as RulesError[]
  expect(retVal[0].message).toEqual('Tracker Unsupported type: Field Type')
})

test('Tests can safely parse json', () => {
  const str = `{
				"Type": 1,
				"Name": "foo"
				}`
  const retVal = safeParseJson(str)
  expect(isRight(retVal)).toBeTruthy()
  const parsed = unwrapEither(retVal) as any
  expect(parsed.Type).toEqual(1)
  expect(parsed.Name).toEqual('foo')
})

test('Tests can return error when parsing invalid json', () => {
  const str = `{
				"Type": 1,
				"Name": "foo",
				}`
  const retVal = safeParseJson(str)
  expect(isLeft(retVal)).toBeTruthy()
  const parsed = unwrapEither(retVal) as RulesError[]
  expect(parsed[0].message).toEqual('Failed to parse JSON')
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
    testTracker.Type = input.pType
    testTracker.InitialValue = input.success
    const trackerJSONSuccess = JSON.stringify(testTracker)
    const parsedTrackerSuccess = validateTrackerJSON(trackerJSONSuccess)

    expect(
      isRight(parsedTrackerSuccess),
      `Tracker Validation Failed for type: ${input.pType} and initial value ${input.success}`
    ).toBeTruthy()

    testTracker.Type = input.pType
    testTracker.InitialValue = input.failure
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
    testTracker.ValueType = input.pType
    testTracker.InitialKeys = input.success[0]
    testTracker.InitialValues = input.success[1]
    const trackerJSONSuccess = JSON.stringify(testTracker)
    const parsedTrackerSuccess = validateMappedTrackerJSON(trackerJSONSuccess)

    expect(
      isRight(parsedTrackerSuccess),
      `Tracker Validation Failed for type: ${input.pType} and initial value ${input.success}`
    ).toBeTruthy()

    testTracker.ValueType = input.pType
    testTracker.InitialKeys = input.failure[0]
    testTracker.InitialValues = input.failure[1]
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
    testTracker.KeyType = input.pType
    testTracker.InitialKeys = input.success[0]
    testTracker.InitialValues = input.success[1]
    const trackerJSONSuccess = JSON.stringify(testTracker)
    const parsedTrackerSuccess = validateMappedTrackerJSON(trackerJSONSuccess)

    expect(
      isRight(parsedTrackerSuccess),
      `Mapped Tracker Validation Failed for type: ${input.pType} and initial key ${input.success}`
    ).toBeTruthy()

    testTracker.KeyType = input.pType
    testTracker.InitialKeys = input.failure[0]
    testTracker.InitialValues = input.failure[1]
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
    testTracker.KeyType = input
    const trackerJSONFailure = JSON.stringify(testTracker)
    const parsedTrackerFailure = validateMappedTrackerJSON(trackerJSONFailure)

    expect(isLeft(parsedTrackerFailure), `Mapped Tracker Validation Passed for keytype: ${input}`).toBeTruthy()
  })
})

test('Tests can catch all unequal mapped tracker initial keys and values length', () => {
  const testTracker = JSON.parse(mappedTrackerJSON)

  testTracker.InitialKeys.push('100')

  const parsedTracker = validateMappedTrackerJSON(JSON.stringify(testTracker))

  expect(
    isLeft(parsedTracker),
    `Mapped Tracker Validation Passed for unequal initial keys and values length`
  ).toBeTruthy()
})

test('Tests can catch mapped tracker duplicate keys', () => {
  const testTracker = JSON.parse(mappedTrackerJSON)

  testTracker.InitialKeys.push('1')
  testTracker.InitialValues.push('100')

  const parsedTracker = validateMappedTrackerJSON(JSON.stringify(testTracker))
  expect(isLeft(parsedTracker), `Mapped Tracker Validation Passed with duplicate keys`).toBeTruthy()
})

test('Allows using any parameter name from calling function in valuesToPass', () => {
  const input = JSON.parse(policyJSONFull)
  // Ensure the first foreign call can reference the second parameter name 'value'
  input.ForeignCalls[0].ValuesToPass = 'value'
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
        Name: 'transfer(address to, uint256 value, address spender)',
        FunctionSignature: 'transfer(address to, uint256 value, address spender)',
        EncodedValues: 'address to, uint256 value, address spender',
      },
    ],
    ForeignCalls: [
      {
        Name: 'UseSpender',
        Address: '0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC',
        Function: 'testSig(address)',
        ReturnType: 'uint256',
        ValuesToPass: 'spender',
        MappedTrackerKeyValues: '',
        CallingFunction: 'transfer(address to, uint256 value, address spender)',
      },
    ],
    Trackers: [
      {
        Name: 'SimpleString',
        Type: 'string',
        InitialValue: 'x',
      },
    ],
    MappedTrackers: [],
    Rules: [
      {
        Name: 'R',
        Description: 'D',
        Condition: '1 == 1',
        PositiveEffects: ['emit E'],
        NegativeEffects: [],
        CallingFunction: 'transfer(address to, uint256 value, address spender)',
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
        Name: 'transfer(address to, uint256 value)',
        FunctionSignature: 'transfer(address to, uint256 value)',
        EncodedValues: 'address to, uint256 value',
      },
    ],
    ForeignCalls: [
      {
        Name: 'UseTrackers',
        Address: '0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC',
        Function: 'testSig(string,uint256,string)',
        ReturnType: 'uint256',
        ValuesToPass: 'TR:SimpleString, TR:SimpleMapped(to)',
        MappedTrackerKeyValues: 'to',
        CallingFunction: 'transfer(address to, uint256 value)',
      },
    ],
    Trackers: [{ Name: 'SimpleString', Type: 'string', InitialValue: 'hello' }],
    MappedTrackers: [
      {
        Name: 'SimpleMapped',
        KeyType: 'address',
        ValueType: 'uint256',
        InitialKeys: ['0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC'],
        InitialValues: ['1'],
      },
    ],
    Rules: [
      {
        Name: 'R',
        Description: 'D',
        Condition: '1 == 1',
        PositiveEffects: ['emit E'],
        NegativeEffects: [],
        CallingFunction: 'transfer(address to, uint256 value)',
      },
    ],
  }
  const parsed = validatePolicyJSON(JSON.stringify(policy))
  expect(isRight(parsed)).toBeTruthy()
})

test('Policy JSON validation should fail when duplicate Rule Ids are provided', () => {
  const policy = {
    Policy: 'Rule Ordering Test Policy',
    Description: 'Test mixed rule ordering',
    PolicyType: 'open',
    CallingFunctions: [
      {
        Name: 'transfer(address to, uint256 value)',
        FunctionSignature: 'transfer(address to, uint256 value)',
        EncodedValues: 'address to, uint256 value',
      },
    ],
    ForeignCalls: [],
    Trackers: [],
    MappedTrackers: [],
    Rules: [
      {
        Id: 1,
        Name: 'Rule A',
        Description: 'First rule with order',
        Condition: '1 == 1',
        PositiveEffects: ['emit Success'],
        NegativeEffects: [],
        CallingFunction: 'transfer(address to, uint256 value)',
      },
      {
        Id: 1,
        Name: 'Rule B',
        Description: 'Second rule without order',
        Condition: '2 == 2',
        PositiveEffects: ['emit Success'],
        NegativeEffects: [],
        CallingFunction: 'transfer(address to, uint256 value)',
      },
    ],
  }

  const parsed = validatePolicyJSON(JSON.stringify(policy))
  expect(isLeft(parsed)).toBeTruthy()

  if (isLeft(parsed)) {
    const errors = unwrapEither(parsed)
    expect(
      errors.some((err) =>
        err.message.includes(
          'Id validation failed: only one instance of each Id is allowed per component within a policy.'
        )
      )
    ).toBeTruthy()
  }
})

test('Policy JSON validation should fail when duplicate Foreign Call Ids are provided', () => {
  const policy = {
    Policy: 'Rule Ordering Test Policy',
    Description: 'Test mixed rule ordering',
    PolicyType: 'open',
    CallingFunctions: [
      {
        Name: 'transfer(address to, uint256 value)',
        FunctionSignature: 'transfer(address to, uint256 value)',
        EncodedValues: 'address to, uint256 value',
      },
    ],
    ForeignCalls: [
      {
        Id: 1,
        Name: 'UseSpender',
        Address: '0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC',
        Function: 'testSig(address)',
        ReturnType: 'uint256',
        ValuesToPass: 'spender',
        MappedTrackerKeyValues: '',
        CallingFunction: 'transfer(address to, uint256 value, address spender)',
      },
      {
        Id: 1,
        Name: 'UseSpenderTwo',
        Address: '0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC',
        Function: 'testSig(address)',
        ReturnType: 'uint256',
        ValuesToPass: 'spender',
        MappedTrackerKeyValues: '',
        CallingFunction: 'transfer(address to, uint256 value, address spender)',
      },
    ],
    Trackers: [],
    MappedTrackers: [],
    Rules: [
      {
        Id: 1,
        Name: 'Rule A',
        Description: 'First rule with order',
        Condition: '1 == 1',
        PositiveEffects: ['emit Success'],
        NegativeEffects: [],
        CallingFunction: 'transfer(address to, uint256 value)',
      },
      {
        Id: 2,
        Name: 'Rule B',
        Description: 'Second rule without order',
        Condition: '2 == 2',
        PositiveEffects: ['emit Success'],
        NegativeEffects: [],
        CallingFunction: 'transfer(address to, uint256 value)',
      },
    ],
  }
  const parsed = validatePolicyJSON(JSON.stringify(policy))
  expect(isLeft(parsed)).toBeTruthy()

  if (isLeft(parsed)) {
    const errors = unwrapEither(parsed)
    expect(
      errors.some((err) =>
        err.message.includes(
          'Id validation failed: only one instance of each Id is allowed per component within a policy.'
        )
      )
    ).toBeTruthy()
  }
})

test('Policy JSON validation should fail when duplicate Tracker Ids are provided', () => {
  const policy = {
    Policy: 'Rule Ordering Test Policy',
    Description: 'Test mixed rule ordering',
    PolicyType: 'open',
    CallingFunctions: [
      {
        Name: 'transfer(address to, uint256 value)',
        FunctionSignature: 'transfer(address to, uint256 value)',
        EncodedValues: 'address to, uint256 value',
      },
    ],
    ForeignCalls: [
      {
        Id: 1,
        Name: 'UseSpender',
        Address: '0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC',
        Function: 'testSig(address)',
        ReturnType: 'uint256',
        ValuesToPass: 'spender',
        MappedTrackerKeyValues: '',
        CallingFunction: 'transfer(address to, uint256 value, address spender)',
      },
    ],
    Trackers: [
      {
        Id: 1,
        Name: 'trackerOne',
        Type: 'uint256',
        InitialValue: '123',
      },
      {
        Id: 1,
        Name: 'trackerTwo',
        Type: 'uint256',
        InitialValue: '123',
      },
    ],
    MappedTrackers: [],
    Rules: [
      {
        Id: 1,
        Name: 'Rule A',
        Description: 'First rule with order',
        Condition: '1 == 1',
        PositiveEffects: ['emit Success'],
        NegativeEffects: [],
        CallingFunction: 'transfer(address to, uint256 value)',
      },
      {
        Id: 2,
        Name: 'Rule B',
        Description: 'Second rule without order',
        Condition: '2 == 2',
        PositiveEffects: ['emit Success'],
        NegativeEffects: [],
        CallingFunction: 'transfer(address to, uint256 value)',
      },
    ],
  }

  const parsed = validatePolicyJSON(JSON.stringify(policy))
  expect(isLeft(parsed)).toBeTruthy()

  if (isLeft(parsed)) {
    const errors = unwrapEither(parsed)
    expect(
      errors.some((err) =>
        err.message.includes(
          'Id validation failed: only one instance of each Id is allowed per component within a policy.'
        )
      )
    ).toBeTruthy()
  }
})

test('Policy JSON validation should fail when duplicate Mapped Tracker Ids are provided', () => {
  const policy = {
    Policy: 'Rule Ordering Test Policy',
    Description: 'Test mixed rule ordering',
    PolicyType: 'open',
    CallingFunctions: [
      {
        Name: 'transfer(address to, uint256 value)',
        FunctionSignature: 'transfer(address to, uint256 value)',
        EncodedValues: 'address to, uint256 value',
      },
    ],
    ForeignCalls: [
      {
        Id: 1,
        Name: 'UseSpender',
        Address: '0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC',
        Function: 'testSig(address)',
        ReturnType: 'uint256',
        ValuesToPass: 'spender',
        MappedTrackerKeyValues: '',
        CallingFunction: 'transfer(address to, uint256 value, address spender)',
      },
    ],
    Trackers: [],
    MappedTrackers: [
      {
        Id: 1,
        Name: 'mappedTrackerOne',
        KeyType: 'address',
        ValueType: 'uint256',
        InitialKeys: ['0xb7f8bc63bbcad18155201308c8f3540b07f84f5e'],
        InitialValues: ['1'],
      },
      {
        Id: 1,
        Name: 'mappedTrackerTwo',
        KeyType: 'address',
        ValueType: 'uint256',
        InitialKeys: ['0xb7f8bc63bbcad18155201308c8f3540b07f84f5e'],
        InitialValues: ['1'],
      },
    ],
    Rules: [
      {
        Id: 1,
        Name: 'Rule A',
        Description: 'First rule with order',
        Condition: '1 == 1',
        PositiveEffects: ['emit Success'],
        NegativeEffects: [],
        CallingFunction: 'transfer(address to, uint256 value)',
      },
      {
        Id: 2,
        Name: 'Rule B',
        Description: 'Second rule without order',
        Condition: '2 == 2',
        PositiveEffects: ['emit Success'],
        NegativeEffects: [],
        CallingFunction: 'transfer(address to, uint256 value)',
      },
    ],
  }

  const parsed = validatePolicyJSON(JSON.stringify(policy))
  expect(isLeft(parsed)).toBeTruthy()

  if (isLeft(parsed)) {
    const errors = unwrapEither(parsed)
    expect(
      errors.some((err) =>
        err.message.includes(
          'Id validation failed: only one instance of each Id is allowed per component within a policy.'
        )
      )
    ).toBeTruthy()
  }
})

test('validateCallingFunctionExists should detect missing calling functions', () => {
  // Create calling function objects
  const transferFunction: CallingFunctionJSON = {
    Name: 'transfer',
    FunctionSignature: 'transfer(address to, uint256 value)',
    EncodedValues: '',
  }

  const approveFunction: CallingFunctionJSON = {
    Name: 'approve',
    FunctionSignature: 'approve(address spender, uint256 amount)',
    EncodedValues: '',
  }

  // Create a lookup map with some calling functions (only callingFunctionByName is used by the function)
  const lookupMaps = {
    callingFunctionByName: {
      transfer: transferFunction,
      approve: approveFunction,
    },
    callingFunctionBySignature: {}, // Not used by validateCallingFunctionExists
    callingFunctionByNameLower: {}, // Not used by validateCallingFunctionExists
  }

  // Test with an existing calling function
  expect(() => {
    validateCallingFunctionExists('transfer', lookupMaps)
  }).not.toThrow()

  // Test with a missing calling function
  expect(() => {
    validateCallingFunctionExists('nonExistentFunction', lookupMaps)
  }).toThrow(
    'Calling function "nonExistentFunction" not found. Available calling functions: transfer, approve. Please ensure the calling function is defined in the CallingFunctions array before referencing it in rules or foreign calls.'
  )

  // Test with empty calling function
  expect(() => {
    validateCallingFunctionExists('', lookupMaps)
  }).toThrow(
    'Calling function "" not found. Available calling functions: transfer, approve. Please ensure the calling function is defined in the CallingFunctions array before referencing it in rules or foreign calls.'
  )
})

test('Policy update validation should merge existing policy with update input', () => {
  // Existing policy has transfer calling function and a rule
  const existingPolicy = {
    Id: 1,
    Policy: 'Existing Policy',
    Description: 'Existing Policy Description',
    PolicyType: 'open',
    CallingFunctions: [
      {
        Name: 'transfer',
        FunctionSignature: 'transfer(address to, uint256 value)',
        EncodedValues: 'address to, uint256 value',
      },
    ],
    ForeignCalls: [
      {
        Name: 'ExistingFC',
        Address: '0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC' as `0x${string}`,
        Function: 'existing(address)',
        ReturnType: 'uint256' as const,
        ValuesToPass: 'to',
        MappedTrackerKeyValues: '',
        CallingFunction: 'transfer',
      },
    ],
    Trackers: [
      {
        Name: 'ExistingTracker',
        Type: 'uint256' as const,
        InitialValue: '0',
      },
    ],
    MappedTrackers: [],
    Rules: [
      {
        Name: 'ExistingRule',
        Description: 'Existing Rule',
        Condition: 'value > 100',
        PositiveEffects: ['emit Success'],
        NegativeEffects: [],
        CallingFunction: 'transfer',
      },
    ],
  }

  // Update input only contains a new rule that references the existing calling function
  // This would fail without the merge because the calling function isn't in the update input
  const updateInput = `{
    "Policy": "Existing Policy",
    "Description": "Existing Policy Description",
    "PolicyType": "open",
    "CallingFunctions": [],
    "ForeignCalls": [],
    "Trackers": [],
    "MappedTrackers": [],
    "Rules": [
      {
        "Name": "NewRule",
        "Description": "New Rule referencing existing calling function",
        "Condition": "value > 500",
        "PositiveEffects": ["emit NewSuccess"],
        "NegativeEffects": [],
        "CallingFunction": "transfer"
      }
    ]
  }`

  // Validate with existing policy - should succeed because of merge
  const validatedWithExisting = validatePolicyJSON(updateInput, existingPolicy)
  expect(isRight(validatedWithExisting)).toBeTruthy()

  // Validate without existing policy - should fail because transfer is not defined
  const validatedWithoutExisting = validatePolicyJSON(updateInput)
  expect(isLeft(validatedWithoutExisting)).toBeTruthy()

  if (isLeft(validatedWithoutExisting)) {
    const errors = unwrapEither(validatedWithoutExisting)
    expect(errors.some((err) => err.message.includes('Invalid reference call'))).toBeTruthy()
  }
})

test('Policy update validation should allow new foreign call referencing existing calling function', () => {
  const existingPolicy = {
    Id: 1,
    Policy: 'Existing Policy',
    Description: 'Existing Policy Description',
    PolicyType: 'open',
    CallingFunctions: [
      {
        Name: 'mint',
        FunctionSignature: 'mint(address to, uint256 value)',
        EncodedValues: 'address to, uint256 value',
      },
    ],
    ForeignCalls: [],
    Trackers: [],
    MappedTrackers: [],
    Rules: [],
  }

  // Update adds a foreign call that references the existing calling function
  const updateInput = `{
    "Policy": "Existing Policy",
    "Description": "Existing Policy Description",
    "PolicyType": "open",
    "CallingFunctions": [],
    "ForeignCalls": [
      {
        "Name": "NewFC",
        "Address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
        "Function": "check(address)",
        "ReturnType": "bool",
        "ValuesToPass": "to",
        "MappedTrackerKeyValues": "",
        "CallingFunction": "mint"
      }
    ],
    "Trackers": [],
    "MappedTrackers": [],
    "Rules": []
  }`

  const validated = validatePolicyJSON(updateInput, existingPolicy)
  expect(isRight(validated)).toBeTruthy()
})

// Global Variable Validation Tests
test('Foreign call with GV:MSG_SENDER in ValuesToPass should validate successfully', () => {
  const fcWithMsgSender = `{
    "Name": "MSG_SENDER_Check",
    "Address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
    "Function": "checkSender(address)",
    "ReturnType": "bool",
    "ValuesToPass": "GV:MSG_SENDER",
    "MappedTrackerKeyValues": "",
    "CallingFunction": "transfer"
  }`

  const validated = validateForeignCallJSON(fcWithMsgSender)
  expect(isRight(validated)).toBeTruthy()
})

test('Foreign call with GV:BLOCK_TIMESTAMP in ValuesToPass should validate successfully', () => {
  const fcWithBlockTimestamp = `{
    "Name": "BLOCK_TIMESTAMP_Check",
    "Address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
    "Function": "checkTimestamp(uint256)",
    "ReturnType": "bool",
    "ValuesToPass": "GV:BLOCK_TIMESTAMP",
    "MappedTrackerKeyValues": "",
    "CallingFunction": "transfer"
  }`

  const validated = validateForeignCallJSON(fcWithBlockTimestamp)
  expect(isRight(validated)).toBeTruthy()
})

test('Foreign call with GV:MSG_DATA in ValuesToPass should validate successfully', () => {
  const fcWithMsgData = `{
    "Name": "MSG_DATA_Check",
    "Address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
    "Function": "checkData(bytes)",
    "ReturnType": "bool",
    "ValuesToPass": "GV:MSG_DATA",
    "MappedTrackerKeyValues": "",
    "CallingFunction": "transfer"
  }`

  const validated = validateForeignCallJSON(fcWithMsgData)
  expect(isRight(validated)).toBeTruthy()
})

test('Foreign call with GV:BLOCK_NUMBER in ValuesToPass should validate successfully', () => {
  const fcWithBlockNumber = `{
    "Name": "BLOCK_NUMBER_Check",
    "Address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
    "Function": "checkBlockNumber(uint256)",
    "ReturnType": "bool",
    "ValuesToPass": "GV:BLOCK_NUMBER",
    "MappedTrackerKeyValues": "",
    "CallingFunction": "transfer"
  }`

  const validated = validateForeignCallJSON(fcWithBlockNumber)
  expect(isRight(validated)).toBeTruthy()
})

test('Foreign call with GV:TX_ORIGIN in ValuesToPass should validate successfully', () => {
  const fcWithTxOrigin = `{
    "Name": "TX_ORIGIN_Check",
    "Address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
    "Function": "checkOrigin(address)",
    "ReturnType": "bool",
    "ValuesToPass": "GV:TX_ORIGIN",
    "MappedTrackerKeyValues": "",
    "CallingFunction": "transfer"
  }`

  const validated = validateForeignCallJSON(fcWithTxOrigin)
  expect(isRight(validated)).toBeTruthy()
})

test('Foreign call with multiple global variables in ValuesToPass should validate successfully', () => {
  const fcWithMultipleGVs = `{
    "Name": "Multi_GV_Check",
    "Address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
    "Function": "checkMultiple(address,uint256,bytes)",
    "ReturnType": "bool",
    "ValuesToPass": "GV:MSG_SENDER, GV:BLOCK_TIMESTAMP, GV:MSG_DATA",
    "MappedTrackerKeyValues": "",
    "CallingFunction": "transfer"
  }`

  const validated = validateForeignCallJSON(fcWithMultipleGVs)
  expect(isRight(validated)).toBeTruthy()
})

test('Foreign call with mixed global variables and regular parameters should validate successfully', () => {
  const fcWithMixed = `{
    "Name": "Mixed_Check",
    "Address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
    "Function": "checkMixed(address,uint256,address)",
    "ReturnType": "bool",
    "ValuesToPass": "GV:MSG_SENDER, value, GV:TX_ORIGIN",
    "MappedTrackerKeyValues": "",
    "CallingFunction": "transfer"
  }`

  const validated = validateForeignCallJSON(fcWithMixed)
  expect(isRight(validated)).toBeTruthy()
})

test('Foreign call with invalid global variable should fail validation', () => {
  const fcWithInvalidGV = `{
    "Name": "Invalid_GV_Check",
    "Address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
    "Function": "checkInvalid(uint256)",
    "ReturnType": "bool",
    "ValuesToPass": "GV:INVALID_VARIABLE",
    "MappedTrackerKeyValues": "",
    "CallingFunction": "transfer"
  }`

  const validated = validateForeignCallJSON(fcWithInvalidGV)
  expect(isLeft(validated)).toBeTruthy()
  if (isLeft(validated)) {
    const errors = unwrapEither(validated)
    expect(errors.some((err) => err.message.includes('Unsupported global variable in ValuesToPass'))).toBeTruthy()
  }
})

test('Foreign call with malformed global variable should fail validation', () => {
  const fcWithMalformedGV = `{
    "Name": "Malformed_GV_Check",
    "Address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
    "Function": "checkMalformed(uint256)",
    "ReturnType": "bool",
    "ValuesToPass": "GV:",
    "MappedTrackerKeyValues": "",
    "CallingFunction": "transfer"
  }`

  const validated = validateForeignCallJSON(fcWithMalformedGV)
  expect(isLeft(validated)).toBeTruthy()
  if (isLeft(validated)) {
    const errors = unwrapEither(validated)
    expect(errors.some((err) => err.message.includes('Unsupported global variable in ValuesToPass'))).toBeTruthy()
  }
})
