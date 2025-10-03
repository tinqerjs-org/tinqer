/**
 * Entry point for creating DELETE queries
 */

import { Deletable } from "./deletable.js";
import type { DatabaseContext } from "./database-context.js";

/* eslint-disable no-redeclare */

/**
 * Creates a new Deletable from a table name with explicit type
 * @param tableName The name of the table to delete from
 * @returns A new Deletable instance
 */
export function deleteFrom<T>(tableName: string): Deletable<T>;

/**
 * Creates a new Deletable from a typed database context
 * @param context The database context with schema information
 * @param tableName The name of the table to delete from (type-safe)
 * @returns A new Deletable instance with inferred types
 */
export function deleteFrom<TSchema, K extends keyof TSchema & string>(
  context: DatabaseContext<TSchema>,
  tableName: K,
): Deletable<TSchema[K]>;

// Implementation
export function deleteFrom(_contextOrTable: unknown, _tableName?: unknown): Deletable<unknown> {
  // Runtime doesn't need to differentiate - just return a Deletable
  // Types are enforced at compile time through the overloads
  return new Deletable();
}
