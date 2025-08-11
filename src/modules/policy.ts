/// SPDX-License-Identifier: BUSL-1.1

import { toFunctionSelector, Address, getAddress } from "viem";

import {
  Config,
  readContract,
  simulateContract,
  waitForTransactionReceipt,
  writeContract,
} from "@wagmi/core";

import {
  parseCallingFunction,
  parseForeignCallDefinition,
  parseMappedTrackerSyntax,
  parseTrackerSyntax,
} from "../parsing/parser";
import {
  RulesEnginePolicyContract,
  RulesEngineComponentContract,
  FCNameToID,
  TrackerDefinition,
  ForeignCallOnChain,
  TrackerOnChain,
  hexToFunctionString,
  RulesEngineRulesContract,
  MappedTrackerDefinition,
  RulesEngineForeignCallContract,
  PolicyMetadataStruct,
  Maybe,
} from "./types";
import {
  createForeignCall,
  getAllForeignCalls,
  getForeignCallMetadata,
} from "./foreign-calls";
import { createRule, getRuleMetadata } from "./rules";
import {
  createMappedTracker,
  getAllTrackers,
  getTrackerMetadata,
} from "./trackers";
import { sleep } from "./contract-interaction-utils";
import {
  createCallingFunction,
  getCallingFunctionMetadata,
} from "./calling-functions";
import { getRule } from "./rules";
import { createTracker } from "./trackers";
import {
  convertRuleStructToString,
  convertForeignCallStructsToStrings,
  convertTrackerStructsToStrings,
} from "../parsing/reverse-parsing-logic";
import {
  CallingFunctionJSON,
  ForeignCallJSON,
  getRulesErrorMessages,
  PolicyJSON,
  validatePolicyJSON,
} from "./validation";
import { isLeft, isRight, unwrapEither } from "./utils";

/**
 * @file policy.ts
 * @description This module provides a comprehensive set of functions for interacting with the Policies within the Rules Engine smart contracts.
 *              It includes functionality for creating, updating, retrieving, and deleting policies.
 *
 * @module policy
 *
 * @dependencies
 * - `viem`: Provides utilities for encoding/decoding data and interacting with Ethereum contracts.
 * - `parser`: Contains helper functions for parsing rule syntax, trackers, and foreign calls.
 * - `@wagmi/core`: Provides utilities for simulating, reading, and writing to Ethereum contracts.
 * - `config`: Provides configuration for interacting with the blockchain.
 *
 *
 * @author @mpetersoCode55, @ShaneDuncan602, @TJ-Everett, @VoR0220
 *
 * @license BUSL-1.1
 *
 * @note This file is a critical component of the Rules Engine SDK, enabling seamless integration with the Rules Engine smart contracts.
 */

/**
 * Creates a policy in the Rules Engine, including rules, trackers, and foreign calls.
 *
 * @param rulesEnginePolicyContract - The contract instance for interacting with the Rules Engine Policy.
 * @param rulesEngineRulesContract - The contract instance for interacting with the Rules Engine Rules.
 * @param rulesEngineComponentContract - The contract instance for interacting with the Rules Engine Component.
 * @param policySyntax - The JSON string representing the policy syntax.
 * @returns The ID of the newly created policy.
 */
