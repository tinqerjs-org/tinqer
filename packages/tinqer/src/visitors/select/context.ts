/**
 * SELECT-specific context
 * Manages state for SELECT projection parsing
 */

import type { ObjectShapeNode } from "../../query-tree/operations.js";

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

  // GROUP BY context
  isGroupedSource: boolean;
  groupingParams: Set<string>;
  groupKeyExpression?: unknown; // Expression from GROUP BY keySelector

  // JOIN context
  joinResultParam?: string; // JOIN result parameter name
  currentResultShape?: ObjectShapeNode; // Shape of JOIN result
  joinParams?: Map<string, number>; // JOIN parameter -> table index mapping
}

/**
 * Create a SELECT parsing context
 */
export function createSelectContext(
  tableParams: Set<string>,
  queryParams: Set<string>,
  startCounter: number = 0,
): SelectContext {
  return {
    tableParams: new Set(tableParams),
    queryParams: new Set(queryParams),
    autoParams: new Map(),
    autoParamCounter: startCounter,
    inProjection: false,
    hasTableParam: false,
    isGroupedSource: false,
    groupingParams: new Set(),
  };
}

/**
 * Generate auto-parameter name for literal values
 */
export function createAutoParam(context: SelectContext, value: unknown): string {
  context.autoParamCounter++;
  const paramName = `__p${context.autoParamCounter}`;
  context.autoParams.set(paramName, value);
  return paramName;
}
