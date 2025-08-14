/// SPDX-License-Identifier: BUSL-1.1

import { Address, decodeAbiParameters, parseAbiParameters } from "viem";
import {
  stringReplacement,
  RuleStruct,
  PT,
  TrackerOnChain,
  hexToFunctionString,
  CallingFunctionHashMapping,
  FunctionArgument,
  RuleMetadataStruct,
  ForeignCallOnChain,
  TrackerMetadataStruct,
} from "../modules/types";
import {
  CallingFunctionJSON,
  ForeignCallJSON,
  ForeignCallJSONReversed,
  MappedTrackerJSON,
  RuleJSON,
  TrackerJSON,
  validateCallingFunctionJSON,
  validateFCFunctionInput,
  validateForeignCallJSON,
  validateMappedTrackerJSON,
  validateTrackerJSON,
} from "../modules/validation";
import { parseFunctionArguments } from "./parsing-utilities";
import { isRight, unwrapEither } from "../modules/utils";

/**
 * @file reverse-parsing-logic.ts
 * @description This module provides set of parsing utilities used to convert back from the instruction set syntax
 * to the original human readable syntax
 *
 * @module parser
 *
 * @exports
 * - Functions for reverse parsing rule syntax, trackers, foreign calls, and converting between formats.
 *
 * @author @mpetersoCode55, @ShaneDuncan602, @TJ-Everett, @VoR0220
 *
 * @license BUSL-1.1
 *
 * @note This file is a critical component of the Rules Engine SDK, enabling the translation of human-readable
 *       rule definitions into machine-readable formats and vice versa.
 */

/**
 * Converts an instruction set back into a human-readable rule condition string.
 *
 * @param instructionSet - The instruction set to reverse parse.
 * @param placeHolderArray - An array of placeholders used in the instruction set.
 * @param stringReplacements - An array of string replacements for specific instructions.
 * @returns A human-readable rule condition string.
 */