export const createPolicy = async (
  config: Config,
  rulesEnginePolicyContract: RulesEnginePolicyContract,
  rulesEngineRulesContract: RulesEngineRulesContract,
  rulesEngineComponentContract: RulesEngineComponentContract,
  rulesEngineForeignCallContract: RulesEngineForeignCallContract,
  confirmationCount: number,
  policySyntax?: string
): Promise<{ policyId: number }> => {
  var fcIds: FCNameToID[] = [];
  var trackerIds: FCNameToID[] = [];
  let ruleIds = [];
  let ruleToCallingFunction = new Map<string, number[]>();
  let callingFunctions: string[] = [];
  let callingFunctionParamSets = [];
  let callingFunctionIds: number[] = [];
  let rulesDoubleMapping = [];
  let callingFunctionSelectors = [];
  let callingFunctionMappings: hexToFunctionString[] = [];

  var policyId = -1;
  if (policySyntax !== undefined) {
    const validatedPolicyJSON = validatePolicyJSON(policySyntax);
    if (isLeft(validatedPolicyJSON)) {
      throw new Error(getRulesErrorMessages(unwrapEither(validatedPolicyJSON)));
    }
    const policyJSON = unwrapEither(validatedPolicyJSON);

    const addPolicy = await simulateContract(config, {
      address: rulesEnginePolicyContract.address,
      abi: rulesEnginePolicyContract.abi,
      functionName: "createPolicy",
      args: [1, policyJSON.Policy, policyJSON.Description],
    });
    const returnHash = await writeContract(config, {
      ...addPolicy.request,
      account: config.getClient().account,
    });
    const transactionReceipt = await waitForTransactionReceipt(config, {
      confirmations: confirmationCount,
      hash: returnHash,
    });

    policyId = addPolicy.result;
    var fsSelectors = [];
    var fsIds = [];
    var emptyRules = [];
    for (var callingFunctionJSON of policyJSON.CallingFunctions) {
      var callingFunction = callingFunctionJSON.functionSignature;
      if (!callingFunctions.includes(callingFunction)) {
        callingFunctions.push(callingFunction);
        const fsId = await createCallingFunction(
          config,
          rulesEngineComponentContract,
          policyId,
          callingFunction,
          callingFunctionJSON.encodedValues,
          confirmationCount
        );
        callingFunctionIds.push(fsId);
        callingFunctionParamSets.push(
          parseCallingFunction(callingFunctionJSON)
        );
        callingFunctionMappings.push({
          hex: toFunctionSelector(callingFunction),
          functionString: callingFunction,
          encodedValues: callingFunctionJSON.encodedValues,
          index: -1,
        });
        var selector = toFunctionSelector(callingFunction);
        fsSelectors.push(selector);
        fsIds.push(fsId);
        emptyRules.push([]);
      }
    }
    await updatePolicy(
      config,
      rulesEnginePolicyContract,
      policyId,
      fsSelectors,
      fsIds,
      emptyRules,
      policyJSON.Policy,
      policyJSON.Description,
      confirmationCount
    );
    if (policyJSON.Trackers != null) {
      for (var tracker of policyJSON.Trackers) {
        const parsedTracker = parseTrackerSyntax(tracker);

        const trId = await createTracker(
          config,
          rulesEngineComponentContract,
          policyId,
          JSON.stringify(tracker),
          confirmationCount
        );
        var struc: FCNameToID = {
          id: trId,
          name: parsedTracker.name,
          type: parsedTracker.type,
        };
        trackerIds.push(struc);
      }
    }
    if (policyJSON.MappedTrackers != null) {
      for (var mTracker of policyJSON.MappedTrackers) {
        const parsedTracker = parseMappedTrackerSyntax(mTracker);
        const trId = await createMappedTracker(
          config,
          rulesEngineComponentContract,
          policyId,
          JSON.stringify(mTracker),
          confirmationCount
        );
        var struc: FCNameToID = {
          id: trId,
          name: parsedTracker.name,
          type: parsedTracker.valueType,
        };
        trackerIds.push(struc);
      }
    }
    if (policyJSON.ForeignCalls != null) {
      for (var foreignCall of policyJSON.ForeignCalls) {
        var encodedValues: string[] = [];
        var iter = 0;
        for (var calling of callingFunctions) {
          if (foreignCall.callingFunction.trim() == calling.trim()) {
            encodedValues = callingFunctionParamSets[iter];
            break;
          }
          iter += 1;
        }
        const fcStruct = parseForeignCallDefinition(
          foreignCall,
          fcIds,
          trackerIds,
          encodedValues
        );
        const fcId = await createForeignCall(
          config,
          rulesEngineForeignCallContract,
          rulesEngineComponentContract,
          rulesEnginePolicyContract,
          policyId,
          JSON.stringify(foreignCall),
          confirmationCount
        );
        var struc: FCNameToID = {
          id: fcId,
          name: fcStruct.name.split("(")[0],
          type: 0,
        };
        fcIds.push(struc);
      }
    }
    for (var rule of policyJSON.Rules) {
      const ruleId = await createRule(
        config,
        rulesEnginePolicyContract,
        rulesEngineRulesContract,
        rulesEngineComponentContract,
        rulesEngineForeignCallContract,
        policyId,
        JSON.stringify(rule),
        fcIds,
        trackerIds,
        confirmationCount
      );
      if (ruleId == -1) {
        return { policyId: -1 };
      }
      ruleIds.push(ruleId);
      if (ruleToCallingFunction.has(rule.callingFunction)) {
        ruleToCallingFunction.get(rule.callingFunction)?.push(ruleId);
      } else {
        ruleToCallingFunction.set(rule.callingFunction, [ruleId]);
      }
    }
    for (var cf of callingFunctions) {
      if (ruleToCallingFunction.has(cf)) {
        rulesDoubleMapping.push(ruleToCallingFunction.get(cf));
      } else {
        rulesDoubleMapping.push([]);
      }
      callingFunctionSelectors.push(toFunctionSelector(cf));
    }
    policyId = await updatePolicy(
      config,
      rulesEnginePolicyContract,
      policyId,
      callingFunctionSelectors,
      callingFunctionIds,
      rulesDoubleMapping,
      policyJSON.Policy,
      policyJSON.Description,
      confirmationCount
    );
  }
  return { policyId };
};

