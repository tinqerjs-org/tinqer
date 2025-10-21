/**
 * Thin wrapper helpers for adapter layer
 * These delegate to the define* functions without re-parsing
 * Main purpose: Hide generics from adapter layer
 */

import type { DatabaseSchema } from "../linq/database-context.js";
import type { QueryBuilder } from "../linq/query-builder.js";
import type { QueryHelpers } from "../linq/functions.js";
import type { Queryable } from "../linq/queryable.js";
import type { OrderedQueryable } from "../linq/queryable.js";
import type { TerminalQuery } from "../linq/terminal-query.js";
import type { ParseQueryOptions } from "../parser/types.js";
import type { QueryOperation } from "../query-tree/operations.js";

import { defineSelect, SelectPlanHandle, SelectTerminalHandle } from "./select-plan.js";

// Type for any query result
type SelectResult = Queryable<unknown> | OrderedQueryable<unknown> | TerminalQuery<unknown>;

/**
 * Create a select plan from a builder function
 * Thin wrapper that delegates to defineSelect
 */
export function createSelectPlan<TSchema>(
  schema: DatabaseSchema<TSchema>,
  builder: (
    queryBuilder: QueryBuilder<TSchema>,
    params?: unknown,
    helpers?: QueryHelpers,
  ) => SelectResult,
  options?: ParseQueryOptions,
): SelectPlanHandle<unknown, unknown> | SelectTerminalHandle<unknown, unknown> {
  // Just delegate to defineSelect - no re-parsing!
  return defineSelect(schema, builder, options);
}

/**
 * Helper that combines plan.finalize() + generateSql()
 * This is what adapters will use to get SQL strings
 */
export function planToSqlString(
  plan: {
    finalize(params: unknown): { operation: QueryOperation; params: Record<string, unknown> };
  },
  params: unknown,
  generateSqlFn: (op: QueryOperation, params: Record<string, unknown>) => string,
): { sql: string; params: Record<string, unknown> } {
  // Step 1: Get operation and merged params from plan
  const { operation, params: mergedParams } = plan.finalize(params);

  // Step 2: Use existing generator to create SQL string
  const sql = generateSqlFn(operation, mergedParams);

  return { sql, params: mergedParams };
}

/**
 * Check if a plan is a terminal handle
 */
export function isTerminalHandle(
  plan: SelectPlanHandle<unknown, unknown> | SelectTerminalHandle<unknown, unknown>,
): plan is SelectTerminalHandle<unknown, unknown> {
  return plan instanceof SelectTerminalHandle;
}

