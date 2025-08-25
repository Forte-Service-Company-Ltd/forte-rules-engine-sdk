import { expect, test } from "vitest";
import {
  validateRuleJSON,
  validateForeignCallJSON,
  validateTrackerJSON,
  validatePolicyJSON,
  safeParseJson,
  formatParenConditionGroups,
  validateCondition,
  validateMappedTrackerJSON,
} from "../src/modules/validation";
import { isLeft, isRight, unwrapEither } from "../src/modules/utils";
import { RulesError } from "../src/modules/types";

const ruleJSON = `{
        "Name": "Rule A",
        "Description": "Rule A Description",
				"condition": "3 + 4 > 5 AND (1 == 1 AND 2 == 2)",
				"positiveEffects": ["revert"],
				"negativeEffects": [],
				"callingFunction": "addValue(uint256 value)"
				}`;

const fcJSON = `{
					"name": "Simple Foreign Call",
					"address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
					"function": "testSig(address,string,uint256)",
					"returnType": "uint256",
					"valuesToPass": "0, 1, 2",
          "mappedTrackerKeyValues": "",
					"callingFunction": "transfer(address to, uint256 value)"
					}`;

const trackerJSON = `{
							"name": "Simple String Tracker",
							"type": "uint256",
							"initialValue": "4"
					}`;

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
        }`;

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
          "name": "SimpleForeignCall2",
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
  }`;

test("Can validate rule JSON", () => {
  const parsedRule = validateRuleJSON(ruleJSON);
  expect(isRight(parsedRule)).toBeTruthy();
  if (isRight(parsedRule)) {
    const rule = unwrapEither(parsedRule);

    expect(rule.callingFunction).toEqual(JSON.parse(ruleJSON).callingFunction);
  }
});

test("Can catch all missing required fields in rule JSON", () => {
  const parsedRule = validateRuleJSON("{}");
  expect(isLeft(parsedRule)).toBeTruthy();
  if (isLeft(parsedRule)) {
    const errors = unwrapEither(parsedRule);

    expect(errors.length).toEqual(6);
    expect(errors[0].message).toEqual(
      "Invalid input: expected string, received undefined: Field Name"
    );
    expect(errors[1].message).toEqual(
      "Invalid input: expected string, received undefined: Field Description"
    );
    expect(errors[2].message).toEqual(
      "Invalid input: expected string, received undefined: Field condition"
    );
    expect(errors[3].message).toEqual(
      "Invalid input: expected array, received undefined: Field positiveEffects"
    );
    expect(errors[4].message).toEqual(
      "Invalid input: expected array, received undefined: Field negativeEffects"
    );
    expect(errors[5].message).toEqual(
      "Invalid input: expected string, received undefined: Field callingFunction"
    );
  }
});

test("Can catch all wrong input types for fields in rule JSON", () => {
  const invalidJSON = `{
        "Name": "Rule A",
        "Description": "Rule A Description",
				"condition": 1,
				"positiveEffects": "foo",
				"negativeEffects": "bar",
				"callingFunction": 1,
				"encodedValues": 1
				}`;
  const parsedRule = validateRuleJSON(invalidJSON);
  expect(isLeft(parsedRule)).toBeTruthy();
  if (isLeft(parsedRule)) {
    const errors = unwrapEither(parsedRule);

    expect(errors.length).toEqual(4);
    expect(errors[0].message).toEqual(
      "Invalid input: expected string, received number: Field condition"
    );
    expect(errors[1].message).toEqual(
      "Invalid input: expected array, received string: Field positiveEffects"
    );
    expect(errors[2].message).toEqual(
      "Invalid input: expected array, received string: Field negativeEffects"
    );
    expect(errors[3].message).toEqual(
      "Invalid input: expected string, received number: Field callingFunction"
    );
  }
});

test("Can return error if rule JSON is invalid", () => {
  let invalidRuleJSON = JSON.parse(ruleJSON);
  delete invalidRuleJSON.condition; // Remove condition to make it invalid
  const parsedRule = validateRuleJSON(JSON.stringify(invalidRuleJSON));
  expect(isLeft(parsedRule)).toBeTruthy();
  if (isLeft(parsedRule)) {
    const errors = unwrapEither(parsedRule);
    expect(errors.length).toEqual(1);
    expect(errors[0].message).toEqual(
      "Invalid input: expected string, received undefined: Field condition"
    );
  }
});

test("Can return multiple errors if rule JSON is invalid", () => {
  let invalidRuleJSON = JSON.parse(ruleJSON);
  delete invalidRuleJSON.condition; // Remove condition to make it invalid
  delete invalidRuleJSON.callingFunction; // Remove callingFunction to make it invalid
  const parsedRule = validateRuleJSON(JSON.stringify(invalidRuleJSON));
  expect(isLeft(parsedRule)).toBeTruthy();
  if (isLeft(parsedRule)) {
    const errors = unwrapEither(parsedRule);
    expect(errors.length).toEqual(2);
    expect(errors[0].message).toEqual(
      "Invalid input: expected string, received undefined: Field condition"
    );
    expect(errors[1].message).toEqual(
      "Invalid input: expected string, received undefined: Field callingFunction"
    );
  }
});

