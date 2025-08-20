/// SPDX-License-Identifier: BUSL-1.1
import { Address, BlockNumber, BlockTag, ByteArray, GetContractReturnType, Hex } from "viem";

import RulesEnginePolicyLogicArtifact from "@fortefoundation/forte-rules-engine/out/RulesEnginePolicyFacet.sol/RulesEnginePolicyFacet.json";
import RulesEngineComponentLogicArtifact from "@fortefoundation/forte-rules-engine/out/RulesEngineComponentFacet.sol/RulesEngineComponentFacet.json";
import RulesEngineRuleLogicArtifact from "@fortefoundation/forte-rules-engine/out/RulesEngineRuleFacet.sol/RulesEngineRuleFacet.json";
import RulesEngineAdminLogicArtifact from "@fortefoundation/forte-rules-engine/out/RulesEngineAdminRolesFacet.sol/RulesEngineAdminRolesFacet.json";
import RulesEngineForeignCallLogicArtifact from "@fortefoundation/forte-rules-engine/out/RulesEngineForeignCallFacet.sol/RulesEngineForeignCallFacet.json";
import { PolicyJSON } from "./validation";

/**
 * @file types.ts
 * @description This module provides the comprehensive set types that are used throughout the SDK
 *
 * @module types
 *
 * @dependencies
 * - `viem`: Provides utilities for encoding/decoding data and interacting with Ethereum contracts.
 *
 *
 * @author @mpetersoCode55, @ShaneDuncan602, @TJ-Everett, @VoR0220
 *
 * @license BUSL-1.1
 *
 * @note This file is a critical component of the Rules Engine SDK, enabling seamless integration with the Rules Engine smart contracts.
 */

// -----------------------------------------------------------------------------
// Contract ABIs
// -----------------------------------------------------------------------------

export const RulesEnginePolicyABI = RulesEnginePolicyLogicArtifact.abi;
export const RulesEngineComponentABI = RulesEngineComponentLogicArtifact.abi;
export const RulesEngineRulesABI = RulesEngineRuleLogicArtifact.abi;
export const RulesEngineAdminABI = RulesEngineAdminLogicArtifact.abi;
export const RulesEngineForeignCallABI = RulesEngineForeignCallLogicArtifact.abi;

// -----------------------------------------------------------------------------
// Contract Types
// -----------------------------------------------------------------------------

/**
 * Contract type definitions for interacting with the Rules Engine facets
 */
export type RulesEnginePolicyContract = GetContractReturnType<
  typeof RulesEnginePolicyABI
>;

export type RulesEngineComponentContract = GetContractReturnType<
  typeof RulesEngineComponentABI
>;

export type RulesEngineRulesContract = GetContractReturnType<
  typeof RulesEngineRulesABI
>;

export type RulesEngineAdminContract = GetContractReturnType<
  typeof RulesEngineAdminABI
>;

export type RulesEngineForeignCallContract = GetContractReturnType<
  typeof RulesEngineForeignCallABI
>;

// -----------------------------------------------------------------------------
// Utility Types
// -----------------------------------------------------------------------------

/**
 * Maps foreign call names to their IDs
 */
export type FCNameToID = {
  /** Unique identifier for the foreign call */
  id: number;
  /** Name of the foreign call */
  name: string;
  /** Type identifier */
  type: number;
};


/**
 * Maps hex values to their function string representations
 */
export type hexToFunctionString = {
  /** Hex representation */
  hex: string;
  /** String representation of the function */
  functionString: string;
  /** Encoded values for the function */
  encodedValues: string;
  /** Index of the function */
  index: number;
};

/**
 * Maps calling functions to their signatures and encoded values
 */
export type CallingFunctionHashMapping = {
  /** The calling function identifier */
  callingFunction: string;
  /** Function signature */
  signature: string;
  /** Encoded values for the function */
  encodedValues: string;
};

/**
 * Simple tuple type with integer and string fields
 */
export type Tuple = {
  /** Integer field */
  i: string;
  /** String field */
  s: string;
};

// -----------------------------------------------------------------------------
// Effect Types
// -----------------------------------------------------------------------------

/**
 * Enum representing the different types of effects
 */
