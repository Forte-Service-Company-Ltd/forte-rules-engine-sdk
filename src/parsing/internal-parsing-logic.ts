/// SPDX-License-Identifier: BUSL-1.1
import { isAddress } from "viem";
import {
  trackerIndexNameMapping,
  PlaceholderStruct,
  matchArray,
  truMatchArray,
  Tuple,
  InstructionSet,
  ASTAccumulator,
} from "../modules/types";
import { determinePTEnumeration } from "./parser";
import { getPTEnum } from "../modules/utils";

/**
 * @file internal-parsing-logic.ts
 * @description This module contains the internal parsing logic used to convert human readable syntax to instruction set syntax
 *
 * @module parser
 *
 * @exports
 * - General functions for parsing human readable syntax into instruction set syntax
 *
 * @author @mpetersoCode55, @ShaneDuncan602, @TJ-Everett, @VoR0220
 *
 * @license BUSL-1.1
 *
 * @note This file is a critical component of the Rules Engine SDK, enabling the translation of human-readable
 *       rule definitions into machine-readable formats and vice versa.
 */

var truIndex = -1;
var truKey = -1;
// --------------------------------------------------------------------------------------------------
// Main Parsing Logic:
// Converting the Human Readable Expression syntax to the Executable Instruction set syntax takes
//   place in two major steps:
//   - Convert the Human Readable Expression syntax into an Abstrct Syntax Tree (AST)
//   - Convert the Abstract Syntax Tree into the Executable Instruction set syntax
// These two steps are captured in the following two functions:
//   - convertHumanReadableToInstructionSet
//   - convertASTToInstructionSet
// --------------------------------------------------------------------------------------------------

var originalDelimiters: string[] = [];
/**
 * Interprets a given syntax string into an instruction set and placeholders.
 *
 * This function processes a syntax string by constructing an Abstract Syntax Tree (AST),
 * splitting it based on logical operators (AND/OR), and recursively iterating over the tree
 * to generate an instruction set. It also handles placeholders and maps indices for tracking.
 *
 * @param syntax - The input syntax string to be interpreted.
 * @param names - An array of names used in the instruction set.
 * @param indexMap - A mapping of tracker indices to names.
 * @param existingPlaceHolders - An array of existing placeholders to be considered.
 *
 * @returns An object containing:
 * - `instructionSet`: The generated instruction set based on the input syntax.
 * - `placeHolders`: The placeholders used in the instruction set.
 */
export function convertHumanReadableToInstructionSet(
  syntax: string,
  names: any[],
  indexMap: trackerIndexNameMapping[],
  existingPlaceHolders: PlaceholderStruct[],
): InstructionSet {
  //Replace AND, OR and NOT with a placeholder value (PLA) so we can parse them simultaneously
  originalDelimiters = [];
  var whiteSpaceSplit = syntax.split(" ");
  var delimiterIterator = 0;
  var first = true;
  let array_: any[] = [];
  for (var str of whiteSpaceSplit) {
    if (str == "AND" || str == "OR" || str == "NOT") {
      originalDelimiters.push(str);
      if (first) {
        syntax = syntax.replace(str, " PLA" + String(delimiterIterator));
      } else {
        syntax = syntax.replace(" " + str, " PLA" + String(delimiterIterator));
      }

      delimiterIterator += 1;
    }
    first = false;
  }

  // Create the initial Abstract Syntax Tree (AST) splitting on PLA (placeholder)
  var array = convertToTree(syntax, "PLA");

  if (array.length == 1) {
    array = array[0];
  } else if (array.length == 0) {
    // If the array is still empty than a single top level statement without an AND or OR was used.
    array.push(syntax);
  }
  if (array.length > 0) {
    // Recursively iterate over the tree splitting on the available operators
    for (var matchCase of matchArray) {
      //AND, OR and NOT have been relaced with placeholders, just iterate over the placeholder itself
      if (matchCase == "OR") {
        continue;
      } else if (matchCase == "AND") {
        matchCase = "PLA";
      } else if (matchCase == "NOT") {
        continue;
      }

      iterate(array, matchCase);
    }

    array_ = removeArrayWrappers(array);
    array_ = intify(array_);
  }
  const astAccumulator: ASTAccumulator = {
    instructionSet: [],
    mem: [],
    iterator: { value: 0 },
  };
  // Convert the AST into the Instruction Set Syntax
  convertASTToInstructionSet(
    astAccumulator,
    array_,
    names,
    existingPlaceHolders,
    indexMap,
  );

  for (var instructionIter in astAccumulator.instructionSet) {
    if (typeof astAccumulator.instructionSet[instructionIter] == "string") {
      if (astAccumulator.instructionSet[instructionIter].includes("PLA")) {
        var index = parseInt(
          astAccumulator.instructionSet[instructionIter]
            .replace("PLA", "")
            .trim(),
        );
        astAccumulator.instructionSet[instructionIter] =
          originalDelimiters[index];
      }
    }
  }
  return astAccumulator.instructionSet;
}