test("Can validate foreign call JSON", () => {
  const parsedFC = validateForeignCallJSON(fcJSON);
  expect(isRight(parsedFC)).toBeTruthy();
  if (isRight(parsedFC)) {
    const fc = unwrapEither(parsedFC);

    expect(fc.valuesToPass).toEqual(JSON.parse(fcJSON).valuesToPass);
  }
});

test("Can catch all missing required fields in foreign call JSON", () => {
  const parsedFC = validateForeignCallJSON("{}");
  expect(isLeft(parsedFC)).toBeTruthy();
  if (isLeft(parsedFC)) {
    const errors = unwrapEither(parsedFC);

    expect(errors.length).toEqual(7);
    expect(errors[0].message).toEqual(
      "Invalid input: expected string, received undefined: Field name"
    );
    expect(errors[1].message).toEqual(
      "Invalid input: expected string, received undefined: Field function"
    );
    expect(errors[2].message).toEqual(
      "Invalid input: expected string, received undefined: Field address"
    );
    expect(errors[3].message).toEqual(
      "Unsupported return type: Field returnType"
    );
    expect(errors[4].message).toEqual(
      "Invalid input: expected string, received undefined: Field valuesToPass"
    );
    expect(errors[5].message).toEqual(
      "Invalid input: expected string, received undefined: Field mappedTrackerKeyValues"
    );
    expect(errors[6].message).toEqual(
      "Invalid input: expected string, received undefined: Field callingFunction"
    );
  }
});

test("Can catch all wrong inputs for fields in foreign call JSON", () => {
  const invalidJSON = `{
					"name": 1,
					"address": 1,
					"function": 1,
					"returnType": 1,
					"valuesToPass": 1,
          "mappedTrackerKeyValues": 1,
					"callingFunction": 1
					}`;
  const parsedFC = validateForeignCallJSON(invalidJSON);
  expect(isLeft(parsedFC)).toBeTruthy();
  if (isLeft(parsedFC)) {
    const errors = unwrapEither(parsedFC);

    expect(errors.length).toEqual(7);
    expect(errors[0].message).toEqual(
      "Invalid input: expected string, received number: Field name"
    );
    expect(errors[1].message).toEqual(
      "Invalid input: expected string, received number: Field function"
    );
    expect(errors[2].message).toEqual(
      "Invalid input: expected string, received number: Field address"
    );
    expect(errors[3].message).toEqual(
      "Unsupported return type: Field returnType"
    );
    expect(errors[4].message).toEqual(
      "Invalid input: expected string, received number: Field valuesToPass"
    );
    expect(errors[5].message).toEqual(
      "Invalid input: expected string, received number: Field mappedTrackerKeyValues"
    );
    expect(errors[6].message).toEqual(
      "Invalid input: expected string, received number: Field callingFunction"
    );
  }
});

test("Can catch foreign call function with no parameters", () => {
  const invalidNoParamsFC = `{
    "name": "NoParamCall",
    "address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
    "function": "testSig()",
    "returnType": "uint256",
    "valuesToPass": "",
    "mappedTrackerKeyValues": "",
    "callingFunction": "transfer(address to, uint256 value)"
  }`;
  const parsed = validateForeignCallJSON(invalidNoParamsFC);
  // Empty params should be valid
  expect(isRight(parsed)).toBeTruthy();
});

test("Fails validation when function has undefined parameters (no parens)", () => {
  const invalidNoParens = `{
    "name": "BadCall",
    "address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
    "function": "testSig",
    "returnType": "uint256",
    "valuesToPass": "",
    "mappedTrackerKeyValues": "",
    "callingFunction": "transfer(address to, uint256 value)"
  }`;
  const parsed = validateForeignCallJSON(invalidNoParens);
  expect(isLeft(parsed)).toBeTruthy();
  if (isLeft(parsed)) {
    const errors = unwrapEither(parsed);
    expect(errors[0].message).toEqual(
      "Unsupported argument type: Field function"
    );
  }
});

test("Can catch foreign call function with no parenthesis", () => {
  const invalidNoParamsFC = `{
    "name": "NoParamCall",
    "address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
    "function": "testSig",
    "returnType": "uint256",
    "valuesToPass": "",
    "mappedTrackerKeyValues": "",
    "callingFunction": "transfer(address to, uint256 value)"
  }`;
  const parsed = validateForeignCallJSON(invalidNoParamsFC);
  expect(isLeft(parsed)).toBeTruthy();
  if (isLeft(parsed)) {
    const errors = unwrapEither(parsed);
    expect(errors[0].message).toEqual(
      "Unsupported argument type: Field function"
    );
  }
});

