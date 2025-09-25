/**
 * DISTINCT operation visitor
 * Handles .distinct() operation to remove duplicates
 */

import type { DistinctOperation, QueryOperation } from "../../query-tree/operations.js";
import type { CallExpression as ASTCallExpression } from "../../parser/ast-types.js";
import type { VisitorContext } from "../types.js";

/**
 * Visit DISTINCT operation
 * Simple operation with no arguments
 */
export function visitDistinctOperation(
  _ast: ASTCallExpression,
  source: QueryOperation,
  _methodName: string,
  _visitorContext: VisitorContext,
): { operation: DistinctOperation; autoParams: Record<string, unknown> } | null {
  // DISTINCT has no arguments, just marks the query for distinct results
  return {
    operation: {
      type: "queryOperation",
      operationType: "distinct",
      source,
    },
    autoParams: {},
  };
}
