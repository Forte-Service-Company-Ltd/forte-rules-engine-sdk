import { expect, test } from "vitest";
import {
  validateRuleJSON,
  validateForeignCallJSON,
  validateTrackerJSON,
  validatePolicyJSON,
  safeParseJson,
} from "../src/modules/validation";
import { isLeft, isRight, unwrapEither } from "../src/modules/utils";
import { RulesError } from "../src/modules/types";
import { safeParse } from "zod/v4/core";

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
      "Invalid input: expected string, received undefined: Field initialValue"
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
      "Invalid input: expected string, received number: Field initialValue"
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
      "Invalid input: expected string, received undefined: Field initialValue"
    );
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
