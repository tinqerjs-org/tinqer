/**
 * SELECT-specific context
 * Manages state for SELECT projection parsing
 */

export interface SelectContext {
  // Parameters from table (x in select(x => ...))
  tableParams: Set<string>;

  // External query parameters (p in (p) => ...)
  queryParams: Set<string>;

  // Auto-generated parameters for literals
  autoParams: Map<string, unknown>;
  autoParamCounter: number;

  // SELECT-specific flags
  inProjection: boolean;
  hasTableParam: boolean;

  // Current table being queried
  currentTable?: string;
}

/**
 * Create a SELECT parsing context
 */
export function createSelectContext(
  tableParams: Set<string>,
  queryParams: Set<string>
): SelectContext {
  return {
    tableParams: new Set(tableParams),
    queryParams: new Set(queryParams),
    autoParams: new Map(),
    autoParamCounter: 0,
    inProjection: false,
    hasTableParam: false,
  };
}

/**
 * Generate auto-parameter name for literal values
 */
export function createAutoParam(
  context: SelectContext,
  value: unknown
): string {
  context.autoParamCounter++;
  const paramName = `__p${context.autoParamCounter}`;
  context.autoParams.set(paramName, value);
  return paramName;
}