/**
 * CONTAINS operation visitor
 */

import type { ContainsOperation, QueryOperation } from "../../query-tree/operations.js";
import type { ValueExpression } from "../../expressions/expression.js";
import type { CallExpression as ASTCallExpression } from "../../parser/ast-types.js";
import type { VisitorContext } from "../types.js";
import { isValueExpression } from "../visitor-utils.js";
import { visitExpression } from "../expression-visitor.js";

export function visitContainsOperation(
  ast: ASTCallExpression,
  source: QueryOperation,
  _methodName: string,
  visitorContext: VisitorContext,
): { operation: ContainsOperation; autoParams: Record<string, unknown> } | null {
  if (ast.arguments && ast.arguments.length > 0) {
    const valueArg = ast.arguments[0];
    if (valueArg) {
      const result = visitExpression(
        valueArg,
        visitorContext.tableParams,
        visitorContext.queryParams,
      );

      if (result?.expression && isValueExpression(result.expression)) {
        return {
          operation: {
            type: "queryOperation",
            operationType: "contains",
            source,
            value: result.expression as ValueExpression,
          },
          autoParams: result.autoParams || {},
        };
      }
    }
  }
  return null;
}
