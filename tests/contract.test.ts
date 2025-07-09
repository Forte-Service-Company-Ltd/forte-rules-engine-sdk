/// SPDX-License-Identifier: BUSL-1.1
import { getAddress, toFunctionSelector, toHex } from "viem";
import { expect, test, describe, beforeAll, beforeEach } from "vitest";
import {
  getConfig,
  DiamondAddress,
  connectConfig,
  createTestConfig,
  foundryAccountAddress,
} from "../config";
import {
  getRulesEnginePolicyContract,
  getRulesEngineComponentContract,
  getRulesEngineRulesContract,
  getRulesEngineAdminContract,
} from "../src/modules/contract-interaction-utils";
import {
  createForeignCall,
  deleteForeignCall,
  updateForeignCall,
  getForeignCall,
  getAllForeignCalls,
} from "../src/modules/foreign-calls";
import {
  createCallingFunction,
  deleteCallingFunction,
} from "../src/modules/calling-functions";
import {
  createPolicy,
  updatePolicy,
  deletePolicy,
  getPolicy,
  policyExists,
  getAppliedPolicyIds,
  setPolicies,
  isClosedPolicy,
  closePolicy,
  openPolicy,
  isClosedPolicySubscriber,
  addClosedPolicySubscriber,
  removeClosedPolicySubscriber,
  cementPolicy,
  isCementedPolicy,
} from "../src/modules/policy";
import {
  createRule,
  getAllRules,
  updateRule,
  deleteRule,
} from "../src/modules/rules";
import {
  createTracker,
  updateTracker,
  getTracker,
  getAllTrackers,
  deleteTracker,
} from "../src/modules/trackers";
import { sleep } from "../src/modules/contract-interaction-utils";
import { Config } from "@wagmi/core";
import {
  confirmNewCallingContractAdmin,
  confirmNewForeignCallAdmin,
  confirmNewPolicyAdmin,
  grantCallingContractRole_Utility,
  grantForeignCallRole_Utility,
  isCallingContractAdmin,
  isForeignCallAdmin,
  isPolicyAdmin,
  proposeNewCallingContractAdmin,
  proposeNewForeignCallAdmin,
  proposeNewPolicyAdmin,
} from "../src/modules/admin";

// Hardcoded address of the diamond in diamondDeployedAnvilState.json
var config: Config;
var client: any;
var secondUserConfig: Config;
var secondUserClient: any;

// Take snapshot
export const takeSnapshot = async () => {
  const snapshotId = await client.snapshot();
  return snapshotId;
};

// Revert to snapshot
export const revertToSnapshot = async (snapshotId: any) => {
  await client.revert({ id: snapshotId });
};

