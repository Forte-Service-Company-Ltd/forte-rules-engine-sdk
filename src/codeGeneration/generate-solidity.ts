/// SPDX-License-Identifier: BUSL-1.1
import * as fs from "fs";
import * as path from "path";
import {
  getRulesErrorMessages,
  validatePolicyJSON,
} from "../modules/validation";
import { isLeft, unwrapEither } from "../modules/utils";
import { SOLIDITY_TEMPLATE } from "./template";

/**
 * @file generateSolidity.ts
 * @description This file contains functionality for dynamically generating Solidity modifiers based on rule definitions.
 *              It reads a template Solidity file, injects the generated modifiers, and writes the updated content to an output file.
 *
 * @module CodeGeneration
 *
 * @dependencies
 * - `fs`: Used for reading and writing files.
 * - `path`: Used for resolving file paths.
 * - `Parser`: Provides helper functions for cleaning strings.
 * - `ContractInteraction`: Provides the `ruleJSON` type for defining rule structures.
 *
 * @functions
 * - `generateModifier`: Generates Solidity modifiers based on a rule JSON string and writes them to a template file.
 *
 * @usage
 * - Use this file to generate Solidity modifiers dynamically based on rule definitions.
 * - Example:
 *   ```typescript
 *   import { generateModifier } from './generateSolidity';
 *   const ruleJSON = '{"encodedValues": "address user, uint256 amount"}';
 *   generateModifier(ruleJSON, './output/GeneratedContract.sol');
 *   ```
 *
 * @author @mpetersoCode55, @ShaneDuncan602, @TJ-Everett, @VoR0220
 *
 * @license BUSL-1.1
 *
 * @note This file is a critical component of the Rules Engine SDK, enabling the dynamic generation of Solidity code
 *       for enforcing rules in smart contracts.
 */

/**
 * Generates Solidity modifiers and inserts them into a template file.
 *
 * This function takes a JSON string representing rule data and generates two Solidity modifiers:
 * `checkRulesBefore` and `checkRulesAfter`. These modifiers are then inserted into a Solidity
 * template file at the placeholder `// Modifier Here`. The modified Solidity code is written
 * to the specified output file.
 *
 * @param policyS - A JSON string representing the policy data. It must include an `encodedValues`
 *                property containing the argument list for the modifiers.
 * @param outputFileName - The path to the output file where the modified Solidity code will be written.
 *
 * @throws Will throw an error if the input JSON string is invalid or if file operations fail.
 */
export function generateModifier(
  policyS: string,
  outputFileName: string,
): void {
  var functionNames: String[] = [];
  const validatedPolicySyntax = validatePolicyJSON(policyS);
  if (isLeft(validatedPolicySyntax)) {
    throw new Error(getRulesErrorMessages(unwrapEither(validatedPolicySyntax)));
  }
  const policySyntax = unwrapEither(validatedPolicySyntax);

  var iter = 0;
  var count = 0;
  var countArray: string[] = [];
  for (var rule of policySyntax.Rules) {
    if (!countArray.includes(rule.callingFunction)) {
      count += 1;
      countArray.push(rule.callingFunction);
    }
  }

  // Use the imported template instead of reading from file
  var overallModifiedData = SOLIDITY_TEMPLATE;

  if (!fs.existsSync(path.dirname(outputFileName))) {
    fs.mkdirSync(path.dirname(outputFileName), { recursive: true });
  }
  const filePathOutput = outputFileName;
  for (var syntax of policySyntax.Rules) {
    var argList = "";
    for (var fCall of policySyntax.CallingFunctions) {
      if (fCall.functionSignature.trim() == syntax.callingFunction.trim()) {
        argList = fCall.encodedValues;
        break;
      }
    }
    var callingFunction = syntax.callingFunction.split("(")[0];
    if (functionNames.includes(callingFunction)) {
      continue;
    } else {
      functionNames.push(callingFunction);
      var modifierNameStr =
        "modifier checkRulesBefore" + callingFunction + "([]) {\n";
      var modifierNameAfterStr =
        "\tmodifier checkRulesAfter" + callingFunction + "([]) {\n";

      var argListUpdate = argList.replace(/address /g, "");
      argListUpdate = argListUpdate.replace(/uint256 /g, "");
      argListUpdate = argListUpdate.replace(/string /g, "");
      argListUpdate = argListUpdate.replace(/bool /g, "");
      argListUpdate = argListUpdate.replace(/bytes /g, "");

      modifierNameStr = modifierNameStr.replace("[]", argList.trim());
      modifierNameAfterStr = modifierNameAfterStr.replace("[]", argList.trim());
      var encodeStr =
        "\t\tbytes memory encoded = abi.encodeWithSelector(msg.sig,[]);\n";
      encodeStr = encodeStr.replace("[]", argListUpdate);
      var thirdLine = "\t\t_invokeRulesEngine(encoded);\n";
      var fourthLine = "\t\t_;\n";
      var finalLine = "\t}";
      var outputString =
        modifierNameStr + encodeStr + thirdLine + fourthLine + finalLine;
      var outputStringTwo =
        modifierNameAfterStr + encodeStr + fourthLine + thirdLine + finalLine;
      var replaceStr = outputString + "\n\n" + outputStringTwo;

      iter += 1;
      if (iter < count) {
        replaceStr += "\n\n";
        replaceStr += "\t// Modifier Here";
        replaceStr += "\n";
      }
      var modifiedData = overallModifiedData.replace(
        "// Modifier Here",
        replaceStr,
      );
      overallModifiedData = modifiedData;
    }
  }
  // Write the modified data back to the file
  fs.writeFileSync(filePathOutput, overallModifiedData, "utf-8");
}
