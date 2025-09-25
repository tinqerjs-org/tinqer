/**
 * ORDER BY-specific context
 * Manages state for ORDER BY key selector parsing
 */

export interface OrderByContext {
  // Parameters from table (x in orderBy(x => ...))
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
 * Create an ORDER BY parsing context
 */
export function createOrderByContext(
  tableParams: Set<string>,
  queryParams: Set<string>
): OrderByContext {
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
export function createAutoParam(
  context: OrderByContext,
  value: unknown
): string {
  context.autoParamCounter++;
  const paramName = `__p${context.autoParamCounter}`;
  context.autoParams.set(paramName, value);
  return paramName;
}