/**
 * Converts an AST into an instruction set syntax.
 *
 * @param retVal - The resulting instruction set.
 * @param mem - The memory map for the instruction set.
 * * @param iterator - An iterator for tracking memory locations.
 * @param expression - The AST to convert.
 * @param parameterNames - An array of argument placeholders.
 * @param placeHolders - An array to store placeholders.
 * @param indexMap - A mapping of tracker IDs to their names and types.
 */
function convertASTToInstructionSet(
  acc: ASTAccumulator,
  expression: any[],
  parameterNames: any[],
  placeHolders: PlaceholderStruct[],
  indexMap: trackerIndexNameMapping[],
): ASTAccumulator {
  if (typeof expression[0] == "string") {
    var foundMatch = false;
    var plhIndex = 0;
    var searchExpressions = [];
    var split = expression[0];
    if (expression[0].includes(" | ")) {
      searchExpressions.push(expression[0].split(" | ")[0]);
      split = expression[0].split(" | ")[1];
    }

    searchExpressions.push(split);
    var expCount = 0;
    var previousIndex = -1;

    // PPRF searchExpressions is ony more than 1 element if its a mapped tracker
    for (var expr of searchExpressions) {
      plhIndex = 0;

      // This is everything (function parameters, foreign calls, trackers)
      for (var parameter of parameterNames) {
        if (parameter.name == expr.trim()) {
          foundMatch = true;
          var plhIter = 0;
          var copyFound = false;

          // Function parameters and trackers
          for (var place of placeHolders) {
            // Check if the expression is an exact match for one of our placeholders
            // This will cover all placeholders except foreign calls and tracker updates
            // these two get their own cases (found below)
            // PPRF handle tracker expressions
            if (expr.trim().includes("TR:")) {
              if (
                place.typeSpecificIndex == parameter.tIndex &&
                place.flags == 0x02
              ) {
                // if searchExpressions as length more than 1
                // it is a mapped tracker else it is a standard tracker
                if (searchExpressions.length > 1) {
                  acc.instructionSet.push("PLHM");
                  acc.instructionSet.push(place.typeSpecificIndex);
                  acc.instructionSet.push(previousIndex);
                } else {
                  acc.instructionSet.push("PLH");
                  acc.instructionSet.push(plhIter);
                  previousIndex = acc.iterator.value;
                }
                copyFound = true;
                break;
              }
            } else {
              if (
                place.typeSpecificIndex == parameter.tIndex &&
                place.flags != 0x01 &&
                place.flags != 0x02
              ) {
                acc.instructionSet.push("PLH");
                acc.instructionSet.push(plhIter);
                previousIndex = acc.iterator.value;
                copyFound = true;
                break;
              }
            }
            plhIter += 1;
          }
          if (!copyFound) {
            acc.instructionSet.push("PLH");
            acc.instructionSet.push(plhIndex);
            previousIndex = acc.iterator.value;
          }
          expCount += 1;
          acc.mem.push(acc.iterator.value);
          acc.iterator.value += 1;
          if (expCount == searchExpressions.length) {
            var sliced = expression.slice(1);

            convertASTToInstructionSet(
              acc,
              sliced,
              parameterNames,
              placeHolders,
              indexMap,
            );
          }

          // Check if the expression is a foreign call
          // PPRF handle foreign call expressions
        } else if (parameter.fcPlaceholder) {
          if (parameter.fcPlaceholder == split.trim()) {
            foundMatch = true;
            acc.instructionSet.push("PLH");
            acc.instructionSet.push(plhIndex);
            previousIndex = acc.iterator.value;
            var found = false;
            for (var pHold of placeHolders) {
              if (
                pHold.flags == 0x1 &&
                pHold.typeSpecificIndex == parameter.tIndex
              ) {
                found = true;
              }
            }
            var sliced = expression.slice(1);
            acc.mem.push(acc.iterator.value);
            acc.iterator.value += 1;
            convertASTToInstructionSet(
              acc,
              sliced,
              parameterNames,
              placeHolders,
              indexMap,
            );
          } else {
            plhIndex += 1;
          }

          // Check if the expression is a tracker update
          // PPRF handle tracker update expressions
        } else if (expr.trim().includes("TRU:")) {
          foundMatch = true;
          var trackerName = split.trim().replace("TRU:", "TR:");
          var values = trackerName.split(" ");
          var comparison = values[0];
          if (values.length > 1) {
            comparison = values[1];
          }

          if (comparison == parameter.name) {
            if (searchExpressions.length > 1) {
              acc.instructionSet.push("PLHM");
              acc.instructionSet.push(parameter.tIndex);
              acc.instructionSet.push(previousIndex);
              acc.mem.pop();
            } else {
              acc.instructionSet.push("PLH");
              acc.instructionSet.push(plhIndex);
              previousIndex = acc.iterator.value;
            }

            for (var ind of indexMap) {
              if (parameter.name == "TR:" + ind.name) {
                truIndex = ind.id;
                truKey = previousIndex;
              }
            }

            var sliced = expression.slice(1);
            acc.mem.push(acc.iterator.value);
            acc.iterator.value += 1;
            convertASTToInstructionSet(
              acc,
              sliced,
              parameterNames,
              placeHolders,
              indexMap,
            );
          } else {
            plhIndex += 1;
          }
          // The current parameter does not match the expression
        } else {
          if (
            split.replace("TRU:", "TR:").trim() != parameter.name &&
            !split.includes("TRU:")
          ) {
            plhIndex += 1;
          }
        }
      }
      if (!foundMatch) {
        if (matchArray.includes(split.trim()) || split.includes("PLA")) {
          foundMatch = true;
          var sliced = expression.slice(1);
          convertASTToInstructionSet(
            acc,
            sliced,
            parameterNames,
            placeHolders,
            indexMap,
          );
          if (truMatchArray.includes(split.trim())) {
            switch (split.trim()) {
              case "+=":
                acc.instructionSet.push("+");
                break;
              case "-=":
                acc.instructionSet.push("-");
                break;
              case "*=":
                acc.instructionSet.push("*");
                break;
              case "/=":
                acc.instructionSet.push("/");
                break;
              case "=":
                acc.instructionSet.push("=");
                break;
            }
          } else {
            acc.instructionSet.push(split);
          }
          var not = false;
          if (split.includes("PLA")) {
            var it = parseInt(split.replace("PLA", "").trim());
            if (originalDelimiters[it] == "NOT") {
              not = true;
            }
          }
          if (not) {
            acc.instructionSet.push(acc.mem.pop());
          } else {
            acc.instructionSet.push(...acc.mem.splice(acc.mem.length - 2, 2));
          }
          if (truMatchArray.includes(split.trim())) {
            // this asumes the update operator is at index 0 and the tracker name is at index 1
            if (expression[1].includes("|")) {
              acc.instructionSet.push("TRUM");
            } else {
              acc.instructionSet.push("TRU");
            }
            acc.instructionSet.push(truIndex);
            acc.instructionSet.push(acc.iterator.value);
            //TODO: if TRUM add key here save it off like truIndex
            if (expression[1].includes("|")) {
              acc.instructionSet.push(truKey);
            }
            const trackerName = expression[1].split(":")[1];
            const trackerType = getPTEnum(
              indexMap.find((mapping) => mapping.name == trackerName)?.type ||
                4,
            ); // Default to VOID if not found

            // if trackerType is string(1) or bytes(5) then push 1 indicating placeholder tracker
            // else push 0 indicating memory tracker
            if (trackerType === "string" || trackerType === "bytes") {
              acc.instructionSet.push(1);
            } else {
              acc.instructionSet.push(0);
            }

            acc.iterator.value += 1;
            acc.mem.push(acc.iterator.value);
          } else {
            acc.mem.push(acc.iterator.value);
          }
          acc.iterator.value += 1;
        }
      }
      if (!foundMatch) {
        acc.instructionSet.push("N");
        acc.instructionSet.push(split.trim());
        var sliced = expression.slice(1);
        acc.mem.push(acc.iterator.value);
        acc.iterator.value += 1;
        convertASTToInstructionSet(
          acc,
          sliced,
          parameterNames,
          placeHolders,
          indexMap,
        );
      }
    }

    // If it's an array with a number as the first index, add the number to the instruction set, add its memory
    // location to the memory map and recursively run starting at the next index
  } else if (
    typeof expression[0] == "number" ||
    typeof expression[0] == "bigint"
  ) {
    acc.instructionSet.push("N");
    acc.instructionSet.push(BigInt(expression[0]));
    var sliced = expression.slice(1);
    acc.mem.push(acc.iterator.value);
    acc.iterator.value += 1;
    convertASTToInstructionSet(
      acc,
      sliced,
      parameterNames,
      placeHolders,
      indexMap,
    );
    // If it's an array with a nested array as the first index recursively run with the nested array, update the memory map
    // and recursively run starting at the next index
  } else if (Array.isArray(expression[0])) {
    convertASTToInstructionSet(
      acc,
      expression[0],
      parameterNames,
      placeHolders,
      indexMap,
    );
    expression = expression.slice(1);
    convertASTToInstructionSet(
      acc,
      expression,
      parameterNames,
      placeHolders,
      indexMap,
    );
  }
  return acc;
}

