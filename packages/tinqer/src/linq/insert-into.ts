/**
 * Entry point for creating INSERT queries
 */

import { Insertable } from "./insertable.js";
import type { DatabaseContext } from "./database-context.js";

/* eslint-disable no-redeclare */

/**
 * Creates a new Insertable from a table name with explicit type
 * @param tableName The name of the table to insert into
 * @returns A new Insertable instance
 */
export function insertInto<T>(tableName: string): Insertable<T>;

/**
 * Creates a new Insertable from a typed database context
 * @param context The database context with schema information
 * @param tableName The name of the table to insert into (type-safe)
 * @returns A new Insertable instance with inferred types
 */
export function insertInto<TSchema, K extends keyof TSchema & string>(
  context: DatabaseContext<TSchema>,
  tableName: K,
): Insertable<TSchema[K]>;

// Implementation
export function insertInto(_contextOrTable: unknown, _tableName?: unknown): Insertable<unknown> {
  // Runtime doesn't need to differentiate - just return an Insertable
  // Types are enforced at compile time through the overloads
  return new Insertable();
}
