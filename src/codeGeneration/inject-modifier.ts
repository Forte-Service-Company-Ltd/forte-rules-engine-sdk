/// SPDX-License-Identifier: BUSL-1.1
import * as fs from "fs";
import * as diff from "diff";
import { cleanString } from "../parsing/parsing-utilities";

/**
 * @file injectModifier.ts
 * @description This file contains functionality for injecting Solidity modifiers into existing Solidity contracts.
 *              It modifies the contract by adding import statements, updating the contract declaration, and appending
 *              modifiers to specified functions. Additionally, it generates a diff file to track the changes made.
 *
 * @module CodeGeneration
 *
 * @dependencies
 * - `fs`: Used for reading and writing files.
 * - `diff`: Used for generating a diff of the changes made to the contract file.
 * - `Parser`: Provides helper functions for cleaning strings.
 *
 * @functions
 * - `injectModifier`: Injects a Solidity modifier into a specified function within a contract file, updates the contract
 *   declaration, and generates a diff file to track the changes.
 *
 * @usage
 * - Use this file to dynamically inject modifiers into Solidity contracts for enforcing rules.
 * - Example:
 *   ```typescript
 *   import { injectModifier } from './injectModifier';
 *   injectModifier('transfer', 'address user, uint256 amount', './contracts/UserContract.sol', './diffs/UserContract.diff');
 *   ```
 *
 * @author @mpetersoCode55, @ShaneDuncan602, @TJ-Everett, @VoR0220
 *
 * @license BUSL-1.1
 *
 * @note This file is a critical component of the Rules Engine SDK, enabling the dynamic modification of Solidity contracts
 *       to integrate rule enforcement logic.
 */

/**
 * Injects a modifier into a Solidity contract file by modifying its content.
 *
 * This function performs the following operations:
 * 1. Adds an import statement for `RulesEngineClientCustom` after the pragma line.
 * 2. Updates the contract declaration to inherit from `RulesEngineClientCustom`.
 * 3. Adds a `checkRulesBefore` modifier to the specified function with the provided arguments.
 * 4. Writes the modified content back to the file and generates a diff file showing the changes.
 *
 * @param funcName - The name of the function to which the modifier will be added.
 * @param variables - A comma-separated string of variables to be passed to the modifier.
 *                    Supported types include `address`, `uint256`, `string`, `bool`, and `bytes`.
 * @param userFilePath - The file path of the Solidity contract to be modified.
 * @param diffPath - The file path where the diff of the changes will be saved.
 *
 * @remarks
 * - The function assumes the Solidity file uses standard formatting for pragma, contract declaration, and function definitions.
 * - The `checkRulesBefore` modifier is added to the calling function with the provided arguments.
 * - The diff file is generated in a format that highlights added and removed lines.
 *
 * @throws Will throw an error if the file at `userFilePath` cannot be read or written.
 * @throws Will throw an error if the provided function name or variables are invalid.
 */
export function injectModifier(
  funcName: string,
  variables: string,
  userFilePath: string,
  diffPath: string,
  modifierFile: string,
): void {
  funcName = cleanString(funcName);

  //find pragma line and inject import statement after
  var data = fs.readFileSync(userFilePath, "utf-8");
  var reg = /(?<=pragma).+?(?=;)/g;
  const matches = data.matchAll(reg);
  var modifiedData = data; // Initialize with original data
  for (const match of matches) {
    const fullFcExpr = match[0];
    // Check if import already exists
    if (!modifiedData.includes('import "' + modifierFile + '"')) {
      modifiedData = modifiedData.replace(
        fullFcExpr,
        fullFcExpr + ';\nimport "' + modifierFile + '"',
      );
    }
    break;
  }

  // Find and replace Contract Name Line with proper inheritance
  // Improved regex that specifically targets contract declarations
  var regNew = /contract\s+([a-zA-Z0-9_]+)(\s+is\s+[^{]+|\s*)(?={)/g;
  const contractMatches = modifiedData.matchAll(regNew);

  for (const match of contractMatches) {
    const fullMatch = match[0];
    const contractName = match[1];
    const existingInheritance = match[2] || "";

    let newInheritance;

    // Check if there's already an inheritance clause
    if (existingInheritance.includes(" is ")) {
      // Contract already has inheritance, add our interface to the list
      if (!existingInheritance.includes("RulesEngineClientCustom")) {
        newInheritance = existingInheritance.replace(
          " is ",
          " is RulesEngineClientCustom, ",
        );
        modifiedData = modifiedData.replace(
          fullMatch,
          `contract ${contractName}${newInheritance}`,
        );
      }
    } else {
      // No existing inheritance, add our interface as the only one
      newInheritance = ` is RulesEngineClientCustom${existingInheritance}`;
      modifiedData = modifiedData.replace(
        fullMatch,
        `contract ${contractName}${newInheritance}`,
      );
    }
    break;
  }

  // Find Function and place modifier
  var functionName = "function ";
  var argListUpdate = variables
    .replace(/address /g, "")
    .replace(/uint256 /g, "")
    .replace(/string /g, "")
    .replace(/bool /g, "")
    .replace(/bytes /g, "");

  const modifierToAdd = `checkRulesBefore${funcName}(${argListUpdate})`;
  const regex = new RegExp(
    `${functionName}\\s*${funcName}\\s*\\([^)]*\\)\\s*(public|private|internal|external)[^{]*`,
    "g",
  );
  const funcMatches = data.matchAll(regex);

  for (const match of funcMatches) {
    const fullFuncDecl = match[0];

    // Only add modifier if it's not already present in the full function declaration
    if (!fullFuncDecl.includes(modifierToAdd)) {
      const visibilityKeywordRegex = /(public|private|internal|external)\s*/;
      const newDecl = fullFuncDecl.replace(
        visibilityKeywordRegex,
        `$1 ${modifierToAdd} `,
      );
      modifiedData = modifiedData.replace(fullFuncDecl, newDecl);
    }
    break;
  }

  // Write the modified data back to the file
  fs.writeFileSync(userFilePath, modifiedData, "utf-8");

  // Only create diff file if diffPath is provided
  if (diffPath && diffPath.length > 0) {
    const diffResult = diff.diffLines(data, modifiedData);
    var newData = "";
    diffResult.forEach((part) => {
      if (part.added) {
        newData += "+" + part.value + "\n";
      } else if (part.removed) {
        newData += "-" + part.value + "\n";
      } else {
        newData += " " + part.value + "\n";
      }
    });

    fs.writeFileSync(diffPath, newData, "utf-8");
  }
}
