## Reverse Parse Instruction Set

## Execution Flow

1. **Initialization:**

- Variables like `currentAction`, `currentMemAddress`, `memAddressesMap`, and others are initialized to track the current state of the parsing process.

2. **Iterating Over Instructions:**

- The function loops through each instruction in the `instructionSet`.

3. **Determining the Current Action:**

- If `currentAction` is `-1`, the current instruction is treated as an action identifier.
- Based on the action identifier, `currentActionIndex` is set to determine how many subsequent instructions are needed to complete the action.

4. **Processing Instructions:**

- Depending on the value of `currentAction`, the function performs specific operations:
  - **Case 0**: Maps memory addresses to values from `stringReplacements` or directly from the instruction.
  - **Case 1**: Performs a "NOT" operation on a value and stores the result.
  - **Case 2**: Maps a placeholder value from `placeHolderArray` to a memory address.
  - **Cases 3–16**: Handles arithmetic and logical operations (e.g., `+`, `-`, `*`, `/`, `AND`, `OR`, etc.) using helper functions like `arithmeticOperatorReverseInterpretation` and `logicalOperatorReverseInterpretation`.
  - **Cases 17–18**: Updates memory values with transformations (e.g., replacing `TR:` with `TRU:`).

5. **Updating Memory and State:**

- After processing an instruction, the function updates `memAddressesMap` with the results and increments `currentMemAddress`.
- If `currentActionIndex` reaches `0`, the current action is reset to `-1`.

6. **Final Adjustments:**

- If the final result (`retVal`) starts with `"("`, it trims the parentheses.

7. **Return Value:**

- The function returns the final string representation (`retVal`) of the processed instruction set.

### Reverse Parse Placeholders

1. **Input Parameters:**
   - `placeholder`: The object containing flags and `typeSpecificIndex` to determine the type of placeholder.
   - `names`: An array of function arguments used for resolving names.
   - `foreignCalls`: An array of foreign call objects used for resolving external function calls.
   - `trackers`: An array of tracker objects (not used in this function).
   - `mappings`: An array of mappings between hex values and function strings.

2. **Flag-Based Resolution:**
   - The function checks the flags property of the placeholder to determine its type and resolve it accordingly.

3. **Case Handling:**
   - **Flag 0x01:**
     - Finds the corresponding foreign call using `typeSpecificIndex`.
     - Matches the foreign call's signature with a mapping to retrieve the function string.
     - Returns the function name prefixed with `"FC:"`.
   - **Flag 0x02:**
     - Finds the corresponding mapping using `typeSpecificIndex`.
     - Returns the function string prefixed with `"TR:"`.
   - **Flag 0x04:**
     - Returns `"GV:MSG_SENDER"`.
   - **Flag 0x08:**
     - Returns `"GV:BLOCK_TIMESTAMP"`.
   - **Flag 0x0c:**
     - Returns `"GV:MSG_DATA"`.
   - **Flag 0x10:**
     - Returns `"GV:BLOCK_NUMBER"`.
   - **Flag 0x14:**
     - Returns `"GV:TX_ORIGIN"`.
   - **Default Case:**
     - Resolves the name from the `names` array using `typeSpecificIndex`.

4. **Return Value:**

- The function returns a string representation of the placeholder based on its type.

### Reverse Parse Effect

Input Parameters:

1. `effect`: An object containing `effectType`, `text`, and optionally `instructionSet`.
2. `placeholders`: An array of placeholder strings used for resolving instruction sets.

Effect Type Handling:

The function checks the `effectType` property of the effect object to determine how to process it.

Case Handling:

1. **Effect Type 0**:
   Returns a string in the format: `revert('<effect.text>')`.
2. **Effect Type 1**:
   Returns a string in the format: `emit <effect.text>`.
3. **Default Case (Other Effect Types)**:
   Calls the `reverseParseInstructionSet` function to process the `instructionSet` property of the effect object, passing `placeholders` and an empty array as arguments.

Return Value:

The function returns a string representation of the effect based on its `effectType`.

### Convert Rule Struct To String

Execution Flow
Input Parameters:

1. `functionString`: A string representing the function signature.
2. `encodedValues`: Encoded values used for decoding placeholders.
3. `ruleS`: The rule structure containing condition and effects.
4. `ruleM`: The rule metadata containing the rule's name and description.
5. `foreignCalls`: An array of foreign call objects for resolving external calls.
6. `trackers`: An array of tracker objects for resolving tracker-related data.
7. `mappings`: An array of mappings between hex values and function strings.

