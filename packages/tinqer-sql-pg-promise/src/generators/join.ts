/**
 * JOIN operation generator
 */

import type {
  JoinOperation,
  Expression,
  ObjectExpression,
  ColumnExpression,
} from "@webpods/tinqer";
import type { SqlContext, SymbolTable, SourceReference } from "../types.js";
import { generateSql } from "../sql-generator.js";

/**
 * Build symbol table from JOIN result selector
 */
function buildSymbolTable(
  resultSelector: Expression | undefined,
  outerAlias: string,
  innerAlias: string,
  context: SqlContext,
): void {
  if (!resultSelector || resultSelector.type !== "object") {
    return;
  }

  // Initialize symbol table if not exists
  if (!context.symbolTable) {
    context.symbolTable = {
      entries: new Map<string, SourceReference>(),
    };
  }

  const objExpr = resultSelector as ObjectExpression;

  // Process each property in the result selector
  for (const [propName, expr] of Object.entries(objExpr.properties)) {
    processExpression(propName, expr, outerAlias, innerAlias, context.symbolTable, "");
  }
}

/**
 * Recursively process expressions to build symbol table entries
 */
function processExpression(
  propName: string,
  expr: Expression,
  outerAlias: string,
  innerAlias: string,
  symbolTable: SymbolTable,
  parentPath: string,
): void {
  const fullPath = parentPath ? `${parentPath}.${propName}` : propName;

  if (expr.type === "column") {
    const colExpr = expr as ColumnExpression;

    // Check if this references a JOIN parameter ($param0, $param1)
    if (colExpr.table && colExpr.table.startsWith("$param")) {
      const paramIndex = parseInt(colExpr.table.substring(6), 10);
      const tableAlias = paramIndex === 0 ? outerAlias : innerAlias;

      symbolTable.entries.set(fullPath, {
        tableAlias,
        columnName: colExpr.name,
      });
    } else {
      // Regular column without parameter reference
      symbolTable.entries.set(fullPath, {
        tableAlias: colExpr.table || outerAlias,
        columnName: colExpr.name,
      });
    }
  } else if (expr.type === "object") {
    // Nested object - recurse
    const nestedObj = expr as ObjectExpression;
    for (const [nestedProp, nestedExpr] of Object.entries(nestedObj.properties)) {
      processExpression(nestedProp, nestedExpr, outerAlias, innerAlias, symbolTable, fullPath);
    }
  }
  // TODO: Handle other expression types (arithmetic, concat, etc.)
}

/**
 * Generate JOIN clause
 */
export function generateJoin(operation: JoinOperation, context: SqlContext): string {
  // Get table aliases
  const outerAlias = context.tableAliases.values().next().value || "t0";
  const innerAlias = `t${context.aliasCounter++}`;

  // Build symbol table from result selector
  if (operation.resultSelector) {
    buildSymbolTable(operation.resultSelector, outerAlias, innerAlias, context);
    // Store the result shape for later operations
    context.currentShape = operation.resultSelector;
  }

  // Check if inner is just a simple FROM operation
  let joinClause: string;
  if (operation.inner.operationType === "from") {
    const fromOp = operation.inner as any;
    const tableName = fromOp.table;
    joinClause = `INNER JOIN "${tableName}" AS "${innerAlias}"`;
  } else {
    // Complex inner query - need subquery
    const innerSql = generateSql(operation.inner, {});
    joinClause = `INNER JOIN (${innerSql}) AS "${innerAlias}"`;
  }

  // Build ON clause
  const onClause = `ON "${outerAlias}"."${operation.outerKey}" = "${innerAlias}"."${operation.innerKey}"`;

  return `${joinClause} ${onClause}`;
}
