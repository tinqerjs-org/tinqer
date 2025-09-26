/**
 * ORDER BY clause generator
 */

import type { OrderByOperation } from "@webpods/tinqer";
import type { SqlContext } from "../types.js";
import { generateValueExpression } from "../expression-generator.js";

/**
 * Generate ORDER BY clause
 */
export function generateOrderBy(operation: OrderByOperation, context: SqlContext): string {
  let orderByExpr: string;

  if (typeof operation.keySelector === "string") {
    // Simple column name - check if it maps to a source column

    // Check if it's a path like "o.amount"
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
  return `ORDER BY ${orderByExpr} ${direction}`;
}
