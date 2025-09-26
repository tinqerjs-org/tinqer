/**
 * FROM operation visitor
 * Root of all query chains - extracts table and schema information
 */

import type { FromOperation } from "../../query-tree/operations.js";
import type { CallExpression as ASTCallExpression } from "../../parser/ast-types.js";

/**
 * Visit FROM operation
 * Extracts table name and optional schema
 */
export function visitFromOperation(ast: ASTCallExpression): FromOperation | null {
  // FROM can have two forms:
  // 1. from("tableName") - single argument
  // 2. from(db, "tableName") or from(db, "tableName", "schema") - two or three arguments

  if (!ast.arguments || ast.arguments.length === 0) {
    return null;
  }

  let table: string;
  let schema: string | undefined;

  if (ast.arguments.length === 1) {
    // Single argument form: from("tableName")
    const tableArg = ast.arguments[0];

    if (!tableArg) {
      return null;
    }

    // Handle both Literal and StringLiteral node types
    if (tableArg.type !== "Literal" && tableArg.type !== "StringLiteral") {
      return null;
    }

    table = (tableArg as { value: string }).value;
  } else {
    // Multiple argument form: from(db, "tableName", "schema"?)
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

    // Optional third argument is schema
    if (ast.arguments.length >= 3) {
      const schemaArg = ast.arguments[2];
      if (schemaArg && (schemaArg.type === "Literal" || schemaArg.type === "StringLiteral")) {
        schema = (schemaArg as { value: string }).value;
      }
    }
  }

  return {
    type: "queryOperation",
    operationType: "from",
    table,
    ...(schema && { schema }),
  };
}
