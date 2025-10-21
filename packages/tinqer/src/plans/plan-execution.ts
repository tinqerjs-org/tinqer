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

import { UpdatePlanHandleInitial } from "./update-plan.js";

import { InsertPlanHandleInitial } from "./insert-plan.js";

import { DeletePlanHandleInitial } from "./delete-plan.js";

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

/**
 * Execute a select plan (placeholder - will be implemented with adapter integration)
 */
export async function executeSelectPlan<TResult>(
  _db: unknown,
  _plan: SelectPlanHandle<unknown, unknown> | SelectTerminalHandle<unknown, unknown>,
  _params: unknown,
): Promise<TResult | TResult[]> {
  throw new Error("executeSelectPlan not yet implemented - coming with adapter refactor");
}

/**
 * Execute an update plan (placeholder)
 */
export async function executeUpdatePlan(
  _db: unknown,
  _plan: UpdatePlanHandleInitial<unknown, unknown>,
  _params: unknown,
): Promise<void> {
  throw new Error("executeUpdatePlan not yet implemented - coming with adapter refactor");
}

/**
 * Execute an insert plan (placeholder)
 */
export async function executeInsertPlan<TResult>(
  _db: unknown,
  _plan: InsertPlanHandleInitial<unknown, unknown>,
  _params: unknown,
): Promise<TResult | void> {
  throw new Error("executeInsertPlan not yet implemented - coming with adapter refactor");
}

/**
 * Execute a delete plan (placeholder)
 */
export async function executeDeletePlan(
  _db: unknown,
  _plan: DeletePlanHandleInitial<unknown, unknown>,
  _params: unknown,
): Promise<void> {
  throw new Error("executeDeletePlan not yet implemented - coming with adapter refactor");
}