/**
 * Converts a logical condition string into a tree-like syntax array representation.
 * This function processes the input string by handling parenthesis and splitting
 * based on a specified delimiter, ultimately constructing a nested array structure
 * that represents the logical condition.
 *
 * @param condition - The logical condition string to be converted into a tree structure.
 *                     Example: "(A AND B) OR C".
 * @param splitOn - The delimiter used to split the condition string. Typically a logical operator
 *                  such as "AND" or "OR".
 * @returns A nested array representing the tree structure of the logical condition.
 *          Example: ["OR", ["AND", ["A"], ["B"]], ["C"]].
 */
function convertToTree(condition: string, splitOn: string): any[] {
  // Recursive Function steps:
  // 1. Replace anything in parenthesis with i:n
  var substrs = new Array();

  var delimiterSplit = condition.split(splitOn);
  let iter = 0;
  let leng = condition.split("(").length;

  while (iter <= leng - 2) {
    // Start with the final instance of "(" in the string, create a substring
    // to the next instance of ")" and replace that with i:n
    // Repeat this process until all parenthesis have been accounted for
    var start = condition.lastIndexOf("(");
    var substr = condition.substring(start, condition.indexOf(")", start) + 1);

    condition = condition.replace(substr, "i:".concat(iter.toString()));
    var index = "i:".concat(iter.toString());
    var tuple: Tuple = { i: index, s: substr };
    substrs.push(tuple);
    iter++;
  }
  // 2. Split based on the passed in delimiter (splitOn)
  var delimiterSplit: string[] = [];
  var uniq: string[] = [];
  if (splitOn == "PLA") {
    var reg: RegExp = / PLA\d{1,6} /;
    var matches = condition.match(reg);
    uniq = [...new Set(matches)];
    delimiterSplit = condition.split(reg);
  } else {
    delimiterSplit = condition.split(" " + splitOn + " ");
  }
  // 3. Convert to syntax array
  // Start from the back of the array and work forwards
  var endIndex = delimiterSplit.length - 1;

  var overAllArray = new Array();
  var addOnIter = 0;
  while (endIndex > 0) {
    if (endIndex >= 1) {
      var innerArray = new Array();
      // Retrieve the contents of the parenthesis for the last two i:n values
      var actualValue = retrieveParenthesisContent(
        delimiterSplit[endIndex - 1],
        substrs,
      );
      var actualValueTwo = retrieveParenthesisContent(
        delimiterSplit[endIndex],
        substrs,
      );

      if (actualValue.startsWith("(")) {
        actualValue = actualValue.substring(1, actualValue.length - 1);
      }

      if (actualValueTwo.startsWith("(")) {
        actualValueTwo = actualValueTwo.substring(1, actualValueTwo.length - 1);
      }
      // Add the contents to an inner array
      var innerArrayTwo = new Array();
      innerArray.push(actualValue);
      innerArrayTwo.push(actualValueTwo);
      // If this is the first entry in the overall array, add the values in an array wrapper
      // otherwise add them directly
      if (overAllArray.length == 0) {
        var outerArray = new Array();
        if (splitOn == "PLA") {
          outerArray.push(uniq[addOnIter].trim());
          addOnIter += 1;
        } else {
          outerArray.push(splitOn);
        }
        var pushArray = true;

        if (splitOn == "PLA") {
          var it = parseInt(uniq[addOnIter - 1].replace("PLA", "").trim());
          if (originalDelimiters[it] == "NOT") {
            pushArray = false;
          }
        }
        if (pushArray) {
          outerArray.push(innerArray);
        }
        outerArray.push(innerArrayTwo);
        overAllArray.unshift(outerArray);
      } else {
        overAllArray.unshift(innerArrayTwo);
        overAllArray.unshift(innerArray);
        overAllArray.unshift(splitOn);
      }
      endIndex -= 2;
    }
    // Slightly modified process for the final index in the array
    if (endIndex == 0) {
      var innerArray = new Array();
      var actualValue = retrieveParenthesisContent(
        delimiterSplit[endIndex],
        substrs,
      );
      if (actualValue.includes("(")) {
        actualValue = actualValue.substring(1, actualValue.length - 1);
      }
      innerArray.push(actualValue);
      var outerArray = new Array();
      overAllArray.unshift(innerArray);
      overAllArray.unshift(splitOn);
      endIndex -= 1;
    }
  }
  return overAllArray;
}