export enum EffectType {
  /** Effect that causes a revert */
  REVERT = 0,
  /** Effect that emits an event */
  EVENT = 1,
  /** Effect that represents an expression */
  EXPRESSION = 2,
}

/**
 * Definition of an effect with its properties
 */
export type EffectDefinition = {
  /** The type of effect (REVERT, EVENT, EXPRESSION) */
  type: EffectType;
  /** Text representation of the effect */
  text: string;
  /** Instruction set for the effect */
  instructionSet: any[];
  /** Parameter type */
  pType: number;
  /** Parameter value */
  parameterValue: any;
};

/**
 * Structure of an effect as represented in the system
 */
export type EffectStruct = {
  /** Whether the effect is valid */
  valid: boolean;
  /** Whether the effect has dynamic parameters */
  dynamicParam: boolean;
  /** The type of effect */
  effectType: EffectType;
  /** Parameter type */
  pType: number;
  /** Parameter value */
  param: any;
  /** Text representation in hex format */
  text: Hex;
  /** Error message if applicable */
  errorMessage: string;
  /** Instruction set for the effect */
  instructionSet: any[];
};

/**
 * Collection of positive and negative effects
 * TODO: Add more specific types for positiveEffects and negativeEffects
 */
export type EffectStructs = {
  /** Effects applied when a rule passes */
  positiveEffects: any[];
  /** Effects applied when a rule fails */
  negativeEffects: any[];
};

// -----------------------------------------------------------------------------
// Rule Types
// -----------------------------------------------------------------------------

/**
 * Base structure for rule types
 */
export type RuleBase = {
  /** Set of instructions that make up the rule */
  instructionSet: any[];
  /** Placeholders used in the rule */
  placeHolders: any[];
  /** Placeholders used in the rule's effects */
  effectPlaceHolders: any[];
};

/**
 * Complete definition of a rule including effects
 */
export type RuleDefinition = RuleBase & EffectStructs;

/**
 * Structure of a rule as stored in the system
 */
export type RuleStruct = RuleBase & {
  /** Positive effects applied when rule passes */
  posEffects: any[];
  /** Negative effects applied when rule fails */
  negEffects: any[];
};

/**
 * Metadata about a rule
 */
export type RuleMetadataStruct = {
  /** Name of the rule */
  ruleName: string;
  /** Description of the rule */
  ruleDescription: string;
};

/**
 * Represents the storage state of a rule
 */
export type RuleStorageSet = {
  /** Whether the rule is set */
  set: boolean;
  /** The rule data */
  rule: any;
};

// -----------------------------------------------------------------------------
// Policy Types
// -----------------------------------------------------------------------------

/**
 * Result type for the getPolicy function
 * Contains both the parsed policy object and its JSON string representation
 */
export type PolicyResult = {
  /** The parsed policy object */
  Policy: PolicyJSON;
  /** The JSON string representation of the policy */
  JSON: string;
};

/**
 * Metadata about a policy
 */
export type PolicyMetadataStruct = {
  /** Name of the policy */
  policyName: string;
  /** Description of the policy */
  policyDescription: string;
};

// -----------------------------------------------------------------------------
// Foreign Call Types
// -----------------------------------------------------------------------------

/**
 * Structure representing a foreign call as stored on-chain
 */
export type ForeignCallOnChain = {
  /** Whether the foreign call is set */
  set: boolean;
  /** Address of the contract for the foreign call */
  foreignCallAddress: string;
  /** Function signature */
  signature: string;
  /** Return type of the foreign call */
  returnType: number;
  /** Index of the foreign call */
  foreignCallIndex: number;
  /** Types of parameters */
  parameterTypes: number[];
  /** Indices for encoded parameters */
  encodedIndices: ForeignCallEncodedIndex[];
  /** Indices for mapped tracker keys */
  mappedTrackerKeyIndices: ForeignCallEncodedIndex[];
  /** Index of the calling function */
  callingFunctionIndex: number;
};

/**
 * Definition of a foreign call
 */
export type ForeignCallDefinition = {
  /** Name of the foreign call */
  name: string;
  /** Contract address */
  address: Address;
  /** Function name */
  function: string;
  /** Return type of the function */
  returnType: number;
  /** Types of parameters */
  parameterTypes: number[];
  /** Indices for encoded parameters */
  encodedIndices: ForeignCallEncodedIndex[];
  /** Indices for mapped tracker keys */
  mappedTrackerKeyIndices: ForeignCallEncodedIndex[];
};

