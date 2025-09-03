# Parser Flow

## Logic Flow for Parsing

### Policy JSON Parsing Execution Flow

1. **Initial Validation (validation.ts)**  
   Policy JSON string is validated using `validatePolicyJSON()` function.
   - Uses Zod schema validation (`policyJSONValidator`) to ensure proper structure.
   - Validates required fields: `Policy`, `Description`, `PolicyType`, `CallingFunctions`, `ForeignCalls`, `Trackers`, `Rules`.

   ```typescript
   import { policyJSONValidator } from './validators'

   export function validatePolicyJSON(policyJSON: string): boolean {
     const parsedJSON = JSON.parse(policyJSON)
     return policyJSONValidator.safeParse(parsedJSON).success
   }
   ```

2. Policy Creation Entry Point (rules-engine.ts)
   `RulesEngine.createPolicy(policyJSON: string)` is called

- Delegates to `createPolicyInternal()` function

```typescript
export function createPolicy(policyJSON: string): string {
  return createPolicyInternal(policyJSON)
}
```

3. Core Policy Processing (policy.ts)
   The `createPolicy()` function orchestrates the entire process:

- 3.1 Setup Phase
  - Initialize tracking arrays for foreign calls, trackers, rules, and calling functions
  - Create a new policy contract entry with name and description
- 3.2 Calling Functions Processing
  - Parse each calling function from `CallingFunctions` array
  - Create calling function entries using `createCallingFunction()`
  - Generate function selectors and store metadata

```typescript
export function createCallingFunction(functionData: any): CallingFunction {
  // Logic to create and return a calling function
}
```

- 3.3 Trackers Processing
  - Process regular trackers from `Trackers` array using `parseTrackerSyntax()`
  - Process mapped trackers from `MappedTrackers` array using `parseMappedTrackerSyntax()`
  - Create tracker entries in the contract using `createTracker()` or `createMappedTracker()`

```typescript
export function parseMappedTrackerSyntax(syntax: MappedTrackerJSON): MappedTrackerDefinition {
  let keyType = syntax.keyType
  let valueType = syntax.valueType
  var trackerInitialKeys: any[] = encodeTrackerData(syntax.initialKeys, keyType)
  var trackerInitialValues: any[] = encodeTrackerData(syntax.initialValues, valueType)
  const keyTypeEnum = (PT.find((_pt) => _pt.name == keyType) ?? PT[4]).enumeration
  const valueTypeEnum = (PT.find((_pt) => _pt.name == valueType) ?? PT[4]).enumeration

  return {
    name: syntax.name,
    keyType: keyTypeEnum,
    valueType: valueTypeEnum,
    initialKeys: trackerInitialKeys,
    initialValues: trackerInitialValues,
  }
}
```

- 3.4 Foreign Calls Processing
  - Parse each foreign call from `ForeignCalls` array using `parseForeignCallDefinition()`
  - Create foreign call entries using `createForeignCall()`
  - Map foreign call names to IDs for rule processing

```typescript
export function parseForeignCallDefinition(foreignCall: ForeignCallJSON): ForeignCallDefinition {
  // Logic to parse and return a foreign call definition
}
```

- 3.5 Rules Processing
- For each rule in `Rules` array:
  - Parse rule syntax using `parseRuleSyntax()`
  - Convert human-readable conditions to instruction sets
  - Process rule effects (positive and negative)
  - Create rule entries using `createRule()`
  - Map rules to their calling functions

```typescript
export function parseRuleSyntax(syntax: RuleSyntaxJSON): RuleDefinition {
  // Logic to parse and return a rule definition
}
```

4. Rule Syntax Parsing (parser.ts)
   The `parseRuleSyntax()` function handles complex rule parsing:

- 4.1 Condition Processing
- Parse function arguments from encoded values
- Process foreign calls within conditions
- Process tracker references
- Parse global variables
- 4.2 Effects Processing
  - Parse positive and negative effects using `parseEffect()`
  - Convert effects to instruction sets
  - Handle placeholders and variable references
