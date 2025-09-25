/**
 * TO ARRAY operation visitor
 */

import type { ToArrayOperation, QueryOperation } from "../../query-tree/operations.js";
import type { CallExpression as ASTCallExpression } from "../../parser/ast-types.js";

export function visitToArrayOperation(
  _ast: ASTCallExpression,
  source: QueryOperation,
  _tableParams: Set<string>,
  _queryParams: Set<string>,
  _methodName: string,
): { operation: ToArrayOperation; autoParams: Record<string, unknown> } | null {
  return {
    operation: {
      type: "queryOperation",
      operationType: "toArray",
      source,
    },
    autoParams: {},
  };
}