export function reverseParseInstructionSet(
  instructionSet: number[],
  placeHolderArray: string[],
  stringReplacements: stringReplacement[]
): string {
  var currentAction = -1;
  var currentActionIndex = 0;
  var currentMemAddress = 0;
  var memAddressesMap = [];
  var currentInstructionValues: any[] = [];
  var retVal = "";
  var instructionNumber = 0;
  var truUpdated = false;
  var keyIndex = -1;
  var valueIndex = -1;
  var instructionCount = instructionSet.length;
  for (var instruction of instructionSet) {
    if (currentAction == -1) {
      currentAction = Number(instruction);
      switch (currentAction) {
        case 0:
          currentActionIndex = 1;
          break;
        case 1:
          currentActionIndex = 1;
          break;
        case 2:
          currentActionIndex = 1;
          break;
        case 3:
          currentActionIndex = 2;
          break;
        case 4:
          currentActionIndex = 2;
          break;
        case 5:
          currentActionIndex = 2;
          break;
        case 6:
          currentActionIndex = 2;
          break;
        case 7:
          currentActionIndex = 2;
          break;
        case 8:
          currentActionIndex = 2;
          break;
        case 9:
          currentActionIndex = 2;
          break;
        case 10:
          currentActionIndex = 2;
          break;
        case 11:
          currentActionIndex = 2;
          break;
        case 12:
          currentActionIndex = 2;
          break;
        case 17:
          currentActionIndex = 3;
          break;
        case 18:
          currentActionIndex = 4;
          break;
        default:
          currentActionIndex = 2;
          break;
      }
    } else {
      switch (currentAction) {
        case 0:
          var found = false;
          for (var raw of stringReplacements) {
            if (raw.instructionSetIndex == instructionNumber) {
              memAddressesMap.push({
                memAddr: currentMemAddress,
                value: raw.originalData,
              });
              found = true;
              break;
            }
          }
          if (!found) {
            memAddressesMap.push({
              memAddr: currentMemAddress,
              value: instruction,
            });
          }
          currentMemAddress += 1;
          break;
        case 1:
          for (var memValue of memAddressesMap) {
            if (memValue.memAddr == instruction) {
              currentInstructionValues.push(memValue.value);
            }
          }
          if (currentActionIndex == 1) {
            var currentString = "NOT " + currentInstructionValues[0];
            memAddressesMap.push({
              memAddr: currentMemAddress,
              value: currentString,
            });
            retVal = currentString;
            currentMemAddress += 1;
            currentInstructionValues = [];
          }
          break;
        case 2:
          memAddressesMap.push({
            memAddr: currentMemAddress,
            value: placeHolderArray[instruction],
          });
          keyIndex = instruction;
          currentMemAddress += 1;
          retVal = placeHolderArray[instruction];
          break;
        case 3:
          retVal = arithmeticOperatorReverseInterpretation(
            instruction,
            currentMemAddress,
            memAddressesMap,
            currentActionIndex,
            currentInstructionValues,
            " = "
          );
          if (currentActionIndex == 1) {
            currentMemAddress += 1;
            currentInstructionValues = [];
          }
          break;
        case 4:
          if (currentActionIndex == 2) {
            valueIndex = instruction;
          } else {
            var newMem =
              placeHolderArray[valueIndex] +
              "(" +
              placeHolderArray[keyIndex] +
              ")";
            memAddressesMap.push({
              memAddr: currentMemAddress,
              value: newMem,
            });
            currentMemAddress += 1;
          }

          break;
        case 5:
          retVal = arithmeticOperatorReverseInterpretation(
            instruction,
            currentMemAddress,
            memAddressesMap,
            currentActionIndex,
            currentInstructionValues,
            " + "
          );
          if (currentActionIndex == 1) {
            currentMemAddress += 1;
            currentInstructionValues = [];
          }
          break;
        case 6:
          retVal = arithmeticOperatorReverseInterpretation(
            instruction,
            currentMemAddress,
            memAddressesMap,
            currentActionIndex,
            currentInstructionValues,
            " - "
          );
          if (currentActionIndex == 1) {
            currentMemAddress += 1;
            currentInstructionValues = [];
          }
          break;
        case 7:
          retVal = arithmeticOperatorReverseInterpretation(
            instruction,
            currentMemAddress,
            memAddressesMap,
            currentActionIndex,
            currentInstructionValues,
            " * "
          );
          if (currentActionIndex == 1) {
            currentMemAddress += 1;
            currentInstructionValues = [];
          }
          break;
        case 8:
          retVal = arithmeticOperatorReverseInterpretation(
            instruction,
            currentMemAddress,
            memAddressesMap,
            currentActionIndex,
            currentInstructionValues,
            " / "
          );
          if (currentActionIndex == 1) {
            currentMemAddress += 1;
            currentInstructionValues = [];
          }
          break;
        case 9:
          retVal = arithmeticOperatorReverseInterpretation(
            instruction,
            currentMemAddress,
            memAddressesMap,
            currentActionIndex,
            currentInstructionValues,
            " < "
          );
          if (currentActionIndex == 1) {
            currentMemAddress += 1;
            currentInstructionValues = [];
          }
          break;
        case 10:
          retVal = arithmeticOperatorReverseInterpretation(
            instruction,
            currentMemAddress,
            memAddressesMap,
            currentActionIndex,
            currentInstructionValues,
            " > "
          );
          if (currentActionIndex == 1) {
            currentMemAddress += 1;
            currentInstructionValues = [];
          }
          break;
        case 11:
          retVal = arithmeticOperatorReverseInterpretation(
            instruction,
            currentMemAddress,
            memAddressesMap,
            currentActionIndex,
            currentInstructionValues,
            " == "
          );
          if (currentActionIndex == 1) {
            currentMemAddress += 1;
            currentInstructionValues = [];
          }
          break;
        case 12:
          retVal = logicalOperatorReverseInterpretation(
            instruction,
            currentMemAddress,
            memAddressesMap,
            currentActionIndex,
            currentInstructionValues,
            " AND "
          );
          if (currentActionIndex == 1) {
            currentMemAddress += 1;
            currentInstructionValues = [];
          }
          break;
        case 13:
          retVal = logicalOperatorReverseInterpretation(
            instruction,
            currentMemAddress,
            memAddressesMap,
            currentActionIndex,
            currentInstructionValues,
            " OR "
          );
          if (currentActionIndex == 1) {
            currentMemAddress += 1;
            currentInstructionValues = [];
          }
          break;
        case 14:
          retVal = arithmeticOperatorReverseInterpretation(
            instruction,
            currentMemAddress,
            memAddressesMap,
            currentActionIndex,
            currentInstructionValues,
            " >= "
          );
          if (currentActionIndex == 1) {
            currentMemAddress += 1;
            currentInstructionValues = [];
          }
          break;
        case 15:
          retVal = arithmeticOperatorReverseInterpretation(
            instruction,
            currentMemAddress,
            memAddressesMap,
            currentActionIndex,
            currentInstructionValues,
            " <= "
          );
          if (currentActionIndex == 1) {
            currentMemAddress += 1;
            currentInstructionValues = [];
          }
          break;
        case 16:
          retVal = arithmeticOperatorReverseInterpretation(
            instruction,
            currentMemAddress,
            memAddressesMap,
            currentActionIndex,
            currentInstructionValues,
            " != "
          );
          if (currentActionIndex == 1) {
            currentMemAddress += 1;
            currentInstructionValues = [];
          }
          break;
        case 17:
        case 18:
          if (!truUpdated) {
            var str = memAddressesMap[currentMemAddress - 1].value;
            var memVal: any = str
              .replace("TR:", "TRU:")
              .replace("-", "-=")
              .replace("+", "+=")
              .replace("*", "*=")
              .replace("/", "/=");
            truUpdated = true;
            memAddressesMap.push({
              memAddr: currentMemAddress,
              value: memVal,
            });
          }
          if (currentActionIndex == 1) {
            currentMemAddress += 1;
            currentInstructionValues = [];
            truUpdated = false;

            if (instructionNumber + 1 == instructionCount) {
              retVal = memAddressesMap[currentMemAddress - 1].value;
            }
          }
          break;

        default:
          console.log("unknown instruction");
          break;
      }
      currentActionIndex -= 1;
      if (currentActionIndex == 0) {
        currentAction = -1;
      }
    }
    instructionNumber += 1;
  }
  if (retVal.at(0) == "(") {
    retVal = retVal.substring(2, retVal.length - 2);
  }
  return retVal;
}

