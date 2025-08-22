/// SPDX-License-Identifier: BUSL-1.1
import { Address, toFunctionSelector } from "viem";
import {
  simulateContract,
  waitForTransactionReceipt,
  writeContract,
  readContract,
  Config,
} from "@wagmi/core";
import { sleep } from "./contract-interaction-utils";
import {
  parseCallingFunction,
  parseForeignCallDefinition,
} from "../parsing/parser";
import {
  ForeignCallOnChain,
  RulesEngineComponentContract,
  Maybe,
  TrackerOnChain,
  FCNameToID,
  RulesEnginePolicyContract,
  RulesEngineForeignCallContract,
  TrackerMetadataStruct,
  ContractBlockParameters,
} from "./types";
import { getAllTrackers, getTrackerMetadata } from "./trackers";
import { getCallingFunctionMetadata } from "./calling-functions";
import { isLeft, unwrapEither } from "./utils";
import {
  CallingFunctionJSON,
  ForeignCallJSON,
  getRulesErrorMessages,
  validateForeignCallJSON,
} from "./validation";

/**
 * @file ForeignCalls.ts
 * @description This module provides a comprehensive set of functions for interacting with the Foreign Calls within the Rules Engine smart contracts.
 *              It includes functionality for creating, updating, retrieving, and deleting foreign calls.
 *
 * @module ForeignCalls
 *
 * @dependencies
 * - `viem`: Provides utilities for encoding/decoding data and interacting with Ethereum contracts.
 * - `Parser`: Contains helper functions for parsing rule syntax, trackers, and foreign calls.
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
 * Creates a foreign call in the rules engine component contract.
 *
 * @param config - The configuration object containing network and wallet information.
 * @param rulesEngineForeignCallContract - The contract instance for interacting with the rules engine component.
 * @param policyId - The ID of the policy to associate with the foreign call.
 * @param fcSyntax - A JSON string representing the foreign call definition.
 * @returns A promise that resolves to the foreign call index. Returns `-1` if the operation fails.
 *
 * @remarks
 * - The function retries the contract interaction in case of failure, with a delay of 1 second between attempts.
 * - The `simulateContract` function is used to simulate the contract interaction before writing to the blockchain.
 * - The `writeContract` function is used to execute the contract interaction on the blockchain.
 * - The function returns the `foreignCallIndex` for an updated foreign call or the result of the newly created foreign call.
 *
 * @throws Will throw an error if the JSON parsing of `fcSyntax` fails.
 */