- 4.3 Instruction Set Generation
  - Convert human-readable syntax to machine-readable instruction sets using `convertHumanReadableToInstructionSet()`
  - Build raw data structures for contract execution

```typescript
export function convertHumanReadableToInstructionSet(condition: string): InstructionSet {
  // Logic to convert human-readable conditions to instruction sets
}
```

5. Final Policy Assembly

- Update policy with all component mappings (calling functions to rules)
- Store final policy configuration in the contract
- Return policy ID for future reference

```typescript
export function parseFunctionArguments(args: string): ParsedArguments {
  // Logic to parse function arguments
}
```

6. Key Parsing Utilities (parsing-utilities.ts)
   Supporting functions handle specific parsing tasks:

- `parseFunctionArguments()` - Extract function parameters
- `parseForeignCalls()` - Process external contract calls
- `parseTrackers()` - Handle state tracking variables
- `parseGlobalVariables()` - Process global context variables
- `buildPlaceholderList()` - Create placeholder mappings

```typescript
export function parseFunctionArguments(args: string): ParsedArguments {
  // Logic to parse function arguments
}
```

7. Error Handling

- Validation errors are collected and returned as `RulesError[]` arrays
- Parsing failures return `-1` or appropriate error codes
- Contract interaction errors trigger retry mechanisms with delays

This flow transforms a human-readable policy JSON into a fully deployed, executable policy within the Rules Engine smart contract system, with all components (rules, trackers, foreign calls) properly linked and ready for execution.

## Logical flow:

### Parsing:

#### Parse Rule Syntax

### Rule Syntax Parsing Execution Flow

1. **Initial Setup**:
   - Extracts the condition from the `syntax` object.
   - Removes extra parentheses using `removeExtraParenthesis`.
   - Parses function arguments from the condition using `parseFunctionArguments`.
   - Initializes `ruleComponents` to store parsed components.

   ```typescript
   export function removeExtraParenthesis(condition: string): string {
     // Logic to remove unnecessary parentheses
   }

   export function parseFunctionArguments(condition: string): ParsedArguments {
     // Logic to parse function arguments
   }
   ```

2. Foreign Call Parsing:

- Parses foreign calls in the condition using `parseForeignCalls`.
- Updates `ruleComponents` with the parsed foreign call names.
- Updates the condition with the processed foreign call condition (`fcCondition`).

  ```typescript
  export function parseForeignCalls(condition: string): { updatedCondition: string; foreignCallNames: string[] } {
    // Logic to parse foreign calls and return updated condition
  }
  ```

3. Tracker Parsing:

- Parses trackers in the updated `fcCondition` using `parseTrackers`.
- Appends the resulting tracker components to `ruleComponents`.

  ```typescript
  export function parseTrackers(condition: string): {
    updatedCondition: string
    trackerComponents: TrackerComponent[]
  } {
    // Logic to parse trackers and return updated condition
  }
  ```

4. Global Variable Parsing:

- Parses global variables in the tracker-processed condition using `parseGlobalVariables`.
- Adds the resulting components to `ruleComponents`.

  ```typescript
  export function parseGlobalVariables(condition: string): {
    updatedCondition: string
    globalVariableComponents: GlobalVariable[]
  } {
    // Logic to parse global variables and return updated condition
  }
  ```

5. Placeholder List Creation:

- Builds a list of placeholders from `ruleComponents` using `buildPlaceholderList`.

  ```typescript
  export function buildPlaceholderList(components: RuleComponent[]): PlaceholderList {
    // Logic to build a placeholder list
  }
  ```

6. Positive Effects Processing:

- Iterates over `syntax.positiveEffects`.
- Parses function arguments, foreign calls, trackers, and global variables for each positive effect.
- Updates the effect condition and collects all parsed components into `effectNamesMega`.

  ```typescript
  export function parseEffect(effect: EffectSyntax): { updatedEffect: string; effectComponents: EffectComponent[] } {
    // Logic to parse a single effect
  }
  ```

