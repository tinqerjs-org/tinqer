/**
 * DELETE SQL generation for SQLite (better-sqlite3)
 */

import type { DeleteOperation } from "@webpods/tinqer";
import type { SqlContext } from "../types.js";
import { generateBooleanExpression } from "../expression-generator.js";

/**
 * Generate DELETE SQL statement
 */
export function generateDelete(operation: DeleteOperation, context: SqlContext): string {
  const tableName = operation.schema
    ? `"${operation.schema}"."${operation.table}"`
    : `"${operation.table}"`;

  let sql = `DELETE FROM ${tableName}`;

  // Add WHERE clause if specified
  if (operation.predicate) {
    const whereClause = generateBooleanExpression(operation.predicate, context);
    sql += ` WHERE ${whereClause}`;
  } else if (!operation.allowFullTableDelete) {
    throw new Error(
      "DELETE requires a WHERE clause or explicit allowFullTableDelete(). " +
        "Full table deletes are dangerous and must be explicitly allowed.",
    );
  }

  return sql;
}
