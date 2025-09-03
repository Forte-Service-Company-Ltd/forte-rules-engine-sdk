import { z } from 'zod/v4'
import { Either, PT, RulesError } from './types'
import { isLeft, makeLeft, makeRight, unwrapEither } from './utils'
import { Address, checksumAddress, isAddress } from 'viem'

/**
 * Accepts any input, if input is a string, it trims whitespace from both ends.
 * if input is not a string the input is returned as is.
 *
 * @param input - value to be trimmed if it is a string.
 * @returns The trimmed input or the original input if not a string.
 */
const trimPossibleString = (input: any): any => {
  if (typeof input === 'string') {
    return input.trim()
  } else {
    return input
  }
}

/**
 * Parses a JSON string and returns Either a successful result or an error.
 *
 * @param input - string to be parsed.
 * @returns Either the parsed string or an error.
 */
export const safeParseJson = (input: string): Either<RulesError[], object> => {
  try {
    const result = JSON.parse(input)
    return makeRight(result)
  } catch (error) {
    return makeLeft([
      {
        errorType: 'INPUT',
        state: { input },
        message: 'Failed to parse JSON',
      },
    ])
  }
}

export const PType = PT.map((p) => p.name) // ["address", "string", "uint256", "bool", "void", "bytes"]

export const splitFunctionInput = (input: string): string[] => {
  return input?.split('(')[1]?.split(')')[0]?.split(',') || []
}

/**
 * Accepts an array of RulesError objects and returns a formatted message string
 *
 * @param errors - RulesErrors array to be processed.
 * @returns The errors messages concatenated into a single string
 */
export const getRulesErrorMessages = (errors: RulesError[]): string => {
  return errors.map((err) => `${err.message}`).join('\n')
}

const validateLogicalOperatorGroup = (operator: string, condition: string[]): boolean =>
  condition.join(' ').split(operator).length == 2

/**
 * Accepts an array of RulesError objects and returns a formatted message string
 *
 * @param condition - A condition group represented as an array of strings.
 * @returns boolean, true if the groups 3 terms and 1 is AND or OR, false otherwise.
 */
export const validateConditionGroup = (condition: string[]): boolean => {
  const andOperator = 'AND'
  const orOperator = 'OR'

  const andTerms = validateLogicalOperatorGroup(andOperator, condition)
  const orTerms = validateLogicalOperatorGroup(orOperator, condition)

  return (andTerms || orTerms) && !(andTerms && orTerms)
}

export const handleCloseParenthesis = (acc: ConditionGroups, term: string, coreGroup: boolean) => {
  if (acc.groups.length === 0) {
    acc.groups.push(['PAREN_GROUP']) // If no groups left, push a placeholder group
  } else if (coreGroup) {
    acc.finalGroups.push(acc.groups.pop() as string[])
    acc.groups[acc.groups.length - 1].push('PAREN_GROUP')
    acc.finalGroups.push(acc.groups.pop() as string[])
  } else {
    acc.groups[acc.groups.length - 1].push('PAREN_GROUP')
    acc.finalGroups.push(acc.groups.pop() as string[])
  }
}

type ConditionGroups = {
  groups: string[][]
  finalGroups: string[][]
  invalid: boolean
}

const replaceMappedTrackers = (condition: string): string => {
  return condition.replace(/TR:[a-zA-Z]+\([^()]+\)/g, 'MAPPED_TRACKER')
}

