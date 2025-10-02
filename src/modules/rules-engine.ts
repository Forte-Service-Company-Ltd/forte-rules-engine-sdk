/// SPDX-License-Identifier: BUSL-1.1
/**
 * @file RulesEngineInteraction.ts
 * @description This module provides a comprehensive set of functions for interacting with the Rules Engine smart contracts.
 *              It includes functionality for creating, updating, retrieving, and deleting policies, rules, foreign calls,
 *              trackers and calling functions.
 *
 * @module RulesEngine
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

import { Address, getContract } from 'viem'
import {
  NameToID,
  CallingFunctionHashMapping,
  RulesEngineComponentABI,
  RulesEngineComponentContract,
  RulesEnginePolicyABI,
  RulesEnginePolicyContract,
  RuleOnChain,
  Maybe,
  RulesEngineRulesContract,
  RulesEngineRulesABI,
  RulesEngineAdminContract,
  RulesEngineAdminABI,
  RulesEngineForeignCallContract,
  RulesEngineForeignCallABI,
  RuleMetadataStruct,
  PolicyMetadataStruct,
  TrackerMetadataStruct,
  ContractBlockParameters,
  CallingFunctionOnChain,
  ForeignCallOnChain,
} from './types'
import {
  createPolicy as createPolicyInternal,
  updatePolicy as updatePolicyInternal,
  setPolicies as setPoliciesInternal,
  unsetPolicies as unsetPoliciesInternal,
  appendPolicy as appendPolicyInternal,
  deletePolicy as deletePolicyInternal,
  getRulesEngineVersion as getRulesEngineVersionInternal,
  getPolicy as getPolicyInternal,
  policyExists as policyExistsInternal,
  getAppliedPolicyIds as getAppliedPolicyIdsInternal,
  isClosedPolicy as isClosedPolicyInternal,
  isDisabledPolicy as isDisabledPolicyInternal,
  closePolicy as closePolicyInternal,
  openPolicy as openPolicyInternal,
  disablePolicy as disablePolicyInternal,
  isClosedPolicySubscriber as isClosedPolicySubscriberInternal,
  addClosedPolicySubscriber as addClosedPolicySubscriberInternal,
  removeClosedPolicySubscriber as removeClosedPolicySubscriberInternal,
  cementPolicy as cementPolicyInternal,
  isCementedPolicy as isCementedPolicyInternal,
  getPolicyMetadata as getPolicyMetadataInternal,
  getVersionCompatible as getVersionCompatibleInternal,
} from './policy'

import {
  createRule as createRuleInternal,
  updateRule as updateRuleInternal,
  deleteRule as deleteRuleInternal,
  getRule as getRuleInternal,
  getAllRules as getAllRulesInternal,
  getRuleMetadata as getRuleMetadataInternal,
} from './rules'

import {
  createForeignCall as createForeignCallInternal,
  updateForeignCall as updateForeignCallInternal,
  deleteForeignCall as deleteForeignCallInternal,
  getForeignCall as getForeignCallInternal,
  getAllForeignCalls as getAllForeignCallsInternal,
  getForeignCallMetadata as getForeignCallMetadataInternal,
  getForeignCallPermissionList as getForeignCallPermissionListInternal,
  addAdminToPermissionList as addAdminToPermissionListInternal,
  addMultipleAdminsToPermissionList as addMultipleAdminsToPermissionListInternal,
  removeMultipleAdminsFromPermissionList as removeMultipleAdminsFromPermissionListInternal,
  removeAllFromPermissionList as removeAllFromPermissionListInternal,
  getPermissionedForeignCallsForPolicy as getPermissionedForeignCallsForPolicyInternal,
  isPermissionedAdmin as isPermissionedAdminInternal,
  removeFromPermissionList as removeFromPermissionListInternal,
  removeForeignCallPermissions as removeForeignCallPermissionsInternal,
} from './foreign-calls'

import {
  createTracker as createTrackerInternal,
  createMappedTracker as createMappedTrackerInternal,
  updateMappedTracker as updateMappedTrackerInternal,
  updateTracker as updateTrackerInternal,
  deleteTracker as deleteTrackerInternal,
  getTracker as getTrackerInternal,
  getAllTrackers as getAllTrackersInternal,
  getTrackerMetadata as getTrackerMetadataInternal,
  getTrackerToRuleIds as getTrackerToRuleIdsInternal,
  getMappedTrackerValue as getMappedTrackerValueInternal,
} from './trackers'

import {
  proposeNewPolicyAdmin as proposeNewPolicyAdminInternal,
  confirmNewPolicyAdmin as confirmNewPolicyAdminInternal,
  renouncePolicyAdminRole as renouncePolicyAdminRoleInternal,
  isPolicyAdmin as isPolicyAdminInternal,
  proposeNewCallingContractAdmin as proposeCallingContractAdminInternal,
  confirmNewCallingContractAdmin as confirmNewCallingContractAdminInternal,
  renounceCallingContractAdminRole as renounceCallingContractAdminRoleInternal,
  isCallingContractAdmin as isCallingContractAdminInternal,
  proposeNewForeignCallAdmin as proposeNewForeignCallAdminInternal,
  confirmNewForeignCallAdmin as confirmNewForeignCallAdminInternal,
  renounceForeignCallAdminRole as renounceForeignCallAdminRoleInternal,
  isForeignCallAdmin as isForeignCallAdminInternal,
} from './admin'

import {
  createCallingFunction as createCallingFunctionInternal,
  deleteCallingFunction as deleteCallingFunctionInternal,
  updateCallingFunction as updateCallingFunctionInternal,
  getCallingFunctionMetadata as getCallingFunctionMetadataInternal,
  getCallingFunctions as getAllCallingFunctionsInternal,
} from './calling-functions'
import { Config } from '@wagmi/core'
import { PolicyJSON } from './validation'

var config: Config

export class RulesEngine {
  private rulesEnginePolicyContract: RulesEnginePolicyContract
  private rulesEngineComponentContract: RulesEngineComponentContract
  private rulesEngineRulesContract: RulesEngineRulesContract
  private rulesEngineAdminContract: RulesEngineAdminContract
  private rulesEngineForeignCallContract: RulesEngineForeignCallContract
  private confirmationCount: number

  /**
   * @constructor - private constructor, must be called via the create function
   * @param {Address} rulesEngineAddress - The address of the deployed Rules Engine smart contract.
   * @param {Config} localConfig - The configuration object containing network and wallet information.
   * @param {any} client - The client instance for interacting with the blockchain.
   * @param {number} localConfirmationCount - The number of confirmations (blocks that have passed) to wait before resolving transaction receipts (default is 1).
   */
  private constructor(
    rulesEngineAddress: Address,
    localConfig: Config,
    client: any,
    localConfirmationCount: number = 1
  ) {
    this.rulesEnginePolicyContract = getContract({
      address: rulesEngineAddress,
      abi: RulesEnginePolicyABI,
      client,
    })
    this.rulesEngineComponentContract = getContract({
      address: rulesEngineAddress,
      abi: RulesEngineComponentABI,
      client,
    })
    this.rulesEngineRulesContract = getContract({
      address: rulesEngineAddress,
      abi: RulesEngineRulesABI,
      client,
    })
    this.rulesEngineAdminContract = getContract({
      address: rulesEngineAddress,
      abi: RulesEngineAdminABI,
      client,
    })
    this.rulesEngineForeignCallContract = getContract({
      address: rulesEngineAddress,
      abi: RulesEngineForeignCallABI,
      client,
    })
    config = localConfig
    this.confirmationCount = localConfirmationCount
  }
  public getRulesEnginePolicyContract(): RulesEnginePolicyContract {
    return this.rulesEnginePolicyContract
  }
  public getRulesEngineComponentContract(): RulesEngineComponentContract {
    return this.rulesEngineComponentContract
  }
  public getRulesEngineRulesContract(): RulesEngineRulesContract {
    return this.rulesEngineRulesContract
  }
  public getRulesEngineForeignCallContract(): RulesEngineForeignCallContract {
    return this.rulesEngineForeignCallContract
  }

  /**
   * Creates a Rules Engine instance using the private constructor if the supplied rules engine address is compatible.
   *
   * @param {Address} rulesEngineAddress - The address of the deployed Rules Engine smart contract.
   * @param {Config} localConfig - The configuration object containing network and wallet information.
   * @param {any} client - The client instance for interacting with the blockchain.
   * @param {number} localConfirmationCount - The number of confirmations (blocks that have passed) to wait before resolving transaction receipts (default is 1).
   */
  public static async create(
    rulesEngineAddress: Address,
    localConfig: Config,
    client: any,
    localConfirmationCount: number = 1
  ): Promise<Maybe<RulesEngine>> {
    const tempPolicyContract = getContract({
      address: rulesEngineAddress,
      abi: RulesEnginePolicyABI,
      client,
    })
    const compatible = await getVersionCompatibleInternal(localConfig, tempPolicyContract)
    if (compatible) {
      return new RulesEngine(rulesEngineAddress, localConfig, client, localConfirmationCount)
    }
    console.log('The version of the Rules Engine the address points to is not compatible with this version of the SDK')
    return null
  }

  /**
   * Creates a policy in the Rules Engine.
   *
   * @param policyJSON - Policy defined in a JSON string.
   * @returns An object containing the policy ID, transaction hash, and individual transaction hashes for all created components.
   */
  createPolicy(policyJSON: string): Promise<{
    callingFunctions: { functionId: number; transactionHash: `0x${string}` }[];
    trackers: { trackerId: number; transactionHash: `0x${string}` }[];
    foreignCalls: { foreignCallId: number; transactionHash: `0x${string}` }[];
    rules: { ruleId: number; transactionHash: `0x${string}` }[];
    policyId: number;
    transactionHash: `0x${string}`;
  }> {
    return createPolicyInternal(
      config,
      this.rulesEnginePolicyContract,
      this.rulesEngineRulesContract,
      this.rulesEngineComponentContract,
      this.rulesEngineForeignCallContract,
      this.confirmationCount,
      policyJSON
    )
  }

  getRulesEngineVersion(): Promise<string> {
    return getRulesEngineVersionInternal(config, this.rulesEnginePolicyContract)
  }

  getVersionCompatible(): Promise<boolean> {
    return getVersionCompatibleInternal(config, this.rulesEnginePolicyContract)
  }

  /**
   * Checks if a policy exists in the Rules Engine.
   *
   * @param policyId - The ID of the policy to check.
   * @returns True if the policy exists, false otherwise.
   */
  policyExists(policyId: number): Promise<boolean> {
    return policyExistsInternal(config, this.rulesEnginePolicyContract, policyId)
  }

  /**
   * Updates an existing policy in the Rules Engine.
   *
   *
   * @param policyJSON - Policy defined in a JSON string.
   * @returns The ID of the updated policy and the transaction hashes of the updated components.
   */
  updatePolicy(policySyntax: string, policyId: number): Promise<{
    callingFunctions: { functionId: number; transactionHash: `0x${string}` }[];
    trackers: { trackerId: number; transactionHash: `0x${string}` }[];
    foreignCalls: { foreignCallId: number; transactionHash: `0x${string}` }[];
    rules: { ruleId: number; transactionHash: `0x${string}` }[];
    policyId: number;
  }> {
    return updatePolicyInternal(
      config,
      this.rulesEnginePolicyContract,
      this.rulesEngineRulesContract,
      this.rulesEngineComponentContract,
      this.rulesEngineForeignCallContract,
      this.confirmationCount,
      policySyntax,
      policyId
    )
  }

  /**
   * Sets the policies appled to a specific contract address.
   *
   * @param policyIds - The list of IDs of all of the policies that will be applied to the contract
   * @param contractAddressForPolicy - The address of the contract to which the policy will be applied.
   */
  setPolicies(policyIds: [number], contractAddressForPolicy: Address) {
    setPoliciesInternal(
      config,
      this.rulesEnginePolicyContract,
      policyIds,
      contractAddressForPolicy,
      this.confirmationCount
    )
  }

  /**
   * Unsets the policies appled to a specific contract address.
   *
   * @param policyIds - The list of IDs of all of the policies that will be unapplied to the contract
   * @param contractAddressForPolicy - The address of the contract to which the policy will be unapplied.
   */
  unsetPolicies(policyIds: [number], contractAddressForPolicy: Address) {
    unsetPoliciesInternal(
      config,
      this.rulesEnginePolicyContract,
      policyIds,
      contractAddressForPolicy,
      this.confirmationCount
    )
  }

  /**
   * Appends a policy to the list of policies applied to a specific contract address.
   *
   * @param policyId - The ID of the policy to apply.
   * @param contractAddressForPolicy - The address of the contract to which the policy will be applied.
   */
  appendPolicy(policyId: number, contractAddressForPolicy: Address) {
    appendPolicyInternal(
      config,
      this.rulesEnginePolicyContract,
      policyId,
      contractAddressForPolicy,
      this.confirmationCount
    )
  }

  /**
   * Deletes a policy from the Rules Engine.
   *
   * @param policyId - The ID of the policy to delete.
   * @returns Object with `result` (0 if successful, -1 if error) and `transactionHash`.
   */
  deletePolicy(policyId: number): Promise<{ result: number; transactionHash: `0x${string}` }> {
    return deletePolicyInternal(config, this.rulesEnginePolicyContract, policyId, this.confirmationCount)
  }

  /**
   * Retrieves the full policy, including rules, trackers, and foreign calls, as a JSON string.
   *
   * @param policyId - The ID of the policy to retrieve.
   * @param blockParams - Optional parameters to specify block number or tag for the contract read operation.
   * @returns — A PolicyResult object containing both the policy object and JSON string, or an empty string if an error occurs.
   */
  getPolicy(policyId: number, blockParams?: ContractBlockParameters): Promise<Maybe<PolicyJSON>> {
    return getPolicyInternal(
      config,
      this.rulesEnginePolicyContract,
      this.rulesEngineRulesContract,
      this.rulesEngineComponentContract,
      this.rulesEngineForeignCallContract,
      policyId,
      blockParams
    )
  }

  /**
   * Retrieves the metadata for a policy from the Rules Engine Policy Contract based on the provided policy ID.
   *
   * @param policyId - The ID of the policy.
   * @param blockParams - Optional parameters to specify block number or tag for the contract read operation.
   * @returns A promise that resolves to the policy metadata result if successful, or `null` if an error occurs.
   *
   * @throws Will log an error to the console if the contract interaction fails.
   */
  getPolicyMetadata = async (
    policyId: number,
    blockParams?: ContractBlockParameters
  ): Promise<Maybe<PolicyMetadataStruct>> => {
    return getPolicyMetadataInternal(config, this.rulesEnginePolicyContract, policyId, blockParams)
  }

  /**
   * Retrieves the IDs of all of the policies that have been applied to a contract address.
   * @param address - The address to check.
   * @param blockParams - Optional parameters to specify block number or tag for the contract read operation.
   * @returns array of all of the policy ids applied to the contract
   */
  getAppliedPolicyIds(address: string, blockParams?: ContractBlockParameters): Promise<number[]> {
    return getAppliedPolicyIdsInternal(config, this.rulesEnginePolicyContract, address, blockParams)
  }

  /**
   * Retrieves whether a policy is open or closed.
   * @param policyId - The ID of the policy to check.
   * @param blockParams - Optional parameters to specify block number or tag for the contract read operation.
   * @returns True if the policy is closed, false otherwise
   */
  isClosedPolicy(policyId: number, blockParams?: ContractBlockParameters): Promise<boolean> {
    return isClosedPolicyInternal(config, this.rulesEnginePolicyContract, policyId, blockParams)
  }

  /**
   * Retrieves whether a policy is disabled.
   * @param policyId - The ID of the policy to check.
   * @param blockParams - Optional parameters to specify block number or tag for the contract read operation.
   * @returns True if the policy is disabled, false otherwise
   */
  isDisabledPolicy(policyId: number, blockParams?: ContractBlockParameters): Promise<boolean> {
    return isDisabledPolicyInternal(config, this.rulesEnginePolicyContract, policyId, blockParams)
  }

  /**
   * Disable a policy on the Rules Engine.
   *
   * @param policyId - The ID of the policy to disable.
   * @returns Object with `result` (0 if successful, -1 if error) and `transactionHash`.
   */
  disablePolicy(policyId: number): Promise<{ result: number; transactionHash: `0x${string}` }> {
    return disablePolicyInternal(config, this.rulesEnginePolicyContract, policyId, this.confirmationCount)
  }

  /**
   * Opens a policy on the Rules Engine.
   *
   * @param policyId - The ID of the policy to open.
   * @returns Object with `result` (0 if successful, -1 if error) and `transactionHash`.
   */
  openPolicy(policyId: number): Promise<{ result: number; transactionHash: `0x${string}` }> {
    return openPolicyInternal(config, this.rulesEnginePolicyContract, policyId, this.confirmationCount)
  }

  /**
   * Closes a policy on the Rules Engine.
   *
   * @param policyId - The ID of the policy to close.
   * @returns Object with `result` (0 if successful, -1 if error) and `transactionHash`.
   */
  closePolicy(policyId: number): Promise<{ result: number; transactionHash: `0x${string}` }> {
    return closePolicyInternal(config, this.rulesEnginePolicyContract, policyId, this.confirmationCount)
  }

  /**
   * Retrieves whether an address is a possible subscriber to the closed policy.
   * @param policyId - The ID of the policy to check.
   * @param subscriber - The address to check
   * @param blockParams - Optional parameters to specify block number or tag for the contract read operation.
   * @returns True if the address is a subscriber to the closed policy, false otherwise
   */
  isClosedPolicySubscriber(
    policyId: number,
    subscriber: Address,
    blockParams?: ContractBlockParameters
  ): Promise<boolean> {
    return isClosedPolicySubscriberInternal(
      config,
      this.rulesEngineComponentContract,
      policyId,
      subscriber,
      blockParams
    )
  }

  /** Adds a subscriber to the closed policy.
   *
   * @param policyId - The ID of the policy to add to.
   * @param subscriber - The address of the subscriber to add.
   * @returns Object with `result` (0 if successful, -1 if error) and `transactionHash`.
   */
  addClosedPolicySubscriber(policyId: number, subscriber: Address): Promise<{ result: number; transactionHash: `0x${string}` }> {
    return addClosedPolicySubscriberInternal(
      config,
      this.rulesEngineComponentContract,
      policyId,
      subscriber,
      this.confirmationCount
    )
  }

  /**
   * Removes a subscriber from the closed policy.
   *
   * @param policyId - The ID of the policy to remove from.
   * @param subscriber - The address of the subscriber to remove.
   * @returns Object with `result` (0 if successful, -1 if error) and `transactionHash`.
   */
  removeClosedPolicySubscriber(policyId: number, subscriber: Address): Promise<{ result: number; transactionHash: `0x${string}` }> {
    return removeClosedPolicySubscriberInternal(
      config,
      this.rulesEngineComponentContract,
      policyId,
      subscriber,
      this.confirmationCount
    )
  }

  /**
   * Asynchronously creates a new rule in the rules engine policy contract.
   *
   * @param policyId - The ID of the policy to which the rule belongs.
   * @param ruleS - A JSON string representing the rule to be created.
   * @param foreignCallNameToID - An array mapping foreign call names to their corresponding IDs.
   * @param trackerNameToID - An array mapping tracker names to their corresponding IDs.
   * @returns A promise that resolves to the result of the rule creation operation. Returns the rule ID if successful, or -1 if the operation fails.
   *
   * @remarks
   * - The function parses the rule JSON string to build the rule and effect structures.
   * - It uses a retry mechanism with a delay to handle potential failures during contract simulation.
   */
  createNewRule(
    policyId: number,
    ruleS: string,
    foreignCallNameToID: NameToID[],
    trackerNameToID: NameToID[]
  ): Promise<{ ruleId: number; transactionHash: `0x${string}` }> {
    return createRuleInternal(
      config,
      this.rulesEnginePolicyContract,
      this.rulesEngineRulesContract,
      this.rulesEngineComponentContract,
      this.rulesEngineForeignCallContract,
      policyId,
      ruleS,
      foreignCallNameToID,
      trackerNameToID,
      this.confirmationCount
    )
  }

  /**
   * Updates an existing rule in the Rules Engine Policy Contract.
   *
   * @param policyId - The ID of the policy to which the rule belongs.
   * @param ruleId - The ID of the rule to be updated.
   * @param ruleS - A JSON string representing the rule's structure and logic.
   * @param foreignCallNameToID - A mapping of foreign call names to their corresponding IDs.
   * @param trackerNameToID - A mapping of tracker names to their corresponding IDs.
   * @returns A promise that resolves to object with `ruleId` and `transactionHash`. Returns the ruleId if successful, or -1 if the operation fails.
   *
   */
  updateRule(
    policyId: number,
    ruleId: number,
    ruleS: string,
    foreignCallNameToID: NameToID[],
    trackerNameToID: NameToID[]
  ): Promise<{ ruleId: number; transactionHash: `0x${string}` }> {
    return updateRuleInternal(
      config,
      this.rulesEnginePolicyContract,
      this.rulesEngineRulesContract,
      this.rulesEngineComponentContract,
      this.rulesEngineForeignCallContract,
      policyId,
      ruleId,
      ruleS,
      foreignCallNameToID,
      trackerNameToID,
      this.confirmationCount
    )
  }

  /**
   * Deletes a rule from the rules engine component contract.
   *
   * @param policyId - The ID of the policy to which the rule belongs.
   * @param ruleId - The ID of the rule to be deleted.
   * @returns A promise that resolves to a number:
   *          - `0` if the rule was successfully deleted.
   *          - `-1` if an error occurred during the deletion process.
   *
   * @throws This function does not throw errors directly but returns `-1` in case of an exception.
   */
  deleteRule(policyId: number, ruleId: number): Promise<number> {
    return deleteRuleInternal(config, this.rulesEngineRulesContract, policyId, ruleId, this.confirmationCount)
  }

  /**
   * Retrieves a specific rule from the Rules Engine.
   *
   * @param policyId - The ID of the policy containing the rule.
   * @param ruleId - The ID of the rule to retrieve.
   * @param blockParams - Optional parameters to specify block number or tag for the contract read operation.
   * @returns The retrieved rule as a `RuleOnChain`, or `null` if retrieval fails.
   */
  getRule(policyId: number, ruleId: number, blockParams?: ContractBlockParameters): Promise<Maybe<RuleOnChain>> {
    return getRuleInternal(config, this.rulesEngineRulesContract, policyId, ruleId, blockParams)
  }

  /**
   * Retrieves the metadata for a rule from the Rules Engine Rules Contract based on the provided policy ID and rule ID.
   *
   * @param policyId - The ID of the policy associated with the rule.
   * @param ruleId - The ID of the rule to retrieve.
   * @param blockParams - Optional parameters to specify block number or tag for the contract read operation.
   * @returns A promise that resolves to the rule metadata result if successful, or `null` if an error occurs.
   *
   * @throws Will log an error to the console if the contract interaction fails.
   */
  getRuleMetadata(
    policyId: number,
    ruleId: number,
    blockParams?: ContractBlockParameters
  ): Promise<Maybe<RuleMetadataStruct>> {
    return getRuleMetadataInternal(config, this.rulesEngineRulesContract, policyId, ruleId, blockParams)
  }

  /**
   * Retrieves all rules associated with a specific policy ID from the Rules Engine Policy Contract.
   *
   * @param policyId - The unique identifier of the policy for which rules are to be retrieved.
   * @param blockParams - Optional parameters to specify block number or tag for the contract read operation.
   * @returns A promise that resolves to an array of rules if successful, or `null` if an error occurs.
   *
   * @throws Will log an error to the console if the operation fails.
   */
  getAllRules(policyId: number, blockParams?: ContractBlockParameters): Promise<Maybe<any[]>> {
    return getAllRulesInternal(config, this.rulesEngineRulesContract, policyId, blockParams)
  }

  /**
   * Creates a foreign call in the rules engine component contract.
   *
   * @param policyId - The ID of the policy to associate with the foreign call.
   * @param fcSyntax - A JSON string representing the foreign call definition.
   * @returns A promise that resolves to object with `foreignCallId` and `transactionHash`. Returns `-1` if the operation fails.
   *
   * @remarks
   * - The function retries the contract interaction in case of failure, with a delay of 1 second between attempts.
   * - The `simulateContract` function is used to simulate the contract interaction before writing to the blockchain.
   * - The `writeContract` function is used to execute the contract interaction on the blockchain.
   * - The function returns the `foreignCallIndex` for an updated foreign call or the result of the newly created foreign call.
   *
   * @throws Will throw an error if the JSON parsing of `fcSyntax` fails.
   */
  createForeignCall(policyId: number, fcSyntax: string): Promise<{ foreignCallId: number; transactionHash: `0x${string}` }> {
    return createForeignCallInternal(
      config,
      this.rulesEngineForeignCallContract,
      this.rulesEngineComponentContract,
      this.rulesEnginePolicyContract,
      policyId,
      fcSyntax,
      this.confirmationCount
    )
  }

  /**
   * Updates a foreign call in the rules engine component contract.
   *
   * @param policyId - The ID of the policy to associate with the foreign call.
   * @param foreignCallId - The ID of the foreign call to update.
   * @param fcSyntax - A JSON string representing the foreign call definition.
   * @returns A promise that resolves to object with `foreignCallId` and `transactionHash`. Returns `-1` if the operation fails.
   *
   * @remarks
   * - The function retries the contract interaction in case of failure, with a delay of 1 second between attempts.
   * - The `simulateContract` function is used to simulate the contract interaction before writing to the blockchain.
   * - The `writeContract` function is used to execute the contract interaction on the blockchain.
   * - The function returns the `foreignCallIndex` for an updated foreign call or the result of the newly created foreign call.
   *
   * @throws Will throw an error if the JSON parsing of `fcSyntax` fails.
   */
  updateForeignCall(policyId: number, foreignCallId: number, fcSyntax: string): Promise<{ foreignCallId: number; transactionHash: `0x${string}` }> {
    return updateForeignCallInternal(
      config,
      this.rulesEnginePolicyContract,
      this.rulesEngineComponentContract,
      this.rulesEngineForeignCallContract,
      policyId,
      foreignCallId,
      fcSyntax,
      this.confirmationCount
    )
  }

  /**
   * Deletes a foreign call associated with a specific policy in the rules engine component contract.
   *
   * @param policyId - The ID of the policy to which the foreign call belongs.
   * @param foreignCallId - The ID of the foreign call to be deleted.
   * @returns A promise that resolves to a number:
   *          - `0` if the operation is successful.
   *          - `-1` if an error occurs during the simulation of the contract interaction.
   *
   * @throws This function does not explicitly throw errors but will return `-1` if an error occurs during the simulation phase.
   */
  deleteForeignCall(policyId: number, foreignCallId: number): Promise<number> {
    return deleteForeignCallInternal(
      config,
      this.rulesEngineForeignCallContract,
      policyId,
      foreignCallId,
      this.confirmationCount
    )
  }

  /**
   * Retrieves the result of a foreign call from the rules engine component contract.
   *
   * @param policyId - The ID of the policy associated with the foreign call.
   * @param foreignCallId - The ID of the foreign call to retrieve.
   * @param blockParams - Optional parameters to specify block number or tag for the contract read operation.
   * @returns A promise that resolves to the result of the foreign call, or `null` if an error occurs.
   *
   * @throws Will log an error to the console if the contract interaction fails.
   */
  getForeignCall(policyId: number, foreignCallId: number, blockParams?: ContractBlockParameters): Promise<Maybe<any>> {
    return getForeignCallInternal(config, this.rulesEngineForeignCallContract, policyId, foreignCallId, blockParams)
  }

  /**
   * Retrieves all foreign calls associated with a specific policy ID from the Rules Engine Component Contract.
   *
   * @param policyId - The ID of the policy for which foreign calls are to be retrieved.
   * @param blockParams - Optional parameters to specify block number or tag for the contract read operation.
   * @returns A promise that resolves to an array of foreign calls if successful, or `null` if an error occurs.
   *
   * @throws Will log an error to the console if the operation fails.
   */
  getAllForeignCalls(policyId: number, blockParams?: ContractBlockParameters): Promise<Maybe<any[]>> {
    return getAllForeignCallsInternal(config, this.rulesEngineForeignCallContract, policyId, blockParams)
  }

  /**
   * Retrieves the metadata for a foreign call from the rules engine component contract.
   *
   * @param policyId - The ID of the policy associated with the foreign call.
   * @param foreignCallId - The ID of the foreign call to retrieve.
   * @returns A promise that resolves to the result of the foreign call, or `null` if an error occurs.
   *
   * @throws Will log an error to the console if the contract interaction fails.
   */
  getForeignCallMetadata(
    policyId: number,
    foreignCallId: number,
    blockParams?: ContractBlockParameters
  ): Promise<Maybe<any>> {
    return getForeignCallMetadataInternal(
      config,
      this.rulesEngineForeignCallContract,
      policyId,
      foreignCallId,
      blockParams
    )
  }

  /**
   * Retrieves the permission list for a permissioned foreign call.
   *
   * @param foreignCallAddress - the address of the contract the foreign call belongs to.
   * @param functionSelector - The selector for the specific foreign call
   * @param blockParams - Optional parameters to specify block number or tag for the contract read operation.
   * @returns Array of addresses that make up the permission list
   *
   * @throws Will log an error to the console if the operation fails.
   */
  getForeignCallPermissionList(
    foreignCallAddress: Address,
    functionSelector: string,
    blockParams?: ContractBlockParameters
  ): Promise<Address[]> {
    return getForeignCallPermissionListInternal(
      config,
      this.rulesEngineForeignCallContract,
      foreignCallAddress,
      functionSelector,
      blockParams
    )
  }

  /**
   * Adds a new address to the permission list for a foreign call.
   *
   * @param foreignCallAddress - the address of the contract the foreign call belongs to.
   * @param functionSelector - The selector for the specific foreign call
   * @param policyAdminToAdd - The address of the admin to add to the list
   * @returns Object with `result` (0 if successful, -1 if error) and `transactionHash`.
   *
   * @throws Will log an error to the console if the operation fails.
   */
  addAdminToPermissionList(
    foreignCallAddress: Address,
    functionSelector: string,
    policyAdminToAdd: Address
  ): Promise<{ result: number; transactionHash: `0x${string}` }> {
    return addAdminToPermissionListInternal(
      config,
      this.rulesEngineForeignCallContract,
      foreignCallAddress,
      functionSelector,
      policyAdminToAdd,
      this.confirmationCount
    )
  }

  /**
   * Adds multiple addresses to the permission list for a foreign call.
   *
   * @param foreignCallAddress - the address of the contract the foreign call belongs to.
   * @param functionSelector - The selector for the specific foreign call
   * @param policyAdminsToAdd - The addresses of the admins to add to the list
   * @returns Object with `result` (0 if successful, -1 if error) and `transactionHash`.
   *
   * @throws Will log an error to the console if the operation fails.
   */
  addMultipleAdminsToPermissionList(
    foreignCallAddress: Address,
    functionSelector: string,
    policyAdminsToAdd: Address[]
  ): Promise<{ result: number; transactionHash: `0x${string}` }> {
    return addMultipleAdminsToPermissionListInternal(
      config,
      this.rulesEngineForeignCallContract,
      foreignCallAddress,
      functionSelector,
      policyAdminsToAdd,
      this.confirmationCount
    )
  }

  /**
   * Removes multiple addresses from the permission list for a foreign call.
   *
   * @param foreignCallAddress - the address of the contract the foreign call belongs to.
   * @param functionSelector - The selector for the specific foreign call
   * @param policyAdminsToRemove - The address of the admins to remove from the list
   * @returns Object with `result` (0 if successful, -1 if error) and `transactionHash`.
   *
   * @throws Will log an error to the console if the operation fails.
   */
  removeMultipleAdminsFromPermissionList(
    foreignCallAddress: Address,
    functionSelector: string,
    policyAdminsToRemove: Address[]
  ): Promise<{ result: number; transactionHash: `0x${string}` }> {
    return removeMultipleAdminsFromPermissionListInternal(
      config,
      this.rulesEngineForeignCallContract,
      foreignCallAddress,
      functionSelector,
      policyAdminsToRemove,
      this.confirmationCount
    )
  }

  /**
   * Removes all addresses from the permission list for a foreign call.
   *
   * @param foreignCallAddress - the address of the contract the foreign call belongs to.
   * @param functionSelector - The selector for the specific foreign call
   * @returns Object with `result` (0 if successful, -1 if error) and `transactionHash`.
   *
   * @throws Will log an error to the console if the operation fails.
   */
  removeAllFromPermissionList(foreignCallAddress: Address, functionSelector: string): Promise<{ result: number; transactionHash: `0x${string}` }> {
    return removeAllFromPermissionListInternal(
      config,
      this.rulesEngineForeignCallContract,
      foreignCallAddress,
      functionSelector,
      this.confirmationCount
    )
  }

  /**
   * Gets permissioned foreign calls for a specific policy ID.
   *
   * @param policyId - the ID of the policy the foreign call belongs to.
   * @param blockParams - Optional parameters to specify block number or tag for the contract read operation.
   * @returns A promise that resolves to ForeignCallOnChain[]:
   *
   * @throws Will log an error to the console if the operation fails.
   */
  getPermissionedForeignCallsForPolicy(
    policyId: number,
    blockParams?: ContractBlockParameters
  ): Promise<ForeignCallOnChain[]> {
    return getPermissionedForeignCallsForPolicyInternal(
      config,
      this.rulesEngineForeignCallContract,
      policyId,
      blockParams
    )
  }

  /**
   * Determines if a user is a permissioned admin for a specific policy ID.
   *
   * @param foreignCallAddress - the address of the foreign call.
   * @param signature - the signature of the function being called.
   * @param adminAddress - the address of the admin to check.
   * @param blockParams - Optional parameters to specify block number or tag for the contract read operation.
   * @returns A promise that resolves to a boolean indicating if the user is a permissioned admin.
   *
   * @throws Will log an error to the console if the operation fails.
   */
  isPermissionedAdmin(
    foreignCallAddress: Address,
    signature: string,
    adminAddress: Address,
    blockParams?: ContractBlockParameters
  ): Promise<boolean> {
    return isPermissionedAdminInternal(
      config,
      this.rulesEngineForeignCallContract,
      foreignCallAddress,
      signature,
      adminAddress,
      blockParams
    )
  }

  /**
   * Removes admin from the permission list for a specific foreign call.
   *
   * @param foreignCallAddress - The address of the foreign call contract.
   * @param signature - The function signature.
   * @param adminAddress - The address of the admin to remove.
   * @returns Object with `result` (0 if successful, -1 if error) and `transactionHash`.
   *
   * @throws Will retry indefinitely with a 1-second delay between attempts if an error occurs during the contract simulation.
   *         Ensure proper error handling or timeout mechanisms are implemented to avoid infinite loops.
   */
  removeFromPermissionList(foreignCallAddress: Address, signature: string, adminAddress: Address): Promise<{ result: number; transactionHash: `0x${string}` }> {
    return removeFromPermissionListInternal(
      config,
      this.rulesEngineForeignCallContract,
      foreignCallAddress,
      signature,
      adminAddress,
      this.confirmationCount
    )
  }

  /**
   * Removes all permissions for a specific foreign call.
   *
   * @param foreignCallAddress - The address of the foreign call contract.
   * @param signature - The function signature.
   * @returns Object with `result` (0 if successful, -1 if error) and `transactionHash`.
   *
   * @throws Will retry indefinitely with a 1-second delay between attempts if an error occurs during the contract simulation.
   *         Ensure proper error handling or timeout mechanisms are implemented to avoid infinite loops.
   */
  removeForeignCallPermissions(foreignCallAddress: Address, signature: string): Promise<{ result: number; transactionHash: `0x${string}` }> {
    return removeForeignCallPermissionsInternal(
      config,
      this.rulesEngineForeignCallContract,
      foreignCallAddress,
      signature,
      this.confirmationCount
    )
  }

  /**
   * Asynchronously creates a tracker in the rules engine component contract.
   *
   * @param policyId - The ID of the policy associated with the tracker.
   * @param trSyntax - A JSON string representing the tracker syntax.
   * @returns A promise that resolves to object with `trackerId` and `transactionHash`.
   *
   * @throws Will retry indefinitely with a 1-second delay between attempts if an error occurs during the contract simulation.
   *         Ensure proper error handling or timeout mechanisms are implemented to avoid infinite loops.
   */
  createTracker(policyId: number, trSyntax: string): Promise<{ trackerId: number; transactionHash: `0x${string}` }> {
    return createTrackerInternal(config, this.rulesEngineComponentContract, policyId, trSyntax, this.confirmationCount)
  }

  /**
   * Asynchronously creates a mapped tracker in the rules engine component contract.
   *
   * @param policyId - The ID of the policy associated with the tracker.
   * @param mappedTrackerSyntax - A JSON string representing the tracker syntax.
   * @returns Object with `trackerId` and `transactionHash`.
   */
  createMappedTracker(policyId: number, mappedTrackerSyntax: string): Promise<{ trackerId: number; transactionHash: `0x${string}` }> {
    return createMappedTrackerInternal(
      config,
      this.rulesEngineComponentContract,
      policyId,
      mappedTrackerSyntax,
      this.confirmationCount
    )
  }

  /**
   * Asynchronously updates a mapped tracker in the rules engine component contract.
   *
   * @param policyId - The ID of the policy associated with the tracker.
   * @param mappedTrackerId - The ID of the tracker to update.
   * @param mappedTrackerSyntax - A JSON string representing the tracker syntax.
   * @returns Object with `trackerId` and `transactionHash`.
   */
  updateMappedTracker(policyId: number, mappedTrackerId: number, mappedTrackerSyntax: string): Promise<{ trackerId: number; transactionHash: `0x${string}` }> {
    return updateMappedTrackerInternal(
      config,
      this.rulesEngineComponentContract,
      policyId,
      mappedTrackerSyntax,
      mappedTrackerId,
      this.confirmationCount
    )
  }

  /**
   * Asynchronously updates a tracker in the rules engine component contract.
   *
   * @param policyId - The ID of the policy associated with the tracker.
   * @param trackerId - The ID of the tracker to update.
   * @param trSyntax - A JSON string representing the tracker syntax.
   * @returns A promise that resolves to object with `trackerId` and `transactionHash`. Returns -1 if the operation fails.
   *
   * @throws Will retry indefinitely with a 1-second delay between attempts if an error occurs during the contract simulation.
   *         Ensure proper error handling or timeout mechanisms are implemented to avoid infinite loops.
   */
  updateTracker(policyId: number, trackerId: number, trSyntax: string): Promise<{ trackerId: number; transactionHash: `0x${string}` }> {
    return updateTrackerInternal(
      config,
      this.rulesEngineComponentContract,
      policyId,
      trackerId,
      trSyntax,
      this.confirmationCount
    )
  }

  /**
   * Deletes a tracker associated with a specific policy in the rules engine component contract.
   *
   * @param policyId - The ID of the policy to which the tracker belongs.
   * @param trackerId - The ID of the tracker to be deleted.
   * @returns A promise that resolves to a number:
   *          - `0` if the tracker was successfully deleted.
   *          - `-1` if an error occurred during the simulation of the contract interaction.
   *
   * @throws This function does not explicitly throw errors but will return `-1` if an error occurs during the simulation phase.
   */
  deleteTracker(policyId: number, trackerId: number): Promise<number> {
    return deleteTrackerInternal(config, this.rulesEngineComponentContract, policyId, trackerId, this.confirmationCount)
  }

  /**
   * Retrieves a tracker from the Rules Engine Component Contract based on the provided policy ID and tracker ID.
   *
   * @param policyId - The ID of the policy associated with the tracker.
   * @param trackerId - The ID of the tracker to retrieve.
   * @param blockParams - Optional parameters to specify block number or tag for the contract read operation.
   * @returns A promise that resolves to the tracker result if successful, or `null` if an error occurs.
   *
   * @throws Will log an error to the console if the contract interaction fails.
   */
  getTracker(policyId: number, trackerId: number, blockParams?: ContractBlockParameters): Promise<Maybe<any>> {
    return getTrackerInternal(config, this.rulesEngineComponentContract, policyId, trackerId, blockParams)
  }

  /**
   * Retrieves a mapped tracker value from the Rules Engine Component Contract based on the provided policy ID, tracker ID, and key.
   *
   * @param policyId - The ID of the policy associated with the tracker.
   * @param index - The index of the tracker to retrieve.
   * @param key - The key of the mapped tracker value to retrieve.
   * @param blockParams - Optional parameters to specify block number or tag for the contract read operation.
   * @returns A promise that resolves to the tracker result if successful, or `null` if an error occurs.
   *
   * @throws Will log an error to the console if the contract interaction fails.
   */
  getMappedTrackerValue(
    policyId: number,
    index: number,
    key: string,
    blockParams?: ContractBlockParameters
  ): Promise<Maybe<any>> {
    return getMappedTrackerValueInternal(config, this.rulesEngineComponentContract, policyId, index, key, blockParams)
  }

  /**
   * Retrieves all trackers associated with a specific policy ID from the Rules Engine Component Contract.
   *
   * @param policyId - The unique identifier of the policy for which trackers are to be retrieved.
   * @param blockParams - Optional parameters to specify block number or tag for the contract read operation.
   * @returns A promise that resolves to an array of trackers if successful, or `null` if an error occurs.
   *
   * @throws Will log an error to the console if the operation fails.
   */
  getAllTrackers(policyId: number, blockParams?: ContractBlockParameters): Promise<Maybe<any[]>> {
    return getAllTrackersInternal(config, this.rulesEngineComponentContract, policyId, blockParams)
  }

  /**
   * Retrieves the metadata for a tracker from the Rules Engine Component Contract based on the provided policy ID and tracker ID.
   *
   * @param policyId - The ID of the policy associated with the tracker.
   * @param trackerId - The ID of the tracker to retrieve.
   * @param blockParams - Optional parameters to specify block number or tag for the contract read operation.
   * @returns A promise that resolves to the tracker metadata result if successful, or `null` if an error occurs.
   *
   * @throws Will log an error to the console if the contract interaction fails.
   */
  getTrackerMetadata(
    policyId: number,
    trackerId: number,
    blockParams?: ContractBlockParameters
  ): Promise<Maybe<TrackerMetadataStruct>> {
    return getTrackerMetadataInternal(config, this.rulesEngineComponentContract, policyId, trackerId, blockParams)
  }

  /**
   * Retrieves the rule IDs associated with a specific tracker from the Rules Engine Component Contract
   * based on the provided policy ID and tracker ID.
   *
   * @param policyId - The ID of the policy associated with the tracker.
   * @param trackerId - The ID of the tracker for which rule IDs are to be retrieved.
   * @returns A promise that resolves to an array of rule IDs if successful, or an empty array if an error occurs.
   *
   * @throws Will log an error to the console if the contract interaction fails.
   */
  getTrackerToRuleIds(
    policyId: number,
    trackerId: number,
    blockParams?: ContractBlockParameters
  ): Promise<Maybe<number[]>> {
    return getTrackerToRuleIdsInternal(config, this.rulesEngineComponentContract, policyId, trackerId, blockParams)
  }

  /**
   * Creates a calling function in the rules engine component contract.
   *
   * This function parses the provided calling function, maps its arguments to their respective
   * types, and interacts with the smart contract to create the calling function. If the contract
   * interaction fails, it retries with a delay until successful.
   *
   * @param policyId - The ID of the policy for which the calling contract is being created.
   * @param callingFunction - The calling function string to be parsed and added to the contract.
   * @param name - Name of the Calling Function instance
   * @param encodedValues - the encoded values that will be sent along with the rules invocation.
   * @returns A promise that resolves to object with `functionId` and `transactionHash`, or -1 if unsuccessful.
   *
   * @throws Will retry indefinitely on contract interaction failure, with a delay between attempts.
   */
  createCallingFunction(
    policyId: number,
    callingFunction: string,
    name: string,
    encodedValues: string
  ): Promise<{ functionId: number; transactionHash: `0x${string}` }> {
    return createCallingFunctionInternal(
      config,
      this.rulesEngineComponentContract,
      policyId,
      callingFunction,
      name,
      encodedValues,
      this.confirmationCount
    )
  }

  /**
   * Updates a Calling Function in the rules engine component contract.
   *
   * @param config - The configuration object containing network and wallet information.
   * @param rulesEngineComponentContract - The contract instance containing the address and ABI
   * @param policyId - The ID of the policy for which the calling function is being created.
   * @param callingFunction - The calling function string to be parsed and updated.
   *                          of the rules engine component.
   * @param name - Name of the Calling Function instance
   * @param encodedValues - The encoded values string for the calling function.
   * @returns A promise that resolves to object with `functionId` and `transactionHash`, or -1 if unsuccessful.
   *
   * @throws Will retry indefinitely on contract interaction failure, with a delay between attempts.
   */
  updateCallingFunction(
    policyId: number,
    callingFunction: string,
    name: string,
    encodedValues: string
  ): Promise<{ functionId: number; transactionHash: `0x${string}` }> {
    return updateCallingFunctionInternal(
      config,
      this.rulesEngineComponentContract,
      policyId,
      callingFunction,
      name,
      encodedValues,
      this.confirmationCount
    )
  }

  /**
   * Delete a calling function from the rules engine component contract.
   *
   * @param policyId - The ID of the policy for which the calling function is being deleted.
   * @param callingFunctionId - The calling function ID to be deleted.
   * @returns A promise that resolves to the result of the contract interaction, or -1 if unsuccessful.
   *
   * @throws Will retry indefinitely on contract interaction failure, with a delay between attempts.
   */
  deleteCallingFunction(policyId: number, callingFunctionId: string): Promise<number> {
    return deleteCallingFunctionInternal(
      config,
      this.rulesEngineComponentContract,
      policyId,
      callingFunctionId,
      this.confirmationCount
    )
  }

  /**
   * retrieves the metadata for a xscalling function from the rules engine component contract.
   *
   * @param policyId - The ID of the policy which the calling function belongs to.
   * @param callingFunctionId - The Calling Function ID.
   * @param blockParams - Optional parameters to specify block number or tag for the contract read operation.
   * @returns A promise that resolves to the result of the contract interaction.
   *
   * @throws Will retry indefinitely on contract interaction failure, with a delay between attempts.
   */
  getCallingFunctionMetadata(
    policyId: number,
    callingFunctionId: string,
    blockParams?: ContractBlockParameters
  ): Promise<CallingFunctionHashMapping> {
    return getCallingFunctionMetadataInternal(
      config,
      this.rulesEngineComponentContract,
      policyId,
      callingFunctionId,
      blockParams
    )
  }

  /**
   * retrieves calling functions for a policy from the rules engine component contract.
   *
   * @param policyId - The ID of the policy which the calling function belongs to.
   * @param blockParams - Optional parameters to specify block number or tag for the contract read operation.
   * @returns A promise that resolves to CallingFunctionHashMapping.
   *
   */
  getCallingFunctions(policyId: number, blockParams?: ContractBlockParameters): Promise<CallingFunctionOnChain[]> {
    return getAllCallingFunctionsInternal(config, this.rulesEngineComponentContract, policyId, blockParams)
  }

  /**
   * Propose a new admin in the rules engine admin contract.
   *
   * This function proposes a new admin for a specific policy.
   *
   * @param policyId - The ID of the policy to set the admin for.
   * @param newAdminAddress - The address to propose as the new admin
   * @returns A promise that resolves to the result of the contract interaction, or -1 if unsuccessful.
   *
   * @throws Will retry indefinitely on contract interaction failure, with a delay between attempts.
   */
  proposeNewPolicyAdmin(policyId: number, newAdminAddress: Address) {
    proposeNewPolicyAdminInternal(
      config,
      this.rulesEngineAdminContract,
      policyId,
      newAdminAddress,
      this.confirmationCount
    )
  }

  /**
   * Confirm a new admin in the rules engine admin contract.
   *
   * This function confirms a new admin for a specific policy.
   *
   * @param policyId - The ID of the policy to set the admin for.
   * @returns A promise that resolves to the result of the contract interaction, or -1 if unsuccessful.
   *
   * @throws Will retry indefinitely on contract interaction failure, with a delay between attempts.
   */
  confirmNewPolicyAdmin(policyId: number) {
    confirmNewPolicyAdminInternal(config, this.rulesEngineAdminContract, policyId, this.confirmationCount)
  }

  /**
   * Renounce an admin role in the rules engine admin contract.
   *
   * This function confirms a new admin for a specific policy.
   *
   * @param policyId - The ID of the policy to set the admin for.
   * @returns A promise that resolves to the result of the contract interaction, or -1 if unsuccessful.
   *
   * @throws Will retry indefinitely on contract interaction failure, with a delay between attempts.
   */
  renouncePolicyAdminRole(role: string, renounceAddress: Address, policyId: number) {
    renouncePolicyAdminRoleInternal(
      config,
      this.rulesEngineAdminContract,
      role,
      renounceAddress,
      policyId,
      this.confirmationCount
    )
  }

  /**
   * Determine if address is policy admin.
   *
   * This function determines whether or not an address is the admin for a specific policy.
   *
   * @param policyId - The ID of the policy to check the admin for.
   * @param adminAddress - The address to check
   * @param blockParams - Optional parameters to specify block number or tag for the contract read operation.
   * @returns whether or not the address is the policy admin.
   *
   */
  isPolicyAdmin(policyId: number, adminAddress: Address, blockParams?: ContractBlockParameters): Promise<boolean> {
    return isPolicyAdminInternal(config, this.rulesEngineAdminContract, policyId, adminAddress, blockParams)
  }

  /**
   * Propose a new calling contract admin in the rules engine admin contract.
   *
   * This function proposes a new admin for a specific calling contract.
   *
   * @param callingContractAddress - The address of the calling contract to set the admin for.
   * @param newAdminAddress - The address to propose as the new admin
   * @returns A promise that resolves to the result of the contract interaction, or -1 if unsuccessful.
   *
   * @throws Will retry indefinitely on contract interaction failure, with a delay between attempts.
   */
  proposeCallingContractAdmin(callingContractAddress: Address, newAdminAddress: Address) {
    proposeCallingContractAdminInternal(
      config,
      this.rulesEngineAdminContract,
      callingContractAddress,
      newAdminAddress,
      this.confirmationCount
    )
  }

  /**
   * Confirm a new calling contract admin in the rules engine admin contract.
   *
   * This function confirms a new admin for a specific calling contract.
   *
   * @param callingContractAddress - The address of the calling contract to set the admin for.
   * @returns A promise that resolves to the result of the contract interaction, or -1 if unsuccessful.
   *
   * @throws Will retry indefinitely on contract interaction failure, with a delay between attempts.
   */
  confirmNewCallingContractAdmin(callingContractAddress: Address) {
    confirmNewCallingContractAdminInternal(
      config,
      this.rulesEngineAdminContract,
      callingContractAddress,
      this.confirmationCount
    )
  }

  /**
   * Renounce a calling contract admin in the rules engine admin contract.
   *
   * This function renounces the admin role for a specific calling contract.
   *
   * @param callingContractAddress - The address of the calling contract to renounce the admin for.
   * @param renounceAddress - The address of the calling contract to renounce the admin for.
   * @returns A promise that resolves to the result of the contract interaction, or -1 if unsuccessful.
   *
   * @throws Will retry indefinitely on contract interaction failure, with a delay between attempts.
   */
  renounceCallingContractAdminRoleInternal(renounceAddress: Address, callingContractAddress: Address) {
    return renounceCallingContractAdminRoleInternal(
      config,
      this.rulesEngineAdminContract,
      callingContractAddress,
      renounceAddress,
      this.confirmationCount
    )
  }

  /**
   * Determine if address is the calling contract admin.
   *
   * This function determines whether or not an address is the admin for a specific calling contract.
   *
   * @param callingContract - The address of the contract to check the admin for.
   * @param account - The address to check
   * @param blockParams - Optional parameters to specify block number or tag for the contract read operation.
   * @returns whether or not the address is the calling contract admin.
   *
   */
  isCallingContractAdmin(
    callingContract: Address,
    account: Address,
    blockParams?: ContractBlockParameters
  ): Promise<boolean> {
    return isCallingContractAdminInternal(config, this.rulesEngineAdminContract, callingContract, account, blockParams)
  }

  /**
   * Propose a new foreign call admin in the rules engine admin contract.
   *
   * This function proposes a new admin for a specific foreign call.
   *
   * @param foreignCallAddress - The address of the foreign call contract to set the admin for.
   * @param newAdminAddress - The address to propose as the new admin
   * @param functionSelector - The selector for the specific foreign call
   * @returns A promise.
   *
   * @throws Will retry indefinitely on contract interaction failure, with a delay between attempts.
   */
  proposeForeignCallAdmin(foreignCallAddress: Address, newAdminAddress: Address, foreignCallSelector: string) {
    proposeNewForeignCallAdminInternal(
      config,
      this.rulesEngineAdminContract,
      foreignCallAddress,
      newAdminAddress,
      foreignCallSelector,
      this.confirmationCount
    )
  }

  /**
   * Confirm a new foreign call admin in the rules engine admin contract.
   *
   * This function confirms a new admin for a specific foreign call.
   *
   * @param foreignCallAddress - The address of the foreign call to set the admin for.
   * @param functionSelector - The selector for the specific foreign call
   * @returns A promise.
   *
   * @throws Will retry indefinitely on contract interaction failure, with a delay between attempts.
   */
  confirmNewForeignCallAdmin(foreignCallAddress: Address, foreignCallSelector: string) {
    confirmNewForeignCallAdminInternal(
      config,
      this.rulesEngineAdminContract,
      foreignCallAddress,
      foreignCallSelector,
      this.confirmationCount
    )
  }

  /**
   * Renounce foreign call admin in the rules engine admin contract.
   *
   * This function confirms a new admin for a specific foreign call.
   *
   * @param foreignCallAddress - The address of the foreign call to set the admin for.
   * @param functionSelector - The selector for the specific foreign call
   * @returns A promise.
   *
   * @throws Will retry indefinitely on contract interaction failure, with a delay between attempts.
   */
  renounceForeignCallAdmin(foreignCallAddress: Address, functionSignature: string, renounceAddress: Address) {
    renounceForeignCallAdminRoleInternal(
      config,
      this.rulesEngineAdminContract,
      foreignCallAddress,
      functionSignature,
      renounceAddress,
      this.confirmationCount
    )
  }

  /**
   * Determine if address is the foreign call admin.
   *
   * This function determines whether or not an address is the admin for a specific foreign call.
   *
   * @param foreignCallAdress - The address of the contract to check the admin for.
   * @param account - The address to check
   * @param functionSelector - The selector for the specific foreign call
   * @param blockParams - Optional parameters to specify block number or tag for the contract read operation.
   * @returns whether or not the address is the foreign call admin.
   *
   */
  isForeignCallAdmin(
    foreignCallAddress: Address,
    account: Address,
    foreignCallSelector: string,
    blockParams?: ContractBlockParameters
  ): Promise<boolean> {
    return isForeignCallAdminInternal(
      config,
      this.rulesEngineAdminContract,
      foreignCallAddress,
      account,
      foreignCallSelector,
      blockParams
    )
  }

  /**
   * Cements a policy on the Rules Engine.
   *
   * @param policyId - The ID of the policy to cement.
   * @returns Object with `result` (0 if successful, -1 if error) and `transactionHash`.
   */
  cementPolicy(policyId: number): Promise<{ result: number; transactionHash: `0x${string}` }> {
    return cementPolicyInternal(config, this.rulesEnginePolicyContract, policyId, this.confirmationCount)
  }

  /**
   * Retrieves whether a policy is cemented.
   * @param policyId - The ID of the policy to check.
   * @param blockParams - Optional parameters to specify block number or tag for the contract read operation.
   * @returns True if the policy is cemented, false otherwise
   */
  isCementedPolicy(policyId: number, blockParams?: ContractBlockParameters): Promise<boolean> {
    return isCementedPolicyInternal(config, this.rulesEnginePolicyContract, policyId, blockParams)
  }
}
