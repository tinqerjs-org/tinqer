/**
 * Case-insensitive helper functions for Tinqer queries
 *
 * These functions are available via the second parameter in query lambdas:
 * (params, helpers) => helpers.functions.iequals(a, b)
 */

/**
 * Case-insensitive equality comparison
 */
export function iequals<T>(_a: T, _b: T): boolean {
  throw new Error(
    "This function should not be executed at runtime. It's parsed for SQL generation.",
  );
}

/**
 * Case-insensitive string starts with
 */
export function istartsWith(_str: string, _prefix: string): boolean {
  throw new Error(
    "This function should not be executed at runtime. It's parsed for SQL generation.",
  );
}

/**
 * Case-insensitive string ends with
 */
export function iendsWith(_str: string, _suffix: string): boolean {
  throw new Error(
    "This function should not be executed at runtime. It's parsed for SQL generation.",
  );
}

/**
 * Case-insensitive string contains
 */
export function icontains(_str: string, _substring: string): boolean {
  throw new Error(
    "This function should not be executed at runtime. It's parsed for SQL generation.",
  );
}

/**
 * Collection of case-insensitive functions
 */
export const functions = {
  iequals,
  istartsWith,
  iendsWith,
  icontains,
} as const;

/**
 * Helper object provided as second parameter to query lambdas
 */
export interface QueryHelpers {
  functions: typeof functions;
}

/**
 * Create the helpers object for query execution
 */
export function createQueryHelpers(): QueryHelpers {
  return {
    functions,
  };
}
