/**
 * DISTINCT operation visitor
 * Handles .distinct() operation to remove duplicates
 */

import type { DistinctOperation, QueryOperation } from "../../query-tree/operations.js";
import type { CallExpression as ASTCallExpression } from "../../parser/ast-types.js";

/**
 * Visit DISTINCT operation
 * Simple operation with no arguments
 */
export function visitDistinctOperation(
  _ast: ASTCallExpression,
  source: QueryOperation,
  _tableParams: Set<string>,
  _queryParams: Set<string>,
  _methodName: string,
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