/**
 * Updates an existing policy in the Rules Engine.
 *
 * @param config - The configuration object containing network and wallet information.
 * @param rulesEnginePolicyContract - The contract instance for interacting with the Rules Engine Policy.
 * @param policyId - The ID of the policy to update.
 * @param signatures - The function signatures associated with the policy.
 * @param ids - The IDs of the rules associated with the policy.
 * @param ruleIds - The mapping of rules to calling functions.
 * @returns The result of the policy update if successful, or -1 if an error occurs.
 */
export const updatePolicy = async (
  config: Config,
  rulesEnginePolicyContract: RulesEnginePolicyContract,
  policyId: number,
  signatures: any[],
  ids: number[],
  ruleIds: any[],
  policyName: string,
  policyDescription: string,
  confirmationCount: number
): Promise<number> => {
  var updatePolicy;
  while (true) {
    try {
      updatePolicy = await simulateContract(config, {
        address: rulesEnginePolicyContract.address,
        abi: rulesEnginePolicyContract.abi,
        functionName: "updatePolicy",
        args: [
          policyId,
          signatures,
          ids,
          ruleIds,
          1,
          policyName,
          policyDescription,
        ],
      });
      break;
    } catch (error) {
      // TODO: Look into replacing this loop/sleep with setTimeout
      await sleep(1000);
    }
  }
  if (updatePolicy != null) {
    const returnHash = await writeContract(config, {
      ...updatePolicy.request,
      account: config.getClient().account,
    });
    await waitForTransactionReceipt(config, {
      confirmations: confirmationCount,
      hash: returnHash,
    });

    return updatePolicy.result;
  }

  return -1;
};

/**
 * Sets the policies appled to a specific contract address.
 *
 * @param config - The configuration object containing network and wallet information.
 * @param rulesEnginePolicyContract - The contract instance for interacting with the Rules Engine Policy.
 * @param policyIds - The list of IDs of all of the policies that will be applied to the contract
 * @param contractAddressForPolicy - The address of the contract to which the policy will be applied.
 */
export const setPolicies = async (
  config: Config,
  rulesEnginePolicyContract: RulesEnginePolicyContract,
  policyIds: [number],
  contractAddressForPolicy: Address,
  confirmationCount: number
): Promise<void> => {
  var applyPolicy;
  while (true) {
    try {
      applyPolicy = await simulateContract(config, {
        address: rulesEnginePolicyContract.address,
        abi: rulesEnginePolicyContract.abi,
        functionName: "applyPolicy",
        args: [contractAddressForPolicy, policyIds],
      });
      break;
    } catch (error) {
      // TODO: Look into replacing this loop/sleep with setTimeout
      await sleep(1000);
    }
  }

  if (applyPolicy != null) {
    const returnHash = await writeContract(config, {
      ...applyPolicy.request,
      account: config.getClient().account,
    });
    await waitForTransactionReceipt(config, {
      confirmations: confirmationCount,
      hash: returnHash,
    });
  }
};

/**
 * Appends a policy to the list of policies applied to a specific contract address.
 *
 * @param config - The configuration object containing network and wallet information.
 * @param rulesEnginePolicyContract - The contract instance for interacting with the Rules Engine Policy.
 * @param policyId - The ID of the policy to apply.
 * @param contractAddressForPolicy - The address of the contract to which the policy will be applied.
 */
