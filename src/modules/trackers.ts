/// SPDX-License-Identifier: BUSL-1.1
import {
  simulateContract,
  waitForTransactionReceipt,
  writeContract,
  readContract,
  Config,
} from "@wagmi/core";
import { sleep } from "./contract-interaction-utils";
import {
  parseMappedTrackerSyntax,
  parseTrackerSyntax,
} from "../parsing/parser";
import { RulesEngineComponentContract, TrackerOnChain } from "./types";
import { isLeft, isRight, unwrapEither } from "./utils";
import {
  getRulesErrorMessages,
  validateMappedTrackerJSON,
  validateTrackerJSON,
} from "./validation";
import { encodePacked } from "viem";

/**
 * @file Trackers.ts
 * @description This module provides a comprehensive set of functions for interacting with the Trackers within the Rules Engine smart contracts.
 *              It includes functionality for creating, updating, retrieving, and deleting trackers.
 *
 * @module Trackers
 *
 * @dependencies
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

export const createMappedTracker = async (
  config: Config,
  rulesEngineComponentContract: RulesEngineComponentContract,
  policyId: number,
  mappedTrackerSyntax: string
): Promise<number> => {
  const json = validateMappedTrackerJSON(mappedTrackerSyntax);
  if (isLeft(json)) {
    throw new Error(getRulesErrorMessages(unwrapEither(json)));
  }
  const parsedTracker = parseMappedTrackerSyntax(unwrapEither(json));

  var transactionTracker = {
    set: true,
    pType: parsedTracker.valueType,
    mapped: true,
    trackerKeyType: parsedTracker.keyType,
    trackerValue: encodePacked(["uint256"], [BigInt(0)]),
    trackerIndex: 0,
  };
  var addTR;
  while (true) {
    try {
      addTR = await simulateContract(config, {
        address: rulesEngineComponentContract.address,
        abi: rulesEngineComponentContract.abi,
        functionName: "createTracker",
        args: [
          policyId,
          transactionTracker,
          parsedTracker.name,
          parsedTracker.initialKeys,
          parsedTracker.initialValues,
        ],
      });
      break;
    } catch (err) {
      // TODO: Look into replacing this loop/sleep with setTimeout
      await sleep(1000);
    }
  }
  if (addTR != null) {
    const returnHash = await writeContract(config, {
      ...addTR.request,
      account: config.getClient().account,
    });
    await waitForTransactionReceipt(config, {
      hash: returnHash,
    });

    let trackerResult = addTR.result;
    return trackerResult;
  }
  return -1;
};

/**
 * Asynchronously creates a tracker in the rules engine component contract.
 *
 * @param config - The configuration object containing network and wallet information.
 * @param rulesEngineComponentContract - The contract instance for interacting with the rules engine component.
 * @param policyId - The ID of the policy associated with the tracker.
 * @param trSyntax - A JSON string representing the tracker syntax.
 * @returns A promise that resolves to the new tracker ID
 *
 * @throws Will retry indefinitely with a 1-second delay between attempts if an error occurs during the contract simulation.
 *         Ensure proper error handling or timeout mechanisms are implemented to avoid infinite loops.
 */
export const createTracker = async (
  config: Config,
  rulesEngineComponentContract: RulesEngineComponentContract,
  policyId: number,
  trSyntax: string
): Promise<number> => {
  const json = validateTrackerJSON(trSyntax);
  if (isLeft(json)) {
    throw new Error(getRulesErrorMessages(unwrapEither(json)));
  }
  const tracker = parseTrackerSyntax(unwrapEither(json));
  var transactionTracker = {
    set: true,
    pType: tracker.type,
    mapped: false,
    trackerKeyType: tracker.type,
    trackerValue: tracker.initialValue,
    trackerIndex: 0,
  };
  var addTR;
  while (true) {
    try {
      addTR = await simulateContract(config, {
        address: rulesEngineComponentContract.address,
        abi: rulesEngineComponentContract.abi,
        functionName: "createTracker",
        args: [policyId, transactionTracker, tracker.name],
      });
      break;
    } catch (err) {
      // TODO: Look into replacing this loop/sleep with setTimeout
      await sleep(1000);
    }
  }
  if (addTR != null) {
    const returnHash = await writeContract(config, {
      ...addTR.request,
      account: config.getClient().account,
    });
    await waitForTransactionReceipt(config, {
      hash: returnHash,
    });

    let trackerResult = addTR.result;
    return trackerResult;
  }
  return -1;
};
/**
 * Asynchronously updates a tracker in the rules engine component contract.
 *
 * @param config - The configuration object containing network and wallet information.
 * @param rulesEngineComponentContract - The contract instance for interacting with the rules engine component.
 * @param policyId - The ID of the policy associated with the tracker.
 * @param trackerId - The ID of the tracker to update.
 * @param trSyntax - A JSON string representing the tracker syntax.
 * @returns A promise that resolves to the existing tracker ID is returned. Returns -1 if the operation fails.
 *
 * @throws Will retry indefinitely with a 1-second delay between attempts if an error occurs during the contract simulation.
 *         Ensure proper error handling or timeout mechanisms are implemented to avoid infinite loops.
 */
