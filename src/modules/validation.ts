import { z } from "zod/v4";
import { Either, PT, RulesError } from "./types";
import { isLeft, makeLeft, makeRight, unwrapEither } from "./utils";
import { Address, checksumAddress, isAddress } from "viem";

/**
 * Accepts any input, if input is a string, it trims whitespace from both ends.
 * if input is not a string the input is returned as is.
 *
 * @param input - value to be trimmed if it is a string.
 * @returns The trimmed input or the original input if not a string.
 */
const trimPossibleString = (input: any): any => {
  if (typeof input === "string") {
    return input.trim();
  } else {
    return input;
  }
};

/**
 * Parses a JSON string and returns Either a successful result or an error.
 *
 * @param input - string to be parsed.
 * @returns Either the parsed string or an error.
 */
export const safeParseJson = (input: string): Either<RulesError[], object> => {
  try {
    const result = JSON.parse(input);
    return makeRight(result);
  } catch (error) {
    return makeLeft([
      {
        errorType: "INPUT",
        state: { input },
        message: "Failed to parse JSON",
      },
    ]);
  }
};

export const PType = PT.map((p) => p.name); // ["address", "string", "uint256", "bool", "void", "bytes"]

export const splitFunctionInput = (input: string): string[] => {
  return input.split("(")[1].split(")")[0].split(",");
};

/**
 * Accepts an array of RulesError objects and returns a formatted message string
 *
 * @param errors - RulesErrors array to be processed.
 * @returns The errors messages concatenated into a single string
 */
export const getRulesErrorMessages = (errors: RulesError[]): string => {
  return errors.map((err) => `${err.message}`).join("\n");
};

export const ruleValidator = z.object({
  Name: z.string(),
  Description: z.string(),

  condition: z.string(),
  positiveEffects: z.array(z.string()),
  negativeEffects: z.array(z.string()),
  callingFunction: z.string(),
});
export interface RuleJSON extends z.infer<typeof ruleValidator> {}

/**
 * Parses a JSON string and returns Either a RuleJSON object or an error.
 *
 * @param rule - string to be parsed.
 * @returns Either the parsed RuleJSON object or an error.
 */
export const validateRuleJSON = (
  rule: string
): Either<RulesError[], RuleJSON> => {
  const parsedJson = safeParseJson(rule);

  if (isLeft(parsedJson)) return parsedJson;

  const parsed = ruleValidator.safeParse(unwrapEither(parsedJson));

  if (parsed.success) {
    return makeRight(parsed.data);
  } else {
    const errors: RulesError[] = parsed.error.issues.map((err) => ({
      errorType: "INPUT",
      message: `${err.message}: Field ${err.path.join(".")}`,
      state: { input: rule },
    }));
    return makeLeft(errors);
  }
};

/**
 * Validates foreign call parameters to ensure they are of supported types.
 *
 * @param input - string to be validated.
 * @returns true if input is valid, false if input is invalid.
 */
export const validateFCFunctionInput = (input: string): boolean => {
  const parameterSplit = splitFunctionInput(input);

  return (
    parameterSplit.filter((parameter) => !PType.includes(parameter.trim()))
      .length === 0
  );
};

export const foreignCallValidator = z.object({
  name: z.string(),
  function: z
    .string()
    .trim()
    .refine(validateFCFunctionInput, { message: "Unsupported argument type" }),
  address: z
    .string()
    .trim()
    .refine((input) => isAddress(input), {
      message: `Address is invalid`,
    })
    .transform((input) => checksumAddress(input.trim() as Address)),
  returnType: z.preprocess(
    trimPossibleString,
    z.literal(PType, "Unsupported return type")
  ),
  valuesToPass: z.string().trim(),
  mappedTrackerKeyValues: z.string().trim(),
  callingFunction: z.string().trim(),
});

export interface ForeignCallJSON extends z.infer<typeof foreignCallValidator> {}

/**
 * Parses a JSON string and returns Either a ForeignCallJSON object or an error.
 *
 * @param foreignCall - string to be parsed.
 * @returns Either the parsed ForeignCallJSON object or an error.
 */
export const validateForeignCallJSON = (
  foreignCall: string
): Either<RulesError[], ForeignCallJSON> => {
  const parsedJson = safeParseJson(foreignCall);

  if (isLeft(parsedJson)) return parsedJson;

  const parsed = foreignCallValidator.safeParse(unwrapEither(parsedJson));

  if (parsed.success) {
    return makeRight(parsed.data);
  } else {
    const errors: RulesError[] = parsed.error.issues.map((err) => ({
      errorType: "INPUT",
      message: `${err.message}: Field ${err.path.join(".")}`,
      state: { input: foreignCall },
    }));
    return makeLeft(errors);
  }
};

export const foreignCallReverseValidator = foreignCallValidator.extend({
  function: z.string().trim(),
});

export interface ForeignCallJSONReversed
  extends z.infer<typeof foreignCallValidator> {}

export const supportedTrackerTypes: string[] = [
  "uint256",
  "string",
  "address",
  "bytes",
  "bool",
];

/**
 * Validates tracker initial value to ensure it matches the type specified.
 *
 * @param input - value to be validated.
 * @returns true if input is valid, false if input is invalid.
 */
const validateTrackerValue = (data: any) => {
  // Validate that the initialValue matches the type
  switch (data.type) {
    case "uint256":
      return !isNaN(Number(data.initialValue));
    case "string":
      return typeof data.initialValue === "string";
    case "address":
      return isAddress(data.initialValue);
    case "bytes":
      return typeof data.initialValue === "string"; // Assuming bytes are represented as hex strings
    case "bool":
      return true;
    default:
      return false; // Should never happen due to z.literal
  }
};