export const appendPolicy = async (
  config: Config,
  rulesEnginePolicyContract: RulesEnginePolicyContract,
  policyId: number,
  contractAddressForPolicy: Address,
  confirmationCount: number
): Promise<void> => {
  const retrievePolicies = await simulateContract(config, {
    address: rulesEnginePolicyContract.address,
    abi: rulesEnginePolicyContract.abi,
    functionName: "getAppliedPolicyIds",
    args: [contractAddressForPolicy],
  });

  let policyResult = retrievePolicies.result as [number];
  policyResult.push(policyId);

  setPolicies(
    config,
    rulesEnginePolicyContract,
    policyResult,
    contractAddressForPolicy,
    confirmationCount
  );
};

/**
 * Deletes a policy from the Rules Engine.
 *
 * @param config - The configuration object containing network and wallet information.
 * @param rulesEnginePolicyContract - The contract instance for interacting with the Rules Engine Policy.
 * @param policyId - The ID of the policy to delete.
 * @returns `0` if successful, `-1` if an error occurs.
 */
export const deletePolicy = async (
  config: Config,
  rulesEnginePolicyContract: RulesEnginePolicyContract,
  policyId: number,
  confirmationCount: number
): Promise<number> => {
  var addFC;
  try {
    addFC = await simulateContract(config, {
      address: rulesEnginePolicyContract.address,
      abi: rulesEnginePolicyContract.abi,
      functionName: "deletePolicy",
      args: [policyId],
    });
  } catch (err) {
    return -1;
  }

  if (addFC != null) {
    const returnHash = await writeContract(config, {
      ...addFC.request,
      account: config.getClient().account,
    });
    await waitForTransactionReceipt(config, {
      confirmations: confirmationCount,
      hash: returnHash,
    });
  }

  return 0;
};

/**
 * Retrieves the full policy, including rules, trackers, and foreign calls, as a JSON string.
 *
 * @param config - The configuration object containing network and wallet information.
 * @param rulesEnginePolicyContract - The contract instance for interacting with the Rules Engine Policy.
 * @param rulesEngineRulesContract - The contract instance for interacting with the Rules Engine Rules.
 * @param rulesEngineComponentContract - The contract instance for interacting with the Rules Engine Component.
 * @param rulesEngineForeignCallContract - The contract instance for interacting with the Rules Engine Foreign Calls.
 * @param policyId - The ID of the policy to retrieve.
 * @returns A JSON string representing the full policy.
 */