/**
 * Iterates through an array and processes its elements based on a specified delimiter.
 * If an element contains the delimiter, it is converted into a tree structure using `convertToTree`.
 * The function handles nested arrays recursively.
 *
 * @param array - The array to iterate over and process. Can contain nested arrays.
 * @param splitOn - The delimiter string used to split and process elements in the array.
 */
function iterate(array: any[], splitOn: string): void {
  var iter = 0;

  while (iter < array.length) {
    if (!Array.isArray(array[iter])) {
      var checkVal = " " + splitOn + " ";
      if (splitOn == "PLA") {
        checkVal = " PLA";
      }
      if (array[iter].includes(checkVal)) {
        var output = convertToTree(array[iter], splitOn);
        if (output.length > 0) {
          if (output.length == 1) {
            output = output[0];
          }
          array.splice(iter, 1, output[0]);
        }
        if (output.length > 1) {
          var iterTwo = 1;
          while (iterTwo < output.length) {
            array.splice(iter + iterTwo, 0, output[iterTwo]);
            iterTwo++;
          }
        }
        iter -= 1;
      }
    } else {
      if (array[iter].length > 0) {
        iterate(array[iter], splitOn);
      }
    }

    iter += 1;
  }
}

/**
 * Retrieves and processes the content within parentheses from a given string
 * based on a list of tuples. If the content includes a specific pattern (`i:`),
 * it recursively resolves the content using the provided tuples.
 *
 * @param str - The input string to process.
 * @param tuples - An array of `Tuple` objects, where each tuple contains
 *                 a key (`i`) and a substitution value (`s`).
 * @returns The processed string with resolved content from the tuples.
 */