test("Can return errors if foreign call JSON is invalid", () => {
  const invalidFCJSON = JSON.parse(fcJSON);
  invalidFCJSON.name = 100; // Change name to a number to make it invalid
  const parsedFC = validateForeignCallJSON(JSON.stringify(invalidFCJSON));
  expect(isLeft(parsedFC)).toBeTruthy();
  if (isLeft(parsedFC)) {
    const errors = unwrapEither(parsedFC);
    expect(errors.length).toEqual(1);
    expect(errors[0].message).toEqual(
      "Invalid input: expected string, received number: Field name"
    );
  }
});

test("Can return multiple errors if foreign call JSON is invalid", () => {
  const invalidFCJSON = JSON.parse(fcJSON);
  invalidFCJSON.name = 100; // Change name to a number to make it invalid
  delete invalidFCJSON.valuesToPass; // Remove valuesToPass to make it invalid
  const parsedFC = validateForeignCallJSON(JSON.stringify(invalidFCJSON));
  expect(isLeft(parsedFC)).toBeTruthy();
  if (isLeft(parsedFC)) {
    const errors = unwrapEither(parsedFC);
    expect(errors.length).toEqual(2);
    expect(errors[0].message).toEqual(
      "Invalid input: expected string, received number: Field name"
    );
    expect(errors[1].message).toEqual(
      "Invalid input: expected string, received undefined: Field valuesToPass"
    );
  }
});

test("Can validate tracker JSON", () => {
  const parsedJSON = JSON.parse(trackerJSON);
  const parsedTracker = validateTrackerJSON(trackerJSON);
  expect(isRight(parsedTracker)).toBeTruthy();
  if (isRight(parsedTracker)) {
    const tracker = unwrapEither(parsedTracker);

    expect(tracker.name).toEqual(parsedJSON.name);
  }
});

test("Can validate array tracker JSON", () => {
  const parsedJSON = JSON.parse(trackerJSON);
  const parsedTracker = validateTrackerJSON(trackerJSON);
  expect(isRight(parsedTracker)).toBeTruthy();
  if (isRight(parsedTracker)) {
    const tracker = unwrapEither(parsedTracker);

    expect(tracker.name).toEqual(parsedJSON.name);
  }
});

test("Can catch all missing required fields in tracker JSON", () => {
  const parsedTracker = validateTrackerJSON("{}");
  expect(isLeft(parsedTracker)).toBeTruthy();
  if (isLeft(parsedTracker)) {
    const errors = unwrapEither(parsedTracker);

    expect(errors.length).toEqual(3);
    expect(errors[0].message).toEqual(
      "Invalid input: expected string, received undefined: Field name"
    );
    expect(errors[1].message).toEqual("Unsupported type: Field type");
    expect(errors[2].message).toEqual(
      "Invalid input: Field initialValue"
    );
  }
});

test("Can catch all wrong inputs for fields in tracker JSON", () => {
  const invalidJSON = `{
							"name": 1,
							"type": 1,
							"initialValue": 1
					}`;
  const parsedTracker = validateTrackerJSON(invalidJSON);
  expect(isLeft(parsedTracker)).toBeTruthy();
  if (isLeft(parsedTracker)) {
    const errors = unwrapEither(parsedTracker);

    expect(errors.length).toEqual(3);
    expect(errors[0].message).toEqual(
      "Invalid input: expected string, received number: Field name"
    );
    expect(errors[1].message).toEqual("Unsupported type: Field type");
    expect(errors[2].message).toEqual(
      "Invalid input: Field initialValue"
    );
  }
});

test("Can return error if tracker JSON is invalid", () => {
  const invalidTrackerJSON = JSON.parse(trackerJSON);
  invalidTrackerJSON.name = 23; // Change name to a number to make it invalid
  const parsedTracker = validateTrackerJSON(JSON.stringify(invalidTrackerJSON));
  expect(isLeft(parsedTracker)).toBeTruthy();
  if (isLeft(parsedTracker)) {
    const errors = unwrapEither(parsedTracker);
    expect(errors.length).toEqual(1);
    expect(errors[0].message).toEqual(
      "Invalid input: expected string, received number: Field name"
    );
  }
});

test("Can return multiple errors if tracker JSON is invalid", () => {
  const invalidTrackerJSON = JSON.parse(trackerJSON);
  invalidTrackerJSON.name = 23; // Change name to a number to make it invalid
  delete invalidTrackerJSON.initialValue; // Remove initialValue to make it invalid
  const parsedTracker = validateTrackerJSON(JSON.stringify(invalidTrackerJSON));
  expect(isLeft(parsedTracker)).toBeTruthy();
  if (isLeft(parsedTracker)) {
    const errors = unwrapEither(parsedTracker);
    expect(errors.length).toEqual(2);
    expect(errors[0].message).toEqual(
      "Invalid input: expected string, received number: Field name"
    );
    expect(errors[1].message).toEqual(
      "Invalid input: Field initialValue"
    );
  }
});