export const reverseParsePlaceholder = (
  placeholder: any,
  names: FunctionArgument[],
  foreignCalls: ForeignCallOnChain[],
  trackers: TrackerOnChain[],
  mappings: hexToFunctionString[]
): string => {
  if (placeholder.flags == 0x01) {
    const call = foreignCalls.find(
      (call) => call.foreignCallIndex === placeholder.typeSpecificIndex
    );
    const map = mappings.find((map) => map.hex === call?.signature);
    return "FC:" + map?.functionString.split("(")[0];
  } else if (placeholder.flags == 0x02) {
    const map = mappings.find(
      (map) => map.index === placeholder.typeSpecificIndex
    );
    return "TR:" + map?.functionString;
  } else if (placeholder.flags == 0x04) {
    return "GV:MSG_SENDER";
  } else if (placeholder.flags == 0x08) {
    return "GV:BLOCK_TIMESTAMP";
  } else if (placeholder.flags == 0x0c) {
    return "GV:MSG_DATA";
  } else if (placeholder.flags == 0x10) {
    return "GV:BLOCK_NUMBER";
  } else if (placeholder.flags == 0x14) {
    return "GV:TX_ORIGIN";
  } else {
    return names[placeholder.typeSpecificIndex].name;
  }
};

export const reverseParseEffect = (
  effect: any,
  placeholders: string[]
): string => {
  if (effect.effectType == 0) {
    return "revert('" + effect.text + "')";
  } else if (effect.effectType == 1) {
    return "emit " + effect.text;
  } else {
    return reverseParseInstructionSet(effect.instructionSet, placeholders, []);
  }
};

