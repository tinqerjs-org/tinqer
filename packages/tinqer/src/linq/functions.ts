/**
 * Case-insensitive helper functions and window function builders for Tinqer queries
 *
 * These functions are available via the second parameter in query lambdas:
 * (params, helpers) => helpers.functions.iequals(a, b)
 * (params, helpers) => helpers.window.partitionBy(...).orderBy(...).rowNumber()
 */

// ==================== Window Function Builders ====================

/**
 * Hidden marker symbol to identify window function builders
 */
export const WINDOW_MARKER = Symbol("window");

/**
 * Window function type
 */
export type WindowFunctionType = "rowNumber" | "rank" | "denseRank";

/**
 * Order specification for window functions
 */
export interface WindowOrderSpec<T> {
  selector: (row: T) => unknown;
  direction: "asc" | "desc";
}

/**
 * Window builder - initial state
 * Can add partitionBy or start with orderBy
 */
export class WindowBuilder<T> {
  readonly __windowMarker = WINDOW_MARKER;

  constructor(public readonly partitionBySelectors: Array<(row: T) => unknown> = []) {}

  partitionBy(...selectors: Array<(row: T) => unknown>): WindowBuilderWithPartition<T> {
    return new WindowBuilderWithPartition<T>([...this.partitionBySelectors, ...selectors]);
  }

  orderBy(selector: (row: T) => unknown): WindowBuilderWithOrder<T> {
    return new WindowBuilderWithOrder<T>(this.partitionBySelectors, [
      { selector, direction: "asc" },
    ]);
  }

  orderByDescending(selector: (row: T) => unknown): WindowBuilderWithOrder<T> {
    return new WindowBuilderWithOrder<T>(this.partitionBySelectors, [
      { selector, direction: "desc" },
    ]);
  }
}

/**
 * Window builder with partition - can add more partitions or move to orderBy
 */
export class WindowBuilderWithPartition<T> {
  readonly __windowMarker = WINDOW_MARKER;

  constructor(public readonly partitionBySelectors: Array<(row: T) => unknown>) {}

  partitionBy(...selectors: Array<(row: T) => unknown>): WindowBuilderWithPartition<T> {
    return new WindowBuilderWithPartition<T>([...this.partitionBySelectors, ...selectors]);
  }

  orderBy(selector: (row: T) => unknown): WindowBuilderWithOrder<T> {
    return new WindowBuilderWithOrder<T>(this.partitionBySelectors, [
      { selector, direction: "asc" },
    ]);
  }

  orderByDescending(selector: (row: T) => unknown): WindowBuilderWithOrder<T> {
    return new WindowBuilderWithOrder<T>(this.partitionBySelectors, [
      { selector, direction: "desc" },
    ]);
  }
}

/**
 * Window builder with order - can add more orderings or call terminal function
 */
export class WindowBuilderWithOrder<T> {
  readonly __windowMarker = WINDOW_MARKER;

  constructor(
    public readonly partitionBySelectors: Array<(row: T) => unknown>,
    public readonly orderBySpecs: Array<WindowOrderSpec<T>>,
  ) {}

  thenBy(selector: (row: T) => unknown): WindowBuilderWithOrder<T> {
    return new WindowBuilderWithOrder<T>(this.partitionBySelectors, [
      ...this.orderBySpecs,
      { selector, direction: "asc" },
    ]);
  }

  thenByDescending(selector: (row: T) => unknown): WindowBuilderWithOrder<T> {
    return new WindowBuilderWithOrder<T>(this.partitionBySelectors, [
      ...this.orderBySpecs,
      { selector, direction: "desc" },
    ]);
  }

  // Terminal operations - these return number!
  // They are never executed at runtime - only parsed by the visitor
  rowNumber(): number {
    throw new Error("Window functions are parsed for SQL generation, not executed at runtime.");
  }

  rank(): number {
    throw new Error("Window functions are parsed for SQL generation, not executed at runtime.");
  }

  denseRank(): number {
    throw new Error("Window functions are parsed for SQL generation, not executed at runtime.");
  }
}

// ==================== Case-Insensitive Functions ====================

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
  window<T>(row: T): WindowBuilder<T>;
}

/**
 * Create the helpers object for query execution
 */
export function createQueryHelpers(): QueryHelpers {
  return {
    functions,
    window<T>(_row: T): WindowBuilder<T> {
      return new WindowBuilder<T>();
    },
  };
}
