/**
 * Visitor for UPDATE operations
 */

import type { UpdateOperation } from "../../query-tree/operations.js";
import type { CallExpression as ASTCallExpression } from "../../parser/ast-types.js";

/**
 * Visit an update() operation
 */
export function visitUpdateOperation(ast: ASTCallExpression): UpdateOperation | null {
  // update can have two forms:
  // 1. update("tableName") or update("schema.table") - single argument
  // 2. update(db, "tableName") - two arguments

  if (!ast.arguments || ast.arguments.length === 0) {
    return null;
  }

  let table: string;
  let schema: string | undefined;

  if (ast.arguments.length === 1) {
    // Single argument form: update("tableName") or update("schema.table")
    const tableArg = ast.arguments[0];

    if (!tableArg) {
      return null;
    }

    // Handle both Literal and StringLiteral node types
    if (tableArg.type !== "Literal" && tableArg.type !== "StringLiteral") {
      return null;
    }

    const tableName = (tableArg as { value: string }).value;

    // Check if table name includes schema
    const parts = tableName.split(".");
    schema = parts.length > 1 ? parts[0] : undefined;
    table = parts.length > 1 ? parts[1]! : tableName;
  } else {
    // Multiple argument form: update(db, "tableName")
    // First argument is the database object (we don't need to parse it)
    // Second argument is the table name
    const tableArg = ast.arguments[1];

    if (!tableArg) {
      return null;
    }

    // Handle both Literal and StringLiteral node types
    if (tableArg.type !== "Literal" && tableArg.type !== "StringLiteral") {
      return null;
    }

    table = (tableArg as { value: string }).value;
  }

  return {
    type: "queryOperation",
    operationType: "update",
    table,
    ...(schema && { schema }),
    assignments: { type: "object", properties: {} }, // Will be filled by .set()
  } as UpdateOperation;
}
