/**
 * THEN BY clause generator
 */

import type { ThenByOperation } from "@webpods/tinqer";
import type { SqlContext } from "../types.js";
import { generateValueExpression } from "../expression-generator.js";

/**
 * Generate additional ORDER BY clause
 * Note: THEN BY in SQL is just additional ORDER BY columns
 */
export function generateThenBy(operation: ThenByOperation, context: SqlContext): string {
  let orderByExpr: string;

  if (typeof operation.keySelector === "string") {
    // Simple column name - check if it maps to a source column

    // Check if it's a path like "u.age"
    if (operation.keySelector.includes(".") && context.symbolTable) {
      const parts = operation.keySelector.split(".");
      if (parts.length === 2) {
        const tableRef = context.symbolTable.entries.get(parts[0]!);
        if (tableRef && tableRef.columnName === "*") {
          orderByExpr = `"${tableRef.tableAlias}"."${parts[1]}"`;
        } else {
          // Try full path
          const pathRef = context.symbolTable.entries.get(operation.keySelector);
          if (pathRef) {
            orderByExpr = `"${pathRef.tableAlias}"."${pathRef.columnName}"`;
          } else {
            orderByExpr = `"${operation.keySelector}"`;
          }
        }
      } else {
        orderByExpr = `"${operation.keySelector}"`;
      }
    } else if (context.symbolTable) {
      const sourceRef = context.symbolTable.entries.get(operation.keySelector);
      if (sourceRef) {
        orderByExpr = `"${sourceRef.tableAlias}"."${sourceRef.columnName}"`;
      } else {
        orderByExpr = `"${operation.keySelector}"`;
      }
    } else {
      orderByExpr = `"${operation.keySelector}"`;
    }
  } else {
    // Complex expression
    orderByExpr = generateValueExpression(operation.keySelector, context);
  }

  const direction = operation.descending ? "DESC" : "ASC";
  // Note: This returns just the additional column, not the full ORDER BY clause
  // The orchestrator will combine all ORDER BY columns
  return `, ${orderByExpr} ${direction}`;
}
