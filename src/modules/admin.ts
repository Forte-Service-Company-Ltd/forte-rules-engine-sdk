/// SPDX-License-Identifier: BUSL-1.1
import { Address, toFunctionSelector } from "viem";
import {
  simulateContract,
  waitForTransactionReceipt,
  writeContract,
  Config,
  readContract,
} from "@wagmi/core";
import { RulesEngineAdminContract } from "./types";
import { sleep } from "./contract-interaction-utils";

/**
 * @file admin.ts
 * @description This module provides a comprehensive set of functions for interacting with the admin functionality within the Rules Engine smart contracts.
 *              It includes functionality for granting, proposing, confirming, and retrieving admins.
 *
 * @module CallingFunctions
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
 * Propose a new admin in the rules engine admin contract.
 *
 * This function proposes a new admin for a specific policy.
 *
 * @param config - The configuration object containing network and wallet information.
 * @param rulesEngineAdminContract - The contract instance containing the address and ABI
 * @param policyId - The ID of the policy to set the admin for.
 * @param newAdminAddress - The address to propose as the new admin
 * @returns A promise
 *
 * @throws Will retry indefinitely on contract interaction failure, with a delay between attempts.
 */
export const proposeNewPolicyAdmin = async (
  config: Config,
  rulesEngineAdminContract: RulesEngineAdminContract,
  policyId: number,
  newAdminAddress: Address,
  confirmationCount: number
): Promise<void> => {
  var proposeAdmin;
  while (true) {
    try {
      proposeAdmin = await simulateContract(config, {
        address: rulesEngineAdminContract.address,
        abi: rulesEngineAdminContract.abi,
        functionName: "proposeNewPolicyAdmin",
        args: [newAdminAddress, policyId],
      });
      break;
    } catch (err) {
      await sleep(1000);
    }
  }
  if (proposeAdmin != null) {
    const returnHash = await writeContract(config, {
      ...proposeAdmin.request,
      account: config.getClient().account,
    });
    await waitForTransactionReceipt(config, {
      confirmations: confirmationCount,
      hash: returnHash,
    });
  }
};

/**
 * Confirm a new admin in the rules engine admin contract.
 *
 * This function confirms a new admin for a specific policy.
 *
 * @param rulesEngineAdminContract - The contract instance containing the address and ABI
 * @param policyId - The ID of the policy to set the admin for.
 * @returns A promise
 *
 * @throws Will retry indefinitely on contract interaction failure, with a delay between attempts.
 */
export const confirmNewPolicyAdmin = async (
  config: Config,
  rulesEngineAdminContract: RulesEngineAdminContract,
  policyId: number,
  confirmationCount: number
): Promise<void> => {
  var confirmAdmin;
  while (true) {
    try {
      confirmAdmin = await simulateContract(config, {
        address: rulesEngineAdminContract.address,
        abi: rulesEngineAdminContract.abi,
        functionName: "confirmNewPolicyAdmin",
        args: [policyId],
      });
      break;
    } catch (err) {
      console.log(err);
      await sleep(1000);
    }
  }
  if (confirmAdmin != null) {
    const returnHash = await writeContract(config, {
      ...confirmAdmin.request,
      account: config.getClient().account,
    });
    await waitForTransactionReceipt(config, {
      confirmations: confirmationCount,
      hash: returnHash,
    });
  }
};

/**
 * Determine if address is policy admin.
 *
 * This function determines whether or not an address is the admin for a specific policy.
 *
 * @param rulesEngineAdminContract - The contract instance containing the address and ABI
 * @param policyId - The ID of the policy to check the admin for.
 * @param adminAddress - The address to check
 * @returns whether or not the address is the policy admin.
 *
 */
export const isPolicyAdmin = async (
  config: Config,
  rulesEngineAdminContract: RulesEngineAdminContract,
  policyId: number,
  adminAddress: Address
): Promise<boolean> => {
  try {
    let policyExists = await readContract(config, {
      address: rulesEngineAdminContract.address,
      abi: rulesEngineAdminContract.abi,
      functionName: "isPolicyAdmin",
      args: [policyId, adminAddress],
    });
    return policyExists as boolean;
  } catch (error) {
    return false;
  }
};