test("Can validate mapped tracker JSON", () => {
  const parsedJSON = JSON.parse(mappedTrackerJSON);
  const parsedTracker = validateMappedTrackerJSON(mappedTrackerJSON);
  expect(isRight(parsedTracker)).toBeTruthy();
  if (isRight(parsedTracker)) {
    const tracker = unwrapEither(parsedTracker);

    expect(tracker.name).toEqual(parsedJSON.name);
  }
});


test("Can validate policy JSON", () => {
  const parsedPolicy = validatePolicyJSON(policyJSON);
  expect(isRight(parsedPolicy)).toBeTruthy();
  if (isRight(parsedPolicy)) {
    const policy = unwrapEither(parsedPolicy);
    expect(policy.Policy).toEqual(JSON.parse(policyJSON).Policy);
  }
});

test("Can validate full policy JSON", () => {
  const parsedPolicy = validatePolicyJSON(policyJSONFull);
  expect(isRight(parsedPolicy)).toBeTruthy();
  if (isRight(parsedPolicy)) {
    const policy = unwrapEither(parsedPolicy);
    expect(policy.Policy).toEqual(JSON.parse(policyJSONFull).Policy);
  }
});

test("Can catch missing calling function in foreign call in policy JSON", () => {
  const parsedInput = JSON.parse(policyJSONFull);
  parsedInput.ForeignCalls[0].callingFunction = "transferTo(uint256 value)";
  const parsedPolicy = validatePolicyJSON(JSON.stringify(parsedInput));
  expect(isRight(parsedPolicy)).toBeFalsy();
  if (isLeft(parsedPolicy)) {
    const errors = unwrapEither(parsedPolicy);
    expect(errors[0].message).toEqual(
      "Invalid reference call"
    );
  }
});

test("Can catch missing foreign call in condition in policy JSON", () => {
  const parsedInput = JSON.parse(policyJSONFull);
  parsedInput.Rules[0].condition = "FC:SimpleForeignCallMissing > 500 AND (TR:SimpleStringTracker == 'test' OR TR:SimpleMappedTracker(to) > 100)";
  const parsedPolicy = validatePolicyJSON(JSON.stringify(parsedInput));
  expect(isRight(parsedPolicy)).toBeFalsy();
  if (isLeft(parsedPolicy)) {
    const errors = unwrapEither(parsedPolicy);
    expect(errors[0].message).toEqual(
      "Invalid reference call"
    );
  }
});

test("Can catch missing tracker in condition in policy JSON", () => {
  const parsedInput = JSON.parse(policyJSONFull);
  parsedInput.Rules[0].condition = "FC:SimpleForeignCall > 500 AND (TR:SimpleStringTrackerMissing == 'test' OR TR:SimpleMappedTracker(to) > 100)";
  const parsedPolicy = validatePolicyJSON(JSON.stringify(parsedInput));
  expect(isRight(parsedPolicy)).toBeFalsy();
  if (isLeft(parsedPolicy)) {
    const errors = unwrapEither(parsedPolicy);
    expect(errors[0].message).toEqual(
      "Invalid reference call"
    );
  }
});

test("Can catch missing mapped tracker in condition in policy JSON", () => {
  const parsedInput = JSON.parse(policyJSONFull);
  parsedInput.Rules[0].condition = "FC:SimpleForeignCall > 500 AND (TR:SimpleStringTracker == 'test' OR TR:SimpleMappedTrackerMissing(to) > 100)";
  const parsedPolicy = validatePolicyJSON(JSON.stringify(parsedInput));
  expect(isRight(parsedPolicy)).toBeFalsy();
  if (isLeft(parsedPolicy)) {
    const errors = unwrapEither(parsedPolicy);
    expect(errors[0].message).toEqual(
      "Invalid reference call"
    );
  }
});

test("Can catch missing calling function encoded value in foreign call valueToPass in policy JSON", () => {
  const parsedInput = JSON.parse(policyJSONFull);
  parsedInput.ForeignCalls[0].valuesToPass = "transferTo";
  const parsedPolicy = validatePolicyJSON(JSON.stringify(parsedInput));
  expect(isRight(parsedPolicy)).toBeFalsy();
  if (isLeft(parsedPolicy)) {
    const errors = unwrapEither(parsedPolicy);
    expect(errors[0].message).toEqual(
      "Invalid reference call"
    );
  }
});