function retrieveParenthesisContent(str: string, tuples: Tuple[]): string {
  var actualValue = str;
  var iter = 0;
  while (iter < tuples.length) {
    let tuple: Tuple = tuples[iter];
    if (str.includes(tuple.i)) {
      actualValue = tuple.s;
      if (actualValue.includes("i:")) {
        var substr = actualValue.substring(
          actualValue.indexOf("i:"),
          actualValue.indexOf("i:") + 3,
        );
        actualValue = actualValue.replace(
          substr,
          retrieveParenthesisContent(substr, tuples),
        );
      }
      break;
    }
    iter++;
  }
  return actualValue;
}

/**
 * Recursively removes unnecessary array wrappers from a nested array structure.
 * If an element in the array is itself an array with only one element, it replaces
 * that element with its single value. If the element is a nested array with more
 * than one element, the function is called recursively on that nested array.
 *
 * @param array - The array to process, which may contain nested arrays.
 * @return A new array with unnecessary wrappers removed, where single-element arrays
 *         are replaced by their single value.
 */
export function removeArrayWrappers(array: any[]): any[] {
  return array.map((iter) => {
    if (Array.isArray(iter)) {
      if (iter.length == 1) {
        return iter[0];
      } else {
        return removeArrayWrappers(iter);
      }
    }
    return iter;
  });
}

/**
 * Recursively converts elements of an array to `BigInt` where applicable.
 *
 * This function traverses through the provided array and its nested arrays.
 * If an element is determined to be an address (via the `isAddress` function),
 * it is converted to a `BigInt`. If the element is numeric and not an address,
 * it is also converted to a `BigInt`. Non-numeric and non-address elements
 * remain unchanged.
 *
 * @param array - The array to process. Can contain nested arrays and elements
 *                of any type.
 * @returns The processed array with elements converted to `BigInt` where applicable.
 */
function intify(array: any[]): Array<number | BigInt> {
  return array.map((iter) => {
    if (Array.isArray(iter)) {
      return intify(iter);
    } else {
      if (isAddress(iter) || !isNaN(Number(iter))) {
        return BigInt(iter);
      }
    }
    return iter;
  });
}
