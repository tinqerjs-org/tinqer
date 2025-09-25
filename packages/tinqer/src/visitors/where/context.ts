/**
 * WHERE-specific context
 * Manages state for WHERE clause parsing
 */

/**
 * Result type for visitors that need to return a value and updated counter
 */
export type VisitorResult<T> = {
  value: T;
  counter: number;
};

export interface WhereContext {
  // Parameters from table (x in where(x => ...))
  tableParams: Set<string>;

  // External query parameters (p in (p) => ...)
  queryParams: Set<string>;

  // Auto-generated parameters for literals
  autoParams: Map<string, unknown>;
  autoParamCounter: number;
  autoParamInfos?: Map<
    string,
    { value: unknown; fieldName?: string; tableName?: string; sourceTable?: number }
  >;

  // Current table being queried
  currentTable?: string;

  // JOIN result shape tracking
  currentResultShape?: unknown; // ResultShape from JOIN
  joinResultParam?: string; // Parameter name representing JOIN result
}

/**
 * Create a WHERE parsing context
 */
export function createWhereContext(
  tableParams: Set<string>,
  queryParams: Set<string>,
  startCounter: number = 0,
): WhereContext {
  return {
    tableParams: new Set(tableParams),
    queryParams: new Set(queryParams),
    autoParams: new Map(),
    autoParamCounter: startCounter,
  };
}

// Note: createAutoParam has been removed in favor of immutable counter handling
// Parameters are now created directly in visitValue with counter returned
