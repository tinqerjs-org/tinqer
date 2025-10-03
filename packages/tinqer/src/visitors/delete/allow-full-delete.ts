/**
 * Visitor for DELETE .allowFullTableDelete() operation
 */

import type { DeleteOperation } from "../../query-tree/operations.js";
import type { CallExpression as ASTCallExpression } from "../../parser/ast-types.js";

export interface AllowFullDeleteVisitorResult {
  operation: DeleteOperation;
  autoParams: Record<string, unknown>;
}

/**
 * Visit a .allowFullTableDelete() operation on a DELETE
 */
export function visitAllowFullDeleteOperation(
  _ast: ASTCallExpression,
  source: DeleteOperation,
): AllowFullDeleteVisitorResult | null {
  // Check if already has a WHERE clause
  if (source.predicate) {
    throw new Error("Cannot call allowFullTableDelete() after where()");
  }

  // Check if allowFullTableDelete already set
  if (source.allowFullTableDelete) {
    throw new Error("allowFullTableDelete() can only be called once");
  }

  // Create updated DELETE operation with allowFullTableDelete flag
  const updatedOperation: DeleteOperation = {
    ...source,
    allowFullTableDelete: true,
  };

  return {
    operation: updatedOperation,
    autoParams: {},
  };
}
