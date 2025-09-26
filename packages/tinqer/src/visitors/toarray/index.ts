/**
 * TO ARRAY operation visitor
 */

import type { ToArrayOperation, QueryOperation } from "../../query-tree/operations.js";
import type { CallExpression as ASTCallExpression } from "../../parser/ast-types.js";
import type { VisitorContext } from "../types.js";

export function visitToArrayOperation(
  _ast: ASTCallExpression,
  source: QueryOperation,
  _methodName: string,
  _visitorContext: VisitorContext,
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
