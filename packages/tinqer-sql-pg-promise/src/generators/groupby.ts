/**
 * GROUP BY clause generator
 */

import type { GroupByOperation } from "@webpods/tinqer";
import type { SqlContext } from "../types.js";
import { generateValueExpression } from "../expression-generator.js";

/**
 * Generate GROUP BY clause
 */
export function generateGroupBy(operation: GroupByOperation, context: SqlContext): string {
  let groupByExpr: string;

  if (typeof operation.keySelector === "string") {
    // Simple column name - check if it maps to a source column
    if (context.symbolTable) {
      const sourceRef = context.symbolTable.entries.get(operation.keySelector);
      if (sourceRef) {
        groupByExpr = `"${sourceRef.tableAlias}"."${sourceRef.columnName}"`;
      } else {
        groupByExpr = `"${operation.keySelector}"`;
      }
    } else {
      groupByExpr = `"${operation.keySelector}"`;
    }
  } else {
    // Complex expression
    groupByExpr = generateValueExpression(operation.keySelector, context);
  }

  return `GROUP BY ${groupByExpr}`;
}
