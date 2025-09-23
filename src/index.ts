/// SPDX-License-Identifier: BUSL-1.1

export { RulesEngine } from './modules/rules-engine.js'

export { getConfig, connectConfig, setupConfig } from './config.js'

export { generateModifier } from './codeGeneration/generate-solidity.js'

export { injectModifier } from './codeGeneration/inject-modifier.js'

export { policyModifierGeneration } from './codeGeneration/code-modification-script.js'

export { createCallingFunctionLookupMaps, resolveCallingFunction } from './modules/validation.js'

export {
  proposeNewPolicyAdmin,
  confirmNewPolicyAdmin,
  renouncePolicyAdminRole,
  renounceCallingContractAdminRole,
  renounceForeignCallAdminRole,
  isPolicyAdmin,
  proposeNewCallingContractAdmin,
  confirmNewCallingContractAdmin,
  isCallingContractAdmin,
  isForeignCallAdmin,
  proposeNewForeignCallAdmin,
  confirmNewForeignCallAdmin,
} from './modules/admin.js'

export {
  createPolicy,
  updatePolicy,
  setPolicies,
  unsetPolicies,
  appendPolicy,
  deletePolicy,
  disablePolicy,
  getRulesEngineVersion,
  getVersionCompatible,
  getPolicy,
  getPolicyMetadata,
  policyExists,
  getAppliedPolicyIds,
  isClosedPolicy,
  isDisabledPolicy,
  closePolicy,
  openPolicy,
  isClosedPolicySubscriber,
  addClosedPolicySubscriber,
  removeClosedPolicySubscriber,
  cementPolicy,
  isCementedPolicy,
} from './modules/policy.js'

export { createRule, updateRule, deleteRule, getRule, getRuleMetadata, getAllRules } from './modules/rules.js'

export {
  createTracker,
  updateTracker,
  createMappedTracker,
  updateMappedTracker,
  deleteTracker,
  getTracker,
  getTrackerMetadata,
  getAllTrackers,
  getTrackerToRuleIds,
  getMappedTrackerValue,
} from './modules/trackers.js'

export {
  createForeignCall,
  updateForeignCall,
  deleteForeignCall,
  getForeignCall,
  getForeignCallMetadata,
  getAllForeignCalls,
  getForeignCallPermissionList,
  addAdminToPermissionList,
  addMultipleAdminsToPermissionList,
  removeMultipleAdminsFromPermissionList,
  removeAllFromPermissionList,
  removeFromPermissionList,
  removeForeignCallPermissions,
} from './modules/foreign-calls.js'

export {
  RulesEnginePolicyContract,
  RulesEngineComponentContract,
  NameToID,
  RuleStorageSet,
  hexToFunctionString,
  EffectType,
  RuleOnChain,
  ForeignCallDefinition,
  PlaceholderStruct,
  FunctionArgument,
  stringReplacement,
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

export { isLeft, isRight, unwrapEither } from './modules/utils.js'