Initialize RuleJSON:

Creates an object `rJSON` with the following properties:

- `Name`: Set to `ruleM.ruleName`.
- `Description`: Set to `ruleM.ruleDescription`.
- `condition`: Initially empty.
- `positiveEffects`: Initially an empty array.
- `negativeEffects`: Initially an empty array.
- `callingFunction`: Initially empty.

Process Rule Condition:

Converts the condition from `ruleS` into a string using `reverseParseInstructionSet` and assigns it to `rJSON.condition`.

Process Positive Effects:

Iterates over `ruleS.positiveEffects`.
Converts each effect into a string using `reverseParseEffect` and appends it to `rJSON.positiveEffects`.

Process Negative Effects:

Iterates over `ruleS.negativeEffects`.
Converts each effect into a string using `reverseParseEffect` and appends it to `rJSON.negativeEffects`.

Set Calling Function:

Extracts the function name from `functionString` and assigns it to `rJSON.callingFunction`.

Return Value:

Returns the fully constructed `rJSON` object.

### Convert Foreign Call Structs To Strings

Execution Flow
Input Parameters:

1. `foreignCallsOnChain`: An array of `ForeignCallOnChain` objects containing metadata about foreign calls.
2. `callingFunctionMappings`: An array of `hexToFunctionString` objects used to map hex signatures to function strings.

Mapping Process:

For each call in `foreignCallsOnChain`:

1. **Find Function Metadata**:
   Searches `callingFunctionMappings` for a mapping where `mapping.hex` matches `call.signature`.
2. **Determine Return Type**:
   Searches `PT` (likely a predefined list of parameter types) for a type where `pType.enumeration` matches `call.returnType` and retrieves its name.
3. **Find Calling Function**:
   Searches `callingFunctionMappings` for a mapping where `mapping.index` matches `call.callingFunctionIndex`.
4. **Construct Input Object**:
   Creates an object with the following properties:
   - `name`: The function string from `functionMeta`, or an empty string if not found.
   - `address`: The `foreignCallAddress` from the call.
   - `function`: The function string from `functionMeta`, or an empty string if not found.
   - `returnType`: The name of the return type, or an empty string if not found.
   - `valuesToPass`: Encoded values from `functionMeta`, or an empty string if not found.
   - `mappedTrackerKeyValues`: (Empty string, placeholder for additional logic).
   - `callingFunction`: The function string from `callingFunction`, or an empty string if not found.

Returns the constructed object.

Return Value:

Returns an array of transformed `ForeignCallJSONReversed` objects.

#### Retrieve Decoded

Execution Flow
Input Parameters:

1. `type`: A number representing the type of the key (e.g., address, string, number, boolean).
2. `key`: A string to be decoded.

Decoding Logic:

1. **Type 0**:
   Decodes the key as an Ethereum address using `decodeAbiParameters` and converts it to lowercase.
2. **Type 1**:
   Decodes the key as a string using `decodeAbiParameters`.
3. **Type 2**:
   Converts the key to a number and then to a string.
4. **Type 3**:
   Converts the key to a boolean string ("false" or "true").
5. **Default Case**:
   Returns the key as-is.

Return Value:

Returns the decoded string based on the type.

### Convert Tracker Structs To Strings

Input Parameters:

1. `trackers`: An array of `TrackerOnChain` objects containing tracker metadata.
2. `trackerNames`: An array of `TrackerMetadataStruct` objects for unmapped trackers.
3. `mappedTrackerNames`: An array of `TrackerMetadataStruct` objects for mapped trackers.

Processing Unmapped Trackers (Trackers):

1. **Filter Unmapped Trackers**:
   Filters trackers where `tracker.mapped` is false.
2. **Map Each Tracker**:
   For each unmapped tracker:
   - **Retrieve Tracker Type**:
     Finds the tracker type name from `PT` using `tracker.pType`.
   - **Decode Initial Value**:
     Decodes the `initialValue` from `trackerNames` using `retrieveDecoded`.
   - **Construct Input Object**:
     Creates an object with:
     - `name`: Tracker name from `trackerNames`.
     - `type`: Tracker type name.
     - `initialValue`: Decoded initial value.
   - **Validate Input**:
     Validates the input object using `validateTrackerJSON`.
     If valid, unwraps and returns the validated object.
     If invalid, throws an error with the validation failure details.

Processing Mapped Trackers (MappedTrackers):