/**
 * Index information for foreign call encoding
 */
export type ForeignCallEncodedIndex = {
  /** Type of encoding */
  eType: number;
  /** Index value */
  index: number;
};

/**
 * Mapping for individual function arguments
 */
export type IndividualArgumentMapping = {
  /** Type of the function call argument */
  functionCallArgumentType: number;
  /** Argument from the calling function */
  callingFunctionArg: PlaceholderStruct;
};

/**
 * Mappings for foreign call arguments
 */
export type ForeignCallArgumentMappings = {
  /** Index of the foreign call */
  foreignCallIndex: number;
  /** List of argument mappings */
  mappings: IndividualArgumentMapping[];
};

/**
 * Foreign call representation in rule components
 */
export type ForeignCall = {
  /** Name of the foreign call */
  name: string;
  /** Type index */
  tIndex: number;
  /** Raw type identifier */
  rawType: "foreign call";
  /** Placeholder for the foreign call */
  fcPlaceholder: string;
};

// -----------------------------------------------------------------------------
// Tracker Types
// -----------------------------------------------------------------------------

/**
 * Structure representing a tracker as stored on-chain
 */
export type TrackerOnChain = {
  /** Whether the tracker is set */
  set: boolean;
  /** Parameter type */
  pType: number;
  /** Whether the tracker is mapped */
  mapped: boolean;
  /** Type of the tracker key */
  trackerKeyType: number;
  /** Value of the tracker */
  trackerValue: string;
  /** Index of the tracker */
  trackerIndex: number;
};

/**
 * Metadata for a tracker
 */
export type TrackerMetadataStruct = {
  /** Name of the tracker */
  trackerName: string;
  /** Initial value */
  initialValue: string;
  /** Initial keys for mapped trackers */
  initialKeys: string[];
  /** Initial values for mapped trackers */
  initialValues: string[];
};

/**
 * Maps tracker indices to names
 */
export type trackerIndexNameMapping = {
  /** ID of the tracker */
  id: number;
  /** Name of the tracker */
  name: string;
  /** Type of the tracker */
  type: number;
};

/**
 * Definition of a tracker
 */
export type TrackerDefinition = {
  /** Name of the tracker */
  name: string;
  /** Type of the tracker */
  type: number;
  /** Initial value of the tracker */
  initialValue: any;
};

/**
 * Definition of a mapped tracker
 */
export type MappedTrackerDefinition = {
  /** Name of the tracker */
  name: string;
  /** Type of the key */
  keyType: number;
  /** Type of the value */
  valueType: number;
  /** Initial keys */
  initialKeys: any[];
  /** Initial values */
  initialValues: any[];
};

/**
 * Tracker representation in rule components
 */
export type Tracker = {
  /** Name of the tracker */
  name: string;
  /** Type index */
  tIndex: number;
  /** Raw type identifier */
  rawType: "tracker";
  /** Secondary raw type information */
  rawTypeTwo?: string;
};

// -----------------------------------------------------------------------------
// Placeholder and Component Types
// -----------------------------------------------------------------------------

/**
 * Structure for placeholders in rules
 */
export type PlaceholderStruct = {
  /** Parameter type */
  pType: number;
  /** Type-specific index */
  typeSpecificIndex: number;
  /** Key for mapped tracker */
  mappedTrackerKey: any;
  /** Flags for the placeholder */
  flags: number;
};

/**
 * Function argument representation in rule components
 */
export type FunctionArgument = {
  /** Name of the argument */
  name: string;
  /** Type index */
  tIndex: number;
  /** Raw type identifier */
  rawType: string;
};

/**
 * Union type for components in rules
 */
export type RuleComponent = FunctionArgument | ForeignCall | Tracker;

/**
 * Represents a string replacement in an instruction set
 */
export type stringReplacement = {
  /** Index in the instruction set */
  instructionSetIndex: number;
  /** Original data to replace */
  originalData: string;
};

// -----------------------------------------------------------------------------
// Instruction Set Types
// -----------------------------------------------------------------------------

/**
 * Type definition for an instruction set
 */
export type InstructionSet = (number | string | BigInt)[];

/**
 * Raw data for an instruction set
 */
