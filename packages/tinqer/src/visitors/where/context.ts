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
  autoParamInfos?: Map<string, { value: unknown; fieldName?: string; tableName?: string; sourceTable?: number }>;

  // Current table being queried
  currentTable?: string;
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

/**
 * Generate auto-parameter name for literal values
 */
export function createAutoParam(
  context: WhereContext,
  value: unknown,
  options: {
    fieldName?: string;
    tableName?: string;
    sourceTable?: number;
  } = {},
): string {
  context.autoParamCounter++;
  const paramName = `__p${context.autoParamCounter}`;
  context.autoParams.set(paramName, value);

  // Store enhanced field context if available
  if (context.autoParamInfos) {
    context.autoParamInfos.set(paramName, {
      value: value as string | number | boolean | null,
      fieldName: options.fieldName,
      tableName: options.tableName,
      sourceTable: options.sourceTable,
    });
  }

  return paramName;
}