export const createForeignCall = async (
  config: Config,
  rulesEngineForeignCallContract: RulesEngineForeignCallContract,
  rulesEngineComponentContract: RulesEngineComponentContract,
  rulesEnginePolicyContract: RulesEnginePolicyContract,
  policyId: number,
  fcSyntax: string,
  confirmationCount: number
): Promise<number> => {
  var trackers: TrackerOnChain[] = await getAllTrackers(
    config,
    rulesEngineComponentContract,
    policyId
  );
  var indexMap: FCNameToID[] = [];
  var mappedArray: boolean[] = trackers.map((tracker) => tracker.mapped);

  const trackerMetadataCalls = trackers.map((tracker) =>
    getTrackerMetadata(
      config,
      rulesEngineComponentContract,
      policyId,
      tracker.trackerIndex
    )
  );
  const trackerMetadata = await Promise.all(trackerMetadataCalls);
  const indexMapAdditions: FCNameToID[] = trackerMetadata.map(
    (name: TrackerMetadataStruct, index: number) => {
      return {
        name: name.trackerName,
        id: trackers[index].trackerIndex,
        type: mappedArray[index] ? 1 : 0,
      };
    }
  );

  indexMap = [...indexMap, ...indexMapAdditions];

  var foreignCalls: ForeignCallOnChain[] = await getAllForeignCalls(
    config,
    rulesEngineForeignCallContract,
    policyId
  );
  const foreignCallMetadataCalls = foreignCalls.map((fc) =>
    getForeignCallMetadata(
      config,
      rulesEngineForeignCallContract,
      policyId,
      fc.foreignCallIndex
    )
  );
  var fcMap: FCNameToID[] = [];
  const foreignCallMetadata = await Promise.all(foreignCallMetadataCalls);
  const fcMapAdditions: FCNameToID[] = foreignCallMetadata.map(
    (name: string, index: number) => {
      return {
        name: name.split("(")[0],
        id: foreignCalls[index].foreignCallIndex,
        type: 0,
      };
    }
  );
  fcMap = [...fcMap, ...fcMapAdditions];

  const retrievePolicy = await readContract(config, {
    address: rulesEnginePolicyContract.address,
    abi: rulesEnginePolicyContract.abi,
    functionName: "getPolicy",
    args: [policyId],
  });

  let policyResult = retrievePolicy as any;
  let callingFunctionIds: number[] = policyResult[1];
  const callingFunctionsMetadataCalls = callingFunctionIds.map((cfId) =>
    getCallingFunctionMetadata(
      config,
      rulesEngineComponentContract,
      policyId,
      cfId
    )
  );
  const callingFunctionMetadata = await Promise.all(
    callingFunctionsMetadataCalls
  );

  const json = validateForeignCallJSON(fcSyntax);
  if (isLeft(json)) {
    throw new Error(getRulesErrorMessages(unwrapEither(json)));
  }
  const fcJSON: ForeignCallJSON = unwrapEither(json);
  var iter = 1;
  var encodedValues: string[] = [];
  for (var mapp of callingFunctionMetadata) {
    if (mapp.callingFunction.trim() == fcJSON.callingFunction) {
      var builtJSON = {
        name: fcJSON.callingFunction,
        functionSignature: fcJSON.callingFunction,
        encodedValues: mapp.encodedValues,
      };
      encodedValues = parseCallingFunction(builtJSON);
      break;
    }
    iter += 1;
  }
  const foreignCall = parseForeignCallDefinition(
    fcJSON,
    fcMap,
    indexMap,
    encodedValues
  );
  var fc = {
    set: true,
    foreignCallAddress: foreignCall.address,
    signature: toFunctionSelector(foreignCall.function),
    foreignCallIndex: 0,
    returnType: foreignCall.returnType,
    parameterTypes: foreignCall.parameterTypes,
    encodedIndices: foreignCall.encodedIndices,
    mappedTrackerKeyIndices: foreignCall.mappedTrackerKeyIndices,
    callingFunctionIndex: iter,
  };
  var addFC;
  while (true) {
    try {
      addFC = await simulateContract(config, {
        address: rulesEngineForeignCallContract.address,
        abi: rulesEngineForeignCallContract.abi,
        functionName: "createForeignCall",
        args: [policyId, fc, foreignCall.name],
      });
      break;
    } catch (err) {
      // TODO: Look into replacing this loop/sleep with setTimeout
      await sleep(1000);
      return -1;
    }
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
    return addFC.result;
  }
  return -1;
};
/**
 * Updates a foreign call in the rules engine component contract.
 *
 * @param config - The configuration object containing network and wallet information.
 * @param rulesEngineForeignCallContract - The contract instance for interacting with the rules engine component.
 * @param policyId - The ID of the policy to associate with the foreign call.
 * @param foreignCallId - The ID of the foreign call to update.
 * @param fcSyntax - A JSON string representing the foreign call definition.
 * @returns A promise that resolves to the foreign call index. Returns `-1` if the operation fails.
 *
 * @remarks
 * - The function retries the contract interaction in case of failure, with a delay of 1 second between attempts.
 * - The `simulateContract` function is used to simulate the contract interaction before writing to the blockchain.
 * - The `writeContract` function is used to execute the contract interaction on the blockchain.
 * - The function returns the `foreignCallIndex` for an updated foreign call or the result of the newly created foreign call.
 *
 * @throws Will throw an error if the JSON parsing of `fcSyntax` fails.
 */