export const getPolicy = async (
  config: Config,
  rulesEnginePolicyContract: RulesEnginePolicyContract,
  rulesEngineRulesContract: RulesEngineRulesContract,
  rulesEngineComponentContract: RulesEngineComponentContract,
  rulesEngineForeignCallContract: RulesEngineForeignCallContract,
  policyId: number
): Promise<string> => {
  var callingFunctionMappings: hexToFunctionString[] = [];
  const callingFunctionJSONs: CallingFunctionJSON[] = [];
  try {
    const retrievePolicy = await simulateContract(config, {
      address: rulesEnginePolicyContract.address,
      abi: rulesEnginePolicyContract.abi,
      functionName: "getPolicy",
      args: [policyId],
    });

    const policyMeta = await getPolicyMetadata(
      config,
      rulesEnginePolicyContract,
      policyId
    );
    if (policyMeta == null) {
      throw new Error(`Policy with ID ${policyId} does not exist.`);
    }
    let policyResult = retrievePolicy.result;
    let callingFunctions: any = policyResult[0];
    let ruleIds2DArray: any = policyResult[2];
    const PolicyType = await isClosedPolicy(
      config,
      rulesEnginePolicyContract,
      policyId
    );

    var iter = 1;

    for (var cfId in callingFunctions) {
      var mapp = await getCallingFunctionMetadata(
        config,
        rulesEngineComponentContract,
        policyId,
        iter
      );
      var newMapping: hexToFunctionString = {
        hex: mapp.signature,
        functionString: mapp.callingFunction,
        encodedValues: mapp.encodedValues,
        index: -1,
      };
      callingFunctionMappings.push(newMapping);
      const callingFunctionJSON = {
        name: mapp.callingFunction,
        functionSignature: mapp.callingFunction,
        encodedValues: mapp.encodedValues,
      };
      callingFunctionJSONs.push(callingFunctionJSON);
      iter++;
    }

    var foreignCalls: ForeignCallOnChain[] = await getAllForeignCalls(
      config,
      rulesEngineForeignCallContract,
      policyId
    );
    var foreignCallNames: string[] = [];
    for (var fc of foreignCalls) {
      var name = await getForeignCallMetadata(
        config,
        rulesEngineForeignCallContract,
        policyId,
        fc.foreignCallIndex
      );
      foreignCallNames.push(name);
      var newMapping: hexToFunctionString = {
        hex: fc.signature,
        functionString: name,
        encodedValues: "",
        index: -1,
      };
      callingFunctionMappings.push(newMapping);
    }

    const callStrings: ForeignCallJSON[] = convertForeignCallStructsToStrings(
      foreignCalls,
      callingFunctionMappings,
      foreignCallNames
    );

    var trackers: TrackerOnChain[] = await getAllTrackers(
      config,
      rulesEngineComponentContract,
      policyId
    );

    var trackerNames: string[] = [];
    for (var tracker of trackers) {
      var name = await getTrackerMetadata(
        config,
        rulesEngineComponentContract,
        policyId,
        tracker.trackerIndex
      );
      trackerNames.push(name);
      var newMapping: hexToFunctionString = {
        hex: "",
        functionString: name,
        encodedValues: "",
        index: tracker.trackerIndex,
      };
      callingFunctionMappings.push(newMapping);
    }

    const trackerJSONs = convertTrackerStructsToStrings(trackers, trackerNames);

    var iter = 0;
    var ruleJSONObjs = [];
    for (var innerArray of ruleIds2DArray) {
      var functionString = "";
      var encodedValues: string = "";
      var fs = callingFunctions[iter];
      for (var mapping of callingFunctionMappings) {
        if (mapping.hex == fs) {
          functionString = mapping.functionString;
          encodedValues = mapping.encodedValues;
          break;
        }
      }
      for (var ruleId of innerArray) {
        var ruleS = await getRule(
          config,
          rulesEngineRulesContract,
          policyId,
          ruleId
        );

        const ruleM = await getRuleMetadata(
          config,
          rulesEngineRulesContract,
          policyId,
          ruleId
        );
        if (ruleS != null) {
          ruleJSONObjs.push(
            convertRuleStructToString(
              functionString,
              encodedValues,
              ruleS,
              ruleM!,
              foreignCalls,
              trackers,
              callingFunctionMappings
            )
          );
        }
      }
      iter++;
    }

    var jsonObj: PolicyJSON = {
      Policy: policyMeta.policyName,
      Description: policyMeta.policyDescription,
      PolicyType: PolicyType ? "closed" : "open",
      CallingFunctions: callingFunctionJSONs,
      ForeignCalls: callStrings,
      ...trackerJSONs,
      Rules: ruleJSONObjs,
    };
    return JSON.stringify(jsonObj);
  } catch (error) {
    console.error(error);
    return "";
  }
};

/**
 * Retrieves the metadata for a policy from the Rules Engine Policy Contract based on the provided policy ID.
 *
 * @param config - The configuration object containing network and wallet information.
 * @param rulesEnginePolicyContract - The contract instance containing the address and ABI for interaction.
 * @param policyId - The ID of the policy.
 * @returns A promise that resolves to the policy metadata result if successful, or `null` if an error occurs.
 *
 * @throws Will log an error to the console if the contract interaction fails.
 */
export const getPolicyMetadata = async (
  config: Config,
  rulesEnginePolicyContract: RulesEnginePolicyContract,
  policyId: number
): Promise<Maybe<PolicyMetadataStruct>> => {
  try {
    const getMeta = await readContract(config, {
      address: rulesEnginePolicyContract.address,
      abi: rulesEnginePolicyContract.abi,
      functionName: "getPolicyMetadata",
      args: [policyId],
    });

    let ruleResult = getMeta as PolicyMetadataStruct;
    return ruleResult;
  } catch (error) {
    console.error(error);
    return null;
  }
};

/**
 * Checks if a policy exists in the Rules Engine.
 * @param config - The configuration object containing network and wallet information.
 * @param rulesEnginePolicyContract - The contract instance for interacting with the Rules Engine Policy.
 * @param policyId - The ID of the policy to check.
 * @returns True if the policy exists, false otherwise.
 */
export async function policyExists(
  config: Config,
  rulesEnginePolicyContract: RulesEnginePolicyContract,
  policyId: number
): Promise<boolean> {
  try {
    let policyExists = await simulateContract(config, {
      address: rulesEnginePolicyContract.address,
      abi: rulesEnginePolicyContract.abi,
      functionName: "getPolicy",
      args: [policyId],
    });
    if (policyExists.result[0] != null && policyExists.result[2] != null) {
      return true;
    }
    return false;
  } catch (error) {
    return false;
  }
}