/**
 * Propose a new calling contract admin in the rules engine admin contract.
 *
 * This function proposes a new admin for a specific calling contract.
 *
 * @param config - The configuration object containing network and wallet information.
 * @param rulesEngineAdminContract - The contract instance containing the address and ABI
 * @param callingContractAddress - The address of the calling contract to set the admin for.
 * @param newAdminAddress - The address to propose as the new admin
 * @returns A promise.
 *
 * @throws Will retry indefinitely on contract interaction failure, with a delay between attempts.
 */
export const proposeNewCallingContractAdmin = async (
  config: Config,
  rulesEngineAdminContract: RulesEngineAdminContract,
  callingContractAddress: Address,
  newAdminAddress: Address,
  confirmationCount: number // = 3
): Promise<void> => {
  var proposeAdmin;
  while (true) {
    try {
      proposeAdmin = await simulateContract(config, {
        address: rulesEngineAdminContract.address,
        abi: rulesEngineAdminContract.abi,
        functionName: "proposeNewCallingContractAdmin",
        args: [callingContractAddress, newAdminAddress],
      });
      break;
    } catch (err) {
      await sleep(1000);
    }
  }
  if (proposeAdmin != null) {
    const returnHash = await writeContract(config, {
      ...proposeAdmin.request,
      account: config.getClient().account,
    });
    await waitForTransactionReceipt(config, {
      confirmations: confirmationCount,
      hash: returnHash,
    });
  }
};

/**
 * Confirm a new calling contract admin in the rules engine admin contract.
 *
 * This function confirms a new admin for a specific callng contract.
 *
 * @param config - The configuration object containing network and wallet information.
 * @param rulesEngineAdminContract - The contract instance containing the address and ABI
 * @param callingContractAddress - The address of the calling contract to set the admin for.
 * @returns A promise.
 *
 * @throws Will retry indefinitely on contract interaction failure, with a delay between attempts.
 */
export const confirmNewCallingContractAdmin = async (
  config: Config,
  rulesEngineAdminContract: RulesEngineAdminContract,
  callingContractAddress: Address,
  confirmationCount: number
) => {
  var confirmAdmin;
  while (true) {
    try {
      confirmAdmin = await simulateContract(config, {
        address: rulesEngineAdminContract.address,
        abi: rulesEngineAdminContract.abi,
        functionName: "confirmNewCallingContractAdmin",
        args: [callingContractAddress],
      });
      break;
    } catch (err) {
      console.log(err);
      await sleep(1000);
    }
  }
  if (confirmAdmin != null) {
    const returnHash = await writeContract(config, {
      ...confirmAdmin.request,
      account: config.getClient().account,
    });
    await waitForTransactionReceipt(config, {
      confirmations: confirmationCount,
      hash: returnHash,
    });
  }
};

/**
 * Determine if address is the calling contract admin.
 *
 * This function determines whether or not an address is the admin for a specific calling contract.
 *
 * @param config - The configuration object containing network and wallet information.
 * @param rulesEngineAdminContract - The contract instance containing the address and ABI
 * @param callingContract - The address of the contract to check the admin for.
 * @param account - The address to check
 * @returns whether or not the address is the calling contract admin.
 *
 */
export const isCallingContractAdmin = async (
  config: Config,
  rulesEngineAdminContract: RulesEngineAdminContract,
  callingContract: Address,
  account: Address
): Promise<boolean> => {
  try {
    let policyExists = await readContract(config, {
      address: rulesEngineAdminContract.address,
      abi: rulesEngineAdminContract.abi,
      functionName: "isCallingContractAdmin",
      args: [callingContract, account],
    });
    return policyExists as boolean;
  } catch (error) {
    return false;
  }
};

