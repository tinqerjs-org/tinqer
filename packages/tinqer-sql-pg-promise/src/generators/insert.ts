/**
 * INSERT SQL generation for PostgreSQL
 */

import type { InsertOperation } from "@webpods/tinqer";
import type { SqlContext } from "../types.js";
import { generateExpression } from "../expression-generator.js";

/**
 * Generate INSERT SQL statement
 */
export function generateInsert(operation: InsertOperation, context: SqlContext): string {
  const tableName = operation.schema
    ? `"${operation.schema}"."${operation.table}"`
    : `"${operation.table}"`;

  // Extract columns and values from the values object expression
  const columns: string[] = [];
  const values: string[] = [];

  if (operation.values.type === "object") {
    for (const [column, valueExpr] of Object.entries(operation.values.properties)) {
      columns.push(`"${column}"`);
      values.push(generateExpression(valueExpr, context));
    }
  }

  if (columns.length === 0) {
    throw new Error("INSERT must specify at least one column");
  }

  let sql = `INSERT INTO ${tableName} (${columns.join(", ")}) VALUES (${values.join(", ")})`;

  // Add RETURNING clause if specified
  if (operation.returning !== undefined) {
    // Handle AllColumnsExpression (identity function like .returning(u => u))
    if (operation.returning.type === "allColumns") {
      sql += ` RETURNING *`;
    } else {
      const returningExpr = generateExpression(operation.returning, context);
      sql += ` RETURNING ${returningExpr}`;
    }
  }

  return sql;
}
