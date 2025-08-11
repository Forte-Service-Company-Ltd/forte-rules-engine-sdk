/// SPDX-License-Identifier: BUSL-1.1
import { Abi, Address, ByteArray, GetContractReturnType, Hex } from "viem";

import RulesEnginePolicyLogicArtifact from "@thrackle-io/forte-rules-engine/out/RulesEnginePolicyFacet.sol/RulesEnginePolicyFacet.json";
import RulesEngineComponentLogicArtifact from "@thrackle-io/forte-rules-engine/out/RulesEngineComponentFacet.sol/RulesEngineComponentFacet.json";
import RulesEngineRuleLogicArtifact from "@thrackle-io/forte-rules-engine/out/RulesEngineRuleFacet.sol/RulesEngineRuleFacet.json";
import RulesEngineAdminLogicArtifact from "@thrackle-io/forte-rules-engine/out/RulesEngineAdminRolesFacet.sol/RulesEngineAdminRolesFacet.json";
import RulesEngineForeignCallLogicArtifact from "@thrackle-io/forte-rules-engine/out/RulesEngineForeignCallFacet.sol/RulesEngineForeignCallFacet.json";

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

export const RulesEnginePolicyABI = RulesEnginePolicyLogicArtifact.abi;
export const RulesEngineComponentABI = RulesEngineComponentLogicArtifact.abi;
export const RulesEngineRulesABI = RulesEngineRuleLogicArtifact.abi;
export const RulesEngineAdminABI = RulesEngineAdminLogicArtifact.abi;
export const RulesEngineForeignCallABI =
  RulesEngineForeignCallLogicArtifact.abi;

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

export type FCNameToID = {
  id: number;
  name: string;
  type: number;
};

export type RuleStorageSet = {
  set: boolean;
  rule: any;
};

export type hexToFunctionString = {
  hex: string;
  functionString: string;
  encodedValues: string;
  index: number;
};

export type CallingFunctionHashMapping = {
  callingFunction: string;
  signature: string;
  encodedValues: string;
};

export type Tuple = {
  i: string;
  s: string;
};

export enum EffectType {
  REVERT = 0,
  EVENT = 1,
  EXPRESSION = 2,
}

export type EffectDefinition = {
  type: EffectType;
  text: string;
  instructionSet: any[];
  pType: number;
  parameterValue: any;
};

export type EffectStruct = {
  valid: boolean;
  dynamicParam: boolean;
  effectType: EffectType;
  pType: number;
  param: any;
  text: Hex;
  errorMessage: string;
  instructionSet: any[];
};

// TODO: Add more specific types for positiveEffects and negativeEffects
export type EffectStructs = {
  positiveEffects: any[];
  negativeEffects: any[];
};

export type RuleBase = {
  instructionSet: any[];
  placeHolders: any[];
  effectPlaceHolders: any[];
};

export type RuleDefinition = RuleBase & EffectStructs;

export type RuleStruct = RuleBase & {
  posEffects: any[];
  negEffects: any[];
};

export type RuleMetadataStruct = {
  ruleName: string;
  ruleDescription: string;
};

export type PolicyMetadataStruct = {
  policyName: string;
  policyDescription: string;
};

export type ForeignCallOnChain = {
  set: boolean;
  foreignCallAddress: string;
  signature: string;
  returnType: number;
  foreignCallIndex: number;
  parameterTypes: number[];
  encodedIndices: ForeignCallEncodedIndex[];
  mappedTrackerKeyIndices: ForeignCallEncodedIndex[];
};

export type TrackerOnChain = {
  set: boolean;
  pType: number;
  mapped: boolean;
  trackerKeyType: number;
  trackerValue: string;
  trackerIndex: number;
};

export type ForeignCallDefinition = {
  name: string;
  address: Address;
  function: string;
  returnType: number;
  parameterTypes: number[];
  encodedIndices: ForeignCallEncodedIndex[];
  mappedTrackerKeyIndices: ForeignCallEncodedIndex[];
};

export type ForeignCallEncodedIndex = {
  eType: number;
  index: number;
};

export type PlaceholderStruct = {
  pType: number;
  typeSpecificIndex: number;
  mappedTrackerKey: any;
  flags: number;
};

export type IndividualArgumentMapping = {
  functionCallArgumentType: number;
  callingFunctionArg: PlaceholderStruct;
};

export type ForeignCallArgumentMappings = {
  foreignCallIndex: number;
  mappings: IndividualArgumentMapping[];
};

export type FunctionArgument = {
  name: string;
  tIndex: number;
  rawType: string;
};

export type ForeignCall = {
  name: string;
  tIndex: number;
  rawType: "foreign call";
  fcPlaceholder: string;
};

export type Tracker = {
  name: string;
  tIndex: number;
  rawType: "tracker";
  rawTypeTwo?: string;
};

export type RuleComponent = FunctionArgument | ForeignCall | Tracker;

export type stringReplacement = {
  instructionSetIndex: number;
  originalData: string;
};

export type trackerIndexNameMapping = {
  id: number;
  name: string;
  type: number;
};

export type TrackerDefinition = {
  name: string;
  type: number;
  initialValue: any;
};

export type MappedTrackerDefinition = {
  name: string;
  keyType: number;
  valueType: number;
  initialKeys: any[];
  initialValues: any[];
};

export type InstructionSet = (number | string | BigInt)[];

export type RawData = {
  instructionSetIndex: number[];
  argumentTypes: number[];
  dataValues: ByteArray[];
};

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
export const truMatchArray: string[] = ["+=", "-=", "*=", "/=", "="];
export const operandArray: string[] = ["PLH", "N", "PLHM", "TRU", "TRUM"];

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

export type ErrorType =
  | "INPUT"
  | "CONTRACT_READ"
  | "CONTRACT_WRITE"
  | "COMPILATION";

export type RulesError = {
  errorType: ErrorType;
  state: any;
  message: string;
};

export type Left<T> = {
  left: T;
  right?: never;
};

export type Right<U> = {
  right: U;
  left?: never;
};

export type Either<T, U> = NonNullable<Left<T> | Right<U>>;

export type UnwrapEither = <T, U>(e: Either<T, U>) => NonNullable<T | U>;

export type Maybe<T> = NonNullable<T> | null;

export type ASTAccumulator = {
  instructionSet: any[];
  mem: any[];
  iterator: { value: number };
};

export const confirmationCount = 3;
