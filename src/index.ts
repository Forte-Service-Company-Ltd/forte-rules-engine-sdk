/// SPDX-License-Identifier: BUSL-1.1

export { RulesEngine } from './modules/rules-engine.js'

export { getConfig, connectConfig, setupConfig } from './config.js'

export { generateModifier } from './codeGeneration/generate-solidity.js'

export { injectModifier } from './codeGeneration/inject-modifier.js'

export { policyModifierGeneration } from './codeGeneration/code-modification-script.js'

export { getTrackerToRuleIds } from './modules/trackers.js'

export { 
  createCallingFunctionLookupMaps,
  resolveCallingFunction,
} from './modules/calling-function-types.js'

export { 
  createPolicy,
  updatePolicy,
  setPolicies,
  appendPolicy,
  deletePolicy,
  getRulesEngineVersion,
  getVersionCompatible,
  getPolicy,
  getPolicyMetadata,
  policyExists,
  getAppliedPolicyIds,
  isClosedPolicy,
  closePolicy,
  openPolicy,
  isClosedPolicySubscriber,
  addClosedPolicySubscriber,
  removeClosedPolicySubscriber,
  cementPolicy,
  isCementedPolicy
} from './modules/policy.js'

export {
  RulesEnginePolicyContract,
  RulesEngineComponentContract,
  FCNameToID,
  RuleStorageSet,
  hexToFunctionString,
  EffectType,
  RuleStruct,
  ForeignCallDefinition,
  PlaceholderStruct,
  IndividualArgumentMapping as IndividualArugmentMapping,
  ForeignCallArgumentMappings,
  FunctionArgument,
  stringReplacement,
  trackerIndexNameMapping,
  TrackerDefinition,
  RawData,
  RuleData,
  RuleDataAndJSON,
  ForeignCallData,
  ForeignCallDataAndJSON,
  TrackerData,
  TrackerDataAndJSON,
  MappedTrackerData,
  MappedTrackerDataAndJSON,
  CallingFunctionData,
  CallingFunctionDataAndJSON,
  PolicyData,
  matchArray,
  truMatchArray,
  operandArray,
  pTypeEnum,
  trackerArrayType,
  PT,
  Left,
  Right,
  Either,
  PolicyResult,
  ContractBlockParameters,
} from './modules/types.js'

export {
  safeParseJson,
  getRulesErrorMessages,
  validateRuleJSON,
  validateForeignCallJSON,
  validateTrackerJSON,
  validateMappedTrackerJSON,
  validateCallingFunctionJSON,
  validatePolicyJSON,
  ruleValidator,
  foreignCallValidator,
  trackerValidator,
  mappedTrackerValidator,
  callingFunctionValidator,
  policyJSONValidator,
  splitFunctionInput,
  validateFCFunctionInput,
} from './modules/validation.js'

export type {
  RuleJSON,
  ForeignCallJSON,
  TrackerJSON,
  MappedTrackerJSON,
  CallingFunctionJSON,
  PolicyJSON,
} from './modules/validation.js'

export type {
  CallingFunctionJSON as CallingFunctionJSONShared
} from './modules/calling-function-types.js'

export { isLeft, isRight, unwrapEither } from './modules/utils.js'