7. Negative Effects Processing:

- Similar to positive effects, iterates over `syntax.negativeEffects`.
- Parses function arguments, foreign calls, trackers, and global variables for each negative effect.
- Updates the effect condition and collects all parsed components into `effectNamesMega`.

8. Effect Name Cleansing:

- Cleanses and deduplicates the collected effect names using `cleanseForeignCallLists` and `buildPlaceholderList`.

  ```typescript
  export function cleanseForeignCallLists(effectNames: string[]): string[] {
    // Logic to cleanse and deduplicate effect names
  }
  ```

9. Effect Parsing:

- Parses the final positive and negative effects using `parseEffect`.
- Produces `positiveEffectsFinal` and `negativeEffectsFinal`.

10. Instruction Set Conversion:

- Converts the human-readable condition (`fcCondition`) and `ruleComponents` into an instruction set using `convertHumanReadableToInstructionSet`.

  ```typescript
  export function convertHumanReadableToInstructionSet(condition: string, components: RuleComponent[]): InstructionSet {
    // Logic to convert condition and components into an instruction set
  }
  ```

11. Raw Data Construction:

- Builds raw data for the instruction set.
- Updates the instruction sets of positive and negative effects using buildRawData.

  ```typescript
  export function buildRawData(instructionSet: InstructionSet): RawData {
    // Logic to build raw data for the instruction set
  }
  ```

12. Return Final Rule Definition:

- Returns a RuleDefinition object containing:
  - The final instruction set.
  - Processed positive and negative effects.
  - Placeholders and effect placeholders.

  ```typescript
  export function createRuleDefinition(
    instructionSet: InstructionSet,
    positiveEffects: Effect[],
    negativeEffects: Effect[],
    placeholders: PlaceholderList
  ): RuleDefinition {
    return {
      instructionSet,
      positiveEffects,
      negativeEffects,
      placeholders,
    }
  }
  ```

#### Parse Mapped Tracker Syntax

1. Extract Key and Value Types

- The `keyType` and `valueType` are extracted from the syntax object.

  ```typescript
  let keyType = syntax.keyType
  let valueType = syntax.valueType
  ```

2.  Encode Initial Keys and Values

- The `initialKeys` and `initialValues` from the syntax object are encoded using the `encodeTrackerData` function, which takes the data and its type as arguments.

  ```typescript
  var trackerInitialKeys: any[] = encodeTrackerData(syntax.initialKeys, keyType)
  var trackerInitialValues: any[] = encodeTrackerData(syntax.initialValues, valueType)
  ```

3. Map Key and Value Types to Enumerations

- The keyType and valueType are matched against a predefined list PT to find their corresponding enumerations.
- If no match is found, a default enumeration (PT[4]) is used.

  ```typescript
  const keyTypeEnum = (PT.find((_pt) => _pt.name == keyType) ?? PT[4]).enumeration
  const valueTypeEnum = (PT.find((_pt) => _pt.name == valueType) ?? PT[4]).enumeration
  ```

4.  Return the Mapped Tracker Definition

- The function returns a `MappedTrackerDefinition` object containing:
- The `name` from the `syntax` object.
- The mapped `keyType` and `valueType` enumerations.
- The encoded `initialKeys` and `initialValues`.
  ```typescript
  return {
    name: syntax.name,
    keyType: keyTypeEnum,
    valueType: valueTypeEnum,
    initialKeys: trackerInitialKeys,
    initialValues: trackerInitialValues,
  }
  ```

### Parse Tracker Syntax

1. Extract Tracker Type

- The function starts by extracting the `type` from the `syntax` object.

  ```typescript
  let trackerType = syntax.type
  ```