test("Can catch all missing required fields in policy JSON", () => {
  const parsedPolicy = validatePolicyJSON("{}");
  expect(isLeft(parsedPolicy)).toBeTruthy();
  if (isLeft(parsedPolicy)) {
    const errors = unwrapEither(parsedPolicy);

    expect(errors.length).toEqual(8);
    expect(errors[0].message).toEqual(
      "Invalid input: expected string, received undefined: Field Policy"
    );
    expect(errors[1].message).toEqual(
      "Invalid input: expected string, received undefined: Field Description"
    );
    expect(errors[2].message).toEqual(
      "Invalid input: expected string, received undefined: Field PolicyType"
    );
    expect(errors[3].message).toEqual(
      "Invalid input: expected array, received undefined: Field CallingFunctions"
    );
    expect(errors[4].message).toEqual(
      "Invalid input: expected array, received undefined: Field ForeignCalls"
    );
    expect(errors[5].message).toEqual(
      "Invalid input: expected array, received undefined: Field Trackers"
    );
    expect(errors[7].message).toEqual(
      "Invalid input: expected array, received undefined: Field Rules"
    );
  }
});

test("Can catch all wrong inputs for fields in policy JSON", () => {
  const invalidJSON = `
		{
		"Policy": 1,
    "Description": "Test",
		"PolicyType": 1,
		"CallingFunctions": "mop",
		"ForeignCalls": "foo",
		"Trackers": "bar",
		"Rules": "baz"
		}`;
  const parsedPolicy = validatePolicyJSON(invalidJSON);
  expect(isLeft(parsedPolicy)).toBeTruthy();
  if (isLeft(parsedPolicy)) {
    const errors = unwrapEither(parsedPolicy);

    expect(errors.length).toEqual(7);
    expect(errors[0].message).toEqual(
      "Invalid input: expected string, received number: Field Policy"
    );
    expect(errors[1].message).toEqual(
      "Invalid input: expected string, received number: Field PolicyType"
    );
    expect(errors[2].message).toEqual(
      "Invalid input: expected array, received string: Field CallingFunctions"
    );
    expect(errors[3].message).toEqual(
      "Invalid input: expected array, received string: Field ForeignCalls"
    );
    expect(errors[4].message).toEqual(
      "Invalid input: expected array, received string: Field Trackers"
    );
    expect(errors[6].message).toEqual(
      "Invalid input: expected array, received string: Field Rules"
    );
  }
});

test("Can return error if policy JSON is invalid", () => {
  const invalidPolicyJSON = JSON.parse(policyJSON);
  invalidPolicyJSON.Policy = 123; // Change Policy to a number to make it invalid
  const parsedPolicy = validatePolicyJSON(JSON.stringify(invalidPolicyJSON));
  expect(isLeft(parsedPolicy)).toBeTruthy();
  if (isLeft(parsedPolicy)) {
    const errors = unwrapEither(parsedPolicy);
    expect(errors[0].message).toEqual(
      "Invalid input: expected string, received number: Field Policy"
    );
  }
});

test("Can return multiple errors if policy JSON is invalid", () => {
  const invalidPolicyJSON = JSON.parse(policyJSON);
  invalidPolicyJSON.Policy = 123; // Change Policy to a number to make it invalid
  delete invalidPolicyJSON.PolicyType; // Remove PolicyType to make it invalid
  const parsedPolicy = validatePolicyJSON(JSON.stringify(invalidPolicyJSON));
  expect(isLeft(parsedPolicy)).toBeTruthy();
  if (isLeft(parsedPolicy)) {
    const errors = unwrapEither(parsedPolicy);
    expect(errors[0].message).toEqual(
      "Invalid input: expected string, received number: Field Policy"
    );
    expect(errors[1].message).toEqual(
      "Invalid input: expected string, received undefined: Field PolicyType"
    );
  }
});

test("Tests incorrect format for address", () => {
  var str = `{
		"name": "Simple Foreign Call",
		"address": "test",
		"function": "testSig(address,string,uint256)",
		"returnType": "uint256",
		"valuesToPass": "0, 1, 2"
		}`;

  var retVal = unwrapEither(validateForeignCallJSON(str)) as RulesError[];
  expect(retVal[0].message).toEqual("Address is invalid: Field address");
});

test("Tests unsupported return type", () => {
  var str = `{
		"name": "Simple Foreign Call",
		"address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
		"function": "testSig(address,string,uint256)",
		"returnType": "notAnInt",
		"valuesToPass": "0, 1, 2"
		}`;
  var retVal = unwrapEither(validateForeignCallJSON(str)) as RulesError[];
  expect(retVal[0].message).toEqual(
    "Unsupported return type: Field returnType"
  );
});