/**
 * Retrieves the IDs of all of the policies that have been applied to a contract address.
 * @param config - The configuration object containing network and wallet information.
 * @param rulesEnginePolicyContract - The contract instance for interacting with the Rules Engine Policy.
 * @param address - The address to check.
 * @returns array of all of the policy ids applied to the contract
 */
export async function getAppliedPolicyIds(
  config: Config,
  rulesEnginePolicyContract: RulesEnginePolicyContract,
  address: string
): Promise<number[]> {
  try {
    let appliedPolicies = await simulateContract(config, {
      address: rulesEnginePolicyContract.address,
      abi: rulesEnginePolicyContract.abi,
      functionName: "getAppliedPolicyIds",
      args: [getAddress(address)],
    });
    return appliedPolicies.result;
  } catch (error) {
    return [];
  }
}

/**
 * Retrieves whether a policy is open or closed.
 * @param config - The configuration object containing network and wallet information.
 * @param rulesEnginePolicyContract - The contract instance for interacting with the Rules Engine Policy.
 * @param policyId - The ID of the policy to check.
 * @returns array of all of the policy ids applied to the contract
 */
export async function isClosedPolicy(
  config: Config,
  rulesEnginePolicyContract: RulesEnginePolicyContract,
  policyId: number
): Promise<boolean> {
  try {
    let isClosed = await simulateContract(config, {
      address: rulesEnginePolicyContract.address,
      abi: rulesEnginePolicyContract.abi,
      functionName: "isClosedPolicy",
      args: [policyId],
    });
    return isClosed.result;
  } catch (error) {
    return false;
  }
}

/**
 * Closes a policy on the Rules Engine.
 *
 * @param config - The configuration object containing network and wallet information.
 * @param rulesEnginePolicyContract - The contract instance for interacting with the Rules Engine Policy.
 * @param policyId - The ID of the policy to close.
 * @returns `0` if successful, `-1` if an error occurs.
 */
export const closePolicy = async (
  config: Config,
  rulesEnginePolicyContract: RulesEnginePolicyContract,
  policyId: number,
  confirmationCount: number
): Promise<number> => {
  var addFC;
  try {
    addFC = await simulateContract(config, {
      address: rulesEnginePolicyContract.address,
      abi: rulesEnginePolicyContract.abi,
      functionName: "closePolicy",
      args: [policyId],
    });
  } catch (err) {
    return -1;
  }

  if (addFC != null) {
    const returnHash = await writeContract(config, {
      ...addFC.request,
      account: config.getClient().account,
    });
    await waitForTransactionReceipt(config, {
      confirmations: confirmationCount,
      hash: returnHash,
    });
  }

  return 0;
};

/**
 * Opens a policy on the Rules Engine.
 *
 * @param config - The configuration object containing network and wallet information.
 * @param rulesEnginePolicyContract - The contract instance for interacting with the Rules Engine Policy.
 * @param policyId - The ID of the policy to open.
 * @returns `0` if successful, `-1` if an error occurs.
 */
export const openPolicy = async (
  config: Config,
  rulesEnginePolicyContract: RulesEnginePolicyContract,
  policyId: number,
  confirmationCount: number
): Promise<number> => {
  var addFC;
  try {
    addFC = await simulateContract(config, {
      address: rulesEnginePolicyContract.address,
      abi: rulesEnginePolicyContract.abi,
      functionName: "openPolicy",
      args: [policyId],
    });
  } catch (err) {
    return -1;
  }

  if (addFC != null) {
    const returnHash = await writeContract(config, {
      ...addFC.request,
      account: config.getClient().account,
    });
    await waitForTransactionReceipt(config, {
      confirmations: confirmationCount,
      hash: returnHash,
    });
  }

  return 0;
};

/**
 * Retrieves whether an address is a possible subscriber to the closed policy.
 * @param config - The configuration object containing network and wallet information.
 * @param rulesEngineComponentContract - The contract instance for interacting with the Rules Engine Components.
 * @param policyId - The ID of the policy to check.
 * @param subscriber - The address to check
 * @returns array of all of the policy ids applied to the contract
 */
export async function isClosedPolicySubscriber(
  config: Config,
  rulesEngineComponentContract: RulesEngineComponentContract,
  policyId: number,
  subscriber: Address
): Promise<boolean> {
  try {
    let isClosed = await simulateContract(config, {
      address: rulesEngineComponentContract.address,
      abi: rulesEngineComponentContract.abi,
      functionName: "isClosedPolicySubscriber",
      args: [policyId, subscriber],
    });
    return isClosed.result;
  } catch (error) {
    return false;
  }
}