2.  Encode the Initial Value Based on Type
    The function determines how to encode the initialValue based on the trackerType. It uses different encoding methods for each type:

        a. `uint256`
        If the type is `uint256`, the `initialValue` is converted to a `BigInt` and encoded using encodePacked.

        ```typescript
        trackerInitialValue = encodePacked(
            ["uint256"],
            [BigInt(syntax.initialValue)]
        );
        ```
        b. `address`
        If the type is `address`, the `initialValue` is validated using `getAddress` and encoded using `encodeAbiParameters`.

        ```typescript
        const validatedAddress = getAddress(syntax.initialValue);
        trackerInitialValue = encodeAbiParameters(parseAbiParameters("address"), [
            validatedAddress,
        ]);
        ```
        c. `bytes`
        If the type is `bytes`, the `initialValue` is converted to a `BigInt` hash using `keccak256` and encoded as a `uint256`.

        ```typescript
        var interim = BigInt(
        keccak256(
            encodeAbiParameters(parseAbiParameters("bytes"), [
            toHex(stringToBytes(String(syntax.initialValue))),
            ])
        )
        );
        trackerInitialValue = encodePacked(["uint256"], [BigInt(interim)]);
        ```

        d. `bool`
        If the type is `bool`, the `initialValue` is checked for "`true`" or "`false`" and encoded as `1n` or `0n` respectively.

        ```typescript
        if (syntax.initialValue == "true") {
        trackerInitialValue = encodePacked(["uint256"], [1n]);
        } else {
        trackerInitialValue = encodePacked(["uint256"], [0n]);
        }
        ```

        e. Default (e.g., `string`)
        For all other types (e.g., `string`), the `initialValue` is hashed using `keccak256` and encoded as a `uint256`.


        ```typescript
        var interim = BigInt(
        keccak256(
            encodeAbiParameters(parseAbiParameters("string"), [
            syntax.initialValue as string,
            ])
        )
        );
        trackerInitialValue = encodePacked(["uint256"], [BigInt(interim)]);
        ```

3.  Map Tracker Type to Enumeration

- The `trackerType` is matched against a predefined list `PT` to find its corresponding enumeration.
- If no match is found, a default value of `4` is used.

  ```typescript
  var trackerTypeEnum = PT.find((pt) => pt.name === trackerType)?.enumeration ?? 4
  ```

4. Return the Tracker Definition

- Finally, the function returns a `TrackerDefinition` object containing:
  - The `name` from the `syntax` object.
  - The mapped `type` enumeration.
  - The encoded `initialValue`.

  ```typescript
  return {
    name: syntax.name,
    type: trackerTypeEnum,
    initialValue: trackerInitialValue,
  }
  ```

#### Parse Foreign Call Definition

1. Encode Indices for `valuesToPass`

- The `valuesToPass` field from `syntax` is split into individual components (comma-separated). Each component is processed to determine its type (`eType`) and index:

  a. If the value starts with `FC:`
  - It is matched against the `foreignCallNameToID` array.
  - If a match is found, the `eType` is set to `1`, and the `index` is set to the corresponding `id`.

  ```typescript
  if ('FC:' + fcMap.name.trim() == encodedIndex.trim()) {
    return { eType: 1, index: fcMap.id }
  }
  ```

  b. If the value starts with `TR:`
  - It is matched against the `indexMap` array.
  - If a match is found:
  - If `type == 1`, `eType` is set to `4`.
  - Otherwise, `eType` is set to `2`.

  ```typescript
  if ('TR:' + trMap.name.trim() == encodedIndex.trim()) {
    if (trMap.type == 1) {
      return { eType: 4, index: trMap.id }
    } else {
      return { eType: 2, index: trMap.id }
    }
  }
  ```

  c. If the value matches a function argument
  - It is matched against the `functionArguments` array.
  - If a match is found, `eType` is set to `0`, and the `index` is set to the argument's position.

  ```typescript
  if (functionArg.trim() == encodedIndex.trim()) {
    return { eType: 0, index: iter }
  }
  ```