/**
 * Converts a `RuleStruct` object into a JSON-like string representation.
 *
 * @param functionString - The calling function signature as a string.
 * @param encodedValues - A string containing encoded values for the rule.
 * @param ruleS - The `RuleStruct` object containing rule details such as placeholders, positive effects, and negative effects.
 * @param plhArray - An array to store the names of placeholders extracted from the rule.
 * @param foreignCalls - An array of foreign calls used in the rule.
 * @param trackers - An array of trackers used in the rule.
 * @param mappings - An array of mappings that associate a `hex` signature with a function.
 * @returns An object of type `ruleJSON` containing the condition, positive effects, negative effects, calling function, and encoded values.
 *
 * The function processes the `RuleStruct` object to:
 * - Extract placeholder names and append them to `plhArray`.
 * - Parse and format positive and negative effects into strings.
 * - Reverse parse the rule's instruction set to generate a condition string.
 * - Populate the `ruleJSON` object with the processed data.
 */
export function convertRuleStructToString(
  functionString: string,
  encodedValues: string,
  ruleS: RuleStruct,
  ruleM: RuleMetadataStruct,
  foreignCalls: ForeignCallOnChain[],
  trackers: TrackerOnChain[],
  mappings: hexToFunctionString[]
): RuleJSON {
  var rJSON: RuleJSON = {
    Name: ruleM.ruleName,
    Description: ruleM.ruleDescription,
    condition: "",
    positiveEffects: [],
    negativeEffects: [],
    callingFunction: "",
  };

  var names = parseFunctionArguments(encodedValues);

  const plhArray = ruleS.placeHolders.map((placeholder) =>
    reverseParsePlaceholder(
      placeholder,
      names,
      foreignCalls,
      trackers,
      mappings
    )
  );

  rJSON.condition = reverseParseInstructionSet(
    ruleS!.instructionSet,
    plhArray,
    []
  );
  rJSON.callingFunction = functionString;

  const effectPlhArray = ruleS.effectPlaceHolders.map((placeholder) =>
    reverseParsePlaceholder(
      placeholder,
      names,
      foreignCalls,
      trackers,
      mappings
    )
  );

  rJSON.positiveEffects = ruleS.posEffects.map((effect) =>
    reverseParseEffect(effect, effectPlhArray)
  );
  rJSON.negativeEffects = ruleS.negEffects.map((effect) =>
    reverseParseEffect(effect, effectPlhArray)
  );

  return rJSON;
}

/**
 * Converts an array of foreign call structures into formatted string representations
 * and appends them to the provided `callStrings` array.
 *
 * @param callStrings - An array to which the formatted foreign call strings will be appended.
 * @param foreignCalls - An array of foreign call objects or `null`. Each object should contain
 *                       details such as `function`, `returnType`, `parameterTypes`, and `foreignCallAddress`.
 * @param functionMappings - An array of mappings that associate a `hex` signature with
 *                           a human-readable `functionSignature`.
 * @param names - An array of names corresponding to each foreign call, used for formatting the output.
 *
 * The function processes each foreign call by:
 * - Matching its `signature` with the corresponding `functionSignature` from the mappings.
 * - Resolving its `returnType` and `parameterTypes` to human-readable names using a predefined
 *   parameter type enumeration (`PT`).
 * - Formatting the foreign call details into a string and appending it to the `callStrings` array.
 *
 * The output string format is:
 * `Foreign Call <index> --> <foreignCallAddress> --> <functionSignature> --> <returnType> --> <parameterTypes>`
 *
 * Example:
 * ```
 * Foreign Call 1 --> 0x1234567890abcdef --> myFunction(uint256) --> uint256 --> uint256, string
 * ```
 */