1. **Filter Mapped Trackers**:
   Filters trackers where `tracker.mapped` is true.
2. **Map Each Tracker**:
   For each mapped tracker:
   - **Retrieve Value and Key Types**:
     Finds the value type name from `PT` using `tracker.pType`.
     Finds the key type name from `PT` using `tracker.trackerKeyType`.
   - **Decode Keys**:
     Iterates over `initialKeys` from `mappedTrackerNames` and decodes each key using `retrieveDecoded`.
   - **Decode Values**:
     Iterates over `initialValues` from `mappedTrackerNames` and decodes each value using `retrieveDecoded`.
     Logs each decoded value to the console.
   - **Construct Input Object**:
     Creates an object with:
     - `name`: Tracker name from `mappedTrackerNames`.
     - `valueType`: Decoded value type name.
     - `keyType`: Decoded key type name.
     - `initialKeys`: Array of decoded keys.
     - `initialValues`: Array of decoded values.
   - **Validate Input**:
     Validates the input object using `validateMappedTrackerJSON`.
     If valid, unwraps and returns the validated object.
     If invalid, throws an error with the validation failure details.

Return Value:

Returns an object containing:

- `Trackers`: Array of validated `TrackerJSON` objects.
- `MappedTrackers`: Array of validated `MappedTrackerJSON` objects.

### Convert Calling Functions To Strings

Execution Flow
Input Parameters:

1. `callingFunctions`: An array of `CallingFunctionHashMapping` objects to be validated and converted.

Mapping Process:

For each `callingFunction` in `callingFunctions`:

1. **Validation**:
   Converts the `callingFunction` object to a JSON string using `JSON.stringify`.
   Passes the JSON string to the `validateCallingFunctionJSON` function for validation.
2. **Validation Result**:
   If `isRight(validatedInputs)` returns true:
   Extracts the validated result using `unwrapEither(validatedInputs)` and includes it in the output array.
   If validation fails (`isRight(validatedInputs)` returns false):
   Throws an error with a message containing the invalid input details (`validatedInputs.left`).

Return Value:

Returns an array of validated and converted `CallingFunctionJSON` objects.

### Arithmetic Operator Reverse Interpretation

Execution Flow
Input Parameters:

1. `instruction`: A memory address to look up in `memAddressesMap`.
2. `currentMemAddress`: The memory address where the result of the operation will be stored.
3. `memAddressesMap`: An array of objects mapping memory addresses (`memAddr`) to their values (`value`).
4. `currentActionIndex`: Indicates whether the operation should be performed (1 for execution).
5. `currentInstructionValues`: An array to store the values retrieved from `memAddressesMap` for the operation.
6. `symbol`: The arithmetic operator (e.g., `+`, `-`, `*`, `/`) to use in the operation.

Memory Lookup:

Iterates over `memAddressesMap` to find entries where `memAddr` matches `instruction`.
Pushes the corresponding value into `currentInstructionValues`.

Operation Execution:

If `currentActionIndex` equals 1:
Constructs a string representation of the operation using the first two values in `currentInstructionValues` and the `symbol`.
Adds a new entry to `memAddressesMap` with:

- `memAddr`: The `currentMemAddress`.
- `value`: The constructed string.
  Returns the constructed string.

Default Case:

If `currentActionIndex` is not 1, returns an empty string.

### Logical Operator Reverse Interpretation

Execution Flow
Input Parameters:

1. `instruction`: A memory address to look up in `memAddressesMap`.
2. `currentMemAddress`: The memory address where the result of the operation will be stored.
3. `memAddressesMap`: An array of objects mapping memory addresses (`memAddr`) to their values (`value`).
4. `currentActionIndex`: Indicates whether the operation should be performed (1 for execution).
5. `currentInstructionValues`: An array to store the values retrieved from `memAddressesMap` for the operation.
6. `symbol`: The logical operator (e.g., `&&`, `||`, `!`) to use in the operation.

Memory Lookup:

Iterates over `memAddressesMap` to find entries where `memAddr` matches `instruction`.
Pushes the corresponding value into `currentInstructionValues`.

Operation Execution:

If `currentActionIndex` equals 1:
Constructs a string representation of the logical operation in the format:
`( value1 symbol value2 )`
Adds a new entry to `memAddressesMap` with:

- `memAddr`: The `currentMemAddress`.
- `value`: The constructed string.
  Returns the constructed string.

Default Case:

If `currentActionIndex` is not 1, returns an empty string.