/**
 * Determine if address is the foreign call admin.
 *
 * This function determines whether or not an address is the admin for a specific foreign call.
 *
 * @param config - The configuration object containing network and wallet information.
 * @param rulesEngineAdminContract - The contract instance containing the address and ABI
 * @param foreignCallContract - The address of the contract to check the admin for.
 * @param account - The address to check
 * @param functionSelector - The selector for the specific foreign call
 * @returns whether or not the address is the foreign call admin.
 *
 */
export const isForeignCallAdmin = async (
  config: Config,
  rulesEngineAdminContract: RulesEngineAdminContract,
  foreignCallContract: Address,
  account: Address,
  functionSelector: string
): Promise<boolean> => {
  var selector = toFunctionSelector(functionSelector);
  try {
    let isForeignCallAdmin = await readContract(config, {
      address: rulesEngineAdminContract.address,
      abi: rulesEngineAdminContract.abi,
      functionName: "isForeignCallAdmin",
      args: [foreignCallContract, account, selector],
    });
    return isForeignCallAdmin as boolean;
  } catch (error) {
    return false;
  }
};

/**
 * Propose a new foreign call admin in the rules engine admin contract.
 *
 * This function proposes a new admin for a specific foreign call.
 *
 * @param config - The configuration object containing network and wallet information.
 * @param rulesEngineAdminContract - The contract instance containing the address and ABI
 * @param foreignCallAddress - The address of the foreign call contract to set the admin for.
 * @param newAdminAddress - The address to propose as the new admin
 * @param functionSelector - The selector for the specific foreign call
 * @returns A promise.
 *
 * @throws Will retry indefinitely on contract interaction failure, with a delay between attempts.
 */
export const proposeNewForeignCallAdmin = async (
  config: Config,
  rulesEngineAdminContract: RulesEngineAdminContract,
  foreignCallAddress: Address,
  newAdminAddress: Address,
  functionSelector: string,
  confirmationCount: number
): Promise<void> => {
  var proposeAdmin;
  var selector = toFunctionSelector(functionSelector);
  while (true) {
    try {
      proposeAdmin = await simulateContract(config, {
        address: rulesEngineAdminContract.address,
        abi: rulesEngineAdminContract.abi,
        functionName: "proposeNewForeignCallAdmin",
        args: [foreignCallAddress, newAdminAddress, selector],
      });
      break;
    } catch (err) {
      await sleep(1000);
    }
  }
  if (proposeAdmin != null) {
    const returnHash = await writeContract(config, {
      ...proposeAdmin.request,
      account: config.getClient().account,
    });
    await waitForTransactionReceipt(config, {
      confirmations: confirmationCount,
      hash: returnHash,
    });
  }
};

/**
 * Confirm a new foreign call admin in the rules engine admin contract.
 *
 * This function confirms a new admin for a specific foreign call.
 *
 * @param config - The configuration object containing network and wallet information.
 * @param rulesEngineAdminContract - The contract instance containing the address and ABI
 * @param foreignCallAddress - The address of the foreign call to set the admin for.
 * @param functionSelector - The selector for the specific foreign call
 * @returns A promise.
 *
 * @throws Will retry indefinitely on contract interaction failure, with a delay between attempts.
 */
export const confirmNewForeignCallAdmin = async (
  config: Config,
  rulesEngineAdminContract: RulesEngineAdminContract,
  foreignCallAddress: Address,
  functionSelector: string,
  confirmationCount: number
) => {
  var confirmAdmin;
  var selector = toFunctionSelector(functionSelector);
  while (true) {
    try {
      confirmAdmin = await simulateContract(config, {
        address: rulesEngineAdminContract.address,
        abi: rulesEngineAdminContract.abi,
        functionName: "confirmNewForeignCallAdmin",
        args: [foreignCallAddress, selector],
      });
      break;
    } catch (err) {
      console.log(err);
      await sleep(1000);
    }
  }
  if (confirmAdmin != null) {
    const returnHash = await writeContract(config, {
      ...confirmAdmin.request,
      account: config.getClient().account,
    });
    await waitForTransactionReceipt(config, {
      confirmations: confirmationCount,
      hash: returnHash,
    });
  }
};
