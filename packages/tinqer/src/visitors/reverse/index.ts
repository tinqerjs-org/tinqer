/**
 * REVERSE operation visitor
 */

import type { ReverseOperation, QueryOperation } from "../../query-tree/operations.js";
import type { CallExpression as ASTCallExpression } from "../../parser/ast-types.js";

export function visitReverseOperation(
  ast: ASTCallExpression,
  source: QueryOperation,
  tableParams: Set<string>,
  queryParams: Set<string>,
  methodName: string
): { operation: ReverseOperation; autoParams: Record<string, unknown> } | null {
  return {
    operation: {
      type: "queryOperation",
      operationType: "reverse",
      source,
    },
    autoParams: {}
  };
}