The result is stored in the encodedIndices array.

2. Map Tracker Key Indices

- If `mappedTrackerKeyValues` is not empty, it is processed similarly to `valuesToPass`:
  - Split into components.
  - Determine `eType` and `index` using the same logic as above.
  - Store the result in the `mappedTrackerKeyIndices` array.

  ```typescript
  mappedTrackerKeyIndices = syntax.mappedTrackerKeyValues.split(',').map((encodedIndex: string) => {
    // Same logic as `valuesToPass`
  }) as ForeignCallEncodedIndex[]
  ```

3. Determine Return Type

- The `returnType` is determined by finding the index of `syntax.returnType` in the `PType` array.
  ```typescript
  const returnType: number = PType.indexOf(syntax.returnType)
  ```

4. Extract Parameter Types

- The `function` field from `syntax` is split into individual input types using `splitFunctionInput`. Each input type is mapped to its enumeration using `determinePTEnumeration`.
  ```typescript
  var parameterTypes: number[] = splitFunctionInput(syntax.function).map((val) => determinePTEnumeration(val))
  ```

5. Return the Foreign Call Definition

- Finally, the function returns a `ForeignCallDefinition` object containing:
  - All fields from `syntax`.
  - The computed `returnType`.
  - The extracted `parameterTypes`.
  - The `encodedIndices` and `mappedTrackerKeyIndices`.

  ```typescript
  return {
    ...syntax,
    returnType,
    parameterTypes,
    encodedIndices,
    mappedTrackerKeyIndices,
  }
  ```

#### Parse Calling Function

1. Split `encodedValues`

- The `encodedValues` string from the `syntax` object is split into an array of strings using `", "` as the delimiter. This creates an array of individual encoded value entries.

  ```typescript
  var initialSplit = syntax.encodedValues.split(', ')
  ```

2. Extract Variable Names

- For each entry in the `initialSplit` array:
  - The entry is trimmed of any leading or trailing whitespace.
  - It is further split by spaces (`" "`), and the second part (index `1`) is extracted as the variable name.
  - The extracted variable name is added to the `variableNames` array.

  ```typescript
  for (var ind of initialSplit) {
    var variable = ind.trim().split(' ')[1]
    variableNames.push(variable)
  }
  ```

3. Return the Result

- The function returns the `variableNames` array, which contains all the extracted variable names.

  ```typescript
  return variableNames
  ```

#### Buid Foreign Call List

1. Define Regular Expression

- A regular expression (`fcRegex`) is defined to match all foreign call (FC) expressions in the format `FC:<name>`. The pattern ensures:
  - `FC:` is followed by one or more alphanumeric characters (`[a-zA-Z]+`).
  - It captures the entire FC expression until the next whitespace or invalid character.

  ```typescript
  const fcRegex = /FC:[a-zA-Z]+[^\s]+/g
  ```

2. Match All FC Expressions

- The `condition.matchAll(fcRegex)` method is used to find all matches of the `fcRegex` in the `condition` string. This returns an iterator of matches.

  ```typescript
  const matches = condition.matchAll(fcRegex)
  ```

3. Extract FC Names

- For each match in the iterator:
  - The full FC expression (e.g., FC:`callName`) is accessed using `match[0]`.
  - The name part (e.g., `callName`) is extracted by splitting the expression on `":"` and taking the second part (`split(":")[1]`).
  - The extracted name is added to the `names` array.

  ```typescript
  for (const match of matches) {
    const fullFcExpr = match[0]
    var name = fullFcExpr.split(':')[1]
    names.push(name)
  }
  ```

4. Return the Result

- The function returns the `names` array, which contains all the extracted FC names.

  ```typescript
  return names
  ```

#### Build Tracker List

1. 1. Define Regular Expressions