export const updateForeignCall = async (
  config: Config,
  rulesEnginePolicyContract: RulesEnginePolicyContract,
  rulesEngineComponentContract: RulesEngineComponentContract,
  rulesEngineForeignCallContract: RulesEngineForeignCallContract,
  policyId: number,
  foreignCallId: number,
  fcSyntax: string,
  confirmationCount: number
): Promise<number> => {
  var trackers: TrackerOnChain[] = await getAllTrackers(
    config,
    rulesEngineComponentContract,
    policyId
  );
  var indexMap: FCNameToID[] = [];
  const trackerMetadataCalls = trackers.map((tracker) =>
    getTrackerMetadata(
      config,
      rulesEngineComponentContract,
      policyId,
      tracker.trackerIndex
    )
  );
  const trackerMetadata = await Promise.all(trackerMetadataCalls);
  const indexMapAdditions: FCNameToID[] = trackerMetadata.map(
    (name: TrackerMetadataStruct, index: number) => {
      return {
        name: name.trackerName,
        id: trackers[index].trackerIndex,
        type: 0,
      };
    }
  );
  indexMap = [...indexMap, ...indexMapAdditions];

  var foreignCalls: ForeignCallOnChain[] = await getAllForeignCalls(
    config,
    rulesEngineForeignCallContract,
    policyId
  );
  const foreignCallMetadataCalls = foreignCalls.map((fc) =>
    getForeignCallMetadata(
      config,
      rulesEngineForeignCallContract,
      policyId,
      fc.foreignCallIndex
    )
  );
  var fcMap: FCNameToID[] = [];
  const foreignCallMetadata = await Promise.all(foreignCallMetadataCalls);
  const fcMapAdditions: FCNameToID[] = foreignCallMetadata.map(
    (name: string, index: number) => {
      return { name: name, id: foreignCalls[index].foreignCallIndex, type: 0 };
    }
  );
  fcMap = [...fcMap, ...fcMapAdditions];

  const retrievePolicy = await readContract(config, {
    address: rulesEnginePolicyContract.address,
    abi: rulesEnginePolicyContract.abi,
    functionName: "getPolicy",
    args: [policyId],
  });

  let policyResult = retrievePolicy as any;
  let callingFunctionIds: number[] = policyResult[1];
  const callingFunctionsMetadataCalls = callingFunctionIds.map((cfId) =>
    getCallingFunctionMetadata(
      config,
      rulesEngineComponentContract,
      policyId,
      cfId
    )
  );
  const callingFunctionMetadata = await Promise.all(
    callingFunctionsMetadataCalls
  );

  const json = validateForeignCallJSON(fcSyntax);
  if (isLeft(json)) {
    throw new Error(getRulesErrorMessages(unwrapEither(json)));
  }
  const fcJSON = unwrapEither(json);
  var iter = 1;
  var encodedValues: string[] = [];
  for (var mapp of callingFunctionMetadata) {
    if (mapp.callingFunction.trim() == fcJSON.callingFunction.trim()) {
      var builtJSON: CallingFunctionJSON = {
        name: fcJSON.callingFunction,
        functionSignature: fcJSON.callingFunction,
        encodedValues: mapp.encodedValues,
      };
      encodedValues = parseCallingFunction(builtJSON);
      break;
    }
    iter += 1;
  }

  const foreignCall = parseForeignCallDefinition(
    fcJSON,
    fcMap,
    indexMap,
    encodedValues
  );

  var fc = {
    set: true,
    foreignCallAddress: foreignCall.address,
    signature: toFunctionSelector(foreignCall.function),
    foreignCallIndex: 0,
    returnType: foreignCall.returnType,
    parameterTypes: foreignCall.parameterTypes,
    encodedIndices: foreignCall.encodedIndices,
    mappedTrackerKeyIndices: foreignCall.mappedTrackerKeyIndices,
    callingFunctionIndex: iter,
  };
  var addFC;

  while (true) {
    try {
      addFC = await simulateContract(config, {
        address: rulesEngineForeignCallContract.address,
        abi: rulesEngineForeignCallContract.abi,
        functionName: "updateForeignCall",
        args: [policyId, foreignCallId, fc],
      });
      break;
    } catch (err) {
      // TODO: Look into replacing this loop/sleep with setTimeout
      await sleep(1000);
    }
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
    let foreignCallResult = addFC.result as any;
    return foreignCallResult.foreignCallIndex;
  }
  return -1;
};

