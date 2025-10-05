/**
 * Entry point for creating UPDATE queries
 */

import { Updatable } from "./updatable.js";
import type { DatabaseContext } from "./database-context.js";

/**
 * Creates a new Updatable from a table name with explicit type
 * @param tableName The name of the table to update
 * @returns A new Updatable instance
 */
export function update<T>(tableName: string): Updatable<T>;

/**
 * Creates a new Updatable from a typed database context
 * @param context The database context with schema information
 * @param tableName The name of the table to update (type-safe)
 * @returns A new Updatable instance with inferred types
 */
export function update<TSchema, K extends keyof TSchema & string>(
  context: DatabaseContext<TSchema>,
  tableName: K,
): Updatable<TSchema[K]>;

// Implementation
export function update(_contextOrTable: unknown, _tableName?: unknown): Updatable<unknown> {
  // Runtime doesn't need to differentiate - just return an Updatable
  // Types are enforced at compile time through the overloads
  return new Updatable();
}