test("Tests unsupported argument type", () => {
  var str = `{
		"name": "Simple Foreign Call",
		"address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
		"function": "testSig(address,notAnInt,uint256)",
		"returnType": "uint256",
		"valuesToPass": "0, 1, 2"
		}`;

  var retVal = unwrapEither(validateForeignCallJSON(str)) as RulesError[];
  expect(retVal[0].message).toEqual(
    "Unsupported argument type: Field function"
  );
});

test("Tests unsupported type", () => {
  var str = `{
				"name": "Simple String Tracker",
				"type": "book",
				"initialValue": "test"
				}`;
  var retVal = unwrapEither(validateTrackerJSON(str)) as RulesError[];
  expect(retVal[0].message).toEqual("Unsupported type: Field type");
});

test("Tests can safely parse json", () => {
  const str = `{
				"type": 1,
				"name": "foo"
				}`;
  const retVal = safeParseJson(str);
  expect(isRight(retVal)).toBeTruthy();
  const parsed = unwrapEither(retVal) as any;
  expect(parsed.type).toEqual(1);
  expect(parsed.name).toEqual("foo");
});

test("Tests can return error when parsing invalid json", () => {
  const str = `{
				"type": 1,
				"name": "foo",
				}`;
  const retVal = safeParseJson(str);
  expect(isLeft(retVal)).toBeTruthy();
  const parsed = unwrapEither(retVal) as RulesError[];
  expect(parsed[0].message).toEqual("Failed to parse JSON");
});

test("Tests formatParenConditionGroups", () => {
  const str = `FC:GetValue > 500 AND (FC:GetValue < 100 OR FC:GetValue > 200)`;
  const groups = formatParenConditionGroups(str);
  expect(groups.finalGroups.length).toEqual(2);
});

test("Tests formatParenConditionGroups nested second group", () => {
  const str = `FC:GetValue > 500 AND (FC:GetValue < 100 OR (FC:GetValue > 200 AND TR:TestTracker > 100)) `;
  const groups = formatParenConditionGroups(str);
  expect(groups.finalGroups.length).toEqual(3);
});

test("Tests formatParenConditionGroups single group", () => {
  const str = `FC:GetValue > 500`;
  const groups = formatParenConditionGroups(str);
  expect(groups.finalGroups.length).toEqual(1);
});

test("Tests formatParenConditionGroups nested first group", () => {
  const str = `(FC:GetValue < 100 OR (FC:GetValue > 200 AND TR:TestTracker > 100)) AND FC:GetValue > 500`;
  const groups = formatParenConditionGroups(str);
  expect(groups.finalGroups.length).toEqual(3);
});

test("Tests formatParenConditionGroups nested both groups", () => {
  const str = `(FC:GetValue < 100 OR (FC:GetValue > 200 AND TR:TestTracker > 100)) AND (TR:TestTracker > 400 AND (FC:GetValue > 500 AND FC:GetRole == "Admin"))`;
  const groups = formatParenConditionGroups(str);
  expect(groups.finalGroups.length).toEqual(5);
});

test("Tests formatParenConditionGroups catches missing paren", () => {
  const str = `(FC:GetValue < 100 OR (FC:GetValue > 200 AND TR:TestTracker > 100) AND FC:GetValue > 500`;
  const isValid = validateCondition(str)

  expect(isValid).toBeFalsy();
});

test("Tests formatParenConditionGroups catches multiple AND operators", () => {
  const str = `(FC:GetValue < 100 OR (FC:GetValue > 200 AND TR:TestTracker > 100)) AND FC:GetValue > 500 AND FC:GetScore > 100`;
  const isValid = validateCondition(str)

  expect(isValid).toBeFalsy();
});

test("Tests formatParenConditionGroups catches multiple OR operators", () => {
  const str = `(FC:GetValue < 100 OR (FC:GetValue > 200 AND TR:TestTracker > 100)) OR FC:GetValue > 500 OR FC:GetScore > 100`;
  const isValid = validateCondition(str)

  expect(isValid).toBeFalsy();
});

test("Tests formatPrenConditionGroups catches AND and OR operators", () => {
  const str = `(FC:GetValue < 100 OR (FC:GetValue > 200 AND TR:TestTracker > 100)) OR FC:GetValue > 500 OR FC:GetScore > 100`;
  const isValid = validateCondition(str)

  expect(isValid).toBeFalsy();
});