/**
 * Adds a subscriber to the closed policy.
 *
 * @param config - The configuration object containing network and wallet information.
 * @param rulesEngineComponentContract - The contract instance for interacting with the Rules Engine Components.
 * @param policyId - The ID of the policy to add to.
 * @returns `0` if successful, `-1` if an error occurs.
 */
export const addClosedPolicySubscriber = async (
  config: Config,
  rulesEngineComponentContract: RulesEngineComponentContract,
  policyId: number,
  subscriber: Address,
  confirmationCount: number
): Promise<number> => {
  var addFC;
  try {
    addFC = await simulateContract(config, {
      address: rulesEngineComponentContract.address,
      abi: rulesEngineComponentContract.abi,
      functionName: "addClosedPolicySubscriber",
      args: [policyId, subscriber],
    });
  } catch (err) {
    return -1;
  }

  if (addFC != null) {
    const returnHash = await writeContract(config, {
      ...addFC.request,
      account: config.getClient().account,
    });
    await waitForTransactionReceipt(config, {
      confirmations: confirmationCount,
      hash: returnHash,
    });
  }

  return 0;
};

/**
 * Removes a subscriber from the closed policy.
 *
 * @param config - The configuration object containing network and wallet information.
 * @param rulesEngineComponentContract - The contract instance for interacting with the Rules Engine Components.
 * @param policyId - The ID of the policy to remove from.
 * @param subscriber - The address of the subscriber to remove.
 * @returns `0` if successful, `-1` if an error occurs.
 */
export const removeClosedPolicySubscriber = async (
  config: Config,
  rulesEngineComponentContract: RulesEngineComponentContract,
  policyId: number,
  subscriber: Address,
  confirmationCount: number
): Promise<number> => {
  var addFC;
  try {
    addFC = await simulateContract(config, {
      address: rulesEngineComponentContract.address,
      abi: rulesEngineComponentContract.abi,
      functionName: "removeClosedPolicySubscriber",
      args: [policyId, subscriber],
    });
  } catch (err) {
    return -1;
  }

  if (addFC != null) {
    const returnHash = await writeContract(config, {
      ...addFC.request,
      account: config.getClient().account,
    });
    await waitForTransactionReceipt(config, {
      confirmations: confirmationCount,
      hash: returnHash,
    });
  }

  return 0;
};

/**
 * Cements a policy on the Rules Engine.
 *
 * @param config - The configuration object containing network and wallet information.
 * @param rulesEnginePolicyContract - The contract instance for interacting with the Rules Engine Policy.
 * @param policyId - The ID of the policy to cement.
 * @returns `0` if successful, `-1` if an error occurs.
 */
export const cementPolicy = async (
  config: Config,
  rulesEnginePolicyContract: RulesEnginePolicyContract,
  policyId: number,
  confirmationCount: number
): Promise<number> => {
  var addFC;
  try {
    addFC = await simulateContract(config, {
      address: rulesEnginePolicyContract.address,
      abi: rulesEnginePolicyContract.abi,
      functionName: "cementPolicy",
      args: [policyId],
    });
  } catch (err) {
    return -1;
  }

  if (addFC != null) {
    const returnHash = await writeContract(config, {
      ...addFC.request,
      account: config.getClient().account,
    });
    await waitForTransactionReceipt(config, {
      confirmations: confirmationCount,
      hash: returnHash,
    });
  }

  return 0;
};

/**
 * Retrieves whether a policy is cemented.
 * @param config - The configuration object containing network and wallet information.
 * @param rulesEnginePolicyContract - The contract instance for interacting with the Rules Engine Policy.
 * @param policyId - The ID of the policy to check.
 * @returns whether or not the policy is cemented
 */
export const isCementedPolicy = async (
  config: Config,
  rulesEnginePolicyContract: RulesEnginePolicyContract,
  policyId: number
): Promise<boolean> => {
  try {
    const retrievePolicy = await simulateContract(config, {
      address: rulesEnginePolicyContract.address,
      abi: rulesEnginePolicyContract.abi,
      functionName: "isCementedPolicy",
      args: [policyId],
    });

    return retrievePolicy.result;
  } catch (err) {
    return false;
  }
};