const addParensPadding = (condition: string): string => {
  return condition
    .replace(/([()])/g, ' $1 ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Parses a a rule condition and returns groups formatted based on parenthesis.
 *
 * @param condition - string representing the rule condition.
 * @returns ConditionGroups the formatted groups and whether the condition is valid syntax.
 */
export const formatParenConditionGroups = (condition: string): ConditionGroups => {
  const formattedCondition = addParensPadding(replaceMappedTrackers(condition))
  return formattedCondition.split(' ').reduce(
    (acc: ConditionGroups, term, index, terms) => {
      if (acc.invalid) return acc // If already invalid, skip further processing

      const currentGroup = acc.groups[acc.groups.length - 1]

      if (term === ')') {
        handleCloseParenthesis(acc, term, term !== terms[index - 1])
      } else if (term === '(') {
        acc.groups.push([]) // Start a new group

        // if it is the first term, create a new group
        // if the first term is an open parenthesis it is handled above
      } else if (index === 0) {
        acc.groups.push([term])

        // if is the the last term push it to the current group
        // then finalize the current group
        // if it is a close paren it is handled above
      } else if (index === terms.length - 1) {
        currentGroup.push(term)
        acc.finalGroups.push(acc.groups.pop() as string[]) // Push the last group to final groups

        // the remaining case is a regular string term, add it to the current group
      } else {
        // if there is no current group the condition is invalid
        if (currentGroup == undefined) {
          acc.invalid = true // If no current group, mark as invalid
        } else {
          currentGroup.push(term) // Add term to the current group
        }
      }

      return acc
    },
    { groups: [], finalGroups: [], invalid: false }
  )
}

const validateInputReferencedCalls = (
  foreignCallNames: string[],
  trackerNames: string[],
  mappedTrackerNames: string[],
  input: string
): boolean => {
  const fcRegex = /FC:[a-zA-Z]+[^\s]+/g
  const trRegex = /(TR|TRU):[a-zA-Z]+ /g
  const trMappedRegex = /(TR|TRU):[a-zA-Z]+\([^()]+\)/g

  const fcMatches = input.match(fcRegex) || []
  const trMatches = input.match(trRegex) || []
  const trMappedMatches = input.match(trMappedRegex) || []

  const [mappedTrackers, mappedTrackerParams] = trMappedMatches.reduce(
    (acc: [string[], string[]], match) => {
      const [name, params] = match.split('(')
      acc[0].push(name.replace(/^(TR|TRU):/, '').trim())
      acc[1].push(params.replace(')', '').trim())
      return acc
    },
    [[], []]
  )

  const validateForeignCalls = fcMatches.every((match) => foreignCallNames.includes(match.replace('FC:', '').trim()))
  const validateTrackers = trMatches.every((match) => trackerNames.includes(match.replace(/^(TR|TRU):/, '').trim()))
  const validateMappedTrackers = mappedTrackers.every((match) => mappedTrackerNames.includes(match))

  return validateForeignCalls && validateTrackers && validateMappedTrackers
}

const validateValuesToPass = (
  callingFunctionEncodedValues: string[],
  foreignCallNames: string[],
  trackerNames: string[],
  mappedTrackerNames: string[],
  valuesToPass: string
): boolean => {
  return valuesToPass
    .split(',')
    .map((value) => {
      value = value.trim()
      if (value.startsWith('FC:')) {
        return foreignCallNames.includes(value.replace('FC:', '').trim())
      } else if (value.startsWith('TR:') || value.startsWith('TRU:')) {
        value = value.replace(/^(TR|TRU):/, '').trim()
        if (value.includes('(')) {
          value = value.split('(')[0].trim()
          return mappedTrackerNames.includes(value)
        } else {
          return trackerNames.includes(value)
        }
      } else if (callingFunctionEncodedValues.includes(value)) {
        return true // If it is a calling function value, it is valid
      }
      return false
    })
    .every((isValid) => isValid)
}

/**
 * Validates referenced calls, Foreign Calls, Trackers, and Mapped Trackers and Calling Functions args
 *
 * @param condition - string representing the rule condition.
 * @returns boolean, true if all referenced calls are valid, otherwise false.
 */
const validateReferencedCalls = (input: any): boolean => {
  const callingFunctionNames = input.CallingFunctions.map((call: any) => call.name)
  const fcCallingFunctions: string[] = input.ForeignCalls.map((fc: any) => fc.callingFunction)

  if (!fcCallingFunctions.every((fcName) => callingFunctionNames.includes(fcName))) {
    return false
  }

  const callingFunctionEncodedValues = input.CallingFunctions.reduce(
    (acc: Record<string, string[]>, call: CallingFunctionJSON) => {
      const typeValues = call.encodedValues.split(',')
      const values: string[] = typeValues.map((v: string) => v.trim().split(' ')[1].trim())
      acc[call.name] = values
      return acc
    },
    {} as Record<string, string[]>
  )

  const foreignCallNames = input.ForeignCalls.map((call: any) => call.name)
  const trackerNames = input.Trackers.map((tracker: any) => tracker.name)
  const mappedTrackerNames = input.MappedTrackers.map((tracker: any) => tracker.name)

  const testInputs = input.Rules.map((rule: any) => [rule.condition, rule.positiveEffects, rule.negativeEffects]).flat(
    2
  )

  const validatedInputs = testInputs
    .map((input: string) => {
      return validateInputReferencedCalls(foreignCallNames, trackerNames, mappedTrackerNames, input)
    })
    .every((isValid: boolean) => isValid)

  const validatedForeignCallValuesToPass = input.ForeignCalls.map((call: any) => {
    return validateValuesToPass(
      callingFunctionEncodedValues[call.callingFunction],
      foreignCallNames,
      trackerNames,
      mappedTrackerNames,
      call.valuesToPass
    )
  }).every((isValid: boolean) => isValid)
  return validatedInputs && validatedForeignCallValuesToPass // If any input is invalid, return false
}

/**
 * Validates a rule condition.
 *
 * @param condition - string representing the rule condition.
 * @returns boolean, true if the condition has properly formatted paren
 *          groups, otherwise false.
 */
export const validateCondition = (condition: string): boolean => {
  const grouped = formatParenConditionGroups(condition)
  if (grouped.invalid) {
    return false // If the condition is invalid, return false
  }

  // if there are non finalized groups, or no finalized groups it is invalid
  if (grouped.groups.length > 0 || grouped.finalGroups.length === 0) {
    return false
  }

  // if there is a single groups that does not include a logical operator, it is valid
  if (grouped.finalGroups.length === 1 && !['AND', 'OR'].includes(grouped.finalGroups[0].join(' '))) {
    return true // If no groups, condition is valid
  }

  const validatedOperators = grouped.finalGroups.map(validateConditionGroup).every((isValid) => isValid)

  return validatedOperators
}

export const ruleValidator = z.object({
  Name: z.string(),
  Description: z.string(),
  condition: z.string().refine((val) => validateCondition(val), {
    error: 'Invalid logical operators in condition',
  }),
  positiveEffects: z.array(z.string()),
  negativeEffects: z.array(z.string()),
  callingFunction: z.string(),
})
export interface RuleJSON extends z.infer<typeof ruleValidator> {}

/**
 * Parses a JSON string and returns Either a RuleJSON object or an error.
 *
 * @param rule - string to be parsed.
 * @returns Either the parsed RuleJSON object or an error.
 */
export const validateRuleJSON = (rule: string): Either<RulesError[], RuleJSON> => {
  const parsedJson = safeParseJson(rule)

  if (isLeft(parsedJson)) return parsedJson

  const parsed = ruleValidator.safeParse(unwrapEither(parsedJson))

  if (parsed.success) {
    return makeRight(parsed.data)
  } else {
    const errors: RulesError[] = parsed.error.issues.map((err) => ({
      errorType: 'INPUT',
      message: `${err.message}: Field ${err.path.join('.')}`,
      state: { input: rule },
    }))
    return makeLeft(errors)
  }
}

/**
 * Validates foreign call parameters to ensure they are of supported types.
 *
 * @param input - string to be validated.
 * @returns true if input is valid, false if input is invalid.
 */
export const validateFCFunctionInput = (input: string): boolean => {
  // Detect presence of parentheses; if missing, params are undefined => invalid
  const openIdx = input.indexOf('(')
  const closeIdx = input.indexOf(')', openIdx + 1)
  if (openIdx === -1 || closeIdx === -1) return false

  // Extract inner params
  const inner = input.slice(openIdx + 1, closeIdx).trim()
  // Empty string means zero parameters => valid
  if (inner === '') return true

  // Otherwise, validate each declared type against supported PType list
  const parts = inner
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
  return parts.every((parameter) => (PType as string[]).includes(parameter))
}

export const foreignCallValidator = z.object({
  name: z.string(),
  function: z.string().trim().refine(validateFCFunctionInput, { message: 'Unsupported argument type' }),
  address: z
    .string()
    .trim()
    .refine((input) => isAddress(input), {
      message: `Address is invalid`,
    })
    .transform((input) => checksumAddress(input.trim() as Address)),
  returnType: z.preprocess(trimPossibleString, z.literal(PType, 'Unsupported return type')),
  valuesToPass: z.string().trim(),
  mappedTrackerKeyValues: z.string().trim(),
  callingFunction: z.string().trim(),
})

export interface ForeignCallJSON extends z.infer<typeof foreignCallValidator> {}

/**
 * Parses a JSON string and returns Either a ForeignCallJSON object or an error.
 *
 * @param foreignCall - string to be parsed.
 * @returns Either the parsed ForeignCallJSON object or an error.
 */
export const validateForeignCallJSON = (foreignCall: string): Either<RulesError[], ForeignCallJSON> => {
  const parsedJson = safeParseJson(foreignCall)

  if (isLeft(parsedJson)) return parsedJson

  const parsed = foreignCallValidator.safeParse(unwrapEither(parsedJson))

  if (parsed.success) {
    return makeRight(parsed.data)
  } else {
    const errors: RulesError[] = parsed.error.issues.map((err) => ({
      errorType: 'INPUT',
      message: `${err.message}: Field ${err.path.join('.')}`,
      state: { input: foreignCall },
    }))
    return makeLeft(errors)
  }
}

export const foreignCallReverseValidator = foreignCallValidator.extend({
  function: z.string().trim(),
})

export interface ForeignCallJSONReversed extends z.infer<typeof foreignCallValidator> {}

export const paramTypes = PT.map((p) => p.name)
export type ParameterTypes = (typeof paramTypes)[number]
export const supportedTrackerTypes = paramTypes.filter((name) => name !== 'void')

export type SupportedTrackers = (typeof supportedTrackerTypes)[number]

export const supportedTrackerKeyTypes = supportedTrackerTypes.filter((t) => !t.includes('[]'))

export type SupportedTrackerKeys = (typeof supportedTrackerKeyTypes)[number]

/**
 * Validates tracker initial value to ensure it matches the type specified.
 *
 * @param type - type of value to be validated.
 * @param value - value to be validated.
 * @returns true if input is valid, false if input is invalid.
 */
const validateTrackerValue = (type: SupportedTrackers, value: any): boolean => {
  // Validate that the initialValue matches the type
  switch (type) {
    case 'uint256':
      return !isNaN(Number(value))
    case 'string':
      return typeof value === 'string'
    case 'address':
      return isAddress(value)
    case 'bytes':
      return typeof value === 'string' // Assuming bytes are represented as hex strings
    case 'bool':
      return true
    default:
      return false // Unsupported type
  }
}

const validateTrackerInitialValue = (data: any): boolean => {
  if (data.type.includes('[]')) {
    // For arrays, we assume initialValue is an array of values
    if (!Array.isArray(data.initialValue)) {
      return false // Initial value must be an array for array types
    }
    return data.initialValue.every((value: any) => validateTrackerValue(data.type.replace('[]', ''), value))
  } else {
    // For non-array types, we validate the single initialValue
    return validateTrackerValue(data.type, data.initialValue)
  }
}

const validateMappedTrackerInitialInputs = (type: any, inputs: any): boolean => {
  if (!Array.isArray(inputs)) {
    return false // Initial values must be an array for array types
  }
  if (type.includes('[]')) {
    return inputs.every(
      (value: any) => Array.isArray(value) && value.every((v: any) => validateTrackerValue(type.replace('[]', ''), v))
    )
  } else {
    return inputs.every((value: any) => validateTrackerValue(type, value))
  }
}

const validateMappedTrackerInitialValues = (data: any): boolean => {
  return validateMappedTrackerInitialInputs(data.valueType, data.initialValues)
}

const validateMappedTrackerInitialKeys = (data: any): boolean => {
  return validateMappedTrackerInitialInputs(data.keyType, data.initialKeys)
}

const validateMappedTrackerInitialLengths = (data: any): boolean => {
  return data.initialKeys.length === data.initialValues.length
}

const validateMappedTrackerUniqueKeys = (data: any): boolean => {
  const uniqueKeys = new Set(data.initialKeys)
  return uniqueKeys.size === data.initialKeys.length
}

export const trackerValidator = z
  .object({
    name: z.string().trim(),
    type: z.preprocess(trimPossibleString, z.literal(supportedTrackerTypes, 'Unsupported type')),
    initialValue: z.union([z.string().trim(), z.array(z.string().trim())]),
  })
  .refine(validateTrackerInitialValue, {
    message: "Initial Value doesn't match type",
  })

export interface TrackerJSON extends z.infer<typeof trackerValidator> {}

export interface MappedTrackerJSON extends z.infer<typeof mappedTrackerValidator> {}

export const mappedTrackerValidator = z
  .object({
    name: z.string().trim(),
    keyType: z.preprocess(trimPossibleString, z.literal(supportedTrackerKeyTypes, 'Unsupported key type')),
    valueType: z.preprocess(trimPossibleString, z.literal(supportedTrackerTypes, 'Unsupported type')),
    initialKeys: z.array(z.string()),
    initialValues: z.array(z.union([z.string().trim(), z.array(z.string().trim())])),
  })
  .refine(validateMappedTrackerInitialValues, {
    message: 'Mapped Tracker Initial Values do not match type',
  })
  .refine(validateMappedTrackerInitialKeys, {
    message: 'Mapped Tracker Initial Keys do not match type',
  })
  .refine(validateMappedTrackerInitialLengths, {
    message: 'Mapped Tracker Initial Keys and Values must have the same length',
  })
  .refine(validateMappedTrackerUniqueKeys, {
    message: 'Mapped Tracker Initial Keys must be unique',
  })

/**
 * Parses a JSON string and returns Either a TrackerJSON object or an error.
 *
 * @param tracker - string to be parsed.
 * @returns Either the parsed TrackerJSON object or an error.
 */
export const validateTrackerJSON = (tracker: string): Either<RulesError[], TrackerJSON> => {
  const parsedJson = safeParseJson(tracker)

  if (isLeft(parsedJson)) return parsedJson

  const parsed = trackerValidator.safeParse(unwrapEither(parsedJson))

  if (parsed.success) {
    return makeRight(parsed.data)
  } else {
    const errors: RulesError[] = parsed.error.issues.map((err) => ({
      errorType: 'INPUT',
      message: `${err.message}: Field ${err.path.join('.')}`,
      state: { input: tracker },
    }))
    return makeLeft(errors)
  }
}

/**
 * Parses a JSON string and returns Either a MappedTrackerJSON object or an error.
 *
 * @param tracker - string to be parsed.
 * @returns Either the parsed MappedTrackerJSON object or an error.
 */
export const validateMappedTrackerJSON = (tracker: string): Either<RulesError[], MappedTrackerJSON> => {
  const parsedJson = safeParseJson(tracker)

  if (isLeft(parsedJson)) return parsedJson

  const parsed = mappedTrackerValidator.safeParse(unwrapEither(parsedJson))

  if (parsed.success) {
    return makeRight(parsed.data)
  } else {
    const errors: RulesError[] = parsed.error.issues.map((err) => ({
      errorType: 'INPUT',
      message: `${err.message}: Field ${err.path.join('.')}`,
      state: { input: tracker },
    }))
    return makeLeft(errors)
  }
}

export const callingFunctionValidator = z.object({
  name: z.string().trim(),
  functionSignature: z.string().trim(),
  encodedValues: z.string().trim(),
})

export interface CallingFunctionJSON extends z.infer<typeof callingFunctionValidator> {}

/**
 * Parses a JSON string and returns Either a CallingFunctionJSON object or an error.
 *
 * @param callingFunction - string to be parsed.
 * @returns Either the parsed CallingFunctionJSON object or an error.
 */
export const validateCallingFunctionJSON = (callingFunction: string): Either<RulesError[], CallingFunctionJSON> => {
  const parsedJson = safeParseJson(callingFunction)
  if (isLeft(parsedJson)) return parsedJson
  const parsed = callingFunctionValidator.safeParse(unwrapEither(parsedJson))
  if (parsed.success) {
    return makeRight(parsed.data)
  } else {
    const errors: RulesError[] = parsed.error.issues.map((err) => ({
      errorType: 'INPUT',
      message: `${err.message}: Field ${err.path.join('.')}`,
      state: { input: callingFunction },
    }))
    return makeLeft(errors)
  }
}

export const policyJSONValidator = z
  .object({
    Policy: z.string(),
    Description: z.string(),
    PolicyType: z.string(),
    CallingFunctions: z.array(callingFunctionValidator),
    ForeignCalls: z.array(foreignCallValidator),
    Trackers: z.array(trackerValidator),
    MappedTrackers: z.array(mappedTrackerValidator),
    Rules: z.array(ruleValidator),
  })
  .refine(validateReferencedCalls, { message: 'Invalid reference call' })
export interface PolicyJSON extends z.infer<typeof policyJSONValidator> {}

/**
 * Parses a JSON string and returns Either a PolicyJSON object or an error.
 *
 * @param policy - string to be parsed.
 * @returns Either the parsed PolicyJSON object or an error.
 */
export const validatePolicyJSON = (policy: string): Either<RulesError[], PolicyJSON> => {
  const parsedJson = safeParseJson(policy)

  if (isLeft(parsedJson)) return parsedJson

  const parsed = policyJSONValidator.safeParse(unwrapEither(parsedJson))

  if (parsed.success) {
    return makeRight(parsed.data)
  } else {
    const errors: RulesError[] = parsed.error.issues.map((err) => ({
      errorType: 'INPUT',
      message: `${err.message}${err.path.length ? `: Field ${err.path.join('.')}` : ''}`,
      state: { input: policy },
    }))
    return makeLeft(errors)
  }
}