export type RawData = {
  /** Indices in the instruction set */
  instructionSetIndex: number[];
  /** Types of arguments */
  argumentTypes: number[];
  /** Values of the data */
  dataValues: ByteArray[];
};

/**
 * Accumulator for Abstract Syntax Tree construction
 */
export type ASTAccumulator = {
  /** Instruction set being accumulated */
  instructionSet: any[];
  /** Memory for the accumulation process */
  mem: any[];
  /** Iterator for tracking position */
  iterator: { value: number };
};

// -----------------------------------------------------------------------------
// Constants and Enums
// -----------------------------------------------------------------------------

/**
 * Supported operators in rule expressions
 */
export const matchArray: string[] = [
  "OR",
  "AND",
  "NOT",
  "==",
  ">=",
  ">",
  "<",
  "<=",
  "+",
  "-",
  "/",
  "*",
  "+=",
  "-=",
  "*=",
  "/=",
  "=",
  "!=",
];

/**
 * Assignment operators
 */
export const truMatchArray: string[] = ["+=", "-=", "*=", "/=", "="];

/**
 * Operand type identifiers
 */
export const operandArray: string[] = ["PLH", "N", "PLHM", "TRU", "TRUM"];

/**
 * Parameter type enumeration
 */
export enum pTypeEnum {
  ADDRESS = 0,
  STRING = 1,
  UINT256 = 2,
  BOOL = 3,
  VOID = 4,
  BYTES = 5,
  STATIC_TYPE_ARRAY = 6,
  DYNAMIC_TYPE_ARRAY = 7,
}

/**
 * Maps solidity types to their parameter type enums
 */
export const PT = [
  { name: "address", enumeration: pTypeEnum.ADDRESS },
  { name: "string", enumeration: pTypeEnum.STRING },
  { name: "uint256", enumeration: pTypeEnum.UINT256 },
  { name: "bool", enumeration: pTypeEnum.BOOL },
  { name: "void", enumeration: pTypeEnum.VOID },
  { name: "bytes", enumeration: pTypeEnum.BYTES },
  { name: "address[]", enumeration: pTypeEnum.STATIC_TYPE_ARRAY },
  { name: "uint256[]", enumeration: pTypeEnum.STATIC_TYPE_ARRAY },
  { name: "bool[]", enumeration: pTypeEnum.STATIC_TYPE_ARRAY },
  { name: "string[]", enumeration: pTypeEnum.DYNAMIC_TYPE_ARRAY },
  { name: "bytes[]", enumeration: pTypeEnum.DYNAMIC_TYPE_ARRAY },
];

// -----------------------------------------------------------------------------
// Error Types
// -----------------------------------------------------------------------------

/**
 * Types of errors that can occur in the rules engine
 */
export type ErrorType =
  | "INPUT"
  | "CONTRACT_READ"
  | "CONTRACT_WRITE"
  | "COMPILATION";

/**
 * Structure representing an error in the rules engine
 */
export type RulesError = {
  /** Type of error */
  errorType: ErrorType;
  /** State at the time of error */
  state: any;
  /** Error message */
  message: string;
};

// -----------------------------------------------------------------------------
// Utility Types
// -----------------------------------------------------------------------------

/**
 * Either monad implementation for functional error handling
 */
export type Left<T> = {
  /** Left value */
  left: T;
  /** Right value placeholder */
  right?: never;
};

export type Right<U> = {
  /** Right value */
  right: U;
  /** Left value placeholder */
  left?: never;
};

export type Either<T, U> = NonNullable<Left<T> | Right<U>>;

export type UnwrapEither = <T, U>(e: Either<T, U>) => NonNullable<T | U>;

/**
 * Maybe type for nullable values
 */
export type Maybe<T> = NonNullable<T> | null;

/**
 * Block parameters that can be used in wagmi's readContract function
 * to specify a specific block number or tag to interact with the contract at
 */
export type ContractBlockParameters = {
  /**
   * Block number to execute the contract interaction at
   * This is useful for historical queries or when you want to execute against a specific block
   */
  blockNumber?: BlockNumber;

  /**
   * Block tag to execute the contract interaction at
   * Common values include 'latest', 'earliest', 'pending', 'safe', 'finalized'
   */
  blockTag?: BlockTag;
};