test("Tests can validate all Tracker types", () => {
  const pTypesTestInputs = [
    { pType: "address", success: "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC", failure: "test" },
    { pType: "string", success: "test", failure: 123 },
    { pType: "uint256", success: "123", failure: "test" },
    { pType: "bool", success: "true", failure: 123 },
    { pType: "bytes", success: "0x1234", failure: 123 },
    { pType: "address[]", success: ["0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC", "0xdadB0d80178819F2319190D340ce9A924f783711", "0x870585E3AF9dA7ff5dcd8f897EA0756f60F69cc1"], failure: ["0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC", "0xdadB0d80178819F2319190D340ce9A924f783711", "test"] },
    { pType: "uint256[]", success: ["123", "456", "78"], failure: ["123", "45", "test"] },
    { pType: "bool[]", success: ["true", "false", "true"], failure: ["true", "false", null] },
    { pType: "string[]", success: ["test", "an", "arrayTracker"], failure: ["0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC", "0xdadB0d80178819F2319190D340ce9A924f783711", 123] },
    { pType: "bytes[]", success: ["0x1234", "0x5678", "0x7890"], failure: ["0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC", "0xdadB0d80178819F2319190D340ce9A924f783711", 123] },
  ];
  const testTracker = JSON.parse(trackerJSON);

  pTypesTestInputs.forEach((input) => {
    testTracker.type = input.pType;
    testTracker.initialValue = input.success;
    const trackerJSONSuccess = JSON.stringify(testTracker);
    const parsedTrackerSuccess = validateTrackerJSON(trackerJSONSuccess);

    expect(isRight(parsedTrackerSuccess), `Tracker Validation Failed for type: ${input.pType} and initial value ${input.success}`).toBeTruthy();

    testTracker.type = input.pType;
    testTracker.initialValue = input.failure;
    const trackerJSONFailure = JSON.stringify(testTracker);
    const parsedTrackerFailure = validateTrackerJSON(trackerJSONFailure);

    expect(isLeft(parsedTrackerFailure), `Tracker Validation Passed for type: ${input.pType} and initial value ${input.failure}`).toBeTruthy();

  })
});

test("Tests can validate all Mapped Tracker initial value types", () => {
  const pTypesTestInputs = [
    { pType: "address", success: [["1", "2", "3"], ["0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC", "0xdadB0d80178819F2319190D340ce9A924f783711", "0x870585E3AF9dA7ff5dcd8f897EA0756f60F69cc1"]], failure: [["1"], ["test"]] },
    { pType: "string", success: [["1", "2", "3"], ["test", "an", "trackerArray"]], failure: [["1", "2", "3"], ["test", "an", 123]] },
    { pType: "uint256", success: [["1", "2", "3"], ["123", "456", "789"]], failure: [["1", "2", "3"], ["1", "2", "test"]] },
    { pType: "bool", success: [["1", "2", "3"], ["true", "false", "false"]], failure: [["1", "2", "3"], ["false", "true", null]] },
    { pType: "bytes", success: [["1", "2", "3"], ["0x1234", "0x5678", "0x9abc"]], failure: [["1", "2", "3"], ["0x1234", "0x5678", 123]] },
    { pType: "address[]", success: [["1", "2", "3"], [["0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC", "0xdadB0d80178819F2319190D340ce9A924f783711", "0x870585E3AF9dA7ff5dcd8f897EA0756f60F69cc1"], ["0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC", "0xdadB0d80178819F2319190D340ce9A924f783711", "0x870585E3AF9dA7ff5dcd8f897EA0756f60F69cc1"], ["0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC", "0xdadB0d80178819F2319190D340ce9A924f783711", "0x870585E3AF9dA7ff5dcd8f897EA0756f60F69cc1"]]], failure: [["1", "2", "3"], [["0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC", "0xdadB0d80178819F2319190D340ce9A924f783711", "0x870585E3AF9dA7ff5dcd8f897EA0756f60F69cc1"], ["0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC", "0xdadB0d80178819F2319190D340ce9A924f783711", "0x870585E3AF9dA7ff5dcd8f897EA0756f60F69cc1"], ["0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC", "0xdadB0d80178819F2319190D340ce9A924f783711", "test"]]] },
    { pType: "uint256[]", success: [["1", "2", "3"], [["123", "456", "78"], ["1293", "4656", "278"], ["23", "45", "9"]]], failure: [["1", "2", "3"], [["123", "456", "78"], ["1293", "4656", "278"], ["23", "45", "test"]]] },
    { pType: "bool[]", success: [["1", "2", "3"], [["true", "false", "true"], ["true", "false", "true"], ["true", "false", "true"]]], failure: [["1", "2", "3"], [["true", "false", "true"], ["true", "false", "true"], ["true", "false", null]]] },
    { pType: "string[]", success: [["1", "2", "3"], [["test", "an", "arrayTracker"], ["test", "an", "arrayTracker"], ["test", "an", "arrayTracker"]]], failure: [["1", "2", "3"], [["test", "an", "arrayTracker"], ["test", "an", "arrayTracker"], ["test", "an", 123]]] },
    { pType: "bytes[]", success: [["1", "2", "3"], [["0x1234", "0x5678", "0x7890"], ["0x1234", "0x5678", "0x7890"], ["0x1234", "0x5678", "0x7890"]]], failure: [["1", "2", "3"], [["0x1234", "0x5678", "0x7890"], ["0x1234", "0x5678", "0x7890"], ["0x1234", "0x5678", 12]]] },
  ];
  const testTracker = JSON.parse(mappedTrackerJSON);

  pTypesTestInputs.forEach((input) => {
    testTracker.valueType = input.pType;
    testTracker.initialKeys = input.success[0];
    testTracker.initialValues = input.success[1];
    const trackerJSONSuccess = JSON.stringify(testTracker);
    const parsedTrackerSuccess = validateMappedTrackerJSON(trackerJSONSuccess);

    expect(isRight(parsedTrackerSuccess), `Tracker Validation Failed for type: ${input.pType} and initial value ${input.success}`).toBeTruthy();

    testTracker.valueType = input.pType;
    testTracker.initialKeys = input.failure[0];
    testTracker.initialValues = input.failure[1];
    const trackerJSONFailure = JSON.stringify(testTracker);
    const parsedTrackerFailure = validateMappedTrackerJSON(trackerJSONFailure);

    expect(isLeft(parsedTrackerFailure), `Tracker Validation Passed for type: ${input.pType} and initial value ${input.failure}`).toBeTruthy();

  });
});