export const updateTracker = async (
  config: Config,
  rulesEngineComponentContract: RulesEngineComponentContract,
  policyId: number,
  trackerId: number,
  trSyntax: string
): Promise<number> => {
  const json = validateTrackerJSON(trSyntax);
  if (isLeft(json)) {
    throw new Error(getRulesErrorMessages(unwrapEither(json)));
  }
  const tracker = parseTrackerSyntax(unwrapEither(json));
  var transactionTracker = {
    set: true,
    pType: tracker.type,
    mapped: false,
    trackerKeyType: tracker.type,
    trackerValue: tracker.initialValue,
    trackerIndex: trackerId,
  };
  var addTR;
  while (true) {
    try {
      addTR = await simulateContract(config, {
        address: rulesEngineComponentContract.address,
        abi: rulesEngineComponentContract.abi,
        functionName: "updateTracker",
        args: [policyId, trackerId, transactionTracker],
      });
      break;
    } catch (err) {
      // TODO: Look into replacing this loop/sleep with setTimeout
      await sleep(1000);
    }
  }
  if (addTR != null) {
    const returnHash = await writeContract(config, {
      ...addTR.request,
      account: config.getClient().account,
    });
    await waitForTransactionReceipt(config, {
      hash: returnHash,
    });
    return trackerId;
  }
  return -1;
};

/**
 * Deletes a tracker associated with a specific policy in the rules engine component contract.
 *
 * @param config - The configuration object containing network and wallet information.
 * @param rulesEngineComponentContract - The contract instance containing the address and ABI for interaction.
 * @param policyId - The ID of the policy to which the tracker belongs.
 * @param trackerId - The ID of the tracker to be deleted.
 * @returns A promise that resolves to a number:
 *          - `0` if the tracker was successfully deleted.
 *          - `-1` if an error occurred during the simulation of the contract interaction.
 *
 * @throws This function does not explicitly throw errors but will return `-1` if an error occurs during the simulation phase.
 */
export const deleteTracker = async (
  config: Config,
  rulesEngineComponentContract: RulesEngineComponentContract,
  policyId: number,
  trackerId: number
): Promise<number> => {
  var addFC;
  try {
    addFC = await simulateContract(config, {
      address: rulesEngineComponentContract.address,
      abi: rulesEngineComponentContract.abi,
      functionName: "deleteTracker",
      args: [policyId, trackerId],
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
      hash: returnHash,
    });
  }

  return 0;
};

/**
 * Retrieves a tracker from the Rules Engine Component Contract based on the provided policy ID and tracker ID.
 *
 * @param config - The configuration object containing network and wallet information.
 * @param rulesEngineComponentContract - The contract instance containing the address and ABI for interaction.
 * @param policyId - The ID of the policy associated with the tracker.
 * @param trackerId - The ID of the tracker to retrieve.
 * @returns A promise that resolves to the tracker result if successful, or `null` if an error occurs.
 *
 * @throws Will log an error to the console if the contract interaction fails.
 */
export const getTracker = async (
  config: Config,
  rulesEngineComponentContract: RulesEngineComponentContract,
  policyId: number,
  trackerId: number
): Promise<TrackerOnChain> => {
  try {
    const retrieveTR = await readContract(config, {
      address: rulesEngineComponentContract.address,
      abi: rulesEngineComponentContract.abi,
      functionName: "getTracker",
      args: [policyId, trackerId],
    });
    return retrieveTR as TrackerOnChain;
  } catch (error) {
    console.error(error);
    return {
      set: false,
      pType: 0,
      trackerKeyType: 0,
      trackerValue: "",
      trackerIndex: -1,
      mapped: false
    };
  }
};

/**
 * Retrieves the metadata for a tracker from the Rules Engine Component Contract based on the provided policy ID and tracker ID.
 *
 * @param config - The configuration object containing network and wallet information.
 * @param rulesEngineComponentContract - The contract instance containing the address and ABI for interaction.
 * @param policyId - The ID of the policy associated with the tracker.
 * @param trackerId - The ID of the tracker to retrieve.
 * @returns A promise that resolves to the tracker metadata result if successful, or `null` if an error occurs.
 *
 * @throws Will log an error to the console if the contract interaction fails.
 */
export const getTrackerMetadata = async (
  config: Config,
  rulesEngineComponentContract: RulesEngineComponentContract,
  policyId: number,
  trackerId: number
): Promise<string> => {
  try {
    const getMeta = await readContract(config, {
      address: rulesEngineComponentContract.address,
      abi: rulesEngineComponentContract.abi,
      functionName: "getTrackerMetadata",
      args: [policyId, trackerId],
    });

    let foreignCallResult = getMeta as string;
    return foreignCallResult;
  } catch (error) {
    console.error(error);
    return "";
  }
};

/**
 * Retrieves all trackers associated with a specific policy ID from the Rules Engine Component Contract.
 *
 * @param config - The configuration object containing network and wallet information.
 * @param rulesEngineComponentContract - An object representing the Rules Engine Component Contract,
 * @param policyId - The unique identifier of the policy for which trackers are to be retrieved.
 * including its address and ABI.
 * @returns A promise that resolves to an array of trackers if successful, or `null` if an error occurs.
 *
 * @throws Will log an error to the console if the operation fails.
 */
export const getAllTrackers = async (
  config: Config,
  rulesEngineComponentContract: RulesEngineComponentContract,
  policyId: number
): Promise<TrackerOnChain[]> => {
  try {
    const retrieveTR = await readContract(config, {
      address: rulesEngineComponentContract.address,
      abi: rulesEngineComponentContract.abi,
      functionName: "getAllTrackers",
      args: [policyId],
    });

    let trackerResult = retrieveTR as TrackerOnChain[];
    return trackerResult;
  } catch (error) {
    console.error(error);
    return [];
  }
};