describe("Rules Engine Interactions", async () => {
  const rulesEngineContract: `0x${string}` = DiamondAddress;
  // Vanity address for now, lets try to eventually deploy a real token contract and use that here instead
  const policyApplicant: `0x${string}` = getAddress(
    "0xDeadBeefDeadBeefDeadBeefDeadBeefDeadBeef"
  );
  let snapshotId: `0x${string}`;
  config = await createTestConfig();
  client = config.getClient({ chainId: config.chains[0].id });
  secondUserConfig = await createTestConfig(false);
  secondUserClient = secondUserConfig.getClient({
    chainId: secondUserConfig.chains[0].id,
  });

  beforeAll(async () => {
    await connectConfig(config, 0);
    await connectConfig(secondUserConfig, 0);
    snapshotId = await takeSnapshot();
  });

  beforeEach(async () => {
    await revertToSnapshot(snapshotId);
  });

  const options = {
    timeout: 999999,
  };
  test("Can create a new rule", async () => {
    var result = await createPolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      getRulesEngineRulesContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client)
    );
    var callingFunction = "addValue(uint256 value)";
    const fsId = await createCallingFunction(
      config,
      getRulesEngineComponentContract(rulesEngineContract, client),
      result.policyId,
      callingFunction,
      "uint256 value"
    );
    var ruleStringA = `{
        "condition": "3 + 4 > 5 AND (1 == 1 AND 2 == 2)",
        "positiveEffects": ["revert"],
        "negativeEffects": [],
        "callingFunction": "addValue(uint256 value)"
        }`;
    var ruleId = await createRule(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      getRulesEngineRulesContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client),
      result.policyId,
      ruleStringA,
      [
        { id: 1, name: "testCall", type: 0 },
        { id: 2, name: "testCallTwo", type: 0 },
      ],
      []
    );
    expect(ruleId).toBeGreaterThan(0);
    var selector = toFunctionSelector(callingFunction);
    await updatePolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      result.policyId,
      [selector],
      [fsId],
      [[ruleId]]
    );
    var rules = await getAllRules(
      config,
      getRulesEngineRulesContract(rulesEngineContract, client),
      result.policyId
    );
    expect(rules?.length).toEqual(1);
  });
  test("Can delete a calling function", async () => {
    var result = await createPolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      getRulesEngineRulesContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client)
    );
    var callingFunction = "addValue(uint256 value)";
    const fsId = await createCallingFunction(
      config,
      getRulesEngineComponentContract(rulesEngineContract, client),
      result.policyId,
      callingFunction,
      "uint256 value"
    );
    var ruleStringA = `{
              "condition": "3 + 4 > 5 AND (1 == 1 AND 2 == 2)",
              "positiveEffects": ["revert"],
              "negativeEffects": [],
              "callingFunction": "addValue(uint256 value)"
              }`;
    var ruleId = await createRule(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      getRulesEngineRulesContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client),
      result.policyId,
      ruleStringA,
      [
        { id: 1, name: "testCall", type: 0 },
        { id: 2, name: "testCallTwo", type: 0 },
      ],
      []
    );
    expect(ruleId).toBeGreaterThan(0);
    var selector = toFunctionSelector(callingFunction);
    await updatePolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      result.policyId,
      [selector],
      [fsId],
      [[ruleId]]
    );
    var rules = await getAllRules(
      config,
      getRulesEngineRulesContract(rulesEngineContract, client),
      result.policyId
    );
    expect(rules?.length).toEqual(1);
    await deleteCallingFunction(
      config,
      getRulesEngineComponentContract(rulesEngineContract, client),
      result.policyId,
      fsId
    );
    var newRules = await getAllRules(
      config,
      getRulesEngineRulesContract(rulesEngineContract, client),
      result.policyId
    );
    expect(newRules?.length).toEqual(0);
  });
  test("Can update an existing rule", async () => {
    var result = await createPolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      getRulesEngineRulesContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client)
    );
    var callingFunction = "addValue(uint256 value)";
    const fsId = await createCallingFunction(
      config,
      getRulesEngineComponentContract(rulesEngineContract, client),
      result.policyId,
      callingFunction,
      "uint256 value"
    );
    var ruleStringA = `{
          "condition": "3 + 4 > 5 AND (1 == 1 AND 2 == 2)",
          "positiveEffects": ["revert"],
          "negativeEffects": [],
          "callingFunction": "addValue(uint256 value)"
          }`;
    var ruleId = await createRule(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      getRulesEngineRulesContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client),
      result.policyId,
      ruleStringA,
      [],
      [
        { id: 1, name: "testCall", type: 0 },
        { id: 2, name: "testCallTwo", type: 0 },
      ]
    );
    expect(ruleId).toBeGreaterThan(0);
    var selector = toFunctionSelector(callingFunction);
    await updatePolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      result.policyId,
      [selector],
      [fsId],
      [[ruleId]]
    );
    var rules = await getAllRules(
      config,
      getRulesEngineRulesContract(rulesEngineContract, client),
      result.policyId
    );
    expect(rules?.length).toEqual(1);
    var ruleStringB = `{
          "condition": "3 + 4 > 5 AND (value == 1 AND 2 == 2)",
          "positiveEffects": ["revert"],
          "negativeEffects": [],
          "callingFunction": "addValue(uint256 value)"
          }`;
    var updatedRuleId = await updateRule(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      getRulesEngineRulesContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client),
      result.policyId,
      ruleId,
      ruleStringB,
      [
        { id: 1, name: "testCall", type: 0 },
        { id: 2, name: "testCallTwo", type: 0 },
      ],
      []
    );
    expect(updatedRuleId).toEqual(ruleId);
  });
  test("Can delete a rule", async () => {
    var result = await createPolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      getRulesEngineRulesContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client)
    );
    var callingFunction = "addValue(uint256 value)";
    const fsId = await createCallingFunction(
      config,
      getRulesEngineComponentContract(rulesEngineContract, client),
      result.policyId,
      callingFunction,
      "uint256 value"
    );
    var ruleStringA = `{
          "condition": "3 + 4 > 5 AND (1 == 1 AND 2 == 2)",
          "positiveEffects": ["revert"],
          "negativeEffects": [],
          "callingFunction": "addValue(uint256 value)"
          }`;
    var ruleId = await createRule(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      getRulesEngineRulesContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client),
      result.policyId,
      ruleStringA,
      [
        { id: 1, name: "testCall", type: 0 },
        { id: 2, name: "testCallTwo", type: 0 },
      ],
      []
    );
    expect(ruleId).toBeGreaterThan(0);
    var selector = toFunctionSelector(callingFunction);
    await updatePolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      result.policyId,
      [selector],
      [fsId],
      [[ruleId]]
    );

    var rules = await getAllRules(
      config,
      getRulesEngineRulesContract(rulesEngineContract, client),
      result.policyId
    );
    expect(rules?.length).toEqual(1);
    await deleteRule(
      config,
      getRulesEngineRulesContract(rulesEngineContract, client),
      result.policyId,
      ruleId
    );
    var rules = await getAllRules(
      config,
      getRulesEngineRulesContract(rulesEngineContract, client),
      result.policyId
    );
    expect(rules?.length).toEqual(1);
    expect(rules![0][0].instructionSet.length).toEqual(0);
  });
  test("Can create a new foreign call", async () => {
    var result = await createPolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      getRulesEngineRulesContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client)
    );

    var callingFunction =
      "someFunction(address to, string someString, uint256 value)";
    const fsId = await createCallingFunction(
      config,
      getRulesEngineComponentContract(rulesEngineContract, client),
      result.policyId,
      callingFunction,
      "address to, string someString, uint256 value"
    );

    var selector = toFunctionSelector(callingFunction);
    await updatePolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      result.policyId,
      [selector],
      [fsId],
      [[]]
    );

    var fcSyntax = `{
          "name": "Simple Foreign Call",
          "address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
          "function": "testSig(address,string,uint256)",
          "returnType": "uint256",
          "valuesToPass": "to, someString, value",
          "callingFunction": "someFunction(address to, string someString, uint256 value)"
          }`;
    var fcId = await createForeignCall(
      config,
      getRulesEngineComponentContract(rulesEngineContract, client),
      getRulesEnginePolicyContract(rulesEngineContract, client),
      result.policyId,
      fcSyntax
    );
    var fcRetrieve = await getForeignCall(
      config,
      getRulesEngineComponentContract(rulesEngineContract, client),
      result.policyId,
      fcId
    );
    expect(fcRetrieve?.foreignCallIndex).toEqual(fcId);
    var fcAllRetrieve = await getAllForeignCalls(
      config,
      getRulesEngineComponentContract(rulesEngineContract, client),
      result.policyId
    );
    expect(fcAllRetrieve?.length).toEqual(1);
  });

  test("Can create a new foreign call with a static array type", async () => {
    var result = await createPolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      getRulesEngineRulesContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client)
    );

    var callingFunction =
      "someFunction(address to, string someString, uint256[] values)";
    const fsId = await createCallingFunction(
      config,
      getRulesEngineComponentContract(rulesEngineContract, client),
      result.policyId,
      callingFunction,
      "address to, string someString, uint256[] values"
    );

    var selector = toFunctionSelector(callingFunction);
    await updatePolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      result.policyId,
      [selector],
      [fsId],
      [[]]
    );

    var fcSyntax = `{
          "name": "Simple Foreign Call",
          "address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
          "function": "testSig(address,string,uint256[])",
          "returnType": "uint256",
          "valuesToPass": "to, someString, values",
          "callingFunction": "someFunction(address to, string someString, uint256[] values)"
          }`;
    var fcId = await createForeignCall(
      config,
      getRulesEngineComponentContract(rulesEngineContract, client),
      getRulesEnginePolicyContract(rulesEngineContract, client),
      result.policyId,
      fcSyntax
    );
    var fcRetrieve = await getForeignCall(
      config,
      getRulesEngineComponentContract(rulesEngineContract, client),
      result.policyId,
      fcId
    );
    expect(fcRetrieve?.foreignCallIndex).toEqual(fcId);
    expect(fcRetrieve?.parameterTypes[2]).toEqual(6);
    console.log(fcRetrieve?.parameterTypes);
    console.log(fcRetrieve?.encodedIndices);
  });

  test("Can delete a foreign call", async () => {
    var result = await createPolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      getRulesEngineRulesContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client)
    );
    var callingFunction =
      "someFunction(address to, string someString, uint256 value)";
    const fsId = await createCallingFunction(
      config,
      getRulesEngineComponentContract(rulesEngineContract, client),
      result.policyId,
      callingFunction,
      "address to, string someString, uint256 value"
    );

    var selector = toFunctionSelector(callingFunction);
    await updatePolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      result.policyId,
      [selector],
      [fsId],
      [[]]
    );
    var fcSyntax = `{
                  "name": "Simple Foreign Call",
                  "address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
                  "function": "testSig(address)",
                  "returnType": "uint256",
                  "valuesToPass": "to",
                  "callingFunction": "someFunction(address to, string someString, uint256 value)"
              }`;
    var fcId = await createForeignCall(
      config,
      getRulesEngineComponentContract(rulesEngineContract, client),
      getRulesEnginePolicyContract(rulesEngineContract, client),
      result.policyId,
      fcSyntax
    );
    var fcRetrieve = await getForeignCall(
      config,
      getRulesEngineComponentContract(rulesEngineContract, client),
      result.policyId,
      fcId
    );
    expect(fcRetrieve?.foreignCallIndex).toEqual(fcId);
    var fcAllRetrieve = await getAllForeignCalls(
      config,
      getRulesEngineComponentContract(rulesEngineContract, client),
      result.policyId
    );
    expect(fcAllRetrieve?.length).toEqual(1);
    var ret = await deleteForeignCall(
      config,
      getRulesEngineComponentContract(rulesEngineContract, client),
      result.policyId,
      fcId
    );
    expect(ret).toEqual(0);
    fcAllRetrieve = await getAllForeignCalls(
      config,
      getRulesEngineComponentContract(rulesEngineContract, client),
      result.policyId
    );
    expect(fcAllRetrieve?.length).toEqual(1);
    expect(fcAllRetrieve![0].set).toEqual(false);
  });
  test("Can update an existing foreign call", async () => {
    var result = await createPolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      getRulesEngineRulesContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client)
    );
    var callingFunction =
      "someFunction(address to, string someString, uint256 value)";
    const fsId = await createCallingFunction(
      config,
      getRulesEngineComponentContract(rulesEngineContract, client),
      result.policyId,
      callingFunction,
      "address to, string someString, uint256 value"
    );

    var selector = toFunctionSelector(callingFunction);
    await updatePolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      result.policyId,
      [selector],
      [fsId],
      [[]]
    );
    var fcSyntax = `{
              "name": "Simple Foreign Call",
              "address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
              "function": "testSig(address)",
              "returnType": "uint256",
              "valuesToPass": "to",
              "callingFunction": "someFunction(address to, string someString, uint256 value)"
          }`;
    var fcId = await createForeignCall(
      config,
      getRulesEngineComponentContract(rulesEngineContract, client),
      getRulesEnginePolicyContract(rulesEngineContract, client),
      result.policyId,
      fcSyntax
    );
    var fcRetrieve = await getForeignCall(
      config,
      getRulesEngineComponentContract(rulesEngineContract, client),
      result.policyId,
      fcId
    );
    expect(fcRetrieve?.foreignCallIndex).toEqual(fcId);
    var fcAllRetrieve = await getAllForeignCalls(
      config,
      getRulesEngineComponentContract(rulesEngineContract, client),
      result.policyId
    );
    expect(fcAllRetrieve?.length).toEqual(1);
    var updatedSyntax = `{
              "name": "Simple Foreign Call",
              "address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
              "function": "testSig(address)",
              "returnType": "uint256",
              "valuesToPass": "to",
              "callingFunction": "someFunction(address to, string someString, uint256 value)"
          }`;
    var updatedId = await updateForeignCall(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client),
      result.policyId,
      fcId,
      updatedSyntax
    );
    expect(updatedId).toEqual(fcId);
  });
  test("Can create a new tracker", async () => {
    var trSyntax = `{
              "name": "Simple String Tracker",
              "type": "uint256",
              "initialValue": "4"
          }`;
    var result = await createPolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      getRulesEngineRulesContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client)
    );
    expect(result.policyId).toBeGreaterThan(0);
    var trId = await createTracker(
      config,
      getRulesEngineComponentContract(rulesEngineContract, client),
      result.policyId,
      trSyntax
    );
    var trAllRetrieve = await getAllTrackers(
      config,
      getRulesEngineComponentContract(rulesEngineContract, client),
      result.policyId
    );
    expect(trAllRetrieve?.length).toEqual(1);
    var trRetrieve = await getTracker(
      config,
      getRulesEngineComponentContract(rulesEngineContract, client),
      result.policyId,
      trId
    );
    expect(trRetrieve?.trackerValue).toEqual(
      "0x0000000000000000000000000000000000000000000000000000000000000004"
    );
  });
  test("Can delete a tracker", async () => {
    var trSyntax = `{
          "name": "Simple String Tracker",
          "type": "uint256",
          "initialValue": "4"
          }`;
    var result = await createPolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      getRulesEngineRulesContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client)
    );
    expect(result.policyId).toBeGreaterThan(0);
    var trId = await createTracker(
      config,
      getRulesEngineComponentContract(rulesEngineContract, client),
      result.policyId,
      trSyntax
    );
    var trAllRetrieve = await getAllTrackers(
      config,
      getRulesEngineComponentContract(rulesEngineContract, client),
      result.policyId
    );
    expect(trAllRetrieve?.length).toEqual(1);
    var trRetrieve = await getTracker(
      config,
      getRulesEngineComponentContract(rulesEngineContract, client),
      result.policyId,
      trId
    );
    expect(trRetrieve?.trackerValue).toEqual(
      "0x0000000000000000000000000000000000000000000000000000000000000004"
    );
    await deleteTracker(
      config,
      getRulesEngineComponentContract(rulesEngineContract, client),
      result.policyId,
      trId
    );
    var trAllRetrieve = await getAllTrackers(
      config,
      getRulesEngineComponentContract(rulesEngineContract, client),
      result.policyId
    );
    while (true) {
      if (trAllRetrieve![0].set) {
        await sleep(1000);
        trAllRetrieve = await getAllTrackers(
          config,
          getRulesEngineComponentContract(rulesEngineContract, client),
          result.policyId
        );
      } else {
        break;
      }
    }
    expect(trAllRetrieve![0].set).toEqual(false);
  });
  test("Can update an existing tracker", async () => {
    var trSyntax = `{
          "name": "Simple String Tracker",
          "type": "uint256",
          "initialValue": "4"
          }`;
    var result = await createPolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      getRulesEngineRulesContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client)
    );
    expect(result.policyId).toBeGreaterThan(0);
    var trId = await createTracker(
      config,
      getRulesEngineComponentContract(rulesEngineContract, client),
      result.policyId,
      trSyntax
    );
    var trAllRetrieve = await getAllTrackers(
      config,
      getRulesEngineComponentContract(rulesEngineContract, client),
      result.policyId
    );
    expect(trAllRetrieve?.length).toEqual(1);
    var trRetrieve = await getTracker(
      config,
      getRulesEngineComponentContract(rulesEngineContract, client),
      result.policyId,
      trId
    );
    expect(trRetrieve?.trackerValue).toEqual(
      "0x0000000000000000000000000000000000000000000000000000000000000004"
    );
    var updatedSyntax = `{
          "name": "Simple String Tracker",
          "type": "uint256",
          "initialValue": "5"
          }`;
    await updateTracker(
      config,
      getRulesEngineComponentContract(rulesEngineContract, client),
      result.policyId,
      trId,
      updatedSyntax
    );
    var updatedTRRetrieve = await getTracker(
      config,
      getRulesEngineComponentContract(rulesEngineContract, client),
      result.policyId,
      trId
    );
    expect(updatedTRRetrieve?.trackerValue).toEqual(
      "0x0000000000000000000000000000000000000000000000000000000000000005"
    );
  });
  test("Can retrieve a full policy", async () => {
    var policyJSON = `
          {
          "Policy": "Test Policy",
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
                  "name": "testSig(address)",
                  "address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
                  "function": "testSig(address)",
                  "returnType": "uint256",
                  "valuesToPass": "to",
                  "callingFunction": "transfer(address to, uint256 value)"
              }
          ],
          "Trackers": [
          {
              "name": "testTracker",
              "type": "string",
              "initialValue": "test"
          }
          ],
          "MappedTrackers": [],
          "Rules": [
              {
                  "condition": "TR:testTracker > 500",
                  "positiveEffects": ["emit Success"],
                  "negativeEffects": ["revert()"],
                  "callingFunction": "transfer(address to, uint256 value)"
              }
          ]
          }`;

    var result = await createPolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      getRulesEngineRulesContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client),
      policyJSON
    );
    expect(result.policyId).toBeGreaterThanOrEqual(0);
    var resultFC = await getAllForeignCalls(
      config,
      getRulesEngineComponentContract(rulesEngineContract, client),
      result.policyId
    );

    expect(resultFC?.length).toEqual(1);
    var resultTR = await getAllTrackers(
      config,
      getRulesEngineComponentContract(rulesEngineContract, client),
      result.policyId
    );
    expect(resultTR?.length).toEqual(1);
    var retVal = await getPolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      getRulesEngineRulesContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client),
      result.policyId
    );
    console.log(retVal);
    expect(retVal).toEqual(
      '{"Trackers":["testTracker --> string --> 0x000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000047465737400000000000000000000000000000000000000000000000000000000"],"ForeignCalls":["testSig(address) --> 0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC --> testSig(address) --> uint256"],"Rules":[{"condition":"TR:testTracker > 500","positiveEffects":["emit Success"],"negativeEffects":["revert()"],"callingFunction":"transfer(address to, uint256 value)"}]}'
    );
  });
  test("Can check if a policy exists", async () => {
    var policyJSON = `
      {
      "Policy": "Test Policy",
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
              "name": "testSigTwo(uint256)",
              "address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
              "function": "testSigTwo(uint256)",
              "returnType": "uint256",
              "valuesToPass": "value",
              "callingFunction": "transfer(address to, uint256 value)"
      },{
              "name": "testSig(address)",
              "address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
              "function": "testSig(uint256)",
              "returnType": "uint256",
              "valuesToPass": "FC:testSigTwo",
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
              "condition": "value > 500",
              "positiveEffects": ["emit Success"],
              "negativeEffects": ["revert()"],
              "callingFunction": "transfer(address to, uint256 value)"
          }
          ]
          }`;
    var result = await createPolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      getRulesEngineRulesContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client),
      policyJSON
    );
    var exists = await policyExists(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      result.policyId
    );
    expect(exists).toEqual(true);
  });
  test(
    "Can delete a full policy",
    async () => {
      var policyJSON = `
          {
          "Policy": "Test Policy",
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
                  "condition": "value > 500",
                  "positiveEffects": ["emit Success"],
                  "negativeEffects": ["revert()"],
                  "callingFunction": "transfer(address to, uint256 value)"
              }
          ]
          }`;
      var result = await createPolicy(
        config,
        getRulesEnginePolicyContract(rulesEngineContract, client),
        getRulesEngineRulesContract(rulesEngineContract, client),
        getRulesEngineComponentContract(rulesEngineContract, client),
        policyJSON
      );
      expect(result.policyId).toBeGreaterThan(0);
      await sleep(4000);

      await deletePolicy(
        config,
        getRulesEnginePolicyContract(rulesEngineContract, client),
        result.policyId
      );
      await sleep(4000);
      var rules = (await getAllRules(
        config,
        getRulesEngineRulesContract(rulesEngineContract, client),
        result.policyId
      )) as any;
      expect(rules?.length).toEqual(1);
      expect(rules![0].length).toEqual(0);
      var trAllRetrieve = await getAllTrackers(
        config,
        getRulesEngineComponentContract(rulesEngineContract, client),
        result.policyId
      );
      expect(trAllRetrieve?.length).toEqual(1);
      expect(trAllRetrieve![0].set).toEqual(false);
      var fcAllRetrieve = await getAllForeignCalls(
        config,
        getRulesEngineComponentContract(rulesEngineContract, client),
        result.policyId
      );
      expect(fcAllRetrieve?.length).toEqual(1);
      expect(fcAllRetrieve![0].set).toEqual(false);
    },
    { timeout: 15000 }
  );
  test("Can check if address is admin", async () => {
    var policyJSON = `
      {
      "Policy": "Test Policy",
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
              "condition": "value > 500",
              "positiveEffects": ["emit Success"],
              "negativeEffects": ["revert()"],
              "callingFunction": "transfer(address to, uint256 value)"
          }
          ]
          }`;
    var result = await createPolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      getRulesEngineRulesContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client),
      policyJSON
    );
    var admin = await isPolicyAdmin(
      config,
      getRulesEngineAdminContract(rulesEngineContract, client),
      result.policyId,
      getAddress(foundryAccountAddress)
    );
    expect(admin).toEqual(true);
  });
  test("Can update a policies admin", options, async () => {
    var policyJSON = `
      {
      "Policy": "Test Policy",
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
              "condition": "value > 500",
              "positiveEffects": ["emit Success"],
              "negativeEffects": ["revert()"],
              "callingFunction": "transfer(address to, uint256 value)"
          }
          ]
          }`;
    var result = await createPolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      getRulesEngineRulesContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client),
      policyJSON
    );
    proposeNewPolicyAdmin(
      config,
      getRulesEngineAdminContract(rulesEngineContract, client),
      result.policyId,
      getAddress("0x70997970C51812dc3A010C7d01b50e0d17dc79C8")
    );
    await sleep(5000);
    await confirmNewPolicyAdmin(
      secondUserConfig,
      getRulesEngineAdminContract(rulesEngineContract, secondUserClient),
      result.policyId
    );
    await sleep(5000);
    var admin = await isPolicyAdmin(
      config,
      getRulesEngineAdminContract(rulesEngineContract, client),
      result.policyId,
      getAddress("0x70997970C51812dc3A010C7d01b50e0d17dc79C8")
    );
    expect(admin).toEqual(true);
  });

  test("Can update a foreign call admin", options, async () => {
    grantForeignCallRole_Utility(
      config,
      getRulesEngineAdminContract(rulesEngineContract, client),
      getAddress("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"),
      getAddress("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"),
      "transfer(address,uint256"
    );
    proposeNewForeignCallAdmin(
      config,
      getRulesEngineAdminContract(rulesEngineContract, client),
      getAddress("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"),
      getAddress("0x70997970C51812dc3A010C7d01b50e0d17dc79C8"),
      "transfer(address,uint256"
    );
    await sleep(5000);
    await confirmNewForeignCallAdmin(
      secondUserConfig,
      getRulesEngineAdminContract(rulesEngineContract, secondUserClient),
      getAddress("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"),
      "transfer(address,uint256"
    );
    await sleep(5000);
    var admin = await isForeignCallAdmin(
      config,
      getRulesEngineAdminContract(rulesEngineContract, client),
      getAddress("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"),
      getAddress("0x70997970C51812dc3A010C7d01b50e0d17dc79C8"),
      "transfer(address,uint256"
    );
    expect(admin).toEqual(true);
  });

  test("Can cement a policy", options, async () => {
    var policyJSON = `
    {
    "Policy": "Test Policy",
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
            "condition": "value > 500",
            "positiveEffects": ["emit Success"],
            "negativeEffects": ["revert()"],
            "callingFunction": "transfer(address to, uint256 value)"
        }
        ]
        }`;
    var result = await createPolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      getRulesEngineRulesContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client),
      policyJSON
    );

    var isCemented = await isCementedPolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      result.policyId
    );
    expect(isCemented).toEqual(false);
    var admin = await isPolicyAdmin(
      config,
      getRulesEngineAdminContract(rulesEngineContract, client),
      result.policyId,
      getAddress("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266")
    );
    expect(admin).toEqual(true);
    await cementPolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      result.policyId
    );
    await sleep(5000);
    isCemented = await isCementedPolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      result.policyId
    );
  });
  test(
    "Can manipulate closed subscriber list for a policy",
    options,
    async () => {
      var policyJSON = `
    {
    "Policy": "Test Policy",
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
            "condition": "value > 500",
            "positiveEffects": ["emit Success"],
            "negativeEffects": ["revert()"],
            "callingFunction": "transfer(address to, uint256 value)"
        }
        ]
        }`;
      var result = await createPolicy(
        config,
        getRulesEnginePolicyContract(rulesEngineContract, client),
        getRulesEngineRulesContract(rulesEngineContract, client),
        getRulesEngineComponentContract(rulesEngineContract, client),
        policyJSON
      );

      await closePolicy(
        config,
        getRulesEnginePolicyContract(rulesEngineContract, client),
        result.policyId
      );
      var isClosed = await isClosedPolicy(
        config,
        getRulesEnginePolicyContract(rulesEngineContract, client),
        result.policyId
      );
      expect(isClosed).toEqual(true);

      var isSubscriber = await isClosedPolicySubscriber(
        config,
        getRulesEngineComponentContract(rulesEngineContract, client),
        result.policyId,
        getAddress("0x70997970C51812dc3A010C7d01b50e0d17dc79C8")
      );

      expect(isSubscriber).toEqual(false);

      await removeClosedPolicySubscriber(
        config,
        getRulesEngineComponentContract(rulesEngineContract, client),
        result.policyId,
        getAddress("0x70997970C51812dc3A010C7d01b50e0d17dc79C8")
      );

      var isSubscriber = await isClosedPolicySubscriber(
        config,
        getRulesEngineComponentContract(rulesEngineContract, client),
        result.policyId,
        getAddress("0x70997970C51812dc3A010C7d01b50e0d17dc79C8")
      );

      expect(isSubscriber).toEqual(false);
    }
  );
});
