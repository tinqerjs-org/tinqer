/**
 * REVERSE operation visitor
 */

import type { ReverseOperation, QueryOperation } from "../../query-tree/operations.js";
import type { CallExpression as ASTCallExpression } from "../../parser/ast-types.js";

export function visitReverseOperation(
  _ast: ASTCallExpression,
  source: QueryOperation,
  _tableParams: Set<string>,
  _queryParams: Set<string>,
  _methodName: string,
): { operation: ReverseOperation; autoParams: Record<string, unknown> } | null {
  return {
    operation: {
      type: "queryOperation",
      operationType: "reverse",
      source,
    },
    autoParams: {},
  };
}
