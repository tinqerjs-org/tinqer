/**
 * Visitor for INSERT operations
 */

import type { InsertOperation } from "../../query-tree/operations.js";
import type { CallExpression as ASTCallExpression } from "../../parser/ast-types.js";

/**
 * Visit an insertInto() operation
 */
export function visitInsertOperation(ast: ASTCallExpression): InsertOperation | null {
  // insertInto can have two forms:
  // 1. insertInto("tableName") or insertInto("schema.table") - single argument
  // 2. insertInto(db, "tableName") - two arguments

  if (!ast.arguments || ast.arguments.length === 0) {
    return null;
  }

  let table: string;
  let schema: string | undefined;

  if (ast.arguments.length === 1) {
    // Single argument form: insertInto("tableName") or insertInto("schema.table")
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
    // Multiple argument form: insertInto(db, "tableName")
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
    operationType: "insert",
    table,
    ...(schema && { schema }),
    values: { type: "object", properties: {} }, // Will be filled by .values()
  } as InsertOperation;
}