- Two regular expressions are defined:
  - `trRegex` matches tracker expressions in the format `TR:<name>`.
  - `truRegex` matches tracker expressions in the format `TRU:<name>`.

  ```typescript
  const trRegex = /TR:[a-zA-Z]+/g
  const truRegex = /TRU:[a-zA-Z]+/g
  ```

2. Match TR Expressions

- The `condition.match(trRegex)` method is used to find all matches of `trRegex` in the `condition` string. If matches are found:
  - Each match is processed to remove the `TR:` prefix using `replace("TR:", "")`.
  - The extracted name is added to the `names` array.

  ```typescript
  var matches = condition.match(trRegex)
  var names: string[] = []
  if (matches != null) {
    for (const match of matches) {
      const fullTRExpr = match
      var name = fullTRExpr.replace('TR:', '')
      names.push(name)
    }
  }
  ```

3. Match TRU Expressions

- The `condition.match(truRegex)` method is used to find all matches of `truRegex` in the `condition` string. If matches are found:
  - Each match is processed to remove the `TRU:` prefix using `replace("TRU:", "")`.
  - The extracted name is added to the `names` array.

  ```typescript
  matches = condition.match(truRegex)
  if (matches != null) {
    for (const match of matches) {
      const fullTRExpr = match
      var name = fullTRExpr.replace('TRU:', '')
      names.push(name)
    }
  }
  ```

4. Return the Result

- The function returns the `names` array, which contains all the extracted tracker names from both `TR` and `TRU` expressions.

  ```typescript
  return names
  ```

#### Clean Instruction Set

1. Input: Array of Instructions

- The function takes an array of instructions (`instructionSet`) as input. Each element in the array is processed individually.

  ```typescript
  function cleanInstructionSet(instructionSet: any[]): any[] {
  ```

2. Map Instructions to Numeric Codes

- The map method is used to iterate over each instruction in the array. For each instruction:
  - A series of if-else conditions checks if the instruction matches a predefined string.
  - If a match is found, the corresponding numeric code is returned.
  - If no match is found, the instruction is returned unchanged.

Mapping Logic:

| Instruction | Numeric Code |
| ----------- | ------------ |
| `N`         | `0`          |
| `NOT`       | `1`          |
| `PLH`       | `2`          |
| `=`         | `3`          |
| `PLHM`      | `4`          |
| `+`         | `5`          |
| `-`         | `6`          |
| `*`         | `7`          |
| `/`         | `8`          |
| `<`         | `9`          |
| `>`         | `10`         |
| `==`        | `11`         |
| `AND`       | `12`         |
| `OR`        | `13`         |
| `>=`        | `14`         |
| `<=`        | `15`         |
| `!=`        | `16`         |
| `TRU`       | `17`         |
| `TRUM`      | `18`         |

3. Return the Processed Array

- The function returns a new array where each instruction has been replaced by its numeric code (if matched) or remains unchanged (if no match).

### Internal Parsing Logic

#### Convert Human Readable To Instruction Set

1. Replace Logical Operators with Placeholders

- Logical operators (`AND`, `OR`, `NOT`) are replaced with placeholders (`PLA0`, `PLA1`, etc.) to simplify parsing.
- The function splits the input `syntax` string by whitespace and iterates over each word.
- If a word matches `AND`, `OR`, or `NOT`:
  - It is added to the `originalDelimiters` array.
  - It is replaced in the `syntax` string with a placeholder (`PLA` + index).
- Example:
  ```typescript
  Input: 'A AND B OR C'
  Output: 'A PLA0 B PLA1 C'
  ```

2. Create Initial Abstract Syntax Tree (AST)

- The modified `syntax` string is passed to `convertToTree`, which splits it into a tree structure based on the placeholders (`PLA`).
- If the resulting tree has:
  - One element: The tree is flattened to a single array.
  - No elements: The original `syntax` string is added as a single node.
- Example:
  ```typescript
  Input: 'A PLA0 B PLA1 C'
  Output: ['A', 'PLA0', 'B', 'PLA1', 'C']
  ```

