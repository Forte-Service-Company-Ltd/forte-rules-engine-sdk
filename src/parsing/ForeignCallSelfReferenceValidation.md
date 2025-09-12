# Foreign Call Self-Reference Prevention

## Overview

This document describes the validation mechanism implemented to prevent foreign calls from referencing themselves, which would create infinite loops and cause system failures.

## Problem Statement

Foreign calls in the Rules Engine can reference other foreign calls using the `FC:` prefix notation. However, if a foreign call references itself (either directly or indirectly), it creates an infinite loop that would:

1. **Cause Stack Overflow**: Recursive calls without termination
2. **System Failure**: Hang or crash the entire rules engine
3. **Gas Exhaustion**: In blockchain contexts, infinite loops consume all available gas
4. **Unpredictable Behavior**: Makes the system unreliable and unstable

## Implementation

### Validation Logic

The self-reference validation is implemented in `src/parsing/parser.ts` within the `parseForeignCallDefinition` function:

```typescript
// Validate that the foreign call doesn't reference itself
const selfReferences = syntax.valuesToPass
  .split(',')
  .map(val => val.trim())
  .filter(val => val.startsWith('FC:'))
  .map(val => val.substring(3).trim())
  .filter(fcName => fcName === syntax.name)

if (selfReferences.length > 0) {
  throw new Error(
    `Foreign call "${syntax.name}" cannot reference itself in valuesToPass. ` +
    `Self-referential foreign calls are not allowed as they would create infinite loops.`
  )
}

// Also check mapped tracker key values for self-references
if (syntax.mappedTrackerKeyValues && syntax.mappedTrackerKeyValues.trim() !== '') {
  const mappedSelfReferences = syntax.mappedTrackerKeyValues
    .split(',')
    .map(val => val.trim())
    .filter(val => val.startsWith('FC:'))
    .map(val => val.substring(3).trim())
    .filter(fcName => fcName === syntax.name)
  
  if (mappedSelfReferences.length > 0) {
    throw new Error(
      `Foreign call "${syntax.name}" cannot reference itself in mappedTrackerKeyValues. ` +
      `Self-referential foreign calls are not allowed as they would create infinite loops.`
    )
  }
}
```

### Validation Points

The validation checks for self-references in two key areas:

1. **`valuesToPass`**: Parameters passed to the foreign call function
2. **`mappedTrackerKeyValues`**: Values used for tracker key mapping

### Detection Algorithm

1. **Parse Value Lists**: Split comma-separated values in both fields
2. **Identify Foreign Call References**: Filter for values starting with `FC:`
3. **Extract Referenced Names**: Remove the `FC:` prefix to get the referenced foreign call name
4. **Compare with Self**: Check if any referenced name matches the current foreign call's name
5. **Throw Error**: If self-reference detected, throw descriptive error message

## Examples

### ❌ Invalid: Self-Reference in valuesToPass

```json
{
  "name": "SelfReferencingCall",
  "address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
  "function": "SelfReferencingCall(uint256)",
  "returnType": "uint256",
  "valuesToPass": "FC:SelfReferencingCall",  // ❌ References itself
  "mappedTrackerKeyValues": "",
  "callingFunction": "transfer(address to, uint256 value)"
}
```

**Error**: `Foreign call "SelfReferencingCall" cannot reference itself in valuesToPass. Self-referential foreign calls are not allowed as they would create infinite loops.`

### ❌ Invalid: Self-Reference in mappedTrackerKeyValues

```json
{
  "name": "SelfReferencingCall",
  "address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
  "function": "SelfReferencingCall(uint256)",
  "returnType": "uint256",
  "valuesToPass": "to",
  "mappedTrackerKeyValues": "FC:SelfReferencingCall",  // ❌ References itself
  "callingFunction": "transfer(address to, uint256 value)"
}
```

**Error**: `Foreign call "SelfReferencingCall" cannot reference itself in mappedTrackerKeyValues. Self-referential foreign calls are not allowed as they would create infinite loops.`

### ✅ Valid: Reference to Different Foreign Call

```json
{
  "name": "ValidCall",
  "address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
  "function": "ValidCall(uint256)",
  "returnType": "uint256",
  "valuesToPass": "FC:AnotherCall",  // ✅ References different foreign call
  "mappedTrackerKeyValues": "",
  "callingFunction": "transfer(address to, uint256 value)"
}
```

## Test Coverage

The validation is thoroughly tested in `tests/parser.test.ts` with the following test cases:

1. **Self-reference in valuesToPass**: Verifies error is thrown when foreign call references itself in valuesToPass
2. **Self-reference in mappedTrackerKeyValues**: Verifies error is thrown when foreign call references itself in mappedTrackerKeyValues  
3. **Valid foreign call references**: Ensures legitimate cross-references between different foreign calls work correctly

## Future Considerations

### Indirect Circular References

The current implementation only prevents direct self-references (A → A). Future enhancements could detect indirect circular references:

- **A → B → A**: Two foreign calls referencing each other
- **A → B → C → A**: Longer circular chains

### Implementation Approach for Indirect Detection

```typescript
function detectCircularReferences(foreignCalls: ForeignCallDefinition[], startingCall: string, visited: Set<string> = new Set()): boolean {
  if (visited.has(startingCall)) {
    return true; // Circular reference detected
  }
  
  visited.add(startingCall);
  
  const currentCall = foreignCalls.find(fc => fc.name === startingCall);
  if (!currentCall) return false;
  
  // Check all FC: references in this foreign call
  const references = extractForeignCallReferences(currentCall);
  
  for (const ref of references) {
    if (detectCircularReferences(foreignCalls, ref, new Set(visited))) {
      return true;
    }
  }
  
  return false;
}
```

## Error Handling

When self-reference validation fails:

1. **Immediate Failure**: Policy creation stops immediately
2. **Descriptive Error**: Clear error message indicates the problem and foreign call name
3. **Developer Guidance**: Error message explains why self-references are prohibited
4. **Recovery**: Developer must modify the foreign call definition to remove self-reference

## Best Practices

1. **Design Foreign Calls**: Plan foreign call dependencies before implementation
2. **Use Parameter References**: Prefer parameter names over foreign call references when possible
3. **Validate Early**: Test foreign call definitions during development
4. **Document Dependencies**: Maintain clear documentation of foreign call relationships

## Related Files

- **Implementation**: `src/parsing/parser.ts` - Core validation logic
- **Tests**: `tests/parser.test.ts` - Comprehensive test coverage
- **Type Definitions**: `src/modules/types.ts` - Foreign call type definitions
- **Policy Creation**: `src/modules/policy.ts` - Integration with policy creation workflow
