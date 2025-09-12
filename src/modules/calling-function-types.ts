/// SPDX-License-Identifier: BUSL-1.1

/**
 * @file calling-function-types.ts
 * @description Shared types and utilities for calling function resolution to avoid circular dependencies
 * @author @mpetersoCode55, @ShaneDuncan602, @TJ-Everett, @VoR0220
 * @license BUSL-1.1
 */

// Re-export the CallingFunctionJSON interface to avoid circular imports
export interface CallingFunctionJSON {
  name: string
  functionSignature: string
  encodedValues: string
}

/**
 * Creates lookup maps for efficient calling function resolution.
 * This utility function creates the necessary Map structures for O(1) lookups.
 * 
 * @param callingFunctions - Array of calling function definitions
 * @returns Object containing the three lookup maps
 */
export const createCallingFunctionLookupMaps = (callingFunctions: CallingFunctionJSON[]) => {
  const callingFunctionByName = new Map<string, CallingFunctionJSON>()
  const callingFunctionBySignature = new Map<string, CallingFunctionJSON>()
  const callingFunctionByNameLower = new Map<string, CallingFunctionJSON>()
  
  // Pre-populate lookup maps for efficient resolution using reduce
  callingFunctions.reduce((maps, cf) => {
    maps.byName.set(cf.name, cf)
    maps.byNameLower.set(cf.name.toLowerCase(), cf)
    if (cf.functionSignature && cf.functionSignature !== cf.name) {
      maps.bySignature.set(cf.functionSignature, cf)
    }
    return maps
  }, {
    byName: callingFunctionByName,
    byNameLower: callingFunctionByNameLower,
    bySignature: callingFunctionBySignature
  })

  return { callingFunctionByName, callingFunctionBySignature, callingFunctionByNameLower }
}

/**
 * Resolves calling function name to full signature using lookup maps.
 * Supports backward compatibility by accepting both name-only references and full signatures.
 * Uses O(1) Map lookups for optimal performance.
 * 
 * @param callingFunctionRef - Either a short name or full function signature
 * @param lookupMaps - The pre-built lookup maps for efficient resolution
 * @returns The resolved function signature or the original reference if not found
 */
export const resolveCallingFunction = (
  callingFunctionRef: string,
  lookupMaps: {
    callingFunctionByName: Map<string, CallingFunctionJSON>
    callingFunctionBySignature: Map<string, CallingFunctionJSON>
    callingFunctionByNameLower: Map<string, CallingFunctionJSON>
  }
): string => {
  const { callingFunctionByName, callingFunctionBySignature, callingFunctionByNameLower } = lookupMaps
  
  // First check if it's already a full signature (contains parentheses)
  if (callingFunctionRef.includes('(')) {
    return callingFunctionRef
  }
  
  // Try to find by name field (exact match) - O(1)
  const foundByName = callingFunctionByName.get(callingFunctionRef)
  if (foundByName) {
    return foundByName.functionSignature || foundByName.name
  }
  
  // Try case-insensitive name match - O(1)
  const foundByNameIgnoreCase = callingFunctionByNameLower.get(callingFunctionRef.toLowerCase())
  if (foundByNameIgnoreCase) {
    return foundByNameIgnoreCase.functionSignature || foundByNameIgnoreCase.name
  }
  
  // Try to find by functionSignature field - O(1)
  const foundBySignature = callingFunctionBySignature.get(callingFunctionRef)
  if (foundBySignature) {
    return foundBySignature.functionSignature || foundBySignature.name
  }
  
  // Return as-is if not found (will be validated elsewhere)
  return callingFunctionRef
}