export const trackerValidator = z
  .object({
    name: z.string().trim(),
    type: z.preprocess(
      trimPossibleString,
      z.literal(supportedTrackerTypes, "Unsupported type")
    ),
    initialValue: z.string().trim(),
  })
  .refine(validateTrackerValue, {
    message: "Initial Value doesn't match type",
  });

export interface TrackerJSON extends z.infer<typeof trackerValidator> {}

export interface MappedTrackerJSON
  extends z.infer<typeof mappedTrackerValidator> {}

const SupportedValues = [
  z.object({
    type: "uint256",
    value: z.number(),
  }),

  z.object({
    type: "string",
    value: z.string(),
  }),

  z.object({
    type: "string",
    value: z.string(),
  }),

  z.object({
    type: "address",
    value: z.string(),
  }),

  z.object({
    type: "uint256",
    value: z.number(),
  }),

  z.object({
    type: "uint256",
    value: z.literal(["true", "false"]),
  }),
] as const;

export const mappedTrackerValidator = z.object({
  name: z.string().trim(),
  keyType: z.string().trim(),
  valueType: z.string().trim(),
  initialKeys: z.array(z.string()),
  initialValues: z.array(z.string()),
});

/**
 * Parses a JSON string and returns Either a TrackerJSON object or an error.
 *
 * @param tracker - string to be parsed.
 * @returns Either the parsed TrackerJSON object or an error.
 */
export const validateTrackerJSON = (
  tracker: string
): Either<RulesError[], TrackerJSON> => {
  const parsedJson = safeParseJson(tracker);

  if (isLeft(parsedJson)) return parsedJson;

  const parsed = trackerValidator.safeParse(unwrapEither(parsedJson));

  if (parsed.success) {
    return makeRight(parsed.data);
  } else {
    const errors: RulesError[] = parsed.error.issues.map((err) => ({
      errorType: "INPUT",
      message: `${err.message}: Field ${err.path.join(".")}`,
      state: { input: tracker },
    }));
    return makeLeft(errors);
  }
};

/**
 * Parses a JSON string and returns Either a MappedTrackerJSON object or an error.
 *
 * @param tracker - string to be parsed.
 * @returns Either the parsed MappedTrackerJSON object or an error.
 */
export const validateMappedTrackerJSON = (
  tracker: string
): Either<RulesError[], MappedTrackerJSON> => {
  const parsedJson = safeParseJson(tracker);

  if (isLeft(parsedJson)) return parsedJson;

  const parsed = mappedTrackerValidator.safeParse(unwrapEither(parsedJson));

  if (parsed.success) {
    return makeRight(parsed.data);
  } else {
    const errors: RulesError[] = parsed.error.issues.map((err) => ({
      errorType: "INPUT",
      message: `${err.message}: Field ${err.path.join(".")}`,
      state: { input: tracker },
    }));
    return makeLeft(errors);
  }
};

export const callingFunctionValidator = z.object({
  name: z.string().trim(),
  functionSignature: z.string().trim(),
  encodedValues: z.string().trim(),
});

export interface CallingFunctionJSON
  extends z.infer<typeof callingFunctionValidator> {}

/**
 * Parses a JSON string and returns Either a CallingFunctionJSON object or an error.
 *
 * @param callingFunction - string to be parsed.
 * @returns Either the parsed CallingFunctionJSON object or an error.
 */
export const validateCallingFunctionJSON = (
  callingFunction: string
): Either<RulesError[], CallingFunctionJSON> => {
  const parsedJson = safeParseJson(callingFunction);
  if (isLeft(parsedJson)) return parsedJson;
  const parsed = callingFunctionValidator.safeParse(unwrapEither(parsedJson));
  if (parsed.success) {
    return makeRight(parsed.data);
  } else {
    const errors: RulesError[] = parsed.error.issues.map((err) => ({
      errorType: "INPUT",
      message: `${err.message}: Field ${err.path.join(".")}`,
      state: { input: callingFunction },
    }));
    return makeLeft(errors);
  }
};

export const policyJSONValidator = z.object({
  Policy: z.string(),
  Description: z.string(),
  PolicyType: z.string(),
  CallingFunctions: z.array(callingFunctionValidator),
  ForeignCalls: z.array(foreignCallValidator),
  Trackers: z.array(trackerValidator),
  MappedTrackers: z.array(mappedTrackerValidator),
  Rules: z.array(ruleValidator),
});
export interface PolicyJSON extends z.infer<typeof policyJSONValidator> {}

/**
 * Parses a JSON string and returns Either a PolicyJSON object or an error.
 *
 * @param policy - string to be parsed.
 * @returns Either the parsed PolicyJSON object or an error.
 */
export const validatePolicyJSON = (
  policy: string
): Either<RulesError[], PolicyJSON> => {
  const parsedJson = safeParseJson(policy);

  if (isLeft(parsedJson)) return parsedJson;

  const parsed = policyJSONValidator.safeParse(unwrapEither(parsedJson));

  if (parsed.success) {
    return makeRight(parsed.data);
  } else {
    const errors: RulesError[] = parsed.error.issues.map((err) => ({
      errorType: "INPUT",
      message: `${err.message}: Field ${err.path.join(".")}`,
      state: { input: policy },
    }));
    return makeLeft(errors);
  }
};