test("Tests can validate all Mapped Tracker initial key types", () => {
  const pTypesTestInputs = [
    { pType: "address", success: [["0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC", "0xdadB0d80178819F2319190D340ce9A924f783711", "0x870585E3AF9dA7ff5dcd8f897EA0756f60F69cc1"], ["123", "456", "78"]], failure: [["0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC", "0xdadB0d80178819F2319190D340ce9A924f783711", "1"], ["123", "456", "78"]] },
    { pType: "string", success: [["test", "an", "arrayTracker"], ["123", "456", "78"]], failure: [["test", "an", 123], ["123", "456", "78"]] },
    { pType: "uint256", success: [["1", "23", "67"], ["123", "456", "78"]], failure: [["1", "23", "test"], ["123", "456", "78"]] },
    { pType: "bool", success: [["true", "false"], ["123", "456"]], failure: [["true", null], ["123", "78"]] },
    { pType: "bytes", success: [["0x1234", "0x5678", "0x7890"], ["123", "456", "78"]], failure: [["0x1234", "0x5678", 1], ["123", "456", "78"]] }
  ]
  const testTracker = JSON.parse(mappedTrackerJSON);

  pTypesTestInputs.forEach((input) => {
    testTracker.keyType = input.pType;
    testTracker.initialKeys = input.success[0];
    testTracker.initialValues = input.success[1];
    const trackerJSONSuccess = JSON.stringify(testTracker);
    const parsedTrackerSuccess = validateMappedTrackerJSON(trackerJSONSuccess);

    expect(isRight(parsedTrackerSuccess), `Mapped Tracker Validation Failed for type: ${input.pType} and initial key ${input.success}`).toBeTruthy();

    testTracker.keyType = input.pType;
    testTracker.initialKeys = input.failure[0];
    testTracker.initialValues = input.failure[1];
    const trackerJSONFailure = JSON.stringify(testTracker);
    const parsedTrackerFailure = validateMappedTrackerJSON(trackerJSONFailure);

    expect(isLeft(parsedTrackerFailure), `Mapped Tracker Validation Passed for type: ${input.pType} and initial key ${input.failure}`).toBeTruthy();

  });
});

test("Tests can catch Mapped Tracker invalid key type", () => {
  const pTypesTestInputs = [
    "address[]",
    "string[]",
    "uint256[]",
    "bool[]",
    "bytes[]"
  ]
  const testTracker = JSON.parse(mappedTrackerJSON);

  pTypesTestInputs.forEach((input) => {

    testTracker.keyType = input;
    const trackerJSONFailure = JSON.stringify(testTracker);
    const parsedTrackerFailure = validateMappedTrackerJSON(trackerJSONFailure);

    expect(isLeft(parsedTrackerFailure), `Mapped Tracker Validation Passed for keytype: ${input}`).toBeTruthy();

  });
});

test("Tests can catch all unequal mapped tracker initial keys and values length", () => {
  const testTracker = JSON.parse(mappedTrackerJSON);

  testTracker.initialKeys.push("100")

  const parsedTracker = validateMappedTrackerJSON(JSON.stringify(testTracker));

  expect(isLeft(parsedTracker), `Mapped Tracker Validation Passed for unequal initial keys and values length`).toBeTruthy();
});

test("Tests can catch mapped tracker duplicate keys", () => {
  const testTracker = JSON.parse(mappedTrackerJSON);

  testTracker.initialKeys.push("1")
  testTracker.initialValues.push("100")

  const parsedTracker = validateMappedTrackerJSON(JSON.stringify(testTracker));
  expect(isLeft(parsedTracker), `Mapped Tracker Validation Passed with duplicate keys`).toBeTruthy();
});
