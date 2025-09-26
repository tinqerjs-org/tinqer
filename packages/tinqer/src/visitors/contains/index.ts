/**
 * CONTAINS operation visitor
 */

import type { ContainsOperation, QueryOperation } from "../../query-tree/operations.js";
import type { CallExpression as ASTCallExpression } from "../../parser/ast-types.js";
import type { VisitorContext } from "../types.js";
import { visitValue } from "../shared/value-visitor.js";

export function visitContainsOperation(
  ast: ASTCallExpression,
  source: QueryOperation,
  _methodName: string,
  visitorContext: VisitorContext,
): { operation: ContainsOperation; autoParams: Record<string, unknown> } | null {
  if (ast.arguments && ast.arguments.length > 0) {
    const valueArg = ast.arguments[0];
    if (valueArg) {
      const result = visitValue(
        valueArg,
        visitorContext.tableParams,
        visitorContext.queryParams,
        visitorContext.autoParams,
        visitorContext.autoParamCounter,
      );

      if (result.value) {
        visitorContext.autoParamCounter = result.counter;
        return {
          operation: {
            type: "queryOperation",
            operationType: "contains",
            source,
            value: result.value,
          },
          autoParams: result.autoParams || {},
        };
      }
    }
  }
  return null;
}