export function convertForeignCallStructsToStrings(
  foreignCallsOnChain: ForeignCallOnChain[],
  callingFunctionMappings: hexToFunctionString[]
): ForeignCallJSONReversed[] {
  const foreignCalls: ForeignCallJSONReversed[] = foreignCallsOnChain.map(
    (call, iter) => {
      const functionMeta = callingFunctionMappings.find(
        (mapping) => mapping.hex === call.signature
      );

      const returnTypeString = PT.find(
        (pType) => pType.enumeration == call.returnType
      )?.name;

      const callingFunction = callingFunctionMappings.find(
        (mapping) => mapping.index == call.callingFunctionIndex
      );
      const inputs = {
        name: functionMeta?.functionString || "",
        address: call.foreignCallAddress as Address,
        function: functionMeta?.functionString || "",
        returnType: returnTypeString || "",
        valuesToPass: functionMeta?.encodedValues || "",
        mappedTrackerKeyValues: "",
        callingFunction: callingFunction?.functionString || "",
      };

      return inputs;
    }
  );

  return foreignCalls;
}

function retrieveDecoded(type: number, key: string): string {
  if (type == 0) {
    return decodeAbiParameters(
      parseAbiParameters("address"),
      key as `0x${string}`
    )[0].toLowerCase();
  } else if (type == 1) {
    return decodeAbiParameters(
      parseAbiParameters("string"),
      key as `0x${string}`
    )[0];
  } else if (type == 2) {
    return String(Number(key));
  } else if (type == 3) {
    return Number(key) == 0 ? "false" : "true";
  } else {
    return key;
  }
}

/**
 * Converts tracker structures into human-readable strings.
 *
 * @param trackers - An array of tracker structures.
 * @param trackerStrings - An array to store the resulting strings.
 * @param trackerNames - An array of names corresponding to each tracker, used for formatting the output.
 */
export function convertTrackerStructsToStrings(
  trackers: TrackerOnChain[],
  trackerNames: TrackerMetadataStruct[],
  mappedTrackerNames: TrackerMetadataStruct[]
): { Trackers: TrackerJSON[]; MappedTrackers: MappedTrackerJSON[] } {
  const Trackers = trackers
    .filter((tracker) => !tracker.mapped)
    .map((tracker, iter) => {
      const trackerType =
        PT.find((pt) => pt.enumeration === tracker.pType)?.name || "";

      var initialValue = retrieveDecoded(
        tracker.pType,
        trackerNames[iter].initialValue
      );

      const inputs = {
        name: trackerNames[iter].trackerName,
        type: trackerType,
        initialValue: initialValue,
      };
      const validatedInputs = validateTrackerJSON(JSON.stringify(inputs));
      if (isRight(validatedInputs)) {
        return unwrapEither(validatedInputs);
      } else {
        throw new Error(
          `Invalid tracker input: ${JSON.stringify(validatedInputs.left)}`
        );
      }
    });
  const MappedTrackers = trackers
    .filter((tracker) => tracker.mapped)
    .map((tracker, iter) => {
      const valueType =
        PT.find((pt) => pt.enumeration === tracker.pType)?.name || "";
      const keyType =
        PT.find((pt) => pt.enumeration === tracker.trackerKeyType)?.name || "";

      var keys = [];

      for (var key of mappedTrackerNames[iter].initialKeys) {
        var decodedKey = retrieveDecoded(tracker.trackerKeyType, key);

        keys.push(decodedKey);
      }

      var values = [];
      for (var key of mappedTrackerNames[iter].initialValues) {
        var decodedValue = retrieveDecoded(tracker.pType, key);
        values.push(decodedValue);
        console.log(decodedValue);
      }

      const inputs = {
        name: mappedTrackerNames[iter].trackerName,
        valueType,
        keyType,
        initialKeys: keys,
        initialValues: values,
      };
      const validatedInputs = validateMappedTrackerJSON(JSON.stringify(inputs));
      if (isRight(validatedInputs)) {
        return unwrapEither(validatedInputs);
      } else {
        throw new Error(
          `Invalid mapped tracker input: ${JSON.stringify(
            validatedInputs.left
          )}`
        );
      }
    });
  return {
    Trackers,
    MappedTrackers,
  };
}

