/**
 * Visitor for UPDATE .allowFullTableUpdate() operation
 */

import type { UpdateOperation } from "../../query-tree/operations.js";
import type { CallExpression as ASTCallExpression } from "../../parser/ast-types.js";

export interface AllowFullUpdateVisitorResult {
  operation: UpdateOperation;
  autoParams: Record<string, unknown>;
}

/**
 * Visit a .allowFullTableUpdate() operation on an UPDATE
 */
export function visitAllowFullUpdateOperation(
  _ast: ASTCallExpression,
  source: UpdateOperation,
): AllowFullUpdateVisitorResult | null {
  // Check if already has a WHERE clause
  if (source.predicate) {
    throw new Error("Cannot call allowFullTableUpdate() after where()");
  }

  // Check if allowFullTableUpdate already set
  if (source.allowFullTableUpdate) {
    throw new Error("allowFullTableUpdate() can only be called once");
  }

  // Create updated UPDATE operation with allowFullTableUpdate flag
  const updatedOperation: UpdateOperation = {
    ...source,
    allowFullTableUpdate: true,
  };

  return {
    operation: updatedOperation,
    autoParams: {},
  };
}
