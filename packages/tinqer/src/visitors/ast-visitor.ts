/**
 * Helper function for visitors to recursively parse query operations
 */

import type { QueryOperation } from "../query-tree/operations.js";
import type { Expression as ASTExpression } from "../parser/ast-types.js";
import { convertAstToQueryOperationWithParams } from "../parser/ast-visitor.js";

/**
 * Visit an AST expression and convert it to a QueryOperation
 * Used by visitors that need to recursively parse sub-queries (like JOIN)
 */
export function visitAstToQueryOperation(
  ast: ASTExpression,
  _tableParams: Set<string>,
  _queryParams: Set<string>
): { operation: QueryOperation | null; autoParams: Record<string, unknown> } | null {
  // Use the main parser to convert the AST
  const result = convertAstToQueryOperationWithParams(ast);

  if (!result || !result.operation) {
    return null;
  }

  return {
    operation: result.operation,
    autoParams: result.autoParams || {}
  };
}