/**
 * Converts tracker structures into human-readable strings.
 *
 * @param trackers - An array of tracker structures.
 * @param trackerStrings - An array to store the resulting strings.
 * @param trackerNames - An array of names corresponding to each tracker, used for formatting the output.
 */
export function convertCallingFunctionToStrings(
  callingFunctions: CallingFunctionHashMapping[]
): CallingFunctionJSON[] {
  const callingFunctionJsons: CallingFunctionJSON[] = callingFunctions.map(
    (callingFunction) => {
      const validatedInputs = validateCallingFunctionJSON(
        JSON.stringify(callingFunction)
      );
      if (isRight(validatedInputs)) {
        return unwrapEither(validatedInputs);
      } else {
        throw new Error(
          `Invalid calling function input: ${JSON.stringify(
            validatedInputs.left
          )}`
        );
      }
    }
  );
  return callingFunctionJsons;
}

/**
 * Interprets an arithmetic operation in reverse by mapping memory addresses to their values
 * and constructing a string representation of the operation.
 *
 * @param instruction - The memory address of the instruction to interpret.
 * @param currentMemAddress - The current memory address where the result will be stored.
 * @param memAddressesMap - An array of objects mapping memory addresses to their values.
 * @param currentActionIndex - The index of the current action being processed.
 * @param currentInstructionValues - An array to store the values of the current instruction.
 * @param symbol - The arithmetic operator symbol (e.g., "+", "-", "*", "/") to use in the operation.
 * @returns The string representation of the arithmetic operation if `currentActionIndex` is 1, otherwise an empty string.
 */
function arithmeticOperatorReverseInterpretation(
  instruction: number,
  currentMemAddress: number,
  memAddressesMap: any[],
  currentActionIndex: number,
  currentInstructionValues: any[],
  symbol: string
): string {
  for (var memValue of memAddressesMap) {
    if (memValue.memAddr == instruction) {
      currentInstructionValues.push(memValue.value);
    }
  }
  if (currentActionIndex == 1) {
    var currentString =
      currentInstructionValues[0] + symbol + currentInstructionValues[1];
    memAddressesMap.push({ memAddr: currentMemAddress, value: currentString });
    return currentString;
  }
  return "";
}

/**
 * Interprets a logical operation in reverse by mapping memory addresses to their values
 * and constructing a string representation of the operation.
 *
 * @param instruction - The memory address of the instruction to interpret.
 * @param currentMemAddress - The current memory address where the result will be stored.
 * @param memAddressesMap - An array of objects mapping memory addresses to their values.
 * @param currentActionIndex - The index of the current action being processed.
 * @param currentInstructionValues - An array to store the values of the current instruction.
 * @param symbol - The logical operator symbol (e.g., "&&", "||") used in the operation.
 * @returns The string representation of the logical operation if `currentActionIndex` is 1,
 *          otherwise an empty string.
 */
function logicalOperatorReverseInterpretation(
  instruction: number,
  currentMemAddress: number,
  memAddressesMap: any[],
  currentActionIndex: number,
  currentInstructionValues: any[],
  symbol: string
): string {
  for (var memValue of memAddressesMap) {
    if (memValue.memAddr == instruction) {
      currentInstructionValues.push(memValue.value);
    }
  }
  if (currentActionIndex == 1) {
    var currentString =
      "( " +
      currentInstructionValues[0] +
      symbol +
      currentInstructionValues[1] +
      " )";
    memAddressesMap.push({ memAddr: currentMemAddress, value: currentString });
    return currentString;
  }
  return "";
}
