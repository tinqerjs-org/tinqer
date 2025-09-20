/**
 * Entry point for creating queries
 */

import { Queryable } from "./queryable.js";

/**
 * Creates a new Queryable from a table name
 * @param tableName The name of the table to query
 * @returns A new Queryable instance
 */
export function from<T>(_tableName: string): Queryable<T> {
  return new Queryable<T>();
}
