/**
 * WHERE-specific context
 * Manages state for WHERE clause parsing
 */

export interface WhereContext {
  // Parameters from table (x in where(x => ...))
  tableParams: Set<string>;

  // External query parameters (p in (p) => ...)
  queryParams: Set<string>;

  // Auto-generated parameters for literals
  autoParams: Map<string, unknown>;
  autoParamCounter: number;

  // Current table being queried
  currentTable?: string;
}

/**
 * Create a WHERE parsing context
 */
export function createWhereContext(
  tableParams: Set<string>,
  queryParams: Set<string>,
): WhereContext {
  return {
    tableParams: new Set(tableParams),
    queryParams: new Set(queryParams),
    autoParams: new Map(),
    autoParamCounter: 0,
  };
}

/**
 * Generate auto-parameter name for literal values
 */
export function createAutoParam(context: WhereContext, value: unknown): string {
  context.autoParamCounter++;
  const paramName = `__p${context.autoParamCounter}`;
  context.autoParams.set(paramName, value);
  return paramName;
}