3. Recursive Parsing of the AST

- The function iterates over a predefined `matchArray` (likely containing operators like `AND`, `OR`, `NOT`) to further split the AST.
- Logical operators are replaced with placeholders (`PLA`) during this process.
- The `iterate` function is called recursively to refine the tree structure.

4. Post-Processing the AST

- The resulting AST is processed to:
  - Remove unnecessary array wrappers using `removeArrayWrappers`.
  - Convert string values to integers using `intify`.

  ```typescript
  function removeArrayWrappers(ast: any[]): any[] {
    // Implementation to remove unnecessary array wrappers
  }

  function intify(value: string): number {
    // Implementation to convert string to integer
    return parseInt(value, 10)
  }
  ```

5. Convert AST to Instruction Set

- The processed AST is passed to `convertASTToInstructionSet`, which generates the final instruction set. The `astAccumulator` object is used to store:
  - `instructionSet`: The final output.
  - `mem`: Temporary memory for intermediate values.
  - `iterator`: Tracks the current position in the AST.

  ```typescript
  function convertASTToInstructionSet(ast: any[]): { instructionSet: any[]; mem: any[]; iterator: number } {
    const astAccumulator = {
      instructionSet: [],
      mem: [],
      iterator: 0,
    }
    // Implementation to convert AST to instruction set
    return astAccumulator
  }
  ```

6. Restore Original Logical Operators

- The placeholders (`PLA0`, `PLA1`, etc.) in the `instructionSet` are replaced with their corresponding logical operators (`AND`, `OR`, `NOT`) from the `originalDelimiters` array.

7. Return the Instruction Set

- The final `instructionSet` is returned as the output.

Replace AND, OR, NOT with placeholders (PLA).
Create an initial AST by splitting on placeholders.
Recursively parse the AST to refine its structure.
Post-process the AST to remove wrappers and convert values.
Convert the AST into an instruction set.
Replace placeholders with original logical operators.
Return the final instruction set.

##### Convert AST To Instruction Set

1. **Base Case Check:**
   - The function checks the type of the first element in the expression array:
     - If it's a `string`, it processes it as an operator or placeholder.
     - If it's a `number` or `bigint`, it adds it to the instruction set.
     - If it's a `nested array`, it recursively processes the nested array.

2. **Processing Strings:**
   - If the first element is a `string`:
     1. **Split and Search Expressions:**
        - If the string contains `" | "`, it splits the string into multiple search expressions.
        - Otherwise, it uses the string as-is.
     2. **Match Against Parameters:**
        - Iterates through `parameterNames` to find a match for the current expression.
        - If a match is found:
          - **Placeholders:**
            - Checks if the expression matches a placeholder (`placeHolders`).
            - Adds appropriate instructions (`PLH` or `PLHM`) based on the placeholder type.
          - **Foreign Calls:**
            - If the parameter is a foreign call, it adds instructions for the foreign call.
          - **Tracker Updates:**
            - If the expression is a tracker update (`TRU:`), it processes the tracker and adds instructions.
        - If no match is found, it checks for specific operators or tracker updates and adds corresponding instructions.
     3. **Recursive Call:**
        - After processing the current string, it slices the expression array and recursively calls `convertASTToInstructionSet`.

3. **Processing Numbers:**
   - If the first element is a `number` or `bigint`:
     - Adds the number to the instruction set as `N`.
     - Updates the memory map (`acc.mem`) and increments the iterator.
     - Recursively processes the remaining expression.

4. **Processing Nested Arrays:**
   - If the first element is an `array`:
     - Recursively processes the nested array.
     - Processes the remaining expression after slicing the nested array.

5. **Default Case:**
   - If no match is found for the current expression:
     - Adds a default instruction (`N`) with the current string.
     - Recursively processes the remaining expression.

6. **Return:**
   - Returns the updated `ASTAccumulator` (`acc`) containing the generated instruction set.