/**
 * Deletes a foreign call associated with a specific policy in the rules engine component contract.
 *
 * @param config - The configuration object containing network and wallet information.
 * @param rulesEngineForeignCallContract - The contract instance containing the address and ABI for interacting with the rules engine component.
 * @param policyId - The ID of the policy to which the foreign call belongs.
 * @param foreignCallId - The ID of the foreign call to be deleted.
 * @returns A promise that resolves to a number:
 *          - `0` if the operation is successful.
 *          - `-1` if an error occurs during the simulation of the contract interaction.
 *
 * @throws This function does not explicitly throw errors but will return `-1` if an error occurs during the simulation phase.
 */
export const deleteForeignCall = async (
  config: Config,
  rulesEngineForeignCallContract: RulesEngineForeignCallContract,
  policyId: number,
  foreignCallId: number,
  confirmationCount: number
): Promise<number> => {
  var addFC;
  try {
    addFC = await simulateContract(config, {
      address: rulesEngineForeignCallContract.address,
      abi: rulesEngineForeignCallContract.abi,
      functionName: "deleteForeignCall",
      args: [policyId, foreignCallId],
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
 * Retrieves the result of a foreign call from the rules engine component contract.
 *
 * @param config - The configuration object containing network and wallet information.
 * @param rulesEngineForeignCallContract - The contract instance containing the address and ABI for interaction.
 * @param policyId - The ID of the policy associated with the foreign call.
 * @param foreignCallId - The ID of the foreign call to retrieve.
 * * @param blockParams - Optional parameters to specify block number or tag for the contract read operation.
 * @returns A promise that resolves to the result of the foreign call, or `null` if an error occurs.
 *
 * @throws Will log an error to the console if the contract interaction fails.
 */
export const getForeignCall = async (
  config: Config,
  rulesEngineForeignCallContract: RulesEngineForeignCallContract,
  policyId: number,
  foreignCallId: number,
  blockParams?: ContractBlockParameters
): Promise<Maybe<ForeignCallOnChain>> => {
  try {
    const addFC = await readContract(config, {
      address: rulesEngineForeignCallContract.address,
      abi: rulesEngineForeignCallContract.abi,
      functionName: "getForeignCall",
      args: [policyId, foreignCallId],
      ...blockParams
    });

    let foreignCallResult = addFC as ForeignCallOnChain;
    return foreignCallResult;
  } catch (error) {
    console.error(error);
    return null;
  }
};

/**
 * Retrieves the metadata for a foreign call from the rules engine component contract.
 *
 * @param config - The configuration object containing network and wallet information.
 * @param rulesEngineForeignCallContract - The contract instance containing the address and ABI for interaction.
 * @param policyId - The ID of the policy associated with the foreign call.
 * @param foreignCallId - The ID of the foreign call to retrieve.
 * @param blockParams - Optional parameters to specify block number or tag for the contract read operation.
 * @returns A promise that resolves to the result of the foreign call, or `null` if an error occurs.
 *
 * @throws Will log an error to the console if the contract interaction fails.
 */
export const getForeignCallMetadata = async (
  config: Config,
  rulesEngineForeignCallContract: RulesEngineForeignCallContract,
  policyId: number,
  foreignCallId: number,
  blockParams?: ContractBlockParameters
): Promise<string> => {
  try {
    const getMeta = await readContract(config, {
      address: rulesEngineForeignCallContract.address,
      abi: rulesEngineForeignCallContract.abi,
      functionName: "getForeignCallMetadata",
      args: [policyId, foreignCallId],
      ...blockParams
    });

    let foreignCallResult = getMeta as string;
    return foreignCallResult;
  } catch (error) {
    console.error(error);
    return "";
  }
};

/**
 * Retrieves all foreign calls associated with a specific policy ID from the Rules Engine Component Contract.
 *
 * @param config - The configuration object containing network and wallet information.
 * @param rulesEngineForeignCallContract - An object representing the Rules Engine Component Contract,
 * @param policyId - The ID of the policy for which foreign calls are to be retrieved.
 * @param blockParams - Optional parameters to specify block number or tag for the contract read operation.
 * containing its address and ABI.
 * @returns A promise that resolves to an array of foreign calls if successful, or `null` if an error occurs.
 *
 * @throws Will log an error to the console if the operation fails.
 */
export const getAllForeignCalls = async (
  config: Config,
  rulesEngineForeignCallContract: RulesEngineForeignCallContract,
  policyId: number,
  blockParams?: ContractBlockParameters
): Promise<ForeignCallOnChain[]> => {
  try {
    const addFC = await readContract(config, {
      address: rulesEngineForeignCallContract.address,
      abi: rulesEngineForeignCallContract.abi,
      functionName: "getAllForeignCalls",
      args: [policyId],
      ...blockParams
    });
    let foreignCallResult = addFC as ForeignCallOnChain[];
    return foreignCallResult;
  } catch (error) {
    console.error(error);
    return [];
  }
};

/**
 * Retrieves the permission list for a permissioned foreign call.
 *
 * @param config - The configuration object containing network and wallet information.
 * @param rulesEngineForeignCallContract - An object representing the Rules Engine Component Contract,
 * @param foreignCallAddress - the address of the contract the foreign call belongs to.
 * @param functionSelector - The selector for the specific foreign call
 * @param blockParams - Optional parameters to specify block number or tag for the contract read operation.
 * @returns Array of addresses that make up the permission list
 *
 * @throws Will log an error to the console if the operation fails.
 */
export const getForeignCallPermissionList = async (
  config: Config,
  rulesEngineForeignCallContract: RulesEngineForeignCallContract,
  foreignCallAddress: Address,
  functionSelector: string,
  blockParams?: ContractBlockParameters
): Promise<Address[]> => {
  try {
    var selector = toFunctionSelector(functionSelector);
    const addFC = await readContract(config, {
      address: rulesEngineForeignCallContract.address,
      abi: rulesEngineForeignCallContract.abi,
      functionName: "getForeignCallPermissionList",
      args: [foreignCallAddress, selector],
      ...blockParams
    });
    let foreignCallResult = addFC as Address[];
    return foreignCallResult;
  } catch (error) {
    console.error(error);
    return [];
  }
};

/**
 * Adds a new address to the permission list for a foreign call.
 *
 * @param config - The configuration object containing network and wallet information.
 * @param rulesEngineForeignCallContract - An object representing the Rules Engine Component Contract,
 * @param foreignCallAddress - the address of the contract the foreign call belongs to.
 * @param functionSelector - The selector for the specific foreign call
 * @param policyAdminToAdd - The address of the admin to add to the list
 * @returns A promise that resolves to a number:
 *          - `0` if the operation is successful.
 *          - `-1` if an error occurs during the simulation of the contract interaction.
 *
 * @throws Will log an error to the console if the operation fails.
 */
export const addAdminToPermissionList = async (
  config: Config,
  rulesEngineForeignCallContract: RulesEngineForeignCallContract,
  foreignCallAddress: Address,
  functionSelector: string,
  policyAdminToAdd: Address,
  confirmationCount: number
): Promise<number> => {
  var addFC;
  try {
    var selector = toFunctionSelector(functionSelector);
    addFC = await simulateContract(config, {
      address: rulesEngineForeignCallContract.address,
      abi: rulesEngineForeignCallContract.abi,
      functionName: "addAdminToPermissionList",
      args: [foreignCallAddress, policyAdminToAdd, selector],
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
 * Adds multiple addresses to the permission list for a foreign call.
 *
 * @param config - The configuration object containing network and wallet information.
 * @param rulesEngineForeignCallContract - An object representing the Rules Engine Component Contract,
 * @param foreignCallAddress - the address of the contract the foreign call belongs to.
 * @param functionSelector - The selector for the specific foreign call
 * @param policyAdminsToAdd - The address of the admins to remove from the list
 * @returns A promise that resolves to a number:
 *          - `0` if the operation is successful.
 *          - `-1` if an error occurs during the simulation of the contract interaction.
 *
 * @throws Will log an error to the console if the operation fails.
 */
export const addMultipleAdminsToPermissionList = async (
  config: Config,
  rulesEngineForeignCallContract: RulesEngineForeignCallContract,
  foreignCallAddress: Address,
  functionSelector: string,
  policyAdminsToAdd: Address[],
  confirmationCount: number
): Promise<number> => {
  var addFC;

  var addresses = await getForeignCallPermissionList(
    config,
    rulesEngineForeignCallContract,
    foreignCallAddress,
    functionSelector
  );
  addresses.push(...policyAdminsToAdd);
  try {
    var selector = toFunctionSelector(functionSelector);
    addFC = await simulateContract(config, {
      address: rulesEngineForeignCallContract.address,
      abi: rulesEngineForeignCallContract.abi,
      functionName: "updatePermissionList",
      args: [foreignCallAddress, selector, addresses],
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
 * Removes multiple addresses from the permission list for a foreign call.
 *
 * @param config - The configuration object containing network and wallet information.
 * @param rulesEngineForeignCallContract - An object representing the Rules Engine Component Contract,
 * @param foreignCallAddress - the address of the contract the foreign call belongs to.
 * @param functionSelector - The selector for the specific foreign call
 * @param policyAdminsToRemove - The address of the admins to remove from the list
 * @returns A promise that resolves to a number:
 *          - `0` if the operation is successful.
 *          - `-1` if an error occurs during the simulation of the contract interaction.
 *
 * @throws Will log an error to the console if the operation fails.
 */
export const removeMultipleAdminsFromPermissionList = async (
  config: Config,
  rulesEngineForeignCallContract: RulesEngineForeignCallContract,
  foreignCallAddress: Address,
  functionSelector: string,
  policyAdminsToRemove: Address[],
  confirmationCount: number
): Promise<number> => {
  var addFC;

  var addresses = await getForeignCallPermissionList(
    config,
    rulesEngineForeignCallContract,
    foreignCallAddress,
    functionSelector
  );
  addresses = addresses.filter((item) => !policyAdminsToRemove.includes(item));
  try {
    var selector = toFunctionSelector(functionSelector);
    addFC = await simulateContract(config, {
      address: rulesEngineForeignCallContract.address,
      abi: rulesEngineForeignCallContract.abi,
      functionName: "updatePermissionList",
      args: [foreignCallAddress, selector, addresses],
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
 * Removes all addresses from the permission list for a foreign call.
 *
 * @param config - The configuration object containing network and wallet information.
 * @param rulesEngineForeignCallContract - An object representing the Rules Engine Foreign Call Contract,
 * @param foreignCallAddress - the address of the contract the foreign call belongs to.
 * @param functionSelector - The selector for the specific foreign call
 * @returns A promise that resolves to a number:
 *          - `0` if the operation is successful.
 *          - `-1` if an error occurs during the simulation of the contract interaction.
 *
 * @throws Will log an error to the console if the operation fails.
 */
export const removeAllFromPermissionList = async (
  config: Config,
  rulesEngineForeignCallContract: RulesEngineForeignCallContract,
  foreignCallAddress: Address,
  functionSelector: string,
  confirmationCount: number
): Promise<number> => {
  var addFC;
  try {
    var selector = toFunctionSelector(functionSelector);
    addFC = await simulateContract(config, {
      address: rulesEngineForeignCallContract.address,
      abi: rulesEngineForeignCallContract.abi,
      functionName: "removeAllFromPermissionList",
      args: [foreignCallAddress, selector],
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
