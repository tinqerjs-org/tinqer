/**
 * REVERSE operation visitor
 */

import type { ReverseOperation, QueryOperation } from "../../query-tree/operations.js";
import type { CallExpression as ASTCallExpression } from "../../parser/ast-types.js";
import type { VisitorContext } from "../types.js";

export function visitReverseOperation(
  _ast: ASTCallExpression,
  source: QueryOperation,
  _methodName: string,
  _visitorContext: VisitorContext,
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
