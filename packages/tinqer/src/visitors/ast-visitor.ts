/**
 * Helper function for visitors to recursively parse query operations
 */

import type { QueryOperation } from "../query-tree/operations.js";
import type { Expression as ASTExpression } from "../parser/ast-types.js";
import type { VisitorContext } from "./types.js";
import { convertAstToQueryOperationWithParams } from "../parser/ast-visitor.js";

/**
 * Visit an AST expression and convert it to a QueryOperation
 * Used by visitors that need to recursively parse sub-queries (like JOIN)
 */
export function visitAstToQueryOperation(
  ast: ASTExpression,
  _tableParams: Set<string>,
  _queryParams: Set<string>,
  visitorContext?: VisitorContext,
): { operation: QueryOperation | null; autoParams: Record<string, unknown> } | null {
  // Pass existing context to preserve auto-param counter and existing params
  const result = convertAstToQueryOperationWithParams(
    ast,
    visitorContext?.autoParamCounter,
    visitorContext?.autoParams,
  );

  if (!result || !result.operation) {
    return null;
  }

  return {
    operation: result.operation,
    autoParams: result.autoParams || {},
  };
}
