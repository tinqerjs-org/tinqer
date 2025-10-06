/**
 * Entry point for creating queries
 */

import { Queryable } from "./queryable.js";
import type { DatabaseSchema } from "./database-context.js";

/**
 * Creates a new Queryable from a table name with explicit type
 * @param tableName The name of the table to query
 * @returns A new Queryable instance
 */
export function from<T>(tableName: string): Queryable<T>;

/**
 * Creates a new Queryable from a typed database context
 * @param context The database context with schema information
 * @param tableName The name of the table to query (type-safe)
 * @returns A new Queryable instance with inferred types
 */
export function from<TSchema, K extends keyof TSchema & string>(
  context: DatabaseSchema<TSchema>,
  tableName: K,
): Queryable<TSchema[K]>;

// Implementation
export function from(_contextOrTable: unknown, _tableName?: unknown): Queryable<unknown> {
  // Runtime doesn't need to differentiate - just return a Queryable
  // Types are enforced at compile time through the overloads
  return new Queryable();
}
